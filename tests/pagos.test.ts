import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccount, isPaid } from "@/lib/account";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import { validSignature } from "@/lib/mercadopago";
import { POST as cancelar } from "@/app/api/pagos/cancelar/route";
import { POST as suscribir } from "@/app/api/pagos/suscribir/route";
import { POST as webhook } from "@/app/api/pagos/webhook/route";

const email = "ana@gmail.com";
const cookie = () => ({ cookie: `${SESSION_COOKIE}=${encodeURIComponent(createSessionToken(email))}` });

let mpStatus = "pending";
const calls: { url: string; method: string; body: unknown }[] = [];

beforeEach(() => {
  resetMemoryDb();
  calls.length = 0;
  mpStatus = "pending";
  vi.stubEnv("MP_ACCESS_TOKEN", "TEST-token");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url, method: init.method ?? "GET", body });
      if (url.endsWith("/preapproval") && init.method === "POST") return Response.json({ id: "sub1", status: "pending", init_point: "https://mp.example/pagar" });
      if (url.endsWith("/preapproval/sub1") && init.method === "PUT") return Response.json({ id: "sub1", status: "cancelled", external_reference: email });
      if (url.endsWith("/preapproval/sub1")) return Response.json({ id: "sub1", status: mpStatus, external_reference: email });
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("cobro con Mercado Pago", () => {
  it("sin la base de datos configurada, no cobra (avisa que se habilita pronto)", async () => {
    const res = await suscribir(new Request("https://maru.app/api/pagos/suscribir", { method: "POST", headers: cookie() }));
    expect(res.status).toBe(503);
  });

  it("pide sesión para suscribirse", async () => {
    const res = await suscribir(new Request("https://maru.app/api/pagos/suscribir", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("suscripción → webhook autorizado → plan activo → baja", async () => {
    // La base en memoria alcanza para el ciclo completo: sólo simulamos que está configurada.
    const db = await import("@/lib/db");
    vi.spyOn(db, "dbEnabled").mockReturnValue(true);

    const res = await suscribir(new Request("https://maru.app/api/pagos/suscribir", { method: "POST", headers: cookie() }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://mp.example/pagar" });
    const created = calls.find((c) => c.method === "POST")!;
    expect(created.body).toMatchObject({ external_reference: email, auto_recurring: { transaction_amount: 10000, currency_id: "ARS", frequency_type: "months" } });

    mpStatus = "authorized";
    const hook = await webhook(new Request("https://maru.app/api/pagos/webhook", { method: "POST", body: JSON.stringify({ type: "subscription_preapproval", data: { id: "sub1" } }) }));
    expect(hook.status).toBe(200);
    expect(isPaid(await getAccount(email))).toBe(true);

    const baja = await cancelar(new Request("https://maru.app/api/pagos/cancelar", { method: "POST", headers: cookie(), body: JSON.stringify({ arrepentimiento: true }) }));
    expect(await baja.json()).toEqual({ ok: true, reintegro: true });
    expect(isPaid(await getAccount(email))).toBe(false);
  });

  it("valida la firma del webhook cuando hay secreto", () => {
    vi.stubEnv("MP_WEBHOOK_SECRET", "s3cr3t");
    const ts = "1700000000";
    const v1 = createHmac("sha256", "s3cr3t").update(`id:abc123;request-id:req-1;ts:${ts};`).digest("hex");
    const ok = new Headers({ "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" });
    expect(validSignature(ok, "ABC123")).toBe(true);
    expect(validSignature(new Headers({ "x-signature": `ts=${ts},v1=${"0".repeat(64)}`, "x-request-id": "req-1" }), "abc123")).toBe(false);
    expect(validSignature(new Headers(), "abc123")).toBe(false);
  });
});

describe("baja del plan", () => {
  it("la baja normal conserva el plan hasta el próximo vencimiento", async () => {
    const { nextRenewal, isPaid } = await import("@/lib/account");
    expect(nextRenewal("2026-09-20T10:00:00.000Z", new Date("2026-10-16T00:00:00.000Z"))).toBe("2026-10-20T10:00:00.000Z");
    const cancelled = { email: "a", plan: "maru" as const, status: "cancelled" as const, paidUntil: "2026-10-20T10:00:00.000Z", createdAt: "", updatedAt: "" };
    expect(isPaid(cancelled, Date.parse("2026-10-19T00:00:00.000Z"))).toBe(true);
    expect(isPaid(cancelled, Date.parse("2026-10-21T00:00:00.000Z"))).toBe(false);
  });
});
