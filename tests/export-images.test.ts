import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CvPaper from "@/components/cv/CvPaper";
import { TEMPLATES } from "@/components/cv/themes";
import { SESSION_COOKIE, createSessionToken } from "@/lib/auth";
import { sampleCv } from "./fixtures/cv/sample";

const { page, browser } = vi.hoisted(() => {
  const page = { setJavaScriptEnabled: vi.fn(), setRequestInterception: vi.fn(), on: vi.fn(), setContent: vi.fn(), evaluate: vi.fn(), pdf: vi.fn() };
  return { page, browser: { newPage: vi.fn(() => page), close: vi.fn(async () => {}) } };
});
vi.mock("puppeteer-core", () => ({ default: { launch: vi.fn(() => browser) } }));
const { POST } = await import("@/app/api/export/pdf/route");
const photo = `data:image/png;base64,${readFileSync(new URL("./fixtures/cv/photo.png", import.meta.url)).toString("base64")}`;
const req = () => new Request("http://test/api/export/pdf", { method: "POST", headers: { cookie: `${SESSION_COOKIE}=${createSessionToken("qc@example.test")}` }, body: JSON.stringify({ html: `<article><img src="${photo}"></article>` }) });
beforeEach(() => { vi.clearAllMocks(); page.evaluate.mockImplementation((fn) => fn()); page.pdf.mockResolvedValue(Buffer.from("%PDF-fixture")); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("incluye la foto en los 24 diseños y la omite si la persona la desactiva", () => {
  const doc = { ...sampleCv(), photo: { dataUrl: photo, shape: "circle" as const }, showPhoto: true };
  for (const { id } of TEMPLATES) expect(renderToStaticMarkup(createElement(CvPaper, { doc: { ...doc, template: id }, mode: "export" }))).toContain(photo);
  expect(renderToStaticMarkup(createElement(CvPaper, { doc: { ...doc, showPhoto: false }, mode: "export" }))).not.toContain("<img");
});

it("espera la decodificación de la foto antes de imprimir", async () => {
  let decoded!: () => void;
  const decode = vi.fn(() => new Promise<void>((resolve) => { decoded = resolve; }));
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve() }, images: [{ src: photo, decode }] });
  const pending = POST(req());
  await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce());
  expect(page.pdf).not.toHaveBeenCalled();
  decoded();
  expect((await pending).status).toBe(200);
  expect(page.pdf).toHaveBeenCalledOnce();
  expect(browser.close).toHaveBeenCalledOnce();
  expect(page.setJavaScriptEnabled).toHaveBeenCalledWith(false);
  expect(page.setContent.mock.calls[0][0]).toContain("Content-Security-Policy");
});

it("si la foto falla no entrega un PDF que la perdió silenciosamente", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve() }, images: [{ src: photo, decode: () => Promise.reject(new Error("La foto no se pudo decodificar")) }] });
  const response = await POST(req());
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({ code: "PDF_FAILED", stage: "render" });
  expect(page.pdf).not.toHaveBeenCalled();
  expect(browser.close).toHaveBeenCalledOnce();
});

it("ignora imágenes externas bloqueadas por la política del exportador", async () => {
  const decode = vi.fn(() => Promise.reject(new Error("Bloqueada")));
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve() }, images: [{ src: "https://example.test/externa.png", decode }] });
  expect((await POST(req())).status).toBe(200);
  expect(decode).not.toHaveBeenCalled();
});
