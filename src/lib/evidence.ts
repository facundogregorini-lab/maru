/**
 * Evidencia externa que respalda la propuesta de valor de Maru.
 * Regla: cada número tiene fuente primaria verificable. Si un dato no se puede rastrear, no va.
 * Revisado en octubre de 2026.
 */

export type Source = {
  id: number;
  name: string;
  detail: string;
  url: string;
};

export type Stat = {
  value: string;
  label: string;
  /** Aclaración corta: qué compara o cómo se midió. */
  note: string;
  source: number;
};

export const SOURCES: Source[] = [
  {
    id: 1,
    name: "Wiles, Munyikwa y Horton · Management Science (2025) / NBER w30886",
    detail: "Experimento aleatorizado con cerca de medio millón de postulantes en un marketplace laboral online.",
    url: "https://www.nber.org/papers/w30886",
  },
  {
    id: 2,
    name: "Jobscan · Job Seeker & Recruiter Report (2025)",
    detail: "Análisis de más de 2,5 millones de postulaciones y encuesta a 384 recruiters. Datos observacionales: muestran asociación, no causalidad.",
    url: "https://www.jobscan.co/blog/interview-rates-study",
  },
  {
    id: 3,
    name: "ResumeGo · Cover Letter Study (2019–2020)",
    detail: "Experimento de campo con 7.287 postulaciones a búsquedas reales.",
    url: "https://www.resumego.net/research/cover-letters/",
  },
  {
    id: 4,
    name: "Ladders · Eye-Tracking Study (2018)",
    detail: "Medición del tiempo de la primera lectura de un CV con seguimiento ocular a recruiters.",
    url: "https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/",
  },
  {
    id: 5,
    name: "Jobscan · Fortune 500 ATS Usage (2025)",
    detail: "Detección de sistemas ATS en los portales de empleo de las empresas Fortune 500.",
    url: "https://www.jobscan.co/blog/fortune-500-use-applicant-tracking-systems/",
  },
];

/** Las 4 que van en el hero. */
export const HERO_STATS: Stat[] = [
  {
    value: "10,6×",
    label: "más entrevistas",
    note: "cuando el título del CV coincide con el puesto del aviso",
    source: 2,
  },
  {
    value: "+53%",
    label: "más llamados",
    note: "con una carta de presentación a medida, frente a no mandar carta",
    source: 3,
  },
  {
    value: "+8%",
    label: "más contrataciones",
    note: "cuando un asistente automático mejoró la redacción del CV (experimento con ~500.000 personas)",
    source: 1,
  },
  {
    value: "7,4 s",
    label: "dura la primera lectura",
    note: "que un recruiter le da a tu CV antes de decidir si sigue",
    source: 4,
  },
];

export type Front = {
  kicker: string;
  title: string;
  stats: Stat[];
  how: string;
};

/** "Por qué funciona": cada frente de la postulación, su evidencia y qué hace Maru. */
export const FRONTS: Front[] = [
  {
    kicker: "Filtros automáticos",
    title: "Pasar el ATS",
    stats: [
      { value: "98%", label: "de las Fortune 500", note: "filtra postulaciones con un ATS", source: 5 },
      { value: "10,6×", label: "más entrevistas", note: "si tu título coincide con el del aviso", source: 2 },
    ],
    how: "Maru lee la vacante, detecta las palabras clave que el ATS va a buscar y las integra en tu CV sólo donde son verdad. Te muestra en vivo cuáles cubrís y cuáles faltan.",
  },
  {
    kicker: "La primera lectura",
    title: "Convencer al recruiter",
    stats: [
      { value: "7,4 s", label: "de primera lectura", note: "para decidir si tu CV sigue en carrera", source: 4 },
      { value: "55%", label: "de los recruiters", note: "valora un CV adaptado a la búsqueda", source: 2 },
    ],
    how: "Titular alineado al rol, un resumen que conecta tu trayectoria con lo que piden y logros ordenados por relevancia: lo importante, arriba y en una sola columna.",
  },
  {
    kicker: "Carta y formulario",
    title: "Mostrar por qué vos",
    stats: [
      { value: "+53%", label: "más llamados", note: "con carta a medida vs. sin carta", source: 3 },
      { value: "54%", label: "de los recruiters", note: "valora una carta personalizada", source: 2 },
    ],
    how: "Con tu motivación real (escrita o en audio), Maru arma la carta y una respuesta lista para cada campo del formulario. Sin frases genéricas.",
  },
];
