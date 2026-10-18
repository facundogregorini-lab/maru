import { describe, expect, it } from "vitest";
import { capture, herramientaDeResultado, initPostHog, seccionDe } from "@/lib/tracking/posthog";

describe("PostHog", () => {
  it("reconoce la sección de cada herramienta", () => {
    expect(seccionDe("/cv")).toBe("cv");
    expect(seccionDe("/busquedas/abc123")).toBe("busquedas");
    expect(seccionDe("/")).toBeNull();
    expect(seccionDe("/privacidad")).toBeNull();
  });

  it("cada herramienta tiene su resultado principal", () => {
    expect(herramientaDeResultado("/api/generate")).toBe("postulacion");
    expect(herramientaDeResultado("/api/cv/generate")).toBe("cv");
    expect(herramientaDeResultado("/api/carta")).toBe("carta");
    expect(herramientaDeResultado("/api/video/guion")).toBe("video");
    expect(herramientaDeResultado("/api/entrevista/preparar")).toBe("entrevista");
    expect(herramientaDeResultado("/api/match/ranking")).toBe("match");
    expect(herramientaDeResultado("/api/carta/parrafo")).toBeNull();
  });

  it("sin clave o fuera del navegador no se inicia ni manda nada", () => {
    expect(initPostHog()).toBe(false);
    expect(() => capture("activacion", { herramienta: "cv" })).not.toThrow();
  });
});
