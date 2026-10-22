"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LetterPaper from "@/components/carta/LetterPaper";
import CvPaper from "@/components/cv/CvPaper";
import { resolveTheme } from "@/components/cv/themes";
import type { CartaDoc, CvDoc } from "../schemas";
import { downloadBlob } from "./download";

/** Error de descarga con el código del servidor (p. ej. AUTH_REQUIRED para pedir el login). */
export class DownloadError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function fetchFile(url: string, body: unknown, fallback: string): Promise<Blob> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Dejamos el detalle técnico en la consola para diagnosticar sin acceso a los logs del servidor.
    if (data.detail) console.error(`[${url}] ${data.stage}: ${data.detail}`);
    throw new DownloadError(data.error ?? fallback, data.code);
  }
  return res.blob();
}

const PDF_FALLBACK = "No pudimos generar el PDF. Descargá el Word: tiene el mismo contenido.";

/** El HTML del CV listo para imprimir, el mismo que va a /api/export/pdf. */
export function cvExportHtml(doc: CvDoc): { html: string; padY: number } {
  return { html: renderToStaticMarkup(createElement(CvPaper, { doc, mode: "export" })), padY: resolveTheme(doc).padY };
}

/** CV: el mismo componente de la vista previa (sin controles), impreso a PDF en el servidor. */
export async function downloadPdf(doc: CvDoc, filename: string): Promise<void> {
  downloadBlob(await fetchFile("/api/export/pdf", cvExportHtml(doc), PDF_FALLBACK), `${filename}.pdf`);
}

export async function downloadDocx(doc: CvDoc, filename: string): Promise<void> {
  downloadBlob(await fetchFile("/api/export/docx", { kind: "cv", doc }, "No pudimos generar el Word. Probá de nuevo."), `${filename}.docx`);
}

export async function downloadLetterPdf(doc: CartaDoc, filename: string): Promise<void> {
  const html = renderToStaticMarkup(createElement(LetterPaper, { doc, mode: "export" }));
  downloadBlob(await fetchFile("/api/export/pdf", { html, padY: resolveTheme(doc).padY }, PDF_FALLBACK), `${filename}.pdf`);
}

export async function downloadLetterDocx(doc: CartaDoc, filename: string): Promise<void> {
  downloadBlob(await fetchFile("/api/export/docx", { kind: "carta", doc }, "No pudimos generar el Word. Probá de nuevo."), `${filename}.docx`);
}
