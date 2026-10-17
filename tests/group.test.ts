import { describe, expect, it } from "vitest";
import { baseTitle, companyKey, groupOpportunities } from "@/lib/match/group";
import { displayCompany, displayTitle, isConsultora, isGenericCompany } from "@/lib/match/labels";
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

  it("la empresa se compara sin sufijos societarios ni de rubro", () => {
    expect(companyKey("NEO-BIZ Consultores")).toBe(companyKey("Neo-Biz"));
    expect(companyKey("Cerámica Alberdi S.A.")).toBe("ceramica alberdi");
    expect(companyKey("Swiss Medical Group")).toBe("swiss medical");
    expect(companyKey("Grupo")).toBe("grupo");
    const { opportunities } = groupOpportunities([opp("n1", { company: "NEO-BIZ Consultores" }), opp("n2", { company: "Neo-Biz" })]);
    expect(opportunities).toHaveLength(1);
  });

  it("no mezcla una cerrada con una abierta", () => {
    const { opportunities, alias } = groupOpportunities([opp("x1"), opp("x2", { status: "cerrada" })]);
    expect(opportunities.map((o) => o.id).sort()).toEqual(["x1", "x2"]);
    expect(alias.size).toBe(0);
  });
});

describe("títulos con sufijo de lugar y empresas genéricas", () => {
  it("saca del título el lugar pegado al final, pero no la modalidad ni otras aclaraciones", () => {
    expect(baseTitle("Vendedores - Mendoza", ["Mendoza, Capital, Mendoza"])).toBe("Vendedores");
    expect(baseTitle("Administrativo (Rosario)", ["Rosario, Santa Fe"])).toBe("Administrativo");
    expect(baseTitle("Analista Sr. – Zona Norte")).toBe("Analista Sr.");
    expect(baseTitle("Desarrollador .NET (Híbrido)")).toBe("Desarrollador .NET (Híbrido)");
    expect(baseTitle("AI Trainers Network - Polish")).toBe("AI Trainers Network - Polish");
    expect(baseTitle("Mendoza")).toBe("Mendoza");
  });

  it("junta el mismo puesto publicado por ciudad y no junta empresas confidenciales entre sí", () => {
    const { opportunities } = groupOpportunities([
      opp("v1", { title: "Vendedor - Rosario", locations: ["Rosario, Santa Fe"], elig: "elegible" }),
      opp("v2", { title: "Vendedor - Córdoba", locations: ["Córdoba, Córdoba"], elig: "elegible" }),
      opp("c1", { title: "Cajero", company: "Importante empresa del sector", elig: "elegible" }),
      opp("c2", { title: "Cajero", company: "Importante empresa del sector", elig: "elegible" }),
    ]);
    expect(opportunities).toHaveLength(3);
    expect(opportunities.find((o) => o.title.startsWith("Vendedor"))!.locations).toHaveLength(2);
    // El mismo aviso confidencial visto dos veces en el mismo lugar sí se junta.
    const same = groupOpportunities([
      opp("d1", { title: "Vendedor/a", company: "Confidencial", locations: ["Mar del Plata"], elig: "elegible" }),
      opp("d2", { title: "VENDEDOR/A", company: "Confidencial", locations: ["Mar del Plata"], elig: "elegible" }),
    ]);
    expect(same.opportunities).toHaveLength(1);
  });

  it("reconoce nombres genéricos y consultoras sin confundir empresas reales", () => {
    for (const n of ["Importante empresa del sector salud", "Confidencial", "Estudio Contable (Confidencial)", "Empresa de Construcción", "Cliente Anónimo"]) expect(isGenericCompany(n)).toBe(true);
    for (const n of ["La Anónima", "Mercado Libre", "Grupo Gestión", "SBAICSE Sociedad Anónima"]) expect(isGenericCompany(n)).toBe(false);
    expect(displayCompany("Confidential")).toBe("Empresa confidencial");
    for (const n of ["ADN - Recursos Humanos", "ManpowerGroup", "Adecco Argentina S.A.", "Grupo Gestión", "Randstad AR", "EXTRAMEN Empresa de Servicios Eventuales SRL"]) expect(isConsultora(n)).toBe(true);
    for (const n of ["Despegar", "EY", "Naranja X"]) expect(isConsultora(n)).toBe(false);
  });
});

describe("título para mostrar", () => {
  it.each([
    ["REF 21439 Administrativo Hard de Recursos Humanos - Ezeiza", "Administrativo Hard de Recursos Humanos - Ezeiza"],
    ["Ref.21562:Atención al Cliente", "Atención al Cliente"],
    ["Operario logística (req208687) Eventual", "Operario logística Eventual"],
    ["Backend Developer ID89121", "Backend Developer"],
    ["VENDEDOR DE OBRA - CABA Y GBA", "Vendedor de obra - CABA y GBA"],
    ["ANALISTA DE SOPORTE & AUTOMATIZACIÓN (B2B)", "Analista de soporte & automatización (B2B)"],
    ["vendedor mostrador", "Vendedor mostrador"],
    ["iOS Developer", "iOS Developer"],
    ["Senior Data Analyst", "Senior Data Analyst"],
  ])("%s → %s", (raw, shown) => expect(displayTitle(raw)).toBe(shown));
});
