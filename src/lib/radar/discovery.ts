import type { MatchState } from "../match/clientStore";
import { extract, familyFromTitle } from "../match/extract";
import { FAMILY_LABEL } from "../match/labels";
import type { RoleFamily } from "../match/types";
import { readDocsByUid } from "../sync/server";
import { fold } from "./identity";
import { radarRepos } from "./repo";
import { isoWeek, localParts } from "./schedule";
import { follow, readSettings } from "./service";
import type { Company, Priority } from "./types";

/**
 * Descubrimiento: hasta 10 empresas por semana del catálogo (incluidas las que importaron otras personas) que la
 * persona no sigue ni rechazó, por afinidad de sector con lo que ya sigue, vacantes de su área leídas de una
 * fuente oficial y su feedback. Sin rondas de inversión ni datos inventados: una señal sólo aparece si tiene
 * fuente y fecha; si no, «pendiente de verificación». La lista queda fija durante la semana.
 */

export const MAX_SUGGESTIONS = 10;
const PRIORITY_WEIGHT: Record<string, number> = { P1: 3, P2: 2, P3: 1, null: 1 };

export type Signal = { text: string; source: string; date: string };
export type Suggestion = { company: Company; reason: string; signals: Signal[]; careersUrl: string | null; pendingVerification: boolean };

export async function computeSuggestions(uid: string): Promise<{ companyId: string; score: number }[]> {
  const repos = radarRepos();
  const [catalog, targets, feedback, docs] = await Promise.all([repos.companies.all(), repos.targets.read(uid), repos.user.discovery(uid), readDocsByUid(uid)]);
  const followed = targets.items;
  const profile = ((docs.match?.data ?? null) as MatchState | null)?.profile ?? null;
  const families = new Set<RoleFamily>(profile ? [profile.headline, ...profile.titles.slice(0, 4)].filter(Boolean).map(familyFromTitle).filter((f) => f !== "otros") : []);

  // Afinidad de sector: lo que sigue (pesado por prioridad) menos lo que rechazó.
  const affinity = new Map<string, number>();
  const byId = new Map(catalog.map((c) => [c.id, c]));
  for (const t of Object.values(followed)) {
    if (t.status !== "activa") continue;
    for (const ind of byId.get(t.companyId)?.industries ?? []) affinity.set(fold(ind), (affinity.get(fold(ind)) ?? 0) + PRIORITY_WEIGHT[String(t.priority)]);
  }
  for (const id of Object.keys(feedback.rejected)) for (const ind of byId.get(id)?.industries ?? []) affinity.set(fold(ind), (affinity.get(fold(ind)) ?? 0) - 1);

  const candidates = catalog.filter((c) => !followed[c.id] && !feedback.rejected[c.id] && !feedback.accepted[c.id]);
  const sources = await repos.sources.forCompanies(candidates.map((c) => c.id));
  const roleJobs = await roleSignals(candidates.map((c) => c.id), sources, families);
  return candidates
    .map((c) => {
      const ind = c.industries.reduce((a, i) => a + Math.max(0, affinity.get(fold(i)) ?? 0), 0);
      const role = Math.min(5, roleJobs.get(c.id)?.count ?? 0);
      return { companyId: c.id, score: ind * 2 + role };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.companyId.localeCompare(b.companyId))
    .slice(0, MAX_SUGGESTIONS);
}

async function roleSignals(ids: string[], sources: Record<string, import("./types").CompanySource[]>, families: Set<RoleFamily>) {
  const out = new Map<string, { count: number; at: string; provider: string }>();
  if (!families.size) return out;
  const list = ids.flatMap((id) => (sources[id] ?? []).filter((s) => s.lastSuccessAt).map((s) => ({ id, s })));
  const docs = await radarRepos().jobs.readIndexes(list.map((x) => x.s.id));
  list.forEach(({ id, s }, i) => {
    const open = Object.values(docs[i]?.jobs ?? {}).filter((j) => j.status === "open");
    const n = open.filter((j) => families.has(extract({ title: j.title, descriptionText: "", department: j.department }).family.value)).length;
    if (n) out.set(id, { count: (out.get(id)?.count ?? 0) + n, at: s.lastSuccessAt!, provider: s.provider });
  });
  return out;
}

/** Las sugerencias de esta semana (se calculan una vez por semana ISO de la persona). */
export async function weeklySuggestions(uid: string, now = new Date()): Promise<{ week: string; items: Suggestion[] }> {
  const repos = radarRepos();
  const settings = await readSettings(uid);
  const week = isoWeek(localParts(now, settings.timezone).date);
  const doc = await repos.user.discovery(uid);
  if (doc.week !== week) {
    doc.week = week;
    doc.suggestions = (await computeSuggestions(uid)).map((x) => x.companyId);
    await repos.user.saveDiscovery(uid, doc);
  }
  const targets = (await repos.targets.read(uid)).items;
  const ids = doc.suggestions.filter((id) => !targets[id] && !doc.rejected[id] && !doc.accepted[id]);
  const [companies, sources, docs] = await Promise.all([repos.companies.getMany(ids), repos.sources.forCompanies(ids), readDocsByUid(uid)]);
  const profile = ((docs.match?.data ?? null) as MatchState | null)?.profile ?? null;
  const families = new Set<RoleFamily>(profile ? [profile.headline, ...profile.titles.slice(0, 4)].filter(Boolean).map(familyFromTitle).filter((f) => f !== "otros") : []);
  const roles = await roleSignals(ids, sources, families);
  const followedInd = new Map<string, number>();
  const all = await repos.companies.getMany(Object.keys(targets));
  for (const c of all) if (c) for (const i of c.industries) followedInd.set(fold(i), (followedInd.get(fold(i)) ?? 0) + 1);

  const items: Suggestion[] = [];
  companies.forEach((c, i) => {
    if (!c) return;
    const shared = c.industries.filter((x) => followedInd.get(fold(x)));
    const n = shared.reduce((a, x) => a + (followedInd.get(fold(x)) ?? 0), 0);
    const role = roles.get(ids[i]);
    const parts = [shared.length ? `Es de ${shared.join(" y ")}, como ${n === 1 ? "1 empresa" : `${n} empresas`} que seguís` : ""];
    if (role) parts.push(`tiene ${role.count === 1 ? "1 vacante abierta" : `${role.count} vacantes abiertas`} de ${[...families].map((f) => FAMILY_LABEL[f]).join(" o ")}`);
    const signals: Signal[] = role ? [{ text: `${role.count} ${role.count === 1 ? "vacante abierta" : "vacantes abiertas"} de tu área`, source: role.provider === "jsonld" ? "Página de Careers (JSON-LD)" : `ATS oficial (${role.provider})`, date: role.at.slice(0, 10) }] : [];
    const src = (sources[ids[i]] ?? [])[0];
    items.push({ company: c, reason: parts.filter(Boolean).join(" y ") + ".", signals, careersUrl: src?.careersUrl ?? null, pendingVerification: !signals.length });
  });
  return { week, items };
}

/** +P1, +P2 o «No me interesa». Idempotente. */
export async function discoveryFeedback(uid: string, companyId: string, action: Priority | "no", now = new Date()): Promise<void> {
  const repos = radarRepos();
  const doc = await repos.user.discovery(uid);
  if (action === "no") {
    doc.rejected[companyId] ??= now.toISOString();
    delete doc.accepted[companyId];
  } else {
    const [c] = await repos.companies.getMany([companyId]);
    if (!c) throw new Error("NOT_FOUND");
    await follow(uid, { companyId, priority: action });
    doc.accepted[companyId] = { priority: action, at: doc.accepted[companyId]?.at ?? now.toISOString() };
    delete doc.rejected[companyId];
  }
  await repos.user.saveDiscovery(uid, doc);
}
