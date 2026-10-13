import type { CV } from "./schemas";

/** Versión en texto plano del CV, para pegar en formularios que piden "pegá tu CV". */
export function cvToText(cv: CV): string {
  const t = cv.titulos_secciones;
  const contact = [cv.contacto.email, cv.contacto.telefono, cv.contacto.ubicacion, cv.contacto.linkedin, ...cv.contacto.otros]
    .filter(Boolean)
    .join(" | ");
  const out: string[] = [cv.nombre.toUpperCase(), cv.titular, contact, "", t.resumen.toUpperCase(), cv.resumen, ""];
  if (cv.competencias.length) out.push(t.competencias.toUpperCase(), cv.competencias.join(" · "), "");
  if (cv.experiencia.length) {
    out.push(t.experiencia.toUpperCase());
    for (const e of cv.experiencia) {
      out.push(`${e.cargo} — ${e.empresa}${e.ubicacion ? `, ${e.ubicacion}` : ""}`, e.periodo, ...e.logros.map((l) => `• ${l}`), "");
    }
  }
  if (cv.educacion.length) {
    out.push(t.educacion.toUpperCase());
    for (const e of cv.educacion) out.push(`${e.titulo} — ${e.institucion}`, [e.periodo, e.detalle].filter(Boolean).join(" · "), "");
  }
  if (cv.certificaciones.length) out.push(t.certificaciones.toUpperCase(), ...cv.certificaciones.map((c) => `• ${c}`), "");
  if (cv.idiomas.length) out.push(t.idiomas.toUpperCase(), cv.idiomas.join(" · "), "");
  for (const s of cv.secciones_extra) out.push(s.titulo.toUpperCase(), ...s.items.map((i) => `• ${i}`), "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
