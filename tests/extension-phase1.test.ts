import { readFileSync } from "node:fs";
import vm from "node:vm";
import { JSDOM, type DOMWindow } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { autofillBlocks } from "@/lib/autofill";
import { jobKey } from "@/lib/jobKey";
import type { AutofillRequest } from "@/lib/schemas";

const content = readFileSync(new URL("../extension/content.js", import.meta.url), "utf8");
const jobkeyJs = readFileSync(new URL("../extension/jobkey.js", import.meta.url), "utf8");
const fixture = (name: string) => readFileSync(new URL(`./fixtures/confirmation/${name}.html`, import.meta.url), "utf8");

type Api = { confirmationShown(doc?: Document, url?: string): boolean; watch(): boolean; toast(m: string, o?: unknown): void };
let dom: JSDOM | undefined;
afterEach(() => dom?.window.close());

function load(name: string, url: string) {
  dom = new JSDOM(fixture(name), { runScripts: "outside-only", pretendToBeVisual: true, url });
  const win = dom.window;
  // JSDOM no calcula layout: todo lo que no está oculto mide algo.
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 40, width: 200, height: 40, toJSON() {} };
  };
  win.eval(content);
  return { win, api: (win as DOMWindow & { __maru: Api }).__maru };
}

describe("clave de vacante (web y extensión dan lo mismo)", () => {
  const sandbox: { maruJobKey?: (u: string) => string } = {};
  vm.runInNewContext(jobkeyJs, { self: sandbox, URL });
  const cases: [string, string][] = [
    ["https://boards.greenhouse.io/tucan/jobs/4012345?gh_src=abc", "greenhouse:4012345"],
    ["https://job-boards.greenhouse.io/tucan/jobs/4012345#app", "greenhouse:4012345"],
    ["https://www.tucan.com/careers/?gh_jid=4012345&utm_source=x", "greenhouse:4012345"],
    ["https://jobs.lever.co/tucan/0b6f2a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b", "lever:0b6f2a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b"],
    ["https://jobs.lever.co/tucan/0B6F2A4E-1C2D-4E5F-8A9B-0C1D2E3F4A5B/apply?lever-source=LinkedIn", "lever:0b6f2a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b"],
    ["https://jobs.ashbyhq.com/tucan/2c7e1f0a-3b4c-4d5e-9f00-112233445566/application", "ashby:2c7e1f0a-3b4c-4d5e-9f00-112233445566"],
    ["https://www.empresa.com.ar/empleos/analista-datos/postular?ref=linkedin", "empresa.com.ar/empleos/analista-datos"],
    ["no es una url", ""],
    ["javascript:alert(1)", ""],
  ];
  it.each(cases)("%s → %s", (url, key) => {
    expect(jobKey(url)).toBe(key);
    expect(sandbox.maruJobKey!(url)).toBe(key);
  });
});

describe("detección del envío de la postulación", () => {
  it("reconoce la confirmación de Greenhouse", () => {
    const { api, win } = load("greenhouse", "https://boards.greenhouse.io/tucan/jobs/4012345/confirmation");
    expect(api.confirmationShown(win.document, win.location.href)).toBe(true);
  });
  it("reconoce la confirmación de Lever", () => {
    const { api, win } = load("lever", "https://jobs.lever.co/tucan/0b6f2a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/thanks");
    expect(api.confirmationShown(win.document, win.location.href)).toBe(true);
  });
  it("reconoce una confirmación en español sin URL especial", () => {
    const { api, win } = load("gracias", "https://empleos.empresa.com.ar/postulacion/123");
    expect(api.confirmationShown(win.document, win.location.href)).toBe(true);
  });
  it("no confunde el formulario abierto con una confirmación", () => {
    const { api, win } = load("job-form", "https://boards.greenhouse.io/tucan/jobs/4012345");
    expect(api.confirmationShown(win.document, win.location.href)).toBe(false);
  });
  it("vigilar el envío no envía el formulario ni toca demografía o consentimientos", () => {
    const { api, win } = load("job-form", "https://boards.greenhouse.io/tucan/jobs/4012345");
    expect(api.watch()).toBe(false);
    api.toast("¿La enviaste?", { actions: [{ label: "Guardar", message: { type: "track" } }] });
    const w = win as DOMWindow & { __submitted?: number };
    expect(w.__submitted ?? 0).toBe(0);
    expect((win.document.querySelector("select[name=gender]") as HTMLSelectElement).value).toBe("");
    expect((win.document.querySelector("input[name=consent]") as HTMLInputElement).checked).toBe(false);
  });
});

describe("postulación armada en Maru como contexto", () => {
  const base: AutofillRequest = {
    profile: { nombre: "Ana", titulo: "PM", ubicacion: "", email: "", telefono: "", linkedin_url: "", otros_links: [], resumen: "", experiencias: [], educacion: [], habilidades: [], idiomas: [], certificaciones: [] } as unknown as AutofillRequest["profile"],
    page: { url: "https://boards.greenhouse.io/tucan/jobs/1", title: "PM", text: "" },
    fields: [{ id: "0:1", tipo: "texto_largo", etiqueta: "Why Tucán?" }] as AutofillRequest["fields"],
  };
  it("sin postulación no agrega el bloque", () => {
    expect(String((autofillBlocks(base)[0] as { text: string }).text)).not.toContain("<postulacion_en_maru");
  });
  it("con postulación manda la motivación y las respuestas previas", () => {
    const text = String(
      (autofillBlocks({ ...base, postulacion: { empresa: "Tucán", puesto: "PM", motivacion: "Uso Tucán todos los días.", respuestas: [{ pregunta: "Why Tucán?", respuesta: "Because…" }] } })[0] as { text: string }).text,
    );
    expect(text).toContain('<postulacion_en_maru empresa="Tucán" puesto="PM">');
    expect(text).toContain("Uso Tucán todos los días.");
    expect(text).toContain('<respuesta pregunta="Why Tucán?">');
  });
});

describe("seguimiento desde la extensión", () => {
  it("sin sesión responde 401 (la extensión abre /seguimiento?add=)", async () => {
    const { POST } = await import("@/app/api/tracking/application/route");
    const res = await POST(new Request("https://maru.test/api/tracking/application", { method: "POST", body: JSON.stringify({ url: "https://jobs.lever.co/x/1", title: "PM" }) }));
    expect(res.status).toBe(401);
  });
  it("con sesión suma la tarjeta como Postulada sin duplicarla", async () => {
    const db = await import("@/lib/db");
    db.resetMemoryDb();
    const { SESSION_COOKIE, createSessionToken } = await import("@/lib/auth");
    const { POST } = await import("@/app/api/tracking/application/route");
    const { readDocs } = await import("@/lib/sync/server");
    const req = () =>
      new Request("https://maru.test/api/tracking/application", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${createSessionToken("ana@example.com")}` },
        body: JSON.stringify({ url: "https://jobs.lever.co/tucan/0b6f2a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b?lever-source=x", title: "Product Manager", company: "Tucán", ats: "lever" }),
      });
    expect((await POST(req())).status).toBe(200);
    expect((await POST(req())).status).toBe(200);
    const items = (await readDocs("ana@example.com")).tracker?.data as { status: string; company: string }[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: "postulada", company: "Tucán" });
  });
});
