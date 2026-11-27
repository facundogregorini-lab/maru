import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as OPPS } from "@/app/api/radar/oportunidades/route";
import { POST as EVALUAR } from "@/app/api/radar/oportunidades/evaluar/route";
import { POST as DESCARTAR } from "@/app/api/radar/oportunidades/descartar/route";
import { GET as VACANTE } from "@/app/api/radar/oportunidades/vacante/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import type { MatchPrefs, MatchProfile } from "@/lib/match/types";
import { eligibilityFor } from "@/lib/radar/match/eligibility";
import { EMPTY_PREFS, evaluateForUser, precheck, setDisposition, VERSION } from "@/lib/radar/match/engine";
import type { Evaluator, JobEval } from "@/lib/radar/match/llm";
import { actionPriority, compose } from "@/lib/radar/match/score";
import { radarRepos } from "@/lib/radar/repo";
import { follow, detectedOpportunities } from "@/lib/radar/service";
import { defaultSettings } from "@/lib/radar/settings";
import { applySnapshot } from "@/lib/radar/sources/ingest";
import { trackInputFor, trackedFor } from "@/lib/radar/tracking";
import type { JobOpening, RadarEligibilityPrefs, RadarSettings } from "@/lib/radar/types";
import { writeDoc, userId } from "@/lib/sync/server";
import { setStatus, upsertInto } from "@/lib/tracker";
import type { TrackItem } from "@/lib/tracker";

/** Perfil de prueba (ficticio): sólo tests. */
const PROFILE: MatchProfile = {
  headline: "Head of Growth",
  titles: ["Head of Growth", "Marketing Director", "Growth Manager"],
  skills: ["growth", "seo", "sql", "go-to-market", "marketing digital"],
  languages: [{ language: "inglés", level: "avanzado" }],
  yearsExperience: 12,
  location: "Buenos Aires",
  summary: "Lideré equipos de growth y GTM en startups B2B.",
  leadership: { teamSize: 8, evidence: ["equipo de 8"] },
};
const PREFS: MatchPrefs = { ...EMPTY_PREFS, rolesDeseados: ["Head of Growth", "Director de Marketing"], seniorities: ["manager", "director", "ejecutivo"] };
const elig = (over: Partial<RadarEligibilityPrefs> = {}): RadarEligibilityPrefs => ({ authorizedCountries: ["AR", "EU"], relocation: "a_conversar", remote: "cualquiera", minMonthlyUsd: null, ...over });
const settings = (over: Partial<RadarEligibilityPrefs> = {}): RadarSettings => ({ ...defaultSettings(), eligibility: elig(over) });

const job = (over: Partial<JobOpening> = {}): JobOpening => ({
  id: "job_00000000000000000001", companyId: "d:acme.com", sourceId: "src_a", externalJobId: "1", url: "https://acme.com/jobs/1", canonicalUrl: "https://acme.com/jobs/1",
  title: "Head of Growth", location: "Remote, Global", remoteType: "remoto", department: "", contentHash: "h1", publishedAt: null,
  firstSeenAt: "2026-11-26T00:00:00.000Z", lastSeenAt: "2026-11-27T00:00:00.000Z", status: "open", closedAt: null, closedReason: null, missedCompleteSnapshots: 0, history: [], ...over,
});

beforeEach(() => {
  resetMemoryDb();
  vi.stubEnv("RADAR_ENABLED", "true");
  vi.stubEnv("RADAR_ALLOWLIST", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("score", () => {
  it("renormaliza sobre lo conocido y muestra la cobertura", () => {
    const w = defaultSettings().weights;
    const all = compose({ experiencia: { score: 80, evidence: [] }, seniority: { score: 100, evidence: [] }, ubicacion: { score: 100, evidence: [] }, compensacion: { score: 50, evidence: [] }, interes: { score: 100, evidence: [] } }, w, "ia");
    expect(all).toMatchObject({ score: 87, coverage: 1, confidence: "alta" });
    // Sin compensación ni seniority: se reparte sobre 70 puntos de peso.
    const part = compose({ experiencia: { score: 80, evidence: [] }, ubicacion: { score: 100, evidence: [] }, compensacion: { score: null, evidence: [] }, interes: { score: 100, evidence: [] } }, w, "ia");
    expect(part.score).toBe(Math.round((40 * 80 + 20 * 100 + 10 * 100) / 70));
    expect(part).toMatchObject({ coverage: 0.7, confidence: "media" });
    expect(part.breakdown.find((c) => c.id === "compensacion")).toMatchObject({ known: false, score: null });
    expect(compose({ interes: { score: 100, evidence: [] } }, w, "reglas")).toMatchObject({ coverage: 0.1, confidence: "baja" });
  });

  it("prioridad de acción: bloqueadas y cerradas no tienen; por verificar y poca confianza no llegan a alta", () => {
    const ctx = { priority: "P1" as const, publishedAt: null, firstSeenAt: new Date().toISOString(), open: true, interestWeight: 10 };
    expect(actionPriority({ score: 95, eligibility: "blocked", confidence: "alta" }, ctx)).toBeNull();
    expect(actionPriority({ score: 95, eligibility: "eligible", confidence: "alta", rejected: "Función distinta" }, ctx)).toBeNull();
    expect(actionPriority({ score: 95, eligibility: "eligible", confidence: "alta" }, { ...ctx, open: false })).toBeNull();
    const ok = actionPriority({ score: 95, eligibility: "eligible", confidence: "alta" }, ctx)!;
    expect(ok.band).toBe("alta");
    expect(actionPriority({ score: 95, eligibility: "needs_verification", confidence: "alta" }, ctx)!.value).toBeLessThanOrEqual(69);
    expect(actionPriority({ score: 95, eligibility: "eligible", confidence: "baja" }, ctx)!.value).toBeLessThanOrEqual(59);
    // Con más peso del interés dentro del match, la prioridad de empresa pesa menos afuera.
    const p3 = { ...ctx, priority: "P3" as const };
    const lowInterest = actionPriority({ score: 80, eligibility: "eligible", confidence: "alta" }, { ...p3, interestWeight: 0 })!.value;
    const highInterest = actionPriority({ score: 80, eligibility: "eligible", confidence: "alta" }, { ...p3, interestWeight: 20 })!.value;
    expect(highInterest).toBeGreaterThan(lowInterest);
  });
});

describe("elegibilidad (sólo lo declarado)", () => {
  const e = (j: Partial<JobOpening>, desc = "", p: Partial<RadarEligibilityPrefs> = {}) => eligibilityFor(job(j), desc, elig(p));
  it("remoto global: elegible", () => expect(e({}).status).toBe("eligible"));
  it("presencial en un país declarado: elegible", () => expect(e({ location: "Berlin, Germany", remoteType: "presencial" }).status).toBe("eligible"));
  it("presencial en EE. UU. sin permiso y sin relocalización: bloqueada", () => expect(e({ location: "San Francisco, CA", remoteType: "presencial" }, "", { relocation: "no" }).status).toBe("blocked"));
  it("mismo caso con relocalización a conversar: por verificar", () => expect(e({ location: "San Francisco, CA", remoteType: "presencial" }).status).toBe("needs_verification"));
  it("sin países declarados: por verificar (nunca se infiere)", () => expect(e({ location: "London, UK", remoteType: "presencial" }, "", { authorizedCountries: [] }).status).toBe("needs_verification"));
  it("exige ciudadanía o clearance: bloqueada", () => expect(e({}, "Applicants must be a U.S. citizen with an active security clearance.").status).toBe("blocked"));
  it("pide permiso de trabajo explícito en un país no declarado: bloqueada", () => expect(e({ location: "Remote" }, "You must be authorized to work in the United States.").status).toBe("blocked"));
  it("remoto restringido a un país no declarado: por verificar", () => expect(e({ location: "Remote - US" }).status).toBe("needs_verification"));
  it("sólo remoto y el aviso es presencial: bloqueada", () => expect(e({ location: "Madrid, Spain", remoteType: "presencial" }, "", { remote: "solo_remoto" }).status).toBe("blocked"));
  it("ubicación desconocida: por verificar", () => expect(e({ location: "Remote" }).status).toBe("needs_verification"));
});

describe("preclasificación", () => {
  it("función distinta o bloqueo: no se manda a la IA", () => {
    const eng = precheck(job({ title: "Senior Software Engineer, Backend" }), "Build APIs in Go.", PROFILE, PREFS, settings(), "P1");
    expect(eng.reject).toMatch(/Función distinta/);
    const blocked = precheck(job({ location: "New York, NY", remoteType: "presencial" }), "", PROFILE, PREFS, settings({ relocation: "no" }), "P1");
    expect(blocked.reject).toMatch(/Estados Unidos/);
    const good = precheck(job(), "Lead our growth team. Report to the CEO.", PROFILE, PREFS, settings(), "P1");
    expect(good.reject).toBeNull();
  });
});

/* ---------- Motor ---------- */

const ANA = "ana@example.com";
const BETO = "beto@example.com";

const evalFor = (id: string, score = 85): JobEval => ({
  id, competencias: { puntaje: score, evidencia: ["Lideró growth B2B"] }, nivel: { puntaje: 90, evidencia: ["Head"] }, salarioPublicado: null,
  excluyentes: [{ requisito: "Inglés avanzado", estado: "cumple" }], fortalezas: ["Growth B2B"], brechas: ["Sin PLG"], desconocidos: ["Salario"],
  razonPrincipal: "Lideraste growth B2B con equipo de 8.", barreraPrincipal: "", siguientePaso: "Adaptá tu CV al aviso.",
});

async function seed(email: string, jobs: { id: string; title: string; location?: string; remote?: JobOpening["remoteType"]; desc?: string }[]) {
  const uid = userId(email);
  const v = await follow(uid, { create: { name: "Acme", careersUrl: "https://job-boards.greenhouse.io/acme" }, priority: "P1" });
  const src = v.sources[0];
  const res = applySnapshot(null, { jobs: jobs.map((j) => ({ externalId: j.id, title: j.title, url: `https://acme.com/jobs/${j.id}`, location: j.location ?? "Remote, Global", remoteType: j.remote ?? "remoto", department: "", publishedAt: null, description: j.desc ?? "Lead growth. Report to the CEO." })), complete: true, received: jobs.length }, { sourceId: src.id, companyId: v.company.id, now: new Date() });
  await radarRepos().jobs.writeIndex(res.doc);
  await radarRepos().jobs.writeDescriptions(res.changedDescriptions);
  return { uid, companyId: v.company.id, sourceId: src.id, index: res.doc };
}

function counting(fn: (ids: string[]) => JobEval[]): Evaluator & { calls: number; seen: string[] } {
  const e = (async (_p: string, jobs: { id: string }[]) => {
    e.calls++;
    e.seen.push(...jobs.map((j) => j.id));
    return fn(jobs.map((j) => j.id));
  }) as unknown as Evaluator & { calls: number; seen: string[] };
  e.calls = 0;
  e.seen = [];
  return e;
}

describe("motor de evaluación", () => {
  it("evalúa con IA sólo lo que pasa las reglas y no recalcula si no cambian los hashes", async () => {
    const { uid } = await seed(ANA, [{ id: "1", title: "Head of Growth" }, { id: "2", title: "Senior Backend Engineer", desc: "Go and Kubernetes." }, { id: "3", title: "Director of Marketing" }]);
    const ev = counting((ids) => ids.map((id) => evalFor(id)));
    const r1 = await evaluateForUser(uid, { profile: PROFILE, prefs: PREFS }, settings(), { evaluator: ev });
    expect(r1).toMatchObject({ total: 3, rules: 1, ia: 2 });
    expect(ev.seen).toHaveLength(2);
    const r2 = await evaluateForUser(uid, { profile: PROFILE, prefs: PREFS }, settings(), { evaluator: ev });
    expect(r2).toMatchObject({ unchanged: 3, ia: 0, rules: 0 });
    expect(ev.calls).toBe(1);
    // Cambia el perfil: se re-evalúa.
    const r3 = await evaluateForUser(uid, { profile: { ...PROFILE, skills: [...PROFILE.skills, "plg"] }, prefs: PREFS }, settings(), { evaluator: ev });
    expect(r3.ia).toBe(2);
    const opps = await detectedOpportunities(uid);
    const top = opps.jobs[0];
    expect(top.match).toMatchObject({ method: "ia", scoringVersion: VERSION, eligibility: "eligible" });
    expect(top.match!.breakdown.map((c) => c.id)).toEqual(["experiencia", "seniority", "ubicacion", "compensacion", "interes"]);
    expect(top.action?.why.length).toBeGreaterThan(0);
    const eng = opps.jobs.find((j) => j.title.includes("Backend"))!;
    expect(eng.match).toMatchObject({ method: "reglas", rejected: expect.stringMatching(/Función distinta/) });
    // No encaja: puntaje bajo, sin prioridad de acción y al final de la lista.
    expect(eng.match!.score).toBeLessThanOrEqual(30);
    expect(eng.action).toBeNull();
    expect(opps.jobs[opps.jobs.length - 1].id).toBe(eng.id);
  });

  it("si la IA falla, conserva el anterior como desactualizado; sin anterior, queda sin evaluar", async () => {
    const { uid } = await seed(ANA, [{ id: "1", title: "Head of Growth" }]);
    await evaluateForUser(uid, { profile: PROFILE, prefs: PREFS }, settings(), { evaluator: counting((ids) => ids.map((id) => evalFor(id, 70))) });
    const boom: Evaluator = async () => { throw new Error("caído"); };
    const r = await evaluateForUser(uid, { profile: { ...PROFILE, headline: "CMO" }, prefs: PREFS }, settings(), { evaluator: boom });
    expect(r).toMatchObject({ failed: 1, staleKept: 1 });
    const m = (await detectedOpportunities(uid)).jobs[0].match!;
    expect(m).toMatchObject({ stale: true, score: expect.any(Number) });

    const { uid: b } = await seed(BETO, [{ id: "1", title: "Head of Growth" }]);
    await evaluateForUser(b, { profile: PROFILE, prefs: PREFS }, settings(), { evaluator: boom });
    expect((await detectedOpportunities(b)).jobs[0].match).toBeNull();
  });

  it("sin IA configurada: sólo reglas y el resto queda pendiente", async () => {
    const { uid } = await seed(ANA, [{ id: "1", title: "Head of Growth" }]);
    const r = await evaluateForUser(uid, { profile: PROFILE, prefs: PREFS }, settings(), {});
    expect(r).toMatchObject({ ia: 0, pendingIa: 1 });
  });

  it("cupo diario de evaluaciones con IA", async () => {
    const { uid } = await seed(ANA, [{ id: "1", title: "Head of Growth" }, { id: "2", title: "VP Growth" }, { id: "3", title: "Head of Marketing" }]);
    const ev = counting((ids) => ids.map((id) => evalFor(id)));
    const r = await evaluateForUser(uid, { profile: PROFILE, prefs: PREFS }, settings(), { evaluator: ev, dailyLimit: 2 });
    expect(r).toMatchObject({ ia: 2, pendingIa: 1, quotaLeft: 0 });
  });

  it("aislamiento: los matches y descartes son de cada persona", async () => {
    const a = await seed(ANA, [{ id: "1", title: "Head of Growth" }]);
    await evaluateForUser(a.uid, { profile: PROFILE, prefs: PREFS }, settings(), { evaluator: counting((ids) => ids.map((id) => evalFor(id))) });
    const bUid = userId(BETO);
    await follow(bUid, { companyId: a.companyId, priority: "P2" });
    const b = await detectedOpportunities(bUid);
    expect(b.jobs).toHaveLength(1);
    expect(b.jobs[0].match).toBeNull();
    await setDisposition(a.uid, a.companyId, Object.keys(a.index.jobs)[0], "dismissed");
    expect((await detectedOpportunities(a.uid)).jobs[0].match?.disposition).toBe("dismissed");
    expect((await detectedOpportunities(bUid)).jobs[0].match).toBeNull();
    // Descartar no borra la vacante global.
    expect(Object.keys((await radarRepos().jobs.readIndexes([a.sourceId]))[0]!.jobs)).toHaveLength(1);
  });

  it("descartar se conserva al re-evaluar", async () => {
    const a = await seed(ANA, [{ id: "1", title: "Head of Growth" }]);
    const jid = Object.keys(a.index.jobs)[0];
    await setDisposition(a.uid, a.companyId, jid, "dismissed");
    await evaluateForUser(a.uid, { profile: PROFILE, prefs: PREFS }, settings(), { evaluator: counting((ids) => ids.map((id) => evalFor(id))) });
    expect((await detectedOpportunities(a.uid)).jobs[0].match).toMatchObject({ disposition: "dismissed", method: "ia" });
  });

  it("las vacantes del piloto nunca aparecen con score como actuales", async () => {
    const a = await seed(ANA, [{ id: "1", title: "Head of Growth" }]);
    await radarRepos().pilot.replace(a.uid, [{ id: "pil_1", companyId: a.companyId, company: "Acme", title: "Head of Growth", location: "", priority: "P1", editorialScore: 94, fsgp: "", reasons: "", barriers: "", url: "", evidence: "", date: "2026-11-25", action: "", industry: "IA", importedAt: "2026-11-27T00:00:00.000Z" }]);
    await evaluateForUser(a.uid, { profile: PROFILE, prefs: PREFS }, settings(), { evaluator: counting((ids) => ids.map((id) => evalFor(id, 60))) });
    const o = await detectedOpportunities(a.uid);
    expect(o.jobs.every((j) => !j.id.startsWith("pil_"))).toBe(true);
    expect(o.jobs[0].match?.score).not.toBe(94);
    expect(o.pilot[0]).not.toHaveProperty("match");
  });
});

describe("Seguimiento", () => {
  it("guardar dos veces deja una sola tarjeta, en Guardada, y el cambio de estado se refleja", () => {
    const ref = { url: "https://jobs.ashbyhq.com/acme/123?utm_source=radar", title: "Head of Growth", companyName: "Acme" };
    let items: TrackItem[] = [];
    items = upsertInto(items, trackInputFor(ref))!.items;
    items = upsertInto(items, trackInputFor({ ...ref, url: "https://jobs.ashbyhq.com/acme/123" }))!.items;
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("guardada");
    // La persona lo mueve en Seguimiento: Radar lo lee de ahí.
    items = [{ ...items[0], status: "postulada" }];
    expect(trackedFor(items, ref)?.status).toBe("postulada");
    // Guardar de nuevo desde Radar no lo hace retroceder.
    items = upsertInto(items, trackInputFor(ref))!.items;
    expect(items[0].status).toBe("postulada");
    expect(typeof setStatus).toBe("function");
  });

  it("no hay autopostulación: guardar nunca pide «postulada»", () => {
    expect(trackInputFor({ url: "https://x.com/1", title: "a", companyName: "b" }).status).toBe("guardada");
  });
});

describe("rutas", () => {
  const cookie = (email: string): Record<string, string> => ({ cookie: `${SESSION_COOKIE}=${createSessionToken(email)}`, "Content-Type": "application/json" });
  it("evaluar sin perfil en Match: 409 con un mensaje claro", async () => {
    await seed(ANA, [{ id: "1", title: "Head of Growth" }]);
    const r = await EVALUAR(new Request("http://localhost/api/radar/oportunidades/evaluar", { method: "POST", headers: cookie(ANA) }));
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("NO_PROFILE");
  });

  it("evaluar con el perfil sincronizado; descartar y vacante sólo para quien la sigue", async () => {
    const a = await seed(ANA, [{ id: "1", title: "Head of Growth" }]);
    await writeDoc(ANA, "match", { profile: PROFILE, prefs: PREFS, interactions: { saved: [], discarded: [] }, external: [], updatedAt: 1 }, 0);
    const r = await EVALUAR(new Request("http://localhost/api/radar/oportunidades/evaluar", { method: "POST", headers: cookie(ANA) }));
    expect(r.status).toBe(200);
    expect((await r.json()).result.total).toBe(1);
    const jid = Object.keys(a.index.jobs)[0];
    const q = `?companyId=${encodeURIComponent(a.companyId)}&jobId=${jid}`;
    expect((await VACANTE(new Request(`http://localhost/api/radar/oportunidades/vacante${q}`, { headers: cookie(ANA) }))).status).toBe(200);
    expect((await VACANTE(new Request(`http://localhost/api/radar/oportunidades/vacante${q}`, { headers: cookie(BETO) }))).status).toBe(404);
    const d = (who: string) => DESCARTAR(new Request("http://localhost/api/radar/oportunidades/descartar", { method: "POST", headers: cookie(who), body: JSON.stringify({ companyId: a.companyId, jobId: jid }) }));
    expect((await d(BETO)).status).toBe(404);
    expect((await d(ANA)).status).toBe(200);
    const o = await (await OPPS(new Request("http://localhost/api/radar/oportunidades", { headers: cookie(ANA) }))).json();
    expect(o.jobs[0].match.disposition).toBe("dismissed");
  });
});
