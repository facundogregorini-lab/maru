import Link from "next/link";
import { Evidence, HeroStats } from "@/components/landing/Evidence";
import AutofillDemo from "@/components/landing/AutofillDemo";
import PostulacionTools from "@/components/landing/PostulacionTools";
import Reveal from "@/components/magic/Reveal";
import Spotlight from "@/components/magic/Spotlight";
import SiteShell from "@/components/SiteShell";

/** Dónde se instala la extensión. Mientras no esté en la Chrome Web Store, lleva a la página de descarga. */
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension";
const EXTENSION_EXTERNAL = /^https?:/.test(EXTENSION_URL);

export default function Home() {
  return (
    <SiteShell tagline="Tu coach profesional">
      {/* Hero: el momento firma. El titular sube línea por línea y "IA" brilla. */}
      <section className="relative isolate -mx-5 overflow-hidden px-5 pb-20 pt-10 sm:pt-16">
        <div aria-hidden className="aurora -z-10" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(14,27,44,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(14,27,44,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000_30%,transparent_75%)]"
        />
        <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="animate-rise inline-flex items-center gap-2 rounded-full bg-paper/80 px-3.5 py-1.5 text-sm font-medium text-celeste-dark shadow-sm ring-1 ring-celeste/15 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span aria-hidden className="absolute inline-flex h-full w-full animate-ping rounded-full bg-celeste/50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-celeste" />
              </span>
              Maru Coach · tu coach profesional
            </p>
            <h1 className="mt-6 font-serif text-[3.1rem] leading-[0.98] sm:text-7xl lg:text-[5.4rem]">
              <span className="line-mask">
                <span style={{ "--i": 0 } as React.CSSProperties}>Encontrá tu</span>
              </span>
              <span className="line-mask">
                <span style={{ "--i": 1 } as React.CSSProperties}>trabajo perfecto,</span>
              </span>
              <span className="line-mask">
                <span style={{ "--i": 2 } as React.CSSProperties}>
                  con el poder de la <em className="shine-text -mr-[0.06em] pr-[0.06em]">IA</em>.
                </span>
              </span>
            </h1>
            <p className="animate-rise mt-7 max-w-xl text-xl leading-relaxed text-ink/85 [animation-delay:420ms]">
              Cruzamos tu perfil con miles de búsquedas abiertas, personalizamos cada postulación y{" "}
              <span className="text-muted">la completamos por vos.</span>
            </p>
            <div className="animate-rise mt-9 flex flex-wrap items-center gap-x-6 gap-y-4 [animation-delay:520ms]">
              <a
                href="#ayuda"
                className="beam press group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-medium text-paper shadow-[0_18px_40px_-18px_rgba(14,27,44,0.7)] hover:bg-celeste-dark"
              >
                Empezar ahora
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-y-0.5">
                  ↓
                </span>
              </a>
              <a href="#evidencia" className="group inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                Ver la evidencia
                <span aria-hidden className="text-celeste transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </a>
            </div>
          </div>
          <div className="animate-rise [animation-delay:300ms]">
            <HeroStats />
          </div>
        </div>
      </section>

      <section id="ayuda" aria-labelledby="ayuda-t" className="scroll-mt-24">
        <Reveal>
          <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="ayuda-t" className="font-serif text-4xl sm:text-5xl">
              ¿En qué te ayudamos <em className="text-celeste">hoy</em>?
            </h2>
            <p className="max-w-sm text-muted">Tres caminos, una misma idea: que cada postulación muestre lo mejor de vos.</p>
          </div>
        </Reveal>

        {/* 1 · Match */}
        <Reveal className="mt-8">
          <Spotlight data-reveal className="rounded-[32px] bg-paper p-6 ring-1 ring-line/70 sm:p-10">
            <article aria-labelledby="match-t" className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] [&>*]:min-w-0">
              <div>
                <PillarLabel n="01">Match</PillarLabel>
                <h3 id="match-t" className="mt-4 font-serif text-4xl leading-[1.05] sm:text-5xl">
                  Encontrá tu trabajo <em className="text-celeste">perfecto</em>
                </h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">Las que mejor encajan con vos, primero. Y el porqué de cada una.</p>
                <Link
                  href="/match"
                  className="press group mt-7 inline-flex items-center gap-2 rounded-full bg-celeste px-6 py-3.5 font-medium text-white shadow-[0_14px_30px_-12px_rgba(31,111,168,0.7)] hover:bg-celeste-dark"
                >
                  Ver mis matches
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>
              <MatchCardExample />
            </article>
          </Spotlight>
        </Reveal>

        {/* 2 · Postulación: panel claro con un lavado celeste (sin bloque oscuro en el medio de la página). */}
        <Reveal className="mt-5">
          <Spotlight
            data-reveal
            className="overflow-hidden rounded-[32px] bg-[linear-gradient(160deg,var(--color-celeste-soft),var(--color-paper)_55%)] p-6 ring-1 ring-celeste/15 sm:p-10"
          >
            <article aria-labelledby="postulacion-t">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <PillarLabel n="02">Coach de postulación</PillarLabel>
                  <h3 id="postulacion-t" className="mt-4 font-serif text-4xl leading-[1.05] sm:text-5xl">
                    Optimizá y personalizá <em className="text-celeste">tu postulación</em>
                  </h3>
                  <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
                    Traé el link de la vacante y armamos tu CV personalizado, más una respuesta para cada campo del formulario. Todo para que te llamen.
                  </p>
                </div>
                <Link
                  href="/postulacion"
                  className="press group inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-ink px-6 py-3.5 font-medium text-paper shadow-[0_14px_30px_-14px_rgba(14,27,44,0.6)] hover:bg-celeste-dark lg:self-auto"
                >
                  Empezar mi postulación
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>
              <PostulacionTools />
            </article>
          </Spotlight>
        </Reveal>

        {/* 3 · Extensión */}
        <Reveal className="mt-5">
          <Spotlight data-reveal className="rounded-[32px] bg-paper p-6 ring-1 ring-line/70 sm:p-10">
            <article aria-labelledby="auto-t" className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] [&>*]:min-w-0">
              <div>
                <PillarLabel n="03">Extensión para Chrome</PillarLabel>
                <h3 id="auto-t" className="mt-4 font-serif text-4xl leading-[1.05] sm:text-5xl">
                  Completá postulaciones con <em className="text-celeste">un clic</em>
                </h3>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">
                  Cargás tu CV una vez y Maru llena cada formulario por vos: datos, respuestas y el CV adjunto. Vos revisás y enviás.
                </p>
                <a
                  href={EXTENSION_URL}
                  {...(EXTENSION_EXTERNAL ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="press group mt-7 inline-flex items-center gap-2 rounded-full bg-celeste px-6 py-3.5 font-medium text-white shadow-[0_14px_30px_-12px_rgba(31,111,168,0.7)] hover:bg-celeste-dark"
                >
                  Agregar a Chrome
                  <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </a>
              </div>
              <AutofillDemo />
            </article>
          </Spotlight>
        </Reveal>
      </section>

      <Evidence />
    </SiteShell>
  );
}

/** Ejemplo ilustrativo de cómo se ve la recomendación número 1 del ranking. */
function MatchCardExample() {
  return (
    <figure className="relative pt-9" aria-label="Ejemplo de la búsqueda número 1 recomendada">
      <div aria-hidden className="absolute inset-x-10 top-0 h-20 rounded-3xl bg-celeste-soft/60" />
      <div aria-hidden className="absolute inset-x-5 top-[18px] h-20 rounded-3xl bg-sand ring-1 ring-line/70" />
      <div className="animate-float relative rounded-3xl bg-paper p-6 shadow-[0_40px_80px_-40px_rgba(21,82,126,0.55)] ring-1 ring-celeste/25">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex rounded-md bg-celeste-soft px-2 py-1 text-xs font-semibold text-celeste-dark">#1 para vos</span>
            <p className="mt-3 font-serif text-[1.7rem] leading-tight">Product Manager Sr.</p>
            <p className="mt-1 text-sm text-muted">Tucán · Buenos Aires · Híbrido</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-md bg-sand px-2 py-1">Senior</span>
              <span className="rounded-md bg-sand px-2 py-1">Producto</span>
              <span className="rounded-md bg-sage-soft px-2 py-1 text-sage">Contrata desde Argentina</span>
            </div>
          </div>
          <div className="shrink-0 text-center">
            <div className="relative h-20 w-20">
              <svg viewBox="0 0 84 84" className="h-20 w-20" aria-hidden>
                <circle cx="42" cy="42" r="34" fill="none" strokeWidth="7" className="stroke-celeste-soft" />
                <circle
                  cx="42"
                  cy="42"
                  r="34"
                  fill="none"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray="213.6"
                  transform="rotate(-90 42 42)"
                  className="ring-draw stroke-celeste"
                />
              </svg>
              <p className="absolute inset-0 grid place-items-center font-serif text-2xl text-celeste-dark">92%</p>
            </div>
            <p className="mt-1 text-[11px] font-medium text-muted">compatibilidad</p>
          </div>
        </div>

        <p className="mt-5 text-xs font-semibold text-sage">Por qué te la mostramos</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-snug">
          {["Tu experiencia coincide con lo que piden", "El seniority que buscan es el tuyo", "Modalidad y zona dentro de lo que querés"].map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="grid h-4 w-4 shrink-0 translate-y-0.5 place-items-center rounded-full bg-celeste text-[9px] text-white">
                ✓
              </span>
              {r}
            </li>
          ))}
        </ul>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted">Salario</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">USD 3.500 – 4.500 / mes</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Modalidad</dt>
            <dd className="mt-0.5 font-semibold">Híbrido · 2 días oficina</dd>
          </div>
        </dl>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted">Ejemplo ilustrativo de una recomendación</figcaption>
    </figure>
  );
}

function PillarLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-sm font-medium text-muted">
      <span className="font-serif text-lg italic text-celeste">{n}</span>
      <span aria-hidden className="h-px w-8 bg-line" />
      {children}
    </p>
  );
}
