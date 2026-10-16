/** El modo pago se habilita explícitamente después de validar la cuenta de Mercado Pago. */
export const BILLING_ENABLED = process.env.NEXT_PUBLIC_BILLING_ENABLED === "true";
export const PLAN_PRICE = 10000;
export const PLAN_PRICE_TEXT = "$10.000";
export const FREE_LIMITS = { cv: 2, carta: 1, entrevista: 1, video: 1 } as const;
export type UsageKind = keyof typeof FREE_LIMITS;
export const PAID_MONTHLY_LIMIT = 200;
