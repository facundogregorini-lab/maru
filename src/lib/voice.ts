/** Cómo se vuelca lo dictado por voz en cada tipo de campo. */

/** Primera letra en mayúscula (el dictado a veces empieza en minúscula). */
export function capitalize(text: string): string {
  const t = text.trim();
  return t ? t[0].toLocaleUpperCase("es") + t.slice(1) : t;
}

/** Texto libre: lo dictado se suma al final de lo que ya había. */
export function appendSpoken(prev: string, text: string): string {
  const t = text.trim();
  if (!t) return prev;
  return prev.trim() ? `${prev.trimEnd()} ${t}` : capitalize(t);
}

/** Campo de un solo valor (titular, ciudad): la primera frase de cada grabación reemplaza, las siguientes se suman. */
export function replaceSpoken(prev: string, text: string, first: boolean): string {
  return first ? capitalize(text) : appendSpoken(prev, text);
}

/** Lista dictada: "SQL, Python y Excel" → ["SQL", "Python", "Excel"]. */
export function spokenList(text: string): string[] {
  return text
    .split(/\s*(?:[,;]|\by\b|\be\b)\s*/i)
    .map(capitalize)
    .filter(Boolean);
}

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Número dictado: "6 años", "5.000 dólares", "1,5 millones", "dos mil quinientos", "un millón y medio".
 * Devuelve null si no hay un número.
 */
export function parseSpokenNumber(text: string): number | null {
  const t = strip(text);
  const digits = t.match(/(\d[\d.,]*)\s*(mil|millon(?:es)?|k)?\b/);
  if (digits) {
    const raw = digits[1].replace(/[.,]$/, "");
    const n = /^\d{1,3}([.,]\d{3})+$/.test(raw) ? Number(raw.replace(/[.,]/g, "")) : Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    const mult = digits[2] === "mil" || digits[2] === "k" ? 1_000 : digits[2]?.startsWith("millon") ? 1_000_000 : 1;
    return Math.round(n * mult);
  }
  let total = 0;
  let current = 0;
  let last = 0;
  let found = false;
  for (const tok of t.split(/[^a-z]+/).filter(Boolean)) {
    if (tok in UNITS) {
      current += UNITS[tok];
      found = true;
    } else if (tok === "mil" || tok === "millon" || tok === "millones") {
      last = tok === "mil" ? 1_000 : 1_000_000;
      total += (current || 1) * last;
      current = 0;
      found = true;
    } else if (tok === "medio" && last) {
      total += last / 2;
    } else if (tok !== "y" && found) {
      break;
    }
  }
  return found ? total + current : null;
}
