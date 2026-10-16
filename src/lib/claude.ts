import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import mammoth from "mammoth";
import { MIN_JOB_TEXT_CHARS } from "./inputValidation";
import type { z } from "zod";
import { fetchJobPage, isHttpUrl } from "./job";
import { DOCX_MIME, MIN_TEXT_CHARS, PDF_MIME, looksLikeDocx, looksLikePdf } from "./cvSource";
import type { CvSource, JobInput } from "./schemas";

// Se crea al primer uso: así importar este módulo (por ejemplo en tests) no exige la API key.
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

type Block = Anthropic.Beta.BetaContentBlockParam;

export class UserFacingError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
  }
}

const MIN_JOB_TEXT = MIN_JOB_TEXT_CHARS;

/** Lee la vacante (link y/o texto pegado) y la devuelve como bloque de texto para Claude. */
export async function jobBlock(input: JobInput): Promise<Block> {
  let jobText = input.jobText?.trim() ?? "";
  let formFields: string[] = [];
  let jobTitle = "";
  if (input.jobUrl && isHttpUrl(input.jobUrl)) {
    try {
      const page = await fetchJobPage(input.jobUrl);
      jobTitle = page.title;
      formFields = page.formFields;
      if (page.text.length >= MIN_JOB_TEXT) jobText = [jobText, page.text].filter(Boolean).join("\n\n");
    } catch {
      // seguimos con el texto pegado, si lo hay
    }
  }
  if (jobText.length < MIN_JOB_TEXT) {
    throw new UserFacingError(
      "No pudimos leer la publicación desde el link (algunos portales lo bloquean). Pegá el texto de la vacante y seguimos.",
      "JOB_FETCH_FAILED",
      422,
    );
  }
  return {
    type: "text",
    text: [
      `<vacante url="${input.jobUrl}" titulo_pagina="${jobTitle.replace(/"/g, "'")}">\n${jobText}\n</vacante>`,
      formFields.length
        ? `<campos_formulario_detectados>\n${formFields.map((f) => `- ${f}`).join("\n")}\n</campos_formulario_detectados>`
        : "<campos_formulario_detectados>No se detectaron campos en la página.</campos_formulario_detectados>",
    ].join("\n\n"),
  };
}

const CV_MISSING = "Subí el PDF de tu LinkedIn, tu CV o pegá tu experiencia.";

/** Convierte la fuente del CV (PDF de LinkedIn, CV en PDF/DOCX o texto) en bloques para Claude. */
export async function cvBlocks(source: CvSource | undefined): Promise<Block[]> {
  if (!source) throw new UserFacingError(CV_MISSING, "CV_MISSING");
  const label = source.kind === "linkedin" ? "Perfil de LinkedIn exportado a PDF" : "CV de la persona";

  if (source.fileBase64) {
    if (source.mimeType === PDF_MIME) {
      if (!looksLikePdf(source.fileBase64)) {
        throw new UserFacingError("El archivo no es un PDF válido. Probá exportarlo de nuevo o pegá tu experiencia.", "CV_INVALID", 422);
      }
      return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: source.fileBase64 }, title: label }];
    }
    if (source.mimeType === DOCX_MIME && looksLikeDocx(source.fileBase64)) {
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(source.fileBase64, "base64") });
      if (value.trim().length < MIN_TEXT_CHARS) throw unreadable();
      return [{ type: "text", text: `<cv titulo="${label}">\n${value.trim()}\n</cv>` }];
    }
    throw new UserFacingError("Aceptamos CVs en PDF o Word (.docx).", "CV_INVALID", 422);
  }
  if (source.text && source.text.trim().length >= MIN_TEXT_CHARS) {
    return [{ type: "text", text: `<cv titulo="Perfil pegado por la persona">\n${source.text.trim()}\n</cv>` }];
  }
  throw new UserFacingError(CV_MISSING, "CV_MISSING");
}

/** El archivo llegó bien pero no tiene texto legible (CV de Canva exportado como imagen, escaneos…). */
export function unreadable(): UserFacingError {
  return new UserFacingError(
    "No pudimos leer tu CV: parece estar guardado como imagen (pasa con algunos exportados de Canva o escaneados). Pegá tu experiencia como texto y seguimos.",
    "CV_UNREADABLE",
    422,
  );
}

export function feedbackBlock(feedback: string | undefined): Block {
  if (!feedback?.trim()) throw new UserFacingError("Contanos por qué te interesa la vacante.", "FEEDBACK_MISSING");
  return { type: "text", text: `<feedback_de_la_persona>\n${feedback.trim()}\n</feedback_de_la_persona>` };
}

/** Llamada con salida estructurada validada por Zod. */
export async function askStructured<T extends z.ZodType>(opts: {
  system: string;
  content: Block[];
  schema: T;
  effort: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    messages: [{ role: "user", content: opts.content }],
  });

  if (response.stop_reason === "refusal") {
    throw new UserFacingError("No pudimos procesar este pedido. Revisá el contenido e intentá de nuevo.", "REFUSAL", 422);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new UserFacingError("La respuesta quedó incompleta. Probá de nuevo.", "INCOMPLETE", 502);
  }
  return response.parsed_output as z.infer<T>;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof UserFacingError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("Falta ANTHROPIC_API_KEY en las variables de entorno", err);
    return Response.json({ error: "El servicio no está configurado todavía.", code: "CONFIG" }, { status: 500 });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ error: "Hay mucha demanda en este momento. Probá en un minuto.", code: "RATE_LIMIT" }, { status: 429 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    console.error("ANTHROPIC_API_KEY inválida");
    return Response.json({ error: "El servicio no está configurado todavía.", code: "CONFIG" }, { status: 500 });
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error", err.status, err.message);
    return Response.json({ error: "Algo falló del lado de la IA. Probá de nuevo.", code: "API" }, { status: 502 });
  }
  console.error(err);
  return Response.json({ error: "Algo salió mal. Probá de nuevo.", code: "UNKNOWN" }, { status: 500 });
}
