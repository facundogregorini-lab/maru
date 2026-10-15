import { FRONTS, HERO_STATS, SOURCES, type Stat } from "@/lib/evidence";

function Ref({ n }: { n: number }) {
  return (
    <a href={`#fuente-${n}`} className="ml-0.5 align-super text-[0.6em] font-semibold text-celeste-dark no-underline hover:underline" aria-label={`Fuente ${n}`}>
      {n}
    </a>
  );
}

/** Las 4 métricas del hero: grandes, cálidas y con su fuente. */
export function HeroStats() {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:gap-4">
      {HERO_STATS.map((s, i) => (
        <div
          key={s.value + s.label}
          className="animate-rise flex flex-col rounded-3xl bg-paper/90 p-4 shadow-[0_12px_40px_-28px_rgba(43,36,32,0.5)] ring-1 ring-line/70 backdrop-blur sm:p-5"
          style={{ animationDelay: `${150 + i * 90}ms` }}
        >
          <dt className="order-2 mt-1 text-sm font-semibold leading-snug text-ink">
            {s.label}
            <Ref n={s.source} />
          </dt>
          <dd className="order-1 font-serif text-4xl leading-none tracking-tight text-celeste sm:text-5xl">{s.value}</dd>
          <dd className="order-3 mt-1.5 text-xs leading-snug text-muted">{s.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function FrontStat({ s }: { s: Stat }) {
  return (
    <div className="rounded-2xl bg-cream p-4">
      <p className="font-serif text-3xl leading-none tracking-tight text-celeste">{s.value}</p>
      <p className="mt-1.5 text-sm font-semibold leading-snug">
        {s.label}
        <Ref n={s.source} />
      </p>
      <p className="mt-0.5 text-xs leading-snug text-muted">{s.note}</p>
    </div>
  );
}

/** "Por qué funciona": evidencia por frente de la postulación + qué hace Maru + fuentes. */
export function Evidence() {
  return (
    <section aria-labelledby="evidencia" className="mt-16">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-celeste">La evidencia</p>
      <h2 id="evidencia" className="mt-2 max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
        Personalizar cada postulación no es un detalle: <em className="text-celeste">cambia los resultados</em>.
      </h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        Hacerlo a mano para cada búsqueda lleva horas. Maru lo hace en minutos, en los tres frentes donde se decide si te llaman.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {FRONTS.map((f, i) => (
          <article key={f.title} className="animate-rise flex flex-col rounded-3xl border border-line bg-paper p-6" style={{ animationDelay: `${i * 80}ms` }}>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-celeste-dark">{f.kicker}</p>
            <h3 className="mt-1 font-serif text-2xl tracking-tight">{f.title}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {f.stats.map((s) => (
                <FrontStat key={s.value + s.label} s={s} />
              ))}
            </div>
            <p className="mt-5 text-sm leading-relaxed">
              <span className="font-semibold text-sage">Cómo lo hace Maru: </span>
              {f.how}
            </p>
          </article>
        ))}
      </div>

      <div id="fuentes" className="mt-8 scroll-mt-6 rounded-3xl bg-sand/70 p-6">
        <h3 className="text-sm font-semibold">Fuentes</h3>
        <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted">
          {SOURCES.map((s) => (
            <li key={s.id} id={`fuente-${s.id}`} className="scroll-mt-24 flex gap-2">
              <span className="font-semibold text-celeste-dark">{s.id}.</span>
              <span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-celeste">
                  {s.name}
                </a>
                . {s.detail}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Son estudios de terceros sobre postulaciones en general, no resultados medidos de Maru. Cada búsqueda es distinta: Maru mejora tus chances, no
          garantiza un resultado.
        </p>
      </div>
    </section>
  );
}
