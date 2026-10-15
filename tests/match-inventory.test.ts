import { describe, expect, it } from "vitest";
import { fetchGreenhouse, fetchJobicy, fetchRemotive, type Board, type BoardFetch } from "@/lib/match/connectors";
import { CLOSE_AFTER_MISSES, STALE_DAYS, applyBoard, buildOpportunities, emptyInventory } from "@/lib/match/inventory";
import { runSync, type SyncState } from "@/lib/match/sync";
import type { Inventory } from "@/lib/match/types";
import { BOARDS, fakeFetch, fixture, noSleep } from "./match-helpers";

const opts = (routes: Record<string, unknown>) => ({ fetchImpl: fakeFetch(routes).impl, sleep: noSleep, retries: 0 });
const gh = () => fetchGreenhouse(BOARDS.gh, opts({ "https://boards-api.greenhouse.io": fixture("greenhouse-board.json") }));
const rem = () => fetchRemotive(BOARDS.remotive, opts({ "https://remotive.com": fixture("remotive.json") }));

const T1 = "2026-10-10T10:00:00.000Z";
const T2 = "2026-10-11T10:00:00.000Z";
const T3 = "2026-10-12T10:00:00.000Z";

describe("inventario: upserts idempotentes y política de cierre", () => {
  it("una sincronización repetida no duplica registros ni reprocesa avisos sin cambios", async () => {
    const inv = emptyInventory("fixture");
    const a = applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await gh(), T1);
    expect(a.created).toBe(5);
    const b = applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await gh(), T2);
    expect(b).toEqual({ created: 0, updated: 0, unchanged: 5, closed: 0 });
    expect(inv.postings).toHaveLength(5);
    expect(inv.postings[0].firstSeenAt).toBe(T1);
    expect(inv.postings[0].lastSeenAt).toBe(T2);
    expect(inv.postings[0].lastVerifiedAt).toBe(T2); // ATS del empleador = verificación primaria
  });

  it("si la fuente falla no se cierra ningún aviso", async () => {
    const inv = emptyInventory("fixture");
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await gh(), T1);
    for (const t of [T2, T3]) applyBoard(inv, BOARDS.gh.boardId, "greenhouse", null, t);
    expect(inv.postings.every((p) => p.status === "abierta" && p.missedCompleteSyncs === 0)).toBe(true);
  });

  it(`cierra recién tras ${CLOSE_AFTER_MISSES} sincronizaciones completas sin el aviso`, async () => {
    const inv = emptyInventory("fixture");
    const full = await gh();
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", full, T1);
    const without = { ...full, postings: full.postings.filter((p) => p.externalId !== "104") };
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", without, T2);
    expect(inv.postings.find((p) => p.externalId === "104")!.status).toBe("abierta");
    // Un listado incompleto (paginación cortada) no cuenta como ausencia.
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", { ...without, complete: false }, T2);
    expect(inv.postings.find((p) => p.externalId === "104")!.missedCompleteSyncs).toBe(1);
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", without, T3);
    const p = inv.postings.find((x) => x.externalId === "104")!;
    expect(p.status).toBe("cerrada");
    expect(p.closedReason).toMatch(/sincronizaciones completas/);
    // Si reaparece, se reabre.
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", full, "2026-10-13T10:00:00.000Z");
    expect(inv.postings.find((x) => x.externalId === "104")!.status).toBe("abierta");
  });

  it("en un feed parcial la ausencia no cierra; sí la antigüedad", async () => {
    const inv = emptyInventory("fixture");
    const jb = await fetchJobicy(BOARDS.jobicy, opts({ "https://jobicy.com": fixture("jobicy.json") }));
    applyBoard(inv, "jobicy", "jobicy", jb, T1);
    const empty: BoardFetch = { postings: [], complete: false, received: 0 };
    applyBoard(inv, "jobicy", "jobicy", empty, T3);
    expect(inv.postings.every((p) => p.status === "abierta")).toBe(true);
    const later = new Date(new Date(T1).getTime() + (STALE_DAYS + 1) * 86_400_000).toISOString();
    applyBoard(inv, "jobicy", "jobicy", empty, later);
    expect(inv.postings.every((p) => p.status === "cerrada")).toBe(true);
  });

  it("respeta vencimientos explícitos", async () => {
    const inv = emptyInventory("fixture");
    const full = await gh();
    full.postings[0].expiresAt = "2026-10-11T00:00:00.000Z";
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", full, T1);
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", { ...full, postings: full.postings.slice(1) }, T2);
    expect(inv.postings[0]).toMatchObject({ status: "cerrada", closedReason: "Venció según la fuente" });
  });
});

describe("deduplicación", () => {
  it("fusiona la misma vacante vista en el ATS y en un portal, sin perder el enlace obligatorio del portal", async () => {
    const inv = emptyInventory("fixture");
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await gh(), T1);
    applyBoard(inv, "remotive", "remotive", await rem(), T1);
    const opps = buildOpportunities(inv.postings);
    const da = opps.filter((o) => o.title === "Senior Data Analyst");
    // GH 101 + Remotive 555 se fusionan; GH 105 (otra requisición, mismo título) queda aparte.
    expect(da).toHaveLength(2);
    const merged = da.find((o) => o.postingKeys.length === 2)!;
    expect(merged.postingKeys).toEqual(expect.arrayContaining(["greenhouse:acmepagos:101", "remotive:555"]));
    expect(merged.primaryKey).toBe("greenhouse:acmepagos:101"); // el empleador es la fuente principal
    const remotivePosting = inv.postings.find((p) => p.key === "remotive:555")!;
    expect(remotivePosting.applyUrl).toContain("remotive.com"); // no se reemplaza por el ATS
    expect(da.find((o) => o.postingKeys.length === 1)!.postingKeys).toEqual(["greenhouse:acmepagos:105"]);
  });

  it("no fusiona dos requisiciones de la misma bolsa aunque compartan empresa, título y texto", async () => {
    const inv = emptyInventory("fixture");
    const full = await gh();
    const twin = { ...full.postings[0], externalId: "999", sourceUrl: "https://job-boards.greenhouse.io/acmepagos/jobs/999", applyUrl: "https://job-boards.greenhouse.io/acmepagos/jobs/999" };
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", { ...full, postings: [...full.postings, twin] }, T1);
    const opps = buildOpportunities(inv.postings).filter((o) => o.title === "Senior Data Analyst");
    expect(opps).toHaveLength(3);
  });

  it("los IDs de oportunidad son estables entre sincronizaciones", async () => {
    const inv = emptyInventory("fixture");
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await gh(), T1);
    const ids1 = buildOpportunities(inv.postings).map((o) => o.id).sort();
    applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await gh(), T2);
    expect(buildOpportunities(inv.postings).map((o) => o.id).sort()).toEqual(ids1);
  });
});

describe("sincronización", () => {
  function memory(initial: Inventory = emptyInventory("fixture")) {
    let inv = structuredClone(initial);
    let state: SyncState = { lock: null, checkpoint: null };
    return {
      get inv() {
        return inv;
      },
      get state() {
        return state;
      },
      setState(s: SyncState) {
        state = s;
      },
      deps: {
        loadInventory: async () => structuredClone(inv),
        saveInventory: async (i: Inventory) => void (inv = structuredClone(i)),
        loadState: async () => structuredClone(state),
        saveState: async (s: SyncState) => void (state = structuredClone(s)),
      },
    };
  }

  const fetchBoard = async (b: Board): Promise<BoardFetch> => {
    if (b.boardId === "greenhouse:acmepagos") return gh();
    if (b.boardId === "remotive") return rem();
    throw new Error("HTTP 500");
  };

  it("aísla errores por fuente y arma el inventario con las demás", async () => {
    const m = memory();
    const out = await runSync({ ...m.deps, boards: [BOARDS.gh, BOARDS.remotive, BOARDS.lever], fetchBoard, pauseMs: 0 });
    expect(out.status).toBe("completa");
    expect(out.results.find((r) => r.boardId === BOARDS.lever.boardId)!.ok).toBe(false);
    expect(m.inv.opportunities.length).toBeGreaterThan(0);
    expect(m.inv.boards[BOARDS.lever.boardId].consecutiveFailures).toBe(1);
    expect(m.inv.runs[0].errors).toBe(1);
    expect(m.state.lock).toBeNull();
  });

  it("no corre si hay otra ejecución con el bloqueo tomado", async () => {
    const m = memory();
    m.setState({ lock: { owner: "otra", startedAt: new Date().toISOString() }, checkpoint: null });
    const out = await runSync({ ...m.deps, boards: [BOARDS.gh], fetchBoard, pauseMs: 0 });
    expect(out.status).toBe("bloqueada");
    expect(m.inv.postings).toHaveLength(0);
  });

  it("guarda checkpoint al agotar el presupuesto y retoma donde quedó", async () => {
    const m = memory();
    let t = 0;
    const now = () => new Date(Date.UTC(2026, 9, 10) + (t += 1000));
    const first = await runSync({ ...m.deps, boards: [BOARDS.gh, BOARDS.remotive], fetchBoard, pauseMs: 0, budgetMs: 2500, now });
    expect(first.status).toBe("parcial");
    expect(m.state.checkpoint?.done).toEqual([BOARDS.gh.boardId]);
    const second = await runSync({ ...m.deps, boards: [BOARDS.gh, BOARDS.remotive], fetchBoard, pauseMs: 0, now });
    expect(second.status).toBe("completa");
    expect(second.processed).toBe(1); // sólo remotive
    expect(m.state.checkpoint).toBeNull();
    expect(m.inv.postings.some((p) => p.sourceId === "remotive")).toBe(true);
  });

  it("con --only sincroniza algunas bolsas sin borrar las demás", async () => {
    const m = memory();
    await runSync({ ...m.deps, boards: [BOARDS.gh, BOARDS.remotive], fetchBoard, pauseMs: 0 });
    const ghCount = m.inv.postings.filter((p) => p.boardId === BOARDS.gh.boardId).length;
    expect(ghCount).toBeGreaterThan(0);
    await runSync({ ...m.deps, boards: [BOARDS.remotive], activeBoardIds: [BOARDS.gh.boardId, BOARDS.remotive.boardId], fetchBoard, pauseMs: 0 });
    expect(m.inv.postings.filter((p) => p.boardId === BOARDS.gh.boardId)).toHaveLength(ghCount);
  });

  it("una corrida que se queda sin tiempo igual publica oportunidades", async () => {
    const m = memory();
    let t = 0;
    const now = () => new Date(Date.UTC(2026, 9, 10) + (t += 1000));
    const out = await runSync({ ...m.deps, boards: [BOARDS.gh, BOARDS.remotive], fetchBoard, pauseMs: 0, budgetMs: 2500, now });
    expect(out.status).toBe("parcial");
    expect(m.inv.opportunities.length).toBeGreaterThan(0);
    expect(m.inv.generatedAt).not.toBeNull();
  });
});
