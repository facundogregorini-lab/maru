import { MODALIDADES, type JobQuery } from "./jobFilters";
import { loadInventory } from "./match/load";

/** Buscador simple sobre el inventario real: filtra, ordena por más nuevas y pagina. */

export type JobResult = {
  id: string;
  title: string;
  company: string;
  where: string;
  modalidad: string;
  eligible: boolean;
  postedAt: string;
  applyUrl: string;
  attribution: string;
};

export const PAGE_SIZE = 20;

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

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
  const date = (o: (typeof matches)[number]) => o.publishedAt ?? o.firstSeenAt;
  matches.sort((a, b) => date(b).localeCompare(date(a)));
  const page = matches.slice((query.pagina - 1) * PAGE_SIZE, query.pagina * PAGE_SIZE);
  return {
    total: matches.length,
    results: page.flatMap((o) => {
      const p = postings.get(o.primaryKey);
      if (!p?.applyUrl) return [];
      return [
        {
          id: o.id,
          title: o.title,
          company: o.company,
          where: o.locations.slice(0, 2).join(" · "),
          modalidad: MODALIDADES[o.workplace.value] ?? "",
          eligible: o.eligibility.status === "elegible",
          postedAt: date(o),
          applyUrl: p.applyUrl,
          attribution: p.attribution ?? "",
        },
      ];
    }),
  };
}
