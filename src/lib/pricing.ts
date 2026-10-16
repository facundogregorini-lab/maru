/** Precio y límites del plan, en un solo lugar (lo usan la web, la API y Maru). */
export const PLAN_PRICE_ARS = 10000;
export const FREE_MONTHLY_CREATIONS = 3;
export const PLAN_PRICE_TEXT = `$${PLAN_PRICE_ARS.toLocaleString("es-AR")}`;
export const PLAN_PER_DAY_TEXT = `$${Math.round(PLAN_PRICE_ARS / 30).toLocaleString("es-AR")}`;
