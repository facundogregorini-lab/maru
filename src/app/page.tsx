import Link from "next/link";
import CompanyTile from "@/components/busquedas/CompanyTile";
import JobSearchBar from "@/components/busquedas/JobSearchBar";
import CtaScene from "@/components/landing/CtaScene";
import Faq from "@/components/landing/Faq";
import HeroVideoPlayer from "@/components/landing/HeroVideoPlayer";
import Laurels from "@/components/landing/Laurels";
import { ChatMock, CvMock, MatchMock, VideoMock } from "@/components/landing/Mocks";
import TimeAgo from "@/components/landing/TimeAgo";
import { MaruSprite } from "@/components/maru/PixelMaru";
import SiteShell from "@/components/SiteShell";
import { atLeast, landingData } from "@/lib/landing";
import { POPULAR } from "@/lib/popular";
import { displayCompany } from "@/lib/match/labels";

// Las cifras se regeneran cada hora y cuentan el mismo catálogo visible en Búsquedas.
export const revalidate = 3600;
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension";

export default async function Home() {
  const data = await landingData();
  return (
    <SiteShell>
      {/* Hero como el de jobright: verde claro a todo el ancho, video a la izquierda y titular a la derecha.
          En mobile copia sus medidas a 390 px: 36 + 60 px de titular, bajada de 13, dos botones de 36 y marco a 16 px del borde. */}
      <section aria-labelledby="inicio-t" className="full-bleed -mt-8 bg-hero px-4 py-11 sm:px-5 sm:pb-20 sm:pt-16">
        <div className="mx-auto grid max-w-[1200px] items-center gap-11 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:gap-12 [&>*]:min-w-0">
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-2xl border border-ink bg-white">
              <div aria-hidden className="flex gap-1 border-b border-ink p-4">
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-ink" />)}
              </div>
              <HeroVideoPlayer />
            </div>
          </div>
          <div className="order-1 text-center lg:order-2 lg:text-left">
            {/* Las dos líneas del titular de jobright («No more solo job hunting / Do it with AI»), en español. */}
            <h1 id="inicio-t" className="font-display">
              <span className="mx-auto block max-w-[340px] text-[36px] font-normal uppercase leading-[32.4px] sm:max-w-none sm:text-[46px] sm:normal-case sm:leading-[48px]">Basta de buscar trabajo sin ayuda</span>
              <span className="mt-2 block text-[clamp(48px,15.4vw,60px)] font-semibold leading-[0.93] sm:mt-1 sm:text-[76px] sm:leading-[1] sm:tracking-tight xl:text-[88px] xl:leading-[80px]">Hacelo con IA</span>
            </h1>
            <p className="mx-auto mt-2 max-w-lg text-[13px] leading-4 sm:mt-5 sm:text-lg sm:leading-6 lg:mx-0">
              Conseguí avisos que encajan con tu perfil, autocompletá postulaciones y adaptá tu CV en menos de 1 minuto.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-8 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 lg:justify-start">
              <Link href="/match" className="press inline-flex h-9 items-center justify-center rounded-[28px] bg-ink px-4 text-sm font-semibold text-white sm:h-14 sm:min-w-[280px] sm:px-8 sm:font-display sm:text-2xl sm:font-bold sm:uppercase">
                Probá gratis
              </Link>
              <Link href="/busquedas" className="press inline-flex h-9 items-center justify-center rounded-[28px] whitespace-nowrap bg-white px-2 text-sm font-semibold shadow-[inset_0_0_0_1px_#000] sm:h-14 sm:px-6 sm:text-base">
                Explorar búsquedas
              </Link>
            </div>
            <p className="mt-3 text-[13px] leading-4 text-ink/70 sm:mt-4 sm:text-sm">Sin tarjeta. <Link href="/precios" className="font-medium underline underline-offset-4">Ver planes y límites</Link></p>
          </div>
        </div>

        {/* Sellos y métricas como en jobright: laureles con datos de Maru y líneas guía hasta el ícono, con las cifras de hoy del catálogo. */}
        <div className="mx-auto mt-11 grid max-w-[1200px] gap-6 sm:mt-14 lg:mt-24 lg:grid-cols-[532px_108px_minmax(0,512px)] lg:items-center lg:justify-between lg:gap-0">
          <div>
            <Laurels
              items={[
                { top: "Autocompleta en", main: "Greenhouse", second: "y Lever", href: EXTENSION_URL, label: "Autocompleta formularios en Greenhouse y Lever con la extensión" },
                { top: "Extensión para", main: "Chrome", href: EXTENSION_URL, label: "Extensión para Chrome" },
                { top: "8 herramientas en", main: "Una cuenta", href: "/#herramientas", label: "8 herramientas en una cuenta: ver las herramientas" },
              ]}
            />
            <h2 className="mx-auto mt-11 max-w-[326px] text-center font-display text-[32px] font-bold uppercase leading-8 sm:max-w-none sm:text-5xl sm:leading-[48px] lg:mt-[58px] lg:text-left lg:text-[52px] lg:leading-[52px]">
              Resultados reales,
              <br />
              no solo promesas
            </h2>
          </div>
          {/* Conector punteado entre el titular y las cifras, como el de jobright (sólo escritorio). */}
          <svg viewBox="0 0 108 296" aria-hidden className="hidden w-[108px] lg:block" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="190" r="3" fill="currentColor" stroke="none" />
            <path d="M14 190H48M100 24H64q-16 0-16 16v196q0 16 16 16H100" strokeDasharray="2 4" />
            <path d="M94 18l6 6-6 6M94 246l6 6-6 6" />
          </svg>
          <ul className="space-y-3 px-4 sm:space-y-2 sm:px-0">
            {[
              { value: atLeast(data.eligible), label: "avisos abiertos para postularte desde Argentina", icon: "pin" },
              { value: atLeast(data.eligibleCompanies), label: "empresas buscando gente en Argentina", icon: "building" },
              { value: atLeast(data.eligibleRemote), label: "trabajos remotos que podés pedir desde acá", icon: "laptop" },
              { value: String(data.areas), label: "áreas, de tecnología a gastronomía", icon: "grid" },
            ].map((m) => (
              <li key={m.label}>
                <div className="flex items-center gap-3 sm:gap-8">
                  <strong className="font-display text-2xl font-bold leading-6 tabular-nums sm:text-[44px] sm:font-semibold sm:leading-[48px]">{m.value}</strong>
                  <span aria-hidden className="mt-1 h-0 flex-1 border-t border-dashed border-ink" />
                  <MetricIcon name={m.icon as keyof typeof METRIC_ICONS} />
                </div>
                <p className="text-[13px] leading-4 sm:text-base sm:font-light sm:leading-5">{m.label}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Cinta negra de avisos incorporados, como la de búsquedas en vivo de jobright. */}
      {data.latest.length > 0 && (
        <section aria-labelledby="recientes-t" className="full-bleed mt-0 overflow-hidden bg-[#0a0a0a] text-white">
          <h2 id="recientes-t" className="sr-only">Incorporadas al catálogo recientemente</h2>
          <div className="marquee items-center py-10">
            {[...data.latest, ...data.latest].map((j, i) => (
              <Link key={`${j.id}-${i}`} href={`/busquedas/${j.id}`} aria-hidden={i >= data.latest.length || undefined} tabIndex={i >= data.latest.length ? -1 : undefined} className="mr-16 flex shrink-0 items-center gap-4 hover:opacity-80">
                <span className="rounded-[10px] shadow-[0_0_0_0.5px_rgba(255,255,255,0.15)]">
                  <CompanyTile name={displayCompany(j.company)} logo={j.logo} size={48} />
                </span>
                <span>
                  <span className="block text-[13px] leading-4 text-white/90">
                    <strong className="font-semibold">{displayCompany(j.company)}</strong> · en Maru <TimeAgo iso={j.firstSeenAt} />
                  </span>
                  <span className="mt-1 block max-w-[420px] truncate text-lg font-medium leading-6">{j.title}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="hub-t" className="mt-14 sm:mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="hub-t" className="font-display text-3xl font-bold sm:text-4xl">Explorá las búsquedas</h2>
            <p className="mt-2 text-ink/70">Podés empezar por un puesto o una empresa, sin subir tu CV.</p>
          </div>
          <Link href="/busquedas" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Ver todas las búsquedas →</Link>
        </div>
        <div className="mt-6"><JobSearchBar /></div>
      </section>

      {/* Pasos: tarjetas blancas sobre panel gris con la esquina superior izquierda recta, como las secciones de jobright. */}
      <section id="como-funciona" aria-labelledby="pasos-t" className="mt-16 scroll-mt-24 rounded-[0_40px_40px_40px] bg-surface p-6 sm:mt-20 sm:rounded-[0_80px_80px_80px] sm:p-12 lg:p-[72px]">
        <span className="inline-block rounded-full bg-mint px-3 py-1.5 text-sm font-semibold">Cómo funciona</span>
        <h2 id="pasos-t" className="mt-4 font-display text-3xl font-bold sm:text-[44px] sm:leading-[48px]">De tu experiencia a la próxima postulación</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Cargá tu experiencia", "Subí tu CV o pegá tu trayectoria. Maru arma un perfil que podés corregir y reutilizar."],
            ["Elegí una búsqueda", "Compará los matches o traé un aviso que encontraste por tu cuenta. Vas a ver qué encaja y qué falta confirmar."],
            ["Prepará y revisá", "Adaptá los materiales al puesto y practicá antes de enviar. Confirmá los datos y las respuestas que te representan."],
          ].map(([title, body], i) => <li key={title} className="rounded-3xl bg-white p-6">
            <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-neon font-bold">{i + 1}</span>
            <h3 className="mt-4 text-lg font-semibold leading-6">{title}</h3>
            <p className="mt-2 text-sm leading-5 text-muted">{body}</p>
          </li>)}
        </ol>
      </section>

      <section id="herramientas" aria-labelledby="tools-t" className="mt-16 scroll-mt-24 sm:mt-24">
        <div className="flex items-center gap-3">
          <h2 id="tools-t" className="font-display text-3xl font-bold sm:text-[44px] sm:leading-[48px]">Elegí qué necesitás preparar</h2>
          <MaruSprite size={44} frame="wave" className="hidden shrink-0 sm:block" />
        </div>
        <p className="mt-3 max-w-2xl text-ink/70">Usá cada herramienta por separado o seguí el recorrido completo con una búsqueda.</p>
        {/* Filas como las de jobright: texto a la izquierda y la maqueta en el panel menta a la derecha. */}
        <div className="mt-10 space-y-16 sm:mt-14 sm:space-y-24">
          <Feature title="Búsquedas a tu medida" body="Compará tu perfil con el catálogo. Cada match muestra la afinidad, los motivos y los requisitos que faltan confirmar." cta="Ver mis matches" href="/match" visual={<MatchMock />} />
          <Feature title="Una postulación para cada aviso" body="Traé una vacante y prepará el CV y las respuestas del formulario con los datos de tu perfil." cta="Preparar una postulación" href="/postulacion" visual={<CvMock />} />
          <Feature title="Practicá tu entrevista" body="Respondé por voz o por escrito. Maru hace repreguntas y al final te muestra qué funcionó y qué podés mejorar." cta="Practicar una entrevista" href="/entrevista" visual={<ChatMock />} />
          <Feature title="Grabá tu presentación" body="Armá un guion con tu experiencia y leelo en el teleprompter mientras grabás. El feedback de cámara está incluido en los planes pagos." cta="Preparar mi video" href="/video" visual={<VideoMock />} />
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Tu CV general", body: "Ordená tu trayectoria para el tipo de rol que buscás, aunque todavía no tengas un aviso.", href: "/cv", cta: "Armar mi CV" },
            { title: "Carta de presentación", body: "Contá por qué te interesa la empresa con ejemplos de tu experiencia y el tono que elijas.", href: "/carta", cta: "Escribir mi carta" },
            { title: "Seguimiento", body: "Guardá búsquedas y registrá cada avance. Al ingresar, el tablero también se sincroniza con tu cuenta.", href: "/seguimiento", cta: "Ver mi tablero" },
            { title: "Extensión para Chrome", body: "Completá campos en Greenhouse, Lever y formularios compatibles. Revisá las respuestas antes de enviar.", href: EXTENSION_URL, cta: "Ver la extensión" },
          ].map((tool) => <article key={tool.href} className="flex flex-col rounded-3xl bg-surface p-6">
            <h3 className="text-lg font-semibold leading-6">{tool.title}</h3>
            <p className="mb-5 mt-2 text-sm leading-5 text-muted">{tool.body}</p>
            <Link href={tool.href} className="mt-auto inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{tool.cta} →</Link>
          </article>)}
        </div>
      </section>

      <Faq>
        <div className="mt-12 sm:mt-16"><CtaScene /></div>
        <div className="mx-auto max-w-[1200px] pb-16 pt-12">
          <h2 className="text-center font-display text-2xl font-semibold">Explorá por área o experiencia</h2>
          <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2.5">
            {POPULAR.map((p) => <Link key={p.href} href={p.href} className="press inline-flex min-h-9 items-center rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">{p.label}</Link>)}
          </div>
        </div>
      </Faq>
    </SiteShell>
  );
}

function Feature({ title, body, cta, href, visual }: { title: string; body: string; cta: string; href: string; visual: React.ReactNode }) {
  return <article className="grid items-center gap-8 lg:grid-cols-[384px_minmax(0,1fr)] lg:gap-20">
    <div className="text-center lg:text-left">
      <h3 className="font-display text-[32px] font-semibold leading-[1.05] sm:text-5xl">{title}</h3>
      <p className="mt-4 text-base leading-6 sm:text-lg">{body}</p>
      <Link href={href} className="press mt-8 inline-flex h-12 min-w-[256px] items-center justify-center rounded-[28px] bg-ink px-6 text-lg font-medium text-white sm:text-xl">{cta}</Link>
    </div>
    <div className="min-w-0">{visual}</div>
  </article>;
}

const METRIC_ICONS = {
  pin: <path d="M20 35s-10-9-10-17a10 10 0 1 1 20 0c0 8-10 17-10 17zM20 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  building: <path d="M9 34V9h14v25M23 16h8v18M6 34h28M13 14h2M17 14h2M13 19h2M17 19h2M13 24h2M17 24h2M27 21h0M27 26h0" />,
  laptop: <path d="M9 11h22v15H9zM5 30h30M17 30l1-2h4l1 2" />,
  grid: <path d="M8 8h10v10H8zM22 8h10v10H22zM8 22h10v10H8zM22 22h10v10H22z" />,
} as const;

function MetricIcon({ name }: { name: keyof typeof METRIC_ICONS }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-6 w-6 shrink-0 sm:h-10 sm:w-10">
      {METRIC_ICONS[name]}
    </svg>
  );
}
