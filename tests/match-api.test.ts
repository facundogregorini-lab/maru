import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { fetchGreenhouse, fetchRemotive } from "@/lib/match/connectors";
import { assertPublicUrl, safeFetch } from "@/lib/match/http";
import { applyBoard, buildOpportunities, emptyInventory } from "@/lib/match/inventory";
import { resetInventoryCache } from "@/lib/match/load";
import { SOURCES, enabledSources } from "@/lib/match/sources";
import { BOARDS, basePrefs, dataProfile, fakeFetch, fixture, noInteractions, noSleep } from "./match-helpers";

const opts = (routes: Record<string, unknown>) => ({ fetchImpl: fakeFetch(routes).impl, sleep: noSleep, retries: 0 });
let invPath = "";

beforeAll(async () => {
  // Los avisos de prueba son de octubre de 2026: con la fecha real, en unos meses quedarían viejos y ocultos.
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-17T12:00:00Z") });
  const inv = emptyInventory("fixture");
  const t = "2026-10-10T12:00:00.000Z";
  applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await fetchGreenhouse(BOARDS.gh, opts({ "https://boards-api": fixture("greenhouse-board.json") })), t);
  applyBoard(inv, "remotive", "remotive", await fetchRemotive(BOARDS.remotive, opts({ "https://remotive.com": fixture("remotive.json") })), t);
  inv.opportunities = buildOpportunities(inv.postings);
  inv.generatedAt = t;
  invPath = path.join(mkdtempSync(path.join(tmpdir(), "maru-match-")), "inventory.json");
  writeFileSync(invPath, JSON.stringify(inv));
  process.env.MATCH_INVENTORY_PATH = invPath;
  process.env.AUTH_SECRET = "x".repeat(40);
  process.env.ADMIN_EMAILS = "admin@maru.test";
  resetInventoryCache();
});

const { POST: rankingPOST } = await import("@/app/api/match/ranking/route");
const { POST: externaPOST } = await import("@/app/api/match/externa/route");
const { GET: metricasGET } = await import("@/app/api/match/admin/metricas/route");
const { POST: empresaPOST } = await import("@/app/api/match/admin/empresa/route");
const { GET: inventarioGET } = await import("@/app/api/match/inventario/route");

const req = (body: unknown, cookie?: string) =>
  new Request("http://localhost/api/match/ranking", { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

const ext = (id: string, title: string) => ({ id, title, company: "Mi Empresa Secreta", url: "", text: "Descripción privada ".repeat(30), location: "Buenos Aires", addedAt: "2026-10-10T12:00:00.000Z" });

describe("API de ranking: privacidad", () => {
  it("es sin estado: lo que manda una persona no aparece en la respuesta de otra ni se guarda", async () => {
    const before = readFileSync(invPath, "utf8");
    const a = await rankingPOST(req({ profile: dataProfile, prefs: basePrefs, interactions: noInteractions, external: [ext("u-a-1", "Analista privada de Ana")] }));
    expect(a.status).toBe(200);
    const aj = await a.json();
    expect(JSON.stringify(aj)).toContain("Analista privada de Ana");
    const b = await rankingPOST(req({ profile: { ...dataProfile, titles: ["Vendedor"] }, prefs: basePrefs, interactions: noInteractions }));
    const bj = await b.json();
    expect(JSON.stringify(bj)).not.toContain("Analista privada de Ana");
    expect(JSON.stringify(bj)).not.toContain("Mi Empresa Secreta");
    expect(readFileSync(invPath, "utf8")).toBe(before);
    expect(b.headers.get("cache-control")).toBe("no-store");
  });

  it("valida la entrada y rechaza pedidos inválidos o enormes", async () => {
    expect((await rankingPOST(req({ profile: {}, prefs: basePrefs }))).status).toBe(400);
    const big = new Request("http://localhost/api/match/ranking", { method: "POST", body: "x".repeat(250_000) });
    expect((await rankingPOST(big)).status).toBe(413);
  });

  it("recorta texto largo en vez de rechazar (aptitudes y cargos tal como vienen del CV)", async () => {
    const long = "Infraestructura y Desarrollo Web: GitHub, Vercel, administración de dominios, servidores, certificados SSL y plataformas de hosting (Hostinger, Wiroos).";
    const profile = { ...dataProfile, skills: [...dataProfile.skills, long], titles: ["x".repeat(300), ...dataProfile.titles], yearsExperience: 99 };
    const prefs = { ...basePrefs, objetivo: "y".repeat(900), rolesDeseados: Array.from({ length: 12 }, (_, i) => `Rol ${i}`) };
    expect((await rankingPOST(req({ profile, prefs, interactions: noInteractions }))).status).toBe(200);
  });

  it("dice qué campo falló cuando el pedido no se puede usar", async () => {
    const res = await rankingPOST(req({ profile: dataProfile, prefs: { ...basePrefs, modalidades: ["en la luna"] }, interactions: noInteractions }));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.fields).toEqual(["modalidad"]);
    expect(j.error).toContain("modalidad");
  });

  it("muestra cifras reales del inventario", async () => {
    const res = await inventarioGET();
    const j = await res.json();
    expect(j.open).toBeGreaterThan(0);
    expect(j.generatedAt).toBe("2026-10-10T12:00:00.000Z");
    // Empresas = empleadores distintos con búsquedas abiertas, nunca más que las búsquedas.
    expect(j.companies).toBeGreaterThan(0);
    expect(j.companies).toBeLessThanOrEqual(j.open);
  });
});

describe("búsquedas externas", () => {
  it("un link de un portal no admitido pide pegar la descripción", async () => {
    const r = await externaPOST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ url: "https://www.bumeran.com.ar/empleos/123" }) }));
    expect(r.status).toBe(422);
    expect((await r.json()).code).toBe("NEEDS_TEXT");
  });
  it("acepta texto pegado", async () => {
    const r = await externaPOST(new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ text: "Buscamos analista ".repeat(20) }) }));
    expect((await r.json()).acceptedText).toBe(true);
  });
});

describe("administración protegida", () => {
  const cookie = (email: string) => `${SESSION_COOKIE}=${createSessionToken(email)}`;
  it("sin sesión 401, sin permiso 403, admin 200", async () => {
    expect((await metricasGET(new Request("http://localhost/x"))).status).toBe(401);
    expect((await metricasGET(new Request("http://localhost/x", { headers: { cookie: cookie("otra@mail.com") } }))).status).toBe(403);
    const ok = await metricasGET(new Request("http://localhost/x", { headers: { cookie: cookie("admin@maru.test") } }));
    expect(ok.status).toBe(200);
    const m = await ok.json();
    expect(m.uniqueOpen).toBeGreaterThan(0);
    expect(m.duplicatesMerged).toBe(2); // GH 101 + Remotive 555, y el mismo puesto de la misma empresa en otra ciudad
    expect(m.sources.find((s: { id: string }) => s.id === "remotive").exclusive).toBeGreaterThan(0);
  });
  it("agregar empresa exige admin y rechaza URLs no admitidas", async () => {
    const body = JSON.stringify({ url: "https://example.com/careers" });
    expect((await empresaPOST(new Request("http://localhost/x", { method: "POST", body }))).status).toBe(401);
    const r = await empresaPOST(new Request("http://localhost/x", { method: "POST", body, headers: { cookie: cookie("admin@maru.test") } }));
    expect(r.status).toBe(422);
  });
});

describe("protección SSRF", () => {
  const pub = async () => ["93.184.216.34"];
  const priv = async () => ["10.0.0.7"];
  it("rechaza protocolos, credenciales, puertos y destinos privados", async () => {
    for (const u of ["file:///etc/passwd", "ftp://x.com/a", "http://user:pass@x.com", "http://x.com:8080/", "http://localhost/", "http://127.0.0.1/", "http://169.254.169.254/latest", "http://[::1]/"]) {
      await expect(assertPublicUrl(u, pub)).rejects.toThrow();
    }
    await expect(assertPublicUrl("https://interno.example.com", priv)).rejects.toThrow("Destino no permitido");
    await expect(assertPublicUrl("https://example.com/job", pub)).resolves.toBeInstanceOf(URL);
  });
  it("revalida cada redirección", async () => {
    const impl = (async (u: RequestInfo | URL) =>
      String(u).includes("example.com") ? new Response("", { status: 302, headers: { location: "http://10.0.0.1/admin" } }) : new Response("secreto")) as typeof fetch;
    await expect(safeFetch("https://example.com/a", { resolve: async (h) => (h === "10.0.0.1" ? ["10.0.0.1"] : ["93.184.216.34"]), fetchImpl: impl })).rejects.toThrow("Destino no permitido");
  });
});

describe("sin dependencias facturables", () => {
  it("sólo se habilitan fuentes gratuitas, y Himalayas queda sin activar", () => {
    expect(enabledSources({}).every((s) => s.cost === "gratis")).toBe(true);
    expect(SOURCES.find((s) => s.id === "himalayas")!.enabled).toBe(false);
    expect(SOURCES.filter((s) => s.cost !== "gratis").every((s) => !s.enabled)).toBe(true);
  });
  it("se pueden deshabilitar fuentes por configuración", () => {
    expect(enabledSources({ MATCH_DISABLED_SOURCES: "remotive,jobicy" }).map((s) => s.id)).not.toContain("remotive");
  });
  it("package.json no suma proveedores pagos de vacantes", () => {
    const pkg = readFileSync(path.join(process.cwd(), "package.json"), "utf8").toLowerCase();
    for (const vendor of ["serpapi", "rapidapi", "jsearch", "theirstack", "jooble"]) expect(pkg).not.toContain(vendor);
  });
});
