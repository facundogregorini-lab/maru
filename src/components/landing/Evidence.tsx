import NumberTicker from "@/components/magic/NumberTicker";
import Reveal from "@/components/magic/Reveal";
import { FRONTS, HERO_STATS, SOURCES, type Stat } from "@/lib/evidence";

function Ref({ n }: { n: number }) {
  return (
    <a href={`#fuente-${n}`} className="ml-0.5 align-super text-[0.6em] font-semibold text-celeste-dark no-underline hover:underline" aria-label={`Fuente ${n}`}>
      {n}
    </a>
  );
}

/** Las 4 métricas del hero en un solo panel de vidrio, con los números contando y su fuente. */
export function HeroStats() {
  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[40px] bg-[conic-gradient(from_180deg_at_50%_50%,rgba(31,111,168,0.18),rgba(88,196,211,0.16),rgba(31,111,168,0.05),rgba(31,111,168,0.18))] blur-2xl" />
      <dl className="grid grid-cols-2 overflow-hidden rounded-[28px] bg-paper/70 shadow-[0_30px_70px_-40px_rgba(21,82,126,0.55),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-white/70 backdrop-blur-xl">
        {HERO_STATS.map((s, i) => (
          <div
            key={s.value + s.label}
            className={`flex flex-col p-5 sm:p-7 ${i % 2 === 0 ? "border-r border-line/70" : ""} ${i < 2 ? "border-b border-line/70" : ""}`}
          >
            <dt className="order-2 mt-2 text-sm font-semibold leading-snug text-ink">
              {s.label}
              <Ref n={s.source} />
            </dt>
            <dd className="order-1 font-serif text-[2.6rem] leading-none text-celeste sm:text-[3.4rem]">
              <NumberTicker value={s.value} />
            </dd>
            <dd className="order-3 mt-1.5 text-xs leading-snug text-muted">{s.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FrontStat({ s }: { s: Stat }) {
  return (
    <div className="rounded-2xl bg-sand/70 p-4">
      <p className="font-serif text-4xl leading-none text-celeste">
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

/** "Por qué funciona": evidencia por frente de la postulación + qué hace Maru + fuentes. */
export function Evidence() {
  return (
    <section aria-labelledby="evidencia" className="mt-28 scroll-mt-24">
      <Reveal>
        <p data-reveal className="flex items-center gap-3 text-sm font-medium text-muted">
          <span className="font-serif text-lg italic text-celeste">La evidencia</span>
          <span aria-hidden className="h-px w-8 bg-line" />
          Estudios de terceros
        </p>
        <h2 id="evidencia" data-reveal style={{ "--i": 1 } as React.CSSProperties} className="mt-4 max-w-3xl font-serif text-4xl leading-[1.05] sm:text-5xl">
          Personalizar cada postulación no es un detalle: <em className="text-celeste">cambia los resultados</em>.
        </h2>
        <p data-reveal style={{ "--i": 2 } as React.CSSProperties} className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
          Hacerlo a mano para cada búsqueda lleva horas. Maru lo hace en minutos, en los tres frentes donde se decide si te llaman.
        </p>
      </Reveal>

      <Reveal className="mt-10 grid gap-4 lg:grid-cols-3">
        {FRONTS.map((f, i) => (
          <article
            key={f.title}
            data-reveal
            style={{ "--i": i } as React.CSSProperties}
            className="flex flex-col rounded-[28px] bg-paper p-6 ring-1 ring-line/70 transition-shadow duration-300 hover:shadow-[0_30px_60px_-40px_rgba(21,82,126,0.5)]"
          >
            <p className="text-sm font-medium text-celeste-dark">{f.kicker}</p>
            <h3 className="mt-1 font-serif text-3xl">{f.title}</h3>
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
      </Reveal>

      <div id="fuentes" className="mt-8 scroll-mt-24 rounded-[28px] bg-sand/60 p-6 sm:p-8">
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
