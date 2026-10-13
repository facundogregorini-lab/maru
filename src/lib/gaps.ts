import type { GapQuestion, Profile } from "./schemas";

/**
 * Detecta datos que el CV necesita y que no están en la fuente, y arma una pregunta corta para cada uno.
 * La respuesta se aplica en `applyGapAnswers` antes de generar, así el CV final no tiene placeholders.
 */
export function findGaps(p: Profile): GapQuestion[] {
  const q: GapQuestion[] = [];
  if (!p.email) q.push({ id: "email", path: "email", pregunta: "¿Qué email querés que figure en tu CV?", placeholder: "nombre@mail.com" });
  if (!p.telefono) q.push({ id: "telefono", path: "telefono", pregunta: "¿Y un teléfono de contacto?", placeholder: "+54 9 11 …" });
  if (!p.ubicacion) q.push({ id: "ubicacion", path: "ubicacion", pregunta: "¿En qué ciudad vivís?", placeholder: "Buenos Aires, Argentina" });

  p.experiencia.forEach((e, i) => {
    const where = `${e.cargo} en ${e.empresa}`;
    if (!e.inicio) q.push({ id: `exp${i}-inicio`, path: `experiencia.${i}.inicio`, pregunta: `¿Cuándo empezaste como ${where}?`, placeholder: "MM/AAAA" });
    if (!e.fin) q.push({ id: `exp${i}-fin`, path: `experiencia.${i}.fin`, pregunta: `¿Hasta cuándo fuiste ${where}?`, placeholder: "MM/AAAA o 'actual'" });
    e.fragmentos_incompletos.forEach((frag, j) =>
      q.push({
        id: `exp${i}-frag${j}`,
        path: `experiencia.${i}.dato.${j}`,
        pregunta: `En ${e.empresa}, a este logro le falta un dato (LinkedIn borra las negritas al exportar). ¿Qué decía?`,
        contexto: frag,
        placeholder: "Ej.: aumentamos el revenue 17x",
      }),
    );
  });

  p.educacion.forEach((ed, i) => {
    if (!ed.inicio && !ed.fin)
      q.push({ id: `edu${i}`, path: `educacion.${i}.fin`, pregunta: `¿En qué año terminaste ${ed.titulo || "tus estudios"} en ${ed.institucion}?`, placeholder: "AAAA o 'en curso'" });
  });

  p.idiomas.forEach((l, i) => {
    if (!l.nivel) q.push({ id: `idioma${i}`, path: `idiomas.${i}.nivel`, pregunta: `¿Qué nivel de ${l.idioma} tenés?`, placeholder: "Nativo, C1, intermedio…" });
  });
  return q;
}

/** Aplica las respuestas a las preguntas de datos faltantes sobre una copia del perfil. */
export function applyGapAnswers(profile: Profile, gaps: GapQuestion[], answers: Record<string, string>): Profile {
  const p: Profile = structuredClone(profile);
  for (const g of gaps) {
    const value = answers[g.id]?.trim();
    if (!value) continue;
    const parts = g.path.split(".");
    if (parts.length === 1) {
      (p as Record<string, unknown>)[parts[0]] = value;
    } else if (parts[0] === "experiencia" && parts[2] === "dato") {
      const exp = p.experiencia[Number(parts[1])];
      exp.logros.push(`${value} (dato aportado por la persona; completa: "${exp.fragmentos_incompletos[Number(parts[3])]}")`);
    } else {
      const list = (p as Record<string, unknown>)[parts[0]] as Record<string, string>[];
      list[Number(parts[1])][parts[2]] = value;
    }
  }
  return p;
}
