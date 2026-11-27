import JSZip from "jszip";
import { load } from "cheerio";

/**
 * Lectura de planillas en el servidor, sin dependencias nuevas: CSV a mano y XLSX con jszip + cheerio
 * (el XLSX es un zip con XML). Devuelve celdas como texto y, aparte, los links de cada celda
 * (Google Sheets exporta los links de "Careers" como hipervínculos o fórmulas HYPERLINK).
 */

export type Row = { cells: string[]; links: (string | null)[] };
export type Sheet = { name: string; rows: Row[] };

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 40 * 1024 * 1024;
export const MAX_ROWS = 5000;
const MAX_COLS = 60;

export class TabularError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

/* ---------- CSV ---------- */

function detectDelimiter(text: string): string {
  const first = text.split(/\r?\n/).slice(0, 5).join("\n");
  const count = (d: string) => first.split(d).length - 1;
  return [",", ";", "\t"].sort((a, b) => count(b) - count(a))[0];
}

export function parseCsv(text: string, name = "CSV"): Sheet {
  const src = text.replace(/^﻿/, "");
  const d = detectDelimiter(src);
  const rows: Row[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const pushRow = () => {
    row.push(cell);
    cell = "";
    if (rows.length >= MAX_ROWS) throw new TabularError(`El archivo tiene más de ${MAX_ROWS} filas.`, "TOO_MANY_ROWS");
    const cells = row.slice(0, MAX_COLS).map((c) => c.trim());
    rows.push({ cells, links: cells.map(() => null) });
    row = [];
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === d) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      pushRow();
    } else cell += ch;
  }
  if (cell !== "" || row.length) pushRow();
  return { name, rows };
}

/* ---------- XLSX ---------- */

const colIndex = (ref: string) => {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const xml = (s: string) => load(s, { xml: true });

function resolveTarget(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function relsOf(zipPath: string): string {
  const parts = zipPath.split("/");
  const file = parts.pop();
  return [...parts, "_rels", `${file}.rels`].join("/");
}

const HYPERLINK_FORMULA = /HYPERLINK\(\s*"([^"]+)"/i;

export async function parseXlsx(buf: ArrayBuffer | Uint8Array): Promise<Sheet[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    throw new TabularError("No pudimos abrir el archivo. Exportalo de nuevo como .xlsx o .csv.", "BAD_FILE");
  }
  let total = 0;
  zip.forEach((_, f) => {
    total += (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  });
  if (total > MAX_UNZIPPED_BYTES) throw new TabularError("El archivo descomprimido es demasiado grande.", "TOO_LARGE");

  const read = async (p: string) => (await zip.file(p)?.async("string")) ?? null;
  const workbook = await read("xl/workbook.xml");
  if (!workbook) throw new TabularError("El archivo no parece una planilla de Excel.", "BAD_FILE");

  const shared: string[] = [];
  const sst = await read("xl/sharedStrings.xml");
  if (sst) {
    const $ = xml(sst);
    $("si").each((_, si) => {
      shared.push($(si).find("t").map((__, t) => $(t).text()).get().join(""));
    });
  }

  const wbRels = xml((await read("xl/_rels/workbook.xml.rels")) ?? "<Relationships/>");
  const targets = new Map<string, string>();
  wbRels("Relationship").each((_, r) => {
    targets.set(wbRels(r).attr("Id") ?? "", resolveTarget("xl/workbook.xml", wbRels(r).attr("Target") ?? ""));
  });

  const $wb = xml(workbook);
  const sheets: Sheet[] = [];
  let rowCount = 0;
  for (const el of $wb("sheet").toArray()) {
    const name = $wb(el).attr("name") ?? `Hoja ${sheets.length + 1}`;
    const rid = $wb(el).attr("r:id") ?? "";
    const path = targets.get(rid);
    const body = path ? await read(path) : null;
    if (!body || !path) continue;
    const $ = xml(body);

    const links = new Map<string, string>();
    const relsXml = await read(relsOf(path));
    if (relsXml) {
      const $r = xml(relsXml);
      const relTargets = new Map<string, string>();
      $r("Relationship").each((_, r) => {
        relTargets.set($r(r).attr("Id") ?? "", $r(r).attr("Target") ?? "");
      });
      $("hyperlink").each((_, h) => {
        const ref = $(h).attr("ref") ?? "";
        const url = relTargets.get($(h).attr("r:id") ?? "");
        if (ref && url) links.set(ref.split(":")[0], url);
      });
    }

    const rows: Row[] = [];
    for (const r of $("sheetData > row").toArray()) {
      if (++rowCount > MAX_ROWS) throw new TabularError(`El archivo tiene más de ${MAX_ROWS} filas.`, "TOO_MANY_ROWS");
      const rowIdx = Number($(r).attr("r") ?? rows.length + 1) - 1;
      while (rows.length < rowIdx) rows.push({ cells: [], links: [] });
      const cells: string[] = [];
      const cellLinks: (string | null)[] = [];
      $(r)
        .children("c")
        .each((_, c) => {
          const ref = $(c).attr("r") ?? "";
          const i = colIndex(ref);
          if (i >= MAX_COLS) return;
          const t = $(c).attr("t");
          const v = $(c).children("v").text();
          let value: string;
          if (t === "s") value = shared[Number(v)] ?? "";
          else if (t === "inlineStr") value = $(c).find("is t").map((__, x) => $(x).text()).get().join("");
          else if (t === "b") value = v === "1" ? "VERDADERO" : "FALSO";
          else value = v;
          while (cells.length < i) { cells.push(""); cellLinks.push(null); }
          cells[i] = value.trim();
          const formula = $(c).children("f").text();
          cellLinks[i] = links.get(ref) ?? formula.match(HYPERLINK_FORMULA)?.[1] ?? null;
        });
      rows.push({ cells, links: cellLinks });
    }
    sheets.push({ name, rows });
  }
  if (!sheets.length) throw new TabularError("La planilla no tiene pestañas con datos.", "EMPTY");
  return sheets;
}

/** Lee un archivo subido (XLSX o CSV) según su contenido, no sólo la extensión. */
export async function parseSpreadsheet(name: string, bytes: Uint8Array): Promise<Sheet[]> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new TabularError("El archivo pesa más de 5 MB.", "TOO_LARGE");
  if (!bytes.byteLength) throw new TabularError("El archivo está vacío.", "EMPTY");
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) return parseXlsx(bytes);
  if (/\.xlsx?$/i.test(name)) throw new TabularError("No pudimos leer el archivo. Exportalo de nuevo como .xlsx o .csv.", "BAD_FILE");
  const text = new TextDecoder("utf-8").decode(bytes);
  if (text.includes("\u0000")) throw new TabularError("El archivo no es un CSV de texto.", "BAD_FILE");
  return [parseCsv(text, name.replace(/\.csv$/i, "") || "CSV")];
}
