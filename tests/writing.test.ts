import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { applyEditorialPatches, editorialFields, writingIssues } from "@/lib/writing";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({ default: class { beta = { messages: { parse } }; } }));
const { askStructured } = await import("@/lib/claude");
const response = (data: unknown) => ({ parsed_output: data, stop_reason: "end_turn" });
const original = "Quiero potenciar las consultas con SQL para preparar los reportes de ventas de 12 clientes.";
const clean = "Quiero usar SQL para preparar los reportes de ventas de 12 clientes y revisar las consultas.";
const schema = z.object({ texto: z.string(), empresa: z.string(), segundos: z.number() });
const draft = { texto: original, empresa: "Innovación S.A.", segundos: 30 };
const opts = { system: "Redactá un guion en español de 30 segundos.", content: [{ type: "text" as const, text: "Perfil ficticio: SQL y reportes para 12 clientes." }], schema, effort: "low" as const, editorialPaths: ["texto"] };

beforeEach(() => parse.mockReset());

describe("Slop Monstruo en español", () => {
  it("detecta las frases que el checker en inglés dejaba pasar", () => {
    const issues = writingIssues("No es sólo una herramienta, es un viaje revolucionario para potenciar tu carrera.");
    expect(issues.some((issue) => issue.category === "construcciones")).toBe(true);
    expect(issues.some((issue) => issue.category === "vocabulario")).toBe(true);
  });
  it("no trata cifras reales ni nombres de herramientas como prueba inventada", () => {
    expect(writingIssues("Preparé reportes para 12 clientes con SQL, Python y Power BI.")).toEqual([]);
    expect(writingIssues("La potencia del motor se mide en vatios.")).toEqual([]);
  });
  it("selecciona sólo prosa declarada; deja intactos empresa, números y datos copiados", () => {
    const value = { ...draft, bloques: [{ texto: original, nombre: "Transformación digital", segundos: 20 }] };
    const fields = editorialFields(value, ["bloques.*.texto"]);
    const result = applyEditorialPatches(value, fields, [{ path: "bloques.0.texto", text: clean }, { path: "empresa", text: "Otra empresa" }, { path: "bloques.0.segundos", text: "90" }]);
    expect(result).toEqual({ ...value, bloques: [{ ...value.bloques[0], texto: clean }] });
    expect(value.bloques[0].texto).toBe(original);
  });
  it.each([
    clean.replace("12", "120"),
    clean.replace("SQL", "Python"),
    `${clean} En https://inventado.example.`,
    "Quiero usar SQL.",
  ])("rechaza cambios de cifras, herramientas, links y recortes de contenido: %s", (text) => {
    expect(applyEditorialPatches(draft, editorialFields(draft, ["texto"]), [{ path: "texto", text }])).toEqual(draft);
  });
  it("conserva datos pendientes y rechaza paths duplicados", () => {
    const data = { texto: "Quiero potenciar los reportes. Pendiente de confirmar: disponibilidad para comenzar." };
    const fields = editorialFields(data, ["texto"]);
    expect(applyEditorialPatches(data, fields, [{ path: "texto", text: "Quiero mejorar los reportes. Tengo disponibilidad para comenzar en el puesto." }])).toEqual(data);
    const changes = [{ path: "texto", text: clean }, { path: "texto", text: clean }];
    expect(applyEditorialPatches(draft, editorialFields(draft, ["texto"]), changes)).toEqual(draft);
  });
});

describe("generación central", () => {
  it("aplica la política a cualquier generación y no agrega llamadas a textos sin señales", async () => {
    parse.mockResolvedValueOnce(response({ ...draft, texto: clean }));
    expect(await askStructured(opts)).toEqual({ ...draft, texto: clean });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0][0].system).toContain("CRITERIO EDITORIAL DE MARU");
  });
  it("revisa sólo los fragmentos marcados y conserva el esquema y datos del guion", async () => {
    parse.mockResolvedValueOnce(response(draft)).mockResolvedValueOnce(response({ patches: [{ path: "texto", text: clean }] }));
    expect(await askStructured(opts)).toEqual({ ...draft, texto: clean });
    expect(parse).toHaveBeenCalledTimes(2);
    const review = parse.mock.calls[1][0];
    expect(review.messages[0].content).not.toContain("Perfil ficticio");
    expect(review.messages[0].content).not.toContain("Innovación S.A.");
    expect(parse.mock.calls[1][1]).toEqual({ timeout: 12000, maxRetries: 0 });
  });
  it("si la revisión falla devuelve la generación válida sin un bucle de reintentos", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    parse.mockResolvedValueOnce(response(draft)).mockRejectedValueOnce(new Error("timeout"));
    expect(await askStructured(opts)).toEqual(draft);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("MARU_EDITORIAL_REVIEW_UNAVAILABLE");
    warn.mockRestore();
  });
  it("no acepta una revisión incompleta ni parches que rompan las restricciones del esquema", async () => {
    parse.mockResolvedValueOnce(response(draft)).mockResolvedValueOnce({ parsed_output: { patches: [{ path: "texto", text: clean }] }, stop_reason: "max_tokens" });
    expect(await askStructured(opts)).toEqual(draft);
    const strict = schema.extend({ texto: z.string().max(original.length) });
    parse.mockResolvedValueOnce(response(draft)).mockResolvedValueOnce(response({ patches: [{ path: "texto", text: clean }] }));
    expect(await askStructured({ ...opts, schema: strict })).toEqual(draft);
  });
  it("la extracción copia el original sin corrección editorial", async () => {
    parse.mockResolvedValueOnce(response(draft));
    expect(await askStructured({ ...opts, verbatim: true })).toEqual(draft);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0][0].system).not.toContain("CRITERIO EDITORIAL DE MARU");
  });
  it("la extensión permite revisar una respuesta redactada y conserva valores de selección", async () => {
    const formSchema = z.object({ campos: z.array(z.object({ valor: z.string(), revisar: z.boolean() })) });
    const form = { campos: [{ valor: "Innovación", revisar: false }, { valor: original, revisar: true }] };
    parse.mockResolvedValueOnce(response(form)).mockResolvedValueOnce(response({ patches: [{ path: "campos.1.valor", text: clean }, { path: "campos.0.valor", text: "Otra" }] }));
    const result = await askStructured({ ...opts, schema: formSchema, editorialPaths: (value) => value.campos.flatMap((field, i) => field.revisar ? [`campos.${i}.valor`] : []) });
    expect(result.campos).toEqual([{ valor: "Innovación", revisar: false }, { valor: clean, revisar: true }]);
  });
});
