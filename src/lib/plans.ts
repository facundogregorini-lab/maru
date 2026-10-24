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
  /** Importe de cada renovación, en ARS. Mercado Pago debe acreditar exactamente este monto (o el de `intro` en el primer cobro). */
  price: number;
  priceText: string;
  per: string;
  /** Equivalente mensual del precio regular. */
  monthlyText: string;
  /**
   * Promo del primer período: el primer cobro sale `intro.price` y las renovaciones, `price`.
   * La suscripción se crea con el monto de la promo y, al acreditarse el primer pago, Maru la pasa al precio regular.
   */
  intro?: { price: number; priceText: string };
  badge?: string;
  note: string;
  /** Frecuencia del débito en Mercado Pago Suscripciones. */
  frequency: number;
  frequencyType: "days" | "months";
  /** Cada cuánto se renueva, para el texto de condiciones ("cada mes"). */
  renewalText: string;
};

export const PLANS: Record<PlanId, Plan> = {
  // Promo de lanzamiento: el primer mes sale $990; desde el segundo, $10.000 por mes.
  mensual: { id: "mensual", nombre: "Mensual", price: 10000, priceText: "$10.000", per: "/mes", monthlyText: "$10.000 por mes", intro: { price: 990, priceText: "$990" }, badge: "Promo de lanzamiento", note: "Primer mes $990; luego $10.000 por mes.", frequency: 1, frequencyType: "months", renewalText: "cada mes" },
  trimestral: { id: "trimestral", nombre: "Trimestral", price: 22500, priceText: "$22.500", per: "/3 meses", monthlyText: "$7.500 por mes", note: "Ahorrás 25% contra el precio regular del mensual.", frequency: 3, frequencyType: "months", renewalText: "cada 3 meses" },
  semanal: { id: "semanal", nombre: "Semanal", price: 4500, priceText: "$4.500", per: "/semana", monthlyText: "≈ $19.500 por mes", note: "Para una búsqueda urgente.", frequency: 7, frequencyType: "days", renewalText: "cada 7 días" },
};
/** Orden de las tarjetas en /precios: el mensual en promo va primero y destacado; los otros, en segundo plano. */
export const PLAN_ORDER: PlanId[] = ["mensual", "trimestral", "semanal"];
/** Importe del primer cobro (con la promo, si la hay). */
export const firstCharge = (plan: Plan): number => plan.intro?.price ?? plan.price;
export const firstChargeText = (plan: Plan): string => plan.intro?.priceText ?? plan.priceText;
/** Descuento de la promo sobre el primer período, en % entero (90 para $10.000 → $990). */
export const planDiscount = (plan: Plan): number | null => (plan.intro && plan.intro.price < plan.price ? Math.round((1 - plan.intro.price / plan.price) * 100) : null);
/** Montos que acreditan un pago del plan: el del primer cobro con promo y el regular de las renovaciones. */
export const acceptedAmounts = (plan: Plan): number[] => (plan.intro ? [plan.intro.price, plan.price] : [plan.price]);
/** Condiciones antes de pagar: cuánto se cobra hoy y cuánto en cada renovación. */
export const chargeTerms = (plan: Plan): string =>
  plan.intro
    ? `Hoy pagás ${plan.intro.priceText}. Desde el segundo período se renueva ${plan.renewalText} a ${plan.priceText}.`
    : `Hoy pagás ${plan.priceText}. Se renueva ${plan.renewalText} al mismo precio.`;

/** Garantía de satisfacción: devolución del 100% del primer pago de la primera contratación. Se pide por mail a SUPPORT_EMAIL y la procesamos a mano. */
export const GUARANTEE_DAYS = 14;
export const SUPPORT_EMAIL = "hola@marucoach.com";
/** Derecho de arrepentimiento (Ley 24.240, art. 34): 10 días corridos desde la contratación. */
export const WITHDRAWAL_DAYS = 10;
/** Textos de baja y garantía que van cerca del precio y del botón, en /precios y en el aviso de límite. */
export const NO_LOCK_IN_TEXT = "Sin permanencia. Cancelás online cuando quieras, sin cargos por baja.";
export const GUARANTEE_TEXT = `Si Maru no te sirve, escribinos a ${SUPPORT_EMAIL} dentro de los primeros ${GUARANTEE_DAYS} días y te reintegramos el 100% de tu primer pago.`;
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
