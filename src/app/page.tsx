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
      <section aria-labelledby="inicio-t" className="full-bleed -mt-8 rounded-br-[64px] bg-sand px-5 py-10 sm:py-14 lg:rounded-br-[100px]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 lg:grid-cols-2 lg:gap-12 [&>*]:min-w-0">
          <div>
            <p className="text-sm font-semibold text-brand-dark">Tu coach de carrera con IA</p>
            <h1 id="inicio-t" className="mt-3 font-display text-[2.8rem] font-bold leading-[1.05] sm:text-6xl xl:text-[72px]">
              Buscá trabajo<br />con Maru.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-ink/80 sm:text-lg">
              Encontrá avisos para tu perfil y prepará cada postulación con tu experiencia real: desde el CV hasta la entrevista.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/match" className="press inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 font-semibold text-white hover:bg-black">
                Encontrar mis matches
              </Link>
              <Link href="/busquedas" className="press inline-flex min-h-12 items-center justify-center rounded-full border border-ink/20 bg-white px-6 font-semibold hover:border-ink">
                Explorar búsquedas
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink/70">Empezá gratis, sin tarjeta. <Link href="/precios" className="font-medium underline underline-offset-4">Ver planes y límites</Link></p>
          </div>
          <div>
            <div className="overflow-hidden rounded-2xl border-2 border-ink bg-white">
              <div aria-hidden className="flex gap-1.5 border-b-2 border-ink px-4 py-2.5">
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-ink" />)}
              </div>
              <HeroVideoPlayer />
            </div>
            <p className="mt-3 text-center text-xs text-ink/65">Demo ilustrativa. Las cifras actuales del catálogo están debajo.</p>
          </div>
        </div>
        <dl className="mx-auto mt-10 grid max-w-[1200px] gap-6 border-t border-ink/15 pt-7 sm:grid-cols-3 sm:gap-8">
          <div>
            <dt className="text-sm text-ink/70">Avisos para buscar desde Argentina</dt>
            <dd className="mt-1 font-display text-3xl font-bold tabular-nums">{fmt(data.eligible)}</dd>
            <p className="mt-1 text-xs text-ink/65">Según el alcance geográfico de cada publicación.</p>
          </div>
          <div>
            <dt className="text-sm text-ink/70">Avisos abiertos en el catálogo</dt>
            <dd className="mt-1 font-display text-3xl font-bold tabular-nums">{fmt(data.total)}</dd>
            <p className="mt-1 text-xs text-ink/65">Incluye búsquedas con restricciones de país.</p>
          </div>
          <div>
            <dt className="text-sm text-ink/70">En cada postulación</dt>
            <dd className="mt-1 font-display text-2xl font-semibold">Vos revisás y enviás</dd>
            <p className="mt-1 text-xs text-ink/65">Maru prepara los materiales. Vos decidís qué compartir.</p>
          </div>
        </dl>
      </section>

      <section aria-labelledby="hub-t" className="mt-14 sm:mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="hub-t" className="font-display text-3xl font-bold sm:text-4xl">Explorá las búsquedas</h2>
            <p className="mt-2 text-ink/70">Podés empezar por un puesto o una empresa, sin subir tu CV.</p>
          </div>
          <Link href="/busquedas" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Ver todas las búsquedas →</Link>
        </div>
        <div className="mt-6"><JobSearchBar /></div>
        {data.latest.length > 0 && (
          <div className="mt-7">
            <h3 className="text-sm font-semibold text-ink/70">Incorporadas al catálogo recientemente</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.latest.slice(0, 6).map((j) => (
                <li key={j.id}>
                  <Link href={`/busquedas/${j.id}`} className="flex h-full min-h-32 gap-3 rounded-2xl border border-line p-4 transition-colors hover:border-ink/40 hover:bg-sand/40">
                    <CompanyTile name={displayCompany(j.company)} />
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug">{j.title}</p>
                      <p className="mt-1 text-sm text-ink/70">{displayCompany(j.company)}</p>
                      <p className="mt-2 text-xs text-muted">{j.workplace || "Modalidad por confirmar"} · En Maru <TimeAgo iso={j.firstSeenAt} /></p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section id="como-funciona" aria-labelledby="pasos-t" className="mt-16 scroll-mt-24 rounded-3xl bg-ink p-6 text-white sm:mt-20 sm:p-9">
        <h2 id="pasos-t" className="font-display text-3xl font-bold sm:text-4xl">De tu experiencia a la próxima postulación</h2>
        <ol className="mt-7 grid gap-7 md:grid-cols-3">
          {[
            ["Cargá tu experiencia", "Subí tu CV o pegá tu trayectoria. Maru arma un perfil que podés corregir y reutilizar."],
            ["Elegí una búsqueda", "Compará los matches o traé un aviso que encontraste por tu cuenta. Vas a ver qué encaja y qué falta confirmar."],
            ["Prepará y revisá", "Adaptá los materiales al puesto y practicá antes de enviar. Confirmá los datos y las respuestas que te representan."],
          ].map(([title, body], i) => <li key={title}>
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-neon text-sm font-bold text-ink">{i + 1}</span>
            <h3 className="mt-3 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/75">{body}</p>
          </li>)}
        </ol>
      </section>

      <section id="herramientas" aria-labelledby="tools-t" className="mt-16 scroll-mt-24 sm:mt-20">
        <div className="flex items-center gap-3">
          <h2 id="tools-t" className="font-display text-3xl font-bold sm:text-4xl">Elegí qué necesitás preparar</h2>
          <MaruSprite size={44} frame="wave" className="hidden shrink-0 sm:block" />
        </div>
        <p className="mt-3 max-w-2xl text-ink/70">Usá cada herramienta por separado o seguí el recorrido completo con una búsqueda.</p>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Feature title="Búsquedas a tu medida" body="Compará tu perfil con el catálogo. Cada match muestra la afinidad, los motivos y los requisitos que faltan confirmar." cta="Ver mis matches" href="/match" visual={<MatchMock bare />} />
          <Feature title="Una postulación para cada aviso" body="Traé una vacante y prepará el CV y las respuestas del formulario con los datos de tu perfil." cta="Preparar una postulación" href="/postulacion" visual={<CvMock bare />} />
          <Feature title="Practicá tu entrevista" body="Respondé por voz o por escrito. Maru hace repreguntas y al final te muestra qué funcionó y qué podés mejorar." cta="Practicar una entrevista" href="/entrevista" visual={<ChatMock bare />} />
          <Feature title="Grabá tu presentación" body="Armá un guion con tu experiencia y leelo en el teleprompter mientras grabás. El feedback de cámara está incluido en los planes pagos." cta="Preparar mi video" href="/video" visual={<VideoMock bare />} />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Tu CV general", body: "Ordená tu trayectoria para el tipo de rol que buscás, aunque todavía no tengas un aviso.", href: "/cv", cta: "Armar mi CV" },
            { title: "Carta de presentación", body: "Contá por qué te interesa la empresa con ejemplos de tu experiencia y el tono que elijas.", href: "/carta", cta: "Escribir mi carta" },
            { title: "Seguimiento", body: "Guardá búsquedas y registrá cada avance. Al ingresar, el tablero también se sincroniza con tu cuenta.", href: "/seguimiento", cta: "Ver mi tablero" },
            { title: "Extensión para Chrome", body: "Completá campos en Greenhouse, Lever y formularios compatibles. Revisá las respuestas antes de enviar.", href: EXTENSION_URL, cta: "Ver la extensión" },
          ].map((tool) => <article key={tool.href} className="flex flex-col rounded-2xl bg-sand p-5">
            <h3 className="font-display text-xl font-semibold">{tool.title}</h3>
            <p className="mb-5 mt-2 text-sm leading-relaxed text-ink/75">{tool.body}</p>
            <Link href={tool.href} className="mt-auto inline-flex min-h-11 items-center font-semibold underline underline-offset-4">{tool.cta} →</Link>
          </article>)}
        </div>
      </section>

      <Faq>
        <div className="mt-12 sm:mt-16"><CtaScene /></div>
        <div className="mx-auto max-w-[1200px] pb-16 pt-12">
          <h2 className="text-center font-display text-2xl font-semibold">Explorá por área o experiencia</h2>
          <div className="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2.5">
            {POPULAR.map((p) => <Link key={p.href} href={p.href} className="press inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-white px-4 py-2 text-sm font-medium hover:border-ink">{p.label}</Link>)}
          </div>
        </div>
      </Faq>
    </SiteShell>
  );
}

function Feature({ title, body, cta, href, visual }: { title: string; body: string; cta: string; href: string; visual: React.ReactNode }) {
  return <article className="flex min-w-0 flex-col overflow-hidden rounded-3xl border border-line bg-white p-5 sm:p-7">
    <h3 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h3>
    <p className="mt-3 text-sm leading-relaxed text-ink/75 sm:text-base">{body}</p>
    <div className="my-5 grid flex-1 items-center rounded-2xl bg-sand px-3 py-4 sm:px-5">{visual}</div>
    <Link href={href} className="press inline-flex min-h-12 items-center justify-center self-start rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-black">{cta}</Link>
  </article>;
}
