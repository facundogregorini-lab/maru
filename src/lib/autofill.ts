import type Anthropic from "@anthropic-ai/sdk";
import type { AutofillAnswer, AutofillField, AutofillRequest } from "./schemas";

/**
 * Autocompletar formularios de postulación desde la extensión de Chrome.
 * La extensión detecta los campos, la IA decide qué va en cada uno y este módulo
 * arma el pedido y valida la respuesta antes de devolverla: sólo opciones que existen,
 * nada de campos inventados y el largo máximo de cada campo respetado.
 */

type Block = Anthropic.Beta.BetaContentBlockParam;

const MAX_PAGE_TEXT = 12000;

export function autofillBlocks(body: AutofillRequest, today = new Date()): Block[] {
  const fields = body.fields.map((f) => JSON.stringify(f)).join("\n");
  return [
    {
      type: "text",
      text: [
        `Fecha de hoy: ${today.toISOString().slice(0, 10)}`,
        `<perfil>\n${JSON.stringify(body.profile)}\n</perfil>`,
        `<datos_extra>\n${body.extras?.trim() || "(la persona no cargó datos extra)"}\n</datos_extra>`,
        `<cv_adjuntable>${body.hasCv ? "sí: la persona subió su CV como archivo" : "no"}</cv_adjuntable>`,
        `<pagina url="${attr(body.page.url)}" titulo="${attr(body.page.title)}">\n${body.page.text.slice(0, MAX_PAGE_TEXT)}\n</pagina>`,
        `<campos>\n${fields}\n</campos>`,
        "Completá el formulario.",
      ].join("\n\n"),
    },
  ];
}

const attr = (s: string) => s.replace(/"/g, "'");

/** Minúsculas, sin acentos ni espacios de más: para comparar opciones. */
export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s​-‍⁠﻿]+/g, " ")
    .trim();
}

const YES = new Set(["si", "yes", "sim", "oui", "true"]);
const NO = new Set(["no", "nao", "non", "false"]);

/** La opción que corresponde a `wanted`, con el texto exacto de la página; null si ninguna. */
export function matchOption(options: string[], wanted: string): string | null {
  const w = norm(wanted);
  if (!w) return null;
  const exact = options.find((o) => norm(o) === w);
  if (exact !== undefined) return exact;
  // "Sí" cuando la opción dice "Yes" (o al revés).
  const yes = YES.has(w);
  const no = NO.has(w);
  if (yes || no) {
    const set = yes ? YES : NO;
    const opt = options.find((o) => set.has(norm(o)) || set.has(norm(o).split(/[ ,.]/)[0]));
    if (opt !== undefined) return opt;
  }
  if (w.length < 3) return null;
  const starts = options.filter((o) => norm(o).startsWith(w));
  if (starts.length === 1) return starts[0];
  const contains = options.filter((o) => norm(o).includes(w));
  return contains.length === 1 ? contains[0] : null;
}

/**
 * Campos que decide siempre la persona, diga lo que diga la IA: datos demográficos
 * (EEO: género, etnia, discapacidad…) y aceptaciones legales (arbitraje, términos, privacidad).
 */
const DEMOGRAPHIC =
  /\b(gender|g[eé]nero|sexo?|pronouns?|pronombres?|ethnicity|ethnic|[eé]tnic[oa]|race|racial|raza|hispanic|latin[oa]|latinx|veterans?|veteran[oa]|disabilit(y|ies)|discapacidad|sexual orientation|orientaci[oó]n sexual|religi[oó]n|religion|transgender|lgbtq?)\b/i;
const LEGAL =
  /(arbitra|consent|consentimiento|privacy|privacidad|terms (and|&) conditions|terms of (use|service)|t[eé]rminos y condiciones|certify|certifico|acknowledge)/i;

export function isSensitive(f: AutofillField): boolean {
  const text = `${f.etiqueta} ${f.ayuda ?? ""}`;
  return DEMOGRAPHIC.test(text) || LEGAL.test(text);
}

/** Deja sólo respuestas válidas para los campos que existen. */
export function normalizeAnswers(
  fields: AutofillField[],
  campos: AutofillAnswer[],
  hasCv: boolean,
): AutofillAnswer[] {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const out: AutofillAnswer[] = [];
  for (const c of campos) {
    const f = byId.get(c.id);
    if (!f || seen.has(f.id) || isSensitive(f)) continue;
    const valor = clean(f, c.valor.trim(), hasCv);
    if (!valor) continue;
    seen.add(f.id);
    out.push({ id: f.id, valor, revisar: c.revisar, nota: c.revisar ? c.nota.trim() : "" });
  }
  return out;
}

function clean(f: AutofillField, valor: string, hasCv: boolean): string | null {
  if (!valor) return null;
  const options = f.opciones ?? [];
  switch (f.tipo) {
    case "seleccion":
    case "opcion_unica":
      return matchOption(options, valor);
    case "multiple": {
      const picked = valor.split("\n").map((v) => matchOption(options, v));
      const unique = [...new Set(picked.filter((v): v is string => v !== null))];
      return unique.length ? unique.join("\n") : null;
    }
    case "casilla":
      return YES.has(norm(valor)) ? "sí" : null;
    case "archivo":
      return hasCv && norm(valor) === "cv" ? "cv" : null;
    case "numero": {
      const n = valor.replace(/[^\d.,-]/g, "").replace(",", ".");
      return /^-?\d+(\.\d+)?$/.test(n) ? n : null;
    }
    case "fecha":
      return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
    case "mes":
      return /^\d{4}-\d{2}$/.test(valor) ? valor : null;
    default:
      return f.max_caracteres && valor.length > f.max_caracteres ? valor.slice(0, f.max_caracteres).trimEnd() : valor;
  }
}
