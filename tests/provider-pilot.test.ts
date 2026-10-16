import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pilotJobs, runProviderPilot } from "@/lib/match/provider-pilot";
import { POST } from "@/app/api/match/admin/proveedores/route";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { resetMemoryCounters } from "@/lib/db";
const description = "Buscamos analista de datos para desarrollar reportes comerciales con SQL. ".repeat(8);
const job = { id: 1, title: "Analista", organization: "Empresa", url: "https://jobs.example.com/1", countries_derived: ["Argentina"], locations_derived: ["Buenos Aires, Argentina"], description_text: description };
const json = (body: unknown, headers?: Record<string, string>) => new Response(JSON.stringify(body), { headers });
beforeEach(() => { vi.stubEnv("FANTASTIC_JOBS", "secret-fantastic"); vi.stubEnv("SERP_API", "secret-serp"); vi.stubEnv("AUTH_SECRET", "x".repeat(40)); vi.stubEnv("ADMIN_EMAILS", "admin@example.com"); resetMemoryCounters(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("pruebas privadas de proveedores", () => {
  it("rechaza anónimos, cuentas sin permisos y CSRF antes de consultar o consumir cuota", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const request = (email?: string, origin = "https://maru.test") => new Request("https://maru.test/api/match/admin/proveedores", { method: "POST", headers: { origin, ...(email ? { cookie: `${SESSION_COOKIE}=${createSessionToken(email)}` } : {}) }, body: JSON.stringify({ provider: "serp", action: "sample" }) });
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request("otra@example.com"))).status).toBe(403);
    expect((await POST(request("admin@example.com", "https://evil.test"))).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("nunca devuelve la clave ni el email que incluye Account API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ api_key: "secret-serp", account_email: "privado@example.com", plan_name: "Free", plan_searches_left: 5 })));
    const result = await runProviderPilot("serp", "status");
    expect(result.quota).toEqual({ plan_name: "Free", plan_searches_left: 5 });
    expect(JSON.stringify(result)).not.toMatch(/secret-serp|privado/);
  });
  it("frena sin búsquedas incluidas y no usa créditos extra", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ plan_searches_left: 0, total_searches_left: 100 })); vi.stubGlobal("fetch", fetcher);
    await expect(runProviderPilot("serp", "sample")).rejects.toMatchObject({ code: "QUOTA_LOW" }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("no descarga Fantastic si no conoce saldo suficiente y no revela errores del proveedor", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ count: 100 })); vi.stubGlobal("fetch", fetcher);
    await expect(runProviderPilot("fantastic", "sample")).rejects.toMatchObject({ code: "QUOTA_LOW" }); expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValue(new Response("secret-fantastic", { status: 401 }));
    await expect(runProviderPilot("fantastic", "status")).rejects.toThrow("HTTP 401");
  });
  it("acota la muestra a 25 ATS + 25 JB y excluye los campos de reclutadores", async () => {
    const headers = { "x-api-jobs-remaining": "100", "x-api-requests-remaining": "20", "x-api-jobs-this-request": "1" };
    const fetcher = vi.fn().mockResolvedValueOnce(json({ count: 100 }, headers)).mockResolvedValueOnce(json([job], headers)).mockResolvedValueOnce(json([{ ...job, id: 2, recruiter_name: "PERSONA PRIVADA" }], headers)); vi.stubGlobal("fetch", fetcher);
    const result = await runProviderPilot("fantastic", "sample");
    expect(fetcher).toHaveBeenCalledTimes(3); expect(result.summary).toMatchObject({ received: 2, usable: 2, newUsable: 1, duplicates: 1 });
    const lastUrl = fetcher.mock.calls[2][0] as URL;
    expect(lastUrl.searchParams.get("limit")).toBe("25"); expect(lastUrl.searchParams.get("exclude_recruiter_fields")).toBe("true");
    expect(JSON.stringify(result)).not.toContain("PERSONA PRIVADA");
  });
  it("distingue copias del inventario, ubicación sin evidencia, vencidos y enlaces inseguros", () => {
    const rows = pilotJobs("fantastic", [job, { ...job, id: 2, countries_derived: [], locations_derived: ["Remote"] }, { ...job, id: 3, date_valid_through: "2020-01-01" }, { ...job, id: 4, url: "javascript:alert(1)" }], [job.url]);
    expect(rows[0]).toMatchObject({ usable: true, duplicate: true }); expect(rows.slice(1).every((r) => !r.usable)).toBe(true);
    expect(rows[3].url).toBe("");
  });
  it("impone un tope global de dos intentos diarios aun si falla el proveedor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fallo")));
    const request = () => new Request("https://maru.test/api/match/admin/proveedores", { method: "POST", headers: { origin: "https://maru.test", cookie: `${SESSION_COOKIE}=${createSessionToken("admin@example.com")}` }, body: JSON.stringify({ provider: "serp", action: "sample" }) });
    expect((await POST(request())).status).toBe(502); expect((await POST(request())).status).toBe(502); expect((await POST(request())).status).toBe(429);
  });
});
