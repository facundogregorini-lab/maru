import { ENGLISH_IMPLICIT, familyFromTitle, findSkills } from "./extract";
import { functionMismatch, GENERIC_SKILLS, levelScore, levelVerdict, postingLevel, salaryMeets, skillWeight, targetRange } from "./fit";
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
 * Ranking explicable por reglas: la primera etapa de /match. La segunda (rerank.ts) re-evalúa
 * con IA las mejores de esta lista.
 *
 * 1. Filtros eliminatorios primero: elegibilidad, "evitar", descartes, indispensables, nivel menor
 *    al elegido, salario publicado menor al pedido (misma moneda) y funciones ajenas (fit.ts).
 * 2. Recuperación por texto con equivalencias español/inglés.
 * 3. Puntaje = 40% encaje de rol + 25% seniority + 20% requisitos críticos + 15% preferencias
 *    (configurable con MATCH_WEIGHTS="40,25,20,15"). El área no suma puntos: es un filtro.
 *    Si el encaje de rol es bajo (< ROLE_FIT_FLOOR), el total no pasa de ROLE_CAP.
 * Los datos faltantes bajan la CONFIANZA. Sólo nivel y salario sin informar cuentan como 50%:
 * así un aviso sin el dato nunca supera a uno que cumple.
 * Guardados, descartes y frescura ajustan el orden, nunca el porcentaje de compatibilidad.
 * El puntaje es una "compatibilidad estimada", nunca una probabilidad de contratación.
 */

/** Por debajo de este % de coincidencia una búsqueda no se lista como "para vos". */
export const MIN_SCORE = 25;
/** Tope del porcentaje que se muestra. */
export const MAX_SCORE = 99;

/** Desde cuántos días se esconde un aviso de los resultados (salvo que la persona lo haya guardado). */
export const HIDE_AFTER_DAYS = 120;
/** Desde cuántos días baja en el orden. */
export const STALE_AFTER_DAYS = 60;

/** Días desde que se publicó el aviso (o desde que lo vimos por primera vez, si la fuente no lo dice). */
export function ageDays(o: Pick<Opportunity, "publishedAt" | "firstSeenAt">, now: Date): number {
  return (now.getTime() - new Date(o.publishedAt ?? o.firstSeenAt).getTime()) / 86_400_000;
}

export type Weights = { rol: number; seniority: number; requisitos: number; preferencias: number };
export const DEFAULT_WEIGHTS: Weights = { rol: 0.4, seniority: 0.25, requisitos: 0.2, preferencias: 0.15 };

/** Con un encaje de rol menor a este, el total no pasa de ROLE_CAP. */
export const ROLE_FIT_FLOOR = 0.5;
export const ROLE_CAP = 0.4;

export function weightsFromEnv(raw = process.env.MATCH_WEIGHTS): Weights {
  const n = (raw ?? "").split(",").map(Number);
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x) || x < 0)) return DEFAULT_WEIGHTS;
  const sum = n.reduce((a, b) => a + b, 0);
  if (!sum) return DEFAULT_WEIGHTS;
  return { rol: n[0] / sum, seniority: n[1] / sum, requisitos: n[2] / sum, preferencias: n[3] / sum };
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
  ["ia", "ai"],
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
  const phrases = fold(s).replace(/\b(inteligencia artificial|artificial intelligence|ia generativa|generative ai|genai)\b/g, " ia ")
    .replace(/\bcomercio electronico\b/g, " ecommerce ");
  return new Set(tokens(phrases).filter((t) => !SEN_WORDS.has(t)).map(canon));
}

const GOAL_FILLER = new Set(["quiero", "busco", "buscando", "trabajar", "trabajo", "gustaria", "dedicarme", "enfocarme", "me", "area", "rol", "puesto"]);

/** Palabras de cargo que no dicen de qué es el puesto ("Analista de calidad" no se parece a "Analista de logística"). */
const GENERIC_ROLE = new Set(
  ["analista", "analyst", "asistente", "assistant", "auxiliar", "ejecutivo", "ejecutiva", "executive", "especialista", "specialist", "coordinador", "coordinadora", "coordinator", "responsable", "encargado", "encargada", "jefe", "jefa", "lider", "lead", "gerente", "manager", "representante", "representative", "operador", "operadora", "oficial", "officer", "associate", "consultor", "consultant", "director", "head", "founder", "cofounder", "fundador", "fundadora", "owner", "vp", "svp", "evp", "avp", "vice", "president", "presidente", "vicepresidente", "chief", "global"].map(canon),
);

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return (2 * inter) / (a.size + b.size);
}

/** Un objetivo corto no pierde afinidad porque el aviso incluya muchos otros términos. */
function goalCoverage(goal: Set<string>, evidence: Set<string>): number {
  if (!goal.size) return 0;
  return [...goal].filter((t) => evidence.has(t)).length / goal.size;
}

/** Lugares, modalidad y ruido de aviso: no dicen qué es el puesto ("Coordinador de Logística zona Tucumán"). */
const TITLE_NOISE = new Set(
  ("zona zone urgente importante empresa busca buscamos busqueda solicita incorporar incorporamos se as os " +
    "remoto remote hibrido hybrid presencial onsite latam argentina buenos aires caba gba capital federal provincia " +
    "cordoba rosario mendoza tucuman salta neuquen santa fe plata mar parana corrientes chaco tandil " +
    "perm eventual temporario efectivo part full-time part-time u").split(" "),
);

/**
 * Tipo de puesto según su primera palabra de cargo: "Analista de logística" y "Chofer de logística"
 * comparten el área, no el trabajo.
 */
type Head = "analisis" | "tecnico" | "gestion" | "apoyo" | "operativo";
const HEADS: Record<Head, string[]> = {
  analisis: ["analista", "especialista", "consultor", "associate", "oficial", "officer", "auditor", "planificador", "planner"],
  tecnico: ["desarrollador", "tecnico", "technician", "arquitecto", "architect", "scientist", "cientifico"],
  gestion: ["gerente", "director", "lider", "coordinador", "coordinadora", "supervisor", "supervisora", "responsable", "encargado", "encargada", "jefa"],
  apoyo: ["asistente", "auxiliar", "auxiliary", "clerk", "administrativo", "representante", "representative", "operador", "operadora", "agente", "agent", "ejecutivo", "ejecutiva", "recepcionista", "secretario", "secretaria"],
  operativo: ["chofer", "choferes", "conductor", "driver", "operario", "operaria", "repartidor", "cadete", "peon", "mozo", "moza", "camarero", "camarera", "cajero", "cajera", "repositor", "repositora", "vigilador", "vigiladora", "guardia", "ayudante", "estibador", "clarkista", "autoelevadorista", "maquinista", "soldador", "tornero", "cocinero", "cocinera", "bachero", "picker", "mensajero", "promotor", "promotora", "mucama", "limpieza"],
};
const HEAD_OF = new Map<string, Head>();
for (const [h, words] of Object.entries(HEADS) as [Head, string[]][]) for (const w of words) HEAD_OF.set(canon(w), h);

const ADJECTIVE_HEADS = new Set(["administrativo", "ejecutivo", "ejecutiva", "tecnico"].map(canon));
/** Cargos de apoyo que, sin un nivel en el aviso, se estiman junior ("Administrativo contable", "Recepcionista"). */
const SUPPORT_HEADS = new Set(["administrativo", "asistente", "auxiliar", "auxiliary", "clerk", "recepcionista", "secretario", "secretaria"].map(canon));

export type Role = { head: Head | null; headWord: string | null; domain: Set<string>; all: Set<string> };

/**
 * En datos e IA el cargo técnico dice la disciplina: "Data Scientist" y "Data Engineer" comparten
 * el área, no el trabajo. La disciplina pasa a ser parte del área del puesto. Arquitecto de datos
 * es el paso siguiente de un data engineer: misma disciplina.
 */
const DISCIPLINE: Record<string, string> = { scientist: "ciencia", cientifico: "ciencia", desarrollador: "ingenieria", arquitecto: "ingenieria", architect: "ingenieria", analista: "analisis" };
const DISCIPLINE_AREAS = new Set(["datos", "ia"]);

/** Un cargo separado en tipo de puesto y área, sin seniority, lugares ni ruido del aviso. */
export function parseRole(s: string): Role {
  // "Recepcionista con perfil en marketing", "Analista with SQL": lo que sigue a "con" califica, no es el puesto.
  s = s.replace(/\s(con|with)\s.*$/i, "");
  // "…para la Industria Financiera", "…para empresa metalúrgica": dicen dónde, no de qué es el puesto.
  s = s
    .replace(/\s(para|for)\s+((una?|la|el|a|an|the)\s+)?(importante\s+|leading\s+)?(industria|sector|rubro|empresa|compa[nñ][ií]a|company|firma|estudio|industry|banco|bank|consultora|cliente)\b.*$/i, "")
    .replace(/\s(en|in)\s+((la|el|the)\s+)?(industria|sector|rubro|industry)\b.*$/i, "");
  const words = [...roleTokens(s)].filter((t) => !TITLE_NOISE.has(t) && !/^\W+$/.test(t)).map((t) => t.replace(/[(),:;!?]+/g, "")).filter(Boolean);
  // "Administrativo", "ejecutivo" o "técnico" pueden ser el cargo o un adjetivo ("Administrative Analyst"):
  // si hay otra palabra de cargo, manda la otra.
  const firm = words.findIndex((w) => HEAD_OF.has(w) && !ADJECTIVE_HEADS.has(w));
  const i = firm !== -1 ? firm : words.findIndex((w) => HEAD_OF.has(w));
  const head = i === -1 ? null : HEAD_OF.get(words[i])!;
  // Otra palabra de cargo puede decir de qué es ("Asistente administrativo"); las de jerarquía ("Data Analyst Lead"), no.
  const domain = new Set(words.filter((w, j) => j !== i && HEAD_OF.get(w) !== "gestion" && !GENERIC_ROLE.has(w)));
  const discipline = i === -1 ? undefined : DISCIPLINE[words[i]];
  if (discipline && [...domain].some((w) => DISCIPLINE_AREAS.has(w))) domain.add(discipline);
  return { head, headWord: i === -1 ? null : words[i], domain, all: new Set(words) };
}

function headFit(a: Head | null, b: Head | null): number {
  // Un puesto operativo (chofer, operario, vigilador) no es lo mismo que uno administrativo del mismo rubro.
  if ((a === "operativo") !== (b === "operativo")) return 0.45;
  if (!a || !b || a === b) return a === b ? 1 : 0.9;
  if (a === "gestion" || b === "gestion") return 0.85;
  return 0.75;
}

/**
 * Similitud de cargos, de lo que la persona hizo o busca (a) con el aviso (b). Manda el área:
 * cuánto de lo que buscás está en el título (un título con región o especialidad adicional
 * conserva el rol que contiene) y cuánto del título es eso. El tipo de puesto la ajusta.
 * Compartir sólo "analista"/"manager" cuenta poco.
 */
export function roleSimilarity(a: Role, b: Role): number {
  if (!a.domain.size || !b.domain.size) return 0.2 * dice(a.all, b.all) * headFit(a.head, b.head);
  let inter = 0;
  for (const x of a.domain) if (b.domain.has(x)) inter++;
  const cover = inter / a.domain.size;
  const domain = Math.max(0.65 * cover + 0.35 * (inter / b.domain.size), cover === 1 ? 0.9 : 0);
  return domain * headFit(a.head, b.head);
}

/* ---------- helpers ---------- */

const findProfileSkills = (s: string) => findSkills(s.replace(/\bia\b/gi, "inteligencia artificial"));
const SKILL_ALIAS = (s: string) => {
  const found = findProfileSkills(s);
  return found.length ? found : [fold(s)];
};

function profileSkillSet(m: MatchProfile): Set<string> {
  return new Set([...m.skills.flatMap(SKILL_ALIAS), ...findProfileSkills([m.headline, ...m.titles, m.summary].join("\n"))]);
}

const LANG_EN: Record<string, string> = { ingles: "inglés", english: "inglés", portugues: "portugués", portuguese: "portugués", espanol: "español", spanish: "español", italiano: "italiano", italian: "italiano", frances: "francés", french: "francés", aleman: "alemán", german: "alemán" };
const normLang = (l: string) => LANG_EN[fold(l).split(" ")[0]] ?? fold(l);
const HIGH = /(native|nativo|bilingual|bilingue|fluent|fluido|advanced|avanzado|c1|c2|proficient|full professional|profesional completo)/;
const MID = /(intermediate|intermedio|b1|b2|conversational|conversacional|limited working|profesional limitado|upper)/;
const langRank = (level: string) => (HIGH.test(fold(level)) ? 3 : MID.test(fold(level)) ? 2 : level.trim() ? 1 : 0);

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
  /** "reglas": sólo la primera etapa. "ia": re-evaluada con IA (rerank.ts). */
  depth: "reglas" | "ia";
  /** Puntaje por componente, con su razón. Lo usan la API y las evaluaciones; la tarjeta no lo muestra. */
  breakdown: ScoreBreakdown;
  reasons: string[];
  gaps: string[];
  pending: string[];
  salary: string | null;
  sources: SourceLink[];
  reviewedAt: string;
  reviewedLabel: string;
  publishedAt: string | null;
  /** Cuándo la vimos por primera vez: se muestra si la fuente no informa la fecha de publicación. */
  firstSeenAt: string;
  /** Antigüedad relativa de la fuente cuando no hay fecha exacta (Google Jobs). */
  postedLabel?: string;
  logo?: string;
  excerpt: string;
  descriptionComplete: boolean;
  status: "abierta" | "cerrada";
  external?: boolean;
  saved?: boolean;
};

export type ScorePart = { puntos: number; max: number; razon: string };
export type ScoreBreakdown = {
  rol: ScorePart;
  seniority: ScorePart;
  requisitos: ScorePart;
  preferencias: ScorePart;
  /** true si el total quedó topeado por un encaje de rol bajo. */
  tope: boolean;
  nivelAviso: Seniority | null;
  nivelCierto: boolean;
};

/** Las razones de contexto (modalidad, ciudad, país) nunca van primero y como mucho va una. */
function pickReasons(scored: [number, string][]): string[] {
  const sorted = [...scored].sort((a, b) => b[0] - a[0]).filter((r, i, arr) => arr.findIndex((x) => x[1] === r[1]) === i);
  const main = sorted.filter((r) => r[0] >= 0.5).map((r) => r[1]);
  // Sin una razón de rol, requisitos o salario, el contexto solo no justifica mostrarla "por algo".
  const context = main.length ? sorted.find((r) => r[0] < 0.5)?.[1] : undefined;
  return [...main.slice(0, context ? 2 : 3), ...(context ? [context] : [])].slice(0, 3);
}

export type Filters = {
  families?: RoleFamily[];
  location?: string;
  workplaces?: Workplace[];
  seniorities?: Seniority[];
  language?: "sin_ingles" | "con_ingles";
  maxAgeDays?: number;
  salaryPublished?: boolean;
  /** Sólo los que publican el salario en dólares (remotos para afuera, sobre todo). */
  salaryUsd?: boolean;
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
  const desiredTokens = prefs.rolesDeseados.map((r) => ({ label: r, toks: roleTokens(r), role: parseRole(r) })).filter((r) => r.toks.size);
  const objetivoTokens = new Set([...roleTokens(prefs.objetivo)].filter((t) => !GOAL_FILLER.has(t)));
  const desiredFamilies = new Set<RoleFamily>(desired.map(familyFromTitle).filter((x) => x !== "otros"));
  const professionalTitles = [...new Set([...profile.titles.slice(0, 3), profile.headline].filter((t) => t.trim()))];
  const pastTitles = professionalTitles.map((t) => ({ label: t, toks: roleTokens(t), role: parseRole(t) }));
  const pastFamilies = new Set<RoleFamily>(professionalTitles.map(familyFromTitle).filter((x) => x !== "otros"));
  const avoid = prefs.evitar.map((e) => fold(e)).filter((e) => e.length > 2);
  const range = targetRange(prefs, profile);
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
    const sal = o.salary?.value;
    // Mismo moneda y período: se compara acá. Otra moneda o sin moneda: lo normaliza la IA.
    const salaryOk = salaryMeets(sal, prefs);
    hardCheck("salario", salaryOk !== null, salaryOk === true, "No informa salario comparable con tu expectativa.");
    // Filtros eliminatorios: salario publicado menor al pedido, nivel inferior y otra función.
    if (salaryOk === false) excludedByHard = true;
    let pl = postingLevel(o.title, ex, primary?.descriptionText ?? "");
    const lv = levelVerdict(pl, range);
    // "Administrativo contable" o "Recepcionista" sin nivel: por el cargo es un puesto de apoyo.
    // Se estima junior para ordenar (nunca para descartar), sin mostrarlo como dato del aviso.
    const headWord = parseRole(o.title).headWord;
    const impliedLevel: Seniority | null = !pl.level && headWord && SUPPORT_HEADS.has(headWord) ? "junior" : null;
    if (impliedLevel) pl = { ...pl, level: impliedLevel, certain: false };
    if (lv.action === "excluir") excludedByHard = true;
    else if (lv.action === "pendiente") {
      bucket = "pending";
      pending.push(lv.note!);
    }
    if (functionMismatch(o.title, profile, prefs)) excludedByHard = true;
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

    // Encaje de función y rol (40%): el título contra la trayectoria, los roles deseados y el objetivo.
    // El área sola no suma: un Video Editor de marketing no se parece a un Head of Marketing.
    const titleRole = parseRole(o.title);
    const titleToks = roleTokens(o.title);
    const simTo = (r: Role) => roleSimilarity(r, titleRole);
    const bestPast = pastTitles.reduce<{ label: string; sim: number } | null>((a, t) => (!a || simTo(t.role) > a.sim ? { label: t.label, sim: simTo(t.role) } : a), null);
    const bestDesired = desiredTokens.reduce<{ label: string; sim: number } | null>((a, d) => (!a || simTo(d.role) > a.sim ? { label: d.label, sim: simTo(d.role) } : a), null);
    const titleSim = bestPast?.sim ?? 0;
    const desiredSim = bestDesired?.sim ?? 0;
    const kind = desiredTokens.length ? Math.max(...desiredTokens.map((d) => headFit(d.role.head, titleRole.head))) : 1;
    // El objetivo cuenta por lo que dice el título, no por palabras sueltas del aviso ("IA", "ecommerce").
    const objSim = goalCoverage(objetivoTokens, new Set([...titleToks, ...[...findSkills(o.title)].flatMap((s) => [...roleTokens(s)])])) * kind;
    const hasExperience = pastTitles.some((t) => t.toks.size);
    const hasIntent = desiredTokens.length > 0 || objetivoTokens.size > 0;
    // Mismo tipo de puesto en la misma área ("Backend Engineer" y "Software Engineer"): un piso,
    // no un match. El área sola no alcanza.
    const sameKind = pastTitles.some((t) => t.role.head && t.role.head === titleRole.head);
    const kindFloor = pastFamilies.has(ex.family.value) ? (sameKind ? 0.4 : 0.2) : 0;
    // En un cambio de carrera manda lo que busca; si no, también vale lo que ya hizo.
    let roleFit = prefs.carrera === "cambio" && hasIntent
      ? Math.max(desiredSim, objSim, 0.6 * titleSim)
      : Math.max(titleSim, desiredSim, objSim, kindFloor);
    // Querer un rol sin ninguna evidencia en el CV (cargos o habilidades) no es un match.
    if (!hasExperience && !pSkills.size) roleFit *= 0.6;
    note(hasExperience || hasIntent);

    // Encaje de seniority (25%): nivel del aviso contra el buscado o el que muestra el CV.
    const senScore = levelScore(pl, range) ?? 0.5;
    note(!!pl.level && pl.certain);
    const level = pl.level;
    if (level && range) {
      const i = SENIORITY_ORDER.indexOf(level);
      const wanted = SENIORITY_ORDER.slice(range.min, range.max + 1).map((s) => SENIORITY_LABEL[s]).join(" o ");
      if (i < range.min - 1 || i > range.max + 1) {
        gaps.push(impliedLevel
          ? `No dice el nivel, pero por el cargo parece un puesto de apoyo; ${range.chosen ? "apuntás a" : "tu CV muestra"} ${wanted}.`
          : `Es un puesto ${SENIORITY_LABEL[level]}; ${range.chosen ? "apuntás a" : "tu CV muestra"} ${wanted}.`);
      }
    }

    // Requisitos críticos (20%): los obligatorios pesan; "IA", "ecommerce" o "marketing digital" casi no.
    const req = ex.skillsRequired;
    const des = ex.skillsDesirable;
    const weightOf = (xs: string[]) => xs.reduce((s, x) => s + skillWeight(x), 0);
    const matchedReq = req.filter((s) => pSkills.has(s));
    const matchedDes = des.filter((s) => pSkills.has(s));
    let reqScore: number | null = null;
    if (req.length || des.length) {
      const required = req.length ? weightOf(matchedReq) / weightOf(req) : null;
      const desirable = des.length ? weightOf(matchedDes) / weightOf(des) : null;
      reqScore = required !== null && desirable !== null ? 0.85 * required + 0.15 * desirable : required ?? desirable;
      note(pSkills.size > 0);
    } else note(false);
    if (ex.yearsRequired !== null) {
      note(profile.yearsExperience !== null);
      if (profile.yearsExperience === null) pending.push(`Pide ${ex.yearsRequired}+ años de experiencia: confirmá cuántos tenés.`);
    }
    if (ex.yearsRequired !== null && profile.yearsExperience !== null && profile.yearsExperience + 1 < ex.yearsRequired) {
      reqScore = (reqScore ?? 1) * 0.8;
      gaps.push(`Pide ${ex.yearsRequired}+ años de experiencia; tu CV suma alrededor de ${Math.floor(profile.yearsExperience)}.`);
    }
    for (const s of req.filter((s) => !pSkills.has(s)).slice(0, 3)) {
      gaps.push(`Pide ${s} como requisito: no aparece en tu CV. Si lo manejás, sumalo.`);
    }

    // Preferencias (15%): salario, modalidad, contrato e idioma.
    const prefParts: number[] = [];
    if (prefs.modalidades.length && wpValue !== "desconocido") {
      const ok = prefs.modalidades.includes(wpValue);
      prefParts.push(ok ? 1 : 0);
      if (ok) reasonsScored.push([0.4, wpInferred ? `Parece ${WORKPLACE_LABEL[wpValue]}, como preferís (el aviso no lo aclara).` : `Es ${WORKPLACE_LABEL[wpValue]}, como preferís.`]);
      note(true);
    } else if (prefs.modalidades.length) note(false);
    if (prefs.contratos.length && ex.employmentType) {
      prefParts.push(prefs.contratos.includes(ex.employmentType.value) ? 1 : 0.2);
      note(true);
    } else if (prefs.contratos.length) note(false);
    if (prefs.salario?.monto) {
      // Sin salario comparable, nunca puntúa como uno que cumple.
      prefParts.push(salaryOk ? 1 : 0.5);
      if (salaryOk) reasonsScored.push([0.6, `El salario publicado (${formatSalary(sal)}) está en línea con tu expectativa.`]);
      else pending.push(sal ? "Publica salario, pero en otra moneda o período: comparalo vos." : "No informa salario.");
      note(salaryOk !== null);
    }
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
        prefParts.push(0.4);
        langFactor = Math.min(langFactor, 0.85);
        note(true);
      } else { prefParts.push(1); note(true); }
    }
    const prefScore = prefParts.length ? prefParts.reduce((a, b) => a + b, 0) / prefParts.length : null;

    note(o.descriptionComplete);
    note(o.eligibility.status === "elegible");

    // Razones: primero el encaje de rol y nivel, con evidencia del CV.
    const levelFits = !!level && senScore >= 0.7;
    const team = profile.leadership?.teamSize;
    const teamClause = team && level && SENIORITY_ORDER.indexOf(level) >= SENIORITY_ORDER.indexOf("manager") ? `, con un equipo de ${team}+ personas,` : "";
    const levelClause = levelFits ? `encaja con un puesto ${SENIORITY_LABEL[level!]}` : "se relaciona con este puesto";
    if (titleSim >= 0.5 && bestPast && titleSim >= desiredSim) {
      reasonsScored.push([1, `Tu experiencia como ${bestPast.label}${teamClause} ${levelClause}.`]);
    } else if (desiredSim >= 0.5 && bestDesired) {
      reasonsScored.push([0.95, `Coincide con lo que buscás (“${bestDesired.label}”)${levelFits ? ` y con tu nivel (${SENIORITY_LABEL[level!]})` : ""}.`]);
    } else if (objSim >= 0.5) {
      reasonsScored.push([0.9, `El puesto se relaciona con tu objetivo: “${sanitizeDisplay(prefs.objetivo, 160)}”.`]);
    }
    const coreMatched = matchedReq.filter((s) => !GENERIC_SKILLS.has(s));
    const coreDesired = matchedDes.filter((s) => !GENERIC_SKILLS.has(s));
    if (coreMatched.length) reasonsScored.push([0.8, `Tu CV menciona ${list(coreMatched.slice(0, 3))}, que el aviso pide como requisito${coreMatched.length > 1 ? "s" : ""}.`]);
    else if (coreDesired.length) reasonsScored.push([0.55, `Tu CV menciona ${list(coreDesired.slice(0, 3))}, que el aviso valora.`]);
    if (prefs.carrera === "cambio" && !pastFamilies.has(ex.family.value) && desiredFamilies.has(ex.family.value) && reqScore !== null && reqScore >= 0.4) {
      reasonsScored.push([0.75, "Es un cambio de área, pero varias de tus habilidades se transfieren."]);
    }

    const dimensions: [number, number | null][] = [
      [w.rol, roleFit], [w.seniority, senScore], [w.requisitos, reqScore], [w.preferencias, prefScore],
    ];
    const available = dimensions.reduce((sum, [weight, value]) => sum + (value !== null ? weight : 0), 0);
    let raw = (available ? dimensions.reduce((sum, [weight, value]) => sum + weight * (value ?? 0), 0) / available : 0) * langFactor;
    // Si el rol casi no encaja, el resto no lo compensa: el total no pasa de ROLE_CAP y,
    // debajo del tope, sigue ordenado por cuánto encaja el rol.
    const roleCap = ROLE_CAP * (0.4 + 1.2 * roleFit);
    const capped = roleFit < ROLE_FIT_FLOOR && raw > roleCap;
    if (capped) raw = roleCap;

    // Condiciones conocidas que dificultan postularse siguen afectando la afinidad (E0).
    if (wpValue !== "desconocido" && prefs.modalidades.length && !prefs.modalidades.includes(wpValue)) raw *= 0.85;
    // Gran Buenos Aires para quien busca en la ciudad: se viaja, no hay que mudarse.
    const nearBa = userPlaces.some((p) => BA_CITY.test(p)) && o.locations.some((l) => GBA.test(fold(l)) && !OTHER_PROVINCE.test(fold(l)));
    if (wpValue !== "remoto" && wpValue !== "desconocido" && o.locations.length && userPlaces.length && !placeMatches(o.locations) && nearBa) {
      raw *= 0.95;
      gaps.push(`Es ${WORKPLACE_LABEL[wpValue].toLowerCase()} en ${o.locations.slice(0, 2).join(" · ")} (Gran Buenos Aires).`);
    } else if (wpValue !== "remoto" && wpValue !== "desconocido" && o.locations.length && userPlaces.length && !placeMatches(o.locations)) {
      // Presencial en otra ciudad es mudarse o viajar todos los días; híbrido, viajar seguido.
      raw *= wpValue === "presencial" ? 0.7 : 0.75;
      gaps.push(
        wpInferred
          ? `Parece presencial en ${o.locations.slice(0, 2).join(" · ")} (no aclara si es remoto), fuera de los lugares que indicaste.`
          : `Es ${WORKPLACE_LABEL[wpValue].toLowerCase()} en ${o.locations.slice(0, 2).join(" · ")}, fuera de los lugares que indicaste.`,
      );
    }
    // Sin modalidad informada pero con una ciudad concreta fuera de las elegidas: probablemente presencial allá.
    const onlyCountry = o.locations.every((l) => /^\s*(argentina|remote|remoto|latam|latin america)\b/i.test(l));
    if (wpValue === "desconocido" && o.locations.length && !onlyCountry && userPlaces.length && !placeMatches(o.locations)) {
      // Pesa como un híbrido en otra ciudad: casi siempre hay que ir a esa oficina.
      raw *= nearBa ? 0.97 : hard.has("ubicacion") ? 0.7 : 0.8;
      pending.push(`Se publica en ${argentinaFirst(o.locations).slice(0, 2).join(" · ")} y no aclara si es remoto: confirmalo antes de postularte.`);
    }

    // Preferencias de orden: no alteran cuánto coincide el perfil con este aviso.
    let order = raw * (prefs.carrera === "cambio" && hasIntent ? 0.6 + 0.4 * roleFit : 1);
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

    if (wpValue !== "remoto" && userPlaces.length && o.locations.length && placeMatches(o.locations)) reasonsScored.push([0.42, `Es en ${prefs.ciudad.split(",")[0].trim() || "tu ciudad"}, donde buscás.`]);
    if (o.eligibility.status === "elegible") reasonsScored.push([0.38, `Se puede trabajar desde Argentina (${o.eligibility.evidence[0]}).`]);
    if (o.eligibility.timezone) pending.push(`Horario pedido: ${o.eligibility.timezone}. Es una condición horaria, no un permiso de contratación.`);

    const sources = o.postingKeys
      .map((k) => postings.get(k))
      .filter((p): p is StoredPosting => !!p)
      .map((p): SourceLink => {
        if (p.sourceId === "usuario") return { name: "Agregada por vos", url: p.sourceUrl, applyUrl: p.applyUrl, required: false, kind: "usuario" };
        const s = sourceById(p.sourceId);
        return { name: s?.name ?? p.sourceId, url: p.sourceUrl, applyUrl: p.applyUrl, attribution: p.attribution, required: p.linkRequired, kind: s?.kind ?? "portal" };
      })
      // El mismo aviso de LinkedIn puede llegar por dos proveedores (Fantastic y Apify): se muestra una vez.
      .filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i);
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
      seniority: pl.certain && pl.level && pl.level !== impliedLevel ? pl.level : ex.seniority?.value ?? null,
      employmentType: ex.employmentType?.value ?? null,
      // Nunca 100%: es una estimación con los datos disponibles, no una certeza.
      score: Math.min(MAX_SCORE, Math.round(Math.max(0, Math.min(1, raw)) * 100)),
      confidence: conf >= 0.75 ? "alta" : conf >= 0.5 ? "media" : "baja",
      depth: "reglas",
      reasons: pickReasons(reasonsScored),
      breakdown: {
        rol: { puntos: Math.round(roleFit * w.rol * 100), max: Math.round(w.rol * 100), razon: titleSim >= desiredSim && bestPast ? `Título más parecido de tu CV: ${bestPast.label}` : bestDesired ? `Rol buscado más parecido: ${bestDesired.label}` : "Sin cargos ni roles para comparar" },
        seniority: { puntos: Math.round(senScore * w.seniority * 100), max: Math.round(w.seniority * 100), razon: level ? `Aviso ${SENIORITY_LABEL[level]}${pl.certain ? "" : " (dudoso)"}` : "El aviso no informa el nivel" },
        requisitos: { puntos: Math.round((reqScore ?? 0) * w.requisitos * 100), max: Math.round(w.requisitos * 100), razon: reqScore === null ? "El aviso no detalla requisitos" : `${matchedReq.length} de ${req.length} requisitos en tu CV` },
        preferencias: { puntos: Math.round((prefScore ?? 0) * w.preferencias * 100), max: Math.round(w.preferencias * 100), razon: salaryOk === null && prefs.salario?.monto ? "Salario sin comparar" : salaryOk ? "Salario en línea" : "Según modalidad, contrato e idioma" },
        tope: capped,
        nivelAviso: level,
        nivelCierto: pl.certain,
      },
      gaps: gaps.slice(0, 4),
      pending: [...new Set(pending.filter(Boolean))].slice(0, 4),
      salary: formatSalary(sal),
      sources,
      reviewedAt: o.lastVerifiedAt ?? o.lastSeenAt,
      reviewedLabel: o.lastVerifiedAt ? "Revisada en el sitio del empleador" : "Vista por última vez",
      publishedAt: o.publishedAt,
      firstSeenAt: o.firstSeenAt,
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


const BA_CITY = /^(buenos aires|caba|capital federal|ciudad autonoma de buenos aires|cdad autonoma de buenos aires)$/;
/** Partidos y localidades del Gran Buenos Aires (a un viaje de la ciudad). */
const GBA = /\b(gba|gran buenos aires|greater buenos aires|buenos aires-gba|zona (norte|sur|oeste)|vicente lopez|olivos|martinez|san isidro|beccar|boulogne|villa adelina|tigre|pilar|escobar|garin|tortuguitas|don torcuato|general pacheco|benavidez|munro|florida|villa martelli|san martin|tres de febrero|caseros|moron|ramos mejia|haedo|castelar|ituzaingo|hurlingham|san justo|la matanza|la tablada|avellaneda|lanus|gerli|quilmes|bernal|lomas de zamora|banfield|adrogue|temperley|ezeiza|monte grande|berazategui|florencio varela|merlo|moreno|jose c\.? paz|malvinas argentinas)\b/;
const OTHER_PROVINCE = /\b(cordoba|mendoza|tucuman|santa fe|salta|jujuy|neuquen|chubut|rio negro|entre rios|corrientes|misiones|chaco|san juan|san luis|la pampa|catamarca|la rioja|santiago del estero|formosa|santa cruz|tierra del fuego|mar del plata|bahia blanca|la plata)\b/;

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

/**
 * Las fuentes nombran el mismo lugar de muchas formas: quien busca «CABA» también quiere «Capital Federal»,
 * «Cdad. Autónoma de Buenos Aires» y la ciudad como la publica LinkedIn («Buenos Aires, Buenos Aires Province»).
 */
const PLACE_ALIASES: [RegExp, RegExp][] = [
  [/^(caba|capital( federal)?|ciudad (autonoma )?de buenos aires|ciudad autonoma|cdad\.? autonoma.*|buenos aires city)$/, /\b(caba|capital federal|autonoma de buenos aires|ciudad de buenos aires|buenos aires city)\b|^buenos aires\s+buenos aires\b/],
  [/^(gba|gran buenos aires|greater buenos aires|conurbano|amba)$/, /\b(gba|gran buenos aires|greater buenos aires|conurbano|amba)\b/],
];

export function matchesLocation(locations: string[], query: string): boolean {
  const q = fold(query).trim();
  const each = locations.map((l) => fold(l));
  if (each.some((l) => l.includes(q))) return true;
  const alias = PLACE_ALIASES.find(([re]) => re.test(q))?.[1];
  return !!alias && each.some((l) => alias.test(l));
}

function applyFilters(o: Opportunity, primary: StoredPosting | undefined, f: Filters, now: Date): boolean {
  if (f.families?.length && !f.families.includes(o.extracted.family.value)) return false;
  if (f.workplaces?.length && !f.workplaces.includes(o.workplace.value)) return false;
  if (f.seniorities?.length && (!o.extracted.seniority || !f.seniorities.includes(o.extracted.seniority.value))) return false;
  if (f.location?.trim() && !matchesLocation(o.locations, f.location)) return false;
  if (f.salaryPublished && !o.salary) return false;
  if (f.salaryUsd && o.salary?.value.currency !== "USD") return false;
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
