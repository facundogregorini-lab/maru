import { describe, expect, it } from "vitest";
import { estimatedProgress } from "@/lib/progress";

describe("estimatedProgress", () => {
  it("arranca en 0, crece y nunca pasa de 95%", () => {
    expect(estimatedProgress(0, 30)).toBe(0);
    const a = estimatedProgress(5, 30);
    const b = estimatedProgress(15, 30);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(estimatedProgress(30, 30)).toBeCloseTo(0.8, 1);
    expect(estimatedProgress(600, 30)).toBe(0.95);
  });

  it("sin duración esperada no avanza", () => {
    expect(estimatedProgress(10, 0)).toBe(0);
  });
});
