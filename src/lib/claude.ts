import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { fetchJobPage, fetchLinkedinProfile, isHttpUrl } from "./job";
import type { CandidateInput } from "./schemas";

const client = new Anthropic();
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

export class UserFacingError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400,
  ) {
    super(message);
  }
}

const MIN_JOB_TEXT = 300;

/** Junta vacante + CV + feedback en bloques de contenido para Claude. */
export async function buildContext(input: CandidateInput): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  if (!input.feedback?.trim()) {
    throw new UserFacingError("Contanos por qué te interesa la vacante.", "FEEDBACK_MISSING");
  }

  // 1. Vacante
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

  // 2. CV / LinkedIn
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  let profileText = input.cvText?.trim() ?? "";
  if (input.cvPdfBase64) {
    blocks.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.cvPdfBase64 },
      title: "CV actual de la persona",
    });
  }
  if (input.linkedinUrl && isHttpUrl(input.linkedinUrl) && !input.cvPdfBase64 && !profileText) {
    profileText = (await fetchLinkedinProfile(input.linkedinUrl)) ?? "";
    if (!profileText) {
      throw new UserFacingError(
        "LinkedIn no nos deja leer tu perfil directamente. Descargalo en PDF (en tu perfil: Más → Guardar en PDF) y subilo.",
        "LINKEDIN_BLOCKED",
        422,
      );
    }
  }
  if (!input.cvPdfBase64 && !profileText) {
    throw new UserFacingError("Subí tu CV en PDF, tu LinkedIn en PDF o pegá tu experiencia.", "CV_MISSING");
  }

  blocks.push({
    type: "text",
    text: [
      `<vacante url="${input.jobUrl}" titulo_pagina="${jobTitle.replace(/"/g, "'")}">\n${jobText}\n</vacante>`,
      formFields.length
        ? `<campos_formulario_detectados>\n${formFields.map((f) => `- ${f}`).join("\n")}\n</campos_formulario_detectados>`
        : "<campos_formulario_detectados>No se detectaron campos en la página.</campos_formulario_detectados>",
      profileText ? `<perfil_texto>\n${profileText}\n</perfil_texto>` : "",
      `<feedback_de_la_persona>\n${input.feedback.trim()}\n</feedback_de_la_persona>`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  return blocks;
}

/** Llamada con salida estructurada validada por Zod. */
export async function askStructured<T extends z.ZodType>(opts: {
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  schema: T;
  effort: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
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
    console.error("Falta o es inválida ANTHROPIC_API_KEY");
    return Response.json({ error: "El servicio no está configurado todavía.", code: "CONFIG" }, { status: 500 });
  }
  if (err instanceof Anthropic.APIError) {
    console.error("Anthropic API error", err.status, err.message);
    return Response.json({ error: "Algo falló del lado de la IA. Probá de nuevo.", code: "API" }, { status: 502 });
  }
  console.error(err);
  return Response.json({ error: "Algo salió mal. Probá de nuevo.", code: "UNKNOWN" }, { status: 500 });
}
