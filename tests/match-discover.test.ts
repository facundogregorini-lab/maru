import { describe, expect, it } from "vitest";
import { baseName, discoveryCandidates, isAgency, nameMatches, slugGuesses } from "@/lib/match/discover";
import type { Directory } from "@/lib/match/directory";
import type { StoredPosting } from "@/lib/match/types";

const posting = (company: string, extra: Partial<StoredPosting> = {}) =>
  ({ company, title: "Analista de Marketing", sourceId: "apify-linkedin", status: "abierta", eligibility: { status: "elegible" }, extracted: { family: { value: "marketing" } }, ...extra }) as unknown as StoredPosting;

describe("descubrimiento de empleadores en los avisos comprados", () => {
  it("cuenta empresas de avisos importados, elegibles y de las áreas, sin consultoras ni las del directorio", () => {
    const dir = { reviewedAt: "", companies: [{ name: "Clara", evidence: "", addedAt: "", status: "candidata" }] } as Directory;
    const postings = [
      posting("Kraken Inc."), posting("Kraken"), posting("Kraken", { eligibility: { status: "no_elegible" } } as Partial<StoredPosting>),
      posting("Webflow"), posting("Webflow", { sourceId: "greenhouse" } as Partial<StoredPosting>),
      posting("Clara"), posting("Clara"),
      posting("ADN - Recursos Humanos"), posting("ADN - Recursos Humanos"),
      posting("ManpowerGroup"), posting("ManpowerGroup"),
      posting("Acme", { title: "Chofer de reparto" }), posting("Acme", { title: "Chofer" }),
    ];
    expect(discoveryCandidates(postings, dir)).toEqual([{ company: "Kraken Inc.", postings: 2 }]);
  });
  it("arma slugs y verifica el nombre que informa la bolsa", () => {
    expect(baseName("KPMG Argentina")).toBe("kpmg");
    expect(slugGuesses("Canary Technologies")).toEqual({ full: ["canarytechnologies", "canary-technologies"], short: "canary" });
    expect(slugGuesses("Ualá")).toEqual({ full: ["uala"], short: null });
    expect(nameMatches("Kraken Digital Asset Exchange", "Kraken")).toBe(true);
    expect(nameMatches("Canary Health", "Canary Technologies")).toBe(true);
    expect(nameMatches("Deel", "Deeltech")).toBe(false);
    expect(isAgency("Rocket Talent Search")).toBe(true);
    expect(isAgency("Tiendanube")).toBe(false);
  });
});
