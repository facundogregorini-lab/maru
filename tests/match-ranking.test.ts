import { describe, expect, it } from "vitest";
import { fetchAshby, fetchGreenhouse, fetchLever, fetchRemotive } from "@/lib/match/connectors";
import { applyBoard, buildOpportunities, emptyInventory } from "@/lib/match/inventory";
import { profileToMatch, splitSkill, yearsOfExperience } from "@/lib/match/profile";
import { DEFAULT_WEIGHTS, displayLocations, placeSegments, rankOpportunities, samePlace, weightsFromEnv, type RankInput } from "@/lib/match/ranking";
import type { MatchPrefs, MatchProfile } from "@/lib/match/types";
import type { Profile } from "@/lib/schemas";
import { BOARDS, basePrefs, dataProfile, fakeFetch, fixture, noInteractions, noSleep } from "./match-helpers";

const opts = (routes: Record<string, unknown>) => ({ fetchImpl: fakeFetch(routes).impl, sleep: noSleep, retries: 0 });
const NOW = new Date("2026-10-10T12:00:00Z");

async function inventory() {
  const inv = emptyInventory("fixture");
  const t = NOW.toISOString();
  applyBoard(inv, BOARDS.gh.boardId, "greenhouse", await fetchGreenhouse(BOARDS.gh, opts({ "https://boards-api": fixture("greenhouse-board.json") })), t);
  applyBoard(inv, BOARDS.lever.boardId, "lever", await fetchLever(BOARDS.lever, opts({ "https://api.lever.co": fixture("lever-postings.json") })), t);
  applyBoard(inv, BOARDS.ashby.boardId, "ashby", await fetchAshby(BOARDS.ashby, opts({ "https://api.ashbyhq.com": fixture("ashby-board.json") })), t);
  applyBoard(inv, "remotive", "remotive", await fetchRemotive(BOARDS.remotive, opts({ "https://remotive.com": fixture("remotive.json") })), t);
  inv.opportunities = buildOpportunities(inv.postings);
  return inv;
}

async function rank(profile: MatchProfile, prefs: MatchPrefs, extra: Partial<RankInput> = {}) {
  const inv = await inventory();
  return {
    inv,
    out: rankOpportunities({ opportunities: inv.opportunities, postings: new Map(inv.postings.map((p) => [p.key, p])), profile, prefs, interactions: noInteractions, now: NOW, minScore: 0, ...extra }),
  };
}

describe("antigüedad de los avisos", () => {
  const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

  it("baja los de más de 60 días y esconde los de más de 120, salvo los guardados", async () => {
    const { out: fresh } = await rank(dataProfile, basePrefs);
    const target = fresh.eligible[0];
    const { out: old } = await rank(dataProfile, basePrefs, { now: days(75) });
    const aged = old.eligible.find((r) => r.id === target.id);
    expect(aged).toBeDefined();
    expect(aged!.score).toBeLessThan(target.score);

    const { out: gone } = await rank(dataProfile, basePrefs, { now: days(140) });
    expect([...gone.eligible, ...gone.pending]).toHaveLength(0);
    const { out: kept } = await rank(dataProfile, basePrefs, { now: days(140), interactions: { saved: [target.id], discarded: [] } });
    expect(kept.saved.map((r) => r.id)).toContain(target.id);
  });
});

describe("coincidencia mínima", () => {
  it("lo que casi no se parece a lo que busca no se lista como para vos, salvo que filtre por área", async () => {
    const prefs: MatchPrefs = { ...basePrefs, carrera: "continuidad", rolesDeseados: ["Data Analyst"] };
    const { out: all } = await rank(dataProfile, prefs);
    const low = [...all.eligible, ...all.pending].filter((r) => r.score < 25);
    expect(low.length).toBeGreaterThan(0);
    const { out } = await rank(dataProfile, prefs, { minScore: undefined });
    const titles = [...out.eligible, ...out.pending].map((r) => r.title);
    for (const r of low) expect(titles).not.toContain(r.title);
    expect(out.counts.lowMatch).toBeGreaterThanOrEqual(low.length);
    expect(out.eligible[0].title).toBe("Senior Data Analyst");
    const { out: filtered } = await rank(dataProfile, prefs, { minScore: undefined, filters: { families: [low[0].family] } });
    expect([...filtered.eligible, ...filtered.pending].map((r) => r.title)).toContain(low[0].title);
  });

  it("el % nunca llega a 100", async () => {
    const { out } = await rank(dataProfile, { ...basePrefs, carrera: "continuidad", rolesDeseados: ["Data Analyst"] });
    expect(Math.max(...[...out.eligible, ...out.pending].map((r) => r.score))).toBeLessThanOrEqual(98);
  });
});

describe("ranking explicable", () => {
  it("la autorización de trabajo es texto libre: caracteres especiales no rompen el ranking", async () => {
    for (const a of ["C++", "Italia (ciudadanía", "(a+)+$", "[eu"]) {
      await expect(rank(dataProfile, { ...basePrefs, autorizacion: [a] })).resolves.toBeDefined();
    }
    const { out } = await rank(dataProfile, { ...basePrefs, autorizacion: ["Estados Unidos"] });
    expect([...out.eligible, ...out.pending].length).toBeGreaterThan(0);
  });

  it("excluye US only y separa lo que falta confirmar", async () => {
    const { out } = await rank(dataProfile, basePrefs);
    const all = [...out.eligible, ...out.pending].map((r) => r.title);
    expect(all).not.toContain("Customer Support Specialist"); // Remote - US
    expect(all).not.toContain("Sales Development Representative"); // USA Only
    expect(all).not.toContain("Operations Analyst"); // Remote - Brazil
    expect(out.eligible.map((r) => r.title)).toContain("Account Executive, LATAM");
    expect(out.pending.map((r) => r.title)).toContain("Product Manager"); // Remote sin región
    expect(out.eligible.every((r) => r.eligibility.status === "elegible")).toBe(true);
  });

  it("con continuidad, prioriza la experiencia y explica con datos concretos", async () => {
    const { out } = await rank(dataProfile, { ...basePrefs, carrera: "continuidad", rolesDeseados: ["Data Analyst"] });
    const top = out.eligible[0];
    expect(top.title).toBe("Senior Data Analyst");
    expect(top.reasons.length).toBeGreaterThan(0);
    expect(top.reasons.length).toBeLessThanOrEqual(3);
    expect(top.reasons.join(" ")).toMatch(/sql|python|tableau/i);
    expect(top.score).toBeGreaterThanOrEqual(0);
    expect(top.score).toBeLessThanOrEqual(100);
    // El ATS del empleador y el portal quedan como fuentes, con el enlace del portal intacto.
    expect(top.sources.some((s) => s.url.includes("remotive.com") && s.required)).toBe(true);
  });

  it("con cambio de carrera, la intención pesa: sube ventas aunque la experiencia sea en datos", async () => {
    const cont = await rank(dataProfile, { ...basePrefs, carrera: "continuidad" });
    const change = await rank(dataProfile, { ...basePrefs, carrera: "cambio", rolesDeseados: ["Account Executive", "Ventas"] });
    const pos = (list: { title: string }[]) => list.findIndex((r) => r.title === "Account Executive, LATAM");
    expect(pos(change.out.eligible)).toBe(0);
    expect(pos(change.out.eligible)).toBeLessThan(pos(cont.out.eligible));
    expect(change.out.eligible[0].reasons.join(" ")).toMatch(/Coincide con lo que buscás/);
  });

  it("diferencia 'no aparece en tu CV' y nunca afirma que no tenés la habilidad", async () => {
    const noPython = { ...dataProfile, skills: ["SQL", "Tableau"] };
    const { out } = await rank(noPython, basePrefs);
    const da = out.eligible.find((r) => r.title === "Senior Data Analyst" && r.sources.length === 2)!;
    expect(da.gaps.join(" ")).toMatch(/python como requisito: no aparece en tu CV/i);
    expect(da.gaps.join(" ")).not.toMatch(/no ten[eé]s/i);
  });

  it("los indispensables filtran antes y los datos faltantes quedan como pendientes", async () => {
    const prefs: MatchPrefs = { ...basePrefs, modalidades: ["remoto"], indispensables: ["modalidad"] };
    const { out } = await rank(dataProfile, prefs);
    const titles = [...out.eligible, ...out.pending].map((r) => r.title);
    expect(titles).not.toContain("Growth Marketing Manager"); // híbrido
    expect(titles).not.toContain("Customer Success Manager"); // híbrido
    expect(titles).toContain("Account Executive, LATAM");
  });

  it("salario: sólo compara lo publicado y en la misma moneda", async () => {
    const prefs: MatchPrefs = { ...basePrefs, salario: { monto: 3500, moneda: "USD", periodo: "mes", tipo: "bruto" } };
    const { out } = await rank({ ...dataProfile, titles: ["Growth Manager"], skills: ["Google Ads", "SQL"] }, prefs);
    const growth = out.eligible.find((r) => r.title === "Growth Marketing Manager")!;
    expect(growth.salary).toBe("USD 3.000 – 4.000 por mes");
    const ae = out.eligible.find((r) => r.title === "Account Executive, LATAM")!;
    expect(ae.salary).toBeNull();
    expect(ae.pending).toContain("No informa salario.");
  });

  it("menos datos ⇒ menos confianza, no coincidencias inventadas", async () => {
    const { out } = await rank(dataProfile, basePrefs);
    const pm = out.pending.find((r) => r.title === "Product Manager")!;
    expect(pm.confidence).not.toBe("alta");
    expect(pm.salary).toBeNull();
  });

  it("descartar con motivo cambia el orden y saca la oportunidad", async () => {
    const before = await rank(dataProfile, basePrefs);
    const target = before.out.eligible.find((r) => r.title === "Account Executive, LATAM")!;
    const after = await rank(dataProfile, basePrefs, {
      interactions: { saved: [], discarded: [{ id: target.id, reason: "empresa", company: target.company }] },
    });
    const companies = [...after.out.eligible, ...after.out.pending].map((r) => r.company);
    expect(companies).not.toContain(target.company);
  });

  it("los roles a evitar se excluyen", async () => {
    const { out } = await rank(dataProfile, { ...basePrefs, evitar: ["account executive"] });
    expect(out.eligible.map((r) => r.title)).not.toContain("Account Executive, LATAM");
  });

  it("pesos configurables con validación", () => {
    expect(weightsFromEnv("40,35,15,10")).toEqual(DEFAULT_WEIGHTS);
    expect(weightsFromEnv("1,1,1,1").habilidades).toBeCloseTo(0.25);
    expect(weightsFromEnv("x")).toEqual(DEFAULT_WEIGHTS);
  });
});

describe("perfil para el match", () => {
  const p: Profile = {
    nombre: "Ana",
    titulo: "Growth Lead",
    ubicacion: "Buenos Aires",
    email: "ana@mail.com",
    telefono: "",
    linkedin_url: "",
    otros_links: [],
    resumen: "",
    aptitudes: ["SEO"],
    experiencia: [
      { empresa: "A", cargo: "Head of Growth", inicio: "01/2020", fin: "12/2022", ubicacion: "", descripcion: "", logros: ["Bajé el CAC con Google Ads y SQL"], fragmentos_incompletos: [] },
      { empresa: "B", cargo: "Growth Analyst", inicio: "06/2021", fin: "12/2021", ubicacion: "", descripcion: "", logros: [], fragmentos_incompletos: [] },
    ],
    educacion: [],
    idiomas: [{ idioma: "Inglés", nivel: "Avanzado" }],
    certificaciones: [],
  };
  it("suma años sin duplicar superposiciones y no usa datos personales", () => {
    expect(yearsOfExperience(p.experiencia)).toBeCloseTo(2.9, 0);
    const m = profileToMatch(p);
    expect(m.skills).toEqual(expect.arrayContaining(["SEO", "sem", "sql"]));
    expect(JSON.stringify(m)).not.toContain("ana@mail.com");
    expect(Object.keys(m)).not.toContain("nombre");
  });
});

describe("aptitudes largas del CV", () => {
  it("parte un párrafo de aptitudes en habilidades sueltas, sin cortar paréntesis", () => {
    const raw = "Inteligencia Artificial y Automatización: Implementación de LLMs (OpenAI, Anthropic/Claude), diseño de flujos automatizados en n8n, ingeniería de prompts, desarrollo de agentes de IA y optimización de procesos operativos.";
    expect(splitSkill(raw)).toEqual([
      "Implementación de LLMs (OpenAI, Anthropic/Claude)",
      "diseño de flujos automatizados en n8n",
      "ingeniería de prompts",
      "desarrollo de agentes de IA y optimización de procesos operativos",
    ]);
    expect(splitSkill("Google Ads")).toEqual(["Google Ads"]);
    expect(splitSkill("  ")).toEqual([]);
  });
});

describe("ubicaciones", () => {
  const has = (locs: string[], place: string) => placeSegments(locs).some((seg) => samePlace(seg, place));
  it("reconoce la ciudad por partes, sin confundir ciudades que empiezan igual", () => {
    expect(has(["Rosario, Santa Fe"], "rosario")).toBe(true);
    expect(has(["Rosario de Lerma, Salta, Argentina"], "rosario")).toBe(false);
    expect(has(["San Miguel de Tucumán, Tucumán"], "tucuman")).toBe(true);
    expect(has(["Córdoba Capital"], "cordoba")).toBe(true);
  });
  it("muestra cada lugar una vez, Argentina primero y aclara el remoto desde Argentina", () => {
    expect(displayLocations(["Rosario, Santa Fe", "Rosario, Santa Fe, Argentina"])).toEqual(["Rosario, Santa Fe"]);
    expect(displayLocations(["Argentina", "Córdoba"])).toEqual(["Córdoba"]);
    expect(displayLocations(["Mexico - Monterrey", "Argentina - Buenos Aires"])[0]).toBe("Argentina - Buenos Aires");
    expect(displayLocations(["South Africa - Cape Town"], true)[0]).toBe("Remoto desde Argentina");
    expect(displayLocations(["South Africa - Cape Town"])[0]).toBe("South Africa - Cape Town");
    expect(displayLocations(["Remote"], true)).toEqual(["Remoto desde Argentina"]);
  });
});
