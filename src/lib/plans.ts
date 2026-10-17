/** Sólo para textos de páginas estáticas y del navegador: se fija al compilar. */
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";

// La clave armada en tiempo de ejecución evita que Next la reemplace al compilar.
const flagValue = () => (process.env[["BILLING", "ENABLED"].join("_")] ?? process.env[["NEXT_PUBLIC", "BILLING", "ENABLED"].join("_")] ?? "").trim();
/** El servidor lee el modo pago en cada pedido: cambiar la variable no exige recompilar (sí un redeploy para que Vercel la cargue). */
export const billingEnabled = () => flagValue().toLowerCase() === "true";
/** Diagnóstico sin valores: si la bandera falta o tiene otro texto. */
export const billingFlagState = (): "true" | "missing" | "other" => (billingEnabled() ? "true" : flagValue() ? "other" : "missing");

export type PlanId = "semanal" | "mensual" | "trimestral";
export type Plan = {
  id: PlanId;
  nombre: string;
  /** Importe de cada cobro, en ARS. Mercado Pago debe acreditar exactamente este monto. */
  price: number;
  priceText: string;
  per: string;
  /** Equivalente mensual: compara planes sin precios tachados que nunca se cobraron. */
  monthlyText: string;
  badge?: string;
  note: string;
  /** Frecuencia del débito en Mercado Pago Suscripciones. */
  frequency: number;
  frequencyType: "days" | "months";
};

export const PLANS: Record<PlanId, Plan> = {
  mensual: { id: "mensual", nombre: "Mensual", price: 10000, priceText: "$10.000", per: "/mes", monthlyText: "$10.000 por mes", note: "Renovación cada mes.", frequency: 1, frequencyType: "months" },
  trimestral: { id: "trimestral", nombre: "Trimestral", price: 22500, priceText: "$22.500", per: "/3 meses", monthlyText: "$7.500 por mes", badge: "El más conveniente", note: "Ahorrás 25% contra el mensual.", frequency: 3, frequencyType: "months" },
  semanal: { id: "semanal", nombre: "Semanal", price: 4500, priceText: "$4.500", per: "/semana", monthlyText: "≈ $19.500 por mes", note: "Para una búsqueda urgente.", frequency: 7, frequencyType: "days" },
};
/** Orden de las tarjetas en /precios: el trimestral va al medio, destacado. */
export const PLAN_ORDER: PlanId[] = ["mensual", "trimestral", "semanal"];
export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && Object.hasOwn(PLANS, v);

/** Pedidos gratis. Los diarios se renuevan a las 0 h de Argentina; los semanales, el lunes. */
export const FREE_LIMITS = {
  cv: { limit: 1, window: "dia" },
  carta: { limit: 1, window: "dia" },
  entrevista: { limit: 1, window: "semana" },
  video: { limit: 1, window: "semana" },
} as const;
export type UsageKind = keyof typeof FREE_LIMITS;

/** Uso razonable del plan pago, combinado entre todas las herramientas. Protege el servicio; no se muestra como cuota. */
export const PAID_DAILY_LIMIT = 25;
