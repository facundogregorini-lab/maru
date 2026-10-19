import { beforeEach, describe, expect, it, vi } from "vitest";
import { rankOpportunities } from "@/lib/match/ranking";
import { rerank, resetRerankCache, type AiEval } from "@/lib/match/rerank";
import { EVAL_CASES, EVAL_NOW, evalInventory } from "./match-eval-cases";

const { opportunities, postings } = evalInventory();
const leader = EVAL_CASES[0];
const postingMap = new Map(postings.map((p) => [p.key, p]));
const oppMap = new Map(opportunities.map((o) => [o.id, o]));

function stage1() {
  return rankOpportunities({ opportunities, postings: postingMap, profile: leader.profile, prefs: leader.prefs, interactions: { saved: [], discarded: [] }, now: EVAL_NOW });
}

/** Evaluación simulada: puntúa por título, sin red. */
function fakeEval(id: string, title: string): AiEval {
  const base: AiEval = {
    id, funcion: "liderazgo de marketing", funcionCompatible: true, nivel: "director", nivelCerteza: "alta", personasACargo: true,
    salario: { fuente: "inferido", moneda: "USD", maxUsdMes: 9000, cumple: "si" },
    descartar: "no", puntos: { rol: 36, seniority: 24, requisitos: 15, preferencias: 12 },
    razones: { rol: "Rol de liderazgo de marketing", seniority: "Director", requisitos: "Growth y performance", preferencias: "Remoto" },
    razonPrincipal: `Tu experiencia liderando growth en Fever con 70+ personas encaja con ${title}.`,
  };
  if (title.startsWith("Head of Marketing")) return { ...base, puntos: { rol: 40, seniority: 25, requisitos: 18, preferencias: 14 } };
  if (title === "Marketing Director LATAM") return { ...base, salario: { fuente: "publicado", moneda: "USD", maxUsdMes: 6500, cumple: "no" } };
  if (title === "VP of Marketing") return { ...base, nivel: "ejecutivo", salario: { fuente: "inferido", moneda: "USD", maxUsdMes: 5000, cumple: "no" } };
  if (title === "Head of Growth") return { ...base, nivelCerteza: "baja", nivel: "manager" };
  return base;
}

const titleOf = (id: string) => oppMap.get(id)!.title;

beforeEach(() => resetRerankCache());

describe("re-evaluación con IA", () => {
  it("aplica los descartes del servidor, reordena por el puntaje de la IA y usa su razón principal", async () => {
    const evaluate = vi.fn(async (_s: string, _c: string, ids: string[]) => ids.map((id) => fakeEval(id, titleOf(id))));
    const out = await rerank({ result: stage1(), profile: leader.profile, prefs: leader.prefs, opportunities: oppMap, postings: postingMap, evaluate });
    const titles = out.eligible.map((x) => x.title);
    expect(titles[0]).toBe("Head of Marketing - Argentina / Uruguay");
    expect(out.eligible[0].score).toBe(97);
    expect(out.eligible[0].depth).toBe("ia");
    expect(out.eligible[0].reasons[0]).toMatch(/^Tu experiencia liderando growth en Fever/);
    expect(out.eligible[0].breakdown.rol).toMatchObject({ puntos: 40, max: 40 });
    // Salario publicado menor: afuera. Salario inferido menor: se muestra con aviso, no se descarta.
    expect(titles).not.toContain("Marketing Director LATAM");
    expect(out.eligible.find((x) => x.title === "VP of Marketing")?.pending[0]).toMatch(/No publica salario/);
    // Nivel dudoso: pasa a "Por confirmar".
    expect(out.pending.map((x) => x.title)).toContain("Head of Growth");
    expect(out.counts.eligible).toBe(out.eligible.length);
  });

  it("topea en 40 si el rol no encaja", async () => {
    const evaluate = async (_s: string, _c: string, ids: string[]) => ids.map((id) => ({ ...fakeEval(id, titleOf(id)), puntos: { rol: 10, seniority: 25, requisitos: 20, preferencias: 15 } }));
    const out = await rerank({ result: stage1(), profile: leader.profile, prefs: leader.prefs, opportunities: oppMap, postings: postingMap, evaluate });
    expect(Math.max(...out.eligible.map((x) => x.score))).toBe(40);
    expect(out.eligible[0].breakdown.tope).toBe(true);
  });

  it("no vuelve a llamar a la IA para el mismo perfil y aviso", async () => {
    const evaluate = vi.fn(async (_s: string, _c: string, ids: string[]) => ids.map((id) => fakeEval(id, titleOf(id))));
    const args = { profile: leader.profile, prefs: leader.prefs, opportunities: oppMap, postings: postingMap, evaluate };
    await rerank({ result: stage1(), ...args });
    const calls = evaluate.mock.calls.length;
    const again = await rerank({ result: stage1(), ...args });
    expect(evaluate.mock.calls.length).toBe(calls);
    expect(again.ia.cached).toBeGreaterThan(0);
  });

  it("si la IA falla, queda el orden por reglas", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = stage1();
    const out = await rerank({ result: before, profile: leader.profile, prefs: leader.prefs, opportunities: oppMap, postings: postingMap, evaluate: async () => { throw new Error("timeout"); } });
    expect(out.eligible.map((x) => x.id)).toEqual(before.eligible.map((x) => x.id));
    expect(out.ia.failed).toBeGreaterThan(0);
  });

  it("manda los avisos como datos y el perfil sin datos de contacto", async () => {
    let content = "";
    await rerank({ result: stage1(), profile: leader.profile, prefs: leader.prefs, opportunities: oppMap, postings: postingMap, evaluate: async (_s, c, ids) => { content += c; return ids.map((id) => fakeEval(id, titleOf(id))); } });
    expect(content).toContain("<perfil>");
    expect(content).toContain("<aviso>");
    expect(content).toContain("USD 7000 por mes");
  });
});
