import { cleanUrl, companyDomain, companyIdFor, detectProvider, fold, slugify } from "./identity";
import { analyze, planImport, type ImportPlan, type MappingOverrides } from "./importer";
import { radarRepos } from "./repo";
import { withDefaults } from "./settings";
import type { Sheet } from "./tabular";
import { PRIORITIES, type Company, type CompanySource, type ImportRun, type JobOpening, type MonitoringRun, type PilotJob, type Priority, type RadarMatch, type RadarSettings, type SourceProvider, type TargetCompany, type TargetView } from "./types";
import { runMonitoring } from "./sources/worker";
import { actionPriority } from "./match/score";

/** Operaciones de Radar. Reciben siempre el `userId` derivado de la sesión verificada. */

export class RadarError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

const RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2, null: 3 };
export const priorityRank = (p: Priority | null) => RANK[String(p)];

export function sortTargets(views: TargetView[]): TargetView[] {
  return [...views].sort(
    (a, b) =>
      priorityRank(a.target.priority) - priorityRank(b.target.priority) ||
      a.target.position - b.target.position ||
      a.company.name.localeCompare(b.company.name, "es"),
  );
}

export type Summary = { p1: number; p2: number; p3: number; unclassified: number; archived: number; total: number; sourcesWithError: number; sourcesPending: number; pilotJobs: number };

export async function listTargets(uid: string): Promise<{ items: TargetView[]; summary: Summary; lastImport: ImportRun | null }> {
  const repos = radarRepos();
  const [doc, pilot, imports] = await Promise.all([repos.targets.read(uid), repos.pilot.list(uid), repos.imports.list(uid)]);
  const ids = Object.keys(doc.items);
  const [companies, sources] = await Promise.all([repos.companies.getMany(ids), repos.sources.forCompanies(ids)]);
  const items: TargetView[] = [];
  ids.forEach((id, i) => {
    const company = companies[i];
    if (company) items.push({ target: doc.items[id], company, sources: sources[id] ?? [] });
  });
  const active = items.filter((v) => v.target.status === "activa");
  const summary: Summary = {
    p1: active.filter((v) => v.target.priority === "P1").length,
    p2: active.filter((v) => v.target.priority === "P2").length,
    p3: active.filter((v) => v.target.priority === "P3").length,
    unclassified: active.filter((v) => !v.target.priority).length,
    archived: items.length - active.length,
    total: active.length,
    sourcesWithError: active.filter((v) => v.sources.some((s) => s.status === "error")).length,
    sourcesPending: active.filter((v) => !v.sources.length || v.sources.every((s) => s.status === "pending")).length,
    pilotJobs: pilot.length,
  };
  return { items: sortTargets(items), summary, lastImport: imports[0] ?? null };
}

const nowIso = () => new Date().toISOString();

function newTarget(companyId: string, priority: Priority | null, position: number, origin: TargetCompany["origin"]): TargetCompany {
  const at = nowIso();
  return { companyId, priority, position, notes: "", status: "activa", tags: [], origin, createdAt: at, updatedAt: at };
}

const nextPosition = (items: Record<string, TargetCompany>) => Math.max(0, ...Object.values(items).map((t) => t.position)) + 1;

export type CreateCompanyInput = { name: string; domain?: string; careersUrl?: string; industry?: string; priority?: Priority | null };

const cleanText = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Sigue una empresa del catálogo o crea una nueva (identidad por dominio o provisoria). Idempotente. */
export async function follow(uid: string, input: { companyId?: string; create?: CreateCompanyInput; priority?: Priority | null }): Promise<TargetView> {
  const repos = radarRepos();
  let company: Company | null = null;
  let source: CompanySource | null = null;
  const priority = input.priority ?? input.create?.priority ?? null;
  if (priority !== null && !PRIORITIES.includes(priority)) throw new RadarError("Prioridad inválida.", "BAD_REQUEST");

  if (input.companyId) {
    [company] = await repos.companies.getMany([input.companyId]);
    if (!company) throw new RadarError("No encontramos esa empresa en el catálogo.", "NOT_FOUND", 404);
  } else if (input.create) {
    const name = cleanText(input.create.name, 120);
    if (name.length < 2) throw new RadarError("Escribí el nombre de la empresa.", "BAD_REQUEST");
    const careers = input.create.careersUrl?.trim() ? cleanUrl(input.create.careersUrl) : null;
    if (input.create.careersUrl?.trim() && !careers) throw new RadarError("El link de Careers no es válido. Tiene que empezar con https://", "BAD_REQUEST");
    const site = input.create.domain?.trim() ? cleanUrl(input.create.domain) : null;
    if (input.create.domain?.trim() && !site) throw new RadarError("El dominio no es válido (por ejemplo: empresa.com).", "BAD_REQUEST");
    const domain = (site && companyDomain(site)) || (careers && companyDomain(careers)) || null;
    const industry = cleanText(input.create.industry, 40);

    const all = await repos.companies.all();
    const existing =
      (domain && all.find((c) => c.canonicalDomain === domain)) ||
      (!domain && all.find((c) => c.id === companyIdFor(null, name))) ||
      null;
    const at = nowIso();
    company = existing ?? {
      id: companyIdFor(domain, name),
      identity: domain ? "dominio" : "provisoria",
      canonicalDomain: domain,
      domainVerified: false,
      slug: slugify(name),
      name,
      aliases: [],
      description: "",
      headquarters: "",
      stage: "",
      employeeBand: "",
      suggestedAreas: [],
      industries: [],
      region: "",
      rankings: [],
      references: [],
      metadataSource: { label: "Agregada a mano", at: at.slice(0, 10) },
      createdAt: at,
      updatedAt: at,
    };
    if (industry && !company.industries.some((x) => fold(x) === fold(industry))) company = { ...company, industries: [...company.industries, industry], updatedAt: at };
    await repos.companies.saveMany([company]);

    if (careers) {
      const current = (await repos.sources.forCompanies([company.id]))[company.id] ?? [];
      const key = careers.replace(/\/+$/, "").toLowerCase();
      if (!current.some((s) => s.careersUrl.replace(/\/+$/, "").toLowerCase() === key)) {
        const { provider, boardId } = detectProvider(careers);
        source = { id: `src_${slugify(company.id)}_${current.length + 1}`, companyId: company.id, provider, careersUrl: careers, externalBoardId: boardId, status: "pending", declaredStatus: "", lastAttemptAt: null, lastSuccessAt: null, nextDueAt: null, failureCount: 0, createdAt: at };
        await repos.sources.saveMany({ [company.id]: [...current, source] });
      }
    }
  } else throw new RadarError("Falta la empresa.", "BAD_REQUEST");

  const c = company;
  await repos.followed.add([c.id]);
  const target = await repos.targets.update(uid, (doc) => {
    const prev = doc.items[c.id];
    // Ya la seguía: se reactiva si estaba archivada; la prioridad sólo cambia si se pidió una.
    const t = prev
      ? { ...prev, status: "activa" as const, priority: priority ?? prev.priority, updatedAt: nowIso() }
      : newTarget(c.id, priority, nextPosition(doc.items), input.companyId ? "catalogo" : "manual");
    doc.items[c.id] = t;
    return { doc, result: t };
  });
  const sources = (await repos.sources.forCompanies([c.id]))[c.id] ?? [];
  return { target: target!, company: c, sources };
}

export type TargetPatch = { priority?: Priority | null; notes?: string; status?: "activa" | "archivada" };

export async function updateTarget(uid: string, companyId: string, patch: TargetPatch): Promise<TargetCompany> {
  if (patch.priority !== undefined && patch.priority !== null && !PRIORITIES.includes(patch.priority)) throw new RadarError("Prioridad inválida.", "BAD_REQUEST");
  if (patch.status !== undefined && patch.status !== "activa" && patch.status !== "archivada") throw new RadarError("Estado inválido.", "BAD_REQUEST");
  if (patch.notes !== undefined && (typeof patch.notes !== "string" || patch.notes.length > 4000)) throw new RadarError("Las notas pueden tener hasta 4.000 caracteres.", "BAD_REQUEST");
  const out = await radarRepos().targets.update(uid, (doc) => {
    const prev = doc.items[companyId];
    if (!prev) return null;
    const next: TargetCompany = { ...prev, updatedAt: nowIso() };
    if (patch.priority !== undefined && patch.priority !== prev.priority) {
      next.priority = patch.priority;
      // Al cambiar de prioridad va al final de su grupo nuevo.
      next.position = nextPosition(doc.items);
    }
    if (patch.notes !== undefined) next.notes = patch.notes;
    if (patch.status !== undefined) next.status = patch.status;
    doc.items[companyId] = next;
    return { doc, result: next };
  });
  if (!out) throw new RadarError("No seguís esa empresa.", "NOT_FOUND", 404);
  return out;
}

/** Sube o baja una empresa un lugar dentro de su prioridad (orden manual, sólo entre las activas). */
export async function moveTarget(uid: string, companyId: string, direction: "up" | "down"): Promise<boolean> {
  const repos = radarRepos();
  const doc = await repos.targets.read(uid);
  const names = Object.fromEntries((await repos.companies.getMany(Object.keys(doc.items))).filter(Boolean).map((c) => [c!.id, c!.name]));
  const out = await repos.targets.update(uid, (d) => {
    const me = d.items[companyId];
    if (!me || me.status !== "activa") return null;
    const group = Object.values(d.items)
      .filter((t) => t.status === "activa" && t.priority === me.priority)
      .sort((a, b) => a.position - b.position || (names[a.companyId] ?? "").localeCompare(names[b.companyId] ?? "", "es"));
    const i = group.findIndex((t) => t.companyId === companyId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= group.length) return { doc: d, result: false };
    // Renumera el grupo para que el orden quede explícito y cambia los dos lugares.
    [group[i], group[j]] = [group[j], group[i]];
    const base = Math.min(...group.map((t) => t.position));
    group.forEach((t, k) => (d.items[t.companyId] = { ...t, position: base + k }));
    return { doc: d, result: true };
  });
  if (out === null) throw new RadarError("No seguís esa empresa o está archivada.", "NOT_FOUND", 404);
  return out;
}

/** Deja de seguir: borra el seguimiento (prioridad y notas). No toca el catálogo ni Seguimiento. */
export async function unfollow(uid: string, companyId: string): Promise<boolean> {
  const out = await radarRepos().targets.update(uid, (doc) => {
    if (!doc.items[companyId]) return null;
    delete doc.items[companyId];
    return { doc, result: true };
  });
  return !!out;
}

export async function searchCatalog(uid: string, q: string, limit = 20): Promise<{ company: Company; following: boolean }[]> {
  const repos = radarRepos();
  const [all, doc] = await Promise.all([repos.companies.all(), repos.targets.read(uid)]);
  const query = fold(q);
  const hits = all
    .map((c) => {
      const names = [c.name, ...c.aliases].map(fold);
      const score = !query ? 1 : names.some((n) => n === query) ? 3 : names.some((n) => n.startsWith(query)) ? 2 : names.some((n) => n.includes(query)) || (c.canonicalDomain ?? "").includes(query) ? 1 : 0;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name, "es"))
    .slice(0, limit);
  return hits.map(({ c }) => ({ company: c, following: !!doc.items[c.id] }));
}

/* ---------- Importación ---------- */

export async function previewImport(uid: string, sheets: Sheet[], opts: { overrides?: MappingOverrides; industryOverride?: Record<string, string> }) {
  const repos = radarRepos();
  const analysis = analyze(sheets, opts);
  const [catalog, targets, pilot] = await Promise.all([repos.companies.all(), repos.targets.read(uid), repos.pilot.list(uid)]);
  const sources = await repos.sources.forCompanies(catalog.map((c) => c.id));
  const plan = planImport(analysis, { catalog, sources, targets, pilot });
  return { analysis, plan };
}

export async function applyImport(uid: string, fileName: string, plan: ImportPlan): Promise<ImportRun> {
  const repos = radarRepos();
  const changed = plan.companies.filter((p) => p.changed).map((p) => p.company);
  if (changed.length) await repos.companies.saveMany(changed);
  if (Object.keys(plan.sources).length) await repos.sources.saveMany(plan.sources);
  await repos.followed.add(plan.companies.map((p) => p.company.id));
  // El seguimiento se vuelve a mezclar sobre lo último guardado: si la persona editó algo mientras tanto, se respeta.
  await repos.targets.update(uid, (doc) => {
    for (const [id, t] of Object.entries(plan.targets.items)) if (!doc.items[id]) doc.items[id] = t;
    return { doc, result: true };
  });
  if (plan.pilotJobs.length) {
    const prev = await repos.pilot.list(uid);
    const byId = new Map(prev.map((j) => [j.id, j]));
    for (const j of plan.pilotJobs) byId.set(j.id, j);
    await repos.pilot.replace(uid, [...byId.values()]);
  }
  const run: ImportRun = {
    id: `imp_${Date.now().toString(36)}`,
    at: nowIso(),
    fileName: fileName.slice(0, 120),
    companiesCreated: plan.companies.filter((p) => p.isNew).length,
    companiesUpdated: plan.companies.filter((p) => !p.isNew && p.changed).length,
    targetsCreated: plan.targetsCreated,
    targetsKept: plan.targetsKept,
    pilotJobs: plan.pilotJobs.length,
    ignoredRows: plan.ignoredRows,
    errors: plan.errors.length,
  };
  await repos.imports.add(uid, run);
  return run;
}

/* ---------- Ajustes ---------- */

export async function readSettings(uid: string): Promise<RadarSettings> {
  return withDefaults(await radarRepos().settings.read(uid));
}

/* ---------- Vacantes detectadas ---------- */

const PROVIDER_RANK: Record<SourceProvider, number> = { greenhouse: 0, lever: 0, ashby: 0, jsonld: 1, careers: 2 };

/**
 * Duplicados entre fuentes de una misma empresa: misma URL canónica = misma vacante (gana la del ATS).
 * Nunca se unen dos roles distintos sólo porque se llamen igual.
 */
export function dedupeAcrossSources(jobs: JobOpening[], providers: Record<string, SourceProvider>): JobOpening[] {
  const best = new Map<string, JobOpening>();
  for (const j of jobs) {
    const k = `${j.companyId}|${j.canonicalUrl}`;
    const cur = best.get(k);
    if (!cur || PROVIDER_RANK[providers[j.sourceId] ?? "careers"] < PROVIDER_RANK[providers[cur.sourceId] ?? "careers"]) best.set(k, j);
  }
  return [...best.values()];
}

async function jobsForCompanies(companyIds: string[]) {
  const repos = radarRepos();
  const byCompany = await repos.sources.forCompanies(companyIds);
  const sources = Object.values(byCompany).flat();
  const docs = await repos.jobs.readIndexes(sources.map((s) => s.id));
  const providers = Object.fromEntries(sources.map((s) => [s.id, s.provider]));
  const all = docs.flatMap((d) => (d ? Object.values(d.jobs) : []));
  return { jobs: dedupeAcrossSources(all, providers), sources, byCompany };
}

async function assertFollows(uid: string, companyId: string) {
  const doc = await radarRepos().targets.read(uid);
  if (!doc.items[companyId]) throw new RadarError("No seguís esa empresa.", "NOT_FOUND", 404);
  return doc.items[companyId];
}

const byRecent = (a: JobOpening, b: JobOpening) => (b.publishedAt ?? b.firstSeenAt).localeCompare(a.publishedAt ?? a.firstSeenAt);

/** Ficha: vacantes activas y cerradas de una empresa seguida, con el historial de corridas de sus fuentes. */
export async function companyDetail(uid: string, companyId: string): Promise<{ open: JobOpening[]; closed: JobOpening[]; runs: MonitoringRun[] }> {
  await assertFollows(uid, companyId);
  const { jobs, sources } = await jobsForCompanies([companyId]);
  const runs = (await Promise.all(sources.map((s) => radarRepos().runs.forSource(s.id)))).flat().sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 10);
  return { open: jobs.filter((j) => j.status === "open").sort(byRecent), closed: jobs.filter((j) => j.status === "closed").sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? "")).slice(0, 30), runs };
}

export type DetectedJob = JobOpening & {
  companyName: string;
  priority: Priority | null;
  industries: string[];
  match: RadarMatch | null;
  action: { value: number; band: "alta" | "media" | "baja"; why: string[] } | null;
};

/** Oportunidades: vacantes abiertas detectadas en las empresas que sigue la persona (sin score todavía). */
export async function detectedOpportunities(uid: string): Promise<{
  jobs: DetectedJob[];
  pilot: PilotJob[];
  companies: { total: number; checked: number; lastSuccessAt: string | null };
  /** Cerradas en los últimos 30 días (para avisar si estaban en Seguimiento). */
  recentlyClosed: { id: string; title: string; companyName: string; url: string; closedAt: string | null }[];
}> {
  const repos = radarRepos();
  const doc = await repos.targets.read(uid);
  const active = Object.values(doc.items).filter((t) => t.status === "activa");
  const ids = active.map((t) => t.companyId);
  const [{ jobs, byCompany }, companies, pilot, matchDocs, settings] = await Promise.all([jobsForCompanies(ids), repos.companies.getMany(ids), repos.pilot.list(uid), repos.matches.readMany(uid, ids), readSettings(uid)]);
  const matches = new Map<string, RadarMatch>();
  for (const d of matchDocs) if (d) for (const [k, v] of Object.entries(d.items)) matches.set(k, v);
  const names = new Map(companies.filter(Boolean).map((c) => [c!.id, c!]));
  const prio = new Map(active.map((t) => [t.companyId, t.priority]));
  const checked = ids.filter((id) => (byCompany[id] ?? []).some((s) => s.lastSuccessAt)).length;
  const last = Object.values(byCompany).flat().map((s) => s.lastSuccessAt).filter(Boolean).sort().pop() ?? null;
  return {
    jobs: jobs
      .filter((j) => j.status === "open")
      .map((j) => {
        const priority = prio.get(j.companyId) ?? null;
        const m = matches.get(j.id) ?? null;
        // Un resultado sin score (sólo una marca de descarte) no se muestra como evaluado.
        const match = m && m.scoringVersion ? { ...m, rejected: m.rejected ?? null } : m ? { ...m, score: null } : null;
        const action = match && match.score !== null ? actionPriority(match, { priority, publishedAt: j.publishedAt, firstSeenAt: j.firstSeenAt, open: true, interestWeight: settings.weights.interes }) : null;
        return { ...j, companyName: names.get(j.companyId)?.name ?? "", priority, industries: names.get(j.companyId)?.industries ?? [], match, action };
      })
      .sort((a, b) => (b.action?.value ?? -1) - (a.action?.value ?? -1) || priorityRank(a.priority) - priorityRank(b.priority) || byRecent(a, b)),
    pilot,
    companies: { total: ids.length, checked, lastSuccessAt: last },
    recentlyClosed: jobs
      .filter((j) => j.status === "closed" && j.closedAt && Date.now() - Date.parse(j.closedAt) < 30 * 86_400_000)
      .map((j) => ({ id: j.id, title: j.title, companyName: names.get(j.companyId)?.name ?? "", url: j.url, closedAt: j.closedAt })),
  };
}

export const REVIEW_COOLDOWN_MS = 10 * 60_000;

/** "Revisar ahora": lee ya las fuentes de una empresa seguida. Cooldown global por empresa. */
export async function reviewNow(uid: string, companyId: string, opts: { reresolve?: boolean } = {}): Promise<MonitoringRun> {
  await assertFollows(uid, companyId);
  const sources = (await radarRepos().sources.forCompanies([companyId]))[companyId] ?? [];
  if (!sources.length) throw new RadarError("Esta empresa no tiene página de Careers. Agregala desde la ficha.", "NO_SOURCE", 409);
  if (!(await radarRepos().leases.acquire(`cooldown:${companyId}`, uid, REVIEW_COOLDOWN_MS))) {
    throw new RadarError("Se revisó hace menos de 10 minutos. Probá un poco más tarde.", "COOLDOWN", 429);
  }
  return runMonitoring({ companyIds: [companyId], trigger: "manual", budgetMs: 25_000, reresolve: opts.reresolve });
}

/** Agrega una página de Careers a una empresa seguida (la fuente queda pendiente). */
export async function addSource(uid: string, companyId: string, careersUrl: string): Promise<CompanySource> {
  await assertFollows(uid, companyId);
  const careers = cleanUrl(careersUrl);
  if (!careers || !careers.startsWith("https://")) throw new RadarError("El link tiene que empezar con https://", "BAD_REQUEST");
  const repos = radarRepos();
  const current = (await repos.sources.forCompanies([companyId]))[companyId] ?? [];
  const key = careers.replace(/\/+$/, "").toLowerCase();
  const dup = current.find((s) => s.careersUrl.replace(/\/+$/, "").toLowerCase() === key);
  if (dup) return dup;
  const { provider, boardId } = detectProvider(careers);
  const source: CompanySource = { id: `src_${slugify(companyId)}_${current.length + 1}_${Date.now().toString(36)}`, companyId, provider, careersUrl: careers, externalBoardId: boardId, status: "pending", declaredStatus: "", lastAttemptAt: null, lastSuccessAt: null, nextDueAt: null, failureCount: 0, createdAt: nowIso() };
  await repos.sources.saveMany({ [companyId]: [...current, source] });
  return source;
}

/** Vacante de una empresa seguida con su descripción (para pasarla a CV, Carta o Entrevista). */
export async function jobForHandoff(uid: string, companyId: string, jobId: string): Promise<{ job: JobOpening; description: string; company: string }> {
  await assertFollows(uid, companyId);
  const { jobs } = await jobsForCompanies([companyId]);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new RadarError("No encontramos esa vacante.", "NOT_FOUND", 404);
  const [company] = await radarRepos().companies.getMany([companyId]);
  return { job, description: (await radarRepos().jobs.readDescription(jobId)) ?? "", company: company?.name ?? "" };
}

export { assertFollows };
