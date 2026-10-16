import Link from "next/link";
import { Evidence, HeroStats } from "@/components/landing/Evidence";
import PostulacionTools from "@/components/landing/PostulacionTools";
import SiteShell from "@/components/SiteShell";

/** Dónde se instala la extensión. Mientras no esté en la Chrome Web Store, lleva a la página de descarga. */
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension";
const EXTENSION_EXTERNAL = /^https?:/.test(EXTENSION_URL);

export default function Home() {
  return (
    <SiteShell tagline="Tu coach profesional">
      <section className="animate-rise relative overflow-hidden rounded-[2rem] bg-sand px-6 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-celeste-soft" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-sage-soft" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-celeste">Maru Coach, tu coach profesional</p>
            <h1 className="mt-3 font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl">
              Encontrá tu trabajo perfecto, con todo el poder de la <em className="text-celeste">IA</em>.
            </h1>
            <p className="mt-5 max-w-xl text-xl font-medium leading-snug text-ink">Cruzamos tu perfil con las miles de búsquedas abiertas en el mercado.</p>
            <p className="mt-2 max-w-xl text-lg leading-relaxed text-muted">
              Encontramos las que encajan con vos, personalizamos cada postulación y aplicamos por vos.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a
                href="#ayuda"
                className="inline-flex items-center gap-2 rounded-full bg-celeste px-7 py-3.5 font-medium text-white transition hover:bg-celeste-dark"
              >
                Empezar ahora <span aria-hidden>↓</span>
              </a>
              <a href="#evidencia" className="text-sm font-medium text-celeste-dark underline decoration-celeste/40 underline-offset-4 hover:decoration-celeste">
                Ver la evidencia
              </a>
            </div>
          </div>
          <HeroStats />
        </div>
      </section>

      <section id="ayuda" aria-labelledby="ayuda-t" className="mt-16 scroll-mt-6">
        <h2 id="ayuda-t" className="font-serif text-3xl tracking-tight sm:text-4xl">
          ¿En qué te ayudamos hoy?
        </h2>

        {/* 1 · Match */}
        <article aria-labelledby="match-t" className="mt-6 grid items-center gap-8 rounded-3xl border border-line bg-paper p-6 sm:p-10 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <PillarLabel icon="search" tone="celeste">
              1 · Match
            </PillarLabel>
            <h3 id="match-t" className="mt-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
              Encontrá tu trabajo perfecto
            </h3>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-muted">Las que mejor encajan con vos, primero. Y el porqué de cada una.</p>
            <Link
              href="/match"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-celeste px-6 py-3 font-medium text-white transition hover:bg-celeste-dark"
            >
              Ver mis matches <span aria-hidden>→</span>
            </Link>
          </div>
          <MatchCardExample />
        </article>

        {/* 2 · Postulación */}
        <article aria-labelledby="postulacion-t" className="relative mt-4 overflow-hidden rounded-3xl bg-ink p-6 text-paper sm:p-10">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-celeste/45" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <PillarLabel icon="target" tone="dark">
                2 · Coach de postulación
              </PillarLabel>
              <h3 id="postulacion-t" className="mt-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
                Optimizá y personalizá tu postulación
              </h3>
              <p className="mt-3 leading-relaxed text-paper/75">
                Traé el link de la vacante y armamos tu CV personalizado, sacando el 100% de tu potencial, más una respuesta para cada campo del formulario. Todo para maximizar tus chances de que te contacten.
              </p>
            </div>
            <Link
              href="/postulacion"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-paper px-6 py-3.5 font-medium text-celeste-dark transition hover:bg-celeste-soft lg:self-auto"
            >
              Empezar mi postulación <span aria-hidden>→</span>
            </Link>
          </div>
          <PostulacionTools />
        </article>

        {/* 3 · Aplicación automática */}
        <article
          aria-labelledby="auto-t"
          className="mt-4 flex flex-col gap-6 rounded-3xl border border-line bg-paper p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <PillarLabel icon="bolt" tone="sage">
              3 · Extensión para Chrome
            </PillarLabel>
            <h3 id="auto-t" className="mt-4 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
              Aplicá automáticamente
            </h3>
            <p className="mt-3 max-w-md text-lg leading-relaxed text-muted">Te postulamos a las búsquedas con buen fit, con tu CV y respuestas listas. Vos sólo aprobás.</p>
          </div>
          <a
            href={EXTENSION_URL}
            {...(EXTENSION_EXTERNAL ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-[#4a5f43] px-7 py-3.5 font-medium text-white transition hover:bg-[#3d4f37] lg:self-auto"
          >
            Agregar a Chrome <span aria-hidden>→</span>
          </a>
        </article>
      </section>

      <Evidence />
    </SiteShell>
  );
}

/** Ejemplo ilustrativo de cómo se ve la recomendación número 1 del ranking. */
function MatchCardExample() {
  return (
    <figure className="relative pt-9" aria-label="Ejemplo de la búsqueda número 1 recomendada">
      <div aria-hidden className="absolute inset-x-9 top-0 h-20 rounded-3xl bg-line" />
      <div aria-hidden className="absolute inset-x-4 top-[18px] h-20 rounded-3xl border border-line bg-sand" />
      <div className="relative rounded-3xl border-[1.5px] border-celeste bg-white p-6 shadow-[0_30px_60px_-36px_rgba(22,84,127,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-[#f6e3be] px-3 py-1 text-xs font-bold text-[#6a4608]">#1 para vos</span>
            <p className="mt-3 font-serif text-2xl leading-tight">Product Manager Sr.</p>
            <p className="mt-1 text-sm text-muted">[Empresa] · Buenos Aires · Híbrido</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-sand px-2.5 py-1">Senior</span>
              <span className="rounded-full bg-sand px-2.5 py-1">Producto</span>
              <span className="rounded-full bg-sage-soft px-2.5 py-1 text-[#4a5f43]">Contrata desde Argentina</span>
            </div>
          </div>
          <div className="shrink-0 text-center">
            <div className="relative h-20 w-20">
              <svg viewBox="0 0 84 84" className="h-20 w-20" aria-hidden>
                <circle cx="42" cy="42" r="34" fill="none" strokeWidth="8" className="stroke-celeste-soft" />
                <circle
                  cx="42"
                  cy="42"
                  r="34"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="196.5 213.6"
                  transform="rotate(-90 42 42)"
                  className="stroke-celeste"
                />
              </svg>
              <p className="absolute inset-0 grid place-items-center font-serif text-2xl text-celeste-dark">92%</p>
            </div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Compatibilidad</p>
          </div>
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-sage">Por qué te la mostramos</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-snug">
          {["Tu experiencia coincide con lo que piden", "El seniority que buscan es el tuyo", "Modalidad y zona dentro de lo que querés"].map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="font-bold text-celeste">
                ✓
              </span>
              {r}
            </li>
          ))}
        </ul>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted">Salario</dt>
            <dd className="mt-0.5 font-semibold">USD 3.500 – 4.500 / mes</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Modalidad</dt>
            <dd className="mt-0.5 font-semibold">Híbrido · 2 días oficina</dd>
          </div>
        </dl>
      </div>
      <figcaption className="mt-2.5 text-center text-xs text-muted">Ejemplo ilustrativo de una recomendación</figcaption>
    </figure>
  );
}

const ICONS = {
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  bolt: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
};

const TONES = {
  celeste: { icon: "bg-celeste-soft text-celeste-dark", text: "text-celeste-dark" },
  dark: { icon: "bg-celeste text-white", text: "text-celeste-light" },
  sage: { icon: "bg-sage-soft text-[#4a5f43]", text: "text-[#4a5f43]" },
};

function PillarLabel({ icon, tone, children }: { icon: keyof typeof ICONS; tone: keyof typeof TONES; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${TONES[tone].icon}`}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {ICONS[icon]}
        </svg>
      </span>
      <span className={`text-xs font-semibold uppercase tracking-[0.16em] ${TONES[tone].text}`}>{children}</span>
    </div>
  );
}
