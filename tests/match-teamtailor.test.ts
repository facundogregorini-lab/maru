import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fetchTeamtailor, normalizeTeamtailor, type Board } from "@/lib/match/connectors";
import { applyBoard, emptyInventory } from "@/lib/match/inventory";
import { boardsFrom } from "@/lib/match/directory";

const xml = readFileSync(new URL("./fixtures/match/teamtailor.rss", import.meta.url), "utf8");
const board: Board = { sourceId: "teamtailor", boardId: "teamtailor:acme.na.teamtailor.com", slug: "acme.na.teamtailor.com", company: "Acme Retail" };

describe("Teamtailor (RSS público)", () => {
  it("normaliza título, enlace, modalidad, ubicación, área y fecha; descarta ítems sin título", () => {
    const { postings, items } = normalizeTeamtailor(xml, board);
    expect(items).toBe(3);
    expect(postings).toHaveLength(2);
    const [a, b] = postings;
    expect(a).toMatchObject({ externalId: "721286", company: "Acme Retail", applyUrl: "https://acme.na.teamtailor.com/jobs/721286-analista-de-cuentas-a-pagar", department: "Finanzas", locations: ["Córdoba, Argentina"], countries: ["AR"], publishedAt: "2026-10-14T13:45:00.000Z" });
    expect(a.workplace).toMatchObject({ value: "hibrido", from: "fuente" });
    expect(a.descriptionText).toContain("• Conciliaciones bancarias");
    expect(b.workplace.value).toBe("presencial");
    const inv = emptyInventory("fixture");
    applyBoard(inv, board.boardId, "teamtailor", { postings, complete: true }, "2026-10-16T00:00:00.000Z");
    expect(inv.postings[0].eligibility.status).toBe("elegible");
    expect(inv.postings[0].lastVerifiedAt).toBe("2026-10-16T00:00:00.000Z"); // ATS del empleador
  });

  it("pagina de a 100 y marca el listado completo al llegar a una página incompleta", async () => {
    const calls: string[] = [];
    const page = (n: number) => `<rss><channel>${Array.from({ length: n }, (_, i) => `<item><title>Puesto ${i}</title><link>https://acme.na.teamtailor.com/jobs/${calls.length}-${i}</link><guid>${calls.length}-${i}</guid></item>`).join("")}</channel></rss>`;
    const fetchImpl = (async (url: RequestInfo | URL) => {
      calls.push(String(url));
      return new Response(page(calls.length === 1 ? 100 : 7));
    }) as typeof fetch;
    const res = await fetchTeamtailor(board, { fetchImpl, retries: 0 });
    expect(calls).toEqual(["https://acme.na.teamtailor.com/jobs.rss?per_page=100&offset=0", "https://acme.na.teamtailor.com/jobs.rss?per_page=100&offset=100"]);
    expect(res).toMatchObject({ complete: true, received: 107 });
    expect(res.postings).toHaveLength(107);
  });

  it("rechaza sitios que no son un dominio y entra al directorio como cualquier ATS", async () => {
    await expect(fetchTeamtailor({ ...board, slug: "localhost" }, { retries: 0 })).rejects.toThrow(/inválido/);
    const boards = boardsFrom({ reviewedAt: "", companies: [{ name: "Acme", sourceId: "teamtailor", slug: "acme.na.teamtailor.com", evidence: "x", addedAt: "2026-10-16", status: "candidata" }] }, {});
    expect(boards.find((b) => b.sourceId === "teamtailor")).toMatchObject({ boardId: "teamtailor:acme.na.teamtailor.com", company: "Acme" });
  });
});
