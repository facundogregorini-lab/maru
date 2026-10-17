import { ENGLISH_IMPLICIT, familyFromTitle, findSkills } from "./extract";
import { estimateSeniority } from "./profile";
import { sourceById } from "./sources";
import { CONTRACT_LABEL, displayTitle, FAMILY_LABEL, isInferred, SENIORITY_LABEL } from "./labels";
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
 *    Se promedian sólo dimensiones informadas; la intención no se penaliza por segunda vez.
 * Los datos faltantes bajan la CONFIANZA. No equivalen a un 50% de cumplimiento.
 * Guardados, descartes y frescura ajustan el orden, nunca el porcentaje de compatibilidad.
 * El puntaje es una "compatibilidad estimada", nunca una probabilidad de contratación.
 */

/** Por debajo de este % de coincidencia una búsqueda no se lista como "para vos". */
export const MIN_SCORE = 25;

/** Desde cuántos días se esconde un aviso de los resultados (salvo que la persona lo haya guardado). */
export const HIDE_AFTER_DAYS = 120;
/** Desde cuántos días baja en el orden. */
export const STALE_AFTER_DAYS = 60;

/** Días desde que se publicó el aviso (o desde que lo vimos por primera vez, si la fuente no lo dice). */
export function ageDays(o: Pick<Opportunity, "publishedAt" | "firstSeenAt">, now: Date): number {
  return (now.getTime() - new Date(o.publishedAt ?? o.firstSeenAt).getTime()) / 86_400_000;
}

export type Weights = { habilidades: number; intencion: number; seniority: number; extras: number };
export const DEFAULT_WEIGHTS: Weights = { habilidades: 0.4, intencion: 0.35, seniority: 0.15, extras: 0.1 };

export function weightsFromEnv(raw = process.env.MATCH_WEIGHTS): Weights {
  const n = (raw ?? "").split(",").map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x) || x < 0)) return DEFAULT_WEIGHTS;
  const sum = n.reduce((a, b) => a + b, 0);
  if (!sum) return DEFAULT_WEIGHTS;
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
  ["finanzas", "finance", "financiero", "financiera", "financial"],
  ["contador", "contadora", "accountant", "contable", "contabilidad", "accounting"],
  ["recursos", "human", "people", "rrhh", "hr"],
  ["reclutador", "recruiter", "recruiting", "talent", "seleccion"],
  ["logistica", "logistics", "supply"],
  ["crecimiento", "growth"],
  ["lider", "lead", "leader"],
  ["director", "head"],
  ["asistente", "assistant"],
  ["administrativo", "administrativa", "administracion", "administrative", "admin"],
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

/** Palabras de cargo que no dicen de qué es el puesto ("Analista de calidad" no se parece a "Analista de logística"). */
const GENERIC_ROLE = new Set(
  ["analista", "analyst", "asistente", "assistant", "auxiliar", "ejecutivo", "ejecutiva", "executive", "especialista", "specialist", "coordinador", "coordinadora", "coordinator", "responsable", "encargado", "encargada", "jefe", "jefa", "lider", "lead", "gerente", "manager", "representante", "representative", "operador", "operadora", "oficial", "officer", "associate", "consultor", "consultant"].map(canon),
);

/** Similitud de cargos: manda lo específico; si sólo comparten palabras genéricas, cuenta poco. */
function roleSim(a: Set<string>, b: Set<string>): number {
  const ca = new Set([...a].filter((t) => !GENERIC_ROLE.has(t)));
  const cb = new Set([...b].filter((t) => !GENERIC_ROLE.has(t)));
  if (!ca.size || !cb.size) return dice(a, b);
  return 0.8 * dice(ca, cb) + 0.2 * dice(a, b);
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/** Un título con región o especialidad adicional conserva el rol que contiene.
 * Compartir sólo "analista"/"manager" nunca activa ese reconocimiento. */
function roleSimilarity(a: Set<string>, b: Set<string>): number {
  const overlap = [...a].filter((t) => b.has(t));
  const containsRole = overlap.length === Math.min(a.size, b.size)
    && overlap.some((t) => !GENERIC_ROLE.has(t));
  return Math.max(roleSim(a, b), containsRole ? 0.9 : 0);
}

/* ---------- helpers ---------- */

const SKILL_ALIAS = (s: string) => {
  const found = findSkills(s);
  return found.length ? found : [fold(s)];
};

function profileSkillSet(m: MatchProfile): Set<string> {
  return new Set([...m.skills.flatMap(SKILL_ALIAS), ...findSkills([m.headline, ...m.titles, m.summary].join("\n"))]);
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
  /** Coincidencia mínima para listar (por defecto MIN_SCORE). */
  minScore?: number;
};

export type RankOutput = {
  eligible: RankedItem[];
  pending: RankedItem[];
  saved: RankedItem[];
  /** lowMatch: abiertas que pasan las condiciones pero con coincidencia menor a MIN_SCORE (no se listan). */
  counts: { open: number; eligible: number; pending: number; lowMatch: number; afterHardFilters: number; shown: number };
};

type Scored = { item: RankedItem; raw: number };

export function rankOpportunities(input: RankInput): RankOutput {
  const { profile, prefs, interactions, postings } = input;
  const w = input.weights ?? DEFAULT_WEIGHTS;
  const now = input.now ?? new Date();
  const limit = input.limit ?? 40;
  const f = input.filters ?? {};
  const minScore = input.minScore ?? MIN_SCORE;

  const pSkills = profileSkillSet(profile);
  const pLangs = new Map(profile.languages.map((l) => [normLang(l.language), l.level]));
  const desired = [...prefs.rolesDeseados, prefs.objetivo].filter((s) => s.trim());
  const desiredTokens = prefs.rolesDeseados.map((r) => ({ label: r, toks: roleTokens(r) })).filter((r) => r.toks.size);
  const objetivoTokens = roleTokens(prefs.objetivo);
  const desiredFamilies = new Set<RoleFamily>(desired.map(familyFromTitle).filter((x) => x !== "otros"));
  const professionalTitles = [...new Set([...profile.titles.slice(0, 3), profile.headline].filter((t) => t.trim()))];
  const pastTitles = professionalTitles.map((t) => ({ label: t, toks: roleTokens(t) }));
  const pastFamilies = new Set<RoleFamily>(professionalTitles.map(familyFromTitle).filter((x) => x !== "otros"));
  const avoid = prefs.evitar.map((e) => fold(e)).filter((e) => e.length > 2);
  const targetSen = prefs.seniorities.length ? prefs.seniorities : [estimateSeniority(profile)].filter(Boolean) as Seniority[];
  const hard = new Set(prefs.indispensables);
  const savedIds = new Set(interactions.saved);
  const discarded = new Map(interactions.discarded.map((d) => [d.id, d]));
  const blockedCompanies = new Set(interactions.discarded.filter((d) => d.reason === "empresa" && d.company).map((d) => fold(d.company!)));
  // La ciudad es lo que va antes de la primera coma ("Córdoba, Argentina" → "córdoba").
  const userPlaces = [prefs.ciudad, ...prefs.otrosLugares].map((x) => fold(x.split(",")[0])).filter(Boolean);
  const userCountryWords = prefs.autorizacion.flatMap((a) => COUNTRY_WORDS[fold(a)] ?? [fold(a)]);
  const placeMatches = (locs: string[]) => {
    const segs = placeSegments(locs);
    const isBaCity = (s: string) => /^(buenos aires|caba|capital federal|ciudad autonoma de buenos aires|cdad autonoma de buenos aires)$/.test(s);
    // "Mar del Plata, Buenos Aires" no es la ciudad de Buenos Aires. En esa preferencia
    // comparamos la primera ciudad, sin confundir el país ni la provincia que le siguen.
    const cities = locs.flatMap((l) => l.split("|").map((part) => placeSegments([part]).find((seg) =>
      !/^(argentina|ar|latam|latin america|south america|remote|remoto|worldwide)$/.test(seg)
      && !/^(provincia de|province of|province|estado de|state of)\b/.test(seg),
    ) ?? ""));
    return userPlaces.some((p) => isBaCity(p)
      ? cities.some((city) => isBaCity(city))
      : segs.some((seg) => samePlace(seg, p)));
  };

  let open = 0;
  let afterHard = 0;
  let lowMatch = 0;
  const elig: Scored[] = [];
  const pend: Scored[] = [];
  const savedOut: Scored[] = [];

  for (const o of input.opportunities) {
    const isSaved = savedIds.has(o.id);
    if (o.status !== "abierta" && !isSaved) continue;
    // Un aviso de hace más de 4 meses casi nunca sigue buscando: no se ofrece, salvo que esté guardado.
    if (!isSaved && ageDays(o, now) > HIDE_AFTER_DAYS) continue;
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
    // "Presencial (inferido)": sirve para ordenar, pero no para excluir con un indispensable.
    const wpInferred = isInferred(o.workplace);
    let excludedByHard = false;
    const hardCheck = (key: (typeof prefs.indispensables)[number], known: boolean, ok: boolean, unknownNote: string) => {
      if (!hard.has(key)) return;
      if (!known) pending.push(unknownNote);
      else if (!ok) excludedByHard = true;
    };
    hardCheck("modalidad", wpValue !== "desconocido" && !wpInferred, prefs.modalidades.includes(wpValue), "No informa la modalidad (remoto, híbrido o presencial).");
    if (wpValue !== "remoto") {
      // Si el aviso está en un lugar que la persona eligió, la ubicación ya se cumple aunque no diga la modalidad.
      const placeOk = userPlaces.length > 0 && o.locations.length > 0 && placeMatches(o.locations);
      hardCheck("ubicacion", placeOk || (o.locations.length > 0 && wpValue !== "desconocido" && userPlaces.length > 0), placeOk, "No queda claro dónde hay que trabajar.");
    }
    hardCheck("seniority", !!ex.seniority, !!ex.seniority && (!prefs.seniorities.length || prefs.seniorities.includes(ex.seniority.value)), "No informa el nivel de seniority.");
    hardCheck("contrato", !!ex.employmentType, !!ex.employmentType && (!prefs.contratos.length || prefs.contratos.includes(ex.employmentType.value)), "No informa el tipo de contratación.");
    // Idiomas: sólo juzgamos los que la persona declaró. Si no lo declaró, queda "por confirmar", no "no cumple".
    const reqLangs = ex.languages.filter((l) => l.required && l.language !== "español");
    // Aviso escrito en inglés sin nivel declarado: si el puesto es de cara al cliente (atender, vender), hace falta fluidez.
    const customerFacing = ex.family.value === "atencion_cliente" || ex.family.value === "ventas";
    const needLevel = (level: string) => (level === ENGLISH_IMPLICIT ? (customerFacing ? 3 : 2) : HIGH.test(fold(level)) ? 3 : MID.test(fold(level)) ? 2 : 1);
    const levelLabel = (l: { level: string }) => (l.level === ENGLISH_IMPLICIT && customerFacing ? "fluido (el aviso está escrito en inglés y el puesto es de cara al cliente)" : l.level);
    hardCheck(
      "idioma",
      reqLangs.every((l) => langRank(pLangs.get(normLang(l.language)) ?? "") > 0),
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
    let skillScore: number | null = null;
    if (req.length || des.length) {
      // Una lista larga de "nice to have" no debe pesar más que los requisitos cumplidos.
      const required = req.length ? matchedReq.length / req.length : null;
      const desirable = des.length ? matchedDes.length / des.length : null;
      skillScore = required !== null && desirable !== null ? 0.85 * required + 0.15 * desirable : required ?? desirable;
      note(pSkills.size > 0);
    } else if (ment.length) {
      skillScore = Math.min(1, ment.filter((s) => pSkills.has(s)).length / Math.min(4, ment.length));
      note(false);
    } else note(false);
    const titleSim = Math.max(0, ...pastTitles.map((t) => roleSimilarity(t.toks, roleTokens(o.title))));
    const famPast = pastFamilies.has(ex.family.value);
    const expScore = Math.min(1, titleSim + (famPast ? 0.25 : 0));
    const mix = prefs.carrera === "cambio" ? [0.8, 0.2] : prefs.carrera === "continuidad" ? [0.55, 0.45] : [0.65, 0.35];
    const hasExperience = pastTitles.some((t) => t.toks.size);
    note(hasExperience);
    const fitWeight = (skillScore !== null ? mix[0] : 0) + (hasExperience ? mix[1] : 0);
    let candidateFit = fitWeight ? ((skillScore ?? 0) * mix[0] + (hasExperience ? expScore * mix[1] : 0)) / fitWeight : 0;
    if (ex.yearsRequired !== null) {
      note(profile.yearsExperience !== null);
      if (profile.yearsExperience === null) pending.push(`Pide ${ex.yearsRequired}+ años de experiencia: confirmá cuántos tenés.`);
    }
    if (ex.yearsRequired !== null && profile.yearsExperience !== null && profile.yearsExperience + 1 < ex.yearsRequired) {
      candidateFit *= 0.8;
      gaps.push(`Pide ${ex.yearsRequired}+ años de experiencia; tu CV suma alrededor de ${Math.floor(profile.yearsExperience)}.`);
    }
    if (matchedReq.length) reasonsScored.push([0.9, `Tu CV menciona ${list(matchedReq.slice(0, 3))}, que el aviso pide como requisito${matchedReq.length > 1 ? "s" : ""}.`]);
    else if (matchedDes.length) reasonsScored.push([0.6, `Tu CV menciona ${list(matchedDes.slice(0, 3))}, que el aviso valora.`]);
    if (titleSim >= 0.5 && pastTitles[0]) {
      const best = pastTitles.reduce((a, b) => (roleSimilarity(b.toks, roleTokens(o.title)) > roleSimilarity(a.toks, roleTokens(o.title)) ? b : a));
      reasonsScored.push([0.7 + titleSim * 0.2, `Tu experiencia como ${best.label} se relaciona directamente con este puesto.`]);
    }
    for (const s of req.filter((s) => !pSkills.has(s)).slice(0, 3)) {
      gaps.push(`Pide ${s} como requisito: no aparece en tu CV. Si lo manejás, sumalo.`);
    }

    // Intención profesional (35%)
    const titleToks = roleTokens(o.title);
    const desiredSim = Math.max(0, ...desiredTokens.map((d) => roleSimilarity(d.toks, titleToks)));
    const objSim = objetivoTokens.size ? dice(objetivoTokens, new Set([...titleToks, ...[...req, ...ment].map(canon)])) : 0;
    const famDesired = desiredFamilies.has(ex.family.value);
    const hasIntent = desiredTokens.length > 0 || objetivoTokens.size > 0;
    let intent = 0;
    if (hasIntent) {
      intent = Math.min(1, Math.max(desiredSim, objSim * 0.8) + (famDesired ? 0.3 : 0));
      if (prefs.carrera === "continuidad" && !desiredTokens.length) intent = Math.max(intent, titleSim);
    }
    if (desiredSim >= 0.5) {
      const best = desiredTokens.reduce((a, b) => (roleSimilarity(b.toks, titleToks) > roleSimilarity(a.toks, titleToks) ? b : a));
      reasonsScored.push([0.95, `Coincide con lo que buscás: “${best.label}”.`]);
    } else if (famDesired) reasonsScored.push([0.65, `Es del área que te interesa (${FAMILY_LABEL[ex.family.value]}).`]);
    if (prefs.carrera === "cambio" && !famPast && famDesired && skillScore !== null && skillScore >= 0.4) {
      reasonsScored.push([0.75, "Es un cambio de área, pero varias de tus habilidades se transfieren."]);
    }

    // Seniority (15%)
    let senScore: number | null = null;
    if (ex.seniority && targetSen.length) {
      const idx = SENIORITY_ORDER.indexOf(ex.seniority.value);
      const d = Math.min(...targetSen.map((s) => Math.abs(SENIORITY_ORDER.indexOf(s) - idx)));
      senScore = d === 0 ? 1 : d === 1 ? 0.8 : d === 2 ? 0.35 : 0;
      note(true);
      if (d >= 2) gaps.push(`Es un puesto ${SENIORITY_LABEL[ex.seniority.value]}; apuntás a ${targetSen.map((s) => SENIORITY_LABEL[s]).join(" o ")}.`);
    } else note(false);

    // Preferencias adicionales (10%)
    const extras: number[] = [];
    if (prefs.modalidades.length && wpValue !== "desconocido") {
      const ok = !prefs.modalidades.length || prefs.modalidades.includes(wpValue);
      extras.push(ok ? 1 : 0);
      if (ok && prefs.modalidades.length) reasonsScored.push([0.5, wpInferred ? `Parece ${WORKPLACE_LABEL[wpValue]}, como preferís (el aviso no lo aclara).` : `Es ${WORKPLACE_LABEL[wpValue]}, como preferís.`]);
      note(true);
    } else if (prefs.modalidades.length) note(false);
    if (prefs.contratos.length && ex.employmentType) {
      extras.push(!prefs.contratos.length || prefs.contratos.includes(ex.employmentType.value) ? 1 : 0.2);
      note(true);
    } else if (prefs.contratos.length) note(false);
    if (salaryOk !== null) {
      extras.push(salaryOk ? 1 : 0.2);
      if (salaryOk) reasonsScored.push([0.55, `El salario publicado (${formatSalary(sal)}) está en línea con tu expectativa.`]);
    } else if (prefs.salario?.monto) pending.push(sal ? "Publica salario, pero en otra moneda o período: comparalo vos." : "No informa salario.");
    if (prefs.salario?.monto) note(salaryOk !== null);
    // El idioma también pesa en el total: un aviso que exige inglés avanzado no debería liderar
    // para alguien con nivel intermedio (y menos sin inglés en el CV).
    let langFactor = 1;
    for (const l of reqLangs) {
      const mine = pLangs.get(normLang(l.language));
      const need = needLevel(l.level);
      if (mine === undefined || !langRank(mine)) {
        gaps.push(mine === undefined
          ? `Pide ${l.language}${l.level ? ` (${levelLabel(l)})` : ""}: no aparece en tu CV.`
          : `Pide ${l.language}${l.level ? ` (${levelLabel(l)})` : ""}: tu CV no indica el nivel, confirmalo.`);
        note(false);
        langFactor = Math.min(langFactor, 0.7);
      } else if (langRank(mine) && langRank(mine) < need) {
        gaps.push(`Pide ${l.language} ${levelLabel(l)}; tu CV dice ${mine}.`);
        extras.push(0.4);
        langFactor = Math.min(langFactor, 0.85);
        note(true);
      } else { extras.push(1); note(true); }
    }
    const extraScore = extras.length ? extras.reduce((a, b) => a + b, 0) / extras.length : null;

    note(o.descriptionComplete);
    note(o.eligibility.status === "elegible");

    const dimensions: [number, number | null][] = [
      [w.habilidades, candidateFit], [w.intencion, hasIntent ? intent : null],
      [w.seniority, senScore], [w.extras, extraScore],
    ];
    const available = dimensions.reduce((sum, [weight, value]) => sum + (value !== null ? weight : 0), 0);
    let raw = (available ? dimensions.reduce((sum, [weight, value]) => sum + weight * (value ?? 0), 0) / available : 0) * langFactor;

    // Condiciones conocidas que dificultan postularse siguen afectando la afinidad (E0).
    if (wpValue !== "desconocido" && prefs.modalidades.length && !prefs.modalidades.includes(wpValue)) raw *= 0.85;
    if (wpValue !== "remoto" && wpValue !== "desconocido" && o.locations.length && userPlaces.length && !placeMatches(o.locations)) {
      // Presencial en otra ciudad es mudarse o viajar todos los días: pesa más que híbrido.
      raw *= wpValue === "presencial" ? 0.7 : 0.8;
      gaps.push(
        wpInferred
          ? `Parece presencial en ${o.locations.slice(0, 2).join(" · ")} (no aclara si es remoto), fuera de los lugares que indicaste.`
          : `Es ${WORKPLACE_LABEL[wpValue].toLowerCase()} en ${o.locations.slice(0, 2).join(" · ")}, fuera de los lugares que indicaste.`,
      );
    }
    // Sin modalidad informada pero con una ciudad concreta fuera de las elegidas: probablemente presencial allá.
    const onlyCountry = o.locations.every((l) => /^\s*(argentina|remote|remoto|latam|latin america)\b/i.test(l));
    if (wpValue === "desconocido" && o.locations.length && !onlyCountry && userPlaces.length && !placeMatches(o.locations)) {
      raw *= hard.has("ubicacion") ? 0.75 : 0.88;
      pending.push(`Se publica en ${argentinaFirst(o.locations).slice(0, 2).join(" · ")} y no aclara si es remoto: confirmalo antes de postularte.`);
    }

    // Preferencias de orden: no alteran cuánto coincide el perfil con este aviso.
    let order = raw * (prefs.carrera === "cambio" && hasIntent ? 0.6 + 0.4 * intent : 1);
    for (const d of interactions.discarded) {
      if (d.reason === "rol" && d.family === ex.family.value && dice(new Set(d.titleTokens ?? []), titleToks) >= 0.5) order *= 0.75;
      if (d.reason === "seniority" && d.titleTokens && ex.seniority && dice(new Set(d.titleTokens), titleToks) >= 0.3) order *= 0.9;
    }
    if (ageDays(o, now) > STALE_AFTER_DAYS) order *= 0.85;
    if (OPEN_CALL.test(` ${titleF} `) || AI_TASKS.test(fold(primary?.descriptionText.slice(0, 3000) ?? ""))) {
      order *= 0.7;
      pending.push("Parece una convocatoria abierta o un proyecto por tareas, no una vacante puntual: confirmalo en el aviso.");
    }
    if (isSaved) order *= 1.03;

    if (wpValue !== "remoto" && userPlaces.length && o.locations.length && placeMatches(o.locations)) reasonsScored.push([0.6, `Es en ${prefs.ciudad.split(",")[0].trim() || "tu ciudad"}, donde buscás.`]);
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
      title: sanitizeDisplay(displayTitle(o.title), 160),
      company: sanitizeDisplay(o.company, 100),
      locations: displayLocations(o.locations, o.eligibility.status === "elegible" && wpValue === "remoto").map((l) => sanitizeDisplay(l, 80)),
      workplace: wpValue,
      workplaceLabel: wpInferred ? `${WORKPLACE_LABEL[wpValue]} (inferido)` : WORKPLACE_LABEL[wpValue],
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
    const scored = { item, raw: order };
    if (isSaved) savedOut.push(scored);
    if (o.status !== "abierta" || excludedByHard || (o.eligibility.status === "no_elegible" && bucket === "eligible")) continue;
    // Lo que casi no se parece a lo que busca no es "para vos": se cuenta aparte. Si filtra por área, se muestra igual.
    if (item.score < minScore && !f.families?.length && !external) {
      lowMatch++;
      continue;
    }
    (bucket === "eligible" ? elig : pend).push(scored);
  }

  const sort = (a: Scored, b: Scored) => b.raw - a.raw
    || (Date.parse(b.item.publishedAt ?? b.item.reviewedAt) - Date.parse(a.item.publishedAt ?? a.item.reviewedAt));
  const sortTop = (arr: Scored[]) => diversify(arr.sort(sort)).slice(0, limit).map((s) => s.item);
  return {
    eligible: sortTop(elig),
    pending: sortTop(pend),
    saved: savedOut.sort(sort).map((s) => s.item),
    counts: { open, eligible: elig.length, pending: pend.length, lowMatch, afterHardFilters: afterHard, shown: Math.min(limit, elig.length) + Math.min(limit, pend.length) },
  };
}


/** Convocatorias abiertas, pools y proyectos por tarea (entrenamiento de IA, transcripción, lingüística masiva). */
const OPEN_CALL = /\b(talent (pool|community|network)|general application|open application|candidatura espontanea|join our talent|future opportunities|oportunidades futuras|ai (trainer|training|tutor)|data annotat|annotator|rater|search evaluator|transcri(ber|ptionist|pcion)|freelance (translator|linguist|writer)|linguist|language (expert|specialist) for ai)/;

/** Proyectos para entrenar o evaluar modelos de IA, aunque el título parezca un puesto del área. */
const AI_TASKS = /\b(train(ing)? (ai|llm|large language) models?|training data for( frontier)? ai|frontier (ai )?models?|leading ai labs?|improve (model )?reasoning|rlhf|improve (the )?(ai|llm) models?|evaluate ai (responses|outputs)|ai training (project|platform)|search quality rat(er|ing)|entrenar modelos de (ia|inteligencia artificial))\b/;

const AR_PLACE = /argentin|buenos aires|caba|capital federal|c[oó]rdoba|rosario|mendoza|tucum[aá]n|la plata|mar del plata|neuqu[eé]n|salta|santa fe/i;
/** Si se puede trabajar desde Argentina, que la tarjeta lo muestre primero. */
export const argentinaFirst = (locs: string[]) => [...locs.filter((l) => AR_PLACE.test(l)), ...locs.filter((l) => !AR_PLACE.test(l))];

/** Partes de cada ubicación ("San Miguel de Tucumán, Tucumán" → ["san miguel de tucuman", "tucuman"]). */
export function placeSegments(locs: string[]): string[] {
  return locs.flatMap((l) => l.split(/,|\||\s[-–]\s|\(|\)/).map((x) => fold(x))).filter(Boolean);
}

/**
 * La parte de una ubicación es el lugar que eligió la persona: igual, "Córdoba Capital" para "Córdoba"
 * o "San Miguel de Tucumán" para "Tucumán". "Rosario de Lerma" (Salta) no es Rosario.
 */
export function samePlace(seg: string, place: string): boolean {
  if (seg === place) return true;
  if (seg.startsWith(`${place} `)) return !/^(de|del|de la|de los)\b/.test(seg.slice(place.length + 1));
  return seg.endsWith(` de ${place}`);
}

const placeKey = (l: string) =>
  fold(l)
    .replace(/\b(argentina|provincia de|province|prov|cdad autonoma de|ciudad autonoma de)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Ubicaciones para mostrar: Argentina primero, sin repetir el mismo lugar escrito distinto
 * ("Rosario, Santa Fe" y "Rosario, Santa Fe, Argentina") y sin un "Argentina" suelto si hay una ciudad.
 * Si es remoto y elegible pero las ubicaciones no nombran Argentina, lo dice primero.
 */
export function displayLocations(locs: string[], remoteFromAr = false): string[] {
  const out: string[] = [];
  const keys: string[] = [];
  for (const l of argentinaFirst(locs)) {
    const k = placeKey(l);
    if (keys.some((x) => x === k || (k && (x.startsWith(`${k} `) || k.startsWith(`${x} `))))) continue;
    out.push(l.trim());
    keys.push(k);
  }
  const result = out.some((l) => placeKey(l) && AR_PLACE.test(l)) ? out.filter((l) => placeKey(l)) : out;
  if (!remoteFromAr || result.some((l) => AR_PLACE.test(l))) return result;
  return ["Remoto desde Argentina", ...result.filter((l) => !/^(remote|remoto|anywhere|worldwide)$/.test(fold(l)))];
}

/** Variedad: como mucho 2 avisos de la misma empresa en los primeros 10 (el resto baja, no desaparece). */
function diversify(sorted: Scored[], top = 10, perCompany = 2): Scored[] {
  const head: Scored[] = [];
  const rest: Scored[] = [];
  const count = new Map<string, number>();
  for (const s of sorted) {
    const c = fold(s.item.company);
    if (head.length < top && (count.get(c) ?? 0) < perCompany) {
      head.push(s);
      count.set(c, (count.get(c) ?? 0) + 1);
    } else rest.push(s);
  }
  return [...head, ...rest];
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
