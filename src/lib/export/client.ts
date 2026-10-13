"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CvPaper from "@/components/cv/CvPaper";
import { THEMES } from "@/components/cv/themes";
import type { CvDoc } from "../schemas";
import { downloadBlob } from "./download";

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

/** Renderiza el mismo componente de la vista previa (sin controles) y lo manda a imprimir a PDF. */
export async function downloadPdf(doc: CvDoc, filename: string): Promise<void> {
  const html = renderToStaticMarkup(createElement(CvPaper, { doc, mode: "export" }));
  const blob = await fetchFile(
    "/api/export/pdf",
    { html, padY: THEMES[doc.template].padY },
    "No pudimos generar el PDF. Descargá el Word: tiene el mismo contenido.",
  );
  downloadBlob(blob, `${filename}.pdf`);
}

export async function downloadDocx(doc: CvDoc, filename: string): Promise<void> {
  downloadBlob(await fetchFile("/api/export/docx", { doc }, "No pudimos generar el Word. Probá de nuevo."), `${filename}.docx`);
}
