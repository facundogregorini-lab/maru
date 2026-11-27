import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { fetchGreenhouse } from "@/lib/match/connectors";
import { applyBoard, buildOpportunities, emptyInventory } from "@/lib/match/inventory";
import { resetInventoryCache } from "@/lib/match/load";
import { radarAllowed, radarMode } from "@/lib/radar/access";
import { buildIndex, statusFor } from "@/lib/radar/status";
import type { Directory } from "@/lib/match/directory";
import { BOARDS, basePrefs, dataProfile, fakeFetch, fixture, noInteractions, noSleep } from "./match-helpers";

const opts = (routes: Record<string, unknown>) => ({ fetchImpl: fakeFetch(routes).impl, sleep: noSleep, retries: 0 });
const ENV = { ...process.env };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-17T12:00:00Z") });
  const inv = emptyInventory("fixture");
  const t = "2026-10-10T12:00:00.000Z";
  applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await fetchGreenhouse(BOARDS.gh, opts({ "https://boards-api": fixture("greenhouse-board.json") })), t);
  inv.opportunities = buildOpportunities(inv.postings);
  inv.generatedAt = t;
  const file = path.join(mkdtempSync(path.join(tmpdir(), "maru-radar-")), "inventory.json");
  writeFileSync(file, JSON.stringify(inv));
  process.env.MATCH_INVENTORY_PATH = file;
  process.env.AUTH_SECRET = "x".repeat(40);
  resetInventoryCache();
});

afterEach(() => {
  delete process.env.RADAR_ENABLED;
  delete process.env.RADAR_ALLOWLIST;
  process.env.ADMIN_EMAILS = ENV.ADMIN_EMAILS ?? "";
});

const { POST: estadoPOST } = await import("@/app/api/radar/estado/route");
const { GET: accesoGET } = await import("@/app/api/radar/acceso/route");
const { POST: rankingPOST } = await import("@/app/api/match/ranking/route");

const cookie = (email: string) => `${SESSION_COOKIE}=${createSessionToken(email)}`;
const post = (url: string, body: unknown, email?: string) => new Request(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json", ...(email ? { cookie: cookie(email) } : {}) }, body: JSON.stringify(body) });

describe("feature flag del Radar", () => {
  it("apagado por defecto; admins sólo para ADMIN_EMAILS; allowlist opcional", () => {
    expect(radarMode({})).toBe("off");
    expect(radarAllowed("ana@maru.test", {})).toBe(false);
    expect(radarAllowed("ana@maru.test", { RADAR_ENABLED: "admins", ADMIN_EMAILS: "ana@maru.test" })).toBe(true);
    expect(radarAllowed("beto@maru.test", { RADAR_ENABLED: "admins", ADMIN_EMAILS: "ana@maru.test" })).toBe(false);
    expect(radarAllowed(null, { RADAR_ENABLED: "admins", ADMIN_EMAILS: "ana@maru.test" })).toBe(false);
    expect(radarAllowed(null, { RADAR_ENABLED: "1" })).toBe(true);
    expect(radarAllowed("beto@maru.test", { RADAR_ENABLED: "1", RADAR_ALLOWLIST: "Ana@Maru.test, cami@maru.test" })).toBe(false);
    expect(radarAllowed("ana@maru.test", { RADAR_ENABLED: "1", RADAR_ALLOWLIST: "Ana@Maru.test, cami@maru.test" })).toBe(true);
  });

  it("con el flag apagado las rutas responden 404 y la navegación no lo muestra", async () => {
    const res = await estadoPOST(post("/api/radar/estado", { companies: [] }, "ana@maru.test"));
    expect(res.status).toBe(404);
    const acceso = await (await accesoGET(new Request("http://localhost/api/radar/acceso"))).json();
    expect(acceso.enabled).toBe(false);
  });
});

describe("estado de las empresas seguidas", () => {
  it("cruza con el directorio y el inventario: monitoreada, lista para sumar y sin fuente", async () => {
    process.env.RADAR_ENABLED = "1";
    const res = await estadoPOST(
      post("/api/radar/estado", {
        companies: [
          { id: "a", name: "Acme Pagos", careersUrl: "https://job-boards.greenhouse.io/acmepagos" },
          { id: "b", name: "Empresa Nueva", careersUrl: "https://jobs.lever.co/empresanueva" },
          { id: "c", name: "Sin Link SA" },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const d = await res.json();
    // Acme Pagos no está en el directorio real, pero sí tiene avisos en el inventario (por nombre).
    expect(d.statuses.a.open).toBeGreaterThan(0);
    expect(["monitoreada", "portales"]).toContain(d.statuses.a.state);
    expect(d.statuses.b.state).toBe("incorporable");
    expect(d.statuses.c.state).toBe("sin_fuente");
    expect(d.generatedAt).toBe("2026-10-10T12:00:00.000Z");
  });

  it("una bolsa del directorio con la última lectura fallida queda como error, sin perder sus avisos", () => {
    const dir: Directory = { reviewedAt: "", companies: [{ name: "Acme Pagos", sourceId: "greenhouse", slug: "acmepagos", evidence: "x", addedAt: "", status: "candidata" }] };
    const opp = { status: "abierta", company: "Acme Pagos", postingKeys: ["greenhouse:acmepagos:1"], eligibility: { status: "elegible", evidence: [] } };
    const postings = new Map([["greenhouse:acmepagos:1", { boardId: "greenhouse:acmepagos" }]]) as never;
    const boards = { "greenhouse:acmepagos": { boardId: "greenhouse:acmepagos", sourceId: "greenhouse", lastAttemptAt: "2026-11-27", lastOkAt: "2026-11-20", lastError: "HTTP 500", consecutiveFailures: 2, lastReceived: 0 } };
    const idx = buildIndex({ opportunities: [opp] as never, generatedAt: "2026-11-27", boards }, postings, dir);
    const s = statusFor({ name: "Acme Pagos S.A." }, idx);
    expect(s.state).toBe("error");
    expect(s.open).toBe(1);
    expect(s.eligible).toBe(1);
    expect(s.lastOkAt).toBe("2026-11-20");
    expect(s.lastError).toBe("HTTP 500");
  });
});

describe("ranking acotado a las empresas del Radar", () => {
  it("con scope sólo devuelve búsquedas de esas empresas", async () => {
    const body = { profile: dataProfile, prefs: basePrefs, interactions: noInteractions, ia: false };
    const all = await (await rankingPOST(post("/api/match/ranking", body))).json();
    const total = all.eligible.length + all.pending.length;
    expect(total).toBeGreaterThan(0);
    const none = await (await rankingPOST(post("/api/match/ranking", { ...body, scope: { companies: ["Otra Empresa"], boards: [] } }))).json();
    expect(none.eligible.length + none.pending.length).toBe(0);
    const byBoard = await (await rankingPOST(post("/api/match/ranking", { ...body, scope: { companies: [], boards: ["greenhouse:acmepagos"] } }))).json();
    expect(byBoard.eligible.length + byBoard.pending.length).toBe(total);
    const byName = await (await rankingPOST(post("/api/match/ranking", { ...body, scope: { companies: ["acme pagos"], boards: [] } }))).json();
    expect(byName.eligible.length + byName.pending.length).toBe(total);
  });
});
