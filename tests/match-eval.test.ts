import { describe, expect, it } from "vitest";
import { rankOpportunities, type RankedItem } from "@/lib/match/ranking";
import { EVAL_CASES, EVAL_NOW as NOW, evalInventory } from "./match-eval-cases";

/**
 * Set de evaluación del orden de /match (caso reportado el 19/10/2026 y tres perfiles más para no
 * sobreajustar). Avisos ficticios con títulos reales del inventario; corre sin red ni IA.
 */

const { opportunities, postings } = evalInventory();

function rank(name: string) {
  const c = EVAL_CASES.find((x) => x.name.startsWith(name))!;
  return rankOpportunities({ opportunities, postings: new Map(postings.map((p) => [p.key, p])), profile: c.profile, prefs: c.prefs, interactions: { saved: [], discarded: [] }, now: NOW });
}
const titles = (xs: RankedItem[]) => xs.map((x) => x.title);

describe("evaluación: líder de growth con Manager/Director/VP y USD 7.000", () => {
  const r = rank("Líder de growth");
  const shown = [...r.eligible, ...r.pending];

  it("no muestra funciones ajenas, niveles inferiores ni salarios menores al pedido", () => {
    for (const t of ["Video Editor", "Video Editor – Performance Creative (E-commerce)", "Analista Marketing Digital", "Programmatic Specialist"]) {
      expect(titles(shown)).not.toContain(t);
    }
    // Head of Growth de Scale Army (USD 3.000–4.000), Growth Marketing Manager (USD 2.500–3.000), Senior Marketing Manager (hasta 5.500).
    expect(shown.filter((x) => x.company === "Scale Army" || x.company.startsWith("Hire Hangar"))).toEqual([]);
  });

  it("deja arriba los roles de liderazgo de marketing y growth", () => {
    const top = titles(r.eligible.slice(0, 5));
    expect(top).toContain("Head of Marketing - Argentina / Uruguay");
    for (const t of ["Head of Growth", "Director of Growth Marketing", "VP of Marketing", "Marketing Director LATAM"]) expect(top).toContain(t);
    expect(r.eligible[0].reasons[0]).toMatch(/^Tu experiencia como .*70\+ personas/);
  });

  it("las razones empiezan por el rol y el nivel, nunca por el área o la modalidad", () => {
    for (const x of r.eligible) {
      expect(x.reasons[0]).not.toMatch(/^(Es del área|Es remoto|Se puede trabajar desde)/);
      expect(x.reasons.join(" ")).not.toMatch(/Es del área que te interesa/);
    }
  });

  it("devuelve el puntaje por componente", () => {
    const b = r.eligible[0].breakdown;
    expect(b.rol.max + b.seniority.max + b.requisitos.max + b.preferencias.max).toBe(100);
    expect(b.nivelAviso).toBe("director");
  });
});

describe("evaluación: otros perfiles (para no sobreajustar)", () => {
  it("marketing junior: ve el analista de marketing digital y ningún puesto de dirección", () => {
    const r = rank("Marketing digital junior");
    expect(titles(r.eligible.slice(0, 2))).toContain("Analista Marketing Digital");
    expect(titles(r.eligible).filter((t) => /head|director|vp/i.test(t))).toEqual([]);
  });

  it("backend senior: primero el backend; no ve gerencias ni marketing", () => {
    const r = rank("Backend senior");
    expect(r.eligible[0].title).toBe("Senior Backend Engineer");
    expect(titles(r.eligible)).not.toContain("Video Editor");
    expect(titles(r.eligible).filter((t) => /marketing|growth/i.test(t))).toEqual([]);
  });

  it("cambio de carrera a UX: el filtro de función no le vacía la lista", () => {
    const r = rank("Cambio de carrera");
    expect(titles(r.eligible.slice(0, 2)).sort()).toEqual(["Diseñador UX Junior", "UX Researcher Jr"]);
  });
});
