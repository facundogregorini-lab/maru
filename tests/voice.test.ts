import { describe, expect, it } from "vitest";
import { appendSpoken, parseSpokenNumber, replaceSpoken, spokenList } from "@/lib/voice";

describe("dictado por voz en campos", () => {
  it("suma texto libre y reemplaza campos de un valor", () => {
    expect(appendSpoken("", "quiero liderar equipos")).toBe("Quiero liderar equipos");
    expect(appendSpoken("Quiero liderar equipos", "en una fintech")).toBe("Quiero liderar equipos en una fintech");
    expect(replaceSpoken("Buenos Aires", "córdoba", true)).toBe("Córdoba");
    expect(replaceSpoken("Córdoba", "capital", false)).toBe("Córdoba capital");
  });

  it("separa listas dictadas", () => {
    expect(spokenList("SQL, python y excel")).toEqual(["SQL", "Python", "Excel"]);
    expect(spokenList("call center e inmobiliarias")).toEqual(["Call center", "Inmobiliarias"]);
    expect(spokenList("Product Manager")).toEqual(["Product Manager"]);
  });

  it("entiende números en cifras y en palabras", () => {
    expect(parseSpokenNumber("6 años")).toBe(6);
    expect(parseSpokenNumber("5.000 dólares")).toBe(5000);
    expect(parseSpokenNumber("$ 2,500")).toBe(2500);
    expect(parseSpokenNumber("1,5 millones")).toBe(1_500_000);
    expect(parseSpokenNumber("5 mil")).toBe(5000);
    expect(parseSpokenNumber("seis años")).toBe(6);
    expect(parseSpokenNumber("treinta y cinco")).toBe(35);
    expect(parseSpokenNumber("dos mil quinientos dólares")).toBe(2500);
    expect(parseSpokenNumber("un millón y medio de pesos")).toBe(1_500_000);
    expect(parseSpokenNumber("un millón doscientos mil")).toBe(1_200_000);
    expect(parseSpokenNumber("no sé")).toBeNull();
  });
});
