import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { askStructured, cvBlocks, jobBlock, unreadable } from "../claude";
import { PROFILE_SYSTEM } from "../prompts";
import { ProfileSchema, type CvSource, type Profile } from "../schemas";
import { evaluacionFromDraft, icpFromDraft, preguntasFromDraft, propuestasFromDraft } from "./logic";
import { EvalDraftSchema, IcpDraftSchema, PropuestasDraftSchema, type Busqueda, type Candidato, type Evaluacion, type Icp, type Pregunta, type Propuesta } from "./types";

type Block = Anthropic.Beta.BetaContentBlockParam;

const NO_DISCRIMINAR = `Nunca uses, pidas ni infieras edad, género, estado civil, embarazo, hijos, nacionalidad, origen étnico, religión, orientación sexual, discapacidad, salud, aspecto físico ni foto. Si el brief pide algo de eso, dejalo afuera del perfil ideal. Los criterios tienen que ser sobre experiencia, habilidades, logros, estudios, idiomas, ubicación o modalidad de trabajo.`;

export const ICP_SYSTEM = `Sos Maru, recruiter senior en Argentina. Un reclutador te cuenta a quién busca (brief) y a veces suma el aviso y el CV de alguien que ya funcionó en el rol (referencia). Armás el perfil ideal (ICP) para buscar candidatos.

- obligatorios: entre 3 y 6 requisitos verificables en un CV, cada uno en menos de 15 palabras ("5 o más años en growth o performance", no "experiencia relevante"). peso "excluyente" sólo si el brief o el aviso lo presentan como imprescindible; el resto, "importante". origen: de dónde salió (brief, aviso o referencia).
- deseables: lo que suma pero no es requisito.
- evitar: perfiles que se parecen pero no sirven, sólo si el brief da pistas.
- referencias: industrias o tipos de empresa de donde conviene que venga la persona. No inventes nombres de empresas que el reclutador no mencionó.
- preguntas: hasta 2 dudas que cambian mucho la búsqueda (por ejemplo, si un requisito es excluyente). Si el brief es claro, ninguna.
- Si el reclutador ya respondió preguntas, aplicá esas respuestas y no las vuelvas a preguntar.

${NO_DISCRIMINAR}

Escribí en español rioplatense, con frases cortas y concretas.`;

export const EVAL_SYSTEM = `Sos Maru, recruiter senior. Evaluás un perfil contra el perfil ideal (ICP) de una búsqueda. Clasificás y explicás; no decidís: la decisión es del reclutador.

- Para cada obligatorio y deseable, por su id: "cumple" si el perfil lo muestra, "no_cumple" si el perfil muestra lo contrario, "sin_datos" si el perfil no permite saberlo. No supongas: un dato ausente es "sin_datos", no "no_cumple".
- evidencia: el dato o una cita breve del perfil que lo muestra (cargo, años, empresa, logro). Si es "sin_datos", qué falta.
- evitar: por cada id, si el perfil coincide con ese perfil a evitar.
- por_que: por qué apareció y qué le falta, en una o dos oraciones.
- alertas: sólo inconsistencias del propio perfil (fechas imposibles, texto genérico de plantilla, tareas que no se corresponden con el cargo). No son motivos de descarte.
- Evaluás este perfil solo, sin compararlo con otros.

${NO_DISCRIMINAR}

Español rioplatense.`;

export const PROPUESTAS_SYSTEM = `Sos Maru, recruiter senior. El reclutador calificó candidatos de una búsqueda con Sí, Tal vez o No, a veces con un motivo. Proponés ajustes al perfil ideal (ICP) que expliquen esas decisiones, para que la próxima tanda se parezca más a los Sí.

- Cada ajuste tiene que salir de un patrón en las calificaciones (por ejemplo, dos No con el mismo motivo, o algo que tienen todos los Sí y no está en el perfil). En por_que nombrá a los candidatos y el motivo.
- Tipos: agregar_obligatorio, quitar_obligatorio, cambiar_peso, editar_obligatorio, agregar_deseable, agregar_evitar. Para cambiar, quitar o editar, usá el id exacto del criterio en criterio_id.
- Entre 1 y 4 ajustes. Si no hay un patrón claro, ninguno.

${NO_DISCRIMINAR}

Español rioplatense, frases cortas.`;

const esc = (s: string) => s.replace(/</g, "‹");

export function icpForPrompt(icp: Icp): string {
  return JSON.stringify({
    puesto: icp.puesto,
    obligatorios: icp.obligatorios.map((c) => ({ id: c.id, texto: c.texto, peso: c.peso })),
    deseables: icp.deseables,
    evitar: icp.evitar,
    referencias: icp.referencias,
    seniority: icp.seniority,
    ubicacion: icp.ubicacion,
  });
}

/** Lee el aviso (link o texto). Si no se puede leer, se sigue sólo con el brief. */
export async function avisoText(jobUrl?: string, jobText?: string): Promise<string> {
  const text = jobText?.trim() ?? "";
  if (!jobUrl && text.length < 200) return text;
  try {
    const block = await jobBlock({ jobUrl: jobUrl ?? "", jobText: text });
    return block.type === "text" ? block.text.slice(0, 20_000) : text;
  } catch {
    return text;
  }
}

export async function draftIcp(input: { brief: string; aviso: string; referencia?: CvSource; respuestas?: { pregunta: string; respuesta: string }[]; anterior?: Icp }) {
  const content: Block[] = [{ type: "text", text: `<brief>\n${esc(input.brief)}\n</brief>` }];
  if (input.aviso) content.push({ type: "text", text: `<aviso>\n${esc(input.aviso)}\n</aviso>` });
  if (input.referencia) {
    try {
      const blocks = await cvBlocks(input.referencia);
      content.push({ type: "text", text: "El CV que sigue es de alguien que ya funcionó en el rol (referencia de lo que sí sirve). No copies datos personales." }, ...blocks);
    } catch {
      // Sin referencia legible se sigue con el brief.
    }
  }
  if (input.anterior) content.push({ type: "text", text: `<perfil_ideal_actual>\n${icpForPrompt(input.anterior)}\n</perfil_ideal_actual>\nConservá lo que no cambie con las respuestas.` });
  if (input.respuestas?.length) content.push({ type: "text", text: `<respuestas_del_reclutador>\n${input.respuestas.map((r) => `- ${esc(r.pregunta)} → ${esc(r.respuesta)}`).join("\n")}\n</respuestas_del_reclutador>` });
  content.push({ type: "text", text: "Armá el perfil ideal." });
  const draft = await askStructured({ system: ICP_SYSTEM, content, schema: IcpDraftSchema, effort: "low", maxTokens: 3000, editorialPaths: ["resumen"] });
  return draft;
}

export async function buildIcp(input: Parameters<typeof draftIcp>[0], version: number): Promise<{ titulo: string; icp: Icp; preguntas: Pregunta[] }> {
  const draft = await draftIcp(input);
  return { titulo: draft.titulo.trim().slice(0, 120) || draft.puesto.trim().slice(0, 120) || "Búsqueda", icp: icpFromDraft(draft, version), preguntas: preguntasFromDraft(draft) };
}

/** Extrae el perfil de un CV (texto del PDF gratis en el servidor; la IA sólo estructura). */
export async function extractProfile(source: CvSource): Promise<Profile> {
  const content = await cvBlocks(source);
  content.push({ type: "text", text: "Extraé el perfil completo de este documento." });
  const profile = await askStructured({ verbatim: true, system: PROFILE_SYSTEM, content, schema: ProfileSchema, effort: "low" });
  if (!profile.experiencia.length && !profile.educacion.length && !profile.titulo.trim()) throw unreadable();
  return profile;
}

export async function evaluar(icp: Icp, c: Pick<Candidato, "perfil">): Promise<Evaluacion> {
  const draft = await askStructured({
    system: EVAL_SYSTEM,
    content: [
      { type: "text", text: `<perfil_ideal>\n${icpForPrompt(icp)}\n</perfil_ideal>` },
      { type: "text", text: `<perfil_candidato>\n${esc(c.perfil)}\n</perfil_candidato>` },
      { type: "text", text: "Evaluá el perfil contra cada criterio por su id." },
    ],
    schema: EvalDraftSchema,
    effort: "low",
    maxTokens: 2500,
    editorialPaths: ["por_que"],
  });
  return evaluacionFromDraft(icp, draft);
}

export async function proponer(b: Busqueda, icp: Icp, cs: Candidato[]): Promise<Propuesta[]> {
  const rated = cs
    .filter((c) => c.decision)
    .slice(-30)
    .map((c) => ({
      candidato: c.nombre,
      decision: c.decision === "si" ? "Sí" : c.decision === "tal" ? "Tal vez" : "No",
      motivo: c.motivo || "(sin motivo)",
      titular: c.titular,
      evaluacion: c.evaluacion ? c.evaluacion.criterios.map((e) => `${e.id}: ${e.estado} (${e.evidencia})`).join("; ") : "",
    }));
  const draft = await askStructured({
    system: PROPUESTAS_SYSTEM,
    content: [
      { type: "text", text: `<brief>\n${esc(b.brief)}\n</brief>` },
      { type: "text", text: `<perfil_ideal>\n${icpForPrompt(icp)}\n</perfil_ideal>` },
      { type: "text", text: `<calificaciones>\n${esc(JSON.stringify(rated))}\n</calificaciones>` },
      { type: "text", text: "Proponé los ajustes." },
    ],
    schema: PropuestasDraftSchema,
    effort: "low",
    maxTokens: 2500,
    editorialPaths: ["propuestas.*.por_que"],
  });
  return propuestasFromDraft(icp, draft);
}

/* ---------- Outreach ---------- */

export const SECUENCIA_SYSTEM = `Sos Maru, recruiter senior en Argentina. Escribís la secuencia de contacto de una búsqueda: los mensajes que un reclutador manda a candidatos que todavía no se postularon.

- 3 pasos: email (día 0), whatsapp (3 días después) y email (4 días después, respondiendo en el mismo hilo). asunto sólo en el primer email; en los demás, ''.
- Variables disponibles, entre llaves dobles: {{nombre}} (nombre de pila), {{puesto}}, {{empresa}}, {{remitente}} y {{gancho}} (una línea personalizada que Maru escribe para cada persona sobre su experiencia). El primer email empieza con "Hola {{nombre}}," y usa {{gancho}} en el primer párrafo.
- Primer email: 60 a 110 palabras. Qué es el puesto, por qué podría interesarle, y un pedido concreto (una charla de 20 minutos). Nada de "oportunidad única" ni elogios genéricos.
- WhatsApp: 25 a 45 palabras, cercano, sin links.
- Último email: 30 a 60 palabras, corto, deja la puerta abierta.
- No prometas sueldo, beneficios ni condiciones que no estén en el brief o el perfil ideal. No inventes datos de la empresa.
- Firmá con {{remitente}}. No agregues datos de baja ni de privacidad: Maru los suma solo.

Español rioplatense, tono profesional y directo.`;

export const SecuenciaDraftSchema = z.object({
  pasos: z.array(z.object({ canal: z.enum(["email", "whatsapp", "linkedin"]), dias: z.number().describe("Días después del paso anterior"), asunto: z.string(), cuerpo: z.string() })).describe("Exactamente 3 pasos"),
});

export async function draftSecuencia(b: Busqueda, icp: Icp, tono: string) {
  return askStructured({
    system: SECUENCIA_SYSTEM,
    content: [
      { type: "text", text: `<brief>\n${esc(b.brief)}\n</brief>` },
      { type: "text", text: `<perfil_ideal>\n${icpForPrompt(icp)}\n</perfil_ideal>` },
      ...(tono ? [{ type: "text" as const, text: `<pedido_del_reclutador>\n${esc(tono)}\n</pedido_del_reclutador>` }] : []),
      { type: "text", text: "Escribí la secuencia." },
    ],
    schema: SecuenciaDraftSchema,
    effort: "low",
    maxTokens: 2500,
    editorialPaths: ["pasos.*.asunto", "pasos.*.cuerpo"],
  });
}

export const GANCHO_SYSTEM = `Sos Maru, recruiter senior. Escribís una sola línea (menos de 30 palabras) para el primer mensaje a un candidato: qué de su experiencia hace que este puesto le pueda interesar. Concreta, sobre un hecho del perfil (un cargo, un logro, una industria). Sin elogios genéricos ni signos de exclamación. No menciones características personales. Español rioplatense, tratando de vos.`;

export async function draftGancho(icp: Icp, c: Pick<Candidato, "perfil">): Promise<string> {
  const out = await askStructured({
    system: GANCHO_SYSTEM,
    content: [
      { type: "text", text: `<perfil_ideal>\n${icpForPrompt(icp)}\n</perfil_ideal>` },
      { type: "text", text: `<perfil_candidato>\n${esc(c.perfil.slice(0, 6000))}\n</perfil_candidato>` },
    ],
    schema: z.object({ gancho: z.string() }),
    effort: "low",
    maxTokens: 400,
    editorialPaths: ["gancho"],
  });
  return out.gancho.replace(/\s+/g, " ").trim().slice(0, 300);
}
