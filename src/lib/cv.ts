import type { Analysis, CvDoc, Generation, Item, Profile, SectionKey, TemplateId } from "./schemas";

const LABELS: Record<string, Record<SectionKey, string> & { actual: string; enCurso: string }> = {
  es: {
    resumen: "Perfil",
    logrosClave: "Logros clave",
    experiencia: "Experiencia",
    educacion: "Educación",
    habilidades: "Habilidades",
    idiomas: "Idiomas",
    certificaciones: "Certificaciones",
    actual: "Actualidad",
    enCurso: "En curso",
  },
  en: {
    resumen: "Summary",
    logrosClave: "Key achievements",
    experiencia: "Experience",
    educacion: "Education",
    habilidades: "Skills",
    idiomas: "Languages",
    certificaciones: "Certifications",
    actual: "Present",
    enCurso: "In progress",
  },
  pt: {
    resumen: "Perfil",
    logrosClave: "Principais conquistas",
    experiencia: "Experiência",
    educacion: "Formação",
    habilidades: "Habilidades",
    idiomas: "Idiomas",
    certificaciones: "Certificações",
    actual: "Atual",
    enCurso: "Em andamento",
  },
};

function labels(lang: string) {
  return LABELS[lang.slice(0, 2).toLowerCase()] ?? LABELS.es;
}

let seq = 0;
export function newId(prefix = "i"): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq}`;
}

export function item(text: string): Item {
  return { id: newId(), text };
}

function period(inicio: string, fin: string, lang: string): string {
  const l = labels(lang);
  const end = /^actual/i.test(fin) ? l.actual : /en curso/i.test(fin) ? l.enCurso : fin;
  return [inicio, end].filter(Boolean).join(" – ");
}

/** Países donde se recomienda no incluir foto en el CV. */
const NO_PHOTO = new Set(["US", "GB", "UK", "CA", "IE", "AU", "NZ"]);
export function photoRecommended(country: string): boolean {
  return !NO_PHOTO.has(country.toUpperCase());
}

/** Arma el CV editable: hechos copiados del perfil + redacción de la IA. */
export function buildCvDoc(profile: Profile, gen: Generation, analysis: Analysis): CvDoc {
  const lang = analysis.idioma_vacante || "es";
  const l = labels(lang);
  const byIndex = new Map(gen.experiencias.map((e) => [e.indice, e]));

  const experiencia = profile.experiencia
    .map((e, i) => ({ e, g: byIndex.get(i) }))
    .filter(({ g }) => g?.incluir !== false)
    .map(({ e, g }) => ({
      id: newId("x"),
      cargo: e.cargo,
      empresa: e.empresa,
      ubicacion: e.ubicacion,
      periodo: period(e.inicio, e.fin, lang),
      bullets: (g?.logros ?? e.logros).map(item),
    }));

  const { resumen, logrosClave, experiencia: _e, educacion, habilidades, idiomas, certificaciones } = l;
  return {
    template: analysis.template_recomendado,
    lang,
    titulos: { resumen, logrosClave, experiencia: _e, educacion, habilidades, idiomas, certificaciones },
    hidden: { logrosClave: analysis.template_recomendado !== "ejecutivo", certificaciones: !profile.certificaciones.length },
    photo: null,
    showPhoto: photoRecommended(analysis.pais_empresa),
    nombre: profile.nombre,
    titular: gen.titular || profile.titulo,
    contacto: {
      email: profile.email,
      telefono: profile.telefono,
      ubicacion: profile.ubicacion,
      linkedin: profile.linkedin_url.replace(/^https?:\/\/(www\.)?/, ""),
    },
    resumen: gen.resumen,
    logrosClave: gen.logros_clave.map(item),
    experiencia,
    educacion: profile.educacion.map((ed) => ({
      id: newId("e"),
      titulo: ed.titulo,
      institucion: ed.institucion,
      periodo: period(ed.inicio, ed.fin, lang),
    })),
    habilidades: gen.habilidades.join(" · "),
    idiomas: profile.idiomas.map((x) => (x.nivel ? `${x.idioma} (${x.nivel})` : x.idioma)).join(" · "),
    certificaciones: profile.certificaciones.map((c) => item([c.nombre, c.emisor, c.anio].filter(Boolean).join(" · "))),
  };
}

export function setTemplate(doc: CvDoc, template: TemplateId): CvDoc {
  // El bloque de logros clave es propio del template Ejecutivo; lo mostramos/ocultamos con él.
  return { ...doc, template, hidden: { ...doc.hidden, logrosClave: template !== "ejecutivo" } };
}

export function contactLine(doc: CvDoc): string[] {
  return [doc.contacto.email, doc.contacto.telefono, doc.contacto.ubicacion, doc.contacto.linkedin].filter(Boolean);
}

export function visible(doc: CvDoc, key: SectionKey): boolean {
  if (doc.hidden[key]) return false;
  switch (key) {
    case "resumen":
      return !!doc.resumen.trim();
    case "logrosClave":
      return doc.logrosClave.some((i) => i.text.trim());
    case "experiencia":
      return doc.experiencia.length > 0;
    case "educacion":
      return doc.educacion.length > 0;
    case "habilidades":
      return !!doc.habilidades.trim();
    case "idiomas":
      return !!doc.idiomas.trim();
    case "certificaciones":
      return doc.certificaciones.some((i) => i.text.trim());
  }
}

/** Versión en texto plano del CV (para "pegá tu CV" en formularios y para el chequeo ATS). */
export function cvToText(doc: CvDoc): string {
  const out: string[] = [doc.nombre.toUpperCase(), doc.titular, contactLine(doc).join(" | "), ""];
  const t = doc.titulos;
  if (visible(doc, "resumen")) out.push(t.resumen.toUpperCase(), doc.resumen, "");
  if (visible(doc, "logrosClave")) out.push(t.logrosClave.toUpperCase(), ...doc.logrosClave.map((b) => `• ${b.text}`), "");
  if (visible(doc, "experiencia")) {
    out.push(t.experiencia.toUpperCase());
    for (const e of doc.experiencia) {
      out.push(`${e.cargo} — ${e.empresa}${e.ubicacion ? `, ${e.ubicacion}` : ""}`, e.periodo, ...e.bullets.map((b) => `• ${b.text}`), "");
    }
  }
  if (visible(doc, "educacion")) {
    out.push(t.educacion.toUpperCase());
    for (const e of doc.educacion) out.push(`${e.titulo} — ${e.institucion}`, e.periodo, "");
  }
  if (visible(doc, "habilidades")) out.push(t.habilidades.toUpperCase(), doc.habilidades, "");
  if (visible(doc, "idiomas")) out.push(t.idiomas.toUpperCase(), doc.idiomas, "");
  if (visible(doc, "certificaciones")) out.push(t.certificaciones.toUpperCase(), ...doc.certificaciones.map((c) => `• ${c.text}`), "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function fileBaseName(doc: CvDoc, puesto: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return [clean(doc.nombre) || "CV", "CV", clean(puesto).slice(0, 40)].filter(Boolean).join("_");
}
