import * as cheerio from "cheerio";
import { safeFetch } from "./match/http";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export type JobPage = {
  url: string;
  title: string;
  text: string;
  formFields: string[];
};

const MAX_TEXT = 40_000;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const MAX_BYTES = 3_000_000;

/**
 * Lee la página del aviso. Sólo direcciones públicas (nada de la red interna, ni siquiera después de una
 * redirección) y como mucho 3 MB: el link lo escribe la persona.
 */
async function fetchHtml(url: string): Promise<string> {
  const res = await safeFetch(url, { timeoutMs: 15_000, headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const part = await reader.read();
    if (part.done) break;
    chunks.push(part.value);
    size += part.value.length;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).toString("utf8");
}

/** Busca datos estructurados schema.org/JobPosting, que muchos portales publican. */
function extractJobPosting($: cheerio.CheerioAPI): string {
  const chunks: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      const items = Array.isArray(data) ? data : data["@graph"] ?? [data];
      for (const item of items) {
        if (item?.["@type"] !== "JobPosting") continue;
        const decode = (v: unknown) => cheerio.load(String(v ?? "")).text();
        const desc = decode(item.description);
        chunks.push(
          [
            item.title && `Puesto: ${decode(item.title)}`,
            item.hiringOrganization?.name && `Empresa: ${decode(item.hiringOrganization.name)}`,
            item.employmentType && `Tipo: ${item.employmentType}`,
            desc,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }
    } catch {
      // JSON-LD inválido: lo ignoramos
    }
  });
  return chunks.join("\n\n");
}

/** Extrae etiquetas de campos de formulario (Greenhouse, Lever, Workable, etc. suelen renderizarlos en HTML). */
function extractFormFields($: cheerio.CheerioAPI): string[] {
  const fields = new Set<string>();
  $("form label, form legend, [role=group] legend").each((_, el) => {
    const label = $(el).text().replace(/\s+/g, " ").trim();
    if (label && label.length < 200) fields.add(label);
  });
  $("form input, form textarea, form select").each((_, el) => {
    const $el = $(el);
    const type = $el.attr("type");
    if (type === "hidden" || type === "submit") return;
    const label = $el.attr("aria-label") || $el.attr("placeholder");
    if (label && label.length < 200) fields.add(label.trim());
    if (el.tagName === "select") {
      const options = $el
        .find("option")
        .map((_, o) => $(o).text().trim())
        .get()
        .filter(Boolean)
        .slice(0, 12);
      if (options.length) fields.add(`${label ?? $el.attr("name") ?? "Selección"} → opciones: ${options.join(" | ")}`);
    }
  });
  return [...fields].slice(0, 60);
}

export async function fetchJobPage(url: string): Promise<JobPage> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const posting = extractJobPosting($);
  let formFields = extractFormFields($);

  // Lever publica el formulario en una página aparte (/apply).
  if (!formFields.length && /(^|\.)lever\.co$/.test(new URL(url).hostname) && !url.endsWith("/apply")) {
    try {
      formFields = extractFormFields(cheerio.load(await fetchHtml(`${url.replace(/\/$/, "")}/apply`)));
    } catch {
      // sin formulario: Claude infiere los campos habituales
    }
  }

  $("script, style, noscript, svg, nav, footer, header, iframe").remove();
  const main = $("main").length ? $("main") : $("body");
  const bodyText = main.text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

  const text = [posting, bodyText].filter(Boolean).join("\n\n---\n\n").slice(0, MAX_TEXT);
  return { url, title, text, formFields };
}
