import { cleanUrl, companyDomain, companyIdFor, detectProvider, fold, slugify } from "./identity";
import { analyze, planImport, type ImportPlan, type MappingOverrides } from "./importer";
import { radarRepos } from "./repo";
import { defaultSettings } from "./settings";
import type { Sheet } from "./tabular";
import { PRIORITIES, type Company, type CompanySource, type ImportRun, type Priority, type RadarSettings, type TargetCompany, type TargetView } from "./types";

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
    sourcesPending: active.filter((v) => !v.sources.length || v.sources.every((s) => s.status === "pendiente")).length,
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
        source = { id: `src_${slugify(company.id)}_${current.length + 1}`, companyId: company.id, provider, careersUrl: careers, externalBoardId: boardId, status: "pendiente", declaredStatus: "", lastAttemptAt: null, lastSuccessAt: null, nextDueAt: null, failureCount: 0, createdAt: at };
        await repos.sources.saveMany({ [company.id]: [...current, source] });
      }
    }
  } else throw new RadarError("Falta la empresa.", "BAD_REQUEST");

  const c = company;
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
  return (await radarRepos().settings.read(uid)) ?? defaultSettings();
}
