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
function apiFixture() {
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
    if (path === "/authorized_payments/search") return Response.json({ results: [{ id: 100, preapproval_id: "sub1", payment: { id: 200 } }] });
    if (path === "/authorized_payments/100") return Response.json({ id: 100, preapproval_id: "sub1", payment: { id: 200 } });
    if (path === "/v1/payments/200") return Response.json({ id: 200, status: paymentStatus, transaction_amount: 10000, currency_id: "ARS", date_approved: approvedAt });
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
    const out = await Promise.allSettled([s.checkout("ana@example.com"), s.checkout("ana@example.com")]);
    expect(out.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await s.checkout("ana@example.com")).toContain("mercadopago.com.ar");
    expect(fixture.fetchMock.mock.calls.filter(([,init]) => init?.method === "POST")).toHaveLength(1);
  });
  it("autorizar una suscripción no equivale a cobrar; un pago acreditado habilita un solo período", async () => {
    const s = await setup(); const fixture = apiFixture();
    await s.checkout("ana@example.com"); fixture.authorize();
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
    await s.checkout("ana@example.com"); fixture.authorize();
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
  it("aplica cuota gratis por cuenta y categoría en lugar de por navegador", async () => {
    const s = await setup();
    expect(await s.allowUsage("ana@example.com", "cv")).toBe(true);
    expect(await s.allowUsage("ana@example.com", "cv")).toBe(true);
    expect(await s.allowUsage("ana@example.com", "cv")).toBe(false);
    expect(await s.allowUsage("beto@example.com", "cv")).toBe(true);
    expect(await s.allowUsage("ana@example.com", "carta")).toBe(true);
    expect(await s.allowUsage("ana@example.com", "carta")).toBe(false);
  });
});
