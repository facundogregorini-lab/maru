import { describe, expect, it } from "vitest";
import { itemProps, scoreBand } from "@/lib/match/events";

describe("eventos del match", () => {
  it("manda el tramo del %, no el porcentaje ni el aviso", () => {
    expect([99, 90, 89, 75, 61, 12].map(scoreBand)).toEqual(["90-100", "90-100", "80-89", "70-79", "60-69", "0-59"]);
    const props = itemProps({ score: 84, family: "finanzas", confidence: "media", eligibility: { status: "por_confirmar" } });
    expect(props).toEqual({ tramo: "80-89", familia: "finanzas", confianza: "media", lista: "pendientes" });
  });
});
