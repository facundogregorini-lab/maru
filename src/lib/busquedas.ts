import { AREAS, MODALIDADES, NIVELES, type JobQuery } from "./jobFilters";
import { loadInventory, resolveId } from "./match/load";
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
  return {
    id: o.id,
    title: o.title,
    company: o.company,
    area: AREAS[o.extracted.family.value] ?? "",
    where: o.locations.slice(0, 2).join(" · ") + (o.locations.length > 2 ? ` · +${o.locations.length - 2}` : ""),
    modalidad: MODALIDADES[o.workplace.value] ?? "",
    contrato: o.extracted.employmentType ? CONTRATOS[o.extracted.employmentType.value] : "",
    nivel: o.extracted.seniority ? (NIVELES[o.extracted.seniority.value] ?? "") : "",
    anios: o.extracted.yearsRequired,
    salario: salaryText(o.salary?.value),
    eligible: o.eligibility.status === "elegible",
    postedAt: o.publishedAt ?? o.firstSeenAt,
    applyUrl: p.applyUrl,
    attribution: p.attribution ?? "",
  };
}

export async function searchJobs(query: JobQuery): Promise<{ total: number; results: JobResult[] }> {
  const { inv, postings } = await loadInventory();
  const words = fold(query.q).split(/\s+/).filter(Boolean);
  const matches = inv.opportunities.filter((o) => {
    if (o.status !== "abierta") return false;
    if (query.donde === "ar" && o.eligibility.status !== "elegible") return false;
    if (query.area && o.extracted.family.value !== query.area) return false;
    if (query.nivel && o.extracted.seniority?.value !== query.nivel) return false;
    if (query.modalidad && o.workplace.value !== query.modalidad) return false;
    if (words.length) {
      const hay = fold(`${o.title} ${o.company}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const date = (o: Opportunity) => o.publishedAt ?? o.firstSeenAt;
  matches.sort((a, b) => date(b).localeCompare(date(a)));
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
