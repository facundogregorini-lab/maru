import type { Field, Salary } from "./types";

/**
 * Salario publicado dentro del texto del aviso ("Sueldo: $1.200.000 - $1.300.000 al mes",
 * "salary range for this role is $5,000 - $9,500 per month (Gross in USD)").
 * Sólo cuando una palabra de salario lo anuncia: nunca rondas de inversión, facturación ni
 * "salario estimado" de terceros (eso no lo publicó el empleador).
 */
const ANCHOR = /(salario|sueldo|remuneraci[oó]n|rango salarial|banda salarial|compensation|salary|pay range|base pay|hourly rate|tarifa)/gi;
const NOT_PUBLISHED = /(estimad|estimate|promedio|average|funding|financiaci|valuad|valuation|billion|million|mill[oó]n|millones|trillion|revenue|factura)/i;
const NUM = String.raw`(?:US?\s?\$|U\$S|AR\$|ARS|USD|€|\$)?\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(k|mil)?`;
const RANGE = new RegExp(`${NUM}(?:\\s?(?:usd|ars|dólares|dolares|pesos))?(?:\\s*(?:-|–|—|a|to|y|hasta)\\s*${NUM})?`, "i");

function toNumber(raw: string, k?: string): number | null {
  let s = raw;
  // "1.300.000", "2,500,000" o "111.111,00": el último separador es decimal sólo si le siguen 1 o 2 dígitos.
  const dec = s.match(/[.,](\d{1,2})$/);
  if (dec) s = s.slice(0, -dec[0].length);
  s = s.replace(/[.,]/g, "");
  let n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (k) n *= 1000;
  return n;
}

const PERIODS: [Salary["period"] | "semana", RegExp][] = [
  ["hora", /(per hour|\/ ?h(ou)?r\b|\/h\b|la hora|por hora|hourly|an hour)/i],
  ["mes", /(per month|\/ ?month|\/ ?mo\b|\/ ?mes|al mes|por mes|mensual|monthly|a month)/i],
  ["anio", /(per year|\/ ?year|\/ ?yr|anual|al año|por año|annual|a year|yearly)/i],
  ["semana", /(per week|por semana|semanal|weekly)/i],
];

/** El período que aparece primero después del monto. */
function periodOf(text: string): Salary["period"] | "semana" {
  let best: [Salary["period"] | "semana", number] = ["desconocido", Infinity];
  for (const [period, re] of PERIODS) {
    const i = text.search(re);
    if (i !== -1 && i < best[1]) best = [period, i];
  }
  return best[0];
}

function currencyOf(text: string, raw: string): string {
  if (/(usd|us ?\$|u\$s|dólares|dolares|dollars)/i.test(text)) return "USD";
  if (/(€|\beur\b|euros?)/i.test(text)) return "EUR";
  if (/(\bars\b|ar\$|pesos)/i.test(text)) return "ARS";
  // Sin moneda escrita manda el formato: "1.300.000" (punto de miles) son pesos; "$5,000" (coma de miles), dólares.
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(raw)) return "ARS";
  if (/\$/.test(text) && /^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(raw)) return "USD";
  return "";
}

/** Rangos razonables por moneda y período: lo que cae afuera probablemente no es un sueldo. */
function plausible(s: Salary): boolean {
  const v = s.max ?? s.min ?? 0;
  if (s.currency === "USD" || s.currency === "EUR") return s.period === "hora" ? v >= 3 && v <= 300 : s.period === "anio" ? v >= 5_000 && v <= 1_000_000 : v >= 200 && v <= 60_000;
  if (s.currency === "ARS") return s.period === "hora" ? v >= 1_000 && v <= 200_000 : v >= 100_000 && v <= 100_000_000;
  return false;
}

export function salaryFromText(description: string): Field<Salary> | null {
  for (const m of description.matchAll(ANCHOR)) {
    const start = m.index ?? 0;
    const window = description.slice(start, start + 200).split("\n")[0];
    if (NOT_PUBLISHED.test(description.slice(Math.max(0, start - 30), start + 120))) continue;
    const r = window.slice(m[0].length).match(RANGE);
    if (!r || r.index === undefined || r.index > 80) continue;
    const a = toNumber(r[1], r[2]);
    const b = r[3] ? toNumber(r[3], r[4] ?? r[2]) : null;
    if (a === null) continue;
    const [min, max] = b !== null && b >= a ? [a, b] : [a, null];
    const end = (r.index ?? 0) + m[0].length + r[0].length;
    // "100% variable", "401k", "F.931", "CCT 659/13": números que no son un sueldo.
    if (/^\s?(%|k\b|\/\d)/i.test(window.slice(end)) || /(f\.|cct|ley|art\.?)\s?$/i.test(window.slice(0, end - r[0].length))) continue;
    const tail = window.slice(0, end + 60);
    const found = periodOf(window.slice(0, end + 60));
    if (found === "semana") continue;
    let period: Salary["period"] = found;
    const currency = currencyOf(tail, r[1]);
    if (period === "desconocido" && (currency === "USD" || currency === "EUR") && (max ?? min) >= 20_000) period = "anio";
    const value: Salary = { min, max, currency, period, text: tail.trim().slice(0, 160) };
    if (!plausible(value)) continue;
    return { value, from: "descripcion", evidence: window.split(/(?<=[a-záéíóú)])\. /i)[0].trim().slice(0, 200) };
  }
  return null;
}
