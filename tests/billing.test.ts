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
function apiFixture(amount = 10000, opts: { other?: boolean; searchFails?: boolean } = {}) {
  let reference = "";
  let status = "pending";
  let paymentStatus = "approved";
  const approvedAt = new Date().toISOString();
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/preapproval" && init?.method === "POST") {
      reference = JSON.parse(String(init.body)).external_reference;
      return Response.json({ id: "sub1", external_reference: reference, status, init_point: "https://www.mercadopago.com.ar/subscriptions/checkout?id=sub1" });
    }
    if (path === "/preapproval/sub1") {
      if (init?.method === "PUT") status = "cancelled";
      return Response.json({ id: "sub1", external_reference: reference, status });
    }
    if (path === "/preapproval/search") {
      if (opts.searchFails) return Response.json({}, { status: 400 });
      return Response.json({ results: opts.other ? [{ id: "sub2", external_reference: reference, status: "authorized" }, { id: "x9", external_reference: "otra", status: "authorized" }] : [] });
    }
    if (path === "/preapproval/sub2") return Response.json({ id: "sub2", external_reference: reference, status: "authorized" });
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
  return { fetchMock, authorize: () => { status = "authorized"; }, refund: () => { paymentStatus = "refunded"; } };
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
