import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDF_MIME } from "@/lib/cvSource";
import { speechStats } from "@/components/speech";
import type { EntrevistaPlan } from "@/lib/schemas";

const askStructured = vi.fn();
vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  return {
    ...actual,
    askStructured: (...args: unknown[]) => askStructured(...args),
    jobBlock: async () => ({ type: "text", text: "<vacante>Product Manager</vacante>" }),
  };
});

const pdfBase64 = readFileSync(new URL("./fixtures/cv.pdf", import.meta.url)).toString("base64");
const source = { kind: "cv", fileBase64: pdfBase64, mimeType: PDF_MIME };
const req = (body: unknown) => new Request("http://maru.test/api", { method: "POST", body: JSON.stringify(body) });

const plan: EntrevistaPlan = {
  entrevistador: { nombre: "Lucía", cargo: "Talent Acquisition" },
  empresa: "Acme",
  puesto: "Product Manager",
  idioma: "es",
  contexto_puesto: "Buscan PM con experiencia en pagos.",
  contexto_candidato: "Growth lead en Tucán.",
  apertura: "Hola, gracias por venir.",
  preguntas: Array.from({ length: 8 }, (_, i) => ({ tema: `t${i}`, pregunta: `¿Pregunta ${i + 1}?`, que_evalua: "x" })),
  cierre: "¡Gracias!",
};

beforeEach(() => askStructured.mockReset());

describe("/api/video/guion", () => {
  it("arma el guion con búsqueda, motivación, CV y opciones", async () => {
    askStructured.mockResolvedValue({ titulo: "PM", idioma: "es", bloques: [], consejos: [], mensaje_envio: "" });
    const { POST } = await import("@/app/api/video/guion/route");
    const res = await POST(req({ job: { jobUrl: "https://x.co/job" }, motivacion: "Me encanta el producto", source, opciones: { duracion: 60, tono: "calido", idioma: "auto" } }));
    expect(res.status).toBe(200);
    const { content } = askStructured.mock.calls[0][0];
    const text = JSON.stringify(content);
    expect(text).toContain("Product Manager");
    expect(text).toContain("Duración: 60 segundos");
    expect(content.some((b: { type: string }) => b.type === "document")).toBe(true);
  });

  it("acepta una motivación breve cuando los tres pasos están completos", async () => {
    askStructured.mockResolvedValue({ titulo: "Datos", idioma: "es", bloques: [], consejos: [], mensaje_envio: "" });
    const { POST } = await import("@/app/api/video/guion/route");
    const res = await POST(req({ general: { rol: "Analista de datos", empresa: "" }, motivacion: "Aporto valor", source, opciones: { duracion: 30, tono: "calido", idioma: "es" } }));
    expect(res.status).toBe(200);
  });

  it("presentación general sin búsqueda: exige el rol", async () => {
    const { POST } = await import("@/app/api/video/guion/route");
    const res = await POST(req({ general: { rol: "", empresa: "" }, motivacion: "hola", source, opciones: { duracion: 30, tono: "calido", idioma: "es" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("JOB_MISSING");
  });
});

describe("/api/video/feedback", () => {
  it("manda sólo fotogramas JPEG válidos (máx. 3) y las métricas", async () => {
    askStructured.mockResolvedValue({ puntaje: 8 });
    const { POST } = await import("@/app/api/video/feedback/route");
    const jpeg = "/9j/" + "A".repeat(100);
    const res = await POST(req({ guion: "Hola", transcripcion: "hola", segundos: 58, wpm: 140, muletillas: { eh: 2 }, fotogramas: [jpeg, jpeg, "no-es-jpeg", jpeg, jpeg] }));
    expect(res.status).toBe(200);
    const { content } = askStructured.mock.calls[0][0];
    expect(content.filter((b: { type: string }) => b.type === "image")).toHaveLength(3);
    expect(JSON.stringify(content)).toContain("eh ×2");
  });
});

describe("/api/entrevista", () => {
  it("preparar: respeta la cantidad de preguntas pedida", async () => {
    askStructured.mockResolvedValue(plan);
    const { POST } = await import("@/app/api/entrevista/preparar/route");
    const res = await POST(req({ general: { rol: "PM", empresa: "" }, source, opciones: { tipo: "rrhh", dificultad: "estandar", preguntas: 4, idioma: "es" } }));
    expect((await res.json()).plan.preguntas).toHaveLength(4);
  });

  it("turno: sin permiso de repreguntar, nunca repregunta", async () => {
    askStructured.mockResolvedValue({ reaccion: "Entiendo.", repregunta: "¿Y el resultado?" });
    const { POST } = await import("@/app/api/entrevista/turno/route");
    const historial = [{ pregunta: "¿Pregunta 1?", respuesta: "Sí.", segundos: 3 }];
    const no = await (await POST(req({ plan, historial, puede_repreguntar: false }))).json();
    expect(no.turno.repregunta).toBe("");
    const si = await (await POST(req({ plan, historial, puede_repreguntar: true }))).json();
    expect(si.turno.repregunta).toBe("¿Y el resultado?");
  });

  it("informe: necesita al menos una respuesta y recorta respuestas enormes", async () => {
    const { POST } = await import("@/app/api/entrevista/informe/route");
    const vacio = await POST(req({ plan, historial: [{ pregunta: "¿P?", respuesta: "  ", segundos: 1 }] }));
    expect((await vacio.json()).code).toBe("NO_ANSWERS");

    askStructured.mockResolvedValue({ puntaje: 70 });
    await POST(req({ plan, historial: [{ pregunta: "¿P?", respuesta: "x".repeat(10_000), segundos: 60 }] }));
    const text = askStructured.mock.calls[0][0].content[0].text as string;
    expect(text.length).toBeLessThan(6000);
  });
});

describe("speechStats", () => {
  it("cuenta palabras por minuto y muletillas", () => {
    const s = speechStats("Bueno, eh, soy Ana y eh trabajo en producto, o sea, me encanta", 6);
    expect(s.words).toBe(13);
    expect(s.wpm).toBe(130);
    expect(s.fillers.eh).toBe(2);
    expect(s.fillers["o sea"]).toBe(1);
  });
});
