import { BILLING_ENABLED } from "./plans";
/**
 * Contenido de las páginas de producto, con la estructura de las landings de jobright
 * (hero, banda de números, "por qué", "cómo funciona", "más razones", evidencia y preguntas).
 * Regla: sólo lo que Maru hace hoy. Los números son de Maru o de estudios con fuente.
 */

export type ProductId = "match" | "postulacion" | "cv" | "carta" | "video" | "entrevista" | "extension" | "seguimiento";
export type VisualId = "jobs" | "match" | "cv" | "carta" | "chat" | "video" | "autofill" | "form" | "prefs" | "report" | "ats" | "tracker";

export type Stat = { value: string; label: string; source?: string };
export type Bullet = [lead: string, text: string];

export type Product = {
  name: string;
  /** Primera línea del titular (negrita) y el resto (liviano), en mayúsculas como jobright. */
  strong: string;
  light: string;
  /** El orden de las dos partes del titular. */
  strongFirst?: boolean;
  desc: string;
  cta: string;
  hero: VisualId;
  stats: Stat[];
  why: { title: string; rows: { title: string; bullets: Bullet[]; cta: string; visual: VisualId }[] };
  how: { tag: string; title: string; text: string; steps: [string, string][] };
  reasons: string[];
  evidence?: { title: string; quotes: { text: string; source: string }[] };
  faq: [string, string][];
};

const FREE = BILLING_ENABLED ? "Incluido según tu plan" : "Gratis durante el lanzamiento, sin tarjeta";

export const PRODUCTS: Record<ProductId, Product> = {
  match: {
    name: "Match con IA",
    strong: "Match con IA",
    light: "Búsquedas que encajan con tu CV",
    strongFirst: true,
    desc: "Recomendaciones de búsquedas reales según tu experiencia, tus skills, tu seniority y lo que querés hacer, no sólo por el título del puesto.",
    cta: "Encontrar mis matches",
    hero: "jobs",
    stats: [], // los completa la página con los números del inventario
    why: {
      title: "Por qué usar el match de Maru",
      rows: [
        {
          title: "Un puntaje de compatibilidad para cada búsqueda",
          bullets: [
            ["Hecho para vos:", "subís tu CV, contás qué querés hacer y Maru ordena las búsquedas abiertas por compatibilidad."],
            ["Más que el título:", "compara tus skills, tu experiencia, tu seniority y tus preferencias con lo que pide cada aviso."],
            ["El porqué de cada una:", "hasta 3 motivos con datos de tu CV y del aviso, las brechas y lo que falta confirmar."],
          ],
          cta: "Ver mi compatibilidad",
          visual: "match",
        },
        {
          title: "Búsquedas reales, sin buscar horas",
          bullets: [
            ["Sólo abiertas:", "Maru revisa las fuentes todos los días y saca las búsquedas que se cerraron."],
            ["Desde Argentina:", "te dice cuáles podés tomar desde acá y cuáles hay que confirmar."],
            ["Tus condiciones:", "modalidad, ubicación, seniority, contrato, salario e idioma; marcás cuáles son indispensables."],
          ],
          cta: "Encontrar mis matches",
          visual: "prefs",
        },
        {
          title: "Del match a la postulación",
          bullets: [
            ["Guardá o descartá:", "si descartás con un motivo, Maru ajusta el orden; si es la empresa, no te la muestra más."],
            ["Preparala con el coach:", "desde cada búsqueda armás el CV y las respuestas para esa vacante."],
          ],
          cta: "Empezar ahora",
          visual: "cv",
        },
      ],
    },
    how: {
      tag: "Match personalizado",
      title: "Cómo usa Maru tu CV para el match",
      text: "Maru lee tu CV, entiende tu rol, tu seniority, tus skills e idiomas, y los cruza con lo que pide cada búsqueda abierta. Primero saca lo que no te sirve (lo que no podés tomar desde Argentina o lo que marcaste como indispensable), después ordena por compatibilidad y te explica cada resultado.",
      steps: [
        ["Subí tu CV", "El PDF de LinkedIn, tu CV en PDF o Word, o pegás el texto."],
        ["Confirmá tu perfil", "Revisás lo que Maru entendió: cargos, skills, idiomas y años de experiencia."],
        ["Contá qué buscás", "Rol, modalidad, ubicación y lo que es indispensable para vos."],
        ["Mirá tu ranking", "Búsquedas ordenadas por compatibilidad, con motivos y brechas."],
      ],
    },
    reasons: ["Tu CV queda en tu navegador", "Explicación clara de cada match", "Búsquedas filtradas por tus condiciones", "Sabés qué podés tomar desde Argentina", "Sólo avisos reales y abiertos", FREE],
    faq: [
      ["¿Cómo funciona el match?", "Maru compara tu perfil (cargos, skills, idiomas, años de experiencia y ubicación) con lo que pide cada búsqueda abierta. Primero excluye lo incompatible y después ordena por compatibilidad."],
      ["¿Cómo se calcula el puntaje?", "Es una compatibilidad estimada, nunca una probabilidad de contratación: 40% skills y experiencia, 35% lo que querés hacer, 15% seniority y 10% preferencias como modalidad, contrato, salario e idiomas."],
      ["¿De dónde salen las búsquedas?", "De portales de empleo y de las páginas de empleo de las empresas, todas públicas. Se actualizan todos los días y cada aviso lleva a la publicación original."],
      ["¿Puedo buscar remoto o por ubicación?", "Sí. Elegís modalidad y ubicación, y podés marcar como indispensable cualquier condición. Si el aviso no informa el dato, no se excluye: te avisamos que falta confirmarlo."],
      ["¿Qué pasa con mis datos?", "Tu perfil y preferencias quedan en tu navegador y, al ingresar, también en tu cuenta. El ranking los procesa sin guardar una copia adicional."],
      ["¿Es gratis?", "El ranking es gratis. Para reutilizar tu perfil entre dispositivos, ingresá a tu cuenta."],
    ],
  },

  postulacion: {
    name: "Postulación a medida",
    strong: "Postulación a medida",
    light: "Un CV pensado para ese rol",
    strongFirst: true,
    desc: "Pegá el link de la vacante que te gusta y Maru te devuelve tu CV adaptado a esa búsqueda y una respuesta lista para cada campo del formulario.",
    cta: "Personalizar mi postulación",
    hero: "cv",
    stats: [
      { value: "10,6×", label: "más entrevistas si tu título coincide con el del aviso", source: "Jobscan, 2025" },
      { value: "98%", label: "de las Fortune 500 filtra postulaciones con un ATS", source: "Jobscan, 2025" },
      { value: "7,4 s", label: "dura la primera lectura de un recruiter", source: "Ladders, 2018" },
    ],
    why: {
      title: "Por qué personalizar con Maru",
      rows: [
        {
          title: "Un CV a medida de cada búsqueda",
          bullets: [
            ["Para el ATS:", "una columna, títulos estándar y las palabras clave exactas del aviso, sólo donde son verdad."],
            ["Para quien lo lee:", "titular alineado al rol, resumen que conecta tu trayectoria y logros con impacto, arriba."],
            ["Nunca inventa:", "si falta un dato que ayudaría, deja un [completar] resaltado para que lo pongas vos."],
          ],
          cta: "Adaptar mi CV",
          visual: "cv",
        },
        {
          title: "Una respuesta para cada campo del formulario",
          bullets: [
            ["Lista para copiar:", "Maru redacta lo que va en cada campo de la postulación, con el porqué y un tip."],
            ["Con tu motivación:", "contás por qué te entusiasma la vacante, escribiendo o por audio, y Maru lo usa."],
          ],
          cta: "Armar mis respuestas",
          visual: "form",
        },
      ],
    },
    how: {
      tag: "Postulación a medida",
      title: "Cómo arma Maru tu postulación",
      text: "Maru lee la vacante, tu experiencia y lo que te entusiasma de esa búsqueda, te hace 3 a 5 preguntas para cubrir lo que falta y arma un CV y unas respuestas pensadas para ese rol.",
      steps: [
        ["Pegá la vacante", "El link de la publicación o el texto, si el portal no deja leerla."],
        ["Contá por qué te gusta", "Por qué es buena para vos, escrito o dictado por voz."],
        ["Subí tu experiencia", "CV en PDF, LinkedIn o el texto pegado."],
        ["Recibí todo listo", "CV para descargar en PDF y respuestas para cada campo."],
      ],
    },
    reasons: ["Palabras clave exactas del aviso", "Nunca inventa experiencia", "Listo para ATS: una columna", "Respuestas para cada campo", "PDF o texto para copiar", FREE],
    evidence: {
      title: "Lo que dicen los estudios",
      quotes: [
        { text: "Cuando el título del CV coincide con el puesto del aviso, las postulaciones consiguen 10,6 veces más entrevistas.", source: "Jobscan · Job Seeker & Recruiter Report (2025)" },
        { text: "El 55% de los recruiters valora un CV adaptado a la búsqueda.", source: "Jobscan · Job Seeker & Recruiter Report (2025)" },
        { text: "Un asistente que mejoró la redacción del CV aumentó 8% las contrataciones, en un experimento con cerca de 500.000 personas.", source: "Wiles, Munyikwa y Horton · Management Science (2025)" },
      ],
    },
    faq: [
      ["¿Qué necesito para empezar?", "El link de la vacante (o su texto) y tu experiencia: tu CV en PDF, el PDF de tu LinkedIn o el texto pegado."],
      ["¿Maru inventa experiencia?", "No. Cargos, empresas, fechas y estudios salen de tu CV. Si un dato ayudaría pero falta, queda un [completar] resaltado."],
      ["¿Qué recibo al final?", "Tu CV adaptado a esa búsqueda, listo para descargar en PDF o copiar como texto, y una respuesta sugerida para cada campo del formulario."],
      ["¿Funciona con cualquier portal?", "Lee la mayoría de los links. Si un portal no deja leer la vacante, pegás el texto y listo."],
      ["¿Es gratis?", BILLING_ENABLED ? "Tenés pedidos gratis cada día (entrevistas y videos, cada semana) y planes sin límite desde $3.900 por mes con la promo de lanzamiento. Consultá Planes." : "Sí. Para descargar tu CV ingresás con tu email: te mandamos un link, sin contraseña."],
    ],
  },

  cv: {
    name: "CV con IA",
    strong: "con un CV con IA",
    light: "Conseguí más entrevistas",
    desc: "Contale a Maru a qué rol apuntás y reescribe tu CV para que pase los filtros automáticos y convenza a quien lo lee. Después elegí entre 24 diseños.",
    cta: "Mejorar mi CV gratis",
    hero: "ats",
    stats: [
      { value: "24", label: "diseños de una columna, listos para ATS" },
      { value: "98%", label: "de las Fortune 500 filtra con un ATS", source: "Jobscan, 2025" },
      { value: "7,4 s", label: "dura la primera lectura de tu CV", source: "Ladders, 2018" },
    ],
    why: {
      title: "Por qué armar tu CV con Maru",
      rows: [
        {
          title: "Un CV que pasa el ATS y convence",
          bullets: [
            ["Apuntado a tu objetivo:", "contás rol, nivel, industria y país, y Maru prioriza lo que más pesa ahí."],
            ["Lo que querés destacar:", "lo escribís o lo grabás en un audio; Maru te hace 3 a 5 preguntas para completar."],
            ["Revisión de ATS en vivo:", "ves qué palabras clave cubrís, cuáles faltan y si la estructura es la correcta."],
          ],
          cta: "Mejorar mi CV",
          visual: "ats",
        },
        {
          title: "24 diseños que podés hacer tuyos",
          bullets: [
            ["5 estilos:", "clásicos, modernos, ejecutivos, minimalistas y creativos, todos de una columna."],
            ["A tu gusto:", "color, tipografía, espaciado, tamaño de letra y orden de las secciones."],
            ["Editás en el papel:", "tocás cualquier texto y lo cambiás; lo descargás en PDF o Word."],
          ],
          cta: "Elegir mi diseño",
          visual: "cv",
        },
      ],
    },
    how: {
      tag: "CV con IA",
      title: "Cómo mejora Maru tu CV",
      text: "Maru lee tu experiencia y tu objetivo, detecta lo que falta y reescribe tu CV con un titular alineado, un resumen que conecta tu trayectoria y logros con impacto. Nunca inventa: reordena y reescribe lo que ya hiciste.",
      steps: [
        ["Subí tu experiencia", "CV en PDF o Word, el PDF de LinkedIn o el texto."],
        ["Contá a dónde vas", "Rol, nivel, industria y país, y qué querés destacar."],
        ["Respondé unas preguntas", "3 a 5, para completar lo que falta."],
        ["Elegí el diseño", "Ajustalo, editalo y descargalo en PDF o Word."],
      ],
    },
    reasons: ["24 diseños listos para ATS", "Revisión de palabras clave", "Editás directo en el papel", "PDF o Word", "Nunca inventa experiencia", FREE],
    evidence: {
      title: "Lo que dicen los estudios",
      quotes: [
        { text: "Un recruiter decide en 7,4 segundos, en su primera lectura, si tu CV sigue en carrera.", source: "Ladders · Eye-Tracking Study (2018)" },
        { text: "El 98% de las empresas Fortune 500 filtra las postulaciones con un sistema ATS.", source: "Jobscan · Fortune 500 ATS Usage (2025)" },
        { text: "Mejorar la redacción del CV con un asistente aumentó 8% las contrataciones.", source: "Wiles, Munyikwa y Horton · Management Science (2025)" },
      ],
    },
    faq: [
      ["¿En qué se diferencia de la postulación a medida?", "Acá no hace falta una vacante: armás un CV general para el rol al que apuntás. Para una búsqueda concreta, usá la postulación a medida."],
      ["¿Los diseños pasan los filtros ATS?", "Sí: los 24 son de una columna, con títulos estándar y texto seleccionable."],
      ["¿Puedo editarlo después?", "Sí. Tocás cualquier texto del CV y lo cambiás, y ajustás color, tipografía, espaciado y orden de secciones."],
      ["¿Maru inventa experiencia?", "No. Cargos, empresas, fechas y estudios se copian tal cual; si falta algo, te lo pregunta."],
      ["¿Es gratis?", BILLING_ENABLED ? "Tenés pedidos gratis cada día (entrevistas y videos, cada semana) y planes sin límite desde $3.900 por mes con la promo de lanzamiento. Consultá Planes." : "Sí. Para descargarlo ingresás con tu email: te mandamos un link, sin contraseña."],
    ],
  },

  carta: {
    name: "Carta de presentación",
    strong: "Carta de presentación",
    light: "Con IA, para cada búsqueda",
    strongFirst: true,
    desc: "Traé la búsqueda, contá con tus palabras (o en un audio) qué querés transmitir, y Maru escribe una carta concreta, humana y con tus mejores logros.",
    cta: "Crear mi carta gratis",
    hero: "carta",
    stats: [
      { value: "+53%", label: "más llamados con una carta a medida", source: "ResumeGo, 2019–2020" },
      { value: "54%", label: "de los recruiters valora una carta personalizada", source: "Jobscan, 2025" },
      { value: "2", label: "formatos para descargar: PDF y Word" },
    ],
    why: {
      title: "Subí de nivel tu carta",
      rows: [
        {
          title: "Una carta para esa búsqueda",
          bullets: [
            ["Con la vacante:", "pegás el link o el texto, o escribís una carta espontánea a una empresa."],
            ["Con tu voz:", "contás qué querés transmitir escribiendo o en un audio."],
            ["A tu medida:", "tono, largo, idioma y destinatario."],
          ],
          cta: "Crear mi carta",
          visual: "carta",
        },
        {
          title: "Editala hasta que te guste",
          bullets: [
            ["Párrafo por párrafo:", "pedí que reescriba sólo el que no te convence."],
            ["Otra versión:", "con otro tono o más corta, en un clic."],
            ["Para enviarla:", "asunto de email, mensaje corto para LinkedIn y descarga en PDF o Word, con el mismo diseño que tu CV."],
          ],
          cta: "Crear mi carta",
          visual: "cv",
        },
      ],
    },
    how: {
      tag: "Carta con IA",
      title: "Cómo escribe Maru tu carta",
      text: "Maru cruza la búsqueda, tu experiencia y lo que querés contar, elige los logros que mejor te representan para ese rol y escribe una carta sin frases genéricas.",
      steps: [
        ["Traé la búsqueda", "El link, el texto o la empresa para una carta espontánea."],
        ["Contá qué querés transmitir", "Escrito o en un audio."],
        ["Sumá tu experiencia", "Tu CV o el perfil que ya cargaste en Maru."],
        ["Ajustala y descargala", "Por párrafo, otro tono, PDF o Word."],
      ],
    },
    reasons: ["Sin frases genéricas", "Reescritura por párrafo", "Asunto y mensaje para LinkedIn", "Mismo diseño que tu CV", "PDF o Word", FREE],
    evidence: {
      title: "Lo que dicen los estudios",
      quotes: [
        { text: "Las postulaciones con una carta a medida recibieron 53% más llamados que las que no tenían carta.", source: "ResumeGo · Cover Letter Study (2019–2020)" },
        { text: "El 54% de los recruiters valora una carta personalizada.", source: "Jobscan · Job Seeker & Recruiter Report (2025)" },
      ],
    },
    faq: [
      ["¿Necesito una búsqueda?", "No. Podés escribir una carta espontánea a una empresa aunque no tenga una búsqueda abierta."],
      ["¿Puedo editar la carta?", "Sí: la editás directo, pedís que reescriba un párrafo o generás otra versión con otro tono o largo."],
      ["¿En qué idiomas?", "Elegís el idioma de la carta al armarla."],
      ["¿Inventa logros?", "No. Usa tu experiencia real y lo que vos le contás."],
      ["¿Es gratis?", BILLING_ENABLED ? "Tenés pedidos gratis cada día (entrevistas y videos, cada semana) y planes sin límite desde $3.900 por mes con la promo de lanzamiento. Consultá Planes." : "Sí. Para descargarla o copiarla ingresás con tu email: te mandamos un link, sin contraseña."],
    ],
  },

  video: {
    name: "Video de presentación",
    strong: "Video de presentación",
    light: "Un minuto para que te conozcan",
    strongFirst: true,
    desc: "Maru te escribe el guion, lo leés en un teleprompter mientras grabás con tu cámara y recibís feedback de cada toma: ritmo, mirada, luz y contenido.",
    cta: "Grabar mi video gratis",
    hero: "video",
    stats: [
      { value: "30 · 60 · 90 s", label: "de guion a medida, en bloques con tiempos" },
      { value: "3", label: "fotogramas analizados en cada toma" },
      { value: "0", label: "subidas: tu video no sale del navegador" },
    ],
    why: {
      title: "Por qué grabar con Maru",
      rows: [
        {
          title: "Un guion que suena a vos",
          bullets: [
            ["Para una búsqueda o general:", "pegás la vacante o armás una presentación para el rol al que apuntás."],
            ["Editable:", "bloques con tiempos y un tip de cómo decir cada uno."],
            ["Para enviarlo:", "un mensaje corto para mandar junto con el link."],
          ],
          cta: "Escribir mi guion",
          visual: "video",
        },
        {
          title: "Feedback de cada toma",
          bullets: [
            ["Ritmo:", "palabras por minuto y muletillas."],
            ["Contenido:", "qué tan fiel fuiste al guion."],
            ["Imagen:", "encuadre, luz, fondo y mirada, a partir de 3 fotogramas."],
          ],
          cta: "Grabar mi video",
          visual: "report",
        },
      ],
    },
    how: {
      tag: "Video con IA",
      title: "Cómo te ayuda Maru a grabar",
      text: "Maru arma el guion con tu experiencia y lo que querés que se lleven, te lo muestra en un teleprompter mientras grabás y te devuelve una devolución concreta de cada toma.",
      steps: [
        ["Elegí para qué es", "Una búsqueda concreta o una presentación general."],
        ["Recibí el guion", "30, 60 o 90 segundos, editable."],
        ["Grabá con teleprompter", "Con la cámara de tu compu, sin instalar nada."],
        ["Mejorá con feedback", "Ritmo, mirada, luz y contenido de cada toma."],
      ],
    },
    reasons: ["Tu video no sale del navegador", "Teleprompter incluido", "Feedback de cada toma", "Guion editable", "Mensaje para enviarlo", FREE],
    faq: [
      ["¿Dónde queda mi video?", "En tu navegador. Para el feedback se analizan el audio transcripto y 3 fotogramas de la toma; el video no se sube."],
      ["¿Qué necesito?", "Una compu con cámara y micrófono y un navegador actual."],
      ["¿Cuánto dura el video?", "Elegís 30, 60 o 90 segundos."],
      ["¿Puedo grabar varias tomas?", "Sí, y cada una tiene su feedback."],
      ["¿Es gratis?", BILLING_ENABLED ? "Tenés pedidos gratis cada día (entrevistas y videos, cada semana) y planes sin límite desde $3.900 por mes con la promo de lanzamiento. Consultá Planes." : "Sí. Para descargar el video ingresás con tu email: te mandamos un link, sin contraseña."],
    ],
  },

  entrevista: {
    name: "Entrevista con IA",
    strong: "con preguntas de tu búsqueda",
    light: "Prepará tu próxima entrevista",
    desc: "Una entrevistadora con IA te hace las preguntas en voz alta, como en una videollamada, y repregunta si tu respuesta queda corta. Al final, un informe con puntaje.",
    cta: "Practicar gratis",
    hero: "chat",
    stats: [
      { value: "3", label: "tipos: RR. HH., con tu futuro líder y técnica" },
      { value: "3", label: "niveles de dificultad: amable, estándar y exigente" },
      { value: "1", label: "informe con puntaje y una respuesta más fuerte por pregunta" },
    ],
    why: {
      title: "Por qué practicar con Maru",
      rows: [
        {
          title: "Como una videollamada de verdad",
          bullets: [
            ["Por voz:", "la entrevistadora habla en voz alta y respondés hablando o por escrito."],
            ["Repregunta:", "si tu respuesta queda vaga o sin ejemplo, te pide más, como en una entrevista real."],
            ["A tu medida:", "elegís tipo, dificultad, cantidad de preguntas e idioma."],
          ],
          cta: "Practicar ahora",
          visual: "chat",
        },
        {
          title: "Un informe para mejorar",
          bullets: [
            ["Puntaje:", "qué tan lista está tu entrevista, con fortalezas y qué mejorar."],
            ["Respuestas más fuertes:", "para cada pregunta, una versión con el método STAR."],
          ],
          cta: "Ver mi informe",
          visual: "report",
        },
      ],
    },
    how: {
      tag: "Entrevista con IA",
      title: "Cómo es la práctica",
      text: "Con la búsqueda, las preguntas apuntan a lo que piden; sin búsqueda, al rol en general. La entrevistadora usa tu experiencia para preguntarte por lo que hiciste de verdad.",
      steps: [
        ["Elegí para qué entrevista", "Una búsqueda concreta o un rol en general."],
        ["Sumá tu experiencia", "Tu CV o el perfil que ya cargaste en Maru."],
        ["Respondé en voz alta", "Como en una videollamada, con repreguntas."],
        ["Leé tu informe", "Puntaje, fortalezas y respuestas STAR."],
      ],
    },
    reasons: ["Preguntas de tu búsqueda", "Repreguntas como en la real", "Voz o texto", "Informe con puntaje", "Respuestas STAR", FREE],
    faq: [
      ["¿Necesito micrófono?", "Es lo ideal para practicar en voz alta, pero también podés responder por escrito."],
      ["¿Qué tipos de entrevista hay?", "Primera entrevista con RR. HH., con quien sería tu líder y técnica o de caso, con dificultad amable, estándar o exigente."],
      ["¿En qué idioma?", "Elegís el idioma antes de empezar."],
      ["¿Qué tiene el informe?", "Un puntaje, un veredicto, fortalezas, qué mejorar y una respuesta más fuerte con el método STAR para cada pregunta."],
      ["¿Es gratis?", BILLING_ENABLED ? "Tenés una práctica gratis por semana al ingresar. Los planes pagos incluyen más prácticas y respuestas sugeridas." : "Sí, y no necesitás cuenta para practicar."],
    ],
  },

  extension: {
    name: "Extensión para Chrome",
    strong: "Autocompletá en 1 clic",
    light: "tus postulaciones",
    strongFirst: true,
    desc: "Cargás tu CV una vez y, en cualquier formulario de postulación, Maru completa los campos por vos: datos, respuestas y tu CV adjunto. Vos revisás y enviás.",
    cta: "Agregar a Chrome",
    hero: "autofill",
    stats: [
      { value: "1 clic", label: "o Alt + Shift + M para completar el formulario" },
      { value: "23", label: "campos completados en una postulación real de Greenhouse" },
      { value: "0", label: "envíos automáticos: el botón final lo tocás vos" },
    ],
    why: {
      title: "Por qué usar la extensión",
      rows: [
        {
          title: "Completa lo que piden los formularios",
          bullets: [
            ["De todo:", "textos, email, teléfono, links, fechas, listas, opciones, casillas y listas con buscador."],
            ["Tu CV adjunto:", "lo sube solo en el campo de archivo."],
            ["Respuestas abiertas:", "las redacta con tu experiencia y respetando el largo máximo."],
          ],
          cta: "Agregar a Chrome",
          visual: "autofill",
        },
        {
          title: "Vos tenés el control",
          bullets: [
            ["Verde y amarillo:", "verde es lo que copió de tu CV; amarillo, lo que redactó o falta completar."],
            ["Nunca envía:", "completa y te deja revisar; el botón de enviar lo tocás vos."],
            ["Lo sensible, no:", "no completa datos demográficos ni aceptaciones legales."],
          ],
          cta: "Agregar a Chrome",
          visual: "form",
        },
      ],
    },
    how: {
      tag: "Extensión para Chrome",
      title: "Cómo completa Maru una postulación",
      text: "La extensión lee los campos de la página, también los que vienen dentro de la web de la empresa, se los manda a Maru con tu CV y completa cada uno. Lo que no puede saber, lo deja marcado para vos.",
      steps: [
        ["Abrí la postulación", "En Greenhouse, Lever o la web de la empresa."],
        ["Tocá «Completar»", "En la extensión, o con Alt + Shift + M."],
        ["Revisá los colores", "Verde: de tu CV. Amarillo: revisalo o completalo."],
        ["Enviá vos", "Maru nunca envía el formulario."],
      ],
    },
    reasons: ["Greenhouse, Lever y formularios web", "También dentro de la web de la empresa", "Tu CV se guarda en tu navegador", "Nunca envía sola", "No toca datos sensibles", "Gratis, sin tarjeta"],
    faq: [
      ["¿En qué portales funciona?", "En Greenhouse, Lever y formularios web estándar, incluidos los que vienen dentro de la web de una empresa. Workday y los formularios de varios pasos todavía no."],
      ["¿Envía la postulación por mí?", "No. Completa el formulario y vos revisás y enviás."],
      ["¿Qué no completa?", "Datos demográficos (género, etnia, edad, discapacidad), consentimientos, declaraciones juradas ni aceptaciones legales: eso lo decidís siempre vos."],
      ["¿Dónde queda mi CV?", "Se guarda en tu navegador, junto con el archivo para adjuntarlo. Para leerlo y para completar cada formulario se envía a Maru y a su proveedor de IA, junto con los campos y el texto de la página; no lo guardamos en nuestros servidores."],
      ["¿Es gratis?", "Sí."],
    ],
  },
  seguimiento: {
    name: "Seguimiento de postulaciones", strong: "Tu búsqueda,", light: "en un solo tablero", desc: "Guardá cada oportunidad, seguí el avance y encontrá lo que preparaste para cada empresa. Con tu cuenta, también desde otro dispositivo.", cta: "Organizar mis postulaciones", hero: "tracker", stats: [],
    why: { title: "Cada oportunidad tiene su lugar", rows: [{ title: "De guardada a oferta", bullets: [["Un tablero claro", "Mové cada postulación entre guardada, postulada, entrevista, oferta y descartada."], ["Notas y materiales", "Anotá lo importante y volvé al CV, la carta o la práctica que necesitás preparar."]], cta: "Ver mi seguimiento", visual: "tracker" }] },
    how: { tag: "Paso a paso", title: "Organizá tu próxima oportunidad", text: "Maru suma las búsquedas que preparás desde sus herramientas. También podés agregar una por tu cuenta.", steps: [["Guardá una búsqueda", "Desde el listado, Match o el detalle del aviso."], ["Prepará tu postulación", "Adaptá tu CV, escribí la carta o practicá una entrevista."], ["Actualizá el estado", "Mové la tarjeta y dejá tus notas."], ["Retomá desde otro dispositivo", "Ingresá con la misma cuenta para ver tu tablero."]] },
    reasons: ["Estados claros", "Notas por oportunidad", "Carga manual", "Se integra con las herramientas", "Sin envíos automáticos", "Sincronización con tu cuenta"],
    faq: [["¿Tengo que cargar todo a mano?", "No. Las herramientas de Maru agregan las búsquedas que preparás. También podés cargar una manualmente."], ["¿Se ve desde otro dispositivo?", "Sí, si ingresás con la misma cuenta. Sin cuenta, se guarda en este navegador."], ["¿Maru envía mi postulación?", "No. Vos decidís cuándo y cómo enviarla."]],
  },
};
