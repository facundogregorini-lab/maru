import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as CRON } from "@/app/api/cron/radar/route";
import { GET as AVISOS } from "@/app/api/radar/avisos/route";
import { PUT as PUT_SETTINGS } from "@/app/api/radar/ajustes/route";
import { GET as MONITOREO } from "@/app/api/radar/monitoreo/route";
import { GET as DISC, POST as DISC_POST } from "@/app/api/radar/descubrimiento/route";
import { GET as BAJA_GET, POST as BAJA_POST } from "@/app/api/radar/baja/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import type { MatchPrefs, MatchProfile } from "@/lib/match/types";
import { runRadarCron } from "@/lib/radar/cron";
import { EMPTY_PREFS } from "@/lib/radar/match/engine";
import type { JobEval } from "@/lib/radar/match/llm";
import { deliver, digestKey, unsubscribeToken, type Sender } from "@/lib/radar/notify";
import { radarRepos } from "@/lib/radar/repo";
import { digestDue, globalInterval, intervalFor, isoWeek, localParts } from "@/lib/radar/schedule";
import { follow, readSettings } from "@/lib/radar/service";
import { defaultSettings, parseSettings } from "@/lib/radar/settings";
import { applySnapshot } from "@/lib/radar/sources/ingest";
import { setRadarNet } from "@/lib/radar/sources/worker";
import type { RadarSettings } from "@/lib/radar/types";
import { userId, writeDoc } from "@/lib/sync/server";

const ANA = "ana@example.com";
const BETO = "beto@example.com";
const PROFILE: MatchProfile = { headline: "Head of Growth", titles: ["Head of Growth", "Growth Manager"], skills: ["growth"], languages: [], yearsExperience: 12, location: "", summary: "", leadership: { teamSize: 6, evidence: [] } };
const PREFS: MatchPrefs = { ...EMPTY_PREFS, seniorities: ["manager", "director", "ejecutivo"] };
const cookie = (email: string): Record<string, string> => ({ cookie: `${SESSION_COOKIE}=${createSessionToken(email)}`, "Content-Type": "application/json" });
const cronReq = (secret = "c".repeat(32), q = "") => new Request(`http://localhost/api/cron/radar${q}`, { headers: { authorization: `Bearer ${secret}` } });

beforeEach(() => {
  resetMemoryDb();
  vi.stubEnv("RADAR_ENABLED", "true");
  vi.stubEnv("RADAR_ALLOWLIST", "");
  vi.stubEnv("CRON_SECRET", "c".repeat(32));
});
afterEach(() => {
  vi.unstubAllEnvs();
  setRadarNet({});
});

/* Fuente simulada: Greenhouse "acme" con las vacantes que se pidan. */
let boardJobs: string[] = ["1"];
let calls = 0;
function fakeAcme() {
  calls = 0;
  setRadarNet({
    resolve: async () => ["93.184.216.34"],
    sleep: async () => {},
    fetchImpl: async (url) => {
      calls++;
      if (!url.startsWith("https://boards-api.greenhouse.io/v1/boards/acme/jobs")) return new Response("", { status: 404 });
      return Response.json({ jobs: boardJobs.map((id) => ({ id: Number(id), title: id === "9" ? "Senior Backend Engineer" : `Head of Growth ${id}`, absolute_url: `https://job-boards.greenhouse.io/acme/jobs/${id}`, content: "<p>Lead growth. Report to the CEO.</p>", location: { name: "Remote, Global" } })) });
    },
  });
}

async function setup(email: string, settings: Partial<RadarSettings> = {}) {
  const uid = userId(email);
  const v = await follow(uid, { create: { name: "Acme", careersUrl: "https://job-boards.greenhouse.io/acme" }, priority: "P1" });
  await radarRepos().settings.write(uid, { ...defaultSettings(), enabled: true, instantAlerts: { enabled: true, threshold: 80 }, eligibility: { authorizedCountries: ["AR"], relocation: "a_conversar", remote: "cualquiera", minMonthlyUsd: null }, ...settings });
  await writeDoc(email, "match", { profile: PROFILE, prefs: PREFS, interactions: { saved: [], discarded: [] }, external: [], updatedAt: 1 }, 0);
  return { uid, companyId: v.company.id, sourceId: v.sources[0].id };
}

/** Evalúa como si la IA respondiera (el cron usa la IA real si hay clave; en tests no hay). */
async function evalAll(uid: string, score = 90) {
  const { evaluateForUser } = await import("@/lib/radar/match/engine");
  const settings = await readSettings(uid);
  await evaluateForUser(uid, { profile: PROFILE, prefs: PREFS }, settings, {
    evaluator: async (_p, jobs) => jobs.map((j): JobEval => ({ id: j.id, competencias: { puntaje: score, evidencia: ["Growth"] }, nivel: { puntaje: 95, evidencia: [] }, salarioPublicado: null, excluyentes: [], fortalezas: [], brechas: [], desconocidos: [], razonPrincipal: "Lideraste growth.", barreraPrincipal: "", siguientePaso: "" })),
  });
}

describe("frecuencias y zona horaria", () => {
  it("la frecuencia global es la mínima entre quienes siguen la empresa; pausado no cuenta", () => {
    const s = { ...defaultSettings(), enabled: true };
    const t = { items: { "d:a.com": { companyId: "d:a.com", priority: "P2" as const, position: 1, notes: "", status: "activa" as const, tags: [], origin: "manual" as const, createdAt: "", updatedAt: "" } }, updatedAt: 0 };
    const weekly = intervalFor(s, t, "d:a.com");
    const daily = intervalFor({ ...s, frequencies: { ...s.frequencies, P2: "diaria" } }, t, "d:a.com");
    expect(globalInterval([weekly, daily, null])).toBe(daily);
    expect(intervalFor({ ...s, enabled: false }, t, "d:a.com")).toBeNull();
    expect(intervalFor({ ...s, frequencies: { ...s.frequencies, P2: "pausada" } }, t, "d:a.com")).toBeNull();
  });

  it("el resumen respeta día, hora y zona IANA, y con cron diario no se pierde la semana", () => {
    const s: RadarSettings = { ...defaultSettings(), enabled: true, timezone: "America/Argentina/Buenos_Aires", digest: { enabled: true, day: 1, time: "09:00" } };
    // Lunes 30/11/2026 11:00 UTC = 08:00 en Buenos Aires: todavía no.
    expect(digestDue(s, new Date("2026-11-30T11:00:00Z")).due).toBe(false);
    expect(digestDue(s, new Date("2026-11-30T12:30:00Z")).due).toBe(true);
    // Martes temprano (si el lunes no corrió a tiempo): sale igual, misma semana.
    expect(digestDue(s, new Date("2026-12-01T10:23:00Z"))).toEqual({ due: true, week: isoWeek("2026-11-30") });
    // En Madrid el mismo instante es otra hora local.
    expect(localParts(new Date("2026-11-30T08:30:00Z"), "Europe/Madrid").minutes).toBe(9 * 60 + 30);
    expect(digestDue({ ...s, enabled: false }, new Date("2026-11-30T12:30:00Z")).due).toBe(false);
  });

  it("guardar ajustes: cambia zona y frecuencia, guarda el email sólo con consentimiento y pausar cancela pendientes", async () => {
    const { uid } = await setup(ANA);
    const base = { ...defaultSettings(), enabled: true, timezone: "Europe/Madrid", frequencies: { P1: "semanal", P2: "mensual", P3: "pausada" }, channels: { inApp: true, email: true } };
    expect((await PUT_SETTINGS(new Request("http://localhost/api/radar/ajustes", { method: "PUT", headers: cookie(ANA), body: JSON.stringify(base) }))).status).toBe(200);
    expect(await readSettings(uid)).toMatchObject({ timezone: "Europe/Madrid", frequencies: { P1: "semanal", P3: "pausada" } });
    expect(await radarRepos().user.contact(uid)).toBe(ANA);
    // Un email pendiente y la pausa.
    await radarRepos().user.saveOutbox(uid, { items: { k: { key: "k", kind: "digest", channel: "email", status: "pending", attempts: 0, jobIds: [], createdAt: "", sentAt: null } }, updatedAt: 1 });
    await PUT_SETTINGS(new Request("http://localhost/api/radar/ajustes", { method: "PUT", headers: cookie(ANA), body: JSON.stringify({ ...base, enabled: false, channels: { inApp: true, email: false } }) }));
    expect((await radarRepos().user.outbox(uid)).items.k.status).toBe("cancelled");
    expect(await radarRepos().user.contact(uid)).toBeNull();
    expect(parseSettings({ ...base, timezone: "Nope/Nope" }).ok).toBe(false);
  });
});

describe("cron", () => {
  it("con el flag apagado es no-op; sin secreto, 401", async () => {
    vi.stubEnv("RADAR_ENABLED", "");
    fakeAcme();
    const r = await CRON(cronReq());
    expect(await r.json()).toEqual({ skipped: "flag" });
    expect(calls).toBe(0);
    expect(await runRadarCron()).toEqual({ skipped: "flag" });
    vi.stubEnv("RADAR_ENABLED", "true");
    expect((await CRON(cronReq("otro"))).status).toBe(401);
  });

  it("despacha sólo fuentes vencidas y reintentar no duplica lecturas ni avisos", async () => {
    fakeAcme();
    const { uid } = await setup(ANA);
    const now = new Date("2026-11-30T12:30:00Z");
    const first = await runRadarCron({ now, phases: ["crawl"] });
    expect(first.crawl).toMatchObject({ due: 1, sources: 1, created: 1 });
    // La fuente quedó con próxima revisión (P1 diaria): otra corrida no la vuelve a leer.
    const again = await runRadarCron({ now, phases: ["crawl"] });
    expect(again.crawl).toMatchObject({ due: 0, sources: 0 });
    expect(calls).toBe(1);

    await evalAll(uid);
    const sent: string[] = [];
    const send: Sender = async (m) => { sent.push(m.subject); return true; };
    await radarRepos().user.setContact(uid, ANA);
    await radarRepos().settings.write(uid, { ...(await readSettings(uid)), channels: { inApp: true, email: true } });
    const d1 = await runRadarCron({ now, phases: ["deliver"], send });
    const d2 = await runRadarCron({ now, phases: ["deliver"], send });
    expect(d1.deliver).toMatchObject({ alerts: 1, digests: 1, emailsSent: 2 });
    expect(d2.deliver).toMatchObject({ alerts: 0, digests: 0, emailsSent: 0 });
    expect(sent).toHaveLength(2);
    const avisos = await (await AVISOS(new Request("http://localhost/api/radar/avisos", { headers: cookie(ANA) }))).json();
    expect(avisos.items.map((n: { kind: string }) => n.kind).sort()).toEqual(["alert", "digest"]);
  });

  it("una alerta inmediata no aparece en el resumen como nueva", async () => {
    fakeAcme();
    boardJobs = ["1", "2"];
    const { uid } = await setup(ANA);
    await runRadarCron({ now: new Date("2026-11-26T12:00:00Z"), phases: ["crawl"] });
    await evalAll(uid);
    // Jueves: sale la alerta (el resumen es los lunes).
    const thu = await deliver(uid, { now: new Date("2026-11-26T12:00:00Z") });
    expect(thu).toMatchObject({ alerts: 2, digest: false });
    const mon = await deliver(uid, { now: new Date("2026-11-30T12:30:00Z") });
    expect(mon.digest).toBe(true);
    const notes = (await radarRepos().user.notifications(uid)).items;
    const digest = notes.find((n) => n.kind === "digest")!;
    expect(digest.body).toMatch(/^0 nuevas/);
    expect(digest.body).toMatch(/\(ya te avisamos\)/);
    expect((await radarRepos().user.outbox(uid)).items[`${digestKey(uid, isoWeek("2026-11-30"))}|in_app`]).toBeTruthy();
    boardJobs = ["1"];
  });

  it("no alerta lo que no encaja, lo bloqueado ni lo de P2", async () => {
    fakeAcme();
    boardJobs = ["9"];
    const { uid } = await setup(ANA);
    await runRadarCron({ now: new Date("2026-11-26T12:00:00Z"), phases: ["crawl"] });
    await evalAll(uid);
    expect((await deliver(uid, { now: new Date("2026-11-26T12:00:00Z") })).alerts).toBe(0);
    boardJobs = ["1"];
  });

  it("si falla el email, se reintenta sin duplicar el aviso in-app", async () => {
    fakeAcme();
    const { uid } = await setup(ANA, { channels: { inApp: true, email: true } });
    await radarRepos().user.setContact(uid, ANA);
    await runRadarCron({ now: new Date("2026-11-26T12:00:00Z"), phases: ["crawl"] });
    await evalAll(uid);
    let ok = false;
    const send: Sender = async () => ok;
    const r1 = await deliver(uid, { now: new Date("2026-11-26T12:00:00Z"), send });
    expect(r1).toMatchObject({ alerts: 1, emailsSent: 0, emailsFailed: 1 });
    ok = true;
    const r2 = await deliver(uid, { now: new Date("2026-11-26T13:00:00Z"), send });
    expect(r2).toMatchObject({ alerts: 0, emailsSent: 1 });
    expect((await radarRepos().user.notifications(uid)).items.filter((n) => n.kind === "alert")).toHaveLength(1);
  });

  it("una fuente caída queda con error visible en el estado del monitoreo", async () => {
    setRadarNet({ resolve: async () => ["93.184.216.34"], sleep: async () => {}, fetchImpl: async () => new Response("boom", { status: 503 }) });
    await setup(ANA);
    const r = await runRadarCron({ now: new Date("2026-11-26T12:00:00Z"), phases: ["crawl"] });
    expect(r.crawl).toMatchObject({ errors: 1 });
    const st = await (await MONITOREO(new Request("http://localhost/api/radar/monitoreo", { headers: cookie(ANA) }))).json();
    expect(st.sources).toMatchObject({ expected: 1, errors: 1, verified: 0 });
    expect(st.lastRun.items[0]).toMatchObject({ status: "error" });
  });
});

describe("baja del email", () => {
  it("el GET no cambia nada; el POST con el token firmado apaga el email", async () => {
    const { uid } = await setup(ANA, { channels: { inApp: true, email: true } });
    await radarRepos().user.setContact(uid, ANA);
    const t = unsubscribeToken(uid);
    expect((await BAJA_GET(new Request(`http://localhost/api/radar/baja?t=${encodeURIComponent(t)}`))).status).toBe(200);
    expect((await readSettings(uid)).channels.email).toBe(true);
    await BAJA_POST(new Request(`http://localhost/api/radar/baja?t=${encodeURIComponent(t)}`, { method: "POST" }));
    expect((await readSettings(uid)).channels.email).toBe(false);
    expect(await radarRepos().user.contact(uid)).toBeNull();
    const bad = await (await BAJA_POST(new Request("http://localhost/api/radar/baja?t=abc.def", { method: "POST" }))).text();
    expect(bad).toMatch(/no es válido/);
  });
});

describe("descubrimiento", () => {
  async function seedCatalog() {
    // Ana sigue empresas de IA; el catálogo tiene otras de IA (una con vacantes de su área), de Space y una que Beto sigue.
    const a = userId(ANA);
    await writeDoc(ANA, "match", { profile: PROFILE, prefs: PREFS, interactions: { saved: [], discarded: [] }, external: [], updatedAt: 1 }, 0);
    await follow(a, { create: { name: "OpenAI", domain: "openai.com", industry: "IA" }, priority: "P1" });
    const b = userId(BETO);
    const eleven = await follow(b, { create: { name: "ElevenLabs", domain: "elevenlabs.io", industry: "IA", careersUrl: "https://jobs.ashbyhq.com/elevenlabs" } });
    await follow(b, { create: { name: "Mistral", domain: "mistral.ai", industry: "IA" } });
    await follow(b, { create: { name: "PLD Space", domain: "pldspace.com", industry: "Space" } });
    const src = eleven.sources[0];
    const res = applySnapshot(null, { jobs: [{ externalId: "1", title: "Head of Growth", url: "https://jobs.ashbyhq.com/elevenlabs/1", location: "Remote", remoteType: "remoto", department: "", publishedAt: null, description: "" }], complete: true, received: 1 }, { sourceId: src.id, companyId: eleven.company.id, now: new Date() });
    await radarRepos().jobs.writeIndex(res.doc);
    await radarRepos().sources.saveMany({ [eleven.company.id]: [{ ...src, status: "success", lastSuccessAt: "2026-11-27T10:00:00.000Z", openJobs: 1 }] });
    return a;
  }

  it("sugiere del catálogo por afinidad, con señal verificada o pendiente, sin repetir seguidas ni rechazadas", async () => {
    const a = await seedCatalog();
    const g = await (await DISC(new Request("http://localhost/api/radar/descubrimiento", { headers: cookie(ANA) }))).json();
    const names = g.items.map((s: { company: { name: string } }) => s.company.name);
    expect(names).toEqual(["ElevenLabs", "Mistral"]);
    // Agregar a mano «Mistral» con un link de ATS (sin dominio) usa la del catálogo: no la duplica.
    const again = await follow(a, { create: { name: "Mistral", careersUrl: "https://jobs.ashbyhq.com/mistral" } });
    expect(again.company.id).toBe("d:mistral.ai");
    await radarRepos().targets.update(a, (d) => { delete d.items["d:mistral.ai"]; return { doc: d, result: true }; });
    expect(names).not.toContain("OpenAI");
    expect(names).not.toContain("PLD Space");
    expect(g.items[0]).toMatchObject({ pendingVerification: false, signals: [{ source: "ATS oficial (ashby)", date: "2026-11-27" }] });
    expect(g.items[0].reason).toMatch(/IA/);
    expect(g.items[1]).toMatchObject({ pendingVerification: true, signals: [] });

    const post = (body: unknown) => DISC_POST(new Request("http://localhost/api/radar/descubrimiento", { method: "POST", headers: cookie(ANA), body: JSON.stringify(body) }));
    expect((await post({ companyId: "d:mistral.ai", action: "no" })).status).toBe(200);
    expect((await post({ companyId: "d:mistral.ai", action: "no" })).status).toBe(200);
    expect((await post({ companyId: "d:elevenlabs.io", action: "P1" })).status).toBe(200);
    expect((await post({ companyId: "d:elevenlabs.io", action: "P1" })).status).toBe(200);
    const after = await (await DISC(new Request("http://localhost/api/radar/descubrimiento", { headers: cookie(ANA) }))).json();
    expect(after.items).toHaveLength(0);
    expect((await radarRepos().targets.read(a)).items["d:elevenlabs.io"]).toMatchObject({ priority: "P1" });
    const fb = await radarRepos().user.discovery(a);
    expect(Object.keys(fb.rejected)).toEqual(["d:mistral.ai"]);
    expect(fb.accepted["d:elevenlabs.io"].priority).toBe("P1");
  });
});

describe("analytics", () => {
  it("sólo deja pasar ids internos y categorías (nada de email, notas ni texto)", async () => {
    const { radarProps, scoreBand } = await import("@/lib/radar/analytics");
    expect(radarProps({ company_id: "d:acme.com", priority: "P1", email: "ana@example.com", notes: "privado", description: "texto" } as Record<string, string>)).toEqual({ source: "radar", company_id: "d:acme.com", priority: "P1" });
    expect(scoreBand(91)).toBe("85+");
    expect(scoreBand(null)).toBe("sin_evaluar");
  });
});
