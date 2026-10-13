import type { CvSource } from "./schemas";

export type CvMode = "linkedin" | "cv" | "texto";
export type CvFile = { name: string; base64: string; mime: string };

export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * Vercel acepta hasta 4,5 MB por request y base64 agrega un 33%:
 * con 3 MB de archivo el cuerpo queda en ~4 MB, con margen para el resto del formulario.
 */
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const MIN_TEXT_CHARS = 80;

/**
 * Única fuente de verdad del CV que se manda al servidor.
 * La validación del formulario ("¿hay CV?") y el cuerpo del request usan esta misma función,
 * así no pueden contradecirse.
 */
export function buildCvSource(mode: CvMode, file: CvFile | null, text: string): CvSource | null {
  if (mode === "texto") return text.trim().length >= MIN_TEXT_CHARS ? { kind: "texto", text: text.trim() } : null;
  if (!file?.base64) return null;
  return { kind: mode, fileBase64: file.base64, mimeType: file.mime };
}

/** ¿Los primeros bytes del base64 corresponden a un PDF ("%PDF")? */
export function looksLikePdf(base64: string): boolean {
  return base64.startsWith("JVBERi"); // "%PDF" en base64
}

/** ¿Es un DOCX (zip, "PK")? */
export function looksLikeDocx(base64: string): boolean {
  return base64.startsWith("UEsD");
}

/**
 * Normaliza el cuerpo de un request a un CvSource. Acepta también el formato de la versión
 * anterior de la app (cvPdfBase64 / cvText), para que una pestaña abierta antes de un deploy
 * siga funcionando en lugar de decir que no hay CV.
 */
export function normalizeCvSource(body: unknown): CvSource | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const source = b.source as CvSource | undefined;
  if (source && (source.fileBase64 || source.text)) return source;

  if (typeof b.cvPdfBase64 === "string" && b.cvPdfBase64) {
    return { kind: b.linkedinUrl ? "linkedin" : "cv", fileBase64: b.cvPdfBase64, mimeType: PDF_MIME };
  }
  if (typeof b.cvText === "string" && b.cvText.trim()) return { kind: "texto", text: b.cvText };
  return source;
}
