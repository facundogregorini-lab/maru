import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRACKER_EVENT, findTracked, listTracked, normalizeUrl, removeTracked, setNotes, setStatus, upsertTracked } from "@/lib/tracker";

let events = 0;

beforeEach(() => {
  const store = new Map<string, string>();
  events = 0;
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: (e: Event) => {
      if (e.type === TRACKER_EVENT) events++;
      return true;
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

const job = { title: "Product Manager", company: "Mercado Pago", jobUrl: "https://boards.greenhouse.io/mp/jobs/123" };

describe("tracker", () => {
  it("crea la tarjeta como guardada y avisa a la vista", () => {
    const it1 = upsertTracked({ ...job, artifact: ["cv", "respuestas"] });
    expect(it1?.status).toBe("guardada");
    expect(it1?.artifacts.map((a) => a.kind)).toEqual(["cv", "respuestas"]);
    expect(listTracked()).toHaveLength(1);
    expect(events).toBe(1);
  });

  it("deduplica por link aunque cambie el formato, y suma lo que se armó", () => {
    upsertTracked({ ...job, artifact: "cv" });
    upsertTracked({ title: "", company: "", jobUrl: "https://www.boards.greenhouse.io/mp/jobs/123/?utm_source=x#apply", artifact: "carta" });
    upsertTracked({ ...job, artifact: "cv" });
    const all = listTracked();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Product Manager");
    expect(all[0].artifacts.map((a) => a.kind)).toEqual(["cv", "carta"]);
  });

  it("deduplica por id del inventario y, sin link, por puesto y empresa", () => {
    upsertTracked({ id: "abc123", ...job });
    upsertTracked({ id: "abc123", title: "Product Manager", company: "Mercado Pago" });
    upsertTracked({ title: "Diseñadora UX", company: "Globant" });
    upsertTracked({ title: "diseñadora  ux", company: "GLOBANT", artifact: "carta" });
    expect(listTracked()).toHaveLength(2);
    expect(findTracked({ title: "Diseñadora UX", company: "Globant" })?.artifacts).toHaveLength(1);
  });

  it("una herramienta no hace retroceder el estado; la persona sí", () => {
    const { id } = upsertTracked({ ...job, status: "entrevista" })!;
    upsertTracked({ ...job, status: "postulada" });
    expect(findTracked(job)?.status).toBe("entrevista");
    upsertTracked({ ...job, status: "oferta" });
    expect(findTracked(job)?.status).toBe("oferta");
    setStatus(id, "descartada");
    upsertTracked({ ...job, status: "postulada" });
    expect(findTracked(job)?.status).toBe("descartada");
    upsertTracked({ ...job, status: "postulada", force: true });
    expect(findTracked(job)?.status).toBe("postulada");
  });

  it("guarda notas y borra", () => {
    const { id } = upsertTracked(job)!;
    setNotes(id, "Hablé con Ana de RR. HH.");
    expect(listTracked()[0].notes).toBe("Hablé con Ana de RR. HH.");
    removeTracked(id);
    expect(listTracked()).toEqual([]);
  });

  it("ignora entradas vacías y datos rotos", () => {
    expect(upsertTracked({ title: " ", company: "" })).toBeNull();
    window.localStorage.setItem("maru:tracker:v1", "{roto");
    expect(listTracked()).toEqual([]);
  });

  it("normaliza links", () => {
    expect(normalizeUrl("https://www.x.com/a/b/?utm_campaign=1&id=2#top")).toBe("x.com/a/b?id=2");
    expect(normalizeUrl("")).toBe("");
  });
});

describe("jobFromPage", () => {
  it("entiende los títulos de Greenhouse y Lever", async () => {
    const { jobFromPage } = await import("@/lib/tracker");
    expect(jobFromPage("Job Application for Product Manager at Acme", "https://boards.greenhouse.io/acme/jobs/1")).toEqual({ title: "Product Manager", company: "Acme" });
    expect(jobFromPage("Tucán - Senior Frontend", "https://jobs.lever.co/tucan/123/apply")).toEqual({ title: "Senior Frontend", company: "Tucán" });
    expect(jobFromPage("Apply now", "https://jobs.ashbyhq.com/mercado-pago/9")).toEqual({ title: "Apply now", company: "Mercado Pago" });
    expect(jobFromPage("", "https://careers.globant.com/x")).toEqual({ title: "Postulación", company: "Globant" });
  });
});

describe("sincronización del seguimiento", () => {
  it("junta dos tableros: gana la versión más nueva y no revive lo borrado", async () => {
    const { mergeTracked, mergeRemoved } = await import("@/lib/tracker");
    const base = { title: "PM", company: "Acme", jobUrl: "", status: "guardada" as const, artifacts: [], notes: "", createdAt: 1 };
    const local = [
      { ...base, id: "a", notes: "vieja", updatedAt: 10 },
      { ...base, id: "b", updatedAt: 5 },
    ];
    const remote = [
      { ...base, id: "a", notes: "nueva", updatedAt: 20 },
      { ...base, id: "c", updatedAt: 7 },
    ];
    const merged = mergeTracked(local, remote, { b: 6 });
    expect(merged.map((m) => m.id).sort()).toEqual(["a", "c"]);
    expect(merged.find((m) => m.id === "a")!.notes).toBe("nueva");
    // Si la tarjeta se editó después de borrarla en otro lado, vuelve.
    expect(mergeTracked([{ ...base, id: "b", updatedAt: 9 }], [], { b: 6 })).toHaveLength(1);
    expect(mergeRemoved({ x: 1 }, { x: 3, y: 2 })).toEqual({ x: 3, y: 2 });
  });

  it("borrar deja constancia para la sincronización", async () => {
    const { removeTracked, readRemoved, upsertTracked } = await import("@/lib/tracker");
    const it = upsertTracked({ title: "PM", company: "Acme" })!;
    removeTracked(it.id);
    expect(readRemoved()[it.id]).toBeGreaterThan(0);
  });
});
