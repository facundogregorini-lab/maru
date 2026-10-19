import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { groupOpportunities } from "@/lib/match/group";
import { applyBoard, buildOpportunities, emptyInventory, forStorage } from "@/lib/match/inventory";
import { importedFileOf, readInventoryFile, readInventoryFileSync, writeInventoryFile } from "@/lib/match/inventory-file";
import { loadInventory, resetInventoryCache } from "@/lib/match/load";
import { normalizeFantastic } from "@/lib/match/providers";

const desc = "Liquidación de impuestos, conciliaciones bancarias y facturación para una empresa de Córdoba. ".repeat(5);
const row = (id: string, title = `Analista ${id}`) => ({ id, title, organization: "Empresa", url: `https://jobs.example.com/${id}`, date_posted: "2026-10-15T00:00:00", countries_derived: ["Argentina"], description_text: desc });

describe("almacenamiento compacto del inventario", () => {
  it("no guarda oportunidades y al cargar se reconstruyen con los mismos ids", async () => {
    const inv = emptyInventory("real");
    const { postings } = normalizeFantastic([row("a"), row("b"), row("c", "Analista a")], "fantastic_ats", "t", Date.parse("2026-10-16T00:00:00Z"));
    applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings, complete: false }, "2026-10-16T00:00:00.000Z");
    inv.opportunities = buildOpportunities(inv.postings);
    const stored = forStorage(inv);
    expect(stored.opportunities).toEqual([]);
    expect(stored.postings).toHaveLength(3);

    const file = path.join(mkdtempSync(path.join(tmpdir(), "maru-inv-")), "inventory.json");
    writeFileSync(file, JSON.stringify(stored));
    resetInventoryCache();
    const loaded = await loadInventory(file);
    resetInventoryCache();
    const expected = groupOpportunities(inv.opportunities).opportunities;
    expect(loaded.inv.opportunities.map((o) => o.id).sort()).toEqual(expected.map((o) => o.id).sort());
    expect(loaded.postings.size).toBe(3);
  });

  it("guarda los importados en un archivo aparte y al leer junta los dos", async () => {
    const inv = emptyInventory("real");
    const { postings } = normalizeFantastic([row("a"), row("b")], "fantastic_ats", "t", Date.parse("2026-10-16T00:00:00Z"));
    applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings, complete: false }, "2026-10-16T00:00:00.000Z");
    const ats = { ...postings[0], sourceId: "greenhouse", boardId: "greenhouse:acme", externalId: "g1" };
    applyBoard(inv, "greenhouse:acme", "greenhouse", { postings: [ats], complete: true }, "2026-10-16T00:00:00.000Z");
    const file = path.join(mkdtempSync(path.join(tmpdir(), "maru-inv-")), "inventory.json");
    await writeInventoryFile(file, forStorage(inv));
    const main = JSON.parse(readFileSync(file, "utf8"));
    const imported = JSON.parse(readFileSync(importedFileOf(file), "utf8"));
    expect(main.postings.map((p: { sourceId: string }) => p.sourceId)).toEqual(["greenhouse"]);
    expect(imported.postings).toHaveLength(2);
    expect(existsSync(`${file}.tmp`)).toBe(false);
    expect((await readInventoryFile(file))!.postings).toHaveLength(3);
    expect(readInventoryFileSync(file).postings).toHaveLength(3);
    resetInventoryCache();
    expect((await loadInventory(file)).postings.size).toBe(3);
    resetInventoryCache();
  });

  it("lee un inventario viejo de un solo archivo y no duplica si un aviso está en los dos", async () => {
    const inv = emptyInventory("real");
    const { postings } = normalizeFantastic([row("a")], "fantastic_ats", "t", Date.parse("2026-10-16T00:00:00Z"));
    applyBoard(inv, "fantastic:ats:ar", "fantastic_ats", { postings, complete: false }, "2026-10-16T00:00:00.000Z");
    const file = path.join(mkdtempSync(path.join(tmpdir(), "maru-inv-")), "inventory.json");
    writeFileSync(file, JSON.stringify(forStorage(inv)));
    expect((await readInventoryFile(file))!.postings).toHaveLength(1);
    writeFileSync(importedFileOf(file), JSON.stringify({ postings: inv.postings }));
    expect((await readInventoryFile(file))!.postings).toHaveLength(1);
    expect(await readInventoryFile(path.join(path.dirname(file), "no-existe.json"))).toBeNull();
  });
});
