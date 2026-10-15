import type { Directory } from "./directory";
import { boardIdFor } from "./directory";
import { countBy } from "./inventory";
import { SOURCES, enabledSources } from "./sources";
import type { Inventory } from "./types";

/**
 * Métricas de cobertura y calidad para el panel administrativo.
 * Todas son conteos reales del inventario: no hay porcentajes de "cobertura del mercado"
 * porque no tenemos una medición independiente del total.
 */

export type CompanyStatus = "integrada" | "sin_vacantes_elegibles" | "fallida" | "pendiente_primera_sync" | "excluida";

export function companyStatuses(inv: Inventory, dir: Directory) {
  const open = inv.postings.filter((p) => p.status === "abierta");
  return dir.companies.map((c) => {
    if (c.status === "excluida" || !c.sourceId || !c.slug) return { ...c, state: "excluida" as CompanyStatus, open: 0, relevant: 0 };
    const boardId = boardIdFor(c.sourceId, c.slug);
    const b = inv.boards[boardId];
    const mine = open.filter((p) => p.boardId === boardId);
    const relevant = mine.filter((p) => p.eligibility.status !== "no_elegible").length;
    let state: CompanyStatus;
    if (!b) state = "pendiente_primera_sync";
    else if (!b.lastOkAt) state = "fallida";
    else state = relevant ? "integrada" : "sin_vacantes_elegibles";
    return { ...c, state, open: mine.length, relevant, lastError: b?.lastError ?? null, lastOkAt: b?.lastOkAt ?? null };
  });
}

export function coverageMetrics(inv: Inventory, dir: Directory) {
  const openPostings = inv.postings.filter((p) => p.status === "abierta");
  const openOpps = inv.opportunities.filter((o) => o.status === "abierta");
  const postingsByKey = new Map(inv.postings.map((p) => [p.key, p]));
  const companies = companyStatuses(inv, dir);

  // Aporte exclusivo: oportunidades que sólo llegan por esa fuente.
  const exclusive: Record<string, number> = {};
  for (const o of openOpps) {
    const srcs = new Set(o.postingKeys.map((k) => postingsByKey.get(k)?.sourceId).filter(Boolean) as string[]);
    if (srcs.size === 1) {
      const only = [...srcs][0];
      exclusive[only] = (exclusive[only] ?? 0) + 1;
    }
  }
  const lastRun = inv.runs[0] ?? null;
  const active = new Set(enabledSources().map((s) => s.id));

  return {
    generatedAt: inv.generatedAt,
    kind: inv.kind,
    sources: SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      active: active.has(s.id),
      limits: s.limits,
      reviewedAt: s.reviewedAt,
      postingsOpen: openPostings.filter((p) => p.sourceId === s.id).length,
      exclusive: exclusive[s.id] ?? 0,
    })),
    companies: {
      total: companies.length,
      byState: countBy(companies, (c) => c.state),
      list: companies,
    },
    postingsOpen: openPostings.length,
    postingsClosed: inv.postings.length - openPostings.length,
    uniqueOpen: openOpps.length,
    // Publicaciones que se fusionaron con otra (misma oportunidad vista en más de una fuente).
    duplicatesMerged: openOpps.reduce((n, o) => n + Math.max(0, o.postingKeys.filter((k) => postingsByKey.get(k)?.status === "abierta").length - 1), 0),
    eligibility: countBy(openOpps, (o) => o.eligibility.status),
    description: countBy(openOpps, (o) => (o.descriptionComplete ? "completa" : "parcial")),
    byFamily: countBy(openOpps, (o) => o.extracted.family.value),
    bySeniority: countBy(openOpps, (o) => o.extracted.seniority?.value ?? "sin_dato"),
    byWorkplace: countBy(openOpps, (o) => o.workplace.value),
    withSalary: openOpps.filter((o) => o.salary).length,
    lastRun: lastRun && {
      startedAt: lastRun.startedAt,
      finishedAt: lastRun.finishedAt,
      mode: lastRun.mode,
      created: lastRun.created,
      updated: lastRun.updated,
      unchanged: lastRun.unchanged,
      closed: lastRun.closed,
      errors: lastRun.errors,
      failedBoards: lastRun.boards.filter((b) => !b.ok).map((b) => ({ boardId: b.boardId, error: b.error, httpStatus: b.httpStatus })),
    },
  };
}
