import { describe, expect, it } from "vitest";
import { groupOpportunities } from "@/lib/match/group";
import type { Opportunity } from "@/lib/match/types";

const opp = (id: string, o: Partial<Opportunity> & { elig?: Opportunity["eligibility"]["status"] } = {}): Opportunity =>
  ({
    id,
    title: "Product Manager",
    company: "Acme",
    postingKeys: [`k${id}`],
    locations: [`City ${id}`],
    countries: [],
    status: "abierta",
    publishedAt: "2026-10-01T00:00:00.000Z",
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    ...o,
    eligibility: { status: o.elig ?? "no_elegible", evidence: [] },
  }) as unknown as Opportunity;

describe("groupOpportunities", () => {
  it("junta el mismo puesto de la misma empresa y prefiere la que se toma desde Argentina", () => {
    const { opportunities, alias } = groupOpportunities([
      opp("a1", { locations: ["Brazil"] }),
      opp("a2", { locations: ["Argentina"], elig: "elegible" }),
      opp("a3", { title: "product  manager", company: "ACME", locations: ["Chile"] }),
      opp("b1", { title: "Designer" }),
    ]);
    expect(opportunities).toHaveLength(2);
    const pm = opportunities.find((o) => o.title.startsWith("Product"))!;
    expect(pm.id).toBe("a2");
    expect(pm.locations).toEqual(["Argentina", "Brazil", "Chile"]);
    expect(pm.postingKeys).toHaveLength(3);
    expect(alias.get("a1")).toBe("a2");
    expect(alias.get("a3")).toBe("a2");
    expect(alias.has("b1")).toBe(false);
  });

  it("no mezcla una cerrada con una abierta", () => {
    const { opportunities, alias } = groupOpportunities([opp("x1"), opp("x2", { status: "cerrada" })]);
    expect(opportunities.map((o) => o.id).sort()).toEqual(["x1", "x2"]);
    expect(alias.size).toBe(0);
  });
});
