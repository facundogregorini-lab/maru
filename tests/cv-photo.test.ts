import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useState } from "react";
import CvEditor from "@/components/cv/CvEditor";
import { context, sampleCv } from "./fixtures/cv/sample";

const { downloadPdf } = vi.hoisted(() => ({ downloadPdf: vi.fn() }));
vi.mock("@/lib/export/client", () => ({ downloadPdf, downloadDocx: vi.fn(), DownloadError: class extends Error {} }));
vi.mock("@/components/auth/useLoginGate", () => ({ useLoginGate: () => ({ email: "qc@example.test", dialog: null, run: (_reason: string, action: () => void) => action() }) }));
const photo = `data:image/png;base64,${readFileSync(new URL("./fixtures/cv/photo.png", import.meta.url)).toString("base64")}`;
vi.mock("@/components/PhotoCropper", () => ({ default: ({ onDone, onCancel }: { onDone: (url: string, shape: "circle") => void; onCancel: () => void }) =>
  createElement("div", null, createElement("button", { onClick: () => onDone(photo, "circle") }, "Usar foto"), createElement("button", { onClick: onCancel }, "Cancelar recorte")) }));

let dom: JSDOM;
let root: Root;
beforeEach(async () => {
  downloadPdf.mockReset();
  dom = new JSDOM('<div id="root"></div>', { url: "http://fixture.test", pretendToBeVisual: true });
  for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "Node", "Event", "File"] as const) vi.stubGlobal(key, dom.window[key]);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  function Harness() { const [doc, setDoc] = useState(sampleCv); return createElement(CvEditor, { doc, setDoc, context, cambios: [] }); }
  root = createRoot(document.getElementById("root")!);
  await act(async () => { root.render(createElement(Harness)); });
});
afterEach(async () => { await act(async () => root.unmount()); dom.window.close(); vi.unstubAllGlobals(); });
const button = (name: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === name)!;
async function pickPhoto() {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", { value: [new dom.window.File(["fixture"], "foto.png", { type: "image/png" })] });
  await act(async () => { input.dispatchEvent(new dom.window.Event("change", { bubbles: true })); });
}

it("evita descargar sin la foto mientras el recorte está pendiente y exporta la aplicada", async () => {
  await pickPhoto();
  expect(button("Descargar PDF").disabled).toBe(true);
  expect(button("Descargar Word (.docx)").disabled).toBe(true);
  expect(document.querySelector('[role="status"]')?.textContent).toContain("Usar foto");
  await act(async () => { button("Usar foto").click(); });
  expect(button("Descargar PDF").disabled).toBe(false);
  await act(async () => { button("Descargar PDF").click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
  expect(downloadPdf).toHaveBeenCalledTimes(1);
  expect(downloadPdf.mock.calls[0][0]).toMatchObject({ showPhoto: true, photo: { dataUrl: photo, shape: "circle" } });
});

it("permite cancelar el recorte y descargar el CV sin foto", async () => {
  await pickPhoto();
  await act(async () => { button("Cancelar recorte").click(); });
  expect(button("Descargar PDF").disabled).toBe(false);
  await act(async () => { button("Descargar PDF").click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
  expect(downloadPdf.mock.calls[0][0].photo).toBeNull();
});
