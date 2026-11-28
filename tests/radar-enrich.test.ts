import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryDb } from "@/lib/db";
import { enrichCompany, verifyDomain, type Suggester } from "@/lib/radar/enrich";
import { radarRepos } from "@/lib/radar/repo";
import { follow } from "@/lib/radar/service";
import type { FetchLike, NetOptions } from "@/lib/radar/sources/net";
import { userId } from "@/lib/sync/server";

const site = (title: string, desc = "") => new Response(`<html><head><title>${title}</title><meta name="description" content="${desc}"></head></html>`, { headers: { "content-type": "text/html" } });

function net(routes: Record<string, () => Response>): NetOptions {
  const fetchImpl: FetchLike = async (url) => {
    const k = Object.keys(routes).find((r) => url === r || url.startsWith(`${r}?`) || url.startsWith(`${r}/`));
    return k ? routes[k]() : new Response("", { status: 404 });
  };
  return { fetchImpl, resolve: async () => ["93.184.216.34"], sleep: async () => {} };
}

const ANTHROPIC_NET = net({
  "https://anthropic.com": () => site("Home \\ Anthropic", "AI research and products that put safety at the frontier."),
  "https://boards-api.greenhouse.io/v1/boards/anthropic": () => Response.json({ name: "Anthropic" }),
});

beforeEach(() => {
  resetMemoryDb();
  vi.stubEnv("RADAR_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

async function add(name: string) {
  return (await follow(userId("ana@example.com"), { create: { name }, priority: "P1" })).company.id;
}

describe("completar ficha", () => {
  it("con IA: verifica el dominio en el sitio, encuentra el ATS y marca lo no comprobado", async () => {
    const id = await add("anthropic");
    const suggester: Suggester = async () => ({ dominio: "anthropic.com", careers: null, sede: "San Francisco, EE. UU.", etapa: "Privada", empleados: "1000+", descripcion: "Investigación y productos de IA.", sectores: ["IA"], esConocida: true });
    const r = await enrichCompany(id, { suggester, net: ANTHROPIC_NET });
    expect(r).toMatchObject({ verifiedDomain: true, usedAi: true });
    expect(r.company).toMatchObject({ canonicalDomain: "anthropic.com", identity: "dominio", industries: ["IA"], headquarters: "San Francisco, EE. UU." });
    // La descripción sale del sitio oficial, no de la IA.
    expect(r.company.description).toMatch(/safety at the frontier/);
    expect(r.company.estimated).toEqual(expect.arrayContaining(["headquarters", "stage", "employeeBand"]));
    expect(r.company.estimated).not.toContain("description");
    expect(r.sources[0]).toMatchObject({ provider: "greenhouse", externalBoardId: "anthropic", status: "pending" });
  });

  it("un dominio que la IA inventa y el sitio no confirma no se usa", async () => {
    const id = await add("Acme Robotics");
    const suggester: Suggester = async () => ({ dominio: "acme.com", careers: "https://acme.com/careers", sede: null, etapa: null, empleados: null, descripcion: null, sectores: [], esConocida: true });
    const r = await enrichCompany(id, { suggester, net: net({ "https://acme.com": () => site("Acme Corporation — Anvils") }) });
    expect(r.company.canonicalDomain).toBeNull();
    expect(r.verifiedDomain).toBe(false);
    expect(r.sources).toHaveLength(0);
  });

  it("si la IA no conoce la empresa, no completa nada inventado", async () => {
    const id = await add("Startup Ignota");
    const suggester: Suggester = async () => ({ dominio: "ignota.io", careers: null, sede: "Lima", etapa: null, empleados: null, descripcion: null, sectores: [], esConocida: false });
    const r = await enrichCompany(id, { suggester, net: net({}) });
    expect(r.company.canonicalDomain).toBeNull();
    expect(r.filled).toEqual(["sede"]);
    expect(r.company.estimated).toEqual(["headquarters"]);
  });

  it("sin IA: igual encuentra el board por el nombre, confirmado por la API", async () => {
    const id = await add("anthropic");
    const r = await enrichCompany(id, { suggester: null, net: ANTHROPIC_NET });
    expect(r.usedAi).toBe(false);
    expect(r.sources[0]).toMatchObject({ provider: "greenhouse", externalBoardId: "anthropic" });
    expect((await radarRepos().sources.forCompanies([id]))[id]).toHaveLength(1);
  });

  it("nunca pisa datos que ya estaban", async () => {
    const id = await add("anthropic");
    const [c] = await radarRepos().companies.getMany([id]);
    await radarRepos().companies.saveMany([{ ...c!, headquarters: "Londres" }]);
    const suggester: Suggester = async () => ({ dominio: null, careers: null, sede: "San Francisco", etapa: null, empleados: null, descripcion: null, sectores: [], esConocida: true });
    const r = await enrichCompany(id, { suggester, net: ANTHROPIC_NET });
    expect(r.company.headquarters).toBe("Londres");
  });

  it("verifyDomain exige que el sitio nombre a la empresa", async () => {
    expect((await verifyDomain("anthropic.com", "Anthropic", ANTHROPIC_NET)).ok).toBe(true);
    expect((await verifyDomain("anthropic.com", "OpenAI", ANTHROPIC_NET)).ok).toBe(false);
  });
});

describe("autocompletar con IA", () => {
  it("no consulta con menos de 3 letras, cachea por texto y no rompe si la IA falla", async () => {
    const { findCandidates } = await import("@/lib/radar/enrich");
    let calls = 0;
    const finder = async (q: string) => {
      calls++;
      return [{ name: "Anthropic", domain: "anthropic.com", headquarters: "San Francisco", description: `IA (${q})` }];
    };
    expect(await findCandidates("an", finder)).toEqual([]);
    const a = await findCandidates("Antropic", finder);
    const b = await findCandidates("  antropic ", finder);
    expect(a[0].name).toBe("Anthropic");
    expect(b).toEqual(a);
    expect(calls).toBe(1);
    expect(await findCandidates("otra cosa", async () => { throw new Error("caído"); })).toEqual([]);
    expect(await findCandidates("sin ia", null)).toEqual([]);
  });

  it("elegir una sugerencia con dominio: completar ficha lo verifica en el sitio", async () => {
    const id = (await follow(userId("ana@example.com"), { create: { name: "Anthropic", domain: "anthropic.com" } })).company.id;
    expect(id).toBe("d:anthropic.com");
    const r = await enrichCompany(id, { suggester: null, net: ANTHROPIC_NET });
    expect(r.company.domainVerified).toBe(true);
    expect(r.verifiedDomain).toBe(true);
    expect(r.sources[0]).toMatchObject({ provider: "greenhouse", externalBoardId: "anthropic" });
  });
});
