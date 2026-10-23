import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => { vi.resetModules(); });
async function setup() {
  vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", "true");
  vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "test-token");
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "test-secret");
  const db = await import("@/lib/db");
  db.resetMemoryDb(); db.resetMemoryCounters();
  const server = await import("@/lib/billing/server");
  return server;
}
function apiFixture(amount = 10000, opts: { other?: boolean; searchFails?: boolean; noInvoices?: boolean } = {}) {
  let reference = "";
  let status = "pending";
  let paymentStatus = "approved";
  let renewalAmount: number | null = null;
  let refunds = 0;
  const approvedAt = new Date().toISOString();
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/preapproval" && init?.method === "POST") {
      reference = JSON.parse(String(init.body)).external_reference;
      return Response.json({ id: "sub1", external_reference: reference, status, init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?id=sub1" });
    }
    if (path === "/preapproval/sub1") {
      const body = init?.method === "PUT" ? JSON.parse(String(init.body)) : {};
      if (body.status === "cancelled") status = "cancelled";
      if (body.auto_recurring) renewalAmount = body.auto_recurring.transaction_amount;
      return Response.json({ id: "sub1", external_reference: reference, status });
    }
    if (path === "/v1/payments/200/refunds" && init?.method === "POST") { refunds++; paymentStatus = "refunded"; return Response.json({ id: 900, status: "approved" }); }
    if (path === "/preapproval/search") {
      if (opts.searchFails) return Response.json({}, { status: 400 });
      return Response.json({ results: opts.other ? [{ id: "sub2", external_reference: reference, status: "authorized" }, { id: "x9", external_reference: "otra", status: "authorized" }] : [] });
    }
    if (path === "/preapproval/sub2") return Response.json({ id: "sub2", external_reference: reference, status: "authorized" });
    if (path === "/v1/payments/search") return Response.json({ results: new URL(String(url)).searchParams.get("external_reference") === reference ? [{ id: 200, status: paymentStatus }] : [] });
    if (path === "/authorized_payments/search" && opts.noInvoices) return Response.json({ results: [] });
    if (path === "/authorized_payments/search" && opts.other) {
      const id = new URL(String(url)).searchParams.get("preapproval_id");
      return Response.json({ results: id === "sub2" ? [{ id: 101, preapproval_id: "sub2", payment: { id: 200 } }] : [] });
    }
    if (path === "/authorized_payments/101") return Response.json({ id: 101, preapproval_id: "sub2", payment: { id: 200 } });
    if (path === "/authorized_payments/search") return Response.json({ results: [{ id: 100, preapproval_id: "sub1", payment: { id: 200 } }] });
    if (path === "/authorized_payments/100") return Response.json({ id: 100, preapproval_id: "sub1", payment: { id: 200 } });
    if (path === "/v1/payments/200") return Response.json({ id: 200, status: paymentStatus, transaction_amount: amount, currency_id: "ARS", date_approved: approvedAt });
    throw new Error(`Unexpected provider request: ${path}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, authorize: () => { status = "authorized"; }, refund: () => { paymentStatus = "refunded"; }, renewalAmount: () => renewalAmount, refunds: () => refunds };
}
describe("suscripción validada en el servidor", () => {
  it("exige login y no contrata si el modo pago está apagado", async () => {
    vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", "false");
    const { POST } = await import("@/app/api/billing/checkout/route");
    expect((await POST(new Request("https://maru.test/api/billing/checkout", { method: "POST" }))).status).toBe(401);
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    const res = await POST(new Request("https://maru.test/api/billing/checkout", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${createSessionToken("ana@example.com")}` } }));
    expect(res.status).toBe(503);
  });
  it("reserva una única creación concurrente y reutiliza un checkout pendiente", async () => {
    const s = await setup(); const fixture = apiFixture();
    const out = await Promise.allSettled([s.checkout("ana@example.com", "mensual"), s.checkout("ana@example.com", "mensual")]);
    expect(out.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await s.checkout("ana@example.com", "mensual")).toContain("mercadopago.com.ar");
    expect(fixture.fetchMock.mock.calls.filter(([,init]) => init?.method === "POST")).toHaveLength(1);
  });
  it("autorizar una suscripción no equivale a cobrar; un pago acreditado habilita un solo período", async () => {
    const s = await setup(); const fixture = apiFixture();
    await s.checkout("ana@example.com", "mensual"); fixture.authorize();
    await s.processNotification("subscription_preapproval", "sub1");
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(false);
    await s.processNotification("subscription_authorized_payment", "100");
    const first = await s.readSubscription("ana@example.com");
    expect(s.hasPaidAccess(first)).toBe(true);
    await s.processNotification("subscription_authorized_payment", "100");
    expect((await s.readSubscription("ana@example.com"))?.paidThrough).toBe(first?.paidThrough);
    expect(await s.readSubscription("beto@example.com")).toBeNull();
    await s.cancel("ana@example.com");
    expect((await s.readSubscription("ana@example.com"))?.status).toBe("cancelled");
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(true);
    fixture.refund(); await s.processNotification("payment", "200");
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(false);
  });
  it("recupera un pago acreditado aunque no haya llegado el webhook", async () => {
    const s = await setup(); const fixture = apiFixture();
    await s.checkout("ana@example.com", "mensual"); fixture.authorize();
    await s.refreshSubscription("ana@example.com");
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(true);
  });
  it("recupera el pago si Mercado Pago lo autorizó en otra suscripción con la misma referencia", async () => {
    const s = await setup(); apiFixture(4500, { other: true });
    await s.checkout("ana@example.com", "semanal");
    await s.refreshSubscription("ana@example.com");
    const sub = await s.readSubscription("ana@example.com");
    expect(s.hasPaidAccess(sub)).toBe(true);
    expect(sub?.id).toBe("sub2");
    expect(sub?.status).toBe("authorized");
  });
  it("un paso fallido de la recuperación no impide acreditar el pago", async () => {
    const s = await setup(); const fixture = apiFixture(10000, { searchFails: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await s.checkout("ana@example.com", "mensual"); fixture.authorize();
    await s.refreshSubscription("ana@example.com");
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(true);
  });
  it("encuentra el pago por la referencia si no aparece en los comprobantes", async () => {
    const s = await setup(); const fixture = apiFixture(10000, { noInvoices: true });
    await s.checkout("ana@example.com", "mensual"); fixture.authorize();
    await s.refreshSubscription("ana@example.com");
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(true);
  });
  it("explica por qué no acreditó un pago aprobado con otro importe", async () => {
    const s = await setup(); const fixture = apiFixture(4000);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await s.checkout("ana@example.com", "semanal"); fixture.authorize();
    await expect(s.refreshSubscription("ana@example.com")).rejects.toThrow(/4000 ARS \(plan semanal: 4500 ARS\)/);
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(false);
  });
  it("rechaza firmas falsas y un ID modificado; admite reintentos firmados", async () => {
    await setup();
    const { validWebhook } = await import("@/lib/billing/provider");
    const stamp = String(Date.now());
    const sig = createHmac("sha256", "test-secret").update(`id:123;request-id:r1;ts:${stamp};`).digest("hex");
    const req = new Request("https://maru.test/api/billing/webhook?data.id=123", { headers: { "x-request-id": "r1", "x-signature": `ts=${stamp},v1=${sig}` } });
    expect(validWebhook(req, "123")).toBe(true);
    expect(validWebhook(req, "999")).toBe(false);
    vi.spyOn(Date, "now").mockReturnValue(Number(stamp) + 11 * 60_000);
    expect(validWebhook(req, "123")).toBe(true);
  });
  it("frena el webhook sin firma antes de consultar al proveedor", async () => {
    await setup(); const fixture = apiFixture();
    const { POST } = await import("@/app/api/billing/webhook/route");
    const res = await POST(new Request("https://maru.test/api/billing/webhook?data.id=123", { method: "POST", body: JSON.stringify({ type: "subscription_preapproval", data: { id: "123" } }) }));
    expect(res.status).toBe(401); expect(fixture.fetchMock).not.toHaveBeenCalled();
  });
  it("registra para el panel qué pasó con cada notificación, sin datos personales", async () => {
    const s = await setup(); const fixture = apiFixture();
    await s.checkout("ana@example.com", "mensual"); fixture.authorize();
    const { POST } = await import("@/app/api/billing/webhook/route");
    const signed = (id: string, type: string) => {
      const stamp = String(Date.now());
      const sig = createHmac("sha256", "test-secret").update(`id:${id};request-id:r1;ts:${stamp};`).digest("hex");
      return new Request(`https://maru.test/api/billing/webhook?data.id=${id}&type=${type}`, { method: "POST", headers: { "x-request-id": "r1", "x-signature": `ts=${stamp},v1=${sig}` }, body: JSON.stringify({ type, data: { id } }) });
    };
    expect((await POST(signed("100", "subscription_authorized_payment"))).status).toBe(200);
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(true);
    expect((await POST(signed("777", "payment"))).status).toBe(200);
    const bad = new Request("https://maru.test/api/billing/webhook?data.id=5&type=payment", { method: "POST", headers: { "x-request-id": "r1", "x-signature": `ts=1,v1=${"0".repeat(64)}` }, body: "{}" });
    expect((await POST(bad)).status).toBe(401);
    const { readBillingEvents } = await import("@/lib/billing/log");
    const events = await readBillingEvents();
    expect(events.map((e) => [e.result, e.detail])).toEqual([
      ["rechazada", expect.stringMatching(/la firma no coincide/)],
      ["procesada", "pago sin suscripción vinculada todavía"],
      // Con la promo del mensual, el primer pago también pasa la renovación al precio regular.
      ["procesada", "renovación pasada al precio regular · suscripción authorized, pago approved"],
    ]);
    expect(JSON.stringify(events)).not.toContain("ana@example.com");
  });
  it("muestra el diagnóstico del cobro sólo a administración y sin valores de claves", async () => {
    await setup(); vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ site_id: "MLA", email: "dueño@example.com" })));
    const { GET } = await import("@/app/api/billing/admin/route");
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    const as = (email: string) => new Request("https://maru.test/api/billing/admin", { headers: { cookie: `${SESSION_COOKIE}=${createSessionToken(email)}` } });
    expect((await GET(as("ana@example.com"))).status).toBe(403);
    const res = await GET(as("admin@example.com"));
    const body = await res.json();
    expect(body).toMatchObject({ ready: true, tokenKind: "formato desconocido", account: { ok: true, site: "MLA" }, events: [] });
    expect(JSON.stringify(body)).not.toMatch(/test-token|test-secret|dueño/);
  });
  it("aplica cuota gratis diaria por cuenta y categoría, y semanal para entrevistas", async () => {
    const s = await setup();
    const lunes = Date.parse("2026-10-12T15:00:00Z");
    expect(await s.allowUsage("ana@example.com", "cv", lunes)).toBe(true);
    expect(await s.allowUsage("ana@example.com", "cv", lunes)).toBe(false);
    expect(await s.allowUsage("beto@example.com", "cv", lunes)).toBe(true);
    expect(await s.allowUsage("ana@example.com", "carta", lunes)).toBe(true);
    expect(await s.allowUsage("ana@example.com", "carta", lunes)).toBe(false);
    // Al día siguiente (hora de Argentina) se renueva el CV, no la entrevista semanal.
    const martes = lunes + 86400_000;
    expect(await s.allowUsage("ana@example.com", "entrevista", lunes)).toBe(true);
    expect(await s.allowUsage("ana@example.com", "cv", martes)).toBe(true);
    expect(await s.allowUsage("ana@example.com", "entrevista", martes)).toBe(false);
    expect(await s.allowUsage("ana@example.com", "entrevista", lunes + 7 * 86400_000)).toBe(true);
  });
  it("cuenta días y semanas en hora de Argentina", async () => {
    const s = await setup();
    // 01:30 UTC del martes todavía es lunes en Argentina.
    expect(s.usageWindow("dia", Date.parse("2026-10-13T01:30:00Z"))).toBe("d2026-10-12");
    expect(s.usageWindow("dia", Date.parse("2026-10-13T03:00:00Z"))).toBe("d2026-10-13");
    expect(s.usageWindow("semana", Date.parse("2026-10-18T20:00:00Z"))).toBe("s2026-10-12");
    expect(s.usageWindow("semana", Date.parse("2026-10-19T02:59:00Z"))).toBe("s2026-10-12");
    expect(s.usageWindow("semana", Date.parse("2026-10-19T03:00:00Z"))).toBe("s2026-10-19");
  });
  it("calcula el período pagado de cada plan", async () => {
    const s = await setup();
    const at = Date.parse("2026-01-31T12:00:00Z");
    expect(s.periodEnd(at, 7, "days")).toBe(Date.parse("2026-02-07T12:00:00Z"));
    expect(s.periodEnd(at, 1, "months")).toBe(Date.parse("2026-02-28T12:00:00Z"));
    expect(s.periodEnd(at, 3, "months")).toBe(Date.parse("2026-04-30T12:00:00Z"));
  });
  it("crea la suscripción con la frecuencia e importe del plan y acredita sólo ese importe", async () => {
    const s = await setup(); const fixture = apiFixture(4500);
    await s.checkout("ana@example.com", "semanal");
    const body = JSON.parse(String(fixture.fetchMock.mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body));
    expect(body.auto_recurring).toMatchObject({ frequency: 7, frequency_type: "days", transaction_amount: 4500, currency_id: "ARS" });
    expect((await s.readSubscription("ana@example.com"))?.plan).toBe("semanal");
    await expect(s.checkout("ana@example.com", "trimestral")).rejects.toThrow(/pago pendiente/);
    fixture.authorize();
    await s.processNotification("subscription_authorized_payment", "100");
    const sub = await s.readSubscription("ana@example.com");
    expect(s.hasPaidAccess(sub)).toBe(true);
    expect((sub?.paidThrough ?? 0) - (sub?.paymentAt ?? 0)).toBe(7 * 86400_000);
  });
  it("no acredita un pago con el importe de otro plan", async () => {
    const s = await setup(); const fixture = apiFixture(10000);
    await s.checkout("ana@example.com", "trimestral"); fixture.authorize();
    await s.processNotification("subscription_authorized_payment", "100");
    expect(s.hasPaidAccess(await s.readSubscription("ana@example.com"))).toBe(false);
  });
  it("rechaza un plan desconocido en el checkout", async () => {
    await setup();
    const { POST } = await import("@/app/api/billing/checkout/route");
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    const res = await POST(new Request("https://maru.test/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: "anual" }), headers: { cookie: `${SESSION_COOKIE}=${createSessionToken("ana@example.com")}` } }));
    expect(res.status).toBe(400);
  });
  it("reserva el Word para el plan pago y lo deja libre con el cobro apagado", async () => {
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    // Un documento inválido alcanza: sin plan se frena antes (402); con el cobro apagado llega a validarlo (400).
    const doc = { experiencia: "no" };
    const req = () => new Request("https://maru.test/api/export/docx", { method: "POST", body: JSON.stringify({ kind: "cv", doc }), headers: { cookie: `${SESSION_COOKIE}=${createSessionToken("ana@example.com")}` } });
    await setup();
    let { POST } = await import("@/app/api/export/docx/route");
    const blocked = await POST(req());
    expect(blocked.status).toBe(402);
    expect((await blocked.json()).code).toBe("PLAN_FEATURE");
    vi.resetModules(); vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", "false");
    ({ POST } = await import("@/app/api/export/docx/route"));
    expect((await POST(req())).status).toBe(400);
  });
  it("lee la bandera en tiempo de ejecución y dice qué falta sin mostrar valores", async () => {
    vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", " TRUE ");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "secreto");
    const s = await import("@/lib/billing/server");
    expect(s.billingReady()).toBe(false);
    expect(s.billingMissing()).toEqual(["MERCADOPAGO_ACCESS_TOKEN"]);
    // Bandera encendida sin credenciales: las herramientas siguen andando en lugar de cortarse.
    expect(await s.allowUsage("ana@example.com", "cv")).toBe(true);
    const { GET } = await import("@/app/api/billing/status/route");
    const body = await (await GET(new Request("https://maru.test/api/billing/status"))).json();
    expect(body).toMatchObject({ enabled: false, missing: ["MERCADOPAGO_ACCESS_TOKEN"] });
    expect(JSON.stringify(body)).not.toContain("secreto");
    vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", "si");
    expect(s.billingMissing()[0]).toBe("NEXT_PUBLIC_BILLING_ENABLED (no es true)");
  });
});

describe("extensión y promo de lanzamiento", () => {
  it("da 4 autocompletados gratis por día por instalación, con tope por IP", async () => {
    const s = await setup();
    const lunes = Date.parse("2026-10-19T15:00:00Z");
    for (let i = 0; i < 4; i++) expect(await s.allowAnonymousUsage("instalacion-aaaaaaaa", "1.1.1.1", "autofill", lunes)).toBe(true);
    expect(await s.allowAnonymousUsage("instalacion-aaaaaaaa", "1.1.1.1", "autofill", lunes)).toBe(false);
    // Reinstalar suma una instalación nueva, pero la IP tiene su propio tope (3 veces el cupo).
    // La IP ya lleva 5 pedidos (el quinto cuenta aunque la instalación no tenga cupo): quedan 7 de 12.
    for (let i = 0; i < 7; i++) expect(await s.allowAnonymousUsage(`otra-instalacion-${i}xxxx`, "1.1.1.1", "autofill", lunes)).toBe(true);
    expect(await s.allowAnonymousUsage("otra-instalacion-final", "1.1.1.1", "autofill", lunes)).toBe(false);
    expect(await s.allowAnonymousUsage("nueva-instalacion-zz", "2.2.2.2", "autofill", lunes)).toBe(true);
    // Al día siguiente se renueva.
    expect(await s.allowAnonymousUsage("instalacion-aaaaaaaa", "1.1.1.1", "autofill", lunes + 86400_000)).toBe(true);
  });

  it("el autocompletado dice cuántos usos quedan y responde 429 al pasar el cupo gratis", async () => {
    await setup();
    vi.stubGlobal("fetch", vi.fn());
    const { extensionGuard } = await import("@/lib/billing/http");
    const req = () => new Request("https://maru.test/api/autofill", { method: "POST", headers: { "X-Maru-Install": "instalacion-bbbbbbbb", "x-forwarded-for": "3.3.3.3" } });
    // Cada uso devuelve cuántos quedan: 3, 2, 1, 0.
    for (let i = 0; i < 4; i++) expect(await extensionGuard(req())).toEqual({ blocked: null, remaining: 3 - i, limit: 4 });
    const { blocked } = await extensionGuard(req());
    expect(blocked?.status).toBe(429);
    expect(await blocked!.json()).toMatchObject({ code: "PLAN_LIMIT", remaining: 0, limit: 4 });
  });

  it("la promo es sólo el primer mes: se cobra $990 y la suscripción pasa a $10.000 al acreditarse", async () => {
    const { PLANS, planDiscount, acceptedAmounts, chargeTerms } = await import("@/lib/plans");
    expect(PLANS.mensual.price).toBe(10000);
    expect(planDiscount(PLANS.mensual)).toBe(90);
    expect(acceptedAmounts(PLANS.mensual)).toEqual([990, 10000]);
    expect(planDiscount(PLANS.trimestral)).toBeNull();
    expect(chargeTerms(PLANS.mensual)).toBe("Hoy pagás $990. Desde el segundo período se renueva cada mes a $10.000.");
    const s = await setup(); const fixture = apiFixture(990);
    await s.checkout("ana@example.com", "mensual"); fixture.authorize();
    const created = fixture.fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/preapproval") && init?.method === "POST");
    expect(JSON.parse(String(created?.[1]?.body)).auto_recurring.transaction_amount).toBe(990);
    await s.processNotification("subscription_authorized_payment", "100");
    const sub = await s.readSubscription("ana@example.com");
    expect(s.hasPaidAccess(sub)).toBe(true);
    expect(fixture.renewalAmount()).toBe(10000);
    expect(sub?.renewalPriceSet).toBe(true);
    expect(sub?.paymentAmount).toBe(990);
    expect(s.lastPayment(sub)?.amount).toBe(990);
  });

  it("la baja corta la renovación, conserva el acceso y devuelve un número de solicitud", async () => {
    const s = await setup(); const fixture = apiFixture(990);
    await s.checkout("ana@example.com", "mensual"); fixture.authorize();
    await s.processNotification("subscription_authorized_payment", "100");
    const out = await s.cancel("ana@example.com", "precio");
    expect(out.requestId).toMatch(/^BAJA-[A-F0-9]{8}$/);
    const sub = await s.readSubscription("ana@example.com");
    expect(sub?.status).toBe("cancelled");
    expect(s.hasPaidAccess(sub)).toBe(true);
    expect(out.paidThrough).toBe(sub?.paidThrough);
    // Repetir la baja devuelve el mismo número.
    expect((await s.cancel("ana@example.com")).requestId).toBe(out.requestId);
  });

  it("la garantía devuelve el 100% del primer pago una sola vez, aunque se haya usado Maru", async () => {
    const s = await setup(); const fixture = apiFixture(990);
    await s.checkout("ana@example.com", "mensual"); fixture.authorize();
    await s.processNotification("subscription_authorized_payment", "100");
    const option = await s.readRefundOption("ana@example.com");
    expect(option).toMatchObject({ kind: "garantia", amount: 990 });
    const out = await s.requestRefund("ana@example.com");
    expect(out).toMatchObject({ kind: "garantia", amount: 990 });
    expect(out.requestId).toMatch(/^DEV-/);
    expect(fixture.refunds()).toBe(1);
    const sub = await s.readSubscription("ana@example.com");
    expect(sub?.status).toBe("cancelled");
    expect(s.hasPaidAccess(sub)).toBe(false);
    // Pedirla de nuevo no genera otro reembolso.
    expect((await s.requestRefund("ana@example.com")).requestId).toBe(out.requestId);
    expect(fixture.refunds()).toBe(1);
  });

  it("calcula los plazos de garantía (14 días) y arrepentimiento (10 días)", async () => {
    const s = await setup();
    const day = 86400_000;
    const paidAt = Date.parse("2026-10-01T12:00:00Z");
    const sub = { id: "sub1", reference: "r", status: "authorized", plan: "mensual" as const, firstPaymentId: 1, paymentId: 1, firstPaymentAt: paidAt, paymentAmount: 990, updatedAt: 0 };
    expect(s.refundOption(sub, false, paidAt + 13 * day)?.kind).toBe("garantia");
    expect(s.refundOption(sub, false, paidAt + 15 * day)).toBeNull();
    expect(s.refundOption(sub, true, paidAt + 9 * day)?.kind).toBe("arrepentimiento");
    expect(s.refundOption(sub, true, paidAt + 11 * day)).toBeNull();
    expect(s.refundOption({ ...sub, refund: { id: "DEV-1", at: paidAt, kind: "garantia", paymentId: 1, amount: 990 } }, false, paidAt + day)).toBeNull();
  });

  it("si Mercado Pago rechaza crear la suscripción, libera la reserva y el próximo intento usa otra referencia", async () => {
    const s = await setup();
    const refs: string[] = [];
    let reject = true;
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path === "/preapproval" && init?.method === "POST") {
        refs.push(String((init.headers as Record<string, string>)["X-Idempotency-Key"]));
        if (reject) return Response.json({ message: "Invalid users involved", error: "bad_request", status: 400, cause: [{ code: "x", description: "payer ana@example.com" }] }, { status: 400 });
        const reference = JSON.parse(String(init.body)).external_reference;
        return Response.json({ id: "sub9", external_reference: reference, status: "pending", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?id=sub9" });
      }
      throw new Error(`Unexpected provider request: ${path}`);
    }));
    await expect(s.startCheckout("ana@example.com", "mensual")).rejects.toBeInstanceOf(s.CheckoutRejected);
    expect((await s.readSubscription("ana@example.com"))?.status).toBe("failed");
    // Antes quedaba "preparándose": cada clic devolvía «Tu pago se está preparando».
    reject = false;
    const out = await s.startCheckout("ana@example.com", "mensual");
    expect(out.url).toContain("mercadopago.com.ar");
    expect(refs).toHaveLength(2);
    expect(refs[0]).not.toBe(refs[1]);
    const { readBillingEvents } = await import("@/lib/billing/log");
    const events = await readBillingEvents();
    const rejected = events.find((e) => e.result === "rechazado por Mercado Pago");
    expect(rejected?.detail).toContain("Invalid users involved");
    expect(JSON.stringify(events)).not.toContain("ana@example.com");
  });

  it("la ruta de checkout explica el rechazo en lugar de un error genérico", async () => {
    await setup();
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "bad" }, { status: 400 })));
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    const { POST } = await import("@/app/api/billing/checkout/route");
    const req = () => new Request("https://maru.test/api/billing/checkout", { method: "POST", headers: { origin: "https://maru.test", cookie: `${SESSION_COOKIE}=${createSessionToken("ana@example.com")}` }, body: JSON.stringify({ plan: "mensual" }) });
    const first = await POST(req());
    expect(first.status).toBe(502);
    expect((await first.json()).code).toBe("CHECKOUT_REJECTED");
    // El segundo clic vuelve a intentar (no queda trabado en «preparándose»).
    expect((await (await POST(req())).json()).code).toBe("CHECKOUT_REJECTED");
  });

  it("si Mercado Pago no acepta el email como pagador, se puede pagar con el de otra cuenta de Mercado Pago", async () => {
    await setup();
    const payers: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(url)).pathname;
      if (path === "/preapproval" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        payers.push(body.payer_email);
        if (body.payer_email === "ana@example.com") return Response.json({ message: "Payer is associated with a different site", status: 400 }, { status: 400 });
        return Response.json({ id: "sub7", external_reference: body.external_reference, status: "pending", init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?id=sub7" });
      }
      throw new Error(`Unexpected provider request: ${path}`);
    }));
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    const { POST } = await import("@/app/api/billing/checkout/route");
    const req = (extra = {}) => new Request("https://maru.test/api/billing/checkout", { method: "POST", headers: { origin: "https://maru.test", cookie: `${SESSION_COOKIE}=${createSessionToken("ana@example.com")}` }, body: JSON.stringify({ plan: "mensual", ...extra }) });
    const first = await POST(req());
    expect(first.status).toBe(409);
    expect((await first.json()).code).toBe("PAYER_OTHER_SITE");
    expect((await (await POST(req({ payerEmail: "no-es-un-email" }))).json()).code).toBe("BAD_PAYER");
    const ok = await POST(req({ payerEmail: " Ana.MP@Example.com " }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).url).toContain("mercadopago.com.ar");
    expect(payers).toEqual(["ana@example.com", "ana.mp@example.com"]);
    // La suscripción sigue siendo de la cuenta de Maru (se vincula por la referencia).
    const s = await import("@/lib/billing/server");
    expect((await s.readSubscription("ana@example.com"))?.id).toBe("sub7");
  });
});
