import { seniorityFromTitle } from "./extract";
import { fold } from "./text";
import { SENIORITY_ORDER, type Extracted, type MatchPrefs, type MatchProfile, type Salary, type Seniority } from "./types";

/**
 * Encaje de nivel, función y salario: los filtros eliminatorios que corren antes del puntaje.
 * Todo por reglas y sin red. La re-evaluación con IA (rerank.ts) parte de lo que queda.
 */

const idx = (s: Seniority) => SENIORITY_ORDER.indexOf(s);

/* ---------- Nivel del aviso ---------- */

/** Cargos de contribución individual: el título dice que no se gestiona un equipo. */
const IC_TITLE = /\b(analyst|analista|specialist|especialista|coordinator|coordinador|coordinadora|editor|editora|designer|disenador|disenadora|strategist|estratega|associate|assistant|asistente|copywriter|writer|redactor|redactora|generalist|buyer|trafficker|planner|representative|representante|account executive|ejecutiv[oa] de cuentas|consultant|consultor|consultora|technician|tecnic[oa]|auxiliar|operador|operadora|agent|agente|intern|pasante|trainee|developer|desarrollador|desarrolladora|engineer|ingenier[oa]|scientist)\b/;

/** Señales de gestión de personas o de negocio en la descripción. */
const LEADS_TEXT = /\b(direct reports?|reportes directos|personas a (su )?cargo|equipo a (su )?cargo|people management|people manager|manage (a|the) team|managing (a|the) team|lead (a|the) team|leading (a|the) team|build and lead|hire and (lead|manage)|team of \d+|equipo de \d+|liderar (un|el|al) equipo|liderazgo de(l)? equipo|gestionar (un|el|al) equipo|p&l|budget owner(ship)?|own(ing)? the budget|manejo de presupuesto|reporting (directly )?to the (ceo|coo|cmo|cfo|founders?)|reports? (directly )?to the (ceo|coo|cmo|cfo|founders?)|reporta(ra|ndo)? (directamente )?(al|a la) (ceo|coo|cmo|direccion|gerencia general))\b/;

const MANAGER_WORD = /\b(manager|gerente|jefe|jefa)\b/;

export type PostingLevel = {
  level: Seniority | null;
  /** false: el nivel es dudoso ("Manager" sin equipo a cargo, o deducido sólo de los años pedidos). */
  certain: boolean;
  leadsPeople: boolean;
  /** Cargo de contribución individual por el título (analista, especialista, editor…). */
  ic: boolean;
};

/** Nivel del aviso según el título y la descripción (personas a cargo, a quién reporta, P&L). */
export function postingLevel(title: string, extracted: Pick<Extracted, "seniority">, description = ""): PostingLevel {
  const t = ` ${fold(title)} `;
  const fromTitle = seniorityFromTitle(title);
  const leadsPeople = LEADS_TEXT.test(fold(description.slice(0, 8000)));
  if (fromTitle === "ejecutivo" || fromTitle === "director") return { level: fromTitle, certain: true, leadsPeople, ic: false };
  // "Marketing Manager", "Growth Manager": sin equipo a cargo en el aviso, el nivel queda por confirmar.
  if (MANAGER_WORD.test(t)) return { level: "manager", certain: leadsPeople, leadsPeople, ic: false };
  if (fromTitle === "lead") return { level: "lead", certain: true, leadsPeople, ic: false };
  const stated = extracted.seniority?.from === "titulo" || extracted.seniority?.from === "fuente";
  if (IC_TITLE.test(t)) {
    const s = fromTitle ?? extracted.seniority?.value ?? null;
    // Un cargo individual no es de liderazgo, aunque pida muchos años: como mucho, senior.
    const capped = s && idx(s) > idx("senior") ? "senior" : s;
    return { level: capped ?? "semi_senior", certain: !!fromTitle || (stated && capped === s), leadsPeople, ic: true };
  }
  const s = fromTitle ?? extracted.seniority?.value ?? null;
  return { level: s, certain: !!fromTitle || stated, leadsPeople, ic: false };
}

/* ---------- Nivel demostrado en el CV ---------- */

/** El nivel más alto entre los cargos recientes y el equipo a cargo; si no hay datos, los años. */
export function profileLevel(m: MatchProfile): Seniority | null {
  const titles = [m.headline, ...m.titles.slice(0, 3)].filter((t) => t.trim());
  let best: Seniority | null = null;
  const up = (s: Seniority | null) => {
    if (s && (!best || idx(s) > idx(best))) best = s;
  };
  for (const t of titles) {
    // "Cofundador" de una empresa chica no equivale a un C-level de una grande: cuenta como dirección.
    up(/\b(co-?founder|cofundador|cofundadora|founder|fundador|fundadora)\b/.test(fold(t)) ? "director" : seniorityFromTitle(t));
  }
  const team = m.leadership?.teamSize ?? null;
  if (team !== null) up(team >= 15 ? "director" : team >= 3 ? "manager" : null);
  if (best) return best;
  const y = m.yearsExperience;
  if (y === null) return null;
  if (y < 2) return "junior";
  if (y < 5) return "semi_senior";
  return "senior";
}

/** Rango de niveles buscado: el elegido por la persona o el que muestra su CV. */
export function targetRange(prefs: MatchPrefs, profile: MatchProfile): { min: number; max: number; chosen: boolean } | null {
  if (prefs.seniorities.length) {
    const xs = prefs.seniorities.map(idx);
    return { min: Math.min(...xs), max: Math.max(...xs), chosen: true };
  }
  const p = profileLevel(profile);
  return p ? { min: idx(p), max: idx(p), chosen: false } : null;
}

export type LevelVerdict = { action: "ok" | "pendiente" | "excluir"; note?: string };

/**
 * Filtro de nivel. Sólo se aplica si la persona eligió niveles: excluye lo que está por debajo
 * y lo muy por encima; lo dudoso queda "por confirmar".
 */
export function levelVerdict(pl: PostingLevel, range: ReturnType<typeof targetRange>): LevelVerdict {
  if (!range?.chosen) return { action: "ok" };
  const leadership = range.min >= idx("manager");
  // Un cargo individual nunca es de liderazgo, diga o no su nivel.
  if (pl.ic && leadership) return { action: "excluir" };
  if (!pl.level) {
    return leadership ? { action: "pendiente", note: "No dice el nivel del puesto: confirmá que sea de liderazgo." } : { action: "ok" };
  }
  const i = idx(pl.level);
  if (i < range.min) {
    // Un "Lead" que conduce un equipo puede estar a un paso: se confirma, no se descarta.
    if (pl.leadsPeople && i >= idx("lead") && range.min - i === 1) return { action: "pendiente", note: "El título es de un nivel menor al que buscás, pero menciona equipo a cargo: confirmá el alcance." };
    if (pl.certain) return { action: "excluir" };
    // Nivel deducido (de los años pedidos o por defecto): no alcanza para descartar.
    return leadership ? { action: "pendiente", note: "No queda claro el nivel del puesto: confirmá si tiene equipo a cargo." } : { action: "ok" };
  }
  if (pl.certain && i > range.max + 2) return { action: "excluir" };
  if (!pl.certain && pl.level === "manager" && leadership) return { action: "pendiente", note: "Dice Manager, pero no menciona equipo a cargo: confirmá si gestiona personas." };
  return { action: "ok" };
}

/** Cuánto encaja el nivel del aviso con el buscado (0–1). Penaliza por debajo y por encima. */
export function levelScore(pl: PostingLevel, range: ReturnType<typeof targetRange>): number | null {
  if (!range) return null;
  // Sin nivel informado nunca puntúa como uno que cumple.
  if (!pl.level) return 0.5;
  const i = idx(pl.level);
  const d = i < range.min ? range.min - i : i > range.max ? i - range.max : 0;
  const base = d === 0 ? 1 : d === 1 ? 0.8 : d === 2 ? 0.35 : 0;
  return pl.certain ? base : Math.min(base, 0.75);
}

/* ---------- Función ---------- */

/**
 * Funciones que comparten área con otras pero son otro trabajo: un Video Editor es de
 * "Marketing y comunicación" igual que un Head of Marketing, y no es lo mismo.
 */
const FUNCTIONS: [string, RegExp][] = [
  ["video", /\b(video|videos|videograf\w*|motion (designer|graphics)|filmmaker|animator|animador|animadora|post-?production|postproduccion)\b/],
  ["diseno", /\b(designer|disenador|disenadora|diseno grafico|graphic|ux|ui|art director|director de arte|directora de arte|illustrator|ilustrador|ilustradora)\b/],
  ["contenido", /\b(copywriter|content (writer|creator|editor)|redactor|redactora|writer|ugc|blogger|editor|editora|journalist|periodista)\b/],
  ["comunidad", /\b(community manager|social media (manager|specialist|coordinator|assistant|analyst|executive)|redes sociales|moderator|moderador|moderadora)\b/],
  ["sdr", /\b(sdr|bdr|sales development|business development rep(resentative)?|appointment setter|cold caller|telemarketer|telemarketing|televentas)\b/],
];

export function functionOf(text: string): string | null {
  const t = ` ${fold(text)} `;
  return FUNCTIONS.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** Funciones de la persona: cargos, roles deseados y objetivo. */
export function profileFunctions(profile: MatchProfile, prefs: MatchPrefs): Set<string> {
  const texts = [profile.headline, ...profile.titles, ...prefs.rolesDeseados, prefs.objetivo];
  return new Set(texts.map(functionOf).filter((f): f is string => !!f));
}

/**
 * Excluye un aviso de otra función. No aplica en un cambio de carrera ni si no sabemos
 * qué hizo la persona (sin cargos ni roles deseados).
 */
export function functionMismatch(title: string, profile: MatchProfile, prefs: MatchPrefs): boolean {
  if (prefs.carrera === "cambio") return false;
  if (!profile.titles.length && !profile.headline.trim() && !prefs.rolesDeseados.length) return false;
  const fn = functionOf(title);
  return !!fn && !profileFunctions(profile, prefs).has(fn);
}

/* ---------- Salario ---------- */

const PER_MONTH: Record<Salary["period"], number | null> = { mes: 1, anio: 1 / 12, hora: 160, desconocido: null };

/** Máximo publicado por mes en la moneda del aviso; null si no se puede comparar sin convertir. */
export function monthlyMax(s: Salary): number | null {
  const f = PER_MONTH[s.period];
  const v = s.max ?? s.min;
  return f && v ? v * f : null;
}

export function monthlyWanted(prefs: MatchPrefs): number | null {
  const s = prefs.salario;
  if (!s?.monto) return null;
  return s.periodo === "anio" ? s.monto / 12 : s.monto;
}

/**
 * true/false cuando el salario publicado está en la misma moneda y período comparable;
 * null cuando hay que convertir moneda o inferirla (eso lo resuelve la IA en la segunda etapa).
 */
export function salaryMeets(s: Salary | null | undefined, prefs: MatchPrefs): boolean | null {
  const mine = monthlyWanted(prefs);
  if (!s || mine === null || !prefs.salario || s.currency !== prefs.salario.moneda) return null;
  const theirs = monthlyMax(s);
  return theirs === null ? null : theirs >= mine;
}

/* ---------- Habilidades ---------- */

/** Palabras que aparecen en casi cualquier aviso del área: no justifican un match por sí solas. */
export const GENERIC_SKILLS = new Set(["inteligencia artificial", "ecommerce", "marketing digital", "comunicación"]);
export const skillWeight = (s: string) => (GENERIC_SKILLS.has(s) ? 0.25 : 1);
