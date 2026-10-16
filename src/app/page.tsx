import Link from "next/link";
import CompanyTile from "@/components/busquedas/CompanyTile";
import JobSearchBar from "@/components/busquedas/JobSearchBar";
import AutofillDemo from "@/components/landing/AutofillDemo";
import CtaScene from "@/components/landing/CtaScene";
import { ResultsList } from "@/components/landing/Evidence";
import EvidenceWall from "@/components/landing/EvidenceWall";
import Faq from "@/components/landing/Faq";
import HeroVideoPlayer from "@/components/landing/HeroVideoPlayer";
import Laurels from "@/components/landing/Laurels";
import { ChatMock, CvMock, MatchMock, MockPanel, TrackerMock, VideoMock } from "@/components/landing/Mocks";
import TimeAgo from "@/components/landing/TimeAgo";
import Reveal from "@/components/magic/Reveal";
import ScrollFade from "@/components/magic/ScrollFade";
import { MaruSprite } from "@/components/maru/PixelMaru";
import SiteShell from "@/components/SiteShell";
import { landingData } from "@/lib/landing";
import { POPULAR } from "@/lib/popular";

// Los números y la cinta salen del inventario real; se regeneran cada hora.
export const revalidate = 3600;

/** Dónde se instala la extensión. Mientras no esté en la Chrome Web Store, lleva a la página de descarga. */
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension";

const fmt = (n: number) => n.toLocaleString("es-AR");

export default async function Home() {
  const data = await landingData();

  return (
    <SiteShell>
      {/* ---------- Hero: bloque menta de lado a lado, que termina en globo de diálogo ---------- */}
      <section className="full-bleed relative -mt-8 overflow-hidden rounded-br-[64px] bg-sand px-5 pb-14 pt-10 sm:rounded-br-[120px] sm:pt-16 lg:pb-20">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[640px_1fr] lg:gap-12 [&>*]:min-w-0">
          <div className="order-2 lg:order-1">
            <HeroVideo />
          </div>
          <div className="order-1 text-center lg:order-2 lg:text-left">
            {/* El gancho de jobright ("No More Solo Job Hunting / Do it with AI"), en español y con Maru. */}
            <h1 className="font-display">
              <span className="line-mask text-[2rem] font-light uppercase leading-[1] sm:text-[38px] lg:normal-case lg:leading-[1.2]">
                <span style={{ "--i": 0 } as React.CSSProperties}>
                  Basta de buscar <br className="lg:hidden" />
                  trabajo solo
                </span>
              </span>
              <span className="line-mask mt-1 text-[3.25rem] font-bold leading-[1.05] sm:text-[4.4rem] lg:mt-0 xl:text-[80px]">
                <span style={{ "--i": 1 } as React.CSSProperties}>Hacelo con Maru AI</span>
              </span>
            </h1>
            <p className="animate-rise mx-auto mt-3 max-w-[512px] text-[15px] leading-snug sm:text-base lg:mx-0 [animation-delay:400ms]">
              Conseguí ofertas a tu medida, autocompletá postulaciones, armá un CV personalizado y entrená tu entrevista, ¡en minutos!
            </p>
            {/* Escritorio: un solo botón grande, como "TRY FOR FREE". Celular: dos botones, como jobright. */}
            <div className="animate-rise mt-5 flex flex-wrap justify-center gap-3 lg:mt-14 lg:justify-start [animation-delay:500ms]">
              <Link href="/match" className="press hidden h-14 w-[280px] items-center justify-center rounded-full bg-ink font-display text-2xl font-bold uppercase text-white hover:bg-black lg:inline-flex">
                Empezar gratis
              </Link>
              <Link href="/match" className="press inline-flex h-11 items-center rounded-full bg-ink px-7 font-semibold text-white lg:hidden">
                Empezar gratis
              </Link>
              <Link href={EXTENSION_URL} className="press inline-flex h-11 items-center rounded-full border-2 border-ink bg-white px-6 font-semibold lg:hidden">
                Bajar la extensión
              </Link>
            </div>
          </div>
        </div>

        {/* Resultados reales, no promesas */}
        <Reveal className="relative mx-auto mt-14 grid max-w-[1200px] gap-10 lg:mt-12 lg:grid-cols-[1fr_512px] lg:gap-12">
          <div data-reveal className="flex flex-col justify-between gap-8">
            <Laurels
              items={[
                { top: "Búsquedas reales", main: `${fmt(data.total)}+` },
                { top: "Funciona en", main: "Greenhouse · Lever" },
                { top: "Sin tarjeta", main: "100% gratis" },
              ]}
            />
            <div className="relative flex items-center">
              <h2 className="font-display text-[2.4rem] font-bold uppercase leading-[1] sm:text-5xl">
                Resultados reales,
                <br />
                no promesas
              </h2>
              {/* Conector punteado hacia las métricas (sólo escritorio). */}
              <span aria-hidden className="ml-auto hidden h-[220px] items-center lg:flex">
                <span className="h-2 w-2 rounded-full bg-ink" />
                <span className="w-8 border-t-2 border-dotted border-ink" />
                <span className="h-full w-6 rounded-l-2xl border-2 border-r-0 border-dotted border-ink" />
              </span>
            </div>
          </div>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <ResultsList />
          </div>
        </Reveal>
      </section>
      {/* La colita del globo. */}
      <div aria-hidden className="full-bleed relative h-0">
        <svg viewBox="0 0 160 72" className="absolute left-[18%] top-[-1px] h-12 w-28 sm:h-[72px] sm:w-40">
          <path d="M0 0H160L0 72Z" fill="var(--color-sand)" />
        </svg>
      </div>

      {/* ---------- Búsquedas reales ---------- */}
      <section aria-labelledby="hub-t" className="mt-24 sm:mt-28">
        <Reveal>
          <h2 id="hub-t" data-reveal className="font-display text-[2rem] font-light uppercase leading-[1.05] sm:text-5xl">
            Accedé a <strong className="font-bold">búsquedas reales!</strong>
          </h2>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties} className="mt-8 sm:mt-10">
            <div className="relative">
              <div className="absolute bottom-0 left-0">
                <MaruSprite size={64} frame="walkA" className="sm:hidden" />
                <MaruSprite size={86} frame="walkA" className="hidden sm:block" />
              </div>
              <HubRow label="Búsquedas abiertas hoy" value={`${fmt(data.total)}+`} />
            </div>
            <div className="ml-[84px] h-0.5 bg-ink sm:ml-[120px]" />
            <HubRow label="Que podés tomar desde Argentina" value={fmt(data.eligible)} />
          </div>
        </Reveal>
      </section>

      {data.latest.length > 0 && (
        <div className="full-bleed relative mt-14 overflow-hidden bg-ink py-6 text-white" aria-label="Búsquedas que acaban de entrar">
          <div className="marquee gap-12">
            {[...data.latest, ...data.latest].map((j, i) => (
              <Link
                key={`${j.id}-${i}`}
                href={`/busquedas/${j.id}`}
                tabIndex={i >= data.latest.length ? -1 : undefined}
                aria-hidden={i >= data.latest.length || undefined}
                className="flex shrink-0 items-center gap-3 rounded-xl transition-opacity hover:opacity-80"
              >
                <CompanyTile name={j.company} />
                <span className="min-w-0">
                  <span className="block text-[13px] text-white/90">
                    <span className="font-semibold">{j.company}</span> · <TimeAgo iso={j.firstSeenAt} />
                  </span>
                  <span className="block max-w-[340px] truncate text-lg font-medium">{j.title}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Lo que hace Maru ---------- */}
      <section id="herramientas" aria-labelledby="tools-t" className="mt-24 scroll-mt-24 sm:mt-40">
        <Reveal>
          <h2 id="tools-t" data-reveal className="font-display text-[2.6rem] font-bold uppercase leading-[1] sm:text-[80px]">
            <span className="flex items-end gap-3">
              Tu coach
              <MaruSprite size={56} frame="wave" className="mb-2 hidden sm:block" />
              <MaruSprite size={36} frame="wave" className="mb-1 sm:hidden" />
            </span>
            de carrera con IA
          </h2>
        </Reveal>

        <div className="mt-14 space-y-24 sm:mt-24 lg:space-y-[200px]">
          <Feature
            title="Búsquedas a tu medida"
            body="Cruzamos tu CV con miles de búsquedas abiertas y te mostramos primero las que encajan con vos, con el porqué de cada una y lo que falta confirmar."
            cta="Ver mis matches"
            href="/match"
            visual={<MatchMock />}
          />
          <Feature
            title="Autocompletá en 1 clic"
            body="Con la extensión para Chrome, Maru completa los formularios de postulación por vos: datos, respuestas y tu CV adjunto. Funciona en Greenhouse, Lever y otros formularios web."
            cta="Bajar la extensión"
            href={EXTENSION_URL}
            visual={
              <MockPanel>
                <AutofillDemo />
              </MockPanel>
            }
          />
          <Feature
            title="Un CV a medida de cada búsqueda"
            body="Traé el link de la vacante: Maru reescribe tu CV con las palabras que busca el ATS y los logros que importan para ese rol, más una respuesta para cada campo del formulario."
            cta="Mejorar mi CV"
            href="/postulacion"
            visual={<CvMock />}
          />
          <Feature
            title="Entrená tu entrevista"
            body="Una entrevista simulada por voz, como en una videollamada. Maru repregunta si tu respuesta queda corta y al final te da un informe con puntaje."
            cta="Practicar ahora"
            href="/entrevista"
            visual={<ChatMock />}
          />
          <Feature
            title="Un video que te presente"
            body="Maru te escribe el guion, lo leés en un teleprompter mientras grabás y recibís feedback de cada toma: ritmo, mirada y luz."
            cta="Grabar mi video"
            href="/video"
            visual={<VideoMock />}
          />
          <Feature
            title="Seguí cada postulación"
            body="Todo lo que preparás con Maru queda en un tablero: guardadas, postuladas, entrevistas y ofertas, con el CV, la carta y la práctica de cada una. Vive en tu navegador."
            cta="Ver mi seguimiento"
            href="/seguimiento"
            visual={<TrackerMock />}
          />
        </div>
      </section>

      <EvidenceWall />

      {/* ---------- Cierre: preguntas, el globo con Maru y el buscador, todo en menta hasta el footer ---------- */}
      <Faq>
        <div className="mt-24 sm:mt-28">
          <CtaScene />
        </div>
        <div className="mx-auto max-w-[1200px] pb-20 pt-16 sm:pt-20">
          <h2 className="text-center font-display text-2xl font-bold uppercase sm:text-[32px]">Encontrá tu trabajo ideal en un clic!</h2>
          <div className="mt-8">
            <JobSearchBar />
          </div>
          <h3 className="mt-12 text-center font-display text-xl font-semibold sm:text-2xl">Búsquedas populares</h3>
          <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2.5">
            {POPULAR.map((p) => (
              <Link key={p.href} href={p.href} className="press rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-black">
                {p.label}
              </Link>
            ))}
          </div>
        </div>
      </Faq>
    </SiteShell>
  );
}

function HubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="ml-[84px] grid py-3 sm:ml-[120px] lg:grid-cols-[1fr_512px]">
      <span />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-sm sm:font-display sm:text-2xl sm:font-normal">{label}</p>
        <p className="font-display text-2xl font-bold tabular-nums leading-tight sm:text-[64px]">{value}</p>
      </div>
    </div>
  );
}

function Feature({ title, body, cta, href, visual }: { title: string; body: string; cta: string; href: string; visual: React.ReactNode }) {
  // Como en jobright: siempre texto a la izquierda y la maqueta a la derecha; en celular, centrado
  // y con el botón debajo de la maqueta.
  return (
    <Reveal className="grid items-center gap-6 lg:grid-cols-[384px_minmax(0,1fr)] lg:gap-x-12 lg:gap-y-0">
      <ScrollFade className="text-center lg:col-start-1 lg:row-start-1 lg:self-end lg:text-left">
        <div data-reveal>
          <h3 className="font-display text-[2rem] font-semibold leading-[1] sm:text-5xl">{title}</h3>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-snug text-ink/80 sm:text-base lg:mx-0">{body}</p>
        </div>
      </ScrollFade>
      <div data-reveal style={{ "--i": 1 } as React.CSSProperties} className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {visual}
      </div>
      <div className="text-center lg:col-start-1 lg:row-start-2 lg:self-start lg:pt-9 lg:text-left">
        <Link href={href} className="press inline-flex h-12 min-w-[200px] items-center justify-center rounded-full bg-ink px-8 text-lg font-medium text-white hover:bg-black sm:min-w-[256px] sm:text-xl">
          {cta}
        </Link>
      </div>
    </Reveal>
  );
}

/** Hero: el video de Maru en una "ventana", como el video del hero de jobright (se regenera con scripts/render-intro-video.mjs). */
function HeroVideo() {
  return (
    <div className="animate-rise relative [animation-delay:200ms]">
      <div className="overflow-hidden rounded-2xl border-2 border-ink bg-white">
        <div className="flex items-center gap-1.5 border-b-2 border-ink bg-white px-4 py-2.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-ink" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink" />
        </div>
        <HeroVideoPlayer />
      </div>
    </div>
  );
}
