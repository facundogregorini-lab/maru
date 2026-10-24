import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => { vi.resetModules(); });

const ID = "AW-18500028132";
function stubAdsEnv() {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", ID);
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_LABEL_ACTIVATION", "xDWcCOnckKAdEOSNwPVE");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_LABEL_PAYWALL", "0QrpCObckKAdEOSNwPVE");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_LABEL_BEGIN_CHECKOUT", "azVYCO_ckKAdEOSNwPVE");
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_LABEL_PURCHASE", "pbctCOzckKAdEOSNwPVE");
}
/** Navegador mínimo para las funciones del cliente (vitest corre en node). */
function stubBrowser(hostname: string, gtag?: (...args: unknown[]) => void) {
  const target = new EventTarget();
  const win = Object.assign(target, { location: { hostname, search: "" }, gtag, __maruAdsLoaded: gtag ? true : undefined }) as unknown as Window;
  vi.stubGlobal("window", win);
  return win as Window & { __maruAds?: { result: string }[] };
}

describe("configuración de Google Ads", () => {
  it("arma send_to sólo con ID y labels válidos y usa los dominios de producción por defecto", async () => {
    const { parseAdsConfig, DEFAULT_ADS_HOSTS } = await import("@/lib/tracking/config");
    const ok = parseAdsConfig({ id: ID, labels: { activation: "xDWcCOnckKAdEOSNwPVE", paywall: "0QrpCObckKAdEOSNwPVE", begin_checkout: "", purchase: "mal label!" }, hosts: undefined });
    expect(ok.sendTo.activation).toBe(`${ID}/xDWcCOnckKAdEOSNwPVE`);
    expect(ok.sendTo.paywall).toBe(`${ID}/0QrpCObckKAdEOSNwPVE`);
    expect(ok.sendTo.begin_checkout).toBeNull();
    expect(ok.sendTo.purchase).toBeNull();
    expect(ok.hosts).toEqual(DEFAULT_ADS_HOSTS);
    const off = parseAdsConfig({ id: "G-ABC123", labels: { activation: "xDWcCOnckKAdEOSNwPVE", paywall: undefined, begin_checkout: undefined, purchase: undefined }, hosts: "x.com" });
    expect(off.id).toBeNull();
    expect(off.sendTo.activation).toBeNull();
  });

  it("la etiqueta se carga una vez, con el destino AW, y sólo en los dominios de producción", async () => {
    stubAdsEnv();
    const { googleTagSnippet } = await import("@/lib/tracking/tag");
    const js = googleTagSnippet()!;
    expect(js).toContain(`gtag('config',"${ID}")`);
    expect(js).toContain("googletagmanager.com/gtag/js?id=");
    expect(js).toContain('["www.marucoach.com","marucoach.com"]');
    expect(js).toContain("__maruAdsInit");
    expect(js).not.toMatch(/GTM-|gtm\.js/);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ADS_ID", "");
    vi.resetModules();
    expect((await import("@/lib/tracking/tag")).googleTagSnippet()).toBeNull();
  });
});

describe("paywall por cupo gratis", () => {
  it("sólo abre los planes con 429 PLAN_LIMIT de una ruta que consume cupo", async () => {
    const win = stubBrowser("www.marucoach.com");
    const seen: string[] = [];
    win.addEventListener("maru:plan-limit", (e) => seen.push((e as CustomEvent).detail.tool));
    const { notifyPlanLimit } = await import("@/lib/tracking/paywall");
    expect(notifyPlanLimit("/api/cv/generate", 429, "PLAN_LIMIT")).toBe("cv");
    expect(notifyPlanLimit("/api/carta", 429, "PLAN_LIMIT")).toBe("carta");
    expect(notifyPlanLimit("/api/carta/parrafo", 429, "PLAN_LIMIT")).toBeNull();
    expect(notifyPlanLimit("/api/cv/generate", 429, "RATE_LIMIT")).toBeNull(); // freno por exceso de uso
    expect(notifyPlanLimit("/api/cv/generate", 503, "PLAN_UNAVAILABLE")).toBeNull(); // error técnico
    expect(notifyPlanLimit("/api/cv/generate", 401, "AUTH_REQUIRED")).toBeNull();
    expect(seen).toEqual(["cv", "carta"]);
  });
});

describe("envío de conversiones", () => {
  it("en previews o localhost no envía nada: queda registrado como prueba", async () => {
    stubAdsEnv();
    const gtag = vi.fn();
    const win = stubBrowser("maru-git-rama-grego7.vercel.app", gtag);
    const { sendAdsConversion } = await import("@/lib/tracking/ads");
    expect(await sendAdsConversion("paywall")).toBe("dry_run");
    expect(gtag).not.toHaveBeenCalled();
    expect(win.__maruAds?.[0].result).toBe("dry_run");
  });

  it("en producción usa la llamada nativa con sólo send_to, value, currency y transaction_id", async () => {
    stubAdsEnv();
    const gtag = vi.fn((...args: unknown[]) => (args[2] as { event_callback: () => void }).event_callback());
    stubBrowser("www.marucoach.com", gtag);
    const { sendAdsConversion } = await import("@/lib/tracking/ads");
    expect(await sendAdsConversion("purchase", { value: 22500, currency: "ARS", transaction_id: "mp_200" })).toBe("sent");
    const [, name, params] = gtag.mock.calls[0];
    expect(name).toBe("conversion");
    expect(Object.keys(params as object).sort()).toEqual(["currency", "event_callback", "send_to", "transaction_id", "value"]);
    expect(params).toMatchObject({ send_to: `${ID}/pbctCOzckKAdEOSNwPVE`, value: 22500, currency: "ARS", transaction_id: "mp_200" });
  });

  it("no envía parámetros con formato inválido (p. ej. un email como transaction_id) ni con la etiqueta bloqueada", async () => {
    stubAdsEnv();
    const gtag = vi.fn();
    const win = stubBrowser("www.marucoach.com", gtag);
    const { sendAdsConversion, cleanParams } = await import("@/lib/tracking/ads");
    expect(cleanParams({ transaction_id: "ana@example.com" })).toBeNull();
    expect(cleanParams({ value: 100 })).toBeNull(); // sin moneda
    expect(await sendAdsConversion("purchase", { transaction_id: "ana@example.com" })).toBe("invalid");
    (win as unknown as { __maruAdsLoaded: boolean }).__maruAdsLoaded = false;
    expect(await sendAdsConversion("activation")).toBe("blocked");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("si la etiqueta no confirma a tiempo, igual libera la navegación", async () => {
    stubAdsEnv();
    stubBrowser("www.marucoach.com", vi.fn());
    const { sendAdsConversion } = await import("@/lib/tracking/ads");
    const started = Date.now();
    expect(await sendAdsConversion("begin_checkout", { transaction_id: "co_abc" }, { waitMs: 50 })).toBe("queued");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("los eventos de producto descartan datos personales y texto libre", async () => {
    const { safeProps } = await import("@/lib/tracking/analytics");
    expect(safeProps({ herramienta: "cv", plan: "ana@example.com", codigo: "texto con espacios", primera: true, monto: 4500 })).toEqual({ herramienta: "cv", primera: true, monto: 4500 });
    // Números internos de operación, para cruzar con el registro de cobros; nunca un email.
    expect(safeProps({ solicitud: "DEV-AB12CD34", pago: "123456789", checkout: "0f".repeat(16), motivo: "precio", tipo: "garantia" })).toEqual({ solicitud: "DEV-AB12CD34", pago: "123456789", checkout: "0f".repeat(16), motivo: "precio", tipo: "garantia" });
    expect(safeProps({ solicitud: "ana@example.com" })).toEqual({});
  });
});

describe("deduplicación por cuenta en el servidor", () => {
  async function server() {
    const db = await import("@/lib/db");
    db.resetMemoryDb();
    return import("@/lib/tracking/server");
  }

  it("un solo primer límite y una sola activación por cuenta, sin el email en la clave", async () => {
    const s = await server();
    expect(await s.claimMilestone("ana@example.com", "paywall", undefined, "claim")).toEqual({ first: true });
    expect(await s.claimMilestone("ANA@example.com ", "paywall", undefined, "claim")).toEqual({ first: false });
    expect(await s.claimMilestone("ana@example.com", "activation", undefined, "check")).toEqual({ first: true });
    expect(await s.claimMilestone("ana@example.com", "activation", undefined, "check")).toEqual({ first: true }); // el modo de prueba no consume
    expect(await s.claimMilestone("ana@example.com", "activation", undefined, "mark")).toEqual({ first: false });
    expect(await s.claimMilestone("ana@example.com", "activation", undefined, "claim")).toEqual({ first: false });
    expect(s.milestoneKey("ana@example.com", "paywall")).not.toContain("ana");
  });

  it("checkout y compra se deduplican por su id y lo exigen", async () => {
    const s = await server();
    expect(await s.claimMilestone("ana@example.com", "begin_checkout", "abc123", "claim")).toEqual({ first: true });
    expect(await s.claimMilestone("ana@example.com", "begin_checkout", "abc123", "claim")).toEqual({ first: false });
    expect(await s.claimMilestone("ana@example.com", "begin_checkout", "otro", "claim")).toEqual({ first: true });
    await expect(s.claimMilestone("ana@example.com", "purchase", undefined, "claim")).rejects.toThrow();
    await expect(s.claimMilestone("ana@example.com", "paywall", "x", "claim")).rejects.toThrow();
    await expect(s.claimMilestone("ana@example.com", "purchase", "a b", "claim")).rejects.toThrow();
  });

  it("la ruta exige sesión y responde sólo si es el primero", async () => {
    (await import("@/lib/db")).resetMemoryDb();
    const { POST } = await import("@/app/api/tracking/milestone/route");
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    const req = (cookie?: string) => new Request("https://maru.test/api/tracking/milestone", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify({ milestone: "paywall" }),
    });
    expect((await POST(req())).status).toBe(401);
    const cookie = `${SESSION_COOKIE}=${createSessionToken("ana@example.com")}`;
    const first = await (await POST(req(cookie))).json();
    expect(first).toMatchObject({ first: true });
    expect(first.eventId).toMatch(/^pw_[a-f0-9]{24}$/); // el píxel repite este id para deduplicar con la API de conversiones
    expect(await (await POST(req(cookie))).json()).toEqual({ first: false });
  });
});

describe("checkout y compra verificada", () => {
  async function setup() {
    vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", "true");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "test-token");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "test-secret");
    const db = await import("@/lib/db");
    db.resetMemoryDb(); db.resetMemoryCounters();
    return import("@/lib/billing/server");
  }
  function provider(opts: { live?: boolean; amount?: number } = {}) {
    let reference = "";
    let paymentId = 200;
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path === "/preapproval" && init?.method === "POST") {
        reference = JSON.parse(String(init.body)).external_reference;
        return Response.json({ id: "sub1", external_reference: reference, status: "pending", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?id=sub1" });
      }
      if (path === "/preapproval/sub1") return Response.json({ id: "sub1", external_reference: reference, status: "authorized" });
      if (path.startsWith("/authorized_payments/")) return Response.json({ id: path.split("/").pop(), preapproval_id: "sub1", payment: { id: paymentId } });
      if (path.startsWith("/v1/payments/")) return Response.json({ id: Number(path.split("/").pop()), status: "approved", transaction_amount: opts.amount ?? 4500, currency_id: "ARS", date_approved: new Date().toISOString(), live_mode: opts.live ?? true });
      throw new Error(`Unexpected provider request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    return { renew: () => { paymentId += 1; }, reference: () => reference };
  }

  it("el checkout devuelve un id estable que no expone la referencia interna", async () => {
    const s = await setup(); const p = provider();
    const a = await s.startCheckout("ana@example.com", "semanal");
    const b = await s.startCheckout("ana@example.com", "semanal"); // reintento: mismo checkout pendiente
    expect(a.url).toContain("mercadopago.com.ar");
    expect(b.checkoutId).toBe(a.checkoutId);
    expect(a.checkoutId).toMatch(/^[a-f0-9]{32}$/);
    expect(a.checkoutId).not.toContain(p.reference().replace(/-/g, "").slice(0, 8));
  });

  it("informa el primer pago acreditado con su importe y distingue las renovaciones", async () => {
    const s = await setup(); const p = provider();
    await s.startCheckout("ana@example.com", "semanal");
    await s.processNotification("subscription_authorized_payment", "100");
    const first = s.lastPayment(await s.readSubscription("ana@example.com"));
    expect(first).toMatchObject({ id: "200", amount: 4500, currency: "ARS", first: true, plan: "semanal" });
    p.renew();
    await s.processNotification("subscription_authorized_payment", "101");
    expect(s.lastPayment(await s.readSubscription("ana@example.com"))).toMatchObject({ id: "201", first: false });
  });

  it("no informa pagos de prueba ni montos que no coinciden con el plan", async () => {
    let s = await setup(); provider({ live: false });
    await s.startCheckout("ana@example.com", "semanal");
    await s.processNotification("subscription_authorized_payment", "100");
    expect(s.lastPayment(await s.readSubscription("ana@example.com"))).toBeNull();
    vi.resetModules();
    s = await setup(); provider({ amount: 1 });
    await s.startCheckout("ana@example.com", "semanal");
    await s.processNotification("subscription_authorized_payment", "100");
    expect(s.lastPayment(await s.readSubscription("ana@example.com"))).toBeNull();
  });
});

describe("píxel de Meta", () => {
  const PIXEL = "1234567890123456";
  function stubMeta(hostname: string, fbq?: (...args: unknown[]) => void) {
    stubAdsEnv();
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
    const gtag = vi.fn((...args: unknown[]) => (args[2] as { event_callback: () => void }).event_callback());
    const win = stubBrowser(hostname, gtag) as Window & { fbq?: unknown; __maruMetaLoaded?: boolean; __maruMeta?: { event: string; result: string }[] };
    win.fbq = fbq;
    win.__maruMetaLoaded = fbq ? true : undefined;
    return win;
  }

  it("el píxel se carga una vez, sin eventos automáticos, sólo en producción y con un ID válido", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
    const { metaPixelSnippet } = await import("@/lib/tracking/tag");
    const js = metaPixelSnippet()!;
    expect(js).toContain(`n('init',"${PIXEL}")`);
    expect(js).toContain(`n('set','autoConfig',false,"${PIXEL}")`);
    expect(js.indexOf("autoConfig")).toBeLessThan(js.indexOf("'init'"));
    expect(js).toContain("connect.facebook.net/en_US/fbevents.js");
    expect(js).toContain('["www.marucoach.com","marucoach.com"]');
    expect(js).not.toMatch(/GTM-|gtm\.js/);
    const { parseMetaPixelId } = await import("@/lib/tracking/config");
    expect(parseMetaPixelId("abc")).toBeNull();
    expect(metaPixelSnippet(null)).toBeNull();
  });

  it("los hitos salen con los nombres de origen o el evento estándar equivalente, y sólo value, currency y eventID", async () => {
    const fbq = vi.fn();
    stubMeta("www.marucoach.com", fbq);
    const { sendMetaEvent } = await import("@/lib/tracking/meta");
    expect(sendMetaEvent("paywall", {}, "live")).toBe("sent");
    expect(sendMetaEvent("activation", {}, "live")).toBe("sent");
    expect(sendMetaEvent("begin_checkout", { transaction_id: "co_abc" }, "live")).toBe("sent");
    expect(sendMetaEvent("purchase", { value: 22500, currency: "ARS", transaction_id: "mp_200" }, "live")).toBe("sent");
    expect(fbq.mock.calls).toEqual([
      ["trackCustom", "maru_paywall_viewed", {}, undefined],
      ["trackCustom", "maru_core_activation", {}, undefined],
      ["track", "InitiateCheckout", {}, { eventID: "co_abc" }],
      ["track", "Purchase", { value: 22500, currency: "ARS" }, { eventID: "mp_200" }],
    ]);
  });

  it("sigue la decisión de Google: en modo de prueba sólo registra, y sin envío a Google no sale", async () => {
    const fbq = vi.fn();
    const win = stubMeta("www.marucoach.com", fbq);
    const { sendMetaEvent } = await import("@/lib/tracking/meta");
    expect(sendMetaEvent("paywall", {}, "dry_run")).toBe("dry_run");
    expect(sendMetaEvent("paywall", {}, "blocked")).toBe("off");
    expect(sendMetaEvent("purchase", { transaction_id: "ana@example.com" }, "invalid")).toBe("off");
    expect(fbq).not.toHaveBeenCalled();
    expect(win.__maruMeta?.map((e) => e.result)).toEqual(["dry_run", "off", "off"]);
    win.__maruMetaLoaded = false;
    expect(sendMetaEvent("paywall", {}, "live")).toBe("blocked");
  });

  it("el primer límite sale una sola vez a Google y a Meta, aunque se repita la exposición", async () => {
    const fbq = vi.fn();
    const win = stubMeta("www.marucoach.com", fbq);
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 401 }))); // sin sesión: decide este navegador
    const { trackPaywallViewed } = await import("@/lib/tracking");
    await trackPaywallViewed(null, "cv");
    await trackPaywallViewed(null, "cv");
    expect(fbq.mock.calls).toEqual([["trackCustom", "maru_paywall_viewed", {}, undefined]]);
    expect((win as unknown as { gtag: { mock: { calls: unknown[] } } }).gtag.mock.calls).toHaveLength(1);
  });

  it("en previews no envía a Meta aunque haya ID", async () => {
    const fbq = vi.fn();
    stubMeta("maru-git-rama-grego7.vercel.app", fbq);
    const { adsDecision } = await import("@/lib/tracking/ads");
    const { sendMetaEvent } = await import("@/lib/tracking/meta");
    expect(sendMetaEvent("paywall", {}, adsDecision("paywall"))).toBe("dry_run");
    expect(fbq).not.toHaveBeenCalled();
  });
});

describe("API de conversiones de Meta", () => {
  const PIXEL = "1466577088716669";
  function env() {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
    vi.stubEnv("META_CAPI_ACCESS_TOKEN", "EAAtokendeprueba1234567890");
  }
  const req = (host = "www.marucoach.com", extra: Record<string, string> = {}) => new Request(`https://${host}/api/tracking/milestone`, {
    method: "POST",
    headers: { "x-forwarded-for": "190.1.2.3, 10.0.0.1", "user-agent": "Mozilla/5.0", cookie: "_fbp=fb.1.1700000000000.123456; _fbc=fb.1.1700000000000.AbC-123; maru_session=x", referer: `https://${host}/cv?utm_source=meta`, ...extra },
  });

  it("sin token o sin píxel no se activa", async () => {
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
    const { capiConfig } = await import("@/lib/tracking/capi");
    expect(capiConfig({})).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "");
    expect(capiConfig({ META_CAPI_ACCESS_TOKEN: "EAAtokendeprueba1234567890" })?.pixelId).toBe(PIXEL); // sin variable: el de Maru
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "no-es-un-id");
    expect(capiConfig({ META_CAPI_ACCESS_TOKEN: "EAAtokendeprueba1234567890" })).toBeNull();
  });

  it("arma el mismo evento que el píxel, con IP, navegador y cookies de Meta, sin datos personales", async () => {
    env();
    const { buildCapiEvent, capiConfig, milestoneEventId } = await import("@/lib/tracking/capi");
    const config = capiConfig()!;
    const ev = buildCapiEvent(req(), { milestone: "purchase", eventId: milestoneEventId("purchase", "200"), value: { amount: 22500, currency: "ARS" } }, config, 1_700_000_000_000)!;
    expect(ev).toEqual({
      event_name: "Purchase", event_time: 1_700_000_000, event_id: "mp_200", action_source: "website",
      event_source_url: "https://www.marucoach.com/cv",
      user_data: { client_ip_address: "190.1.2.3", client_user_agent: "Mozilla/5.0", fbp: "fb.1.1700000000000.123456", fbc: "fb.1.1700000000000.AbC-123" },
      custom_data: { value: 22500, currency: "ARS" },
    });
    expect(buildCapiEvent(req(), { milestone: "paywall", eventId: "pw_x" }, config)!.event_name).toBe("maru_paywall_viewed");
    expect(milestoneEventId("begin_checkout", "abc")).toBe("co_abc");
    expect(buildCapiEvent(req("maru-git-x.vercel.app"), { milestone: "paywall", eventId: "pw_x" }, config)).toBeNull(); // previews: no sale
  });

  it("envía a la Graph API con el código de prueba si está, y un fallo no lanza", async () => {
    env();
    vi.stubEnv("META_CAPI_TEST_EVENT_CODE", "TEST12345");
    const fetchMock = vi.fn(async () => Response.json({ events_received: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendCapiEvent } = await import("@/lib/tracking/capi");
    expect(await sendCapiEvent(req(), { milestone: "activation", eventId: "act_1" })).toBe("sent");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain(`graph.facebook.com/v23.0/${PIXEL}/events?access_token=`);
    const body = JSON.parse(String(init.body));
    expect(body.test_event_code).toBe("TEST12345");
    expect(body.data[0]).toMatchObject({ event_name: "maru_core_activation", event_id: "act_1" });
    expect(JSON.stringify(body)).not.toMatch(/@|maru_session/);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("red"); }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendCapiEvent(req(), { milestone: "activation", eventId: "act_1" })).toBe("error");
  });

  it("el píxel usa el eventID que devolvió el servidor", async () => {
    stubAdsEnv();
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
    const fbq = vi.fn();
    const gtag = vi.fn((...args: unknown[]) => (args[2] as { event_callback: () => void }).event_callback());
    const win = stubBrowser("www.marucoach.com", gtag) as Window & { fbq?: unknown; __maruMetaLoaded?: boolean };
    win.fbq = fbq; win.__maruMetaLoaded = true;
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ first: true, eventId: "pw_abc123" })));
    const { trackPaywallViewed } = await import("@/lib/tracking");
    await trackPaywallViewed("ana@example.com", "cv");
    expect(fbq.mock.calls).toEqual([["trackCustom", "maru_paywall_viewed", {}, { eventID: "pw_abc123" }]]);
  });
});
