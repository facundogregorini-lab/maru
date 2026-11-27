import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as FOLLOW } from "@/app/api/radar/empresas/route";
import { POST as REVIEW } from "@/app/api/radar/empresas/revisar/route";
import { GET as DETAIL } from "@/app/api/radar/empresas/detalle/route";
import { GET as OPPS } from "@/app/api/radar/oportunidades/route";
import { POST as WORKER } from "@/app/api/radar/worker/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import { radarRepos } from "@/lib/radar/repo";
import { ashby, greenhouse, jsonld, lever, parseJsonLdJobs, robotsAllows, type RadarPosting, type Snapshot } from "@/lib/radar/sources/adapters";
import { applySnapshot, canonicalUrl } from "@/lib/radar/sources/ingest";
import { NetError, assertSafeUrl, safeGet, type FetchLike, type NetOptions } from "@/lib/radar/sources/net";
import { atsFromUrl, atsInHtml, probeBoards, resolveSource, unsupportedAts } from "@/lib/radar/sources/resolve";
import { runMonitoring, setRadarNet } from "@/lib/radar/sources/worker";
import { dedupeAcrossSources } from "@/lib/radar/service";
import type { CompanySource, JobOpening } from "@/lib/radar/types";
import { userId } from "@/lib/sync/server";

const FIX = path.join(__dirname, "fixtures/radar/ats");
const fixture = (f: string) => readFileSync(path.join(FIX, f), "utf8");

/* ---------- Red simulada ---------- */

type Route = (url: URL) => Response | Promise<Response>;
const PUBLIC_IP = ["93.184.216.34"];
const PRIVATE_HOSTS: Record<string, string[]> = { "intranet.example.com": ["10.0.0.7"], "rebind.example.com": ["192.168.1.10"] };

function fakeNet(routes: Record<string, Route>, extra: Partial<NetOptions> = {}): NetOptions & { calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (raw) => {
    calls.push(raw);
    const u = new URL(raw);
    const key = Object.keys(routes).find((k) => raw === k || raw.startsWith(k.endsWith("/") ? k : `${k}/`) || raw.startsWith(`${k}?`));
    if (!key) return new Response("not found", { status: 404 });
    return routes[key](u);
  };
  return { calls, fetchImpl, resolve: async (h) => PRIVATE_HOSTS[h] ?? PUBLIC_IP, sleep: async () => {}, random: () => 0, ...extra };
}
const jsonRes = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
const html = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html" } });

const src = (over: Partial<CompanySource> = {}): CompanySource => ({
  id: "src_test",
  companyId: "d:acme.com",
  provider: "greenhouse",
  careersUrl: "https://acme.com/careers",
  externalBoardId: "acme",
  status: "pending",
  declaredStatus: "",
  lastAttemptAt: null,
  lastSuccessAt: null,
  nextDueAt: null,
  failureCount: 0,
  createdAt: "2026-11-27T00:00:00.000Z",
  ...over,
});

const posting = (id: string, over: Partial<RadarPosting> = {}): RadarPosting => ({ externalId: id, title: `Rol ${id}`, url: `https://acme.com/jobs/${id}`, location: "Remoto", remoteType: "remoto", department: "", publishedAt: null, description: `desc ${id}`, ...over });
const snap = (ids: string[], complete = true, over: Partial<Snapshot> = {}): Snapshot => ({ jobs: ids.map((i) => posting(i)), complete, received: ids.length, ...over });

beforeEach(() => {
  resetMemoryDb();
  vi.stubEnv("RADAR_ENABLED", "true");
  vi.stubEnv("RADAR_ALLOWLIST", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  setRadarNet({});
});

/* ---------- SSRF y cliente HTTP ---------- */

describe("cliente HTTP seguro", () => {
  const resolve = async (h: string) => PRIVATE_HOSTS[h] ?? PUBLIC_IP;
  it.each([
    ["https://localhost/careers"],
    ["https://127.0.0.1/careers"],
    ["https://10.0.0.5/jobs"],
    ["https://[::1]/jobs"],
    ["https://169.254.169.254/latest/meta-data"],
    ["https://metadata.google.internal/computeMetadata"],
    ["https://intranet.example.com/jobs"],
    ["http://acme.com/careers"],
    ["ftp://acme.com/jobs"],
    ["file:///etc/passwd"],
    ["https://user:pass@acme.com/"],
    ["https://acme.com:8443/"],
  ])("bloquea %s", async (url) => {
    await expect(assertSafeUrl(url, resolve)).rejects.toBeInstanceOf(NetError);
  });

  it("revalida cada redirect: público → IP privada queda bloqueado", async () => {
    const net = fakeNet({ "https://acme.com/careers": () => new Response(null, { status: 302, headers: { location: "https://rebind.example.com/admin" } }) });
    await expect(safeGet("https://acme.com/careers", net)).rejects.toMatchObject({ kind: "blocked" });
    expect(net.calls).toEqual(["https://acme.com/careers"]);
  });

  it("redirect a http (esquema no permitido) queda bloqueado", async () => {
    const net = fakeNet({ "https://acme.com/careers": () => new Response(null, { status: 301, headers: { location: "http://acme.com/careers" } }) });
    await expect(safeGet("https://acme.com/careers", net)).rejects.toMatchObject({ kind: "blocked" });
  });

  it("reintenta 429 respetando Retry-After y después responde", async () => {
    let n = 0;
    const waits: number[] = [];
    const net = fakeNet({ "https://api.example.com/": () => (++n < 3 ? new Response("slow down", { status: 429, headers: { "retry-after": "2" } }) : jsonRes({ ok: true })) }, { sleep: async (ms) => { waits.push(ms); } });
    const r = await safeGet("https://api.example.com/", net);
    expect(r.status).toBe(200);
    expect(n).toBe(3);
    expect(waits).toEqual([2000, 2000]);
  });

  it("se rinde tras los reintentos: timeout y 429", async () => {
    const timeout = fakeNet({ "https://api.example.com/": () => { throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); } });
    await expect(safeGet("https://api.example.com/", { ...timeout, retries: 2 })).rejects.toMatchObject({ kind: "timeout" });
    expect(timeout.calls).toHaveLength(3);
    const limited = fakeNet({ "https://api.example.com/": () => new Response("", { status: 429 }) });
    await expect(safeGet("https://api.example.com/", { ...limited, retries: 1 })).rejects.toMatchObject({ kind: "rate_limited", status: 429 });
  });

  it("no reintenta un 404 y corta respuestas demasiado grandes", async () => {
    const nf = fakeNet({});
    await expect(safeGet("https://api.example.com/x", nf)).rejects.toMatchObject({ status: 404 });
    expect(nf.calls).toHaveLength(1);
    const big = fakeNet({ "https://api.example.com/": () => new Response("x".repeat(2000)) });
    await expect(safeGet("https://api.example.com/", { ...big, maxBytes: 1000 })).rejects.toMatchObject({ kind: "too_large" });
  });
});

/* ---------- Adaptadores ---------- */

describe("adaptadores", () => {
  it("Greenhouse: respuesta grabada, completa según meta.total", async () => {
    const net = fakeNet({ "https://boards-api.greenhouse.io/v1/boards/anthropic/jobs": () => new Response(fixture("greenhouse-anthropic.json")) });
    const s = await greenhouse(src({ externalBoardId: "anthropic" }), net);
    expect(s.complete).toBe(true);
    expect(s.jobs).toHaveLength(3);
    expect(s.jobs[0]).toMatchObject({ externalId: expect.any(String), title: expect.any(String), url: expect.stringMatching(/^https:\/\//) });
    expect(s.jobs[0].description).not.toMatch(/<[a-z]/i);

    const partial = fakeNet({ "https://boards-api.greenhouse.io/": () => jsonRes({ ...JSON.parse(fixture("greenhouse-anthropic.json")), meta: { total: 10 } }) });
    expect((await greenhouse(src({ externalBoardId: "anthropic" }), partial)).complete).toBe(false);
  });

  it("Greenhouse: un formato inesperado no se ingiere", async () => {
    const net = fakeNet({ "https://boards-api.greenhouse.io/": () => jsonRes({ jobs: [{ id: 1 }] }) });
    await expect(greenhouse(src(), net)).rejects.toMatchObject({ kind: "invalid" });
  });

  it("Lever: paginación completa, región EU y paginación cortada", async () => {
    const base = JSON.parse(fixture("lever-spotify.json"))[0];
    const page = (n: number, offset: number) => Array.from({ length: n }, (_, i) => ({ ...base, id: `p${offset + i}`, hostedUrl: `https://jobs.lever.co/spotify/p${offset + i}` }));
    const net = fakeNet({
      "https://api.lever.co/": () => new Response("{}", { status: 404 }),
      "https://api.eu.lever.co/v0/postings/spotify": (u) => jsonRes(Number(u.searchParams.get("skip")) === 0 ? page(100, 0) : page(5, 100)),
    });
    const s = await lever(src({ provider: "lever", externalBoardId: "spotify" }), net);
    expect(s).toMatchObject({ complete: true, received: 105, patch: { region: "eu" } });
    expect(new Set(s.jobs.map((j) => j.externalId)).size).toBe(105);

    const endless = fakeNet({ "https://api.lever.co/": () => jsonRes(page(100, 0)) });
    const cut = await lever(src({ provider: "lever", externalBoardId: "spotify", region: "us" }), endless);
    expect(cut.complete).toBe(false);
  });

  it("Lever: respuesta grabada", async () => {
    const net = fakeNet({ "https://api.lever.co/": () => new Response(fixture("lever-spotify.json")) });
    const s = await lever(src({ provider: "lever", externalBoardId: "spotify", region: "us" }), net);
    expect(s.jobs).toHaveLength(3);
    expect(s.complete).toBe(true);
  });

  it("Ashby: respuesta grabada y avisos no listados afuera", async () => {
    const data = JSON.parse(fixture("ashby-supabase.json"));
    data.jobs[2].isListed = false;
    const net = fakeNet({ "https://api.ashbyhq.com/posting-api/job-board/supabase": () => jsonRes(data) });
    const s = await ashby(src({ provider: "ashby", externalBoardId: "supabase" }), net);
    expect(s.jobs).toHaveLength(2);
    expect(s.received).toBe(3);
  });

  it("JSON-LD: lee JobPosting (también dentro de @graph) y nunca es completo", async () => {
    const page = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme"},{"@type":"JobPosting","title":"Growth Lead","url":"/jobs/1","identifier":{"value":"GL-1"},"datePosted":"2026-11-20","jobLocationType":"TELECOMMUTE","description":"<p>Hola <script>alert(1)<\\/script></p>"}]}</script>
      <script type="application/ld+json">{"@type":"JobPosting","title":"PMM","jobLocation":{"address":{"addressLocality":"Buenos Aires","addressCountry":"AR"}}}</script>
      <script type="application/ld+json">{ roto </script></head></html>`;
    const jobs = parseJsonLdJobs(page, "https://acme.com/careers");
    expect(jobs.map((j) => j.title)).toEqual(["Growth Lead", "PMM"]);
    expect(jobs[0]).toMatchObject({ externalId: "GL-1", url: "https://acme.com/jobs/1", remoteType: "remoto", publishedAt: "2026-11-20T00:00:00.000Z" });
    expect(jobs[0].description).not.toMatch(/alert|<p>/);
    expect(jobs[1].location).toBe("Buenos Aires, AR");

    const net = fakeNet({ "https://acme.com/robots.txt": () => new Response("", { status: 404 }), "https://acme.com/careers": () => html(page) });
    const s = await jsonld(src({ provider: "jsonld", externalBoardId: null }), net);
    expect(s).toMatchObject({ complete: false, received: 2 });
  });

  it("robots.txt: respeta Disallow para nuestro bot o para todos", async () => {
    expect(robotsAllows("User-agent: *\nDisallow: /careers", "/careers/jobs")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /careers\nAllow: /careers/open", "/careers/open")).toBe(true);
    expect(robotsAllows("User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow:", "/careers")).toBe(true);
    expect(robotsAllows("User-agent: MaruRadarBot\nDisallow: /", "/careers")).toBe(false);
    const net = fakeNet({ "https://acme.com/robots.txt": () => new Response("User-agent: *\nDisallow: /"), "https://acme.com/careers": () => html("<html></html>") });
    await expect(jsonld(src({ provider: "jsonld", externalBoardId: null }), net)).rejects.toMatchObject({ kind: "blocked" });
  });
});

/* ---------- Resolución ---------- */

describe("resolución de la fuente", () => {
  it("reconoce el ATS en el link directo", async () => {
    expect(atsFromUrl("https://job-boards.greenhouse.io/anthropic")).toEqual({ provider: "greenhouse", boardId: "anthropic", region: "us" });
    expect(atsFromUrl("https://boards.greenhouse.io/embed/job_board?for=vercel")).toMatchObject({ provider: "greenhouse", boardId: "vercel" });
    expect(atsFromUrl("https://jobs.eu.lever.co/acme/123")).toEqual({ provider: "lever", boardId: "acme", region: "eu" });
    expect(atsFromUrl("https://jobs.ashbyhq.com/supabase/abc")).toEqual({ provider: "ashby", boardId: "supabase" });
    expect(atsFromUrl("https://jobs.ashbyhq.com/embed")).toBeNull();
    const r = await resolveSource("https://jobs.ashbyhq.com/supabase", fakeNet({}));
    expect(r).toMatchObject({ provider: "ashby", externalBoardId: "supabase", status: "pending", attempts: 0 });
  });

  it("sigue el redirect a un ATS y encuentra ATS embebidos en la página", async () => {
    const net = fakeNet({
      "https://acme.com/robots.txt": () => new Response("", { status: 404 }),
      "https://acme.com/careers": () => new Response(null, { status: 302, headers: { location: "https://jobs.lever.co/acme" } }),
      "https://jobs.lever.co/acme": () => html("<html>Lever</html>"),
    });
    expect(await resolveSource("https://acme.com/careers", net)).toMatchObject({ provider: "lever", externalBoardId: "acme" });
    expect(atsInHtml('<iframe src="https://job-boards.greenhouse.io/embed/job_board?for=beta"></iframe><a href="/x">x</a>', "https://beta.com")).toMatchObject({ provider: "greenhouse", boardId: "beta" });
  });

  it("sin ATS: JSON-LD si hay JobPosting; si no, manual; robots que prohíbe, manual", async () => {
    const ld = '<script type="application/ld+json">{"@type":"JobPosting","title":"X"}</script>';
    const withLd = fakeNet({ "https://acme.com/robots.txt": () => new Response("", { status: 404 }), "https://acme.com/careers": () => html(ld) });
    expect(await resolveSource("https://acme.com/careers", withLd)).toMatchObject({ provider: "jsonld", status: "pending" });
    const plain = fakeNet({ "https://acme.com/robots.txt": () => new Response("", { status: 404 }), "https://acme.com/careers": () => html("<html>Trabajá con nosotros</html>") });
    expect(await resolveSource("https://acme.com/careers", plain)).toMatchObject({ provider: "careers", status: "manual" });
    const robots = fakeNet({ "https://acme.com/robots.txt": () => new Response("User-agent: *\nDisallow: /careers") });
    expect(await resolveSource("https://acme.com/careers", robots)).toMatchObject({ status: "manual", statusNote: expect.stringMatching(/robots/) });
    expect(robots.calls.some((c) => c.endsWith("/careers"))).toBe(false);
    expect(await resolveSource("https://intranet.example.com/careers", plain)).toMatchObject({ status: "manual", statusNote: "Destino no permitido" });
  });
});

describe("board deducido del nombre", () => {
  it("Greenhouse: sólo si el nombre del board coincide con la empresa", async () => {
    const ok = fakeNet({ "https://boards-api.greenhouse.io/v1/boards/acme": () => jsonRes({ name: "Acme" }) });
    expect(await probeBoards("Acme", "https://acme.com/careers", ok)).toEqual({ provider: "greenhouse", boardId: "acme", region: "us" });
    const other = fakeNet({ "https://boards-api.greenhouse.io/v1/boards/acme": () => jsonRes({ name: "Acme Logistics GmbH" }) });
    expect(await probeBoards("Acme", "https://acme.com/careers", other)).toBeNull();
    const suffix = fakeNet({ "https://boards-api.greenhouse.io/v1/boards/acme": () => jsonRes({ name: "Acme, Inc." }) });
    expect(await probeBoards("Acme AI", "https://acme.com/careers", suffix)).toMatchObject({ boardId: "acme" });
    const wrong = fakeNet({ "https://boards-api.greenhouse.io/v1/boards/linear": () => jsonRes({ name: "Linear Motion Inc" }) });
    expect(await probeBoards("Linear", "https://otra.com/careers", wrong)).toBeNull();
  });

  it("Ashby/Lever: sólo si el slug coincide con el nombre y con el dominio", async () => {
    const net = fakeNet({ "https://api.ashbyhq.com/posting-api/job-board/beta": () => jsonRes({ jobs: [] }) });
    expect(await probeBoards("Beta", "https://beta.io/careers", net)).toEqual({ provider: "ashby", boardId: "beta" });
    expect(await probeBoards("Beta", "https://betacorp.com/careers", net)).toBeNull();
  });

  it("nombra el ATS no soportado", () => {
    expect(unsupportedAts('<img src="https://teamtailor-cdn.com/x.png">')).toBe("Teamtailor");
    expect(unsupportedAts("<p>hola</p>")).toBeNull();
  });
});

/* ---------- Ingestión ---------- */

describe("ingestión idempotente", () => {
  const ctx = (day: number) => ({ sourceId: "src_test", companyId: "d:acme.com", now: new Date(Date.UTC(2026, 10, day)) });
  const open = (d: { jobs: Record<string, JobOpening> }) => Object.values(d.jobs).filter((j) => j.status === "open").length;

  it("nuevas, sin cambios, modificadas; misma entrada dos veces = sin cambios", () => {
    const a = applySnapshot(null, snap(["1", "2"]), ctx(1));
    expect(a.counts).toMatchObject({ created: 2, modified: 0 });
    expect(a.status).toBe("success");
    const again = applySnapshot(a.doc, snap(["1", "2"]), ctx(2));
    expect(again.counts).toMatchObject({ created: 0, modified: 0, unchanged: 2 });
    expect(Object.keys(again.changedDescriptions)).toHaveLength(0);
    const mod = applySnapshot(again.doc, { ...snap(["1", "2"]), jobs: [posting("1", { title: "Rol 1 (Senior)" }), posting("2")] }, ctx(3));
    expect(mod.counts.modified).toBe(1);
    const j1 = Object.values(mod.doc.jobs).find((j) => j.externalJobId === "1")!;
    expect(j1).toMatchObject({ title: "Rol 1 (Senior)", firstSeenAt: "2026-11-01T00:00:00.000Z", lastSeenAt: "2026-11-03T00:00:00.000Z" });
    expect(j1.history.map((h) => h.event)).toEqual(["opened", "modified"]);
  });

  it("cierra sólo tras dos lecturas completas sin la vacante; una parcial no cuenta", () => {
    let d = applySnapshot(null, snap(["1", "2"]), ctx(1)).doc;
    d = applySnapshot(d, snap(["1"], false), ctx(2)).doc; // parcial: no cuenta
    expect(open(d)).toBe(2);
    d = applySnapshot(d, snap(["1"]), ctx(3)).doc; // 1ª completa sin "2"
    expect(open(d)).toBe(2);
    const r = applySnapshot(d, snap(["1"]), ctx(4)); // 2ª completa sin "2"
    expect(r.counts.closed).toBe(1);
    expect(open(r.doc)).toBe(1);
    expect(Object.values(r.doc.jobs).find((j) => j.externalJobId === "2")).toMatchObject({ status: "closed", closedAt: "2026-11-04T00:00:00.000Z" });
  });

  it("reapertura conserva primera detección e historial", () => {
    let d = applySnapshot(null, snap(["1", "2"]), ctx(1)).doc;
    d = applySnapshot(d, snap(["1"]), ctx(2)).doc;
    d = applySnapshot(d, snap(["1"]), ctx(3)).doc;
    const r = applySnapshot(d, snap(["1", "2"]), ctx(5));
    expect(r.counts.reopened).toBe(1);
    const j = Object.values(r.doc.jobs).find((x) => x.externalJobId === "2")!;
    expect(j).toMatchObject({ status: "open", firstSeenAt: "2026-11-01T00:00:00.000Z", closedAt: null });
    expect(j.history.map((h) => h.event)).toEqual(["opened", "closed", "reopened"]);
  });

  it("la fuente informa el cierre: se cierra en el momento", () => {
    const d = applySnapshot(null, snap(["1", "2"]), ctx(1)).doc;
    const r = applySnapshot(d, snap(["1"], true, { closedIds: ["2"] }), ctx(2));
    expect(r.counts.closed).toBe(1);
  });

  it("caída brusca sin confirmar: parcial y no cierra; confirmada dos veces, empieza a contar", () => {
    const ids = Array.from({ length: 10 }, (_, i) => String(i));
    let d = applySnapshot(null, snap(ids), ctx(1)).doc;
    const r1 = applySnapshot(d, snap(["0"]), ctx(2));
    expect(r1.status).toBe("partial");
    expect(r1.counts.closed).toBe(0);
    d = r1.doc;
    d = applySnapshot(d, snap(["0"]), ctx(3)).doc; // confirmada: 1ª ausencia
    expect(open(d)).toBe(10);
    const r3 = applySnapshot(d, snap(["0"]), ctx(4)); // 2ª ausencia
    expect(r3.counts.closed).toBe(9);
  });

  it("lectura completa vacía: verified_empty", () => {
    expect(applySnapshot(null, snap([]), ctx(1)).status).toBe("verified_empty");
  });

  it("duplicados entre fuentes por URL, sin unir roles distintos con el mismo título", () => {
    const base = applySnapshot(null, snap(["1"]), ctx(1)).doc.jobs;
    const gh = Object.values(base)[0];
    const fromLd = { ...gh, id: "job_ld", sourceId: "src_ld" };
    const sameTitleOtherUrl = { ...gh, id: "job_x", sourceId: "src_ld", canonicalUrl: canonicalUrl("https://acme.com/jobs/otro") };
    const out = dedupeAcrossSources([fromLd, gh, sameTitleOtherUrl], { src_test: "greenhouse", src_ld: "jsonld" });
    expect(out.map((j) => j.id).sort()).toEqual([gh.id, "job_x"].sort());
  });
});

/* ---------- Worker y rutas ---------- */

const ANA = "ana@example.com";
const BETO = "beto@example.com";
const cookie = (email: string): Record<string, string> => ({ cookie: `${SESSION_COOKIE}=${createSessionToken(email)}`, "Content-Type": "application/json" });
const post = (fn: (r: Request) => Promise<Response>, email: string, body: unknown, p = "/api/radar/x") => fn(new Request(`http://localhost${p}`, { method: "POST", headers: cookie(email), body: JSON.stringify(body) }));
const get = (fn: (r: Request) => Promise<Response>, email: string, p: string) => fn(new Request(`http://localhost${p}`, { headers: cookie(email) }));

function acmeNet(jobs: () => string[] | Response) {
  return fakeNet({
    "https://boards-api.greenhouse.io/v1/boards/acme/jobs": () => {
      const j = jobs();
      if (j instanceof Response) return j;
      return jsonRes({ jobs: j.map((id) => ({ id: Number(id), title: `Rol ${id}`, absolute_url: `https://job-boards.greenhouse.io/acme/jobs/${id}`, content: "<p>Hola</p>", location: { name: "Remote" } })) });
    },
  });
}

async function followAcme(email: string) {
  const r = await post(FOLLOW, email, { create: { name: "Acme", careersUrl: "https://job-boards.greenhouse.io/acme" }, priority: "P1" }, "/api/radar/empresas");
  return (await r.json()).company.id as string;
}

describe("worker", () => {
  it("dos personas siguen la misma empresa: una sola lectura; las dos ven las vacantes", async () => {
    const id = await followAcme(ANA);
    expect(await followAcme(BETO)).toBe(id);
    const net = acmeNet(() => ["1", "2", "3"]);
    const run = await runMonitoring({ net, trigger: "script" });
    expect(net.calls.filter((c) => c.includes("/boards/acme/jobs"))).toHaveLength(1);
    expect(run.totals).toMatchObject({ sources: 1, ok: 1, created: 3 });
    for (const who of [ANA, BETO]) {
      const o = await (await get(OPPS, who, "/api/radar/oportunidades")).json();
      expect(o.jobs).toHaveLength(3);
      expect(o.jobs[0]).toMatchObject({ companyName: "Acme", status: "open" });
    }
  });

  it("una falla de la fuente no cierra vacantes y deja el error visible", async () => {
    const id = await followAcme(ANA);
    let mode: "ok" | "down" | "429" = "ok";
    const net = acmeNet(() => (mode === "ok" ? ["1", "2"] : mode === "down" ? new Response("boom", { status: 503 }) : new Response("", { status: 429 })));
    await runMonitoring({ net });
    for (const m of ["down", "429"] as const) {
      mode = m;
      const run = await runMonitoring({ net });
      expect(run.items[0]).toMatchObject({ status: "error", attempts: 3 });
    }
    const [src0] = (await radarRepos().sources.forCompanies([id]))[id];
    expect(src0).toMatchObject({ status: "error", failureCount: 2, openJobs: 2 });
    const detail = await (await get(DETAIL, ANA, `/api/radar/empresas/detalle?companyId=${encodeURIComponent(id)}`)).json();
    expect(detail.open).toHaveLength(2);
    expect(detail.closed).toHaveLength(0);
    expect(detail.runs.length).toBe(3);
  });

  it("lease: otra corrida en curso salta la fuente; sin presupuesto, se saltea", async () => {
    const id = await followAcme(ANA);
    const [s] = (await radarRepos().sources.forCompanies([id]))[id];
    await radarRepos().leases.acquire(`source:${s.id}`, "otra", 60_000);
    const net = acmeNet(() => ["1"]);
    expect((await runMonitoring({ net })).items[0].status).toBe("locked");
    expect(net.calls).toHaveLength(0);
    await radarRepos().leases.release(`source:${s.id}`);
    expect((await runMonitoring({ net, budgetMs: -1 })).items[0].status).toBe("skipped");
  });

  it("board inexistente: error claro, sin vacantes", async () => {
    await followAcme(ANA);
    const run = await runMonitoring({ net: acmeNet(() => new Response("", { status: 404 })) });
    expect(run.items[0]).toMatchObject({ status: "error", error: expect.stringMatching(/no existe/) });
  });
});

describe("rutas", () => {
  it("Revisar ahora: lee la empresa y tiene cooldown; quien no la sigue recibe 404", async () => {
    const id = await followAcme(ANA);
    setRadarNet(acmeNet(() => ["7"]));
    const r1 = await post(REVIEW, ANA, { companyId: id }, "/api/radar/empresas/revisar");
    expect(r1.status).toBe(200);
    expect((await r1.json()).run.totals.created).toBe(1);
    const r2 = await post(REVIEW, ANA, { companyId: id }, "/api/radar/empresas/revisar");
    expect(r2.status).toBe(429);
    expect((await post(REVIEW, BETO, { companyId: id }, "/api/radar/empresas/revisar")).status).toBe(404);
    expect((await get(DETAIL, BETO, `/api/radar/empresas/detalle?companyId=${encodeURIComponent(id)}`)).status).toBe(404);
  });

  it("Oportunidades separa el piloto (histórico) de las detectadas", async () => {
    await followAcme(ANA);
    await radarRepos().pilot.replace(userId(ANA), [
      { id: "pil_1", companyId: null, company: "Humand", title: "CMO", location: "", priority: "P1", editorialScore: 94, fsgp: "", reasons: "", barriers: "", url: "", evidence: "", date: "2026-11-25", action: "", industry: "IA", importedAt: "2026-11-27T00:00:00.000Z" },
    ]);
    const o = await (await get(OPPS, ANA, "/api/radar/oportunidades")).json();
    expect(o.jobs).toHaveLength(0);
    expect(o.pilot).toHaveLength(1);
    expect(o.companies).toMatchObject({ total: 1, checked: 0 });
  });

  it("worker protegido: sin secreto 401, con el flag apagado 404", async () => {
    vi.stubEnv("RADAR_WORKER_SECRET", "s".repeat(32));
    const call = (auth?: string) => WORKER(new Request("http://localhost/api/radar/worker", { method: "POST", headers: auth ? { authorization: auth } : {}, body: "{}" }));
    expect((await call()).status).toBe(401);
    expect((await call("Bearer otro")).status).toBe(401);
    expect((await call(`Bearer ${"s".repeat(32)}`)).status).toBe(200);
    vi.stubEnv("RADAR_ENABLED", "");
    expect((await call(`Bearer ${"s".repeat(32)}`)).status).toBe(404);
  });
});
