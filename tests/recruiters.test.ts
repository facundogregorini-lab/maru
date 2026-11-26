import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import { ProfileSchema, type Profile } from "@/lib/schemas";
import { applyPropuestas, categoriaDe, nombreCorto, perfilParaEvaluar, publicCandidato } from "@/lib/recruiters/logic";
import { EvalDraftSchema, IcpDraftSchema, PropuestasDraftSchema, type Busqueda, type Icp } from "@/lib/recruiters/types";

const askStructured = vi.fn();
vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  return { ...actual, askStructured: (...args: unknown[]) => askStructured(...args) };
});

const lista = await import("@/app/api/recruiters/busquedas/route");
const una = await import("@/app/api/recruiters/busquedas/[id]/route");

const RECLUTADORA = "rrhh@fintech.test";

function req(method: string, url: string, body?: unknown, email: string | null = RECLUTADORA) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", ...(email ? { cookie: `${SESSION_COOKIE}=${createSessionToken(email)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const perfil = (over: Partial<Profile> = {}): Profile => ({
  nombre: "Martina Rodríguez",
  titulo: "Head of Growth",
  ubicacion: "CABA",
  email: "martina@mail.test",
  telefono: "+54 11 5555 5555",
  linkedin_url: "https://www.linkedin.com/in/martina",
  otros_links: [],
  resumen: "Lidero growth en una billetera virtual.",
  aptitudes: ["Meta Ads", "CRM"],
  experiencia: [{ empresa: "Billetera SA", cargo: "Head of Growth", inicio: "01/2020", fin: "actual", ubicacion: "CABA", descripcion: "", logros: ["Lideré un equipo de 7 personas"], fragmentos_incompletos: [] }],
  educacion: [{ institucion: "UBA", titulo: "Lic. en Economía", inicio: "2010", fin: "2015" }],
  idiomas: [],
  certificaciones: [],
  ...over,
});

const icpDraft = {
  titulo: "Head of Growth · Fintech",
  puesto: "Head of Growth",
  resumen: "Líder de growth con experiencia en fintech y pauta paga.",
  obligatorios: [
    { texto: "5 o más años en growth", peso: "excluyente", origen: "brief" },
    { texto: "Equipo a cargo de 5 o más", peso: "importante", origen: "brief" },
    { texto: "Pauta paga en Meta y Google", peso: "importante", origen: "aviso" },
  ],
  deseables: [{ texto: "Viene de fintech" }],
  evitar: [{ texto: "Sólo agencias" }],
  referencias: ["Fintech de pagos"],
  seniority: "Head",
  ubicacion: "CABA, híbrido",
  preguntas: [{ texto: "¿El equipo a cargo es excluyente?", opciones: ["Sí", "No"] }],
};

/** La IA simulada responde según el esquema que se le pide. */
function fakeAi() {
  askStructured.mockImplementation(async (opts: { schema: unknown; content: { type: string; text?: string }[] }) => {
    if (opts.schema === IcpDraftSchema) return structuredClone(icpDraft);
    if (opts.schema === ProfileSchema) return perfil();
    if (opts.schema === EvalDraftSchema) {
      const icpText = opts.content.find((c) => c.text?.startsWith("<perfil_ideal>"))?.text ?? "";
      const icp = JSON.parse(icpText.replace("<perfil_ideal>\n", "").replace("\n</perfil_ideal>", "")) as { obligatorios: { id: string }[] };
      return { criterios: icp.obligatorios.map((c) => ({ id: c.id, estado: "cumple", evidencia: "Lo dice el CV" })), deseables: [], evitar: [], por_que: "Cumple todo lo pedido.", alertas: [] };
    }
    if (opts.schema === PropuestasDraftSchema) {
      return { propuestas: [{ tipo: "agregar_deseable", criterio_id: "", antes: "", despues: "Armó un equipo desde cero", peso: "ninguno", por_que: "Aparece en los Sí de Martina." }] };
    }
    throw new Error("esquema inesperado");
  });
}

const cvTexto = "Martina Rodríguez. Head of Growth en Billetera SA desde 2020. Lideré un equipo de 7 personas y escalé la adquisición paga en Meta y Google. Licenciada en Economía (UBA). ".repeat(3);

beforeEach(() => {
  resetMemoryDb();
  askStructured.mockReset();
  fakeAi();
});

async function crear(): Promise<{ id: string; busqueda: Busqueda }> {
  const res = await lista.POST(req("POST", "/api/recruiters/busquedas", { brief: "Head of Growth para una fintech de pagos en CABA, con equipo a cargo." }));
  expect(res.status).toBe(201);
  const { busqueda } = await res.json();
  return { id: busqueda.id, busqueda };
}

describe("reglas", () => {
  const icp: Icp = {
    version: 1, puesto: "x", resumen: "", deseables: [], evitar: [], referencias: [], seniority: "", ubicacion: "", creadoEn: 0,
    obligatorios: [
      { id: "a", texto: "A", peso: "excluyente", origen: "brief" },
      { id: "b", texto: "B", peso: "importante", origen: "brief" },
      { id: "c", texto: "C", peso: "importante", origen: "brief" },
      { id: "d", texto: "D", peso: "importante", origen: "brief" },
    ],
  };
  it("la categoría sale de los criterios", () => {
    const all = (estado: string) => icp.obligatorios.map((c) => ({ id: c.id, estado }));
    expect(categoriaDe(icp, all("cumple"), 0)).toBe("fuerte");
    expect(categoriaDe(icp, all("cumple"), 1)).toBe("bueno");
    expect(categoriaDe(icp, [{ id: "a", estado: "no_cumple" }, { id: "b", estado: "cumple" }, { id: "c", estado: "cumple" }, { id: "d", estado: "cumple" }], 0)).toBe("parcial");
    expect(categoriaDe(icp, [{ id: "a", estado: "no_cumple" }, { id: "b", estado: "no_cumple" }, { id: "c", estado: "no_cumple" }, { id: "d", estado: "cumple" }], 0)).toBe("bajo");
    expect(categoriaDe(icp, all("sin_datos"), 0)).toBe("inconcluso");
  });

  it("nombre corto y perfil sin contacto", () => {
    expect(nombreCorto("Martina Rodríguez Pérez")).toBe("Martina P.");
    expect(nombreCorto("")).toBe("Candidato/a");
    const texto = perfilParaEvaluar(perfil());
    expect(texto).toContain("Head of Growth — Billetera SA");
    expect(texto).not.toContain("martina@mail.test");
    expect(texto).not.toContain("5555");
    expect(texto).not.toContain("Martina Rodríguez");
  });

  it("aplicar ajustes crea una versión nueva aprobada", () => {
    const b = { icps: [icp], borrador: true, propuestas: [
      { id: "p1", tipo: "cambiar_peso", criterioId: "b", antes: "", despues: "", peso: "excluyente", porQue: "" },
      { id: "p2", tipo: "quitar_obligatorio", criterioId: "d", antes: "D", despues: "", peso: null, porQue: "" },
      { id: "p3", tipo: "agregar_deseable", criterioId: "", antes: "", despues: "Nuevo", peso: null, porQue: "" },
    ] } as unknown as Busqueda;
    const out = applyPropuestas(b, ["p1", "p2"]);
    expect(out.icps).toHaveLength(2);
    const v2 = out.icps[1];
    expect(v2.version).toBe(2);
    expect(v2.obligatorios.find((c) => c.id === "b")?.peso).toBe("excluyente");
    expect(v2.obligatorios.some((c) => c.id === "d")).toBe(false);
    expect(v2.deseables).toHaveLength(0);
    expect(out.borrador).toBe(false);
    expect(out.propuestas).toEqual([]);
  });
});

describe("API de búsquedas", () => {
  it("exige sesión", async () => {
    const res = await lista.GET(req("GET", "/api/recruiters/busquedas", undefined, null));
    expect(res.status).toBe(401);
  });

  it("crea la búsqueda con el perfil ideal v1 y preguntas", async () => {
    const { busqueda } = await crear();
    expect(busqueda.titulo).toBe("Head of Growth · Fintech");
    expect(busqueda.borrador).toBe(true);
    expect(busqueda.icps[0].obligatorios).toHaveLength(3);
    expect(busqueda.preguntas).toHaveLength(1);
    expect(busqueda.owner).toBeUndefined();
    const res = await lista.GET(req("GET", "/api/recruiters/busquedas"));
    expect((await res.json()).busquedas).toHaveLength(1);
  });

  it("otra cuenta no ve la búsqueda", async () => {
    const { id } = await crear();
    const res = await una.GET(req("GET", `/api/recruiters/busquedas/${id}`, undefined, "otra@mail.test"), ctx(id));
    expect(res.status).toBe(404);
  });

  it("flujo completo: CV, aprobar, evaluar, calificar, proponer y aplicar", async () => {
    const { id } = await crear();
    const post = (body: unknown) => una.POST(req("POST", `/api/recruiters/busquedas/${id}`, body), ctx(id));

    // Con el perfil en borrador, el CV se carga pero no se evalúa.
    let res = await post({ accion: "agregar_cv", source: { kind: "texto", text: cvTexto } });
    expect(res.status).toBe(200);
    let data = await res.json();
    expect(data.candidatos).toHaveLength(1);
    expect(data.candidatos[0].evaluacion).toBeNull();
    expect(data.candidatos[0].contacto.email).toBe("martina@mail.test");
    expect(data.candidatos[0].perfil).toBeUndefined();

    res = await post({ accion: "evaluar" });
    expect(res.status).toBe(409);

    data = await (await post({ accion: "aprobar" })).json();
    expect(data.busqueda.borrador).toBe(false);
    expect(data.pendientes).toBe(1);

    data = await (await post({ accion: "evaluar" })).json();
    expect(data.pendientes).toBe(0);
    expect(data.candidatos[0].evaluacion.categoria).toBe("fuerte");

    // Con el perfil aprobado, cada CV nuevo se evalúa al cargarse.
    for (let i = 0; i < 4; i++) data = await (await post({ accion: "agregar_cv", source: { kind: "texto", text: cvTexto } })).json();
    expect(data.candidatos).toHaveLength(5);
    expect(data.candidatos.every((c: { evaluacion: unknown }) => c.evaluacion)).toBe(true);

    res = await post({ accion: "proponer" });
    expect(res.status).toBe(409);

    for (const c of data.candidatos) data = await (await post({ accion: "calificar", candidatoId: c.id, decision: "no", motivo: "Muy junior" })).json();
    expect(data.calificados).toBe(5);
    expect(data.candidatos[0].motivo).toBe("Muy junior");
    expect(data.versiones[0]).toMatchObject({ version: 1, calificados: 5, si: 0 });

    data = await (await post({ accion: "proponer" })).json();
    expect(data.busqueda.propuestas).toHaveLength(1);

    data = await (await post({ accion: "aplicar", aceptadas: [data.busqueda.propuestas[0].id] })).json();
    expect(data.busqueda.icps).toHaveLength(2);
    expect(data.busqueda.icps[1].deseables.map((d: { texto: string }) => d.texto)).toContain("Armó un equipo desde cero");
    // Con la versión 2, todos quedan pendientes de reevaluar.
    expect(data.pendientes).toBe(5);
  });

  it("editar el perfil aprobado crea una versión nueva", async () => {
    const { id, busqueda } = await crear();
    const post = (body: unknown) => una.POST(req("POST", `/api/recruiters/busquedas/${id}`, body), ctx(id));
    await post({ accion: "aprobar" });
    const { version: _v, creadoEn: _c, ...edit } = busqueda.icps[0];
    void _v; void _c;
    edit.obligatorios = [...edit.obligatorios, { id: "nuevo-1", texto: "Inglés avanzado", peso: "importante", origen: "manual" }];
    const data = await (await post({ accion: "editar_icp", icp: edit })).json();
    expect(data.busqueda.icps).toHaveLength(2);
    const nuevo = data.busqueda.icps[1].obligatorios.at(-1);
    expect(nuevo.texto).toBe("Inglés avanzado");
    expect(nuevo.id.startsWith("nuevo")).toBe(false);
    expect(data.busqueda.borrador).toBe(true);
  });

  it("respeta el cupo diario de lecturas con IA", async () => {
    vi.stubEnv("RECRUITERS_DAILY_AI", "1");
    try {
      await crear();
      const res = await lista.POST(req("POST", "/api/recruiters/busquedas", { brief: "Otra búsqueda: analista de riesgo crediticio en Córdoba." }));
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe("REC_LIMIT");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("los candidatos de Maru no exponen contacto", () => {
    const c = publicCandidato({ id: "x", busquedaId: "y", fuente: "maru", nombre: "Martina R.", titular: "", ubicacion: "", perfil: "texto", contacto: { email: "a@b.c", telefono: "1", linkedin: "" }, evaluacion: null, decision: null, motivo: "", decididoEn: null, decididoConVersion: null, agregadoEn: 0 });
    expect(c.contacto).toBeNull();
  });
});
