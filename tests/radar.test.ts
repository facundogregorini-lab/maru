import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/app/api/radar/empresas/route";
import { POST as MOVE } from "@/app/api/radar/empresas/mover/route";
import { GET as CATALOG } from "@/app/api/radar/catalogo/route";
import { POST as IMPORT } from "@/app/api/radar/importar/route";
import { GET as GET_SETTINGS, PUT as PUT_SETTINGS } from "@/app/api/radar/ajustes/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import { navItems } from "@/components/app/SideNav";
import { DEFAULT_FILTERS, applyFilters, filterOptions } from "@/lib/radar/filters";
import { radarAllowedFor, radarFlagOn } from "@/lib/radar/flag";
import { companyDomain, companyIdFor, detectProvider } from "@/lib/radar/identity";
import { analyze, planImport } from "@/lib/radar/importer";
import { listTargets } from "@/lib/radar/service";
import { defaultSettings, parseSettings } from "@/lib/radar/settings";
import { parseCsv, parseXlsx } from "@/lib/radar/tabular";
import { userId } from "@/lib/sync/server";
import type { TargetView } from "@/lib/radar/types";
import { FIXTURE, buildXlsx } from "./fixtures/radar/research-laboral";

const ANA = "ana@example.com";
const BETO = "beto@example.com";

const cookie = (email: string | null): Record<string, string> => (email ? { cookie: `${SESSION_COOKIE}=${createSessionToken(email)}` } : {});
const req = (method: string, email: string | null, body?: unknown, path = "/api/radar/empresas") =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...cookie(email) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function importFile(email: string, step: "preview" | "confirm", bytes?: Uint8Array, name = "research-laboral.xlsx") {
  const form = new FormData();
  form.set("file", new File([(bytes ?? (await buildXlsx())) as Uint8Array<ArrayBuffer>], name));
  form.set("step", step);
  const res = await IMPORT(new Request("http://localhost/api/radar/importar", { method: "POST", headers: cookie(email), body: form }));
  return { status: res.status, body: res.status === 404 ? null : await res.json() };
}

const list = async (email: string) => (await (await GET(req("GET", email))).json()) as Awaited<ReturnType<typeof listTargets>>;
const byName = (items: TargetView[], name: string) => items.find((v) => v.company.name === name)!;

beforeEach(() => {
  resetMemoryDb();
  vi.stubEnv("RADAR_ENABLED", "true");
  vi.stubEnv("RADAR_ALLOWLIST", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("identidad", () => {
  it("usa el dominio de la empresa y no el del ATS", () => {
    expect(companyDomain("https://careers.humand.co/jobs")).toBe("humand.co");
    expect(companyDomain("https://www.pldspace.com/en/careers")).toBe("pldspace.com");
    expect(companyDomain("https://empresa.com.ar/trabajos")).toBe("empresa.com.ar");
    expect(companyDomain("https://job-boards.greenhouse.io/anthropic")).toBeNull();
    expect(companyDomain("https://jobs.ashbyhq.com/supabase")).toBeNull();
    expect(companyDomain("http://127.0.0.1/careers")).toBeNull();
    expect(companyIdFor(null, "The Exploration Company")).toBe("s:the-exploration-company");
  });

  it("reconoce el ATS y el board", () => {
    expect(detectProvider("https://job-boards.greenhouse.io/anthropic")).toEqual({ provider: "greenhouse", boardId: "anthropic" });
    expect(detectProvider("https://jobs.lever.co/acme/123")).toEqual({ provider: "lever", boardId: "acme" });
    expect(detectProvider("https://jobs.ashbyhq.com/supabase")).toEqual({ provider: "ashby", boardId: "supabase" });
    expect(detectProvider("https://vercel.com/careers").provider).toBe("careers");
  });
});

describe("lectura de planillas", () => {
  it("CSV con comillas, punto y coma y saltos de línea", () => {
    const s = parseCsv('Empresa;Notas\n"Acme; SA";"línea 1\nlínea 2"\nBeta;"dice ""hola"""\n');
    expect(s.rows.map((r) => r.cells)).toEqual([["Empresa", "Notas"], ["Acme; SA", "línea 1\nlínea 2"], ["Beta", 'dice "hola"']]);
  });

  it("XLSX con tres pestañas, hipervínculos y fórmulas HYPERLINK", async () => {
    const sheets = await parseXlsx(await buildXlsx());
    expect(sheets.map((s) => s.name)).toEqual(FIXTURE.map((s) => s.name));
    const ia = sheets[0];
    const humand = ia.rows.find((r) => r.cells[1] === "Humand")!;
    expect(humand.links[7]).toBe("https://careers.humand.co/jobs");
    const openai = ia.rows.find((r) => r.cells[1] === "OpenAI")!;
    expect(openai.links[7]).toBe("https://openai.com/careers");
  });

  it("rechaza archivos que no son planillas", async () => {
    await expect(parseXlsx(new TextEncoder().encode("no soy un zip"))).rejects.toMatchObject({ code: "BAD_FILE" });
  });
});

describe("importación", () => {
  it("separa secciones: empresas deduplicadas con todas sus etiquetas, vacantes aparte y cobertura ignorada", async () => {
    const a = analyze(await parseXlsx(await buildXlsx()));
    expect(a.tabs.map((t) => t.industry)).toEqual(["IA", "Space", "Tech Startups"]);
    expect(a.companies).toHaveLength(11);
    expect(a.jobs).toHaveLength(6);
    expect(a.tabs.reduce((n, t) => n + t.coverageRows, 0)).toBe(5);
    expect(a.errors.some((e) => /Falta el nombre/.test(e.message))).toBe(true);

    const plan = planImport(a, { catalog: [], sources: {}, targets: { items: {}, updatedAt: 0 }, pilot: [] });
    const names = plan.companies.map((p) => p.company.name).sort();
    expect(names).toEqual(["Anthropic", "ElevenLabs", "Humand", "Linear", "OpenAI", "PLD Space", "Supabase", "The Exploration Company", "Vercel"]);
    // Las empresas de las vacantes (Stripe) y de la cobertura no se crean como empresas.
    expect(names).not.toContain("Stripe");
    expect(names).not.toContain("Total");

    const vercel = plan.companies.find((p) => p.company.name === "Vercel")!.company;
    expect(vercel.id).toBe("d:vercel.com");
    expect(vercel.industries).toEqual(["IA", "Tech Startups"]);
    const humand = plan.companies.find((p) => p.company.name === "Humand")!.company;
    expect(humand.id).toBe("d:humand.co");
    expect(humand.industries).toEqual(["IA", "Tech Startups"]);
    expect(plan.companies.find((p) => p.company.name === "Anthropic")!.company.identity).toBe("provisoria");

    expect(plan.pilotJobs).toHaveLength(6);
    expect(plan.pilotJobs.find((j) => j.company === "Humand")).toMatchObject({ companyId: "d:humand.co", editorialScore: 94, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(plan.pilotJobs.find((j) => j.company === "Stripe")?.companyId).toBeNull();
    expect(plan.sources["s:supabase"][0]).toMatchObject({ provider: "ashby", externalBoardId: "supabase", status: "pending" });
  });

  it("vista previa no escribe; confirmar guarda; la segunda importación no duplica ni pisa preferencias", async () => {
    const preview = await importFile(ANA, "preview");
    expect(preview.status).toBe(200);
    expect(preview.body.totals).toMatchObject({ rows: 11, unique: 9, newCompanies: 9, pilotJobs: 6, targetsCreated: 9 });
    expect((await list(ANA)).items).toHaveLength(0);

    const first = await importFile(ANA, "confirm");
    expect(first.body.run).toMatchObject({ companiesCreated: 9, targetsCreated: 9, pilotJobs: 6 });
    let mine = await list(ANA);
    expect(mine.items).toHaveLength(9);
    expect(mine.summary).toMatchObject({ unclassified: 9, p1: 0, pilotJobs: 6 });
    // La nota del Sheet pasa a la nota personal.
    expect(byName(mine.items, "Humand").target.notes).toBe("Conozco gente del equipo");

    await PATCH(req("PATCH", ANA, { companyId: "d:humand.co", priority: "P1", notes: "Hablar con Juli" }));
    await PATCH(req("PATCH", ANA, { companyId: "d:vercel.com", status: "archivada" }));

    const second = await importFile(ANA, "confirm");
    expect(second.body.run).toMatchObject({ companiesCreated: 0, companiesUpdated: 0, targetsCreated: 0, targetsKept: 9, pilotJobs: 6 });
    mine = await list(ANA);
    expect(mine.items).toHaveLength(9);
    expect(byName(mine.items, "Humand").target).toMatchObject({ priority: "P1", notes: "Hablar con Juli" });
    expect(byName(mine.items, "Vercel").target.status).toBe("archivada");
    expect(mine.summary.pilotJobs).toBe(6);
  });

  it("muestra errores claros con un archivo sin empresas", async () => {
    const r = await importFile(ANA, "preview", new TextEncoder().encode("hola,chau\n1,2\n"), "otra.csv");
    expect(r.status).toBe(422);
    expect(r.body.code).toBe("NO_ROWS");
  });

  it("CSV de una pestaña con el sector elegido", async () => {
    const csv = ["Ranking regional,Empresa,Sede,Careers", "1,Acme,Córdoba,https://acme.com.ar/empleos", "2,Beta,Rosario,"].join("\n");
    const form = new FormData();
    form.set("file", new File([csv], "mi-lista.csv"));
    form.set("step", "confirm");
    form.set("industries", JSON.stringify({ "mi-lista": "Fintech" }));
    const res = await IMPORT(new Request("http://localhost/api/radar/importar", { method: "POST", headers: cookie(ANA), body: form }));
    expect(res.status).toBe(200);
    const mine = await list(ANA);
    expect(byName(mine.items, "Acme").company).toMatchObject({ id: "d:acme.com.ar", industries: ["Fintech"] });
  });
});

describe("Mis empresas", () => {
  it("alta, prioridades P1/P2/P3, orden manual, archivar y persistencia al recargar", async () => {
    const created = await POST(req("POST", ANA, { create: { name: "Mercado Libre", careersUrl: "https://careers-meli.mercadolibre.com/", industry: "Tech Startups" }, priority: "P2" }));
    expect(created.status).toBe(201);
    const a = await created.json();
    expect(a.company).toMatchObject({ id: "d:mercadolibre.com", identity: "dominio" });
    expect(a.sources[0]).toMatchObject({ status: "pending", provider: "careers" });

    await POST(req("POST", ANA, { create: { name: "Ualá", industry: "Fintech" }, priority: "P2" }));
    await POST(req("POST", ANA, { create: { name: "Satellogic", industry: "Space" }, priority: "P1" }));
    // Seguir de nuevo es idempotente.
    expect((await (await POST(req("POST", ANA, { create: { name: "Ualá" } }))).json()).target.priority).toBe("P2");

    let mine = await list(ANA);
    expect(mine.items.map((v) => v.company.name)).toEqual(["Satellogic", "Mercado Libre", "Ualá"]);
    expect(mine.summary).toMatchObject({ p1: 1, p2: 2, p3: 0, sourcesPending: 3 });

    await MOVE(req("POST", ANA, { companyId: "s:uala", direction: "up" }, "/api/radar/empresas/mover"));
    await PATCH(req("PATCH", ANA, { companyId: "d:mercadolibre.com", priority: "P3" }));
    mine = await list(ANA);
    expect(mine.items.map((v) => `${v.company.name}:${v.target.priority}`)).toEqual(["Satellogic:P1", "Ualá:P2", "Mercado Libre:P3"]);

    await PATCH(req("PATCH", ANA, { companyId: "s:satellogic", status: "archivada" }));
    mine = await list(ANA);
    expect(mine.summary).toMatchObject({ p1: 0, archived: 1 });
    expect(applyFilters(mine.items, DEFAULT_FILTERS).map((v) => v.company.name)).toEqual(["Ualá", "Mercado Libre"]);
    expect(applyFilters(mine.items, { ...DEFAULT_FILTERS, archived: true }).map((v) => v.company.name)).toEqual(["Satellogic"]);

    const gone = await DELETE(req("DELETE", ANA, { companyId: "s:uala" }));
    expect(gone.status).toBe(200);
    expect((await list(ANA)).items).toHaveLength(2);
  });

  it("filtra por sector (con una prioridad para todas sus etiquetas), región, texto y prioridad", async () => {
    await importFile(ANA, "confirm");
    await PATCH(req("PATCH", ANA, { companyId: "d:vercel.com", priority: "P2" }));
    const { items } = await list(ANA);
    const opts = filterOptions(items);
    expect(opts.industries).toEqual(["IA", "Space", "Tech Startups"]);
    expect(opts.regions).toEqual(["Global", "LatAm"]);

    const names = (f: Partial<typeof DEFAULT_FILTERS>) => applyFilters(items, { ...DEFAULT_FILTERS, ...f }).map((v) => v.company.name).sort();
    expect(names({ industry: "Space" })).toEqual(["PLD Space", "The Exploration Company"]);
    expect(names({ industry: "Tech Startups" })).toEqual(["Humand", "Linear", "Supabase", "Vercel"]);
    // La prioridad es una sola, se vea por el sector que se vea.
    expect(names({ industry: "IA", priority: "P2" })).toEqual(["Vercel"]);
    expect(names({ industry: "Tech Startups", priority: "P2" })).toEqual(["Vercel"]);
    expect(names({ region: "LatAm", industry: "IA" })).toEqual(["Humand", "Vercel"]);
    expect(names({ q: "eleven" })).toEqual(["ElevenLabs"]);
    expect(names({ priority: "sin", industry: "Space" })).toEqual(["PLD Space", "The Exploration Company"]);
    expect(names({ monitor: "sin_fuente" })).toEqual(["The Exploration Company"]);
  });

  it("busca en el catálogo y sigue desde ahí", async () => {
    await importFile(ANA, "confirm");
    const r = await (await CATALOG(req("GET", BETO, undefined, "/api/radar/catalogo?q=supa"))).json();
    expect(r.results.map((x: { company: { name: string } }) => x.company.name)).toEqual(["Supabase"]);
    expect(r.results[0].following).toBe(false);
    const followed = await POST(req("POST", BETO, { companyId: "s:supabase", priority: "P1" }));
    expect((await followed.json()).target).toMatchObject({ priority: "P1", origin: "catalogo" });
  });

  it("valida los datos de entrada", async () => {
    expect((await POST(req("POST", ANA, { create: { name: "X" } }))).status).toBe(400);
    expect((await POST(req("POST", ANA, { create: { name: "Acme", careersUrl: "javascript:alert(1)" } }))).status).toBe(400);
    expect((await PATCH(req("PATCH", ANA, { companyId: "../../maru:u:x", priority: "P1" }))).status).toBe(400);
    expect((await PATCH(req("PATCH", ANA, { companyId: "s:no-existe", priority: "P1" }))).status).toBe(404);
  });
});

describe("aislamiento entre usuarios", () => {
  it("cada persona ve y edita sólo su seguimiento; el catálogo es compartido", async () => {
    await importFile(ANA, "confirm");
    await PATCH(req("PATCH", ANA, { companyId: "d:openai.com", priority: "P1", notes: "privado de Ana" }));

    expect((await list(BETO)).items).toHaveLength(0);
    expect((await PATCH(req("PATCH", BETO, { companyId: "d:openai.com", priority: "P3" }))).status).toBe(404);
    expect((await DELETE(req("DELETE", BETO, { companyId: "d:openai.com" }))).status).toBe(404);

    await POST(req("POST", BETO, { companyId: "d:openai.com", priority: "P2" }));
    const beto = await list(BETO);
    expect(beto.items).toHaveLength(1);
    expect(beto.items[0].target).toMatchObject({ priority: "P2", notes: "" });
    expect(beto.summary.pilotJobs).toBe(0);
    expect(byName((await list(ANA)).items, "OpenAI").target).toMatchObject({ priority: "P1", notes: "privado de Ana" });

    // Un id de otra persona en el pedido no cambia de quién son los datos: sale de la cookie.
    const forged = await GET(new Request("http://localhost/api/radar/empresas?uid=" + userId(ANA), { headers: cookie(BETO) }));
    expect((await forged.json()).items).toHaveLength(1);
  });

  it("sin sesión pide ingresar", async () => {
    const r = await GET(req("GET", null));
    expect(r.status).toBe(401);
    expect((await r.json()).code).toBe("AUTH_REQUIRED");
  });
});

describe("ajustes de automatización", () => {
  it("guarda y lee; valida pesos, zona horaria y hora", async () => {
    const def = (await (await GET_SETTINGS(req("GET", ANA, undefined, "/api/radar/ajustes"))).json()).settings;
    expect(def).toMatchObject({ enabled: false, frequencies: { P1: "diaria", P2: "semanal", P3: "mensual" }, updatedAt: null });

    const next = { ...defaultSettings(), enabled: true, timezone: "Europe/Madrid", frequencies: { P1: "semanal", P2: "semanal", P3: "pausada" }, digest: { enabled: true, day: 3, time: "08:30" } };
    const put = await PUT_SETTINGS(req("PUT", ANA, next, "/api/radar/ajustes"));
    expect(put.status).toBe(200);
    const saved = (await (await GET_SETTINGS(req("GET", ANA, undefined, "/api/radar/ajustes"))).json()).settings;
    expect(saved).toMatchObject({ enabled: true, timezone: "Europe/Madrid", frequencies: { P3: "pausada" }, digest: { day: 3, time: "08:30" } });
    // Los de otra persona no cambian.
    expect((await (await GET_SETTINGS(req("GET", BETO, undefined, "/api/radar/ajustes"))).json()).settings.enabled).toBe(false);

    expect(parseSettings({ ...next, weights: { experiencia: 50, seniority: 20, ubicacion: 20, compensacion: 10, interes: 10 } })).toMatchObject({ ok: false, error: expect.stringMatching(/sumar 100/) });
    expect(parseSettings({ ...next, timezone: "Marte/Olympus" }).ok).toBe(false);
    expect(parseSettings({ ...next, digest: { enabled: true, day: 1, time: "25:00" } }).ok).toBe(false);
    expect(parseSettings({ ...next, channels: { inApp: false, email: false } }).ok).toBe(false);
  });
});

describe("feature flag", () => {
  it("apagado: /api/radar/* da 404 y la navegación no cambia", async () => {
    vi.stubEnv("RADAR_ENABLED", "");
    expect(radarFlagOn()).toBe(false);
    expect((await GET(req("GET", ANA))).status).toBe(404);
    expect((await importFile(ANA, "preview")).status).toBe(404);
    expect((await GET_SETTINGS(req("GET", ANA, undefined, "/api/radar/ajustes"))).status).toBe(404);
    expect(navItems(false).map((i) => i.label)).toEqual(["Búsquedas", "Match", "CV", "Postular", "Carta", "Entrevista", "Video", "Seguimiento", "Extensión"]);
  });

  it("prendido: Radar aparece debajo de Match", () => {
    expect(navItems(true).map((i) => i.label).slice(0, 3)).toEqual(["Búsquedas", "Match", "Radar laboral"]);
  });

  it("con allowlist: sólo esas cuentas lo ven; el resto recibe 404", async () => {
    vi.stubEnv("RADAR_ALLOWLIST", " Ana@Example.com ,otra@example.com");
    expect(radarAllowedFor(ANA)).toBe(true);
    expect(radarAllowedFor(BETO)).toBe(false);
    expect(radarAllowedFor(null)).toBe(false);
    expect((await GET(req("GET", ANA))).status).toBe(200);
    expect((await GET(req("GET", BETO))).status).toBe(404);
    expect((await GET(req("GET", null))).status).toBe(404);
  });
});
