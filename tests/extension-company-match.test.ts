import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

type Post = { key: string; company: string; title: string; updatedAt: number };
type Page = { urls: string[]; title: string; text: string };
const sandbox: { maruMatchByCompany?: (list: Post[], page: Page, now?: number) => Post | null } = {};
vm.runInNewContext(readFileSync(new URL("../extension/jobkey.js", import.meta.url), "utf8"), { self: sandbox, URL });
const match = (list: Post[], page: Partial<Page>) => sandbox.maruMatchByCompany!(list, { urls: [], title: "", text: "", ...page }, NOW);

const NOW = Date.UTC(2026, 9, 23);
const DAY = 24 * 3600 * 1000;
const rebill: Post = { key: "linkedin.com/jobs/view/123", company: "Rebill.com", title: "Head of Growth", updatedAt: NOW - DAY };
const tucan: Post = { key: "linkedin.com/jobs/view/456", company: "Tucán", title: "Product Analyst", updatedAt: NOW - 2 * DAY };

describe("postulación por empresa cuando el link no coincide", () => {
  it("aviso en LinkedIn y formulario en el ATS de la empresa: la reconoce por el link del formulario", () => {
    expect(match([tucan, rebill], { urls: ["https://jobs.lever.co/rebill/0b6f2a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b/apply"] })).toBe(rebill);
    expect(match([tucan, rebill], { urls: ["https://careers.rebill.com/head-of-growth"] })).toBe(rebill);
  });

  it("por el título de la página, sin importar tildes ni mayúsculas", () => {
    expect(match([rebill, tucan], { urls: ["https://apply.workable.com/x/j/ABC/"], title: "Product Analyst - TUCAN" })).toBe(tucan);
  });

  it("en el texto sólo cuenta si también aparece el puesto", () => {
    const urls = ["https://apply.workable.com/x/j/ABC/"];
    expect(match([rebill], { urls, text: "Trabajamos con Rebill y otros clientes. Buscamos alguien para soporte." })).toBeNull();
    expect(match([rebill], { urls, text: "Rebill busca Head of Growth para liderar adquisición." })).toBe(rebill);
  });

  it("no elige si la empresa no aparece, si es vieja o si dos empatan", () => {
    expect(match([rebill], { urls: ["https://boards.greenhouse.io/otra/jobs/1"], title: "Otra empresa" })).toBeNull();
    expect(match([{ ...rebill, updatedAt: NOW - 40 * DAY }], { urls: ["https://careers.rebill.com/x"] })).toBeNull();
    const otroPuesto = { ...rebill, key: "linkedin.com/jobs/view/789", title: "Data Engineer" };
    expect(match([rebill, otroPuesto], { urls: ["https://careers.rebill.com/x"] })).toBeNull();
    expect(match([rebill, otroPuesto], { urls: ["https://careers.rebill.com/x"], title: "Head of Growth" })).toBe(rebill);
  });

  it("ignora nombres de empresa demasiado cortos", () => {
    expect(match([{ ...rebill, company: "S.A." }], { urls: ["https://sa.com/jobs"] })).toBeNull();
  });
});
