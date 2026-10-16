import { FETCHERS, type Board, type BoardFetch } from "./connectors";
import { HttpError, type RetryOptions } from "./http";
import { applyBoard, buildOpportunities, expireImported, purge, recordRun } from "./inventory";
import type { BoardSyncResult, Inventory } from "./types";

/**
 * Orquestación de una sincronización: lotes, checkpoints, bloqueo de ejecuciones simultáneas,
 * presupuesto de tiempo y aislamiento de errores por fuente. Sin disco: recibe funciones para
 * leer/guardar (el script usa archivos; los tests, memoria).
 */

export type SyncState = {
  lock: { owner: string; startedAt: string } | null;
  checkpoint: { runStartedAt: string; done: string[]; results: BoardSyncResult[] } | null;
};

export type SyncDeps = {
  boards: Board[];
  /** Todas las bolsas del directorio. Con `--only` se sincronizan menos, pero no hay que borrar el resto. */
  activeBoardIds?: string[];
  loadInventory: () => Promise<Inventory>;
  saveInventory: (inv: Inventory) => Promise<void>;
  loadState: () => Promise<SyncState>;
  saveState: (s: SyncState) => Promise<void>;
  fetchBoard?: (b: Board, o?: RetryOptions) => Promise<BoardFetch>;
  now?: () => Date;
  log?: (msg: string) => void;
  owner?: string;
  budgetMs?: number;
  batchSize?: number;
  pauseMs?: number;
  lockTtlMs?: number;
  retry?: RetryOptions;
};

export type SyncOutcome = { status: "completa" | "parcial" | "bloqueada"; processed: number; pending: number; results: BoardSyncResult[] };

export async function runSync(deps: SyncDeps): Promise<SyncOutcome> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? (() => {});
  const owner = deps.owner ?? `sync-${process.pid}-${now().getTime()}`;
  const budget = deps.budgetMs ?? 20 * 60_000;
  const batchSize = deps.batchSize ?? 10;
  const pauseMs = deps.pauseMs ?? 300;
  const lockTtl = deps.lockTtlMs ?? 2 * 60 * 60_000;
  const fetchBoard = deps.fetchBoard ?? ((b: Board, o?: RetryOptions) => FETCHERS[b.sourceId](b, o));
  const started = now();

  // 1. Bloqueo: si hay otra ejecución viva, no corremos.
  const state = await deps.loadState();
  if (state.lock && started.getTime() - new Date(state.lock.startedAt).getTime() < lockTtl) {
    log(`Otra sincronización está en curso (${state.lock.owner}); salimos sin tocar nada.`);
    return { status: "bloqueada", processed: 0, pending: deps.boards.length, results: [] };
  }
  state.lock = { owner, startedAt: started.toISOString() };
  await deps.saveState(state);

  try {
    const inv = await deps.loadInventory();
    const resuming = state.checkpoint;
    const done = new Set(resuming?.done ?? []);
    const results: BoardSyncResult[] = [...(resuming?.results ?? [])];
    const runStartedAt = resuming?.runStartedAt ?? started.toISOString();
    const mode = inv.postings.length ? "incremental" : "inicial";
    if (resuming) log(`Retomando desde el checkpoint: ${done.size} bolsas ya procesadas.`);

    const todo = deps.boards.filter((b) => !done.has(b.boardId));
    let processed = 0;
    let totals = { created: 0, updated: 0, unchanged: 0, closed: 0 };

    for (let i = 0; i < todo.length; i++) {
      if (now().getTime() - started.getTime() > budget) {
        state.checkpoint = { runStartedAt, done: [...done], results };
        // Aunque falten bolsas, publicamos lo que ya hay para que la sección no quede vacía.
        inv.opportunities = buildOpportunities(inv.postings);
        inv.generatedAt ??= now().toISOString();
        await deps.saveInventory(inv);
        await deps.saveState(state);
        log(`Presupuesto de tiempo agotado: quedan ${todo.length - i} bolsas para la próxima ejecución.`);
        return { status: "parcial", processed, pending: todo.length - i, results };
      }
      const board = todo[i];
      const t0 = now().getTime();
      const iso = now().toISOString();
      let fetched: BoardFetch | null = null;
      let res: BoardSyncResult;
      try {
        fetched = await fetchBoard(board, deps.retry);
        res = { boardId: board.boardId, ok: true, complete: fetched.complete, received: fetched.received, durationMs: now().getTime() - t0 };
      } catch (err) {
        const status = err instanceof HttpError ? err.status : undefined;
        res = { boardId: board.boardId, ok: false, complete: false, received: 0, error: (err as Error).message.slice(0, 200), httpStatus: status, durationMs: now().getTime() - t0 };
      }
      const s = applyBoard(inv, board.boardId, board.sourceId, fetched, iso);
      totals = { created: totals.created + s.created, updated: totals.updated + s.updated, unchanged: totals.unchanged + s.unchanged, closed: totals.closed + s.closed };
      const prev = inv.boards[board.boardId];
      inv.boards[board.boardId] = {
        boardId: board.boardId,
        sourceId: board.sourceId,
        company: board.company,
        lastAttemptAt: iso,
        lastOkAt: res.ok ? iso : (prev?.lastOkAt ?? null),
        lastError: res.ok ? null : (res.error ?? "Error"),
        ...(res.httpStatus ? { lastHttpStatus: res.httpStatus } : {}),
        consecutiveFailures: res.ok ? 0 : (prev?.consecutiveFailures ?? 0) + 1,
        lastReceived: res.ok ? res.received : (prev?.lastReceived ?? 0),
      };
      log(`${res.ok ? "✓" : "✗"} ${board.boardId}: ${res.ok ? `${res.received} avisos${res.complete ? "" : " (listado parcial)"}` : res.error} · +${s.created} ~${s.updated} =${s.unchanged} cerrados ${s.closed}`);
      results.push(res);
      done.add(board.boardId);
      processed++;

      // Checkpoint por lote: si el proceso muere, la próxima ejecución sigue desde acá.
      if (processed % batchSize === 0) {
        state.checkpoint = { runStartedAt, done: [...done], results };
        // Aunque falten bolsas, publicamos lo que ya hay para que la sección no quede vacía.
        inv.opportunities = buildOpportunities(inv.postings);
        inv.generatedAt ??= now().toISOString();
        await deps.saveInventory(inv);
        await deps.saveState(state);
      }
      if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
    }

    const finished = now().toISOString();
    totals.closed += expireImported(inv, finished);
    purge(inv, finished, new Set(deps.activeBoardIds ?? deps.boards.map((b) => b.boardId)));
    inv.opportunities = buildOpportunities(inv.postings);
    inv.generatedAt = finished;
    recordRun(inv, {
      startedAt: runStartedAt,
      finishedAt: finished,
      mode,
      boards: results,
      ...totals,
      errors: results.filter((r) => !r.ok).length,
    });
    await deps.saveInventory(inv);
    state.checkpoint = null;
    return { status: "completa", processed, pending: 0, results };
  } finally {
    state.lock = null;
    await deps.saveState(state);
  }
}
