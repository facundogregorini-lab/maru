import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import { ProfileSchema } from "@/lib/schemas";
import { buildOutreachEmail, readResponseToken, render, responseToken, scheduleAfter, waNumber } from "@/lib/recruiters/outreach";
import { processDue, respond } from "@/lib/recruiters/outreachFlow";
import { EvalDraftSchema, IcpDraftSchema } from "@/lib/recruiters/types";

const askStructured = vi.fn();
vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  return { ...actual, askStructured: (...args: unknown[]) => askStructured(...args) };
});

const lista = await import("@/app/api/recruiters/busquedas/route");
const una = await import("@/app/api/recruiters/busquedas/[id]/route");
const respuesta = await import("@/app/api/recruiters/respuesta/route");

const EMPRESA = "rrhh@fintech.test";
function req(method: string, url: string, body?: unknown) {
  return new Request(`http://localhost${url}`, { method, headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${createSessionToken(EMPRESA)}` }, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const sent: { to: string[]; reply_to?: string; subject: string; text: string }[] = [];

beforeEach(() => {
  resetMemoryDb();
  sent.length = 0;
  vi.stubEnv("RESEND_API_KEY", "test");
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("api.resend.com")) {
      sent.push(JSON.parse(String(init?.body)));
      return new Response("{}", { status: 200 });
    }
    return new Response("no", { status: 404 });
  }));
  askStructured.mockReset();
  askStructured.mockImplementation(async (opts: { schema: unknown; content: { text?: string }[] }) => {
    if (opts.schema === IcpDraftSchema) return { titulo: "Head of Growth", puesto: "Head of Growth", resumen: "x", obligatorios: [{ texto: "Growth", peso: "excluyente", origen: "brief" }], deseables: [], evitar: [], referencias: [], seniority: "", ubicacion: "", preguntas: [] };
    if (opts.schema === ProfileSchema) return { nombre: "Martina Rodríguez", titulo: "Head of Growth", ubicacion: "CABA", email: "martina@mail.test", telefono: "11 5555-5555", linkedin_url: "linkedin.com/in/martina", otros_links: [], resumen: "", aptitudes: [], experiencia: [{ empresa: "Pagos", cargo: "Head of Growth", inicio: "2020", fin: "actual", ubicacion: "", descripcion: "", logros: [], fragmentos_incompletos: [] }], educacion: [], idiomas: [], certificaciones: [] };
    if (opts.schema === EvalDraftSchema) return { criterios: [], deseables: [], evitar: [], por_que: "x", alertas: [] };
    return { gancho: "Lideraste growth en una fintech de pagos." };
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("textos y reglas", () => {
  it("reemplaza variables y arma el mail con los botones y la baja", () => {
    expect(render("Hola {{nombre}}, {{ gancho }}", { nombre: "Martina", puesto: "", empresa: "", remitente: "", gancho: "vi tu trabajo." })).toBe("Hola Martina, vi tu trabajo.");
    const { html, text } = buildOutreachEmail({ body: "Hola", empresa: "Fintech", remitente: "Laura", busquedaId: "bbbbbbbb", candidatoId: "cccccccc" });
    expect(html).toContain("Me interesa");
    expect(text).toContain("/recruiters/respuesta?t=");
    expect(text).toContain("r=baja");
  });
  it("normaliza teléfonos para WhatsApp", () => {
    expect(waNumber("11 5555-5555")).toBe("5491155555555");
    expect(waNumber("+54 9 11 5555 5555")).toBe("5491155555555");
    expect(waNumber("011 15 5555-5555")).toBe("5491155555555");
    expect(waNumber("abc")).toBeNull();
  });
  it("los pasos siguientes caen en día hábil a las 10 de Argentina", () => {
    const viernes = Date.parse("2026-11-27T15:00:00Z");
    const t = new Date(scheduleAfter(viernes, 1));
    expect(t.toISOString()).toBe("2026-11-30T13:00:00.000Z");
  });
  it("el token de respuesta está firmado", () => {
    const t = responseToken("bbbbbbbb", "cccccccc");
    expect(readResponseToken(t)).toEqual({ busquedaId: "bbbbbbbb", candidatoId: "cccccccc" });
    expect(readResponseToken(t.replace(/.$/, (ch) => (ch === "a" ? "b" : "a")))).toBeNull();
  });
});

describe("secuencia completa", () => {
  it("inscribe, manda el primer mail, deja la tarea de WhatsApp y frena con «Me interesa»", async () => {
    const { busqueda } = await (await lista.POST(req("POST", "/api/recruiters/busquedas", { brief: "Head of Growth para una fintech de pagos en CABA." }))).json();
    const post = (body: unknown) => una.POST(req("POST", `/api/recruiters/busquedas/${busqueda.id}`, body), ctx(busqueda.id));
    await post({ accion: "aprobar" });
    let data = await (await post({ accion: "agregar_cv", source: { kind: "texto", text: "Martina Rodríguez, Head of Growth en Pagos desde 2020. ".repeat(4) } })).json();
    const cid = data.candidatos[0].id;

    const pasos = [
      { id: "p1", canal: "email", dias: 0, asunto: "{{puesto}} en {{empresa}}", cuerpo: "Hola {{nombre}},\n\n{{gancho}}\n\n{{remitente}}" },
      { id: "p2", canal: "whatsapp", dias: 3, asunto: "", cuerpo: "Hola {{nombre}}, soy {{remitente}}." },
    ];
    data = await (await post({ accion: "secuencia_guardar", secuencia: { pasos, remitente: "Laura", empresa: "Fintech", autoSi: true } })).json();
    expect(data.outreach.secuencia.activa).toBe(false);

    // Con «inscribir a los Sí», el Sí entra en pausa (la secuencia no está activa).
    data = await (await post({ accion: "calificar", candidatoId: cid, decision: "si" })).json();
    expect(data.outreach.inscripciones[0]).toMatchObject({ estado: "pausada", gancho: "Lideraste growth en una fintech de pagos." });
    expect(sent).toHaveLength(0);

    data = await (await post({ accion: "secuencia_activar", activa: true })).json();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(["martina@mail.test"]);
    expect(sent[0].reply_to).toBe(EMPRESA);
    expect(sent[0].subject).toBe("Head of Growth en Fintech");
    expect(sent[0].text).toContain("Hola Martina,");
    expect(sent[0].text).toContain("Lideraste growth");
    expect(data.outreach.inscripciones[0]).toMatchObject({ estado: "activa", paso: 1 });

    // El envío diario, días después: WhatsApp sin API queda como tarea con el link listo.
    const out = await processDue({ now: Date.now() + 10 * 86400_000 });
    expect(out.procesados).toBe(1);
    data = await (await una.GET(req("GET", `/api/recruiters/busquedas/${busqueda.id}`), ctx(busqueda.id))).json();
    const insc = data.outreach.inscripciones[0];
    expect(insc.estado).toBe("tarea");
    expect(insc.tarea.whatsapp).toContain("https://wa.me/5491155555555?text=");

    data = await (await post({ accion: "tarea_hecha", candidatoId: cid })).json();
    expect(data.outreach.inscripciones[0].estado).toBe("completada");

    // «Me interesa» desde el mail: se frena y le avisa a la empresa.
    const res = await respuesta.POST(new Request("http://localhost/api/recruiters/respuesta", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: responseToken(busqueda.id, cid), r: "si" }) }));
    expect(res.status).toBe(200);
    expect(sent.at(-1)?.to).toEqual([EMPRESA]);
    data = await (await una.GET(req("GET", `/api/recruiters/busquedas/${busqueda.id}`), ctx(busqueda.id))).json();
    expect(data.outreach.inscripciones[0].estado).toBe("interesado");
  });

  it("la baja frena todo para esa persona", async () => {
    const { busqueda } = await (await lista.POST(req("POST", "/api/recruiters/busquedas", { brief: "Head of Growth para una fintech de pagos en CABA." }))).json();
    const post = (body: unknown) => una.POST(req("POST", `/api/recruiters/busquedas/${busqueda.id}`, body), ctx(busqueda.id));
    await post({ accion: "aprobar" });
    const data = await (await post({ accion: "agregar_cv", source: { kind: "texto", text: "Martina Rodríguez, Head of Growth en Pagos desde 2020. ".repeat(4) } })).json();
    const cid = data.candidatos[0].id;
    await post({ accion: "secuencia_guardar", secuencia: { pasos: [{ id: "p1", canal: "email", dias: 0, asunto: "Hola", cuerpo: "Hola {{nombre}}" }], remitente: "Laura", empresa: "Fintech", autoSi: false } });
    await post({ accion: "inscribir", candidatoIds: [cid] });
    expect((await respond({ busquedaId: busqueda.id, candidatoId: cid, r: "baja" })).ok).toBe(true);
    await post({ accion: "secuencia_activar", activa: true });
    expect(sent).toHaveLength(0);
  });
});
