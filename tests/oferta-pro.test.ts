import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => { vi.resetModules(); });

const EMAIL = "ana@example.com";

async function setupServer(billing = true) {
  vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", billing ? "true" : "false");
  vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "test-token");
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "test-secret");
  vi.stubEnv("PRO_EMAILS", "equipo@maru.test");
  const db = await import("@/lib/db");
  db.resetMemoryDb(); db.resetMemoryCounters();
  return { db, offer: await import("@/lib/billing/offer") };
}

/** Navegador mínimo con localStorage, gtag y fbq espiados: nada de la oferta debe llegar a Google ni a Meta. */
function stubBrowser(fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>) {
  const target = new EventTarget();
  const store = new Map<string, string>();
  const gtag = vi.fn();
  const fbq = vi.fn();
  const win = Object.assign(target, {
    location: { hostname: "www.marucoach.com", search: "", pathname: "/cv", hash: "" },
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    gtag, fbq, __maruAdsLoaded: true, __maruMetaLoaded: true,
  }) as unknown as Window;
  vi.stubGlobal("window", win);
  const fetchMock = vi.fn(fetchImpl ?? (async () => Response.json({ show: false })));
  vi.stubGlobal("fetch", fetchMock);
  const events: Record<string, unknown>[] = [];
  win.addEventListener("maru:event", (e) => events.push((e as CustomEvent).detail));
  return { win, gtag, fbq, fetchMock, events, store };
}

describe("elegibilidad de la oferta anticipada (servidor)", () => {
  it("una sola exposición por cuenta, persistente y sin el email en la clave", async () => {
    const { offer } = await setupServer();
    const first = await offer.claimFirstDownloadOffer(EMAIL, "cv");
    expect(first.show).toBe(true);
    if (first.show) expect(first.exposureId).toMatch(/^[a-f0-9-]{36}$/);
    // Otra herramienta, otra mayúscula, otro dispositivo: ya la vio.
    expect(await offer.claimFirstDownloadOffer(" ANA@example.com", "carta")).toEqual({ show: false, reason: "ya_vista" });
    expect(offer.offerKey(EMAIL)).not.toContain("ana");
  });

  it("dos pedidos simultáneos no generan dos exposiciones", async () => {
    const { offer } = await setupServer();
    const both = await Promise.all([offer.claimFirstDownloadOffer(EMAIL, "cv"), offer.claimFirstDownloadOffer(EMAIL, "cv")]);
    expect(both.filter((d) => d.show)).toHaveLength(1);
  });

  it("no aparece con el cobro apagado, con plan pago, con cuenta del equipo ni después de un primer resultado", async () => {
    let { offer, db } = await setupServer(false);
    expect(await offer.claimFirstDownloadOffer(EMAIL, "cv")).toEqual({ show: false, reason: "cobro_apagado" });

    vi.resetModules();
    ({ offer, db } = await setupServer());
    const { userId } = await import("@/lib/sync/server");
    await db.setJson(`maru:billing:${userId(EMAIL)}`, { id: "s", reference: "r", status: "authorized", paidThrough: Date.now() + 86400_000, updatedAt: 1 });
    expect(await offer.claimFirstDownloadOffer(EMAIL, "cv")).toEqual({ show: false, reason: "plan_pago" });
    expect(await offer.claimFirstDownloadOffer("equipo@maru.test", "cv")).toEqual({ show: false, reason: "plan_pago" });

    const { claimMilestone } = await import("@/lib/tracking/server");
    await claimMilestone("beto@example.com", "activation", undefined, "claim");
    expect(await offer.claimFirstDownloadOffer("beto@example.com", "carta")).toEqual({ show: false, reason: "ya_activo" });
    // Una suscripción vencida vuelve a ser gratis: sí la ve.
    await db.setJson(`maru:billing:${userId("caro@example.com")}`, { id: "s", reference: "r", status: "cancelled", paidThrough: Date.now() - 1000, updatedAt: 1 });
    expect((await offer.claimFirstDownloadOffer("caro@example.com", "cv")).show).toBe(true);
  });

  it("no consume cupo gratis ni marca el hito de límite ni ningún otro hito de conversión", async () => {
    const { offer } = await setupServer();
    const server = await import("@/lib/billing/server");
    const { claimMilestone } = await import("@/lib/tracking/server");
    await offer.claimFirstDownloadOffer(EMAIL, "cv");
    for (const m of ["activation", "paywall"] as const) expect(await claimMilestone(EMAIL, m, undefined, "check")).toEqual({ first: true });
    // El cupo del día sigue intacto: el primer CV gratis todavía se puede generar.
    expect(await server.allowUsage(EMAIL, "cv")).toBe(true);
  });

  it("la ruta exige sesión, valida el entregable y nunca falla con error: ante dudas, show=false", async () => {
    await setupServer();
    const { POST } = await import("@/app/api/billing/offer/route");
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    const cookie = `${SESSION_COOKIE}=${createSessionToken(EMAIL)}`;
    const req = (body: unknown, withCookie = true) => new Request("https://maru.test/api/billing/offer", {
      method: "POST",
      headers: { "content-type": "application/json", ...(withCookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    expect((await POST(req({ tipo: "cv" }, false))).status).toBe(401);
    expect((await POST(req({ tipo: "video" }))).status).toBe(400);
    const first = await (await POST(req({ tipo: "carta" }))).json();
    expect(first.show).toBe(true);
    expect(await (await POST(req({ tipo: "carta" }))).json()).toEqual({ show: false, reason: "ya_vista" });
  });
});

describe("eventos de la oferta (navegador)", () => {
  it("salen sólo como eventos de producto, una vez por exposición, y nunca a Google Ads, Meta ni al hito de límite", async () => {
    const { gtag, fbq, fetchMock, events } = stubBrowser();
    const t = await import("@/lib/tracking/offer");
    const exp = { exposureId: "0f8fad5b-d9cb-469f-a165-70867728950e", tipo: "cv" as const };
    t.trackOfferViewed(exp, true);
    t.trackOfferViewed(exp, true); // re-render
    t.trackOfferClick(exp);
    t.trackOfferClick(exp); // doble clic
    t.trackOfferSkipped(exp, "planes_descarga_gratis");
    t.trackOfferSkipped(exp, "cerrar_modal"); // segundo cierre
    expect(events.map((e) => e.event)).toEqual(["oferta_pro_vista", "oferta_pro_click", "oferta_pro_omitida"]);
    expect(events[0]).toEqual({ event: "oferta_pro_vista", origen_oferta: "primera_descarga", tipo_resultado: "cv", usuario_autenticado: true, exposure_id: exp.exposureId });
    expect(events[1]).toEqual({ event: "oferta_pro_click", origen_oferta: "primera_descarga", tipo_resultado: "cv", exposure_id: exp.exposureId });
    expect(events[2]).toEqual({ event: "oferta_pro_omitida", origen_oferta: "primera_descarga", tipo_resultado: "cv", exposure_id: exp.exposureId, motivo: "planes_descarga_gratis" });
    expect(events.some((e) => e.event === "limite_planes_visto" || e.event === "activacion")).toBe(false);
    expect(gtag).not.toHaveBeenCalled();
    expect(fbq).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled(); // ni /api/tracking/milestone ni nada
  });

  it("consulta una vez por pestaña, deduplica dobles clics y ante error o demora deja descargar", async () => {
    let answer: () => Promise<Response> = async () => Response.json({ show: true, exposureId: "0f8fad5b-d9cb-469f-a165-70867728950e" });
    const { fetchMock } = stubBrowser(() => answer());
    const t = await import("@/lib/tracking/offer");
    expect(await t.requestFirstDownloadOffer(null, "cv")).toBeNull(); // sin sesión no consulta
    const [a, b] = await Promise.all([t.requestFirstDownloadOffer(EMAIL, "cv"), t.requestFirstDownloadOffer(EMAIL, "cv")]);
    expect(a).toEqual({ exposureId: "0f8fad5b-d9cb-469f-a165-70867728950e", tipo: "cv" });
    expect(b).toBeNull();
    expect(await t.requestFirstDownloadOffer(EMAIL, "carta")).toBeNull(); // ya decidido en esta pestaña
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({ tipo: "cv" });

    answer = async () => { throw new Error("red"); };
    expect(await t.requestFirstDownloadOffer("beto@example.com", "cv")).toBeNull();
    answer = async () => new Response("nope", { status: 503 });
    expect(await t.requestFirstDownloadOffer("caro@example.com", "cv")).toBeNull();
    answer = () => new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("abort")), 30));
    const started = Date.now();
    expect(await t.requestFirstDownloadOffer("dani@example.com", "cv", 20)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
    answer = async () => Response.json({ show: true, exposureId: "<script>" });
    expect(await t.requestFirstDownloadOffer("eli@example.com", "cv")).toBeNull(); // id inválido: no se muestra
  });
});

describe("origen comercial en el funnel de planes", () => {
  it("la oferta etiqueta plan_click y checkout, y la compra conserva el origen aunque Mercado Pago vuelva a /precios", async () => {
    const { events } = stubBrowser(async (url) => (String(url).includes("milestone") ? new Response(null, { status: 401 }) : Response.json({})));
    const tracking = await import("@/lib/tracking");
    const offer = await import("@/lib/tracking/offer");
    const origin = await import("@/lib/tracking/origin");
    offer.trackOfferClick({ exposureId: "0f8fad5b-d9cb-469f-a165-70867728950e", tipo: "carta" });
    tracking.trackPlanClick("mensual");
    await tracking.trackCheckoutCreated(EMAIL, "mensual", "abc123", 10);
    // Vuelta desde Mercado Pago a /precios, una hora después: cuenta como menú, pero la compra es de la oferta.
    const later = Date.now() + 3600_000;
    expect(origin.ensureOrigen("menu_planes", later)).toBe("menu_planes");
    expect(origin.checkoutOrigen(later)).toBe("primera_descarga");
    const byName = (n: string) => events.find((e) => e.event === n);
    expect(byName("plan_click")).toMatchObject({ plan: "mensual", origen_oferta: "primera_descarga" });
    expect(byName("checkout_creado")).toMatchObject({ plan: "mensual", origen_oferta: "primera_descarga" });
    await tracking.trackVerifiedPurchase(EMAIL, { id: "200", amount: 990, currency: "ARS", first: true, at: Date.now(), plan: "mensual" });
    expect(byName("compra_confirmada")).toMatchObject({ origen_oferta: "primera_descarga", renovacion: false });
  });

  it("el límite real y las funciones pagas mantienen sus eventos, ahora con su origen", async () => {
    const { events } = stubBrowser(async () => new Response(null, { status: 401 }));
    const tracking = await import("@/lib/tracking");
    const origin = await import("@/lib/tracking/origin");
    await tracking.trackPaywallViewed(EMAIL, "cv");
    await tracking.trackPlanFeatureViewed(EMAIL, "word");
    expect(events.find((e) => e.event === "limite_planes_visto")).toMatchObject({ herramienta: "cv", origen_oferta: "limite_real" });
    expect(events.find((e) => e.event === "funcion_plan_vista")).toMatchObject({ funcion: "word", origen_oferta: "funcion_plan" });
    origin.setOrigen("limite_real");
    tracking.trackPlanClick("semanal");
    expect(events.at(-1)).toMatchObject({ event: "plan_click", origen_oferta: "limite_real" });
    // Sin exposición reciente, /precios cuenta como menú.
    expect(origin.currentOrigen(Date.now() + origin.CURRENT_MAX_AGE + 1)).toBe("menu_planes");
  });
});
