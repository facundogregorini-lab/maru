import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTENSION_VERSION } from "@/lib/extensionVersion";
import { NOTE_MAX, buildSearches, contactosBlocks, finalizeContacts, fitNote, linkedinSearchUrl, profileUrl, type ContactCard, type ContactoElegido } from "@/lib/contactos";

const askStructured = vi.fn();
vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  return { ...actual, askStructured: (...args: unknown[]) => askStructured(...args) };
});

const plan = await import("@/app/api/contactos/plan/route");
const elegir = await import("@/app/api/contactos/elegir/route");

const vacante = "Buscamos Growth Analyst para el equipo de Growth de Rebill. Vas a trabajar con el Head of Growth en experimentos de adquisición y retención. ".repeat(3);

function post(body: unknown, version = EXTENSION_VERSION) {
  return new Request("http://localhost/api/contactos", { method: "POST", headers: { "content-type": "application/json", "X-Maru-Version": version }, body: JSON.stringify(body) });
}

const card = (slug: string, texto: string, busqueda: ContactCard["busqueda"] = "hiring_manager"): ContactCard => ({ url: `https://www.linkedin.com/in/${slug}/?miniProfileUrn=abc`, texto, busqueda });
const elegido = (url: string, extra: Partial<ContactoElegido> = {}): ContactoElegido => ({
  url,
  nombre: "Laura Gómez",
  cargo: "Head of Growth en Rebill",
  tipo: "hiring_manager",
  motivo: "Lidera el equipo de growth donde está la vacante.",
  nota: "Hola Laura, vi la búsqueda de Growth Analyst en Rebill. Llevé growth en Tucán y me encantaría conectar.",
  mensaje: "Gracias por aceptar, Laura.",
  ...extra,
});

beforeEach(() => askStructured.mockReset());

describe("búsquedas en LinkedIn", () => {
  it("arma una búsqueda por tipo con la empresa entre comillas", () => {
    const out = buildSearches({
      empresa: "Rebill",
      puesto: "Growth Analyst",
      area: "growth",
      busquedas: [
        { tipo: "hiring_manager", cargos: '"Head of Growth" OR "Growth Manager"' },
        { tipo: "recruiter", cargos: '"Talent Acquisition" OR Recruiter' },
        { tipo: "hiring_manager", cargos: "repetida" },
        { tipo: "people", cargos: "People OR HRBP" },
      ],
    });
    expect(out.map((s) => s.tipo)).toEqual(["hiring_manager", "recruiter", "people"]);
    expect(out[0].keywords).toBe('"Rebill" "Head of Growth" OR "Growth Manager"');
    expect(out[0].url).toBe(linkedinSearchUrl(out[0].keywords));
    expect(new URL(out[0].url).searchParams.get("keywords")).toBe(out[0].keywords);
    expect(new URL(out[0].url).pathname).toBe("/search/results/people/");
  });
  it("sin empresa no hay búsquedas", () => {
    expect(buildSearches({ empresa: " ", puesto: "", area: "", busquedas: [{ tipo: "people", cargos: "People" }] })).toEqual([]);
  });
});

describe("perfiles y notas", () => {
  it("normaliza la url del perfil y descarta lo que no es un perfil", () => {
    expect(profileUrl("https://www.linkedin.com/in/Laura-Gomez/?miniProfileUrn=x")).toBe("https://www.linkedin.com/in/laura-gomez/");
    expect(profileUrl("https://ar.linkedin.com/in/laura-gomez/details/experience/")).toBe("https://www.linkedin.com/in/laura-gomez/");
    expect(profileUrl("https://www.linkedin.com/company/rebill/")).toBe("");
    expect(profileUrl("https://evil.com/in/laura")).toBe("");
    expect(profileUrl("no es url")).toBe("");
  });
  it("deja la nota dentro del límite de LinkedIn sin agregar texto", () => {
    const larga = "Hola Laura, vi la búsqueda de Growth Analyst en Rebill. " + "Trabajé cinco años en growth y adquisición en startups de la región. ".repeat(4);
    const nota = fitNote(larga);
    expect(nota.length).toBeLessThanOrEqual(NOTE_MAX);
    expect(larga.replace(/\s+/g, " ").startsWith(nota)).toBe(true);
    expect(fitNote("  Hola   Laura  ")).toBe("Hola Laura");
  });
  it("sólo devuelve personas de las tarjetas, sin repetir y con la nota corta", () => {
    const tarjetas = [card("laura-gomez", "Laura Gómez · 2.º Head of Growth en Rebill"), card("pedro", "Pedro Ruiz Talent Acquisition en Rebill", "recruiter")];
    const out = finalizeContacts(
      [
        elegido("https://www.linkedin.com/in/laura-gomez/", { nota: "x ".repeat(150) }),
        elegido("https://www.linkedin.com/in/LAURA-GOMEZ"),
        elegido("https://www.linkedin.com/in/inventada/"),
        elegido("https://www.linkedin.com/in/pedro/", { nombre: "Pedro  Ruiz", tipo: "recruiter" }),
      ],
      tarjetas,
    );
    expect(out.map((c) => c.url)).toEqual(["https://www.linkedin.com/in/laura-gomez/", "https://www.linkedin.com/in/pedro/"]);
    expect(out[0].nota.length).toBeLessThanOrEqual(NOTE_MAX);
    expect(out[1].nombre).toBe("Pedro Ruiz");
  });
  it("arma el pedido sin email ni teléfono de la persona", () => {
    const [block] = contactosBlocks({
      empresa: "Rebill",
      puesto: "Growth Analyst",
      vacante,
      tarjetas: [card("laura-gomez", "Laura Gómez\nHead of Growth")],
      profile: {
        nombre: "Ana Pérez", titulo: "Growth Lead", ubicacion: "CABA", email: "ana@mail.com", telefono: "+54 11 5555 5555", linkedin_url: "", otros_links: [], resumen: "", aptitudes: [],
        experiencia: [{ empresa: "Tucán", cargo: "Head of Growth", inicio: "2021", fin: "actual", ubicacion: "", descripcion: "", logros: ["Llevé la retención de 20% a 35%"], fragmentos_incompletos: [] }],
        educacion: [], idiomas: [], certificaciones: [],
      },
    });
    const text = (block as { text: string }).text;
    expect(text).toContain("Tucán");
    expect(text).toContain('<tarjeta url="https://www.linkedin.com/in/laura-gomez/?miniProfileUrn=abc" busqueda="hiring_manager">Laura Gómez Head of Growth</tarjeta>');
    expect(text).not.toContain("ana@mail.com");
    expect(text).not.toContain("5555");
  });
});

describe("/api/contactos/plan", () => {
  it("devuelve las búsquedas para la extensión", async () => {
    askStructured.mockResolvedValue({ empresa: "Rebill", puesto: "Growth Analyst", area: "growth", busquedas: [{ tipo: "hiring_manager", cargos: '"Head of Growth"' }, { tipo: "recruiter", cargos: "Recruiter" }] });
    const res = await plan.POST(post({ page: { url: "https://jobs.lever.co/rebill/1", title: "Growth Analyst", text: vacante } }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.empresa).toBe("Rebill");
    expect(data.busquedas).toHaveLength(2);
    expect(data.busquedas[0].url).toContain("linkedin.com/search/results/people/");
    expect(askStructured.mock.calls[0][0].verbatim).toBe(true);
  });
  it("sin vacante en la página no llama a la IA", async () => {
    const res = await plan.POST(post({ page: { url: "https://www.google.com", title: "Google", text: "Buscar" } }));
    expect(res.status).toBe(422);
    expect(askStructured).not.toHaveBeenCalled();
  });
  it("avisa si no reconoce la empresa", async () => {
    askStructured.mockResolvedValue({ empresa: "", puesto: "Analista", area: "", busquedas: [{ tipo: "people", cargos: "People" }] });
    const res = await plan.POST(post({ page: { url: "https://portal.com/aviso", title: "Analista", text: vacante } }));
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("COMPANY_MISSING");
  });
  it("pide actualizar a extensiones viejas", async () => {
    const res = await plan.POST(post({ page: { url: "https://x.com", title: "x", text: vacante } }, "0.3.0"));
    expect(res.status).toBe(426);
  });
});

describe("/api/contactos/elegir", () => {
  it("filtra personas inventadas y declara la prosa para la revisión editorial", async () => {
    askStructured.mockResolvedValue({ contactos: [elegido("https://www.linkedin.com/in/laura-gomez/"), elegido("https://www.linkedin.com/in/nadie/")] });
    const res = await elegir.POST(post({ empresa: "Rebill", puesto: "Growth Analyst", vacante, tarjetas: [card("laura-gomez", "Laura Gómez Head of Growth en Rebill")] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contactos).toHaveLength(1);
    expect(data.contactos[0].url).toBe("https://www.linkedin.com/in/laura-gomez/");
    expect(askStructured.mock.calls[0][0].editorialPaths).toEqual(["contactos.*.motivo", "contactos.*.nota", "contactos.*.mensaje"]);
  });
  it("rechaza un pedido sin tarjetas", async () => {
    const res = await elegir.POST(post({ empresa: "Rebill", puesto: "x", vacante, tarjetas: [] }));
    expect(res.status).toBe(400);
    expect(askStructured).not.toHaveBeenCalled();
  });
});
