/** Utilidades de texto sin dependencias (las usan la app, el script de sync y los tests). */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•",
  middot: "·",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  Ntilde: "Ñ",
  uuml: "ü",
  ccedil: "ç",
  atilde: "ã",
  otilde: "õ",
  euro: "€",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[code] ?? m;
  });
}

/**
 * HTML de un aviso → texto plano seguro (sin etiquetas, scripts ni estilos).
 * Greenhouse entrega el HTML escapado con entidades: si detectamos "&lt;p&gt;" lo decodificamos antes.
 */
export function htmlToText(html: string | null | undefined, maxLen = 6000): string {
  if (!html) return "";
  let s = String(html);
  if (/&lt;\/?[a-z]/i.test(s) && !/<\/?[a-z][^>]*>/i.test(s)) s = decodeEntities(s);
  s = s
    .replace(/<(script|style|noscript|iframe|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*(p|div|h[1-6]|ul|ol|li|tr|section|article)\s*>/gi, "\n")
    .replace(/<\s*(h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  s = decodeEntities(s)
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s.length > maxLen ? `${s.slice(0, maxLen).trimEnd()}…` : s;
}

/** Texto visible para el usuario: sin caracteres de control; React escapa el resto. */
export function sanitizeDisplay(s: string, maxLen = 400): string {
  // eslint-disable-next-line no-control-regex
  const clean = s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen).trimEnd()}…` : clean;
}

/** minúsculas, sin acentos, sin signos: para comparar. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  "a al and as at be by con de del el en for from in is la las los of on or para por que the to un una y with you your our we will".split(" "),
);

export function tokens(s: string): string[] {
  return fold(s)
    .split(/[\s/]+/)
    .map((t) => t.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Similitud de Jaccard entre conjuntos de "shingles" de 3 palabras. */
export function shingleSimilarity(a: string, b: string): number {
  const sh = (s: string) => {
    const t = tokens(s).slice(0, 600);
    const out = new Set<string>();
    for (let i = 0; i + 2 < t.length; i++) out.add(`${t[i]} ${t[i + 1]} ${t[i + 2]}`);
    return out;
  };
  const A = sh(a);
  const B = sh(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** URL canónica para deduplicar: sin query de tracking, sin barra final, host en minúsculas. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^job-boards\.(eu\.)?greenhouse\.io$/, "boards.$1greenhouse.io");
    const indeedId = /(^|\.)indeed\.com$/.test(host) ? u.searchParams.get("jk") : null;
    if (indeedId) return `indeed-job:${indeedId}`;
    const computrabajoId = /(^|\.)computrabajo\.com$/.test(host) ? u.searchParams.get("oi") : null;
    if (computrabajoId) return `computrabajo-job:${computrabajoId}`;
    // Greenhouse identifica el aviso por gh_jid aunque la página esté en el sitio de la empresa.
    const ghJid = u.searchParams.get("gh_jid");
    if (ghJid) return `greenhouse-job:${ghJid}`;
    const ghPath = /greenhouse\.io$/.test(host) ? u.pathname.match(/\/jobs\/(\d+)/) : null;
    if (ghPath) return `greenhouse-job:${ghPath[1]}`;
    const path = u.pathname.replace(/\/(apply|application)\/?$/i, "").replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}
