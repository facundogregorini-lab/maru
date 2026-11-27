import JSZip from "jszip";

/**
 * Lectura de planillas para la importación del Radar: CSV y XLSX (también el export de Google Sheets).
 * Corre en el navegador: el archivo de la persona no se sube a ningún servidor.
 */

export type Sheet = {
  name: string;
  rows: string[][];
  /** Links de celda ("fila,columna" → URL), por si la celda muestra texto y el link va aparte. */
  links: Record<string, string>;
};

export const MAX_ROWS = 5000;
export const MAX_COLS = 60;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

/** CSV con comillas (RFC 4180). Detecta coma, punto y coma o tabulador. */
export function parseCsv(text: string, name = "CSV"): Sheet {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length] as const);
  const delimiter = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row.slice(0, MAX_COLS));
      row = [];
      cell = "";
      if (rows.length >= MAX_ROWS) break;
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row.slice(0, MAX_COLS));
  }
  return { name, rows: rows.map((r) => r.map((c) => c.trim())), links: {} };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export function xmlText(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** "AB12" → { row: 11, col: 27 } (base 0). */
export function cellRef(ref: string): { row: number; col: number } | null {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}

/** Todos los <t> de un fragmento (texto enriquecido de sharedStrings o inlineStr). */
function allText(xml: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out += xmlText(m[1] ?? "");
  return out;
}

function relTargets(xml: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!xml) return out;
  for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) out[id] = xmlText(target);
  }
  return out;
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

/** Lee un .xlsx: todas las pestañas, con el texto que muestra cada celda y sus links. */
export async function parseXlsx(data: ArrayBuffer | Uint8Array): Promise<Sheet[]> {
  const zip = await JSZip.loadAsync(data);
  const read = async (p: string) => zip.file(p)?.async("string");
  const workbook = await read("xl/workbook.xml");
  if (!workbook) throw new Error("El archivo no parece un Excel (.xlsx) válido.");
  const rels = relTargets(await read("xl/_rels/workbook.xml.rels"));
  const sharedXml = (await read("xl/sharedStrings.xml")) ?? "";
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => allText(m[1]));

  const sheets: Sheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    const name = xmlText(attr(m[0], "name") ?? `Hoja ${sheets.length + 1}`);
    const rid = attr(m[0], "r:id");
    const target = rid ? rels[rid] : undefined;
    if (!target) continue;
    const path = resolvePath("xl/workbook.xml", target);
    const xml = await read(path);
    if (!xml) continue;
    const sheetRels = relTargets(await read(path.replace(/([^/]+)$/, "_rels/$1.rels")));
    sheets.push(readSheet(name, xml, shared, sheetRels));
  }
  return sheets;
}

function readSheet(name: string, xml: string, shared: string[], rels: Record<string, string>): Sheet {
  const rows: string[][] = [];
  const links: Record<string, string> = {};
  const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(xml))) {
    const ref = cellRef(attr(m[1], "r") ?? "");
    if (!ref || ref.row >= MAX_ROWS || ref.col >= MAX_COLS) continue;
    const type = attr(m[1], "t");
    const body = m[2] ?? "";
    const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    let text = "";
    if (type === "s" && v !== undefined) text = shared[Number(v)] ?? "";
    else if (type === "inlineStr") text = allText(body);
    else if (v !== undefined) text = xmlText(v);
    const formula = body.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1];
    const hyper = formula ? xmlText(formula).match(/^HYPERLINK\(\s*"([^"]+)"/i)?.[1] : undefined;
    if (hyper) links[`${ref.row},${ref.col}`] = hyper;
    const row = (rows[ref.row] ??= []);
    row[ref.col] = text.trim();
  }
  for (const h of xml.matchAll(/<hyperlink\b[^>]*\/?>/g)) {
    const ref = cellRef((attr(h[0], "ref") ?? "").split(":")[0]);
    const rid = attr(h[0], "r:id");
    const url = rid ? rels[rid] : undefined;
    if (ref && url) links[`${ref.row},${ref.col}`] = url;
  }
  // Filas y celdas vacías intermedias como "".
  const filled: string[][] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    filled.push(Array.from({ length: row.length }, (_, c) => row[c] ?? ""));
  }
  return { name, rows: filled, links };
}
