import { boardIdFor, type Directory } from "@/lib/match/directory";
import type { BoardState, Inventory, StoredPosting } from "@/lib/match/types";
import { boardFromUrl, nameKey } from "./identity";
import type { CompanyStatus, SourceState } from "./sourceState";

export type { CompanyStatus, SourceState } from "./sourceState";
export { STATE_HINT, STATE_LABEL } from "./sourceState";

/**
 * Estado de monitoreo de cada empresa del Radar, contra el directorio y el inventario compartidos de Match
 * (la sincronización diaria de GitHub Actions). Puro: recibe los datos ya cargados.
 */

type Count = { open: number; eligible: number; pending: number };
export type StatusIndex = {
  generatedAt: string | null;
  byBoard: Map<string, Count>;
  byName: Map<string, Count>;
  dirBoards: Set<string>;
  dirByName: Map<string, string[]>;
  boardState: Record<string, BoardState>;
};

/** Fuentes de ATS que tienen conector en Match (las que se pueden incorporar al directorio). */
export const READABLE_ATS = new Set(["greenhouse", "lever", "ashby", "teamtailor", "smartrecruiters", "recruitee", "workday", "breezy", "bamboohr", "hiringroom"]);

const add = (m: Map<string, Count>, k: string, eligibility: string) => {
  const c = m.get(k) ?? { open: 0, eligible: 0, pending: 0 };
  c.open++;
  if (eligibility === "elegible") c.eligible++;
  else if (eligibility === "por_confirmar") c.pending++;
  m.set(k, c);
};

export function buildIndex(inv: Pick<Inventory, "opportunities" | "generatedAt" | "boards">, postings: Map<string, StoredPosting>, dir: Directory): StatusIndex {
  const byBoard = new Map<string, Count>();
  const byName = new Map<string, Count>();
  for (const o of inv.opportunities) {
    if (o.status !== "abierta") continue;
    add(byName, nameKey(o.company), o.eligibility.status);
    const boards = new Set(o.postingKeys.map((k) => postings.get(k)?.boardId).filter((b): b is string => !!b));
    for (const b of boards) add(byBoard, b, o.eligibility.status);
  }
  const dirBoards = new Set<string>();
  const dirByName = new Map<string, string[]>();
  for (const c of dir.companies) {
    if (c.status !== "candidata" || !c.sourceId || !c.slug) continue;
    const b = boardIdFor(c.sourceId, c.slug);
    dirBoards.add(b);
    const k = nameKey(c.name);
    dirByName.set(k, [...(dirByName.get(k) ?? []), b]);
  }
  return { generatedAt: inv.generatedAt, byBoard, byName, dirBoards, dirByName, boardState: inv.boards ?? {} };
}

export type StatusQuery = { name: string; board?: string; careersUrl?: string };

export function statusFor(q: StatusQuery, idx: StatusIndex): CompanyStatus {
  const board = q.board ?? boardFromUrl(q.careersUrl) ?? undefined;
  const key = nameKey(q.name);
  const boards = [...new Set([...(board && idx.dirBoards.has(board) ? [board] : []), ...(idx.dirByName.get(key) ?? [])])];
  const sum = (xs: (Count | undefined)[]) => xs.reduce<Count>((a, c) => ({ open: a.open + (c?.open ?? 0), eligible: a.eligible + (c?.eligible ?? 0), pending: a.pending + (c?.pending ?? 0) }), { open: 0, eligible: 0, pending: 0 });
  const fromBoards = sum(boards.map((b) => idx.byBoard.get(b)));
  const fromName = idx.byName.get(key) ?? { open: 0, eligible: 0, pending: 0 };
  // Por nombre también entran los de portales; nunca menos que lo de sus bolsas.
  const counts = fromName.open >= fromBoards.open ? fromName : fromBoards;
  const states = boards.map((b) => idx.boardState[b]).filter((s): s is BoardState => !!s);
  const lastOkAt = states.map((s) => s.lastOkAt).filter((x): x is string => !!x).sort().pop() ?? null;
  const lastAttemptAt = states.map((s) => s.lastAttemptAt).filter((x): x is string => !!x).sort().pop() ?? null;
  const failing = states.filter((s) => s.consecutiveFailures > 0);
  const lastError = failing[0]?.lastError ?? null;

  let state: SourceState;
  if (boards.length) state = failing.length === states.length && states.length > 0 && failing.length > 0 ? "error" : "monitoreada";
  else if (counts.open > 0) state = "portales";
  else if (board && READABLE_ATS.has(board.split(":")[0])) state = "incorporable";
  else state = "sin_fuente";
  return { state, boards, ...counts, lastOkAt, lastAttemptAt, lastError: lastError ? lastError.slice(0, 200) : null };
}
