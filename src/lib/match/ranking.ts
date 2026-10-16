import { familyFromTitle, findSkills } from "./extract";
import { estimateSeniority } from "./profile";
import { sourceById } from "./sources";
import { CONTRACT_LABEL, FAMILY_LABEL, SENIORITY_LABEL } from "./labels";
import { fold, sanitizeDisplay, tokens } from "./text";
import {
  SENIORITY_ORDER,
  type EmploymentType,
  type Interactions,
  type MatchPrefs,
  type MatchProfile,
  type Opportunity,
  type RoleFamily,
  type Salary,
  type Seniority,
  type StoredPosting,
  type Workplace,
} from "./types";

/**
 * Ranking explicable, sin IA y sin credenciales nuevas.
 *
 * 1. Incompatibilidades explícitas primero (elegibilidad, "evitar", descartes e indispensables).
 * 2. Recuperación por texto con equivalencias español/inglés.
 * 3. Puntaje = 40% habilidades y experiencia + 35% intención profesional
 *    + 15% seniority + 10% preferencias adicionales (configurable con MATCH_WEIGHTS="40,35,15,10").
 *    Si la persona declaró roles u objetivo, además el total se multiplica por (1 − 0,4 × (1 − intención)).
 * Los datos faltantes bajan la CONFIANZA, no se convierten en coincidencias ni en incumplimientos.
 * El puntaje es una "compatibilidad estimada", nunca una probabilidad de contratación.
 */

/** Cuánto modula la intención declarada el total (0 = nada, 1 = todo). */
export const INTENT_GATE = 0.4;

export type Weights = { habilidades: number; intencion: number; seniority: number; extras: number };
export const DEFAULT_WEIGHTS: Weights = { habilidades: 0.4, intencion: 0.35, seniority: 0.15, extras: 0.1 };

export function weightsFromEnv(raw = process.env.MATCH_WEIGHTS): Weights {
  const n = (raw ?? "").split(",").map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x) || x < 0)) return DEFAULT_WEIGHTS;
  const sum = n.reduce((a, b) => a + b, 0) || 1;
  return { habilidades: n[0] / sum, intencion: n[1] / sum, seniority: n[2] / sum, extras: n[3] / sum };
}

/* ---------- equivalencias es/en ---------- */

const EQUIV: string[][] = [
  ["desarrollador", "developer", "programador", "engineer", "ingeniero", "dev"],
  ["gerente", "manager", "jefe"],
  ["analista", "analyst"],
  ["ventas", "sales", "comercial", "vendedor"],
  ["ejecutivo", "executive"],
  ["cuentas", "account", "accounts"],
  ["cliente", "clientes", "customer", "client"],
  ["atencion", "support", "service", "soporte"],
  ["exito", "success"],
  ["mercadeo", "marketing"],
  ["producto", "product"],
  ["disenador", "designer", "diseno", "design"],
  ["datos", "data"],
  ["operaciones", "operations", "ops"],
  ["finanzas", "finance", "financiero", "financial"],
  ["contador", "accountant", "contable", "accounting"],
  ["recursos", "human", "people", "rrhh", "hr"],
  ["reclutador", "recruiter", "recruiting", "talent", "seleccion"],
  ["logistica", "logistics", "supply"],
  ["crecimiento", "growth"],
  ["lider", "lead", "leader"],
  ["director", "head"],
  ["asistente", "assistant"],
  ["administrativo", "administrative", "admin"],
  ["proyectos", "proyecto", "project", "projects"],
  ["negocios", "business"],
  ["desarrollo", "development"],
  ["calidad", "quality", "qa"],
  ["contenido", "content", "contenidos"],
  ["redes", "social"],
  ["comunicacion", "communications", "communication"],
  ["estrategia", "strategy", "strategic"],
  ["especialista", "specialist"],
  ["coordinador", "coordinator"],
  ["consultor", "consultant"],
  ["abogado", "lawyer", "counsel", "legal"],
  ["compras", "procurement", "purchasing"],
  ["pagos", "payments"],
  ["adquisicion", "acquisition"],
  ["retencion", "retention", "lifecycle"],
  ["internacional", "international", "global"],
  ["digital", "digital"],
  ["ecommerce", "e-commerce", "comercio"],
  ["docente", "teacher", "profesor", "tutor"],
  ["enfermero", "nurse", "enfermera"],
];
const EQ = new Map<string, string>();
for (const group of EQUIV) for (const w of group) EQ.set(w, group[0]);

const canon = (t: string) => EQ.get(t) ?? t.replace(/s$/, "");
const SEN_WORDS = new Set(["senior", "sr", "sr.", "junior", "jr", "jr.", "ssr", "semi", "mid", "trainee", "ii", "iii", "i"]);

export function roleTokens(s: string): Set<string> {
  return new Set(tokens(s).filter((t) => !SEN_WORDS.has(t)).map(canon));
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/* ---------- helpers ---------- */

const SKILL_ALIAS = (s: string) => {
  const found = findSkills(s);
  return found.length ? found : [fold(s)];
};

function profileSkillSet(m: MatchProfile): Set<string> {
  return new Set(m.skills.flatMap(SKILL_ALIAS));
}

const LANG_EN: Record<string, string> = { ingles: "inglés", english: "inglés", portugues: "portugués", portuguese: "portugués", espanol: "español", spanish: "español", italiano: "italiano", italian: "italiano", frances: "francés", french: "francés", aleman: "alemán", german: "alemán" };
const normLang = (l: string) => LANG_EN[fold(l).split(" ")[0]] ?? fold(l);
const HIGH = /(native|nativo|bilingual|bilingue|fluent|fluido|advanced|avanzado|c1|c2|proficient|full professional|profesional completo)/;
const MID = /(intermediate|intermedio|b1|b2|conversational|conversacional|limited working|profesional limitado|upper)/;
const langRank = (level: string) => (HIGH.test(fold(level)) ? 3 : MID.test(fold(level)) ? 2 : level.trim() ? 1 : 0);

const PERIOD_FACTOR: Record<Salary["period"], number | null> = { mes: 1, anio: 1 / 12, hora: null, desconocido: null };

/** Máximo publicado expresado por mes en la moneda del aviso; null si no es comparable. */
function monthlyMax(s: Salary): number | null {
  const f = PERIOD_FACTOR[s.period];
  const v = s.max ?? s.min;
  return f && v ? v * f : null;
}

export function formatSalary(s: Salary | undefined | null): string | null {
  if (!s) return null;
  if (s.min || s.max) {
    const fmt = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
    const range = s.min && s.max && s.min !== s.max ? `${fmt(s.min)} – ${fmt(s.max)}` : fmt((s.max ?? s.min)!);
    const per = s.period === "mes" ? " por mes" : s.period === "anio" ? " por año" : s.period === "hora" ? " por hora" : "";
    return `${s.currency ? `${s.currency} ` : ""}${range}${per}`.trim();
  }
  return s.text ? sanitizeDisplay(s.text, 120) : null;
}

const WORKPLACE_LABEL: Record<Workplace, string> = { remoto: "remoto", hibrido: "híbrido", presencial: "presencial", desconocido: "sin modalidad informada" };

/** `word` aparece en `text` como palabra completa. Es texto libre de la persona: nunca lo compilamos como regex. */
function containsWord(text: string, word: string): boolean {
  if (!word) return false;
  const isWordChar = (c: string | undefined) => !!c && /[a-z0-9]/.test(c);
  for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + 1)) {
    if (!isWordChar(text[i - 1]) && !isWordChar(text[i + word.length])) return true;
  }
  return false;
}

const COUNTRY_WORDS: Record<string, string[]> = {
  espana: ["spain", "espana", "europe", "eu", "emea"],
  italia: ["italy", "europe", "eu", "emea"],
  "union europea": ["europe", "eu", "emea"],
  ue: ["europe", "eu", "emea"],
  europa: ["europe", "eu", "emea"],
  "estados unidos": ["us", "usa", "united states", "u.s."],
  eeuu: ["us", "usa", "united states", "u.s."],
  brasil: ["brazil", "brasil"],
  mexico: ["mexico"],
  chile: ["chile"],
  uruguay: ["uruguay"],
  canada: ["canada"],
  "reino unido": ["uk", "united kingdom", "england"],
};

/* ---------- resultado ---------- */

export type SourceLink = { name: string; url: string; applyUrl: string; attribution?: string; required: boolean; kind: "ats" | "portal" | "usuario" };

export type RankedItem = {
  id: string;
  title: string;
  company: string;
  locations: string[];
  workplace: Workplace;
  workplaceLabel: string;
  eligibility: Opportunity["eligibility"];
  family: RoleFamily;
  seniority: Seniority | null;
  employmentType: EmploymentType | null;
  score: number; // 0-100, "compatibilidad estimada"
  confidence: "alta" | "media" | "baja";
  depth: "reglas"; // ranking básico; la evaluación detallada con IA se hace al preparar la postulación
  reasons: string[];
  gaps: string[];
  pending: string[];
  salary: string | null;
  sources: SourceLink[];
  reviewedAt: string;
  reviewedLabel: string;
  publishedAt: string | null;
  /** Antigüedad relativa de la fuente cuando no hay fecha exacta (Google Jobs). */
  postedLabel?: string;
  logo?: string;
  excerpt: string;
  descriptionComplete: boolean;
  status: "abierta" | "cerrada";
  external?: boolean;
  saved?: boolean;
};

export type Filters = {
  families?: RoleFamily[];
  location?: string;
  workplaces?: Workplace[];
  seniorities?: Seniority[];
  language?: "sin_ingles" | "con_ingles";
  maxAgeDays?: number;
  salaryPublished?: boolean;
};

export type RankInput = {
  opportunities: Opportunity[];
  postings: Map<string, StoredPosting>;
  profile: MatchProfile;
  prefs: MatchPrefs;
  interactions: Interactions;
  filters?: Filters;
  weights?: Weights;
  limit?: number;
  now?: Date;
};

export type RankOutput = {
  eligible: RankedItem[];
  pending: RankedItem[];
  saved: RankedItem[];
  counts: { open: number; eligible: number; pending: number; afterHardFilters: number; shown: number };
};

type Scored = { item: RankedItem; raw: number };

export function rankOpportunities(input: RankInput): RankOutput {
  const { profile, prefs, interactions, postings } = input;
  const w = input.weights ?? DEFAULT_WEIGHTS;
  const now = input.now ?? new Date();
  const limit = input.limit ?? 40;
  const f = input.filters ?? {};

  const pSkills = profileSkillSet(profile);
  const pLangs = new Map(profile.languages.map((l) => [normLang(l.language), l.level]));
  const desired = [...prefs.rolesDeseados, prefs.objetivo].filter((s) => s.trim());
  const desiredTokens = prefs.rolesDeseados.map((r) => ({ label: r, toks: roleTokens(r) })).filter((r) => r.toks.size);
  const objetivoTokens = roleTokens(prefs.objetivo);
  const desiredFamilies = new Set<RoleFamily>(desired.map(familyFromTitle).filter((x) => x !== "otros"));
  const pastTitles = profile.titles.slice(0, 3).map((t) => ({ label: t, toks: roleTokens(t) }));
  const pastFamilies = new Set<RoleFamily>(profile.titles.slice(0, 3).map(familyFromTitle).filter((x) => x !== "otros"));
  const avoid = prefs.evitar.map((e) => fold(e)).filter((e) => e.length > 2);
  const targetSen = prefs.seniorities.length ? prefs.seniorities : [estimateSeniority(profile)].filter(Boolean) as Seniority[];
  const hard = new Set(prefs.indispensables);
  const savedIds = new Set(interactions.saved);
  const discarded = new Map(interactions.discarded.map((d) => [d.id, d]));
  const blockedCompanies = new Set(interactions.discarded.filter((d) => d.reason === "empresa" && d.company).map((d) => fold(d.company!)));
  const userPlaces = [prefs.ciudad, ...prefs.otrosLugares].map(fold).filter(Boolean);
  const userCountryWords = prefs.autorizacion.flatMap((a) => COUNTRY_WORDS[fold(a)] ?? [fold(a)]);
  const placeMatches = (locs: string[]) => {
    const l = fold(locs.join(" | "));
    return userPlaces.some((p) => l.includes(p) || (/(buenos aires|caba|capital federal)/.test(p) && /(buenos aires|caba|capital federal)/.test(l)));
  };

  let open = 0;
  let afterHard = 0;
  const elig: Scored[] = [];
  const pend: Scored[] = [];
  const savedOut: Scored[] = [];

  for (const o of input.opportunities) {
    const isSaved = savedIds.has(o.id);
    if (o.status !== "abierta" && !isSaved) continue;
    if (o.status === "abierta") open++;
    if (discarded.has(o.id)) continue;
    if (blockedCompanies.has(fold(o.company))) continue;

    const primary = postings.get(o.primaryKey);
    const titleF = fold(o.title);
    const pending: string[] = [];
    const gaps: string[] = [];
    const reasonsScored: [number, string][] = [];

    // --- 1. Incompatibilidades explícitas ---
    let bucket: "eligible" | "pending" = "eligible";
    if (o.eligibility.status === "no_elegible") {
      const ev = fold(o.eligibility.evidence.join(" "));
      const authMatch = userCountryWords.find((w) => containsWord(ev, w));
      const relocation = o.workplace.value !== "remoto" && placeMatches(o.locations);
      if (authMatch) {
        bucket = "pending";
        pending.push(`Está limitado a ${o.eligibility.evidence[0].replace(/^.*?:\s*/, "")}. Declaraste poder trabajar ahí: confirmá si aceptan tu residencia.`);
      } else if (relocation) {
        bucket = "pending";
        pending.push(`Es en ${o.locations.join(", ")}, un lugar que aceptarías. Confirmá los requisitos para trabajar ahí (no los asumimos).`);
      } else if (!isSaved) continue;
    } else if (o.eligibility.status === "por_confirmar") {
      bucket = "pending";
      pending.push(...o.eligibility.evidence.slice(0, 2));
    }
    const avoidHit = avoid.find((a) => titleF.includes(a));
    if (avoidHit && !isSaved) continue;

    const ex = o.extracted;
    const wpValue = o.workplace.value;
    let excludedByHard = false;
    const hardCheck = (key: (typeof prefs.indispensables)[number], known: boolean, ok: boolean, unknownNote: string) => {
      if (!hard.has(key)) return;
      if (!known) pending.push(unknownNote);
      else if (!ok) excludedByHard = true;
    };
    hardCheck("modalidad", wpValue !== "desconocido", prefs.modalidades.includes(wpValue), "No informa la modalidad (remoto, híbrido o presencial).");
    if (wpValue !== "remoto") {
      hardCheck("ubicacion", o.locations.length > 0 && wpValue !== "desconocido" && userPlaces.length > 0, placeMatches(o.locations), "No queda claro dónde hay que trabajar.");
    }
    hardCheck("seniority", !!ex.seniority, !!ex.seniority && (!prefs.seniorities.length || prefs.seniorities.includes(ex.seniority.value)), "No informa el nivel de seniority.");
    hardCheck("contrato", !!ex.employmentType, !!ex.employmentType && (!prefs.contratos.length || prefs.contratos.includes(ex.employmentType.value)), "No informa el tipo de contratación.");
    // Idiomas: sólo juzgamos los que la persona declaró. Si no lo declaró, queda "por confirmar", no "no cumple".
    const reqLangs = ex.languages.filter((l) => l.required && l.language !== "español");
    const needLevel = (level: string) => (HIGH.test(fold(level)) ? 3 : MID.test(fold(level)) ? 2 : 1);
    hardCheck(
      "idioma",
      reqLangs.every((l) => pLangs.has(normLang(l.language))),
      reqLangs.every((l) => langRank(pLangs.get(normLang(l.language)) ?? "") >= needLevel(l.level)),
      `Pide ${reqLangs.map((l) => l.language).join(" y ")}: confirmá tu nivel.`,
    );
    let salaryOk: boolean | null = null;
    const sal = o.salary?.value;
    if (prefs.salario?.monto && sal) {
      const theirs = monthlyMax(sal);
      const mine = prefs.salario.periodo === "anio" ? prefs.salario.monto / 12 : prefs.salario.monto;
      if (theirs !== null && sal.currency === prefs.salario.moneda) salaryOk = theirs >= mine;
    }
    hardCheck("salario", salaryOk !== null, salaryOk === true, "No informa salario comparable con tu expectativa.");
    if (excludedByHard && !isSaved) continue;
    if (!excludedByHard) afterHard++;

    // --- filtros de la vista ---
    if (!applyFilters(o, primary, f, now)) continue;

    // --- 2. Puntajes ---
    let known = 0;
    let total = 0;
    const note = (k: boolean) => {
      total++;
      if (k) known++;
    };

    // Habilidades y experiencia (40%)
    const req = ex.skillsRequired;
    const des = ex.skillsDesirable;
    const ment = ex.skillsMentioned;
    const matchedReq = req.filter((s) => pSkills.has(s));
    const matchedDes = des.filter((s) => pSkills.has(s));
    let skillScore = 0.5;
    if (req.length || des.length) {
      skillScore = (2 * matchedReq.length + matchedDes.length) / (2 * req.length + des.length);
      note(true);
    } else if (ment.length) {
      skillScore = Math.min(1, ment.filter((s) => pSkills.has(s)).length / Math.min(4, ment.length));
      note(false);
    } else note(false);
    const titleSim = Math.max(0, ...pastTitles.map((t) => dice(t.toks, roleTokens(o.title))));
    const famPast = pastFamilies.has(ex.family.value);
    const expScore = Math.min(1, titleSim + (famPast ? 0.25 : 0));
    const mix = prefs.carrera === "cambio" ? [0.8, 0.2] : prefs.carrera === "continuidad" ? [0.55, 0.45] : [0.65, 0.35];
    let candidateFit = mix[0] * skillScore + mix[1] * expScore;
    if (ex.yearsRequired !== null && profile.yearsExperience !== null && profile.yearsExperience + 1 < ex.yearsRequired) {
      candidateFit *= 0.8;
      gaps.push(`Pide ${ex.yearsRequired}+ años de experiencia; tu CV suma alrededor de ${Math.floor(profile.yearsExperience)}.`);
    }
    if (matchedReq.length) reasonsScored.push([0.9, `Tu CV menciona ${list(matchedReq.slice(0, 3))}, que el aviso pide como requisito${matchedReq.length > 1 ? "s" : ""}.`]);
    else if (matchedDes.length) reasonsScored.push([0.6, `Tu CV menciona ${list(matchedDes.slice(0, 3))}, que el aviso valora.`]);
    if (titleSim >= 0.5 && pastTitles[0]) {
      const best = pastTitles.reduce((a, b) => (dice(b.toks, roleTokens(o.title)) > dice(a.toks, roleTokens(o.title)) ? b : a));
      reasonsScored.push([0.7 + titleSim * 0.2, `Tu experiencia como ${best.label} se relaciona directamente con este puesto.`]);
    }
    for (const s of req.filter((s) => !pSkills.has(s)).slice(0, 3)) {
      gaps.push(`Pide ${s} como requisito: no aparece en tu CV. Si lo manejás, sumalo.`);
    }

    // Intención profesional (35%)
    const titleToks = roleTokens(o.title);
    const desiredSim = Math.max(0, ...desiredTokens.map((d) => dice(d.toks, titleToks)));
    const objSim = objetivoTokens.size ? dice(objetivoTokens, new Set([...titleToks, ...[...req, ...ment].map(canon)])) : 0;
    const famDesired = desiredFamilies.has(ex.family.value);
    let intent: number;
    if (desiredTokens.length || objetivoTokens.size) {
      intent = Math.min(1, Math.max(desiredSim, objSim * 0.8) + (famDesired ? 0.3 : 0));
      if (prefs.carrera === "continuidad" && !desiredTokens.length) intent = Math.max(intent, titleSim);
    } else intent = prefs.carrera === "cambio" ? 0.3 : titleSim;
    if (desiredSim >= 0.5) {
      const best = desiredTokens.reduce((a, b) => (dice(b.toks, titleToks) > dice(a.toks, titleToks) ? b : a));
      reasonsScored.push([0.95, `Coincide con lo que buscás: “${best.label}”.`]);
    } else if (famDesired) reasonsScored.push([0.65, `Es del área que te interesa (${FAMILY_LABEL[ex.family.value]}).`]);
    if (prefs.carrera === "cambio" && !famPast && famDesired && skillScore >= 0.4) {
      reasonsScored.push([0.75, "Es un cambio de área, pero varias de tus habilidades se transfieren."]);
    }

    // Seniority (15%)
    let senScore = 0.5;
    if (ex.seniority && targetSen.length) {
      const idx = SENIORITY_ORDER.indexOf(ex.seniority.value);
      const d = Math.min(...targetSen.map((s) => Math.abs(SENIORITY_ORDER.indexOf(s) - idx)));
      senScore = d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.25 : 0;
      note(true);
      if (d >= 2) gaps.push(`Es un puesto ${SENIORITY_LABEL[ex.seniority.value]}; apuntás a ${targetSen.map((s) => SENIORITY_LABEL[s]).join(" o ")}.`);
    } else note(false);

    // Preferencias adicionales (10%)
    const extras: number[] = [];
    if (wpValue !== "desconocido") {
      const ok = !prefs.modalidades.length || prefs.modalidades.includes(wpValue);
      extras.push(ok ? 1 : 0);
      if (ok && prefs.modalidades.length) reasonsScored.push([0.5, `Es ${WORKPLACE_LABEL[wpValue]}, como preferís.`]);
      note(true);
    } else note(false);
    if (ex.employmentType) {
      extras.push(!prefs.contratos.length || prefs.contratos.includes(ex.employmentType.value) ? 1 : 0.2);
      note(true);
    } else note(false);
    if (salaryOk !== null) {
      extras.push(salaryOk ? 1 : 0.2);
      if (salaryOk) reasonsScored.push([0.55, `El salario publicado (${formatSalary(sal)}) está en línea con tu expectativa.`]);
    } else if (prefs.salario?.monto) pending.push(sal ? "Publica salario, pero en otra moneda o período: comparalo vos." : "No informa salario.");
    for (const l of reqLangs) {
      const mine = pLangs.get(normLang(l.language));
      const need = needLevel(l.level);
      if (mine === undefined) {
        gaps.push(`Pide ${l.language}${l.level ? ` (${l.level})` : ""}: no aparece en tu CV.`);
        extras.push(0.3);
      } else if (langRank(mine) && langRank(mine) < need) {
        gaps.push(`Pide ${l.language} ${l.level}; tu CV dice ${mine}.`);
        extras.push(0.4);
      } else extras.push(1);
    }
    if (o.publishedAt) extras.push((now.getTime() - new Date(o.publishedAt).getTime()) / 86_400_000 <= 14 ? 1 : 0.6);
    const extraScore = extras.length ? extras.reduce((a, b) => a + b, 0) / extras.length : 0.5;

    note(o.descriptionComplete);
    note(o.eligibility.status === "elegible");

    let raw = w.habilidades * candidateFit + w.intencion * intent + w.seniority * senScore + w.extras * extraScore;
    // Si la persona dijo qué quiere hacer, un puesto que no se parece a eso no debería liderar
    // aunque encaje con su experiencia (clave en cambios de carrera).
    if (desiredTokens.length || objetivoTokens.size) raw *= 1 - INTENT_GATE * (1 - intent);

    // Feedback explícito: lo que descartó o guardó antes cambia el orden.
    for (const d of interactions.discarded) {
      if (d.reason === "rol" && d.family === ex.family.value && dice(new Set(d.titleTokens ?? []), titleToks) >= 0.5) raw *= 0.75;
      if (d.reason === "seniority" && d.titleTokens && ex.seniority && dice(new Set(d.titleTokens), titleToks) >= 0.3) raw *= 0.9;
    }
    if (isSaved) raw = Math.min(1, raw * 1.03);

    if (o.eligibility.status === "elegible") reasonsScored.push([0.45, `Se puede trabajar desde Argentina (${o.eligibility.evidence[0]}).`]);
    if (o.eligibility.timezone) pending.push(`Horario pedido: ${o.eligibility.timezone}. Es una condición horaria, no un permiso de contratación.`);

    const sources = o.postingKeys
      .map((k) => postings.get(k))
      .filter((p): p is StoredPosting => !!p)
      .map((p): SourceLink => {
        if (p.sourceId === "usuario") return { name: "Agregada por vos", url: p.sourceUrl, applyUrl: p.applyUrl, required: false, kind: "usuario" };
        const s = sourceById(p.sourceId);
        return { name: s?.name ?? p.sourceId, url: p.sourceUrl, applyUrl: p.applyUrl, attribution: p.attribution, required: p.linkRequired, kind: s?.kind ?? "portal" };
      });
    const logoUrl = o.postingKeys.map((k) => postings.get(k)?.companyLogo).find((u): u is string => !!u?.startsWith("https://"));
    const external = sources.length > 0 && sources.every((s) => s.kind === "usuario");
    const viaAts = sources.some((s) => s.kind === "ats");
    if (!viaAts && !external) pending.push(`Lo vimos en ${sources.map((s) => s.name.replace(/ (API|Public API|Remote Jobs API|\(API pública\))$/, "")).join(" y ")}: confirmá en el aviso que siga abierto.`);
    const conf = total ? known / total : 0;

    const item: RankedItem = {
      id: o.id,
      title: sanitizeDisplay(o.title, 160),
      company: sanitizeDisplay(o.company, 100),
      locations: o.locations.map((l) => sanitizeDisplay(l, 80)),
      workplace: wpValue,
      workplaceLabel: WORKPLACE_LABEL[wpValue],
      eligibility: o.eligibility,
      family: ex.family.value,
      seniority: ex.seniority?.value ?? null,
      employmentType: ex.employmentType?.value ?? null,
      score: Math.round(Math.max(0, Math.min(1, raw)) * 100),
      confidence: conf >= 0.75 ? "alta" : conf >= 0.5 ? "media" : "baja",
      depth: "reglas",
      reasons: reasonsScored.sort((a, b) => b[0] - a[0]).map((r) => r[1]).filter((r, i, arr) => arr.indexOf(r) === i).slice(0, 3),
      gaps: gaps.slice(0, 4),
      pending: [...new Set(pending.filter(Boolean))].slice(0, 4),
      salary: formatSalary(sal),
      sources,
      reviewedAt: o.lastVerifiedAt ?? o.lastSeenAt,
      reviewedLabel: o.lastVerifiedAt ? "Revisado en el sitio del empleador" : "Visto por última vez en la fuente",
      publishedAt: o.publishedAt,
      ...(!o.publishedAt && primary?.postedLabel ? { postedLabel: sanitizeDisplay(primary.postedLabel, 40) } : {}),
      ...(logoUrl ? { logo: logoUrl } : {}),
      excerpt: primary ? sanitizeDisplay(primary.descriptionText.replace(/\s+/g, " "), 320) : "",
      descriptionComplete: o.descriptionComplete,
      status: o.status,
      ...(isSaved ? { saved: true } : {}),
      ...(external ? { external: true, reviewedLabel: "Agregada por vos" } : {}),
    };
    const scored = { item, raw };
    if (isSaved) savedOut.push(scored);
    if (o.status !== "abierta" || excludedByHard || (o.eligibility.status === "no_elegible" && bucket === "eligible")) continue;
    (bucket === "eligible" ? elig : pend).push(scored);
  }

  const sortTop = (arr: Scored[]) => arr.sort((a, b) => b.raw - a.raw).slice(0, limit).map((s) => s.item);
  return {
    eligible: sortTop(elig),
    pending: sortTop(pend),
    saved: savedOut.sort((a, b) => b.raw - a.raw).map((s) => s.item),
    counts: { open, eligible: elig.length, pending: pend.length, afterHardFilters: afterHard, shown: Math.min(limit, elig.length) + Math.min(limit, pend.length) },
  };
}


function applyFilters(o: Opportunity, primary: StoredPosting | undefined, f: Filters, now: Date): boolean {
  if (f.families?.length && !f.families.includes(o.extracted.family.value)) return false;
  if (f.workplaces?.length && !f.workplaces.includes(o.workplace.value)) return false;
  if (f.seniorities?.length && (!o.extracted.seniority || !f.seniorities.includes(o.extracted.seniority.value))) return false;
  if (f.location?.trim() && !fold(o.locations.join(" ")).includes(fold(f.location))) return false;
  if (f.salaryPublished && !o.salary) return false;
  if (f.maxAgeDays) {
    const d = o.publishedAt ?? o.firstSeenAt;
    if ((now.getTime() - new Date(d).getTime()) / 86_400_000 > f.maxAgeDays) return false;
  }
  if (f.language) {
    const en = o.extracted.languages.some((l) => l.language === "inglés" && l.required) || primary?.sourceLanguage === "en";
    if (f.language === "sin_ingles" && en) return false;
    if (f.language === "con_ingles" && !en) return false;
  }
  return true;
}

function list(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export { CONTRACT_LABEL, FAMILY_LABEL, SENIORITY_LABEL };
