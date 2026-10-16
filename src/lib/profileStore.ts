import type { Profile } from "./schemas";
import { load, remove, save } from "./storage";

/**
 * El último perfil que Maru leyó (de LinkedIn, un CV o texto), guardado en este navegador
 * (y, con sesión, en la cuenta: src/lib/sync/client.ts).
 * Así, si ya cargaste tu experiencia en una sección, las demás te ofrecen reutilizarla.
 */
const KEY = "maru:perfil:v1";

export type SavedProfile = { profile: Profile; savedAt: number };

export function saveProfile(profile: Profile): void {
  save(KEY, { profile, savedAt: Date.now() } satisfies SavedProfile);
}

export function loadProfile(): SavedProfile | null {
  const s = load<SavedProfile>(KEY);
  return s?.profile?.experiencia ? s : null;
}

export function forgetProfile(): void {
  remove(KEY);
}

/** El perfil como texto legible, para mandarlo a la IA como "CV pegado". */
export function profileToText(p: Profile): string {
  const out: string[] = [p.nombre, p.titulo, [p.email, p.telefono, p.ubicacion, p.linkedin_url].filter(Boolean).join(" | ")];
  if (p.resumen) out.push("", "RESUMEN", p.resumen);
  if (p.experiencia.length) {
    out.push("", "EXPERIENCIA");
    for (const e of p.experiencia) {
      out.push(`${e.cargo} — ${e.empresa}${e.ubicacion ? `, ${e.ubicacion}` : ""} (${[e.inicio, e.fin].filter(Boolean).join(" – ")})`);
      if (e.descripcion) out.push(e.descripcion);
      for (const l of e.logros) out.push(`• ${l}`);
    }
  }
  if (p.educacion.length) {
    out.push("", "EDUCACIÓN");
    for (const ed of p.educacion) out.push(`${ed.titulo} — ${ed.institucion} (${[ed.inicio, ed.fin].filter(Boolean).join(" – ")})`);
  }
  if (p.aptitudes.length) out.push("", "APTITUDES", p.aptitudes.join(", "));
  if (p.idiomas.length) out.push("", "IDIOMAS", p.idiomas.map((l) => (l.nivel ? `${l.idioma} (${l.nivel})` : l.idioma)).join(", "));
  if (p.certificaciones.length) out.push("", "CERTIFICACIONES", ...p.certificaciones.map((c) => [c.nombre, c.emisor, c.anio].filter(Boolean).join(" · ")));
  return out.join("\n").trim();
}
