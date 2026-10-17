import Link from "next/link";
import AutofillDemo from "@/components/landing/AutofillDemo";
import { ChatMock, CvMock, MatchMock, TrackerMock, VideoMock } from "@/components/landing/Mocks";
import { PRODUCTS, type ProductId, type Stat, type VisualId } from "@/lib/products";
import { AtsMock, FormMock, JobStackMock, LetterMock, PrefsMock, ReportMock } from "./Visuals";

/**
 * Las landings de producto de jobright (AI Job Matcher, Cover Letter Generator, Job Tracker…):
 * hero con laureles y botón neón, banda de números con gradiente y, debajo de la herramienta,
 * bloques grises redondeados con "por qué", "cómo funciona", "más razones" y preguntas.
 * En Maru la herramienta vive en la misma página: el botón del hero baja hasta #empezar.
 */

function Visual({ id }: { id: VisualId }) {
  switch (id) {
    case "tracker": return <TrackerMock bare />;
    case "jobs":
      return <JobStackMock />;
    case "match":
      return <MatchMock bare />;
    case "cv":
      return <CvMock bare />;
    case "carta":
      return <LetterMock />;
    case "chat":
      return <ChatMock bare />;
    case "video":
      return <VideoMock bare />;
    case "autofill":
      return (
        <div className="px-2 py-4">
          <AutofillDemo />
        </div>
      );
    case "form":
      return <FormMock />;
    case "prefs":
      return <PrefsMock />;
    case "report":
      return <ReportMock />;
    case "ats":
      return <AtsMock />;
  }
}

function Arrow() {
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-ink" aria-hidden>
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </span>
  );
}

/** Botón negro con flechita en un círculo blanco (el de las secciones de jobright). */
export function BlackCta({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = "press inline-flex h-14 items-center gap-3 rounded-full bg-ink pl-6 pr-4 text-lg font-medium text-white hover:bg-black sm:text-xl";
  return href.startsWith("/") && !href.endsWith(".zip") ? (
    <Link href={href} className={cls}>
      {children}
      <Arrow />
    </Link>
  ) : (
    <a href={href} className={cls} {...(href.endsWith(".zip") ? { download: true } : {})}>
      {children}
      <Arrow />
    </a>
  );
}

/** Bloque redondeado de lado a lado con margen, como los de jobright (sin redondear arriba a la izquierda). */
function Block({ tone = "grey", id, children, className = "" }: { tone?: "grey" | "neon" | "gradient"; id?: string; children: React.ReactNode; className?: string }) {
  const bg = tone === "neon" ? "bg-neon" : tone === "gradient" ? "bg-[linear-gradient(266deg,#b5ffe4,#d2ffc8)]" : "bg-[#f2f4f5]";
  return (
    <section id={id} className={`full-bleed mt-6 scroll-mt-24 px-3 sm:px-6 lg:px-12 ${className}`}>
      <div className={`rounded-[0_40px_40px_40px] px-5 py-12 sm:rounded-[0_80px_80px_80px] sm:px-10 sm:py-16 lg:px-[72px] lg:py-[72px] ${bg}`}>
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </div>
    </section>
  );
}

const H2 = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2 className={`text-[2rem] font-bold uppercase leading-[1.15] sm:text-[44px] lg:text-[48px] lg:leading-[60px] ${className}`}>{children}</h2>
);

function StatsBand({ stats }: { stats: Stat[] }) {
  if (!stats.length) return null;
  return (
    <Block tone="gradient" className="!mt-0">
      <dl className="grid gap-8 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="border-l-2 border-ink pl-6">
            <dt className="sr-only">{s.label}</dt>
            <dd className="text-[2.4rem] font-bold leading-none sm:text-[48px]">{s.value}</dd>
            <dd className="mt-2 text-lg leading-snug">{s.label}</dd>
            {s.source && <dd className="mt-1 text-xs text-ink/60">Fuente: {s.source}</dd>}
          </div>
        ))}
      </dl>
    </Block>
  );
}

export function ProductHero({ id, stats, ctaHref = "#empezar" }: { id: ProductId; stats?: Stat[]; ctaHref?: string }) {
  const p = PRODUCTS[id];
  const strong = <span className="block text-[2.3rem] font-extrabold leading-[1.1] sm:text-[52px] sm:leading-[60px]">{p.strong}</span>;
  const light = <span className="block text-[1.9rem] font-normal leading-[1.15] sm:text-[44px] sm:leading-[52px]">{p.light}</span>;
  return (
    <>
      <section className="full-bleed -mt-8 bg-[radial-gradient(ellipse_at_78%_35%,rgba(181,255,228,0.45),transparent_55%),linear-gradient(180deg,#fafbfb,#fff)] px-5 pb-16 pt-10 sm:pt-14">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-16">
          <div className="animate-rise text-center lg:text-left">
            <p className="text-sm font-semibold text-brand-dark">Con tu experiencia real · Vos revisás el resultado</p>
            <h1 className="mt-6 uppercase">
              {p.strongFirst ? (
                <>
                  {strong}
                  {light}
                </>
              ) : (
                <>
                  {light}
                  {strong}
                </>
              )}
            </h1>
            <p className="mx-auto mt-4 max-w-[520px] text-base leading-relaxed text-ink/80 lg:mx-0">{p.desc}</p>
            <a
              href={ctaHref}
              {...(ctaHref.endsWith(".zip") ? { download: true } : {})}
              className="press mt-7 inline-flex h-14 items-center rounded-full bg-neon px-8 text-lg font-medium text-ink hover:shadow-[0_10px_30px_-10px_rgba(0,240,160,0.9)] sm:text-xl"
            >
              {p.cta}
            </a>
            <p className="mt-3 text-sm text-ink/65">Empezá con el plan gratis. <Link href="/precios" className="underline underline-offset-4">Ver funciones y límites</Link></p>
          </div>
          <div className="animate-rise min-w-0 [animation-delay:150ms]">
            <Visual id={p.hero} />
          </div>
        </div>
      </section>
      <StatsBand stats={stats ?? p.stats} />
    </>
  );
}

/** Encabezado del bloque de la herramienta: lo que en jobright sería "empezá" después del registro. */
export function ToolHeading({ title = "Empezá ahora", hint }: { title?: string; hint?: string }) {
  return (
    <div id="empezar" className="scroll-mt-24 pt-14 text-center sm:pt-20">
      <H2>{title}</H2>
      {hint && <p className="mx-auto mt-3 max-w-xl text-ink/70">{hint}</p>}
    </div>
  );
}

export function ProductMore({ id, ctaHref = "#empezar" }: { id: ProductId; ctaHref?: string }) {
  const p = PRODUCTS[id];
  return (
    <div className="mt-20">
      {/* Por qué */}
      <Block>
        <H2 className="max-w-[560px]">{p.why.title}</H2>
        <div className="mt-12 space-y-16 sm:space-y-24">
          {p.why.rows.map((r, i) => (
            <div key={r.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <h3 className="text-[1.75rem] font-semibold leading-tight sm:text-[40px] sm:leading-[48px]">{r.title}</h3>
                <ul className="mt-5 space-y-2.5 text-[15px] leading-relaxed sm:text-base">
                  {r.bullets.map(([lead, text]) => (
                    <li key={lead} className="flex gap-2">
                      <span aria-hidden>•</span>
                      <span>
                        <strong className="font-semibold">{lead}</strong> {text}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7">
                  <BlackCta href={ctaHref}>{r.cta}</BlackCta>
                </div>
              </div>
              <div className={`min-w-0 ${i % 2 ? "lg:order-1" : ""}`}>
                <Visual id={r.visual} />
              </div>
            </div>
          ))}
        </div>
      </Block>

      {/* Cómo funciona */}
      <Block>
        <span className="inline-flex rounded-full bg-[#b5ffe4] px-3 py-1.5 text-sm font-semibold">{p.how.tag}</span>
        <H2 className="mt-5 max-w-[720px]">{p.how.title}</H2>
        <p className="mt-5 max-w-3xl leading-relaxed text-ink/80">{p.how.text}</p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {p.how.steps.map(([title, text], i) => (
            <li key={title} className="flex flex-col rounded-[24px] bg-white p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-neon font-bold">{i + 1}</span>
              <h3 className="mt-4 text-lg font-semibold leading-snug">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{text}</p>
              <span aria-hidden className="mt-auto flex items-center pt-6">
                <span className={`h-2 w-2 rounded-full ${i === 0 ? "bg-ink" : "bg-transparent"}`} />
                <span className="h-px flex-1 bg-ink" />
                <span className={i === p.how.steps.length - 1 ? "h-2 w-2 rounded-full bg-ink" : "border-y-[5px] border-l-[8px] border-y-transparent border-l-ink"} />
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <BlackCta href={ctaHref}>{p.cta}</BlackCta>
        </div>
      </Block>

      {/* Evidencia, en el bloque neón donde jobright pone los testimonios */}
      {p.evidence && (
        <Block tone="neon">
          <div className="grid gap-10 lg:grid-cols-[1fr_720px]">
            <H2>{p.evidence.title}</H2>
            <div className="space-y-4">
              {p.evidence.quotes.map((q, i) => (
                <figure key={q.text} className={`rounded-[24px_0_24px_24px] bg-white p-6 ${i % 2 ? "lg:ml-16" : "lg:mr-8"}`}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                    <path d="M3 18 7 6h4l-3 12zm9 0 4-12h4l-3 12z" fill="currentColor" />
                  </svg>
                  <blockquote className="mt-2 leading-relaxed">{q.text}</blockquote>
                  <figcaption className="mt-3 text-sm font-semibold">{q.source}</figcaption>
                </figure>
              ))}
              <p className="text-xs text-ink/70">Estudios de terceros sobre postulaciones en general, no resultados medidos de Maru.</p>
            </div>
          </div>
        </Block>
      )}

      {/* Más razones */}
      <Block>
        <H2>Más razones para usar Maru</H2>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {p.reasons.map((r) => (
            <li key={r} className="flex min-h-20 items-center justify-between gap-4 rounded-[24px] bg-white px-6 py-5 text-lg font-medium sm:min-h-24 sm:text-xl">
              {r}
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-neon" aria-hidden>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m3.5 8.5 3 3 6-7" />
                </svg>
              </span>
            </li>
          ))}
        </ul>
      </Block>

      {/* Preguntas */}
      <Block>
        <div className="grid gap-10 lg:grid-cols-[1fr_720px]">
          <H2>
            Preguntas
            <br />
            frecuentes
          </H2>
          <div className="space-y-4">
            {p.faq.map(([q, a], i) => (
              <details key={q} open={i === 0} className="group rounded-[24px] bg-white">
                <summary className="flex min-h-[88px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="shrink-0 transition-transform group-open:rotate-180">
                    <circle cx="12" cy="12" r="10.5" />
                    <path d="m8 10.5 4 4 4-4" />
                  </svg>
                </summary>
                <p className="-mt-2 px-6 pb-6 leading-relaxed text-ink/75">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Block>

      {/* Cierre con gradiente */}
      <Block tone="gradient">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <p className="text-[2rem] font-light leading-tight sm:text-[44px]">
            <strong className="font-bold">Prepará con Maru</strong>
            <br />tu próxima postulación
          </p>
          <BlackCta href={ctaHref}>{p.cta}</BlackCta>
        </div>
      </Block>
    </div>
  );
}
