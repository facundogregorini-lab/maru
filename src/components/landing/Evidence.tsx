import NumberTicker from "@/components/magic/NumberTicker";
import Reveal from "@/components/magic/Reveal";
import { FRONTS, HERO_STATS, SOURCES, type Stat } from "@/lib/evidence";

function Ref({ n }: { n: number }) {
  return (
    <a href={`#fuente-${n}`} className="ml-0.5 align-super text-[0.65em] font-semibold text-brand no-underline hover:underline" aria-label={`Fuente ${n}`}>
      {n}
    </a>
  );
}

const ICONS = [
  // entrevistas: globo de diálogo
  <path key="a" d="M5 6h14v9H9l-4 3z" />,
  // llamados: teléfono
  <path key="b" d="M7 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5L16 12.5l4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2z" />,
  // contrataciones: check
  <path key="c" d="m5 12.5 4.5 4.5L19 7.5" />,
  // lectura: reloj
  <>
    <circle key="d1" cx="12" cy="12" r="8" />
    <path key="d2" d="M12 8v4l3 2" />
  </>,
];

/** "Resultados reales, no promesas": las 4 métricas con línea punteada e ícono, como en jobright. */
export function ResultsList() {
  return (
    <dl className="space-y-5">
      {HERO_STATS.map((s, i) => (
        <div key={s.value + s.label} className="flex items-end gap-4">
          <div className="min-w-0 shrink-0">
            <dd className="font-display text-4xl font-bold leading-none sm:text-[2.75rem]">
              <NumberTicker value={s.value} />
            </dd>
            <dt className="mt-1 text-sm text-ink/70">
              {s.label}
              <Ref n={s.source} />
            </dt>
          </div>
          <span aria-hidden className="leader" />
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {ICONS[i % ICONS.length]}
            </svg>
          </span>
        </div>
      ))}
    </dl>
  );
}

function FrontStat({ s }: { s: Stat }) {
  return (
    <div className="rounded-2xl bg-sand p-4">
      <p className="font-display text-4xl font-bold leading-none">
        <NumberTicker value={s.value} />
      </p>
      <p className="mt-1.5 text-sm font-semibold leading-snug">
        {s.label}
        <Ref n={s.source} />
      </p>
      <p className="mt-0.5 text-xs leading-snug text-muted">{s.note}</p>
    </div>
  );
}

/** Evidencia por frente de la postulación + qué hace Maru + fuentes. */
export function Evidence() {
  return (
    <section id="evidencia" aria-labelledby="evidencia-t" className="mt-28 scroll-mt-24">
      <Reveal>
        <h2 id="evidencia-t" data-reveal className="max-w-4xl font-display text-4xl font-light uppercase leading-[1.05] sm:text-6xl">
          Personalizar <em>cambia los resultados</em>
        </h2>
        <p data-reveal style={{ "--i": 1 } as React.CSSProperties} className="mt-4 max-w-2xl text-lg leading-relaxed text-ink/70">
          Hacerlo a mano para cada búsqueda lleva horas. Maru lo hace en minutos, en los tres frentes donde se decide si te llaman.
        </p>
      </Reveal>

      <Reveal className="mt-10 grid gap-4 lg:grid-cols-3">
        {FRONTS.map((f, i) => (
          <article key={f.title} data-reveal style={{ "--i": i } as React.CSSProperties} className="flex flex-col rounded-3xl bg-white p-6 ring-1 ring-line">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-brand">{f.kicker}</p>
            <h3 className="mt-1 font-display text-3xl">{f.title}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {f.stats.map((s) => (
                <FrontStat key={s.value + s.label} s={s} />
              ))}
            </div>
            <p className="mt-5 text-sm leading-relaxed">
              <span className="font-semibold text-brand">Cómo lo hace Maru: </span>
              {f.how}
            </p>
          </article>
        ))}
      </Reveal>

      <div id="fuentes" className="mt-6 scroll-mt-24 rounded-3xl bg-black/[0.03] p-6 sm:p-8">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide">Fuentes</h3>
        <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted">
          {SOURCES.map((s) => (
            <li key={s.id} id={`fuente-${s.id}`} className="flex scroll-mt-24 gap-2">
              <span className="font-semibold text-ink">{s.id}.</span>
              <span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                  {s.name}
                </a>
                . {s.detail}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Son estudios de terceros sobre postulaciones en general, no resultados medidos de Maru. Cada búsqueda es distinta: Maru mejora tus chances, no garantiza un resultado.
        </p>
      </div>
    </section>
  );
}
