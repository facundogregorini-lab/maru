import { randomUUID } from "node:crypto";
import { dbConfigured, keyExists, setIfAbsent } from "../db";
import { userId } from "../sync/server";
import { milestoneKey } from "../tracking/server";
import { billingReady, hasPaidAccess, isComplimentary, readSubscription } from "./server";

/**
 * Oferta anticipada de Maru Pro antes de la primera descarga gratis. No es un límite de uso: no toca el cupo,
 * no cuenta como paywall y no sale a Google Ads ni a Meta (sólo a los eventos de producto, ver docs/TRACKING.md).
 *
 * Se muestra una sola vez por cuenta (Redis, persistente entre dispositivos). El servidor decide y marca la
 * exposición en el mismo paso (SET NX): dos pestañas o dos clics no generan dos exposiciones.
 */
export const OFFER_TYPES = ["cv", "carta"] as const;
export type OfferType = (typeof OFFER_TYPES)[number];
export const isOfferType = (v: unknown): v is OfferType => typeof v === "string" && (OFFER_TYPES as readonly string[]).includes(v);

/**
 * Sólo antes del primer resultado útil: si la cuenta ya tiene la activación registrada (descargó, copió o grabó
 * antes), esta descarga no es la primera y la oferta no aparece.
 */
export const REQUIRE_FIRST_RESULT = true;

export type OfferSkip = "cobro_apagado" | "sin_base" | "plan_pago" | "ya_vista" | "ya_activo";
export type OfferDecision = { show: true; exposureId: string } | { show: false; reason: OfferSkip };

export const offerKey = (email: string) => `maru:offer:${userId(email)}:primera_descarga`;

/** ¿Ya se mostró? Sólo consulta, sin marcar (lo usan los tests y el diagnóstico). */
export async function offerSeen(email: string, now = Date.now()): Promise<boolean> {
  return keyExists(offerKey(email), now);
}

/**
 * Decide si la cuenta ve la oferta ahora y, si la ve, deja marcada la exposición. Cualquier error se trata
 * como "no mostrar": la descarga nunca depende de esto.
 */
export async function claimFirstDownloadOffer(email: string, type: OfferType, now = Date.now()): Promise<OfferDecision> {
  // Sin cobro a la venta no hay planes que ofrecer (la pantalla de planes dice «Próximamente»).
  if (!billingReady()) return { show: false, reason: "cobro_apagado" };
  if (!dbConfigured()) return { show: false, reason: "sin_base" };
  if (isComplimentary(email)) return { show: false, reason: "plan_pago" };
  if (await offerSeen(email, now)) return { show: false, reason: "ya_vista" };
  if (hasPaidAccess(await readSubscription(email), now)) return { show: false, reason: "plan_pago" };
  if (REQUIRE_FIRST_RESULT) {
    const activation = milestoneKey(email, "activation");
    if (activation && (await keyExists(activation, now))) return { show: false, reason: "ya_activo" };
  }
  const exposureId = randomUUID();
  // Sin vencimiento: es una vez por cuenta.
  const first = await setIfAbsent(offerKey(email), { at: now, exposureId, tipo: type }, undefined, now);
  return first ? { show: true, exposureId } : { show: false, reason: "ya_vista" };
}
