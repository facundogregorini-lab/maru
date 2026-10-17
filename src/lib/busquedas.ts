import { AREAS, MODALIDADES, NIVELES, type JobQuery } from "./jobFilters";
import { displayTitle, isInferred } from "./match/labels";
import { loadInventory, resolveId } from "./match/load";
import { relativeAgeDays } from "./match/providers";
import { ageDays, displayLocations, HIDE_AFTER_DAYS } from "./match/ranking";
import type { EmploymentType, Opportunity, Salary } from "./match/types";

/** Buscador simple sobre el inventario real: filtra, ordena por más nuevas y pagina. */

export type JobResult = {
  id: string;
  title: string;
  company: string;
  area: string;
  where: string;
  modalidad: string;
  contrato: string;
  nivel: string;
  anios: number | null;
  salario: string;
  eligible: boolean;
  postedAt: string;
  /** false si la fuente no da fecha exacta: postedAt es cuando Maru la vio por primera vez. */
  postedKnown: boolean;
  logo?: string;
  applyUrl: string;
  attribution: string;
};

export type JobDetail = JobResult & {
  skillsRequired: string[];
  skillsDesirable: string[];
  languages: string[];
  description: string;
};

export const PAGE_SIZE = 20;

const CONTRATOS: Record<EmploymentType, string> = {
  full_time: "Tiempo completo",
  part_time: "Medio tiempo",
  contrato: "Contrato",
  freelance: "Freelance",
  pasantia: "Pasantía",
  temporal: "Temporal",
};
const PERIODO = { hora: "/h", mes: "/mes", anio: "/año", desconocido: "" } as const;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function salaryText(s: Salary | undefined): string {
  if (!s) return "";
  if (s.min || s.max) {
    const n = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v));
    const range = s.min && s.max && s.min !== s.max ? `${n(s.min)} – ${n(s.max)}` : n((s.min || s.max) as number);
    return `${s.currency ? `${s.currency} ` : ""}${range}${PERIODO[s.period]}`;
  }
  return (s.text ?? "").slice(0, 40);
}

type Postings = Awaited<ReturnType<typeof loadInventory>>["postings"];

function toResult(o: Opportunity, postings: Postings): JobResult | null {
  const p = postings.get(o.primaryKey);
  if (!p?.applyUrl) return null;
  const logo = o.postingKeys.map((k) => postings.get(k)?.companyLogo).find(Boolean);
  return {
    id: o.id,
    title: displayTitle(o.title),
    company: o.company,
    area: AREAS[o.extracted.family.value] ?? "",
    where: ((l) => l.slice(0, 2).join(" · ") + (l.length > 2 ? ` · +${l.length - 2}` : ""))(displayLocations(o.locations, o.eligibility.status === "elegible" && o.workplace.value === "remoto")),
    modalidad: MODALIDADES[o.workplace.value] ? `${MODALIDADES[o.workplace.value]}${isInferred(o.workplace) ? " (inferido)" : ""}` : "",
    contrato: o.extracted.employmentType ? CONTRATOS[o.extracted.employmentType.value] : "",
    nivel: o.extracted.seniority ? (NIVELES[o.extracted.seniority.value] ?? "") : "",
    anios: o.extracted.yearsRequired,
    salario: salaryText(o.salary?.value),
    eligible: o.eligibility.status === "elegible",
    postedAt: postedDate(o, postings).iso,
    postedKnown: postedDate(o, postings).known,
    ...(logo ? { logo } : {}),
    applyUrl: p.applyUrl,
    attribution: p.attribution ?? "",
  };
}

/**
 * Cuándo se publicó: la fecha de la fuente, o la que da a entender su "hace 25 días" (Google Jobs),
 * o, si no hay nada, cuándo la vimos por primera vez (known: false).
 */
function postedDate(o: Opportunity, postings: Postings): { iso: string; known: boolean } {
  if (o.publishedAt) return { iso: o.publishedAt, known: true };
  const label = postings.get(o.primaryKey)?.postedLabel;
  const days = label ? relativeAgeDays(label) : null;
  if (days !== null) return { iso: new Date(Date.parse(o.firstSeenAt) - days * 86_400_000).toISOString(), known: true };
  return { iso: o.firstSeenAt, known: false };
}

export async function searchJobs(query: JobQuery, now = new Date()): Promise<{ total: number; results: JobResult[] }> {
  const { inv, postings } = await loadInventory();
  const words = fold(query.q).split(/\s+/).filter(Boolean);
  const matches = inv.opportunities.filter((o) => {
    if (o.status !== "abierta") return false;
    // Los de más de 4 meses no se listan; su página sigue andando para quien tenga el link.
    if (ageDays({ publishedAt: postedDate(o, postings).iso, firstSeenAt: o.firstSeenAt }, now) > HIDE_AFTER_DAYS) return false;
    if (query.donde === "ar" && o.eligibility.status !== "elegible") return false;
    if (query.area && o.extracted.family.value !== query.area) return false;
    if (query.nivel && o.extracted.seniority?.value !== query.nivel) return false;
    if (query.modalidad && o.workplace.value !== query.modalidad) return false;
    if (words.length) {
      // También por lugar: "vendedor córdoba" encuentra vendedores en Córdoba.
      const hay = fold(`${o.title} ${o.company} ${o.locations.join(" ")}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const dates = new Map(matches.map((o) => [o.id, postedDate(o, postings).iso]));
  matches.sort((a, b) => dates.get(b.id)!.localeCompare(dates.get(a.id)!));
  const page = matches.slice((query.pagina - 1) * PAGE_SIZE, query.pagina * PAGE_SIZE);
  return { total: matches.length, results: page.flatMap((o) => toResult(o, postings) ?? []) };
}

/** Una búsqueda abierta con todo lo que sabemos de ella, para su página. */
export async function getJob(id: string): Promise<JobDetail | null> {
  if (!/^[a-f0-9]{6,40}$/.test(id)) return null;
  const { inv, postings, alias } = await loadInventory();
  const real = resolveId(alias, id);
  const o = inv.opportunities.find((x) => x.id === real && x.status === "abierta");
  if (!o) return null;
  const base = toResult(o, postings);
  if (!base) return null;
  const p = postings.get(o.primaryKey);
  return {
    ...base,
    skillsRequired: o.extracted.skillsRequired,
    skillsDesirable: o.extracted.skillsDesirable,
    languages: o.extracted.languages.map((l) => [l.language, l.level].filter(Boolean).join(" ")),
    description: p?.descriptionText ?? "",
  };
}
