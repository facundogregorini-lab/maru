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
    q: "¿Dónde se guarda el seguimiento de mis postulaciones?",
    a: "En tu navegador, igual que tu perfil. Maru suma solas las búsquedas que guardás o para las que armás algo, y vos las movés de estado. Si cambiás de navegador o de dispositivo, no se pasa (todavía).",
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

/**
 * Bloque final verde menta, como en jobright: preguntas frecuentes, el cierre y el buscador
 * (lo que venga en children), pegado al footer que también es menta.
 */
export default function Faq({ children }: { children?: React.ReactNode }) {
  return (
    <section id="faq" aria-labelledby="faq-t" className="full-bleed relative -mb-28 mt-28 scroll-mt-24 rounded-tl-[64px] bg-sand px-5 pt-20 sm:mt-36 sm:rounded-tl-[160px]">
      <Reveal className="mx-auto max-w-[800px]">
        <h2 id="faq-t" data-reveal className="text-center font-display text-4xl font-bold uppercase leading-[1.05] sm:text-5xl">
          Preguntas
          <br />
          frecuentes
        </h2>
        <div className="mt-10 space-y-2">
          {FAQ.map((f, i) => (
            <details key={f.q} data-reveal style={{ "--i": i } as React.CSSProperties} className="group rounded-xl bg-brand-soft">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className="shrink-0 transition-transform duration-300 group-open:rotate-45">
                  <circle cx="12" cy="12" r="10.5" />
                  <path d="M12 7v10M7 12h10" />
                </svg>
              </summary>
              <p className="-mt-1 px-5 pb-5 leading-relaxed text-ink/70">{f.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
      {children}
    </section>
  );
}
