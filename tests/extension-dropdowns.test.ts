import { readFileSync } from "node:fs";
import { JSDOM, type DOMWindow } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

const content = readFileSync(new URL("../extension/content.js", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./fixtures/autofill/dropdowns.html", import.meta.url), "utf8");
const behavior = readFileSync(new URL("./fixtures/autofill/dropdowns.js", import.meta.url), "utf8");
type Field = { id: string; etiqueta: string; opciones: string[] };
type Api = { scan(): Promise<{ fields: Field[]; pass: number }>; apply(answers: { id: string; valor: string }[], cv?: null, pass?: number): Promise<{ completados: number; pendientes: number }> };
let dom: JSDOM;

function setup(cases: string[]) {
  dom = new JSDOM(fixture, { runScripts: "outside-only", pretendToBeVisual: true, url: "https://fixture.test/" });
  const win = dom.window;
  for (const field of win.document.querySelectorAll<HTMLElement>("[data-case]")) if (!cases.includes(field.dataset.case!)) field.remove();
  // JSDOM no calcula layout. Sólo suplimos geometría; los eventos y formularios son reales del DOM virtual.
  const visible = (el: Element) => !el.closest("[hidden]") && win.getComputedStyle(el).display !== "none";
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 40, width: visible(this) ? Number.parseFloat(this.style.width) || 200 : 0, height: visible(this) ? 40 : 0, toJSON() {} };
  };
  win.HTMLElement.prototype.checkVisibility = function () { return visible(this); };
  win.scrollTo = () => {};
  win.eval(behavior);
  win.eval(content);
  return { win, api: (win as DOMWindow & { __maru: Api }).__maru };
}
const state = (win: DOMWindow) => JSON.parse(win.document.getElementById("state")!.textContent!);
afterEach(() => dom?.window.close());

describe("desplegables de la extensión", () => {
  it.each([
    ["button", "button-country", "Argentina"],
    ["readonly", "readonly-country", "Argentina"],
    ["div", "availability", "Tiempo completo"],
    ["delayed", "delayed-country", "Argentina"],
    ["composite", "composite", "Argentina"],
    ["legacy", "legacy-country", "Argentina"],
    ["legacy-search", "legacy-language", "Inglés"],
  ])("completa %s y confirma el valor sin enviar el formulario", async (kind, id, wanted) => {
    const { win, api } = setup([kind]);
    const { fields } = await api.scan();
    expect(fields).toHaveLength(1);
    expect(fields[0].opciones).toContain(wanted);
    expect(fields[0].opciones).not.toContain("No disponible");
    const result = await api.apply([{ id: fields[0].id, valor: wanted }]);
    expect(state(win)[id]).toBe(wanted);
    expect(state(win).submitted).toBe(0);
    expect(result.completados).toBe(1);
    expect(win.document.querySelectorAll('[role="listbox"]:not([hidden])')).toHaveLength(0);
    expect(win.document.querySelectorAll('.custom-hr-select__menu:not([hidden])')).toHaveLength(0);
  });
  it("lee un placeholder fuera de la primera posición y avisa a React con input/change", async () => {
    const { win, api } = setup(["native"]);
    const select = win.document.querySelector("select")!;
    let changes = 0;
    select.addEventListener("change", () => changes++);
    const { fields } = await api.scan();
    expect(fields).toHaveLength(1);
    expect(fields[0].opciones).not.toContain("Uruguay");
    expect((await api.apply([{ id: fields[0].id, valor: "Brasil" }])).completados).toBe(1);
    expect(state(win)["native-country"]).toBe("BR");
    expect(changes).toBe(1);
  });
  it("no mezcla los menús de país e idioma de HiringRoom", async () => {
    const { win, api } = setup(["legacy", "legacy-search", "legacy-prefilled"]);
    const { fields } = await api.scan();
    expect(fields).toHaveLength(2);
    const country = fields.find((f) => f.etiqueta.includes("País"))!;
    const language = fields.find((f) => f.etiqueta.includes("Idioma"))!;
    expect(country.opciones).not.toContain("Inglés");
    expect(language.opciones).not.toContain("Argentina");
    expect((await api.apply([{ id: country.id, valor: "Argentina" }, { id: language.id, valor: "Inglés" }])).completados).toBe(2);
    expect(state(win)).toMatchObject({ "legacy-country": "Argentina", "legacy-language": "Inglés", "legacy-prefilled": "Uruguay", submitted: 0 });
  });
  it("reemplaza un content script anterior al actualizar la extensión", async () => {
    const { win } = setup(["legacy"]);
    const legacyWindow = win as DOMWindow & { __maru: Partial<Api> & { version?: string } };
    legacyWindow.__maru = { version: "0.3.0" };
    win.eval(content);
    expect(legacyWindow.__maru.version).toBe("0.3.1");
    expect((await legacyWindow.__maru.scan!()).fields).toHaveLength(1);
  });
  it("preserva selecciones previas, incluso cuando están en la primera opción", async () => {
    const { api } = setup(["prefilled", "native-prefilled", "legacy-prefilled"]);
    expect((await api.scan()).fields).toHaveLength(0);
  });
  it("no sobreescribe una selección que la persona cambió mientras esperaba la respuesta", async () => {
    const { win, api } = setup(["native"]);
    const { fields } = await api.scan();
    win.document.querySelector("select")!.value = "AR";
    expect(await api.apply([{ id: fields[0].id, valor: "Brasil" }])).toMatchObject({ completados: 0, pendientes: 0 });
    expect(win.document.querySelector("select")!.value).toBe("AR");
  });
  it("conserva la protección de main contra respuestas de una lectura anterior", async () => {
    const { win, api } = setup(["native"]);
    const old = await api.scan();
    const current = await api.scan();
    const answers = [{ id: current.fields[0].id, valor: "Brasil" }];
    expect((await api.apply(answers, null, old.pass)).completados).toBe(0);
    expect(win.document.querySelector("select")!.value).toBe("");
    expect((await api.apply(answers, null, current.pass)).completados).toBe(1);
    expect(win.document.querySelector("select")!.value).toBe("BR");
  });
  it("no elige la primera coincidencia cuando hay dos opciones parecidas", async () => {
    const { win, api } = setup(["ambiguous"]);
    const { fields } = await api.scan();
    const result = await api.apply([{ id: fields[0].id, valor: "Argentina" }]);
    expect(win.document.querySelector("select")!.value).toBe("");
    expect(result).toMatchObject({ completados: 0, pendientes: 1 });
  });
  it("no cuenta un clic que el formulario no aceptó como campo completado", async () => {
    const { win, api } = setup(["blocked"]);
    const { fields } = await api.scan();
    expect(fields).toHaveLength(1);
    expect(await api.apply([{ id: fields[0].id, valor: "Argentina" }])).toMatchObject({ completados: 0, pendientes: 1 });
    expect(state(win)["blocked-country"]).toBe("");
  });
  it("deja que la persona envíe después de terminar el autocompletado", async () => {
    const { win, api } = setup(["button"]);
    const { fields } = await api.scan();
    expect(fields).toHaveLength(1);
    await api.apply([{ id: fields[0].id, valor: "Argentina" }]);
    win.document.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    expect(state(win).submitted).toBe(1);
  });
});
