/** Requisitos compartidos por formularios y servidor. Evita umbrales ocultos o contradictorios. */
export const MIN_JOB_TEXT_CHARS = 300;
export function jobInputIssue(url: string, text: string): string | null {
  if (text.trim().length >= MIN_JOB_TEXT_CHARS) return null;
  if (url.trim()) {
    try { const u = new URL(url.trim()); if (u.protocol === "http:" || u.protocol === "https:") return null; } catch { /* mostrar el campo a corregir */ }
    return "Revisá el link de la búsqueda: tiene que empezar con https:// o http://.";
  }
  if (text.trim()) return `Pegá el aviso completo: faltan ${MIN_JOB_TEXT_CHARS - text.trim().length} caracteres para poder analizarlo.`;
  return "Agregá el link o el texto completo de la búsqueda.";
}
