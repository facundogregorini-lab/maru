import { readFileSync } from "node:fs";
import { JSDOM, type DOMWindow } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";
import { profileUrl } from "@/lib/contactos";

const linkedin = readFileSync(new URL("../extension/linkedin.js", import.meta.url), "utf8");
const fixture = (name: string) => readFileSync(new URL(`./fixtures/linkedin/${name}`, import.meta.url), "utf8");

type Card = { url: string; texto: string };
type Api = {
  profileUrl(u: string): string;
  readSearch(ms?: number): Promise<{ login: boolean; cards: Card[]; timeout: boolean }>;
  prepareInvite(note: string, ms?: number): Promise<{ estado: string; recortada?: boolean }>;
};
let dom: JSDOM | undefined;
afterEach(() => dom?.window.close());

function load(html: string, url: string, mode?: string, behavior?: string) {
  dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url });
  const win = dom.window;
  // JSDOM no calcula layout: todo lo que no está oculto mide algo.
  const visible = (el: Element) => !el.closest("[hidden]") && win.getComputedStyle(el).display !== "none";
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    const v = visible(this);
    return { x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 40, width: v ? 200 : 0, height: v ? 40 : 0, toJSON() {} };
  };
  if (mode) (win as DOMWindow & { __mode?: string }).__mode = mode;
  if (behavior) win.eval(behavior);
  win.eval(linkedin);
  return { win, api: (win as DOMWindow & { __maruLinkedIn: Api }).__maruLinkedIn };
}

const state = (win: DOMWindow) => JSON.parse(win.document.getElementById("state")!.textContent!);
const profile = (mode: string) => load(fixture("profile.html"), "https://www.linkedin.com/in/laura-gomez/", mode, fixture("profile.js"));

describe("búsqueda de personas en LinkedIn", () => {
  it("lee una tarjeta por persona, con su perfil y su texto", async () => {
    const { api } = load(fixture("search.html"), "https://www.linkedin.com/search/results/people/?keywords=%22Rebill%22%20growth");
    const { cards, login, timeout } = await api.readSearch(1000);
    expect(login).toBe(false);
    expect(timeout).toBe(false);
    // Laura (sin la conexión en común de su tarjeta) y Pedro; el miembro sin perfil y la tarjeta repetida, no.
    expect(cards.map((c) => c.url)).toEqual(["https://www.linkedin.com/in/laura-gomez/", "https://www.linkedin.com/in/pedro-ruiz/"]);
    expect(cards[0].texto).toContain("Head of Growth en Rebill");
    expect(cards[0].texto).toContain("2.º");
    expect(cards[1].texto).toContain("Talent Acquisition Partner en Rebill");
    expect(cards.every((c) => c.texto.length <= 600)).toBe(true);
  });
  it("sin resultados no espera de más", async () => {
    const { api } = load("<main><h2>No se encontraron resultados</h2></main>", "https://www.linkedin.com/search/results/people/?keywords=x");
    expect(await api.readSearch(5000)).toEqual({ login: false, cards: [], timeout: false });
  });
  it("avisa si LinkedIn pide ingresar", async () => {
    const { api } = load("<main><h1>Ingresá</h1></main>", "https://www.linkedin.com/authwall?trk=x");
    expect((await api.readSearch(500)).login).toBe(true);
  });
  it("la url del perfil es la misma que en el servidor", () => {
    const { api } = load("<main></main>", "https://www.linkedin.com/feed/");
    for (const u of ["https://www.linkedin.com/in/Laura-Gomez?x=1", "https://ar.linkedin.com/in/pedro/details/", "https://www.linkedin.com/company/rebill/", "https://evil.com/in/x"]) {
      expect(api.profileUrl(u)).toBe(profileUrl(u));
    }
  });
});

describe("invitación con nota", () => {
  const nota = "Hola Laura, vi la búsqueda de Growth Analyst en Rebill. Llevé growth en Tucán y me encantaría conectar.";

  it("toca Conectar, agrega la nota y resalta Enviar sin enviarla", async () => {
    const { api, win } = profile("direct");
    expect(await api.prepareInvite(nota, 1000)).toEqual({ estado: "nota_lista", recortada: false });
    expect(win.document.querySelector("textarea")!.value).toBe(nota);
    expect(state(win)).toMatchObject({ note: nota, sent: false, sentWithoutNote: false, wrongPerson: false });
    const send = win.document.querySelector<HTMLElement>('[aria-label="Enviar invitación"]')!;
    expect(send.style.outline).toContain("3px solid");
    // El envío lo hace la persona.
    send.click();
    expect(state(win).sent).toBe(true);
  });
  it("respeta el largo máximo del campo", async () => {
    const { api, win } = profile("direct");
    const larga = `${nota} ${"Trabajé en adquisición y retención en varias startups de la región. ".repeat(3)}`;
    expect((await api.prepareInvite(larga, 1000)).recortada).toBe(true);
    expect(win.document.querySelector("textarea")!.value.length).toBeLessThanOrEqual(200);
  });
  it("busca Conectar dentro de «Más» y no toca el de otra persona", async () => {
    const { api, win } = profile("more");
    expect((await api.prepareInvite(nota, 1000)).estado).toBe("nota_lista");
    expect(state(win)).toMatchObject({ note: nota, sent: false, wrongPerson: false });
  });
  it("con las notas del mes agotadas, resalta «Enviar sin nota» y no lo toca", async () => {
    const { api, win } = profile("limit");
    expect((await api.prepareInvite(nota, 1000)).estado).toBe("limite_notas");
    expect(state(win)).toMatchObject({ sent: false, sentWithoutNote: false });
    const without = [...win.document.querySelectorAll<HTMLElement>('[role="dialog"] button')].find((b) => b.textContent === "Enviar sin nota")!;
    expect(without.style.outline).toContain("3px solid");
  }, 10000);
  it("reconoce una invitación pendiente y una conexión", async () => {
    expect((await profile("pending").api.prepareInvite(nota, 1000)).estado).toBe("pendiente");
    dom?.window.close();
    expect((await profile("connected").api.prepareInvite(nota, 1000)).estado).toBe("conectado");
  });
});
