import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/sync/route";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import { mergeDoc } from "@/lib/sync/docs";
import type { TrackItem } from "@/lib/tracker";

const req = (method: string, email: string | null, body?: unknown) =>
  new Request("http://localhost/api/sync", {
    method,
    headers: { "Content-Type": "application/json", ...(email ? { cookie: `${SESSION_COOKIE}=${createSessionToken(email)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const card = (id: string, updatedAt: number, extra: Partial<TrackItem> = {}): TrackItem => ({
  id,
  title: `Puesto ${id}`,
  company: "Acme",
  jobUrl: "",
  status: "guardada",
  artifacts: [],
  notes: "",
  createdAt: 1,
  updatedAt,
  ...extra,
});

beforeEach(() => resetMemoryDb());

describe("mergeDoc", () => {
  it("seguimiento: junta las tarjetas y gana la editada más tarde", () => {
    const local = [card("a", 5, { status: "postulada" }), card("b", 1)];
    const remote = [card("a", 3, { status: "entrevista" }), card("c", 2)];
    const out = mergeDoc("tracker", local, remote) as TrackItem[];
    expect(out.map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
    expect(out.find((c) => c.id === "a")?.status).toBe("postulada");
  });

  it("perfil: el más reciente", () => {
    const out = mergeDoc("perfil", { profile: { nombre: "viejo" }, savedAt: 1 }, { profile: { nombre: "nuevo" }, savedAt: 2 });
    expect(out).toEqual({ profile: { nombre: "nuevo" }, savedAt: 2 });
  });

  it("match: el más reciente, con las guardadas y descartadas de los dos", () => {
    const local = { profile: null, prefs: { a: 1 }, interactions: { saved: ["x", "y"], discarded: [] }, external: [], updatedAt: 10 };
    const remote = { profile: null, prefs: { a: 2 }, interactions: { saved: ["z"], discarded: [{ id: "y", reason: "otro" }] }, external: [], updatedAt: 5 };
    const out = mergeDoc("match", local, remote) as typeof local;
    expect(out.prefs).toEqual({ a: 1 });
    expect(out.interactions.saved.sort()).toEqual(["x", "y", "z"]);
    // "y" está guardada en la versión más nueva: deja de estar descartada.
    expect(out.interactions.discarded).toEqual([]);
  });
});

describe("/api/sync", () => {
  it("exige sesión", async () => {
    expect((await GET(req("GET", null))).status).toBe(401);
    expect((await PUT(req("PUT", null, { doc: "perfil", data: null }))).status).toBe(401);
  });

  it("guarda y devuelve cada documento sólo a su cuenta", async () => {
    const put = await PUT(req("PUT", "ana@example.com", { doc: "tracker", data: [card("a", 1)] }));
    expect(put.status).toBe(200);
    const { updatedAt } = await put.json();

    const mine = await (await GET(req("GET", "ana@example.com"))).json();
    expect(mine.configured).toBe(true);
    expect(mine.docs.tracker).toEqual({ data: [card("a", 1)], updatedAt });
    expect(mine.docs.perfil).toBeNull();

    const other = await (await GET(req("GET", "beto@example.com"))).json();
    expect(other.docs.tracker).toBeNull();
  });

  it("rechaza documentos desconocidos o con otra forma", async () => {
    expect((await PUT(req("PUT", "ana@example.com", { doc: "otra", data: {} }))).status).toBe(400);
    expect((await PUT(req("PUT", "ana@example.com", { doc: "tracker", data: { no: "lista" } }))).status).toBe(400);
    expect((await PUT(req("PUT", "ana@example.com", { doc: "perfil", data: [] }))).status).toBe(400);
  });

  it("un borrado queda como marca sin datos", async () => {
    await PUT(req("PUT", "ana@example.com", { doc: "perfil", data: { profile: { nombre: "Ana" }, savedAt: 1 } }));
    await PUT(req("PUT", "ana@example.com", { doc: "perfil", data: null }));
    const { docs } = await (await GET(req("GET", "ana@example.com"))).json();
    expect(docs.perfil.data).toBeNull();
  });
});

/** Un "dispositivo": su propio localStorage y su propia copia del módulo de sincronización. */
async function device(initial: string | null) {
  let email = initial;
  const store = new Map<string, string>();
  const listeners = new Map<string, ((e: Event) => void)[]>();
  const on = (type: string, fn: (e: Event) => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  const win = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    addEventListener: on,
    dispatchEvent: (e: Event) => {
      for (const fn of listeners.get(e.type) ?? []) fn(e);
      return true;
    },
  };
  const fetchFn = async (url: string, init: RequestInit = {}) => {
    const r = req(init.method ?? "GET", email, init.body ? JSON.parse(String(init.body)) : undefined);
    return url === "/api/sync" && r.method === "PUT" ? PUT(r) : GET(r);
  };

  vi.resetModules();
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: () => {} });
  vi.stubGlobal("fetch", fetchFn);
  const sync = await import("@/lib/sync/client");
  const tracker = await import("@/lib/tracker");

  /** Corre código "en" este dispositivo (cada uno tiene su window y su fetch). */
  const run = async <T>(fn: () => T | Promise<T>): Promise<T> => {
    vi.stubGlobal("window", win);
    vi.stubGlobal("fetch", fetchFn);
    const out = await fn();
    await vi.advanceTimersByTimeAsync(2000);
    return out;
  };
  const read = (k: string) => JSON.parse(store.get(k) ?? "null");
  return { sync, tracker, run, read, store, login: (e: string | null) => (email = e) };
}

describe("sincronización entre dispositivos", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("lo de la compu aparece en el celular, y los cambios vuelven", async () => {
    const pc = await device("ana@example.com");
    await pc.run(() => pc.tracker.upsertTracked({ title: "PM", company: "Acme", jobUrl: "https://acme.com/jobs/1" }));
    // Ingresa en la compu, que ya tenía una tarjeta: se sube.
    await pc.run(() => pc.sync.setSyncAccount("ana@example.com"));

    const cel = await device("ana@example.com");
    await cel.run(() => cel.sync.setSyncAccount("ana@example.com"));
    expect(cel.read("maru:tracker:v1")).toHaveLength(1);

    // En el celular la marca como postulada; la compu lo ve al volver a la pestaña.
    const id = cel.read("maru:tracker:v1")[0].id;
    await cel.run(() => cel.tracker.setStatus(id, "postulada"));
    await pc.run(() => {
      pc.sync.setSyncAccount(null);
      pc.sync.setSyncAccount("ana@example.com");
    });
    expect(pc.read("maru:tracker:v1")[0].status).toBe("postulada");
  });

  it("si cambiaron los dos lados, junta las tarjetas", async () => {
    const pc = await device("ana@example.com");
    await pc.run(() => pc.sync.setSyncAccount("ana@example.com"));
    await pc.run(() => pc.tracker.upsertTracked({ title: "PM", company: "Acme" }));

    const cel = await device("ana@example.com");
    await cel.run(() => cel.tracker.upsertTracked({ title: "Diseñadora", company: "Globant" }));
    await cel.run(() => cel.sync.setSyncAccount("ana@example.com"));
    expect(cel.read("maru:tracker:v1")).toHaveLength(2);
  });

  it("borrar mis datos también los borra del otro dispositivo", async () => {
    const pc = await device("ana@example.com");
    await pc.run(() => pc.sync.setSyncAccount("ana@example.com"));
    await pc.run(() => pc.tracker.upsertTracked({ title: "PM", company: "Acme" }));

    const cel = await device("ana@example.com");
    await cel.run(() => cel.sync.setSyncAccount("ana@example.com"));
    expect(cel.read("maru:tracker:v1")).toHaveLength(1);

    const { forgetEverything } = await import("@/lib/match/clientStore");
    await cel.run(() => forgetEverything());

    await pc.run(() => {
      pc.sync.setSyncAccount(null);
      pc.sync.setSyncAccount("ana@example.com");
    });
    expect(pc.read("maru:tracker:v1")).toBeNull();
  });

  it("no sube los datos de otra cuenta que usó este navegador", async () => {
    const pc = await device("ana@example.com");
    await pc.run(() => pc.sync.setSyncAccount("ana@example.com"));
    await pc.run(() => pc.tracker.upsertTracked({ title: "PM", company: "Acme" }));
    await pc.run(() => pc.sync.setSyncAccount(null));

    pc.login("beto@example.com");
    await pc.run(() => pc.sync.setSyncAccount("beto@example.com"));
    await pc.run(() => pc.tracker.upsertTracked({ title: "Otra", company: "Beto SA" }));
    const { docs } = await (await GET(req("GET", "beto@example.com"))).json();
    // Sólo lo que Beto hizo con su sesión, no la tarjeta de Ana.
    expect(docs.tracker.data.map((c: TrackItem) => c.company)).toEqual(["Beto SA"]);
  });
});
