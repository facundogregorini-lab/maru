import type { KeywordProposal } from "./schemas";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();

const NONE = "No encontramos una experiencia que la respalde.";

/**
 * Sólo palabras pedidas, experiencias que existen y frases que de verdad incluyen la palabra.
 * Las palabras que el modelo no devolvió vuelven sin frase, para que ninguna quede esperando.
 */
export function cleanProposals(raw: KeywordProposal[], palabras: string[], expIds: string[]): KeywordProposal[] {
  const wanted = new Map(palabras.map((p) => [norm(p), p]));
  const out: KeywordProposal[] = [];
  for (const p of raw) {
    const palabra = wanted.get(norm(p.palabra));
    if (!palabra || out.some((o) => o.palabra === palabra)) continue;
    const frase = p.frase.trim();
    const ok = expIds.includes(p.experiencia_id) && !!frase && ` ${norm(frase)} `.includes(` ${norm(palabra)} `) && !/\[[^\]]*\]/.test(frase);
    out.push(ok ? { palabra, experiencia_id: p.experiencia_id, frase, motivo: p.motivo.trim() } : { palabra, experiencia_id: "", frase: "", motivo: p.motivo.trim() || NONE });
  }
  for (const palabra of wanted.values()) if (!out.some((o) => o.palabra === palabra)) out.push({ palabra, experiencia_id: "", frase: "", motivo: NONE });
  return out;
}
