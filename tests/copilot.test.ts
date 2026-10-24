import { afterEach, describe, expect, it, vi } from "vitest";
import { buildActions, contentWords, type CopilotJob } from "@/lib/copilot";
import { basePrefs, dataProfile } from "./match-helpers";

const { ask } = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock("@/lib/claude", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/claude")>()), askStructured: ask }));
const opp = (id: string, title: string, company: string, extra: Record<string, unknown> = {}) => ({
  id, title, company, status: "abierta", eligibility: { status: "elegible", evidence: ["Remoto desde Argentina"] }, locations: ["Argentina"], countries: ["AR"], postingKeys: [], primaryKey: "",
  workplace: { value: "remoto", from: "fuente" }, salary: null, descriptionComplete: true, contentHash: "", lastVerifiedAt: null,
  publishedAt: new Date().toISOString(), firstSeenAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
  extracted: { family: { value: "software", from: "titulo" }, seniority: null, employmentType: null, languages: [], skillsRequired: ["React"], skillsDesirable: [], skillsMentioned: [], yearsRequired: null },
  ...extra,
});
vi.mock("@/lib/match/load", () => ({
  loadInventory: async () => ({
    inv: { opportunities: [opp("abcdef1234", "React Developer", "Acme"), opp("cerrada123", "React Developer", "Cerrada", { status: "cerrada" }), opp("guardada99", "Data Analyst", "Datos SA", { extracted: { family: { value: "datos", from: "titulo" }, seniority: null, employmentType: null, languages: [], skillsRequired: ["SQL", "Python"], skillsDesirable: [], skillsMentioned: [], yearsRequired: null } })] },
    postings: new Map(),
    alias: new Map([["viejo11111", "guardada99"]]),
  }),
  resolveId: (alias: Map<string, string>, id: string) => alias.get(id) ?? id,
}));
const { POST } = await import("@/app/api/copiloto/route");
afterEach(() => vi.clearAllMocks());
const req = (body: unknown) => new Request("http://localhost/api/copiloto", { method: "POST", body: JSON.stringify(body) });
const none = { tipo: "ir_a" as const, id: "", herramienta: "ninguna" as const, consulta: "", modalidad: "cualquiera" as const };
const job: CopilotJob = { id: "abcdef1234", title: "React Developer", company: "Acme", locations: [], eligibility: { status: "elegible", evidence: [] }, skills: [] };

describe("acciones del copiloto", () => {
  it("sólo con avisos proporcionados y con el texto armado por Maru", () => {
    const out = buildActions(
      [
        { ...none, tipo: "preparar_postulacion", id: "abcdef1234" },
        { ...none, tipo: "ver_busqueda", id: "inventada" },
        { ...none, tipo: "ver_busqueda", id: "abcdef1234" },
      ],
      [job],
    );
    expect(out).toEqual([
      { kind: "postular", label: "Preparar mi postulación a React Developer", id: "abcdef1234", title: "React Developer", company: "Acme" },
      { kind: "link", label: "Ver React Developer (Acme)", href: "/busquedas/abcdef1234" },
    ]);
  });

  it("no manda a la herramienta en la que ya está, no repite y corta en 3", () => {
    const out = buildActions(
      [
        { ...none, herramienta: "cv" },
        { ...none, herramienta: "carta" },
        { ...none, herramienta: "carta" },
        { ...none, tipo: "buscar", consulta: "  data   analyst ", modalidad: "remoto" },
        { ...none, herramienta: "entrevista" },
        { ...none, herramienta: "video" },
      ],
      [],
      "/cv",
    );
    expect(out).toEqual([
      { kind: "link", label: "Escribir una carta", href: "/carta" },
      { kind: "link", label: "Buscar «data analyst» remoto", href: "/busquedas?q=data+analyst&modalidad=remoto" },
      { kind: "link", label: "Practicar una entrevista", href: "/entrevista" },
    ]);
  });

  it("ignora palabras vacías al buscar", () => {
    expect(contentWords("¿Cómo preparo una entrevista para React?")).toEqual(["preparo", "entrevista", "react"]);
  });
});

describe("ruta del copiloto", () => {
  it("rechaza consultas vacías sin gastar IA", async () => {
    expect((await POST(req({ message: "" }))).status).toBe(400);
    expect(ask).not.toHaveBeenCalled();
  });

  it("enlaza sólo avisos abiertos que se le pasaron y valida las acciones", async () => {
    ask.mockResolvedValueOnce({ answer: "Mirá esta.", opportunityIds: ["abcdef1234", "inventada", "cerrada123"], actions: [{ ...none, tipo: "preparar_postulacion", id: "cerrada123" }, { ...none, herramienta: "cv" }] });
    const res = await POST(req({ message: "Busco React" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs).toEqual([{ id: "abcdef1234", title: "React Developer", company: "Acme" }]);
    expect(data.actions).toEqual([{ kind: "link", label: "Mejorar mi CV", href: "/cv" }]);
    expect(ask.mock.calls[0][0].content[0].text).not.toContain('"company":"Cerrada"');
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("sin el CV ni el match del navegador no usa datos personales", async () => {
    ask.mockResolvedValueOnce({ answer: "Contame qué buscás.", opportunityIds: [], actions: [] });
    await POST(req({ message: "Ayudame con mi CV" }));
    const sent = JSON.parse(ask.mock.calls[0][0].content[0].text);
    expect(sent.cv).toBeNull();
    expect(sent.match).toBeNull();
  });

  it("con el CV no le pasa datos de contacto al modelo, y conoce las guardadas", async () => {
    ask.mockResolvedValueOnce({ answer: "Tu guardada te conviene.", opportunityIds: ["guardada99"], actions: [{ ...none, tipo: "ver_busqueda", id: "guardada99" }] });
    const cv = { nombre: "Ana Pérez", titulo: "Data Analyst", ubicacion: "CABA", email: "ana@example.com", telefono: "11 5555 5555", linkedin_url: "https://linkedin.com/in/ana", otros_links: [], resumen: "", aptitudes: ["SQL"], experiencia: [], educacion: [], certificaciones: [], idiomas: [] };
    const res = await POST(req({ message: "¿Qué hago con mi guardada?", path: "/match", cv, match: { profile: dataProfile, prefs: basePrefs, interactions: { saved: ["viejo11111"], discarded: [] } } }));
    expect(res.status).toBe(200);
    const text = ask.mock.calls[0][0].content[0].text;
    expect(text).not.toMatch(/ana@example\.com|5555|Ana Pérez|linkedin\.com\/in/);
    expect(JSON.parse(text).guardadas.map((g: { id: string }) => g.id)).toEqual(["guardada99"]);
    const data = await res.json();
    expect(data.jobs.map((j: { id: string }) => j.id)).toEqual(["guardada99"]);
    expect(data.actions).toEqual([{ kind: "link", label: "Ver Data Analyst (Datos SA)", href: "/busquedas/guardada99" }]);
  });
});
