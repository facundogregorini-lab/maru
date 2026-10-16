import { MaruHead } from "@/components/maru/PixelMaru";
import { FRONTS, HERO_STATS, SOURCES, type Stat } from "@/lib/evidence";
import HowCarousel from "./HowCarousel";

/**
 * La evidencia con la forma de la sección de testimonios de jobright: tarjetas que corren con
 * comillas y "autor" (acá, el estudio que lo midió), y abajo la tarjeta negra con Maru.
 * No hay testimonios inventados: cada tarjeta es un dato con su fuente.
 */

const CARDS: Stat[] = [...new Map([...FRONTS.flatMap((f) => f.stats), ...HERO_STATS].map((s) => [s.value + s.label, s])).values()];

function Quote({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden className={className}>
      <path d="M3 18 7 6h4l-3 12zm9 0 4-12h4l-3 12z" fill="currentColor" />
    </svg>
  );
}

function source(id: number) {
  const s = SOURCES.find((x) => x.id === id);
  const [org, ref = ""] = (s?.name ?? "").split(" · ");
  return { org, ref };
}

function Card({ s, hidden }: { s: Stat; hidden?: boolean }) {
  const { org, ref } = source(s.source);
  return (
    <figure aria-hidden={hidden || undefined} className="flex h-[328px] w-[300px] shrink-0 flex-col rounded-[32px] border border-ink/40 bg-white p-6 sm:w-[348px]">
      <Quote />
      <blockquote className="mt-3 flex-1 text-lg leading-snug">
        <span className="font-display text-[2.6rem] font-bold leading-none">{s.value}</span>
        <span className="mt-2 block">
          {s.label} {s.note}.
        </span>
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-xl font-bold">{org[0]}</span>
        <span className="min-w-0 text-sm leading-tight">
          <a href={`#fuente-${s.source}`} tabIndex={hidden ? -1 : undefined} className="block truncate font-semibold hover:underline">
            {org}
          </a>
          <span className="block truncate text-ink/70">{ref}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Corazón en pixel art (el de jobright es rosa y cuadriculado). */
function PixelHeart() {
  const rows = ["01100110", "11111111", "11111111", "11111111", "01111110", "00111100", "00011000"];
  return (
    <svg viewBox="0 0 8 7" width="128" height="112" aria-hidden className="rotate-12">
      {rows.flatMap((r, y) =>
        [...r].map((c, x) => (c === "1" ? <rect key={`${x}-${y}`} x={x + 0.06} y={y + 0.06} width="0.88" height="0.88" rx="0.08" fill="#fbd3ea" stroke="#f29ccc" strokeWidth="0.06" /> : null)),
      )}
    </svg>
  );
}

export default function EvidenceWall() {
  return (
    <section id="evidencia" aria-labelledby="evidencia-t" className="mt-28 scroll-mt-24 sm:mt-36">
      <div className="relative">
        <h2 id="evidencia-t" className="text-center font-display uppercase leading-[1]">
          <span className="block text-5xl font-bold sm:text-[64px]">Personalizar</span>
          <span className="block text-[2.1rem] font-normal sm:text-[64px]">
            cambia los <strong className="font-bold">resultados</strong>
          </span>
        </h2>
        <div className="absolute -top-8 right-0 hidden lg:block">
          <PixelHeart />
        </div>
      </div>

      <div className="full-bleed mt-12 overflow-hidden" aria-label="Datos de estudios sobre postulaciones">
        <div className="marquee gap-4 [animation-duration:80s]">
          {[...CARDS, ...CARDS].map((s, i) => (
            <Card key={`${s.value}-${s.label}-${i}`} s={s} hidden={i >= CARDS.length} />
          ))}
        </div>
      </div>

      <HowCarousel
        slides={FRONTS.map((f) => ({ kicker: f.kicker, title: f.title, how: f.how }))}
        avatar={
          <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-neon">
            <MaruHead size={44} />
          </span>
        }
      />

      <div id="fuentes" className="mx-auto mt-10 max-w-[1200px] scroll-mt-24">
        <h3 className="text-sm font-semibold">Fuentes</h3>
        <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          {SOURCES.map((s) => (
            <li key={s.id} id={`fuente-${s.id}`} className="flex scroll-mt-24 gap-2">
              <span className="font-semibold text-ink">{s.id}.</span>
              <span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                  {s.name}
                </a>
                . {s.detail}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Son estudios de terceros sobre postulaciones en general, no resultados medidos de Maru. Cada búsqueda es distinta: Maru mejora tus chances, no garantiza un resultado.
        </p>
      </div>
    </section>
  );
}
