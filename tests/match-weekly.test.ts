import { afterEach, describe, expect, it, vi } from "vitest";
import { MONTHLY_QUERY_PREFIXES, SERP_QUERIES, weeklyQueryIds } from "@/lib/match/providers";
import { summarizeWeek, type WeekCounts } from "@/lib/match/weekly";

const counts = (bySource: WeekCounts["bySource"]): WeekCounts => ({ at: "2026-11-23T10:00:00.000Z", bySource });

describe("actualización semanal", () => {
  it("Google Jobs: marketing, finanzas y tecnología junior todas las semanas, más 9 profesionales que rotan", () => {
    const base = SERP_QUERIES.filter((q) => MONTHLY_QUERY_PREFIXES.some((p) => q.id.startsWith(p))).map((q) => q.id);
    const a = weeklyQueryIds(new Date("2026-11-23T10:00:00Z"));
    const b = weeklyQueryIds(new Date("2026-11-30T10:00:00Z"));
    expect(a).toHaveLength(base.length + 9);
    expect(a.slice(0, base.length)).toEqual(base);
    // Rota: otra semana, otras búsquedas extra; nunca oficios, atención de la tanda 2 ni verticales.
    expect(a.slice(base.length)).not.toEqual(b.slice(base.length));
    for (const id of [...a.slice(base.length), ...b.slice(base.length)]) expect(id).toMatch(/^[a-z]+-[a-z]+$/);
    expect(new Set(a).size).toBe(a.length);
    // Entra en el plan gratuito: 5 lunes × 45 + reserva de 20 ≤ 250.
    expect(5 * a.length + 20).toBeLessThanOrEqual(250);
  });

  it("el resumen cuenta elegibles por fuente y marca una caída fuerte", () => {
    const before = counts({ greenhouse: { open: 100, eligible: 40 }, "apify-computrabajo": { open: 60, eligible: 60 } });
    const ok = summarizeWeek(before, counts({ greenhouse: { open: 110, eligible: 45 }, "apify-computrabajo": { open: 50, eligible: 50 } }));
    expect(ok.drop).toBeCloseTo(0.05);
    expect(ok.markdown).toContain("Elegibles desde la Argentina: **95**");
    expect(ok.markdown).toContain("| greenhouse | 110 | 45 | +5 |");
    expect(ok.markdown).not.toContain("⚠️");
    const bad = summarizeWeek(before, counts({ greenhouse: { open: 100, eligible: 40 } }));
    expect(bad.drop).toBeCloseTo(0.6);
    expect(bad.markdown).toContain("⚠️ Los elegibles cayeron 60%");
    expect(bad.markdown).toContain("| apify-computrabajo | 0 | 0 | −60 |");
  });
});

describe("cron semanal de Vercel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  const req = (auth?: string) => new Request("https://maru.test/api/cron/semanal", { headers: auth ? { authorization: auth } : {} });

  it("exige CRON_SECRET y el token, y lanza match-weekly en main sin exponer el token", async () => {
    const { GET } = await import("@/app/api/cron/semanal/route");
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req())).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3");
    expect((await GET(req("Bearer otro"))).status).toBe(401);
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "");
    expect((await GET(req("Bearer s3"))).status).toBe(503);
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "ghp_test");
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 204 });
    });
    const res = await GET(req("Bearer s3"));
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.github.com/repos/facundogregorini-lab/maru/actions/workflows/match-weekly.yml/dispatches");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ ref: "main" });
    expect(JSON.stringify(await res.json())).not.toContain("ghp_test");
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 403 }));
    const fail = await GET(req("Bearer s3"));
    expect(fail.status).toBe(502);
    expect(JSON.stringify(await fail.json())).not.toContain("ghp_test");
  });
});
