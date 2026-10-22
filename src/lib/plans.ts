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
  /**
   * Precio regular de una promo, en ARS: se muestra tachado y es el que se cobró antes de la promo.
   * Las suscripciones creadas a ese precio siguen acreditándose (Mercado Pago debita el monto con que se crearon).
   */
  listPrice?: number;
  listPriceText?: string;
  badge?: string;
  note: string;
  /** Frecuencia del débito en Mercado Pago Suscripciones. */
  frequency: number;
  frequencyType: "days" | "months";
};

export const PLANS: Record<PlanId, Plan> = {
  // Promo de lanzamiento: el mensual baja de $10.000 a $990.
  mensual: { id: "mensual", nombre: "Mensual", price: 990, priceText: "$990", per: "/mes", monthlyText: "$990 por mes", listPrice: 10000, listPriceText: "$10.000", badge: "Promo de lanzamiento", note: "Precio de lanzamiento. Renovación cada mes.", frequency: 1, frequencyType: "months" },
  trimestral: { id: "trimestral", nombre: "Trimestral", price: 22500, priceText: "$22.500", per: "/3 meses", monthlyText: "$7.500 por mes", note: "Renovación cada 3 meses.", frequency: 3, frequencyType: "months" },
  semanal: { id: "semanal", nombre: "Semanal", price: 4500, priceText: "$4.500", per: "/semana", monthlyText: "≈ $19.500 por mes", note: "Para una búsqueda urgente.", frequency: 7, frequencyType: "days" },
};
/** Orden de las tarjetas en /precios: el mensual en promo va al medio, destacado. */
export const PLAN_ORDER: PlanId[] = ["trimestral", "mensual", "semanal"];
/** Descuento de la promo, en % entero (90 para $10.000 → $990). */
export const planDiscount = (plan: Plan): number | null => (plan.listPrice && plan.listPrice > plan.price ? Math.round((1 - plan.price / plan.listPrice) * 100) : null);
/** Montos que acreditan un pago del plan: el precio vigente y, si hay promo, el regular de las suscripciones anteriores. */
export const acceptedAmounts = (plan: Plan): number[] => (plan.listPrice ? [plan.price, plan.listPrice] : [plan.price]);
export const isPlanId = (v: unknown): v is PlanId => typeof v === "string" && Object.hasOwn(PLANS, v);

/** Pedidos gratis. Los diarios se renuevan a las 0 h de Argentina; los semanales, el lunes. */
export const FREE_LIMITS = {
  cv: { limit: 1, window: "dia" },
  carta: { limit: 1, window: "dia" },
  entrevista: { limit: 1, window: "semana" },
  video: { limit: 1, window: "semana" },
  /** Autocompletados de la extensión de Chrome. */
  autofill: { limit: 4, window: "dia" },
} as const;
export type UsageKind = keyof typeof FREE_LIMITS;

/** Uso razonable del plan pago, combinado entre todas las herramientas. Protege el servicio; no se muestra como cuota. */
export const PAID_DAILY_LIMIT = 25;
