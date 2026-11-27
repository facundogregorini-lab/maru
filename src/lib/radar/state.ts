import { fold } from "@/lib/match/text";
import { identify } from "./identity";
import { DEFAULT_SETTINGS, EMPTY_RADAR, FREQUENCIES, PRIORITIES, type DiscoveryFeedback, type MatchWeights, type Priority, type RadarSettings, type RadarState, type TargetCompany } from "./types";

/** Operaciones puras sobre el estado del Radar (las usa la UI y las prueban los tests). */

/** Normaliza lo leído del navegador o de la cuenta: nunca rompe por un documento viejo o incompleto. */
export function normalizeState(raw: unknown): RadarState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_RADAR;
  const s = raw as Partial<RadarState>;
  const companies: Record<string, TargetCompany> = {};
  for (const [id, c] of Object.entries(s.companies ?? {})) {
    if (!c || typeof c !== "object" || typeof c.name !== "string") continue;
    companies[id] = {
      ...c,
      id,
      industries: Array.isArray(c.industries) ? c.industries.filter((x) => typeof x === "string") : [],
      priority: PRIORITIES.includes(c.priority as Priority) ? c.priority : null,
      position: Number.isFinite(c.position) ? c.position : 0,
      notes: typeof c.notes === "string" ? c.notes : "",
      archived: c.archived === true,
    };
  }
  return {
    v: 1,
    companies,
    pilot: Array.isArray(s.pilot) ? s.pilot : [],
    pilotDate: typeof s.pilotDate === "string" ? s.pilotDate : undefined,
    settings: normalizeSettings(s.settings),
    feedback: s.feedback && typeof s.feedback === "object" ? s.feedback : {},
    lastSeenOpportunitiesAt: typeof s.lastSeenOpportunitiesAt === "number" ? s.lastSeenOpportunitiesAt : undefined,
    updatedAt: typeof s.updatedAt === "number" ? s.updatedAt : 0,
  };
}

export function normalizeSettings(raw: unknown): RadarSettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<RadarSettings>;
  const freq = { ...DEFAULT_SETTINGS.frequency };
  for (const p of PRIORITIES) if (FREQUENCIES.includes(s.frequency?.[p] as never)) freq[p] = s.frequency![p];
  const w = s.weights && validWeights(s.weights) ? s.weights : DEFAULT_SETTINGS.weights;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    frequency: freq,
    threshold: clamp(Number(s.threshold ?? DEFAULT_SETTINGS.threshold), 50, 100),
    digestDay: clamp(Math.round(Number(s.digestDay ?? DEFAULT_SETTINGS.digestDay)), 0, 6),
    digestTime: /^\d{2}:\d{2}$/.test(String(s.digestTime)) ? String(s.digestTime) : DEFAULT_SETTINGS.digestTime,
    timezone: validTimezone(String(s.timezone ?? "")) ? String(s.timezone) : DEFAULT_SETTINGS.timezone,
    weights: w,
    enabled: s.enabled !== false,
    instant: s.instant === true,
    digest: s.digest !== false,
    emailConsent: s.emailConsent === true,
  };
}

const clamp = (n: number, min: number, max: number) => (Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);

export function validWeights(w: Partial<MatchWeights>): w is MatchWeights {
  const vals = [w.experiencia, w.seniority, w.ubicacion, w.compensacion, w.interes];
  return vals.every((v) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100) && vals.reduce<number>((a, b) => a + (b as number), 0) === 100;
}

export function validTimezone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("es-AR", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const touch = (s: RadarState, companies: Record<string, TargetCompany>, now: number): RadarState => ({ ...s, companies, updatedAt: now });

export function setPriority(s: RadarState, id: string, priority: Priority | null, now = Date.now()): RadarState {
  const c = s.companies[id];
  if (!c || c.priority === priority) return s;
  // Al cambiar de prioridad, va al final de la nueva lista.
  const position = Math.max(0, ...Object.values(s.companies).filter((x) => x.priority === priority).map((x) => x.position)) + 1;
  return touch(s, { ...s.companies, [id]: { ...c, priority, position, updatedAt: now } }, now);
}

export function updateCompany(s: RadarState, id: string, patch: Partial<Pick<TargetCompany, "notes" | "careersUrl" | "industries" | "name" | "archived" | "hq" | "region">>, now = Date.now()): RadarState {
  const c = s.companies[id];
  if (!c) return s;
  const next = { ...c, ...patch, updatedAt: now };
  if (patch.careersUrl !== undefined) {
    const idn = identify({ name: next.name, careersUrl: patch.careersUrl, domain: c.domain });
    next.board = idn.board;
    next.domain = c.domain ?? idn.domain;
  }
  return touch(s, { ...s.companies, [id]: next }, now);
}

/** Dejar de seguir: queda archivada (no se borra, así no se pierde la relación con postulaciones). */
export const archiveCompany = (s: RadarState, id: string, archived = true, now = Date.now()) => updateCompany(s, id, { archived }, now);

/** Sube o baja una empresa dentro de su prioridad. */
export function move(s: RadarState, id: string, dir: -1 | 1, now = Date.now()): RadarState {
  const c = s.companies[id];
  if (!c) return s;
  const list = sortCompanies(Object.values(s.companies).filter((x) => !x.archived && x.priority === c.priority));
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return s;
  const other = list[j];
  const a = c.position === other.position ? other.position + dir : other.position;
  return touch(s, { ...s.companies, [id]: { ...c, position: a, updatedAt: now }, [other.id]: { ...other, position: c.position, updatedAt: now } }, now);
}

export type NewCompany = { name: string; careersUrl?: string; domain?: string; industries: string[]; priority: Priority | null; origin?: TargetCompany["origin"]; hq?: string; region?: string };

/** Agrega (o reactiva) una empresa. Si ya existía, no la duplica: devuelve la existente. */
export function addCompany(s: RadarState, input: NewCompany, now = Date.now()): { state: RadarState; id: string; existed: boolean } {
  const name = input.name.trim().slice(0, 120);
  const idn = identify({ name, careersUrl: input.careersUrl, domain: input.domain });
  const existing = Object.values(s.companies).find((c) => c.id === idn.id || (idn.domain && c.domain === idn.domain) || (idn.board && c.board === idn.board) || (!idn.domain && !idn.board && identify({ name: c.name }).nameKey === idn.nameKey));
  if (existing) {
    const revived = existing.archived ? { ...existing, archived: false, updatedAt: now } : existing;
    const merged = { ...revived, industries: [...new Set([...revived.industries, ...input.industries])] };
    const changed = JSON.stringify(merged) !== JSON.stringify(existing);
    const state = changed ? touch(s, { ...s.companies, [existing.id]: { ...merged, updatedAt: now } }, now) : s;
    return { state, id: existing.id, existed: true };
  }
  const position = Math.max(0, ...Object.values(s.companies).map((x) => x.position)) + 1;
  const c: TargetCompany = {
    id: idn.id,
    identity: idn.identity,
    name,
    domain: idn.domain,
    board: idn.board,
    careersUrl: input.careersUrl?.trim() || undefined,
    industries: [...new Set(input.industries.filter(Boolean))],
    region: input.region,
    hq: input.hq,
    priority: input.priority,
    position,
    notes: "",
    archived: false,
    origin: input.origin ?? "manual",
    createdAt: now,
    updatedAt: now,
  };
  return { state: touch(s, { ...s.companies, [c.id]: c }, now), id: c.id, existed: false };
}

export function setSettings(s: RadarState, settings: RadarSettings, now = Date.now()): RadarState {
  return { ...s, settings: normalizeSettings(settings), updatedAt: now };
}

export function setFeedback(s: RadarState, key: string, value: DiscoveryFeedback, now = Date.now()): RadarState {
  if (s.feedback[key] === value) return s;
  return { ...s, feedback: { ...s.feedback, [key]: value }, updatedAt: now };
}

const RANK: Record<string, number> = { P1: 0, P2: 1, P3: 2, null: 3 };

/** Orden: prioridad personal y después orden manual. */
export function sortCompanies(list: TargetCompany[]): TargetCompany[] {
  return [...list].sort((a, b) => RANK[String(a.priority)] - RANK[String(b.priority)] || a.position - b.position || a.name.localeCompare(b.name, "es"));
}

export type CompanyFilters = { industry: string; priority: Priority | "sin" | "todas"; region: string; q: string; archived: boolean; status?: string };

export function filterCompanies(s: RadarState, f: CompanyFilters, statusOf?: (c: TargetCompany) => string): TargetCompany[] {
  const q = fold(f.q);
  return sortCompanies(
    Object.values(s.companies).filter((c) => {
      if (c.archived !== f.archived) return false;
      if (f.industry !== "todas" && !c.industries.includes(f.industry)) return false;
      if (f.priority === "sin" ? c.priority !== null : f.priority !== "todas" && c.priority !== f.priority) return false;
      if (f.region !== "todas" && (c.region ?? "") !== f.region) return false;
      if (q && !fold(`${c.name} ${c.domain ?? ""}`).includes(q)) return false;
      if (f.status && f.status !== "todos" && statusOf && statusOf(c) !== f.status) return false;
      return true;
    }),
  );
}

export function industriesOf(s: RadarState): string[] {
  const extra = new Set<string>();
  for (const c of Object.values(s.companies)) for (const i of c.industries) extra.add(i);
  const base = ["IA", "Space", "Tech Startups"];
  return [...base, ...[...extra].filter((x) => !base.includes(x)).sort((a, b) => a.localeCompare(b, "es"))];
}

export function counts(s: RadarState) {
  const active = Object.values(s.companies).filter((c) => !c.archived);
  return {
    total: active.length,
    P1: active.filter((c) => c.priority === "P1").length,
    P2: active.filter((c) => c.priority === "P2").length,
    P3: active.filter((c) => c.priority === "P3").length,
    sin: active.filter((c) => c.priority === null).length,
    archived: Object.values(s.companies).length - active.length,
  };
}

/**
 * Junta el Radar de este navegador con el de la cuenta: unión de empresas (gana la editada más tarde),
 * del piloto y del feedback; la configuración del más reciente. Nunca se borran empresas (se archivan).
 */
export function mergeRadar(localRaw: unknown, remoteRaw: unknown): RadarState {
  const local = normalizeState(localRaw);
  const remote = normalizeState(remoteRaw);
  const [newer, older] = local.updatedAt >= remote.updatedAt ? [local, remote] : [remote, local];
  const companies: Record<string, TargetCompany> = { ...older.companies };
  for (const [id, c] of Object.entries(newer.companies)) {
    const prev = companies[id];
    if (!prev || c.updatedAt >= prev.updatedAt) companies[id] = c;
  }
  const pilot = [...newer.pilot];
  for (const p of older.pilot) if (!pilot.some((x) => x.id === p.id)) pilot.push(p);
  return {
    ...newer,
    companies,
    pilot,
    pilotDate: newer.pilotDate ?? older.pilotDate,
    feedback: { ...older.feedback, ...newer.feedback },
    lastSeenOpportunitiesAt: Math.max(newer.lastSeenOpportunitiesAt ?? 0, older.lastSeenOpportunitiesAt ?? 0) || undefined,
  };
}
