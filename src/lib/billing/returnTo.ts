import { load, remove, save } from "../storage";

/**
 * Dónde estaba la persona cuando el cupo gratis abrió los planes. Mercado Pago siempre vuelve a /precios:
 * con esto, al confirmarse el pago, le ofrecemos volver a la herramienta (que restaura lo que había cargado).
 */
const KEY = "maru:billing:return-to";
/** Pasado un día, el link de vuelta ya no ayuda: probablemente la tarea quedó atrás. */
const MAX_AGE = 86400_000;

type ReturnTo = { path: string; at: number };

const LABELS: [string, string][] = [
  ["/postulacion", "Continuar tu postulación"],
  ["/cv", "Continuar tu CV"],
  ["/carta", "Continuar tu carta"],
  ["/entrevista", "Continuar tu práctica de entrevista"],
  ["/video", "Continuar tu guion de video"],
];

/** Sólo rutas propias (nada de //otro-sitio ni URLs absolutas) y nunca /precios, que es adonde ya vuelve. */
export function safeReturnPath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  const pathname = path.split(/[?#]/)[0];
  if (pathname === "/" || pathname === "/precios" || pathname.startsWith("/precios/")) return null;
  return path.slice(0, 2000);
}

export function returnLabel(path: string): string {
  const pathname = path.split(/[?#]/)[0];
  return LABELS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? "Volver a donde estabas";
}

export function rememberReturnTo(path: string, now = Date.now()): void {
  const safe = safeReturnPath(path);
  if (safe) save(KEY, { path: safe, at: now } satisfies ReturnTo);
}

export function readReturnTo(now = Date.now()): { path: string; label: string } | null {
  const r = load<ReturnTo>(KEY);
  const path = safeReturnPath(r?.path);
  if (!r || !path || typeof r.at !== "number" || now - r.at > MAX_AGE) return null;
  return { path, label: returnLabel(path) };
}

export const forgetReturnTo = () => remove(KEY);
