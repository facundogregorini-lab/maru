import { z } from "zod";
import { displayCompany, displayTitle } from "./match/labels";
import { ageDays, HIDE_AFTER_DAYS, rankOpportunities } from "./match/ranking";
import type { Interactions, MatchPrefs, MatchProfile, Opportunity, StoredPosting } from "./match/types";

/**
 * Copiloto de Maru: responde con el CV, el match y las guardadas de la persona, y propone acciones
 * que ella ejecuta con un toque (ver un aviso, preparar la postulación, abrir una herramienta, buscar).
 * Lo que propone la IA se valida acá: sólo avisos que le pasamos, herramientas conocidas y textos armados por Maru.
 */

export const TOOLS = {
  cv: { href: "/cv", label: "Mejorar mi CV" },
  carta: { href: "/carta", label: "Escribir una carta" },
  postulacion: { href: "/postulacion", label: "Preparar una postulación" },
  entrevista: { href: "/entrevista", label: "Practicar una entrevista" },
  video: { href: "/video", label: "Armar mi video" },
  match: { href: "/match", label: "Ver mi match" },
  seguimiento: { href: "/seguimiento", label: "Ver mi seguimiento" },
  extension: { href: "/extension", label: "Instalar la extensión" },
} as const;
export type Tool = keyof typeof TOOLS;
const TOOL_IDS = Object.keys(TOOLS) as [Tool, ...Tool[]];
const MODALIDAD = { remoto: "remoto", hibrido: "híbrido", presencial: "presencial" } as const;

export const CopilotOutput = z.object({
  answer: z.string().min(1).max(3000),
  opportunityIds: z.array(z.string()).max(5),
  actions: z
    .array(
      z.object({
        tipo: z.enum(["ver_busqueda", "preparar_postulacion", "ir_a", "buscar"]),
        id: z.string().describe("ID de oportunidades_proporcionadas para ver_busqueda y preparar_postulacion; si no, vacío"),
        herramienta: z.enum([...TOOL_IDS, "ninguna"]).describe("Sólo para ir_a"),
        consulta: z.string().max(80).describe("Sólo para buscar: el puesto o palabra clave, corto"),
        modalidad: z.enum(["remoto", "hibrido", "presencial", "cualquiera"]).describe("Sólo para buscar"),
      }),
    )
    .max(3),
});
export type CopilotRaw = z.infer<typeof CopilotOutput>;

export type CopilotJob = { id: string; title: string; company: string; locations: string[]; score?: number; eligibility: Opportunity["eligibility"]; skills: string[] };
export type CopilotAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "postular"; label: string; id: string; title: string; company: string };

const STOP = new Set(
  "que para como una uno unos unas los las del con por sin sobre entre desde hasta hay soy estoy tengo quiero puedo podes podés busco buscar busqueda trabajo trabajos empleo puesto puestos aviso avisos algo alguna algun alguno mas muy pero porque cual cuales donde cuando este esta esto ese esa eso mis tus sus vos ustedes nos the and for with you your are can how what which job jobs work maru ayudame ayuda mejor mejores".split(" "),
);
export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const bag = (s: string) => ` ${fold(s).replace(/[^a-z0-9+#.]+/g, " ")} `;

/** Palabras con contenido ("producto", "córdoba"), no "como", "para" o "una". */
export function contentWords(text: string): string[] {
  return [...new Set((fold(text).match(/[a-z0-9+#.]{3,}/g) ?? []).filter((w) => !STOP.has(w)))];
}

const isVisible = (o: Opportunity, now: Date) => o.status === "abierta" && o.eligibility.status !== "no_elegible" && !(ageDays(o, now) > HIDE_AFTER_DAYS);

/** Coincidencias de la consulta con el aviso: lo que está en el título pesa el doble. */
function hits(o: Opportunity, words: string[]): number {
  const title = bag(o.title);
  const hay = bag(`${o.title} ${o.company} ${o.locations.join(" ")} ${o.extracted.skillsRequired.join(" ")} ${o.extracted.family.value}`);
  return words.reduce((n, w) => n + (title.includes(` ${w} `) ? 2 : hay.includes(` ${w} `) ? 1 : 0), 0);
}

const toJob = (o: Opportunity, score?: number): CopilotJob => ({
  id: o.id,
  title: displayTitle(o.title),
  company: displayCompany(o.company),
  locations: o.locations.slice(0, 3),
  ...(score !== undefined ? { score } : {}),
  eligibility: o.eligibility,
  skills: o.extracted.skillsRequired.slice(0, 12),
});

export type MatchContext = { profile: MatchProfile; prefs: MatchPrefs; interactions: Interactions };

/**
 * Hasta 8 avisos para el modelo. Con el match de la persona, salen de su ranking (con el % real) y la consulta
 * reordena; sin match, de buscar las palabras de la consulta en el inventario.
 */
export function relevantJobs(input: { opportunities: Opportunity[]; postings: Map<string, StoredPosting>; words: string[]; match?: MatchContext; now: Date }): CopilotJob[] {
  const { opportunities, postings, words, match, now } = input;
  if (match) {
    const ranked = rankOpportunities({ opportunities, postings, profile: match.profile, prefs: match.prefs, interactions: match.interactions, limit: 80, now });
    const byId = new Map(opportunities.map((o) => [o.id, o]));
    const items = [...ranked.eligible, ...ranked.pending].filter((i) => !i.external && byId.has(i.id));
    const scored = items.map((i, rank) => ({ i, rank, h: words.length ? hits(byId.get(i.id)!, words) : 0 }));
    const anyHit = scored.some((s) => s.h > 0);
    return scored
      .filter((s) => !anyHit || s.h > 0)
      .sort((a, b) => b.h - a.h || a.rank - b.rank)
      .slice(0, 8)
      .map((s) => toJob(byId.get(s.i.id)!, s.i.score));
  }
  if (!words.length) return [];
  const date = (o: Opportunity) => o.publishedAt ?? o.firstSeenAt;
  return opportunities
    .filter((o) => isVisible(o, now))
    .map((o) => ({ o, score: hits(o, words) + (o.eligibility.status === "elegible" ? 0.5 : 0) }))
    .filter((it) => it.score >= 1)
    .sort((a, b) => b.score - a.score || date(b.o).localeCompare(date(a.o)))
    .slice(0, 8)
    .map(({ o }) => toJob(o));
}

/** Guardadas que siguen abiertas, para que el copiloto pueda hablar de ellas. */
export function savedJobs(opportunities: Opportunity[], saved: string[], now: Date): CopilotJob[] {
  const ids = new Set(saved.slice(0, 30));
  return opportunities.filter((o) => ids.has(o.id) && isVisible(o, now)).slice(0, 10).map((o) => toJob(o));
}

/**
 * Las acciones que llegan al navegador: validadas y con el texto del botón armado acá, nunca por la IA.
 * Descarta avisos que no se le pasaron, la herramienta en la que ya está y repetidas; como mucho 3.
 */
export function buildActions(raw: CopilotRaw["actions"], jobs: CopilotJob[], path = ""): CopilotAction[] {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const out: CopilotAction[] = [];
  const seen = new Set<string>();
  const push = (key: string, a: CopilotAction) => {
    if (seen.has(key) || out.length >= 3) return;
    seen.add(key);
    out.push(a);
  };
  for (const a of raw) {
    if (a.tipo === "ver_busqueda" || a.tipo === "preparar_postulacion") {
      const job = byId.get(a.id);
      if (!job) continue;
      if (a.tipo === "ver_busqueda") push(`ver:${job.id}`, { kind: "link", label: `Ver ${job.title} (${job.company})`, href: `/busquedas/${encodeURIComponent(job.id)}` });
      else push(`postular:${job.id}`, { kind: "postular", label: `Preparar mi postulación a ${job.title}`, id: job.id, title: job.title, company: job.company });
    } else if (a.tipo === "ir_a") {
      if (a.herramienta === "ninguna") continue;
      const tool = TOOLS[a.herramienta];
      if (path === tool.href || path.startsWith(`${tool.href}/`)) continue;
      push(`ir:${a.herramienta}`, { kind: "link", label: tool.label, href: tool.href });
    } else {
      const q = a.consulta.replace(/\s+/g, " ").trim().slice(0, 60);
      if (!q) continue;
      const params = new URLSearchParams({ q });
      const mod = a.modalidad !== "cualquiera" ? a.modalidad : null;
      if (mod) params.set("modalidad", mod);
      push(`buscar:${fold(q)}:${mod ?? ""}`, { kind: "link", label: `Buscar «${q}»${mod ? ` ${MODALIDAD[mod]}` : ""}`, href: `/busquedas?${params}` });
    }
  }
  return out;
}

/** Lo que el modelo ve del CV: sin datos de contacto. */
export function cvForModel(p: { titulo: string; ubicacion: string; resumen: string; aptitudes: string[]; experiencia: { cargo: string; empresa: string; inicio: string; fin: string; logros: string[] }[] }) {
  return {
    titulo: p.titulo,
    ubicacion: p.ubicacion,
    resumen: p.resumen.slice(0, 800),
    aptitudes: p.aptitudes.slice(0, 40),
    experiencia: p.experiencia.slice(0, 8).map((e) => ({ cargo: e.cargo, empresa: e.empresa, inicio: e.inicio, fin: e.fin, logros: e.logros.slice(0, 6) })),
  };
}
