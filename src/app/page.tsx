import Link from "next/link";
import { Evidence, ResultsList } from "@/components/landing/Evidence";
import AutofillDemo from "@/components/landing/AutofillDemo";
import Faq from "@/components/landing/Faq";
import { ChatMock, CvMock, MatchMock, MockPanel, VideoMock } from "@/components/landing/Mocks";
import TimeAgo from "@/components/landing/TimeAgo";
import Reveal from "@/components/magic/Reveal";
import { MaruSprite } from "@/components/maru/PixelMaru";
import SiteShell from "@/components/SiteShell";
import { landingData } from "@/lib/landing";

// Los números y la cinta salen del inventario real; se regeneran cada hora.
export const revalidate = 3600;

/** Dónde se instala la extensión. Mientras no esté en la Chrome Web Store, lleva a la página de descarga. */
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || "/extension";

const fmt = (n: number) => n.toLocaleString("es-AR");

export default async function Home() {
  const data = await landingData();

  return (
    <SiteShell>
      {/* ---------- Hero: bloque menta de lado a lado ---------- */}
      <section className="full-bleed relative -mt-8 overflow-hidden bg-sand px-5 pb-16 pt-14 sm:pb-20 sm:pt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1fr_1.05fr] [&>*]:min-w-0">
          <div className="order-2 lg:order-1">
            <HeroVideo />
          </div>
          <div className="order-1 lg:order-2">
            <h1 className="font-display">
              <span className="line-mask text-[1.9rem] font-light leading-tight sm:text-[2.6rem]">
                <span style={{ "--i": 0 } as React.CSSProperties}>Basta de buscar trabajo solo</span>
              </span>
              <span className="line-mask mt-1 text-[3.4rem] font-bold leading-[1] sm:text-[5.2rem]">
                <span style={{ "--i": 1 } as React.CSSProperties}>
                  Hacelo con <span className="marker">IA</span>
                </span>
              </span>
            </h1>
            <p className="animate-rise mt-6 max-w-lg text-lg leading-relaxed text-ink/75 [animation-delay:400ms]">
              Búsquedas que encajan con vos, un CV a medida, respuestas para cada formulario y autocompletado en un clic. Todo en minutos.
            </p>
            <div className="animate-rise mt-8 flex flex-wrap items-center gap-4 [animation-delay:500ms]">
              <Link href="/match" className="press inline-flex items-center rounded-full bg-ink px-10 py-4 font-display text-lg font-bold uppercase tracking-wide text-white hover:bg-black sm:px-14">
                Empezar ahora
              </Link>
              <Link href="#herramientas" className="text-sm font-semibold underline underline-offset-4 hover:no-underline">
                Ver qué hace Maru
              </Link>
            </div>
          </div>
        </div>

        {/* Resultados reales, no promesas */}
        <Reveal className="mx-auto mt-16 grid max-w-7xl items-center gap-10 border-t border-ink/10 pt-12 lg:grid-cols-[1fr_1.2fr]">
          <h2 data-reveal className="font-display text-4xl font-bold uppercase leading-[1.05] sm:text-5xl">
            Resultados reales,
            <br />
            no promesas
            <span className="mt-3 block text-base font-normal normal-case text-ink/60">Estudios de terceros sobre postulaciones personalizadas. Fuentes abajo.</span>
          </h2>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties}>
            <ResultsList />
          </div>
        </Reveal>
      </section>

      {/* ---------- Búsquedas reales ---------- */}
      <section aria-labelledby="hub-t" className="mt-20">
        <Reveal>
          <h2 id="hub-t" data-reveal className="font-display text-3xl font-light uppercase sm:text-5xl">
            Accedé a <strong className="font-bold">búsquedas reales</strong>
          </h2>
          <div data-reveal style={{ "--i": 1 } as React.CSSProperties} className="mt-8 grid items-end gap-8 sm:grid-cols-[auto_1fr]">
            <div className="hidden sm:block">
              <WalkingSprite />
            </div>
            <dl className="space-y-3">
              <HubRow label="Búsquedas abiertas hoy" value={`${fmt(data.total)}+`} />
              <HubRow label="Empresas" value={fmt(data.companies)} />
              <HubRow label="Que podés tomar desde Argentina" value={fmt(data.eligible)} />
            </dl>
          </div>
        </Reveal>
      </section>

      {data.latest.length > 0 && (
        <div className="full-bleed relative mt-12 overflow-hidden bg-ink py-5 text-white" aria-label="Búsquedas que acaban de entrar">
          <div className="marquee gap-4">
            {[...data.latest, ...data.latest].map((j, i) => (
              <Link
                key={`${j.id}-${i}`}
                href="/match"
                tabIndex={i >= data.latest.length ? -1 : undefined}
                aria-hidden={i >= data.latest.length || undefined}
                className="flex shrink-0 items-center gap-3 rounded-xl px-3 py-1.5 transition-colors hover:bg-white/10"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white font-display text-lg font-bold text-ink">{j.company.trim()[0]?.toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block text-xs text-white/60">
                    {j.company} · <TimeAgo iso={j.firstSeenAt} />
                    {j.workplace && ` · ${j.workplace}`}
                  </span>
                  <span className="block max-w-[260px] truncate font-semibold">{j.title}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Lo que hace Maru ---------- */}
      <section id="herramientas" aria-labelledby="tools-t" className="mt-24 scroll-mt-24">
        <Reveal>
          <h2 id="tools-t" data-reveal className="flex flex-wrap items-center gap-x-4 font-display text-[2.6rem] font-bold uppercase leading-[1.02] sm:text-7xl">
            Tu coach de carrera
            <span className="flex items-center gap-3">
              con IA
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft sm:h-16 sm:w-16">
                <MaruSprite size={30} frame="wave" />
              </span>
            </span>
          </h2>
        </Reveal>

        <div className="mt-14 space-y-24 sm:space-y-32">
          <Feature
            title="Búsquedas a tu medida"
            body="Cruzamos tu CV con miles de búsquedas abiertas y te mostramos primero las que encajan con vos, con el porqué de cada una, las brechas y lo que falta confirmar."
            cta="Ver mis matches"
            href="/match"
            visual={<MatchMock />}
          />
          <Feature
            flip
            title="Autocompletá en 1 clic"
            body="Con la extensión para Chrome, Maru completa los formularios de postulación por vos: datos, respuestas y tu CV adjunto. Funciona en Greenhouse, Lever y otros formularios web. Vos revisás y enviás."
            cta="Descargar la extensión"
            href={EXTENSION_URL}
            visual={
              <MockPanel>
                <AutofillDemo />
              </MockPanel>
            }
          />
          <Feature
            title="Un CV a medida de cada búsqueda"
            body="Traé el link de la vacante: Maru reescribe tu CV con las palabras que busca el ATS y los logros que importan para ese rol, más una respuesta para cada campo del formulario y tu carta de presentación."
            cta="Personalizar mi postulación"
            href="/postulacion"
            visual={<CvMock />}
          />
          <Feature
            flip
            title="Entrená tu entrevista"
            body="Una entrevista simulada por voz, como en una videollamada. Maru repregunta si tu respuesta queda corta y al final te da un informe con puntaje y respuestas más fuertes."
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
        </div>
      </section>

      <Evidence />

      <Faq />

      {/* ---------- Cierre ---------- */}
      <section className="relative mt-24 overflow-hidden rounded-[36px] bg-sand px-6 py-16 text-center sm:py-20">
        <div className="mx-auto w-fit">
          <MaruSprite size={72} frame="wave" />
        </div>
        <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-light leading-tight sm:text-6xl">
          Dejá que Maru te lleve a <strong className="font-bold">tu próximo trabajo</strong>
        </h2>
        <Link
          href="/match"
          className="press mt-10 inline-flex items-center rounded-full border-2 border-ink bg-neon px-12 py-4 font-display text-xl font-bold uppercase tracking-wide text-ink shadow-[4px_4px_0_#0a0a0a] hover:shadow-[6px_6px_0_#0a0a0a]"
        >
          Empezar ahora
        </Link>
      </section>
    </SiteShell>
  );
}

function HubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 border-b border-ink/15 pb-3">
      <dt className="text-lg text-ink/80">{label}</dt>
      <span aria-hidden className="flex-1" />
      <dd className="font-display text-4xl font-bold tabular-nums sm:text-5xl">{value}</dd>
    </div>
  );
}

function WalkingSprite() {
  return (
    <div className="grid h-24 w-24 place-items-center rounded-3xl bg-sand">
      <MaruSprite size={52} frame="walkA" />
    </div>
  );
}

function Feature({ title, body, cta, href, visual, flip = false }: { title: string; body: string; cta: string; href: string; visual: React.ReactNode; flip?: boolean }) {
  return (
    <Reveal className="grid items-center gap-10 lg:grid-cols-[1fr_1.25fr] [&>*]:min-w-0">
      <div data-reveal className={flip ? "lg:order-2" : ""}>
        <h3 className="font-display text-[2.4rem] font-semibold leading-[1.05] sm:text-5xl">{title}</h3>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-ink/70">{body}</p>
        <Link href={href} className="press mt-7 inline-flex rounded-full bg-ink px-8 py-3 text-lg font-medium text-white hover:bg-black">
          {cta}
        </Link>
      </div>
      <div data-reveal style={{ "--i": 1 } as React.CSSProperties} className={flip ? "lg:order-1" : ""}>
        {visual}
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
        <video
          className="block aspect-video w-full bg-[#f2f4f3]"
          poster="/video/maru-intro-poster.jpg"
          aria-label="Presentación de Maru: estrategia, matches, autocompletado y CV a medida"
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="auto"
        >
          {/* H.264 para Safari y Chrome; VP9 para los navegadores sin H.264. */}
          <source src="/video/maru-intro.mp4" type='video/mp4; codecs="avc1.640020"' />
          <source src="/video/maru-intro.webm" type="video/webm; codecs=vp9" />
        </video>
      </div>
    </div>
  );
}
