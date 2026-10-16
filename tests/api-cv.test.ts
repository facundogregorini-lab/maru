import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDF_MIME } from "@/lib/cvSource";
import type { Profile } from "@/lib/schemas";

// Simulamos sólo la llamada a la IA y la lectura de la vacante; la validación del CV es la real.
const askStructured = vi.fn();
vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  return {
    ...actual,
    askStructured: (...args: unknown[]) => askStructured(...args),
    jobBlock: async () => ({ type: "text", text: "<vacante>Head of Growth</vacante>" }),
  };
});

const { POST: profilePOST } = await import("@/app/api/profile/route");
const { POST: analyzePOST } = await import("@/app/api/analyze/route");

const pdfBase64 = readFileSync(new URL("./fixtures/cv.pdf", import.meta.url)).toString("base64");
const onlyPdf = { source: { kind: "cv", fileBase64: pdfBase64, mimeType: PDF_MIME } };

const profile: Profile = {
  nombre: "Ana Pérez",
  titulo: "Growth Lead",
  ubicacion: "Buenos Aires",
  email: "ana@mail.com",
  telefono: "",
  linkedin_url: "",
  otros_links: [],
  resumen: "",
  aptitudes: [],
  experiencia: [
    { empresa: "Tucán", cargo: "Head of Growth", inicio: "05/2021", fin: "10/2024", ubicacion: "", descripcion: "", logros: ["x"], fragmentos_incompletos: [] },
  ],
  educacion: [],
  idiomas: [],
  certificaciones: [],
};

const req = (body: unknown) => new Request("http://test/api", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => askStructured.mockReset());

describe("/api/profile", () => {
  it("solo PDF, sin texto pegado: lee el PDF y devuelve el perfil", async () => {
    askStructured.mockResolvedValue(profile);
    const res = await profilePOST(req(onlyPdf));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.profile.nombre).toBe("Ana Pérez");
    // El PDF llegó a la IA como documento.
    const content = askStructured.mock.calls[0][0].content;
    expect(content[0]).toMatchObject({ type: "document", source: { media_type: "application/pdf", data: pdfBase64 } });
  });

  it("acepta el formato de la versión anterior de la app", async () => {
    askStructured.mockResolvedValue(profile);
    const res = await profilePOST(req({ cvPdfBase64: pdfBase64 }));
    expect(res.status).toBe(200);
  });

  it("sin CV: error de CV faltante", async () => {
    const res = await profilePOST(req({ source: { kind: "cv" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("CV_MISSING");
    expect(askStructured).not.toHaveBeenCalled();
  });

  it("archivo que no es PDF: error específico", async () => {
    const res = await profilePOST(req({ source: { kind: "cv", fileBase64: Buffer.from("hola").toString("base64"), mimeType: PDF_MIME } }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("CV_INVALID");
  });

  it("acepta experiencia pegada como resumen aunque no traiga empresas o fechas", async () => {
    askStructured.mockResolvedValue({ ...profile, experiencia: [], educacion: [], titulo: "Analista de datos", aptitudes: ["SQL"] });
    const res = await profilePOST(req({ source: { kind: "texto", text: "Soy analista de datos. Trabajo con SQL y Python, construyo tableros y preparo reportes comerciales para equipos de ventas." } }));
    expect(res.status).toBe(200);
    expect((await res.json()).profile.experiencia).toEqual([]);
  });
  it("pide detalles sobre texto insuficiente sin llamarlo un archivo de imagen", async () => {
    askStructured.mockResolvedValue({ ...profile, titulo: "", experiencia: [], educacion: [] });
    const res = await profilePOST(req({ source: { kind: "texto", text: "Quiero trabajar y estoy buscando una oportunidad para aprender y crecer con un equipo." } }));
    expect((await res.json()).code).toBe("CV_NEEDS_DETAIL");
  });

  it("PDF sin texto legible (p. ej. Canva como imagen): pide pegar la experiencia", async () => {
    askStructured.mockResolvedValue({ ...profile, experiencia: [], educacion: [] });
    const res = await profilePOST(req(onlyPdf));
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.code).toBe("CV_UNREADABLE");
    expect(data.error).toMatch(/pegá tu experiencia/i);
  });
});

describe("/api/analyze", () => {
  it("solo PDF, sin texto pegado: no rechaza el CV", async () => {
    askStructured.mockResolvedValue({ puesto: "Head of Growth" });
    const res = await analyzePOST(req({ jobUrl: "", feedback: "Me encanta que…", ...onlyPdf }));
    expect(res.status).toBe(200);
    const content = askStructured.mock.calls[0][0].content;
    expect(content.some((b: { type: string }) => b.type === "document")).toBe(true);
  });
});
