import { afterEach, describe, expect, it, vi } from "vitest";
import { readReturnTo, rememberReturnTo, returnLabel, safeReturnPath } from "@/lib/billing/returnTo";

describe("volver a la herramienta después de pagar", () => {
  afterEach(() => vi.unstubAllGlobals());
  const memoryStorage = () => {
    const data = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) },
      dispatchEvent: () => true,
    });
  };

  it("sólo acepta rutas propias y nunca /precios", () => {
    expect(safeReturnPath("/postulacion?url=https://x.com/aviso")).toBe("/postulacion?url=https://x.com/aviso");
    expect(safeReturnPath("//evil.com")).toBeNull();
    expect(safeReturnPath("https://evil.com")).toBeNull();
    expect(safeReturnPath("/\\evil.com")).toBeNull();
    expect(safeReturnPath("/precios?estado=pendiente")).toBeNull();
    expect(safeReturnPath("/")).toBeNull();
    expect(safeReturnPath(42)).toBeNull();
  });

  it("nombra la acción según la herramienta", () => {
    expect(returnLabel("/postulacion")).toBe("Continuar tu postulación");
    expect(returnLabel("/cv#empezar")).toBe("Continuar tu CV");
    expect(returnLabel("/match")).toBe("Volver a donde estabas");
  });

  it("guarda la ruta y la olvida pasado un día", () => {
    memoryStorage();
    const now = Date.parse("2026-10-24T17:00:00Z");
    rememberReturnTo("/postulacion", now);
    expect(readReturnTo(now + 3600_000)).toEqual({ path: "/postulacion", label: "Continuar tu postulación" });
    expect(readReturnTo(now + 2 * 86400_000)).toBeNull();
  });
});
