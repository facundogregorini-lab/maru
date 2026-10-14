import Link from "next/link";
import { Evidence, HeroStats } from "@/components/landing/Evidence";
import SiteShell from "@/components/SiteShell";

type Section = {
  title: string;
  kicker: string;
  body: string;
  icon: keyof typeof ICONS;
  href?: string; // sin href = próximamente
};

/** La sección activa: lo que Maru ya hace hoy. */
const FEATURED: Section = {
  kicker: "Coach de postulación",
  title: "Postulate a esa búsqueda que te encanta",
  body: "Traé el link de la vacante y armamos tu CV personalizado, sacando el 100% de tu potencial, más una respuesta para cada campo del formulario. Todo para maximizar tus chances de que te contacten.",
  icon: "target",
  href: "/postulacion",
};

const SECTIONS: Section[] = [
  {
    kicker: "CV",
    title: "Creá tu CV perfecto",
    body: "Un CV 100% optimizado para pasar los filtros automáticos y ganar las búsquedas. Más de 20 diseños para personalizar.",
    icon: "doc",
    href: "/cv",
  },
  {
    kicker: "Carta",
    title: "Carta de presentación",
    body: "Cargá la búsqueda, contá lo tuyo por escrito o en un audio, y te armamos una carta a medida que muestra por qué sos la persona indicada.",
    icon: "letter",
    href: "/carta",
  },
  {
    kicker: "Video",
    title: "Video de presentación",
    body: "Guion a medida, teleprompter mientras grabás con tu cámara y feedback de cada toma: ritmo, mirada y luz.",
    icon: "video",
    href: "/video",
  },
  {
    kicker: "Entrevista",
    title: "Entrená para tu entrevista",
    body: "Simulá la entrevista por voz, como en una videollamada, y recibí un informe con puntaje y respuestas más fuertes.",
    icon: "chat",
    href: "/entrevista",
  },
  {
    kicker: "Match",
    title: "Encontrá tu trabajo perfecto",
    body: "Cruzamos más de un millón de búsquedas abiertas con tu perfil para encontrar tu match perfecto.",
    icon: "search",
  },
  {
    kicker: "Extensión",
    title: "Aplicación automática",
    body: "Con la extensión de Maru, te postulamos automáticamente a las búsquedas con buen fit o que te encantan.",
    icon: "bolt",
  },
];

export default function Home() {
  return (
    <SiteShell tagline="Tu coach profesional">
      <section className="animate-rise relative overflow-hidden rounded-[2rem] bg-sand px-6 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-clay-soft" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-sage-soft" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-clay">Maru, tu coach profesional</p>
            <h1 className="mt-3 font-serif text-4xl leading-[1.08] tracking-tight sm:text-6xl">
              Encontrá el trabajo perfecto, con todo el poder de la <em className="text-clay">IA</em>.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Un CV y una carta a medida para cada búsqueda multiplican tus chances de que te llamen. Maru los arma en minutos, sin inventar nada.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href={FEATURED.href!}
                className="inline-flex items-center gap-2 rounded-full bg-clay px-6 py-3 font-medium text-paper transition hover:bg-clay-dark"
              >
                Empezar mi postulación <span aria-hidden>→</span>
              </Link>
              <a href="#evidencia" className="text-sm font-medium text-clay-dark underline decoration-clay/40 underline-offset-4 hover:decoration-clay">
                Ver la evidencia
              </a>
            </div>
          </div>
          <HeroStats />
        </div>
      </section>

      <h2 className="mt-14 font-serif text-3xl tracking-tight">¿En qué te ayudamos hoy?</h2>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FeaturedCard s={FEATURED} />
        {SECTIONS.map((s, i) => (
          <SectionCard key={s.title} s={s} delay={(i + 1) * 60} />
        ))}
      </div>

      <Evidence />
    </SiteShell>
  );
}

function FeaturedCard({ s }: { s: Section }) {
  return (
    <Link
      href={s.href!}
      className="animate-rise group relative flex flex-col overflow-hidden rounded-3xl bg-ink p-6 text-paper transition hover:-translate-y-0.5 hover:shadow-xl sm:col-span-2 sm:p-8"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-clay/40" />
      <div className="relative flex items-center gap-3">
        <Icon name={s.icon} className="bg-clay text-paper" />
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-clay-soft">{s.kicker}</span>
      </div>
      <h3 className="relative mt-5 font-serif text-3xl leading-tight tracking-tight">{s.title}</h3>
      <p className="relative mt-3 max-w-lg leading-relaxed text-paper/75">{s.body}</p>
      <span className="relative mt-6 inline-flex items-center gap-2 font-medium text-clay-soft">
        Empezar <span aria-hidden className="transition group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}

function SectionCard({ s, delay }: { s: Section; delay: number }) {
  if (s.href) {
    return (
      <Link
        href={s.href}
        className="animate-rise group flex flex-col rounded-3xl border border-line bg-paper p-6 transition hover:-translate-y-0.5 hover:border-clay hover:shadow-lg"
        style={{ animationDelay: `${delay}ms` }}
      >
        <Icon name={s.icon} className="bg-clay-soft text-clay-dark" />
        <h3 className="mt-5 font-serif text-xl leading-snug tracking-tight">{s.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
        <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-medium text-clay-dark">
          Empezar <span aria-hidden className="transition group-hover:translate-x-1">→</span>
        </span>
      </Link>
    );
  }
  return (
    <div
      aria-disabled
      className="animate-rise flex flex-col rounded-3xl border border-line bg-paper/70 p-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <Icon name={s.icon} className="bg-sand text-clay-dark" />
        <span className="rounded-full bg-sage-soft px-3 py-1 text-xs font-medium text-sage">Próximamente</span>
      </div>
      <h3 className="mt-5 font-serif text-xl leading-snug tracking-tight">{s.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
    </div>
  );
}

const ICONS = {
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.5" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  letter: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="m3 8 9 6 9-6" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 10 5-3v10l-5-3" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M8 10h8M8 13h5" />
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

function Icon({ name, className = "" }: { name: keyof typeof ICONS; className?: string }) {
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${className}`}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {ICONS[name]}
      </svg>
    </span>
  );
}
