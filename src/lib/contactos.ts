import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ProfileSchema } from "./schemas";

/**
 * Contactos de una vacante en LinkedIn: quién lidera el equipo (hiring manager), quién recluta y People/HR.
 * La extensión hace las búsquedas en el LinkedIn de la persona (su sesión, en su navegador) y manda las tarjetas
 * que vio. Este módulo arma los pedidos a la IA y valida lo que vuelve: sólo personas que estaban en las tarjetas,
 * sin repetir, y notas que entran en el límite de LinkedIn. Nunca se envía nada a LinkedIn desde el servidor.
 */

type Block = Anthropic.Beta.BetaContentBlockParam;

export const CONTACT_TYPES = ["hiring_manager", "recruiter", "people"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

/** LinkedIn corta la nota de invitación en 200 caracteres en cuentas gratis (300 en Premium). */
export const NOTE_MAX = 200;
export const MAX_SEARCHES = 3;
export const MAX_CONTACTS = 5;
const MAX_PAGE_TEXT = 12000;

const PageSchema = z.object({ url: z.string().max(2000), title: z.string().max(500), text: z.string().max(20000) });

export const ContactosPlanRequestSchema = z.object({
  page: PageSchema,
  /** La postulación que la persona armó en Maru para esta vacante, si la extensión la reconoció. */
  postulacion: z.object({ empresa: z.string().max(200), puesto: z.string().max(300) }).optional(),
});
export type ContactosPlanRequest = z.infer<typeof ContactosPlanRequestSchema>;

export const ContactosPlanSchema = z.object({
  empresa: z.string().describe("Nombre de la empresa que contrata, como se la conoce (sin S.A., Inc., etc.). '' si la página no lo dice."),
  puesto: z.string().describe("El puesto de la vacante, tal como figura"),
  area: z.string().describe("Área o equipo del puesto, en dos o tres palabras (por ejemplo, 'growth marketing')"),
  busquedas: z
    .array(
      z.object({
        tipo: z.enum(CONTACT_TYPES),
        cargos: z
          .string()
          .describe("Cargos a buscar, en el idioma en que esa empresa los usaría en LinkedIn. Hasta 3 alternativas unidas con OR; los de varias palabras, entre comillas."),
      }),
    )
    .describe("Una búsqueda por tipo: hiring_manager, recruiter y people, en ese orden"),
});
export type ContactosPlan = z.infer<typeof ContactosPlanSchema>;

export const ContactCardSchema = z.object({
  url: z.string().max(300),
  texto: z.string().max(600),
  busqueda: z.enum(CONTACT_TYPES),
});
export type ContactCard = z.infer<typeof ContactCardSchema>;

export const ContactosElegirRequestSchema = z.object({
  empresa: z.string().min(1).max(200),
  puesto: z.string().max(300),
  vacante: z.string().max(MAX_PAGE_TEXT),
  profile: ProfileSchema.optional(),
  tarjetas: z.array(ContactCardSchema).min(1).max(40),
});
export type ContactosElegirRequest = z.infer<typeof ContactosElegirRequestSchema>;

export const ContactosElegidosSchema = z.object({
  contactos: z
    .array(
      z.object({
        url: z.string().describe("La url de la tarjeta, tal cual"),
        nombre: z.string().describe("Nombre de la persona, tal como figura en la tarjeta"),
        cargo: z.string().describe("Cargo actual, tal como figura en la tarjeta"),
        tipo: z.enum(CONTACT_TYPES),
        motivo: z.string().describe("Por qué contactar a esta persona para esta vacante, en menos de 20 palabras"),
        nota: z.string().describe("Nota de la invitación para conectar. Menos de 190 caracteres contando espacios."),
        mensaje: z.string().describe("Mensaje para mandarle cuando acepte la invitación. Entre 50 y 90 palabras."),
      }),
    )
    .describe("Entre 2 y 5 personas, de la más a la menos importante. Si nadie de las tarjetas trabaja hoy en la empresa, vacío."),
});
export type ContactoElegido = z.infer<typeof ContactosElegidosSchema>["contactos"][number];

const attr = (s: string) => s.replace(/"/g, "'");
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

export function contactosPlanBlocks(body: ContactosPlanRequest): Block[] {
  return [
    {
      type: "text",
      text: [
        ...(body.postulacion ? [`<postulacion_en_maru empresa="${attr(body.postulacion.empresa)}" puesto="${attr(body.postulacion.puesto)}" />`] : []),
        `<pagina url="${attr(body.page.url)}" titulo="${attr(body.page.title)}">\n${body.page.text.slice(0, MAX_PAGE_TEXT)}\n</pagina>`,
        "Armá las búsquedas de contactos para esta vacante.",
      ].join("\n\n"),
    },
  ];
}

/** Lo justo del perfil para personalizar una nota: titular, resumen y la experiencia reciente (sin email ni teléfono). */
function profileForNotes(profile: ContactosElegirRequest["profile"]): string {
  if (!profile) return "(la persona no cargó su CV)";
  return JSON.stringify({
    nombre: profile.nombre,
    titulo: profile.titulo,
    ubicacion: profile.ubicacion,
    resumen: profile.resumen.slice(0, 1500),
    experiencia: profile.experiencia.slice(0, 4).map((e) => ({ empresa: e.empresa, cargo: e.cargo, inicio: e.inicio, fin: e.fin, logros: e.logros.slice(0, 3) })),
    educacion: profile.educacion,
  });
}

export function contactosBlocks(body: ContactosElegirRequest): Block[] {
  const cards = body.tarjetas.map((c) => `<tarjeta url="${attr(c.url)}" busqueda="${c.busqueda}">${oneLine(c.texto)}</tarjeta>`).join("\n");
  return [
    {
      type: "text",
      text: [
        `<perfil_de_la_persona>\n${profileForNotes(body.profile)}\n</perfil_de_la_persona>`,
        `<vacante empresa="${attr(body.empresa)}" puesto="${attr(body.puesto)}">\n${body.vacante.slice(0, MAX_PAGE_TEXT)}\n</vacante>`,
        `<tarjetas_de_linkedin>\n${cards}\n</tarjetas_de_linkedin>`,
        "Elegí a quiénes contactar y escribí las notas.",
      ].join("\n\n"),
    },
  ];
}

/** Búsqueda de personas en LinkedIn con los cargos y la empresa. */
export function linkedinSearchUrl(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
}

export type ContactSearch = { tipo: ContactType; keywords: string; url: string };

/**
 * Las búsquedas que hace la extensión: una por tipo, como mucho tres, con el nombre de la empresa entre comillas
 * para que LinkedIn priorice a quienes trabajan ahí.
 */
export function buildSearches(plan: ContactosPlan): ContactSearch[] {
  const empresa = oneLine(plan.empresa).replace(/"/g, "");
  if (!empresa) return [];
  const seen = new Set<string>();
  const out: ContactSearch[] = [];
  for (const b of plan.busquedas) {
    const cargos = oneLine(b.cargos).slice(0, 160);
    if (!cargos || seen.has(b.tipo)) continue;
    seen.add(b.tipo);
    const keywords = `"${empresa}" ${cargos}`;
    out.push({ tipo: b.tipo, keywords, url: linkedinSearchUrl(keywords) });
    if (out.length === MAX_SEARCHES) break;
  }
  return out;
}

/** Perfil de LinkedIn sin query ni subpáginas: https://www.linkedin.com/in/<slug>/. "" si no es un perfil. */
export function profileUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "";
  }
  if (u.protocol !== "https:" || !/(^|\.)linkedin\.com$/i.test(u.hostname)) return "";
  const m = u.pathname.match(/^\/in\/([^/]+)/);
  if (!m) return "";
  return `https://www.linkedin.com/in/${m[1].toLowerCase()}/`;
}

/** Recorta la nota al límite de LinkedIn en el último final de oración o, si no hay, de palabra. No agrega nada. */
export function fitNote(text: string, max = NOTE_MAX): string {
  const t = oneLine(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentence >= max * 0.5) return cut.slice(0, sentence + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut).replace(/[,;:–-]+$/, "");
}

/** Sólo personas que estaban en las tarjetas, una vez cada una, con la nota dentro del límite. */
export function finalizeContacts(contactos: ContactoElegido[], tarjetas: ContactCard[]): ContactoElegido[] {
  const known = new Set(tarjetas.map((t) => profileUrl(t.url)).filter(Boolean));
  const seen = new Set<string>();
  const out: ContactoElegido[] = [];
  for (const c of contactos) {
    const url = profileUrl(c.url);
    if (!url || !known.has(url) || seen.has(url)) continue;
    seen.add(url);
    out.push({ ...c, url, nombre: oneLine(c.nombre), cargo: oneLine(c.cargo), nota: fitNote(c.nota), mensaje: c.mensaje.trim() });
    if (out.length === MAX_CONTACTS) break;
  }
  return out;
}
