import Link from "next/link";
import CompanyTile from "@/components/busquedas/CompanyTile";
import JobSearchBar from "@/components/busquedas/JobSearchBar";
import CtaScene from "@/components/landing/CtaScene";
import Faq from "@/components/landing/Faq";
import HeroVideoPlayer from "@/components/landing/HeroVideoPlayer";
import { ChatMock, CvMock, MatchMock, VideoMock } from "@/components/landing/Mocks";
import TimeAgo from "@/components/landing/TimeAgo";
import { MaruSprite } from "@/components/maru/PixelMaru";
import SiteShell from "@/components/SiteShell";
import { landingData } from "@/lib/landing";
import { POPULAR } from "@/lib/popular";
import { displayCompany } from "@/lib/match/labels";

// Las cifras se regeneran cada hora y cuentan el mismo catálogo visible en Búsquedas.
export const revalidate = 3600;
const fmt = (n: number) => n.toLocaleString("es-AR");
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension";

export default async function Home() {
  const data = await landingData();
  return (
    <SiteShell>
      {/* Hero como el de jobright: verde claro a todo el ancho, video a la izquierda y titular a la derecha. */}
      <section aria-labelledby="inicio-t" className="full-bleed -mt-8 bg-hero px-5 pb-14 pt-10 sm:pb-20 sm:pt-16">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)] lg:gap-12 [&>*]:min-w-0">
          <div className="order-2 lg:order-1">
            <div className="overflow-hidden rounded-2xl border border-ink bg-white">
              <div aria-hidden className="flex gap-1.5 border-b border-ink px-4 py-3">
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-ink" />)}
              </div>
              <HeroVideoPlayer />
            </div>
            <p className="mt-3 text-center text-xs text-ink/65">Demo ilustrativa. Las cifras actuales del catálogo están debajo.</p>
          </div>
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <p className="font-display text-[28px] font-normal leading-tight sm:text-[46px] sm:leading-[48px]">Tu coach de carrera con IA</p>
            <h1 id="inicio-t" className="mt-1 font-display text-[52px] font-semibold leading-[1] tracking-tight sm:text-[76px] xl:text-[88px] xl:leading-[80px]">
              Buscá trabajo con Maru
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-6 sm:text-lg lg:mx-0">
              Encontrá avisos para tu perfil y prepará cada postulación con tu experiencia real: desde el CV hasta la entrevista.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link href="/match" className="press inline-flex h-12 min-w-[200px] items-center justify-center rounded-[28px] bg-ink px-8 font-display text-lg font-bold uppercase text-white sm:h-14 sm:min-w-[280px] sm:text-2xl">
                Probá gratis
              </Link>
              <Link href="/busquedas" className="press inline-flex h-12 items-center justify-center rounded-[28px] bg-white px-6 font-semibold shadow-[inset_0_0_0_1px_#000] sm:h-14">
                Explorar búsquedas
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink/70">Sin tarjeta. <Link href="/precios" className="font-medium underline underline-offset-4">Ver planes y límites</Link></p>
          </div>
        </div>

        {/* Métricas con línea guía hasta el ícono, como en jobright, pero con los datos de hoy del catálogo. */}
        <div className="mx-auto mt-14 grid max-w-[1200px] gap-10 lg:mt-20 lg:grid-cols-2 lg:gap-12">
          <h2 className="font-display text-[34px] font-bold uppercase leading-[1.05] sm:text-5xl">
            Lo que hay hoy
            <br />
            en Maru
          </h2>
          <dl className="space-y-5">
            {[
              { value: fmt(data.eligible), label: "avisos para buscar desde Argentina", icon: "pin" },
              { value: fmt(data.companies), label: "empresas que publican en el catálogo", icon: "building" },
              { value: fmt(data.total), label: "avisos abiertos, incluidos los que piden otro país", icon: "list" },
            ].map((m) => (
              <div key={m.label} className="flex items-end gap-4">
                <div className="min-w-0">
                  <dd className="font-display text-[40px] font-semibold leading-[48px] tabular-nums sm:text-[44px]">{m.value}</dd>
                  <dt className="text-base font-light leading-5">{m.label}</dt>
                </div>
                <span aria-hidden className="leader mb-6 hidden sm:block" />
                <MetricIcon name={m.icon as "pin" | "building" | "list"} />
              </div>
            ))}
          </dl>
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
                  <CompanyTile name={displayCompany(j.company)} size={48} />
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
  list: <path d="M14 11h18M14 20h18M14 29h18M8 11h1M8 20h1M8 29h1" />,
} as const;

function MetricIcon({ name }: { name: keyof typeof METRIC_ICONS }) {
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mb-1 shrink-0">
      {METRIC_ICONS[name]}
    </svg>
  );
}
