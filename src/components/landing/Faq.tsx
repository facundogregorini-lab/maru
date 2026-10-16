import Reveal from "@/components/magic/Reveal";

/** Preguntas frecuentes: respuestas cortas y verdaderas sobre cómo funciona Maru hoy. */
const FAQ = [
  {
    q: "¿Maru inventa experiencia?",
    a: "No. Cargos, empresas, fechas y estudios se copian de tu CV tal cual. Maru reescribe, ordena y prioriza lo que ya hiciste; si falta un dato, te lo pregunta o lo deja marcado para que lo completes.",
  },
  {
    q: "¿Dónde quedan mis datos?",
    a: "Maru no tiene una base de datos con tu información: tu perfil queda guardado en tu navegador. Para leer tu CV y redactar, lo procesa con IA en el momento.",
  },
  {
    q: "¿La extensión envía las postulaciones por mí?",
    a: "No. Completa el formulario y vos revisás y enviás. Tampoco completa datos demográficos (género, etnia, discapacidad) ni aceptaciones legales: eso lo decidís siempre vos.",
  },
  {
    q: "¿En qué portales funciona la extensión?",
    a: "En Greenhouse, Lever y formularios web estándar, incluidos los que vienen dentro de la web de una empresa. Workday y los formularios de varios pasos todavía no.",
  },
  {
    q: "¿De dónde salen las búsquedas?",
    a: "De portales de empleo y páginas de empleo de empresas, públicas. Maru las actualiza todos los días y te dice cuáles podés tomar desde Argentina.",
  },
  {
    q: "¿Necesito una cuenta?",
    a: "Podés usar todo sin cuenta. Para descargar o copiar tu CV, tu carta o tu video, ingresás con tu email: te mandamos un link, sin contraseña.",
  },
];

export default function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-t" className="full-bleed relative mt-28 scroll-mt-24 overflow-hidden rounded-t-[64px] bg-sand px-5 py-20 sm:rounded-t-[120px]">
      <Reveal className="mx-auto max-w-3xl">
        <h2 id="faq-t" data-reveal className="text-center font-display text-4xl font-bold uppercase leading-tight sm:text-5xl">
          Preguntas frecuentes
        </h2>
        <div className="mt-10 space-y-3">
          {FAQ.map((f, i) => (
            <details key={f.q} data-reveal style={{ "--i": i } as React.CSSProperties} className="group rounded-2xl bg-white ring-1 ring-black/5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] border-ink text-sm leading-none transition-transform duration-300 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 leading-relaxed text-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
