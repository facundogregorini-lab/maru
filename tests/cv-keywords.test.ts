import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanProposals } from "@/lib/keywords";

const askStructured = vi.fn();
vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  return { ...actual, askStructured: (...args: unknown[]) => askStructured(...args) };
});

const { POST } = await import("@/app/api/cv/keywords/route");

const body = {
  puesto: "Data Analyst",
  idioma: "es",
  palabras: ["SQL", "Looker"],
  experiencias: [{ id: "e1", cargo: "Analista", empresa: "Tucán", logros: ["Armé reportes semanales de ventas"] }],
};
const req = (b: unknown) => new Request("http://test/api/cv/keywords", { method: "POST", body: JSON.stringify(b) });

describe("cleanProposals", () => {
  it("descarta frases sin la palabra, con corchetes o en experiencias que no existen", () => {
    const out = cleanProposals(
      [
        { palabra: "SQL", experiencia_id: "e1", frase: "Automaticé reportes de ventas con consultas SQL", motivo: "Hacía reportes" },
        { palabra: "Looker", experiencia_id: "e9", frase: "Armé tableros en Looker", motivo: "x" },
        { palabra: "Python", experiencia_id: "e1", frase: "Usé Python", motivo: "no pedida" },
      ],
      ["SQL", "Looker", "dbt"],
      ["e1"],
    );
    expect(out).toHaveLength(3);
    expect(out[0]).toMatchObject({ palabra: "SQL", experiencia_id: "e1" });
    expect(out[1]).toMatchObject({ palabra: "Looker", experiencia_id: "", frase: "" });
    expect(out[2]).toMatchObject({ palabra: "dbt", experiencia_id: "", frase: "" });
    expect(cleanProposals([{ palabra: "SQL", experiencia_id: "e1", frase: "Usé SQL en [empresa]", motivo: "" }], ["SQL"], ["e1"])[0].frase).toBe("");
  });

  it("acepta la palabra sin importar tildes ni mayúsculas", () => {
    const out = cleanProposals([{ palabra: "gestión", experiencia_id: "e1", frase: "Lideré la GESTION de proveedores", motivo: "" }], ["Gestión"], ["e1"]);
    expect(out[0].frase).toBe("Lideré la GESTION de proveedores");
  });
});

describe("POST /api/cv/keywords", () => {
  beforeEach(() => askStructured.mockReset());

  it("devuelve una propuesta limpia por palabra pedida", async () => {
    askStructured.mockResolvedValue({
      propuestas: [
        { palabra: "SQL", experiencia_id: "e1", frase: "Armé reportes semanales de ventas con consultas SQL", motivo: "Hacía reportes" },
        { palabra: "Looker", experiencia_id: "e1", frase: "Mejoré los reportes", motivo: "x" },
      ],
    });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    const { propuestas } = await res.json();
    expect(propuestas.map((p: { frase: string }) => p.frase)).toEqual(["Armé reportes semanales de ventas con consultas SQL", ""]);
    const call = askStructured.mock.calls[0][0];
    expect(call.content[0].text).toContain('<experiencia id="e1"');
  });

  it("pasa las frases a evitar cuando se pide otra", async () => {
    askStructured.mockResolvedValue({ propuestas: [] });
    await POST(req({ ...body, palabras: ["SQL"], evitar: { SQL: "Usé SQL" } }));
    expect(askStructured.mock.calls[0][0].content[0].text).toContain("Frases a evitar");
  });

  it("rechaza un pedido sin palabras", async () => {
    const res = await POST(req({ ...body, palabras: [] }));
    expect(res.status).toBe(400);
    expect(askStructured).not.toHaveBeenCalled();
  });
});
