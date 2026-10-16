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
