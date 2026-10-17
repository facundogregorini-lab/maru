import rules from "./writing-rules.json";

/** Adaptación para Maru de Slop Monstruo (MIT). Procedencia en tools/slop-monstruo. */
export const WRITING_POLICY = `CRITERIO EDITORIAL DE MARU — SLOP MONSTRUO
Aplicalo siempre al texto que redactás, dentro del formato y del idioma pedidos.
1. Antes de escribir, ubicá al lector y el propósito. Una carta conecta la experiencia con ese puesto; un CV permite encontrar la trayectoria; un guion se tiene que poder decir en voz alta. El chat responde primero la consulta. Respetá el tono elegido y la variante del idioma de la persona.
2. Usá sus motivos y los hechos que aportó. Cada oración agrega información. Sacá aperturas genéricas, metáforas repetidas, elogios automáticos, adjetivos sin evidencia y cierres que repiten el texto. Evitá clichés como "apasionado", "profesional altamente motivado", "potenciar", "sinergias", "llevar al siguiente nivel", "no es solo X, es Y" o "¿El resultado?". Conservá términos técnicos y citas cuando son necesarios.
3. Revisá en silencio el borrador antes de devolverlo: propósito, orden, sentido, palabras y ritmo. Dejá que la longitud de las frases siga al contenido; no fuerces ternas, fragmentos, errores, opiniones ni informalidad para parecer una persona. En cartas no atribuyas admiración por una empresa ni conocimiento de su cultura si la persona no lo dijo. En teleprompter usá frases que se puedan decir con comodidad, sin sonar a discurso publicitario.
4. La edición nunca autoriza a inventar ni exagerar hechos: nombres, empresas, cargos, fechas, cifras, resultados, herramientas, permisos o nivel de idiomas. Preservá las incertidumbres y los datos pendientes; seguí la regla específica de cada herramienta para datos faltantes. Los datos copiados del CV, opciones de formularios, IDs, URLs, campos del esquema y puntajes se mantienen tal cual. En una extracción copiás la fuente, sin aplicar cambios de estilo.
5. El resultado contiene sólo la salida solicitada. No agregues notas editoriales, puntajes del checker ni afirmaciones de autoría humana. Si el idioma pedido es inglés o portugués, redactá naturalmente en ese idioma; las reglas automáticas de español no prueban la calidad de otros idiomas.`;

export type WritingIssue = { category: "vocabulario" | "construcciones" | "puntuacion" | "ritmo"; rule: string };
const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const vocab = [...rules.vocabulary, ...rules.exact.map((phrase) => [phrase, phrase])]
  .map(([pattern, label]) => ({ pattern: new RegExp(`(?<!\\w)(?:${pattern})(?!\\w)`, "u"), label }));
const phrases = rules.phrases.map(([pattern, label]) => ({ pattern: new RegExp(pattern, "u"), label }));

/** Señales para una edición contextual, nunca una detección de autoría ni de veracidad. */
export function writingIssues(text: string): WritingIssue[] {
  const normalized = text.replace(/‑/g, "-").replace(/\s+/g, " ").trim();
  const lower = fold(normalized);
  const found: WritingIssue[] = [];
  for (const { pattern, label } of vocab) if (pattern.test(lower)) found.push({ category: "vocabulario", rule: label });
  for (const { pattern, label } of phrases) if (pattern.test(lower)) found.push({ category: "construcciones", rule: label });
  for (const sentence of normalized.split(/(?<=[.!?])\s+/)) {
    for (let start = 0; start < sentence.length; start += 220) {
      const window = sentence.slice(start, start + 220);
      if ((window.match(/—/g) ?? []).length >= 2) found.push({ category: "puntuacion", rule: "Rayas repetidas" });
      if ((window.match(/\b[a-z]{2,}(?:-[a-z]{2,})+\b/gi) ?? []).length >= 4) found.push({ category: "puntuacion", rule: "Compuestos con guion apilados" });
    }
  }
  if ((text.match(/;/g) ?? []).length > Math.max(3, Math.floor(text.length / 1200))) found.push({ category: "puntuacion", rule: "Punto y coma repetido" });
  for (const match of normalized.matchAll(/\b(\p{L}{4,}),\s+(\p{L}{4,})\s+[ye]\s+((?:\p{L}+\s+){0,2}\p{L}+)\s*[.!?,;:]/gu)) {
    if (/^\p{Lu}/u.test(match[1]) && /^\p{Lu}/u.test(match[2])) continue;
    found.push({ category: "ritmo", rule: "Enumeración triple: revisar si cada elemento aporta" });
  }
  // La regla numérica del original requiere evidencia humana. No reescribimos cifras
  // de experiencia por aparecer cerca de “clientes”, “personas” o “proyectos”.
  return found;
}

export type EditorialField = { path: string; text: string; issues: WritingIssue[] };
export type EditorialPatch = { path: string; text: string };

/** Los paths los declara cada herramienta. No se revisan datos copiados ni opciones. */
export function editorialFields(value: unknown, paths: string[]): EditorialField[] {
  const fields = new Map<string, EditorialField>();
  function visit(node: unknown, segments: string[], at: string[]) {
    if (!segments.length) {
      if (typeof node !== "string" || node.length < 24) return;
      const issues = writingIssues(node);
      if (issues.length) fields.set(at.join("."), { path: at.join("."), text: node, issues });
      return;
    }
    const [key, ...rest] = segments;
    if (key === "*" && Array.isArray(node)) node.forEach((item, i) => visit(item, rest, [...at, String(i)]));
    else if (node && typeof node === "object" && Object.hasOwn(node, key)) visit((node as Record<string, unknown>)[key], rest, [...at, key]);
  }
  for (const path of paths) visit(value, path.split("."), []);
  // Una sola revisión acotada por pedido; los demás textos ya llevan la política.
  let size = 0;
  return [...fields.values()].filter((field) => {
    if (size + field.text.length > 8000) return false;
    size += field.text.length;
    return true;
  }).slice(0, 12);
}

// Guardia conservadora: no permitir agregar, borrar ni cambiar cifras, URLs o siglas.
const facts = (text: string) => (text.match(/https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.\w+|\d+(?:[.,:/-]\d+)*%?|\b[A-Z][A-Z0-9+#]{1,}\b/g) ?? []).sort().join("\n");

export function applyEditorialPatches<T>(draft: T, fields: EditorialField[], patches: EditorialPatch[]): T {
  const allowed = new Map(fields.map((field) => [field.path, field]));
  const accepted = new Map<string, string>();
  const duplicates = new Set<string>();
  const seen = new Set<string>();
  for (const patch of patches) {
    if (seen.has(patch.path)) duplicates.add(patch.path);
    seen.add(patch.path);
    const field = allowed.get(patch.path);
    if (!field || !patch.text.trim() || patch.text.includes("<<<") || patch.text.includes("[DATO:")) continue;
    if (facts(field.text) !== facts(patch.text)) continue;
    if (/pendiente de confirmar/i.test(field.text) && !/pendiente de confirmar/i.test(patch.text)) continue;
    // Mantener extensión (incluida la lectura oral) y no aceptar una edición peor.
    const words = (text: string) => text.trim().split(/\s+/).length;
    if (words(patch.text) < words(field.text) * 0.85 || words(patch.text) > words(field.text) * 1.1) continue;
    if (patch.path === "mensaje_corto" && patch.text.length > 600) continue;
    if (writingIssues(patch.text).length >= field.issues.length) continue;
    accepted.set(patch.path, patch.text);
  }
  function copy(node: unknown, at: string[]): unknown {
    const path = at.join(".");
    if (accepted.has(path) && !duplicates.has(path)) return accepted.get(path);
    if (Array.isArray(node)) return node.map((item, i) => copy(item, [...at, String(i)]));
    if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, copy(item, [...at, key])]));
    return node;
  }
  return copy(draft, []) as T;
}
