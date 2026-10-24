import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RankedItem } from "@/lib/match/ranking";
import { EVAL_CASES, EVAL_NOW, evalInventory } from "./match-eval-cases";

const leader = EVAL_CASES[0];
const settings = (over: Record<string, unknown> = {}) => ({ active: true, minScore: 50, filters: {}, profile: leader.profile, prefs: leader.prefs, interactions: { saved: [], discarded: [] }, ...over });
const item = (id: string, score: number, extra: Partial<RankedItem> = {}) => ({ id, score, title: `Puesto ${id}`, company: "Acme", locations: [], workplace: "remoto", workplaceLabel: "Remoto", reasons: [], ...extra }) as RankedItem;

async function fresh() {
  vi.resetModules();
  const db = await import("@/lib/db");
  db.resetMemoryDb();
  db.resetMemoryCounters();
  return { alerts: await import("@/lib/alerts"), auth: await import("@/lib/auth") };
}
beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

describe("alertas: piezas", () => {
  it("el link de baja va firmado y no se puede adivinar el de otra persona", async () => {
    const { alerts } = await fresh();
    const t = alerts.unsubscribeToken("ana@example.com");
    expect(alerts.readUnsubscribeToken(t)).toMatch(/^[a-f0-9]{32}$/);
    const [uid] = t.split(".");
    expect(alerts.readUnsubscribeToken(`${uid}.firma-falsa`)).toBeNull();
    expect(alerts.readUnsubscribeToken(`${alerts.unsubscribeToken("beto@example.com").split(".")[0]}.${t.split(".")[1]}`)).toBeNull();
  });

  it("elige las que superan el mínimo y no repite las ya enviadas", async () => {
    const { alerts } = await fresh();
    const ranked = [item("a", 91), item("b", 88), item("c", 72), item("d", 60), item("e", 95, { external: true })];
    expect(alerts.pickAlertJobs(ranked, { minScore: 70, sentIds: ["b"] }).map((j) => j.id)).toEqual(["a", "c"]);
  });

  it("el mail escapa los datos del aviso y trae la baja", async () => {
    const { alerts } = await fresh();
    const mail = alerts.buildAlertEmail([item("a", 91, { title: "Dev <script>", reasons: ["Encaja con tu rol."] })], 70, "https://maru.test/alertas/baja?t=x");
    expect(mail.subject).toBe("Maru: 1 búsqueda nueva para vos (91%)");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("Dev &lt;script&gt;");
    expect(mail.html).toContain("https://maru.test/alertas/baja?t=x");
    expect(mail.text).toContain("Dejar de recibir alertas: https://maru.test/alertas/baja?t=x");
  });
});

describe("alertas: API", () => {
  const as = async (email: string | null, method: string, body?: unknown) => {
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    return new Request("https://maru.test/api/alertas", {
      method,
      headers: email ? { cookie: `${SESSION_COOKIE}=${createSessionToken(email)}` } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  };

  it("pide sesión, y activar es del plan pago (apagar no)", async () => {
    await fresh();
    vi.stubEnv("NEXT_PUBLIC_BILLING_ENABLED", "true");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "test-token");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", "test-secret");
    const { GET, PUT } = await import("@/app/api/alertas/route");
    expect((await GET(await as(null, "GET"))).status).toBe(401);
    const blocked = await PUT(await as("ana@example.com", "PUT", settings()));
    expect(blocked.status).toBe(402);
    expect((await blocked.json()).code).toBe("PLAN_FEATURE");
    const off = await PUT(await as("ana@example.com", "PUT", settings({ active: false })));
    expect(off.status).toBe(200);
    const view = await (await GET(await as("ana@example.com", "GET"))).json();
    expect(view).toMatchObject({ disponible: true, envio: false, pro: false, alerta: { active: false, minScore: 50 } });
    expect(JSON.stringify(view)).not.toContain("profile");
  });

  it("valida el mínimo", async () => {
    await fresh();
    const { PUT } = await import("@/app/api/alertas/route");
    expect((await PUT(await as("ana@example.com", "PUT", settings({ minScore: 10 })))).status).toBe(400);
  });
});

describe("alertas: corrida semanal", () => {
  async function setup() {
    const { alerts } = await fresh();
    const { opportunities, postings } = evalInventory();
    await alerts.saveAlert("ana@example.com", settings());
    await alerts.saveAlert("beto@example.com", settings());
    await alerts.saveAlert("cami@example.com", settings({ active: false }));
    return { alerts, opportunities, postings: new Map(postings.map((p) => [p.key, p])) };
  }

  it("manda sólo a quien tiene plan, una vez por búsqueda", async () => {
    const { alerts, opportunities, postings } = await setup();
    const send = vi.fn(async () => true);
    const isPaid = async (email: string) => email === "ana@example.com";
    const first = await alerts.runAlerts({ opportunities, postings, isPaid, send, now: EVAL_NOW });
    expect(first).toMatchObject({ alertas: 2, conPlan: 1, conBusquedas: 1, enviadas: 1, fallidas: 0, sinClave: false });
    const mail = (send.mock.calls[0] as unknown as [import("@/lib/alerts").Mail])[0];
    expect(mail.to).toBe("ana@example.com");
    expect(mail.unsubscribe).toContain("/alertas/baja?t=");
    expect(mail.oneClick).toContain("/api/alertas/baja?t=");
    // La semana siguiente no repite lo que ya mandó.
    send.mockClear();
    await alerts.runAlerts({ opportunities, postings, isPaid, send, now: EVAL_NOW });
    const again = (send.mock.calls[0] as unknown as [import("@/lib/alerts").Mail] | undefined)?.[0];
    if (again) for (const line of again.text.split("\n").filter((l) => l.startsWith("•"))) expect(mail.text).not.toContain(line);
    expect((await alerts.readAlert("ana@example.com"))?.lastSentAt).toBe(EVAL_NOW.getTime());
  });

  it("sin clave de Resend no manda ni marca nada como enviado", async () => {
    const { alerts, opportunities, postings } = await setup();
    const summary = await alerts.runAlerts({ opportunities, postings, isPaid: async () => true, send: null, now: EVAL_NOW });
    expect(summary).toMatchObject({ alertas: 2, conPlan: 2, enviadas: 0, sinClave: true });
    expect((await alerts.readAlert("ana@example.com"))?.sentIds).toEqual([]);
  });

  it("la baja del mail apaga la alerta sin sesión", async () => {
    const { alerts, opportunities, postings } = await setup();
    const { POST } = await import("@/app/api/alertas/baja/route");
    const t = alerts.unsubscribeToken("ana@example.com");
    expect((await POST(new Request(`https://maru.test/api/alertas/baja?t=${t}x`, { method: "POST" }))).status).toBe(400);
    expect((await POST(new Request(`https://maru.test/api/alertas/baja?t=${encodeURIComponent(t)}`, { method: "POST" }))).status).toBe(200);
    expect((await alerts.readAlert("ana@example.com"))?.active).toBe(false);
    const summary = await alerts.runAlerts({ opportunities, postings, isPaid: async () => true, send: null, now: EVAL_NOW });
    expect(summary.alertas).toBe(1);
  });
});

describe("alertas: cron", () => {
  it("no corre sin CRON_SECRET ni con otra clave", async () => {
    await fresh();
    vi.stubEnv("MATCH_INVENTORY_PATH", "/no/existe/inventory.json");
    const { GET } = await import("@/app/api/cron/alertas/route");
    const req = (auth?: string) => new Request("https://maru.test/api/cron/alertas", { headers: auth ? { authorization: auth } : {} });
    expect((await GET(req())).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "secreto-del-cron");
    expect((await GET(req("Bearer otra"))).status).toBe(401);
    const ok = await GET(req("Bearer secreto-del-cron"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ alertas: 0, sinClave: true });
  });
});
