import NumberTicker from "@/components/magic/NumberTicker";
import { HERO_STATS } from "@/lib/evidence";

function Ref({ n }: { n: number }) {
  return (
    <a href={`#fuente-${n}`} className="ml-0.5 align-super text-[0.65em] font-semibold text-brand no-underline hover:underline" aria-label={`Fuente ${n}`}>
      {n}
    </a>
  );
}

const ICONS = [
  // entrevistas: globo de diálogo
  <path key="a" d="M5 6h14v9H9l-4 3z" />,
  // llamados: teléfono
  <path key="b" d="M7 4h3l1.5 4-2 1.5a10 10 0 0 0 5 5L16 12.5l4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2z" />,
  // contrataciones: check
  <path key="c" d="m5 12.5 4.5 4.5L19 7.5" />,
  // lectura: reloj
  <>
    <circle key="d1" cx="12" cy="12" r="8" />
    <path key="d2" d="M12 8v4l3 2" />
  </>,
];

/** "Resultados reales, no promesas": las 4 métricas con línea punteada e ícono, como en jobright. */
export function ResultsList() {
  return (
    <dl className="space-y-5">
      {HERO_STATS.map((s, i) => (
        <div key={s.value + s.label} className="flex items-end gap-4">
          <div className="min-w-0 shrink-0">
            <dd className="font-display text-4xl font-bold leading-none sm:text-[2.75rem]">
              <NumberTicker value={s.value} />
            </dd>
            <dt className="mt-1 text-sm text-ink/70">
              {s.label}
              <Ref n={s.source} />
            </dt>
          </div>
          <span aria-hidden className="leader" />
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {ICONS[i % ICONS.length]}
            </svg>
          </span>
        </div>
      ))}
    </dl>
  );
}
