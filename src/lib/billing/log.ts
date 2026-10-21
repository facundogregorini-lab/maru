import { pushRecent, readRecent } from "../db";

/** Registro de diagnóstico del cobro para el panel: qué llegó de Mercado Pago y qué se hizo. Sin emails ni datos de pago. */
export type BillingEvent = { at: number; source: "webhook" | "actualizar"; type: string; result: string; detail?: string };
const KEY = "maru:billing:log";
const MAX = 30;
export async function recordBillingEvent(event: Omit<BillingEvent, "at">): Promise<void> {
  // El registro nunca frena un cobro: si falla la base, se pierde la entrada.
  try { await pushRecent(KEY, { ...event, type: event.type.slice(0, 60), detail: event.detail?.slice(0, 200), at: Date.now() }, MAX); } catch {}
}
export const readBillingEvents = () => readRecent<BillingEvent>(KEY, MAX);
