/**
 * API de conversiones de Meta (servidor). Envía los mismos hitos que el píxel, en el mismo momento: cuando
 * /api/tracking/milestone marca un hito por primera vez (la misma deduplicación de Google Ads). El navegador
 * recibe el mismo `eventId` y lo pasa al píxel, así Meta deduplica navegador y servidor (evento + eventID).
 *
 * Sólo datos técnicos del pedido: IP, navegador y las cookies propias de Meta (_fbp, _fbc). Nunca el email,
 * el nombre ni un hash de ellos. La compra se verifica contra la suscripción: importe del servidor, no del navegador.
 *
 * Variables (Vercel → Production): META_CAPI_ACCESS_TOKEN (secreto) y, para "Probar eventos",
 * META_CAPI_TEST_EVENT_CODE. El ID del píxel es el de config.ts. Sin token o fuera de los dominios de producción no sale nada.
 */
import { randomBytes } from "node:crypto";
import { adsConfig, metaPixelId } from "./config";
import { META_EVENTS } from "./meta";
import type { Milestone } from "./server";

export const GRAPH_VERSION = "v23.0";
const TOKEN = /^[A-Za-z0-9_-]{20,400}$/;
const TEST_CODE = /^TEST[A-Za-z0-9]{1,20}$/;

/** El eventID que comparten píxel y servidor: el transaction_id de Google para checkout y compra; uno nuevo para los hitos únicos. */
export function milestoneEventId(milestone: Milestone, id?: string): string {
  if (milestone === "begin_checkout") return `co_${id}`;
  if (milestone === "purchase") return `mp_${id}`;
  return `${milestone === "activation" ? "act" : "pw"}_${randomBytes(12).toString("hex")}`;
}

export type CapiConfig = { pixelId: string; token: string; testCode: string | null; hosts: string[] };

export function capiConfig(env: Record<string, string | undefined> = process.env): CapiConfig | null {
  const pixelId = metaPixelId();
  const token = env.META_CAPI_ACCESS_TOKEN?.trim() ?? "";
  if (!pixelId || !TOKEN.test(token)) return null;
  const testCode = env.META_CAPI_TEST_EVENT_CODE?.trim() ?? "";
  return { pixelId, token, testCode: TEST_CODE.test(testCode) ? testCode : null, hosts: adsConfig().hosts };
}

function cookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  const hit = raw.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  const value = hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
  return /^fb\.\d\.\d+\.[A-Za-z0-9_.-]+$/.test(value) ? value : undefined;
}

export type CapiEvent = { milestone: Milestone; eventId: string; value?: { amount: number; currency: "ARS" } };

/** Arma el evento (sin enviarlo). null si el pedido no viene de un dominio de producción. */
export function buildCapiEvent(req: Request, event: CapiEvent, config: CapiConfig, now = Date.now()) {
  const host = new URL(req.url).hostname.toLowerCase();
  if (!config.hosts.includes(host)) return null;
  const referer = req.headers.get("referer");
  const source = referer && config.hosts.includes(new URL(referer, req.url).hostname) ? referer.split(/[?#]/)[0] : `https://${host}/`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  const { name } = META_EVENTS[event.milestone];
  return {
    event_name: name,
    event_time: Math.floor(now / 1000),
    event_id: event.eventId,
    action_source: "website",
    event_source_url: source,
    user_data: {
      client_ip_address: ip,
      client_user_agent: req.headers.get("user-agent") ?? undefined,
      fbp: cookie(req, "_fbp"),
      fbc: cookie(req, "_fbc"),
    },
    ...(event.value ? { custom_data: { value: event.value.amount, currency: event.value.currency } } : {}),
  };
}

/** Envía el evento. Nunca lanza: un fallo de Meta no afecta al usuario ni a la deduplicación. */
export async function sendCapiEvent(req: Request, event: CapiEvent, config: CapiConfig | null = capiConfig()): Promise<"sent" | "off" | "error"> {
  if (!config) return "off";
  const data = buildCapiEvent(req, event, config);
  if (!data) return "off";
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${config.pixelId}/events?access_token=${encodeURIComponent(config.token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [data], ...(config.testCode ? { test_event_code: config.testCode } : {}) }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) console.warn("[maru:capi]", data.event_name, res.status);
    return res.ok ? "sent" : "error";
  } catch {
    console.warn("[maru:capi]", data.event_name, "sin respuesta");
    return "error";
  }
}
