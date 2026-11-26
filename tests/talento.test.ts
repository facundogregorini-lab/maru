import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import { normalizeProfile, quickScore } from "@/lib/recruiters/talento";
import { EvalDraftSchema, IcpDraftSchema, type Icp } from "@/lib/recruiters/types";

const askStructured = vi.fn();
vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  return { ...actual, askStructured: (...args: unknown[]) => askStructured(...args) };
});

const talento = await import("@/app/api/talento/route");
const lista = await import("@/app/api/recruiters/busquedas/route");
const una = await import("@/app/api/recruiters/busquedas/[id]/route");

function req(method: string, url: string, email: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${createSessionToken(email)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const perfilGrowth = {
  nombre: "Sofía Martínez",
  titulo: "Head of Growth",
  ubicacion: "CABA",
  email: "sofia@mail.test",
  telefono: "11 4444 4444",
  linkedin_url: "linkedin.com/in/sofia",
  resumen: "Growth y adquisición paga en fintech de pagos.",
  aptitudes: ["Growth", "Meta Ads", "Google Ads"],
  experiencia: [{ empresa: "Pagos SA", cargo: "Head of Growth", inicio: "2019", fin: "actual", logros: ["Escalé la adquisición paga"] }],
  educacion: [],
};
const perfilCocina = { ...perfilGrowth, nombre: "Juan Pérez", titulo: "Cocinero", resumen: "Cocina de autor.", aptitudes: ["Cocina"], experiencia: [{ empresa: "Restó", cargo: "Cocinero", inicio: "2018", fin: "actual", logros: [] }] };

const icpDraft = {
  titulo: "Head of Growth · Fintech",
  puesto: "Head of Growth",
  resumen: "Líder de growth.",
  obligatorios: [{ texto: "Growth en fintech de pagos", peso: "excluyente", origen: "brief" }, { texto: "Adquisición paga en Meta y Google", peso: "importante", origen: "brief" }],
  deseables: [],
  evitar: [],
  referencias: ["Fintech"],
  seniority: "",
  ubicacion: "CABA",
  preguntas: [],
};

beforeEach(() => {
  resetMemoryDb();
  askStructured.mockReset();
  askStructured.mockImplementation(async (opts: { schema: unknown; content: { text?: string }[] }) => {
    if (opts.schema === IcpDraftSchema) return structuredClone(icpDraft);
    if (opts.schema === EvalDraftSchema) return { criterios: [], deseables: [], evitar: [], por_que: "Sin datos.", alertas: [] };
    throw new Error("esquema inesperado");
  });
});

describe("Abierto a propuestas", () => {
  it("completa perfiles viejos y rechaza los vacíos", () => {
    const p = normalizeProfile(perfilGrowth);
    expect(p?.experiencia[0].fragmentos_incompletos).toEqual([]);
    expect(normalizeProfile({ nombre: "x" })).toBeNull();
  });

  it("el puntaje rápido prefiere el perfil que coincide", () => {
    const icp = { version: 1, puesto: "Head of Growth", resumen: "", obligatorios: [{ id: "a", texto: "Growth en fintech de pagos", peso: "excluyente", origen: "brief" }], deseables: [], evitar: [], referencias: ["Fintech"], seniority: "", ubicacion: "CABA", creadoEn: 0 } as Icp;
    const growth = { perfil: "Head of Growth en Pagos SA, fintech de pagos", profile: normalizeProfile(perfilGrowth)!, prefs: { objetivo: "", roles: [], ciudad: "CABA", modalidades: [] } };
    const cocina = { perfil: "Cocinero en Restó", profile: normalizeProfile(perfilCocina)!, prefs: { objetivo: "", roles: [], ciudad: "", modalidades: [] } };
    expect(quickScore(icp, growth)).toBeGreaterThan(quickScore(icp, cocina));
  });

  it("activar, encontrar sin contacto y desaparecer al apagar", async () => {
    let res = await talento.PUT(req("PUT", "/api/talento", "sofia@mail.test", { activo: true, profile: perfilGrowth, prefs: { ciudad: "CABA" } }));
    expect(res.status).toBe(200);
    await talento.PUT(req("PUT", "/api/talento", "juan@mail.test", { activo: true, profile: perfilCocina }));
    expect((await (await talento.GET(req("GET", "/api/talento", "sofia@mail.test"))).json()).activo).toBe(true);

    const empresa = "rrhh@fintech.test";
    res = await lista.POST(req("POST", "/api/recruiters/busquedas", empresa, { brief: "Head of Growth para una fintech de pagos en CABA." }));
    const { busqueda } = await res.json();
    const post = (body: unknown) => una.POST(req("POST", `/api/recruiters/busquedas/${busqueda.id}`, empresa, body), ctx(busqueda.id));

    res = await post({ accion: "buscar_maru" });
    expect(res.status).toBe(409);
    await post({ accion: "aprobar" });

    let data = await (await post({ accion: "buscar_maru" })).json();
    expect(data.encontrados).toBe(1);
    expect(data.candidatos).toHaveLength(1);
    const c = data.candidatos[0];
    expect(c.fuente).toBe("maru");
    expect(c.nombre).toBe("Sofía M.");
    expect(c.contacto).toBeNull();
    expect(JSON.stringify(data)).not.toContain("sofia@mail.test");

    // La misma persona no se suma dos veces.
    data = await (await post({ accion: "buscar_maru" })).json();
    expect(data.encontrados).toBe(0);

    await talento.PUT(req("PUT", "/api/talento", "sofia@mail.test", { activo: false }));
    data = await (await una.GET(req("GET", `/api/recruiters/busquedas/${busqueda.id}`, empresa), ctx(busqueda.id))).json();
    expect(data.candidatos).toHaveLength(0);
  });
});
