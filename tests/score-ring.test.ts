import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ScoreRing, { matchLevel } from "@/components/ScoreRing";

describe("anillo de match", () => {
  it("mantiene los umbrales de nivel", () => {
    expect([95, 70, 69, 45, 44].map((s) => matchLevel(s).label)).toEqual(["Match fuerte", "Match fuerte", "Buen match", "Buen match", "Match posible"]);
  });

  it("arranca abajo, recorta el valor y usa el degradé sólo en match fuerte", () => {
    const strong = renderToStaticMarkup(createElement(ScoreRing, { value: 130, size: "lg" }));
    expect(strong).toContain('aria-label="100% de compatibilidad"');
    expect(strong).toContain("rotate(90 60 60)");
    expect(strong).toMatch(/stroke="url\(#/);
    const mid = renderToStaticMarkup(createElement(ScoreRing, { value: 50 }));
    expect(mid).toContain("var(--color-warning)");
    expect(mid).toContain('width="48"');
  });
});
