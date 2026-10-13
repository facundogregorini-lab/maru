"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CvPaper from "@/components/cv/CvPaper";
import { THEMES } from "@/components/cv/themes";
import type { CvDoc } from "../schemas";
import { downloadBlob } from "./download";

/** Renderiza el mismo componente de la vista previa (sin controles) y lo manda a imprimir a PDF. */
export async function downloadPdf(doc: CvDoc, filename: string): Promise<void> {
  const html = renderToStaticMarkup(createElement(CvPaper, { doc, mode: "export" }));
  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, padY: THEMES[doc.template].padY }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "No pudimos generar el PDF.");
  }
  downloadBlob(await res.blob(), `${filename}.pdf`);
}
