import type { Board } from "./connectors";
import { enabledSources } from "./sources";

/** Directorio de empleadores (data/match/companies.json) → bolsas a sincronizar. */

export type CompanyEntry = {
  name: string;
  sourceId?: "greenhouse" | "lever" | "ashby" | "teamtailor" | "smartrecruiters" | "recruitee" | "workday";
  slug?: string;
  region?: "us" | "eu";
  sector?: string;
  evidence: string;
  addedAt: string;
  status: "candidata" | "excluida";
  reason?: string;
};

export type Directory = { reviewedAt: string; companies: CompanyEntry[] };

export function boardIdFor(sourceId: string, slug?: string): string {
  return slug ? `${sourceId}:${slug.toLowerCase()}` : sourceId;
}

/** Bolsas activas: portales habilitados + empresas candidatas cuyo ATS está habilitado. */
export function boardsFrom(dir: Directory, env: Record<string, string | undefined> = process.env): Board[] {
  const enabled = new Set(enabledSources(env).map((s) => s.id));
  const boards: Board[] = [];
  for (const id of ["remotive", "jobicy", "getonbrd"] as const) {
    if (enabled.has(id)) boards.push({ sourceId: id, boardId: id });
  }
  const seen = new Set<string>();
  for (const c of dir.companies) {
    if (c.status !== "candidata" || !c.sourceId || !c.slug || !enabled.has(c.sourceId)) continue;
    const boardId = boardIdFor(c.sourceId, c.slug);
    if (seen.has(boardId)) continue;
    seen.add(boardId);
    boards.push({ sourceId: c.sourceId, boardId, slug: c.slug, region: c.region, company: c.name });
  }
  return boards;
}
