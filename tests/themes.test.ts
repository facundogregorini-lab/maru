import { describe, expect, it } from "vitest";
import { FONT_PAIRS, TEMPLATES, templateDefaults, themeFor } from "@/components/cv/themes";
import { TEMPLATE_IDS } from "@/lib/schemas";

describe("galería de templates", () => {
  it("tiene más de 20 diseños con ids únicos", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });

  it("incluye las familias que la IA puede recomendar", () => {
    for (const id of TEMPLATE_IDS) expect(TEMPLATES.some((t) => t.id === id)).toBe(true);
  });

  it("todos resuelven a un tema completo", () => {
    for (const { id } of TEMPLATES) {
      const t = themeFor(id);
      expect(t.id).toBe(id);
      expect(t.order.length).toBe(7);
      expect(typeof t.body.fontSize).toBe("number");
    }
  });

  it("aplica color, tipografía, densidad y tamaño elegidos", () => {
    const base = themeFor("moderno");
    const t = themeFor("moderno", { accent: "#123456", fonts: "serif", density: "compacto", size: "grande" });
    expect(t.accent).toBe("#123456");
    expect(t.sectionTitle.color).toBe("#123456");
    expect(t.font).toBe(FONT_PAIRS.serif.body);
    expect(t.sectionGap).toBeLessThan(base.sectionGap);
    expect(Number(t.name.fontSize)).toBeGreaterThan(Number(base.name.fontSize));
  });

  it("ignora un color inválido y un template desconocido", () => {
    expect(themeFor("startup", { accent: "rojo" }).accent).toBe(templateDefaults("startup").accent);
    expect(themeFor("no-existe").id).toBe(TEMPLATES[0].id);
  });

  it("respeta el orden de secciones elegido", () => {
    const order = ["experiencia", "resumen", "educacion", "habilidades", "idiomas", "certificaciones", "logrosClave"] as const;
    expect(themeFor("clasico", { order: [...order] }).order).toEqual(order);
  });
});
