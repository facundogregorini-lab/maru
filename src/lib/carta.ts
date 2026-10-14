import { item } from "./cv";
import type { Carta, CartaDoc, CvDoc, CvStyle, Profile, TemplateId } from "./schemas";
import { load } from "./storage";

const LOCALES: Record<string, string> = { es: "es-AR", en: "en-US", pt: "pt-BR" };

/** "Buenos Aires, 14 de octubre de 2026" en el idioma de la carta. */
export function fechaCarta(lang: string, ubicacion: string, date = new Date()): string {
  const locale = LOCALES[lang.slice(0, 2).toLowerCase()] ?? "es-AR";
  const fecha = date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const ciudad = ubicacion.split(",")[0]?.trim();
  return ciudad ? `${ciudad}, ${fecha}` : fecha;
}

/** Si ya armó un CV en Maru, la carta arranca con el mismo diseño. */
export function lastCvDesign(): { template: TemplateId; style?: CvStyle } | null {
  for (const key of ["maru:cv:v1", "maru:sesion:v2"]) {
    const doc = load<{ doc?: CvDoc | null }>(key)?.doc;
    if (doc?.template) return { template: doc.template, style: doc.style };
  }
  return null;
}

export function buildCartaDoc(carta: Carta, profile: Profile, design: { template: TemplateId; style?: CvStyle }): CartaDoc {
  const lang = carta.idioma || "es";
  return {
    template: design.template,
    style: design.style,
    lang,
    remitente: {
      nombre: profile.nombre,
      titular: profile.titulo,
      email: profile.email,
      telefono: profile.telefono,
      ubicacion: profile.ubicacion,
      linkedin: profile.linkedin_url.replace(/^https?:\/\/(www\.)?/, ""),
    },
    fecha: fechaCarta(lang, profile.ubicacion),
    saludo: carta.saludo,
    parrafos: carta.parrafos.map(item),
    cierre: carta.cierre,
    firma: profile.nombre,
  };
}

export function remitenteLine(d: CartaDoc): string[] {
  const r = d.remitente;
  return [r.email, r.telefono, r.ubicacion, r.linkedin].filter(Boolean);
}

/** La carta como texto plano, lista para pegar en un formulario o un email. */
export function cartaToText(d: CartaDoc, withHeader = false): string {
  const body = [d.saludo, "", ...d.parrafos.map((p) => p.text).filter((t) => t.trim()).flatMap((t) => [t, ""]), d.cierre, d.firma];
  const head = withHeader ? [d.remitente.nombre, remitenteLine(d).join(" | "), "", d.fecha, ""] : [];
  return [...head, ...body].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function cartaFileName(d: CartaDoc, empresa: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return [clean(d.remitente.nombre) || "Carta", "Carta", clean(empresa).slice(0, 40)].filter(Boolean).join("_");
}
