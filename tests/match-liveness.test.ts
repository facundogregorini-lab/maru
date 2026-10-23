import { describe, expect, it } from "vitest";
import { applyBoard, buildOpportunities, emptyInventory } from "@/lib/match/inventory";
import { blockedSources, checkImportedLiveness, liveStatus, roundRobin } from "@/lib/match/liveness";
import { normalizeFantastic } from "@/lib/match/providers";

const NOW = "2026-10-20T12:00:00.000Z";
const desc = "Liquidación de impuestos, conciliaciones bancarias y facturación para una empresa de Córdoba. ".repeat(5);
const row = (id: string) => ({ id, title: `Analista ${id}`, organization: "Empresa", url: `https://jobs.example.com/${id}`, date_posted: "2026-10-15T00:00:00", countries_derived: ["Argentina"], description_text: desc });
const publicDns = async () => ["93.184.216.34"];

function inventory() {
  const inv = emptyInventory("fixture");
  const { postings } = normalizeFantastic(["a", "b", "c", "d"].map(row), "fantastic_ats", "test", Date.parse("2026-10-16T00:00:00Z"));
  applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings, complete: false }, "2026-10-16T00:00:00.000Z");
  // Un aviso de un ATS gratuito no se revisa: la sync diaria ya lo verifica.
  applyBoard(inv, "greenhouse:x", "greenhouse", { postings: [{ ...postings[0], sourceId: "greenhouse", boardId: "greenhouse:x", externalId: "gh" }], complete: true }, "2026-10-16T00:00:00.000Z");
  inv.opportunities = buildOpportunities(inv.postings);
  return inv;
}

describe("vigencia de avisos importados", () => {
  it("cierra con 404/410 o texto explícito y no toca bloqueos, errores ni avisos que siguen", async () => {
    const pages: Record<string, () => Response> = {
      "https://jobs.example.com/a": () => new Response("no está", { status: 404 }),
      "https://jobs.example.com/b": () => new Response("<h1>Esta oferta ya no está disponible</h1>", { status: 200 }),
      "https://jobs.example.com/c": () => new Response("rate limited", { status: 429 }),
      "https://jobs.example.com/d": () => new Response("<h1>Analista d</h1><p>Postulate</p>", { status: 200 }),
    };
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return pages[String(input)]?.() ?? new Response("", { status: 500 });
    }) as typeof fetch;
    const inv = inventory();
    const stats = await checkImportedLiveness(inv, NOW, { fetchImpl, resolve: publicDns, pauseMs: 0 });
    expect(stats).toEqual({ checked: 4, closed: 2, open: 1, unknown: 1 });
    expect(calls).not.toContain(expect.stringContaining("gh"));
    const byId = (id: string) => inv.postings.find((p) => p.externalId === id)!;
    expect(byId("a").closedReason).toMatch(/HTTP 404/);
    expect(byId("b").closedReason).toMatch(/ya no esta disponible/);
    expect(byId("c").status).toBe("abierta");
    expect(byId("d").status).toBe("abierta");
    // Dentro de los días mínimos no se vuelve a pedir.
    calls.length = 0;
    await checkImportedLiveness(inv, "2026-10-21T12:00:00.000Z", { fetchImpl, resolve: publicDns, pauseMs: 0 });
    expect(calls).toHaveLength(0);
  });

  it("respeta el tope por corrida y no sigue URLs a redes privadas", async () => {
    const inv = inventory();
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      return new Response("", { status: 302, headers: { location: "http://10.0.0.1/admin" } });
    }) as typeof fetch;
    const resolve = async (host: string) => (host === "10.0.0.1" ? ["10.0.0.1"] : ["93.184.216.34"]);
    const stats = await checkImportedLiveness(inv, NOW, { fetchImpl, resolve, pauseMs: 0, max: 2 });
    expect(stats).toEqual({ checked: 2, closed: 0, open: 0, unknown: 2 });
    expect(n).toBe(2);
  });

  it("saltea fuentes que casi siempre bloquean al bot y sigue con las demás", async () => {
    const inv = inventory();
    // 20 revisiones previas de fantastic_ats sin dato: la fuente bloquea.
    for (let i = 0; i < 20; i++) inv.postings.push({ ...inv.postings[0], key: `x${i}`, externalId: `x${i}`, lastLiveCheckAt: "2026-10-19T00:00:00.000Z", lastLiveResult: "desconocido" });
    expect([...blockedSources(inv)]).toEqual(["fantastic_ats"]);
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      return new Response("ok");
    }) as typeof fetch;
    const stats = await checkImportedLiveness(inv, NOW, { fetchImpl, resolve: publicDns, pauseMs: 0 });
    expect(stats.checked).toBe(0);
    expect(n).toBe(0);
  });

  it("detecta los avisos cerrados de LinkedIn en español", async () => {
    const page = '<section><figure><figcaption class="closed-job__flavor--closed">Ya no se aceptan solicitudes</figcaption></figure></section>';
    expect(await liveStatus(new Response(page))).toMatchObject({ status: "cerrada" });
  });

  it("revisa varias fuentes a la vez, pero de a un pedido por fuente", async () => {
    const inv = inventory();
    // Otra fuente importada con dos avisos.
    for (const id of ["e", "f"]) inv.postings.push({ ...inv.postings[0], key: `apify:${id}`, externalId: id, sourceId: "apify-linkedin", boardId: "apify:linkedin:ar", sourceUrl: `https://other.example.com/${id}` });
    const inFlight = new Map<string, number>();
    let maxPerHost = 0;
    let maxTotal = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const host = new URL(String(input)).host;
      inFlight.set(host, (inFlight.get(host) ?? 0) + 1);
      maxPerHost = Math.max(maxPerHost, inFlight.get(host)!);
      maxTotal = Math.max(maxTotal, [...inFlight.values()].reduce((a, b) => a + b, 0));
      await new Promise((r) => setTimeout(r, 5));
      inFlight.set(host, inFlight.get(host)! - 1);
      return new Response("<h1>Analista</h1>");
    }) as typeof fetch;
    const stats = await checkImportedLiveness(inv, NOW, { fetchImpl, resolve: publicDns, pauseMs: 0 });
    expect(stats.checked).toBe(6);
    expect(maxPerHost).toBe(1);
    expect(maxTotal).toBe(2);
  });

  it("releer datos viejos no reabre un aviso que la revisión cerró después", async () => {
    const inv = inventory();
    const fetchImpl = (async () => new Response("<p>Ya no se aceptan solicitudes</p>")) as typeof fetch;
    await checkImportedLiveness(inv, NOW, { fetchImpl, resolve: publicDns, pauseMs: 0 });
    const a = inv.postings.find((p) => p.externalId === "a")!;
    expect(a.status).toBe("cerrada");
    const again = { postings: [{ ...a, descriptionText: a.descriptionText }], complete: false };
    applyBoard(inv, a.boardId, a.sourceId, again, "2026-10-16T00:00:00.000Z");
    expect(a.status).toBe("cerrada");
    expect(a.lastSeenAt).toBe("2026-10-16T00:00:00.000Z");
    applyBoard(inv, a.boardId, a.sourceId, again, "2026-10-25T00:00:00.000Z");
    expect(a.status).toBe("abierta");
  });

  it("turna entre fuentes para que una grande no se lleve todos los pedidos", () => {
    const items = [..."abcdef"].map((x) => ({ sourceId: "grande", x })).concat([{ sourceId: "chica", x: "1" }, { sourceId: "chica", x: "2" }]);
    expect(roundRobin(items, 5).map((i) => i.x)).toEqual(["a", "1", "b", "2", "c"]);
    expect(roundRobin(items, 100)).toHaveLength(8);
  });

  it("corta al pasar el tope de tiempo y deja el resto para la próxima corrida", async () => {
    const inv = inventory();
    let t = 0;
    const fetchImpl = (async () => {
      t += 60_000; // cada pedido "tarda" un minuto
      return new Response("ok");
    }) as typeof fetch;
    const stats = await checkImportedLiveness(inv, NOW, { fetchImpl, resolve: publicDns, pauseMs: 0, budgetMs: 90_000, clock: () => t });
    expect(stats.checked).toBe(2);
    expect(inv.postings.filter((p) => p.sourceId === "fantastic_ats" && !p.lastLiveCheckAt)).toHaveLength(2);
  });

  it("frases en inglés de LinkedIn y ATS", async () => {
    expect((await liveStatus(new Response("<span>No longer accepting applications</span>"))).status).toBe("cerrada");
    expect((await liveStatus(new Response("Apply now", { status: 200 }))).status).toBe("abierta");
    expect((await liveStatus(new Response("", { status: 403 }))).status).toBe("desconocido");
  });
});
