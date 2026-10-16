import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { groupOpportunities } from "@/lib/match/group";
import { applyBoard, buildOpportunities, emptyInventory, forStorage } from "@/lib/match/inventory";
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
});
