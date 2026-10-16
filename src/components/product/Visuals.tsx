import CompanyTile from "@/components/busquedas/CompanyTile";
import { MaruHead } from "@/components/maru/PixelMaru";

/**
 * Maquetas para las landings de producto, con el estilo de jobright: tarjetas blancas flotando.
 * Son ejemplos ilustrativos con empresas y personas ficticias, no datos reales.
 */

const card = "rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] ring-1 ring-black/5";

function Caption({ text = "Ejemplo ilustrativo" }: { text?: string }) {
  return <p className="mt-3 text-center text-xs text-muted">{text}</p>;
}

function ScoreRing({ value, size = 44 }: { value: number; size?: number }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className="stroke-brand-soft" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="stroke-neon" />
      </svg>
      <span className="text-sm font-bold">
        {value}
        <span className="text-[0.6em]">%</span>
      </span>
    </span>
  );
}

/** Tres búsquedas apiladas con su compatibilidad (el hero de "AI Job Matcher"). */
export function JobStackMock() {
  const jobs = [
    { company: "Tucán", title: "Product Manager Sr.", score: 92 },
    { company: "Lumen Pagos", title: "Product Designer", score: 94 },
    { company: "Andes Data", title: "Data Analyst Sr.", score: 96, meta: true },
  ];
  return (
    <figure aria-label="Ejemplo de recomendaciones con su compatibilidad">
      <div className="relative mx-auto h-[390px] max-w-[440px]">
        {jobs.map((j, i) => (
          <div key={j.title} className={`${card} absolute w-[82%] p-4`} style={{ top: i * 112, right: `${i * 7}%`, zIndex: i }}>
            <div className="flex items-start justify-between gap-3">
              <CompanyTile name={j.company} size={44} />
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase">
                Match fuerte <ScoreRing value={j.score} />
              </span>
            </div>
            <p className="mt-2 font-semibold">{j.title}</p>
            <p className="text-xs text-muted">{j.company}</p>
            {j.meta && (
              <p className="mt-2 flex gap-4 text-xs">
                <span>📍 Buenos Aires</span>
                <span>🏢 Híbrido</span>
                <span>✓ Desde Argentina</span>
              </p>
            )}
          </div>
        ))}
      </div>
      <Caption />
    </figure>
  );
}

/** Carta con frases resaltadas y chips (el hero de "Cover Letter Generator"). */
export function LetterMock() {
  return (
    <figure>
      <div className="relative mx-auto max-w-[440px]">
        <div className={`${card} p-6 text-[12px] leading-relaxed text-ink/70`}>
          <p className="text-lg font-bold text-ink">Hola, equipo de Tucán:</p>
          <p className="mt-3">
            Me postulo a la búsqueda de <mark className="rounded bg-brand-soft px-0.5 font-semibold text-ink">Product Manager Sr.</mark> porque hace{" "}
            <mark className="rounded bg-brand-soft px-0.5 font-semibold text-ink">7 años</mark> construyo productos de pagos que usan millones de personas en LATAM.
          </p>
          <p className="mt-3">
            En Ualá <mark className="rounded bg-brand-soft px-0.5 font-semibold text-ink">lideré el rediseño del checkout</mark> y bajamos 32% los errores de pago…
          </p>
          <div className="mt-4 space-y-2">
            <div className="h-2 w-11/12 rounded bg-line" />
            <div className="h-2 w-4/5 rounded bg-line" />
            <div className="h-2 w-2/3 rounded bg-line" />
          </div>
        </div>
        <div className="absolute -bottom-5 -right-2 flex flex-col items-end gap-1.5 sm:-right-6">
          {["A medida de la búsqueda", "Tus logros, destacados", "PDF o Word"].map((t) => (
            <span key={t} className="rounded-full bg-neon px-3 py-1.5 text-xs font-semibold text-ink shadow-md">
              ✦ {t}
            </span>
          ))}
        </div>
      </div>
      <div className="h-6" />
      <Caption />
    </figure>
  );
}

/** Respuestas sugeridas para los campos del formulario. */
export function FormMock() {
  const rows = [
    ["¿Por qué querés trabajar en Tucán?", "Porque construyen pagos para pymes, el problema que vengo resolviendo hace 7 años…", true],
    ["Años de experiencia en producto", "7", false],
    ["LinkedIn", "linkedin.com/in/anaperez", false],
  ] as const;
  return (
    <figure>
      <div className={`${card} mx-auto max-w-[440px] p-5`}>
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-neon">
            <MaruHead size={16} />
          </span>
          Respuestas para el formulario
        </p>
        <div className="mt-4 space-y-3">
          {rows.map(([q, a, ai]) => (
            <div key={q}>
              <p className="text-[11px] font-medium text-muted">{q}</p>
              <p className={`mt-1 rounded-lg px-3 py-2 text-[12px] ring-2 ${ai ? "bg-honey/10 ring-honey/60" : "bg-brand-soft/60 ring-brand/50"}`}>{a}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 flex gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" /> De tu CV
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-honey" /> Redactado: revisalo
          </span>
        </p>
      </div>
      <Caption />
    </figure>
  );
}

/** Preferencias + búsquedas filtradas (el "Your Preference" de jobright). */
export function PrefsMock() {
  return (
    <figure>
      <div className="mx-auto max-w-[440px] space-y-2">
        <div className={`${card} p-4`}>
          <p className="font-semibold">Tus condiciones</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {["Remoto o híbrido", "Desde Argentina", "Senior", "Español o inglés"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-neon text-[9px] font-bold">✓</span>
                {t}
              </span>
            ))}
          </div>
        </div>
        {[
          ["Andes Data", "Data Quality Analyst", "hace 20 min"],
          ["Lumen Pagos", "Business Intelligence Analyst", "hace 30 min"],
        ].map(([c, t, ago]) => (
          <div key={t} className={`${card} flex items-center gap-3 p-4`}>
            <CompanyTile name={c} size={44} />
            <div>
              <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold">{ago}</span>
              <p className="mt-1 text-sm font-semibold">{t}</p>
              <p className="text-xs text-muted">{c}</p>
            </div>
          </div>
        ))}
        <div className={`${card} flex items-center gap-3 p-4 opacity-60`}>
          <span className="h-11 w-11 rounded-[10px] bg-line" />
          <div className="flex-1 space-y-2">
            <div className="h-2.5 w-1/2 rounded bg-line" />
            <div className="h-2.5 w-1/4 rounded bg-line" />
          </div>
        </div>
      </div>
      <Caption />
    </figure>
  );
}

/** Informe con puntaje (entrevista y video). */
export function ReportMock() {
  return (
    <figure>
      <div className={`${card} mx-auto max-w-[440px] p-5`}>
        <div className="flex items-center gap-4">
          <ScoreRing value={82} size={72} />
          <div>
            <p className="text-lg font-bold leading-tight">Muy cerca de estar lista</p>
            <p className="text-xs text-muted">Informe de tu práctica</p>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold">Fortalezas</p>
        <ul className="mt-1 space-y-1 text-xs">
          <li>✓ Ejemplos concretos con números</li>
          <li>✓ Buen ritmo y respuestas claras</li>
        </ul>
        <p className="mt-3 text-sm font-semibold">Para mejorar</p>
        <p className="mt-1 rounded-lg bg-honey/10 px-3 py-2 text-xs">Cerrá cada respuesta con el resultado: qué cambió gracias a vos.</p>
        <p className="mt-3 text-sm font-semibold">Respuesta más fuerte (STAR)</p>
        <div className="mt-1 space-y-1.5">
          <div className="h-2 w-full rounded bg-line" />
          <div className="h-2 w-5/6 rounded bg-line" />
        </div>
      </div>
      <Caption />
    </figure>
  );
}

/** CV con la revisión de ATS (puntaje, palabras clave cubiertas y faltantes). */
export function AtsMock() {
  return (
    <figure>
      <div className="relative mx-auto max-w-[440px]">
        <div className={`${card} p-5`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-lg font-bold">Ana Pérez</p>
              <p className="text-xs text-muted">Product Manager Sr. · Buenos Aires</p>
            </div>
            <div className="text-center">
              <ScoreRing value={91} size={64} />
              <p className="mt-1 text-[10px] font-bold uppercase">ATS</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide">Resumen</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Product Manager con 7 años en <mark className="rounded bg-brand-soft px-0.5 text-ink">fintech B2B</mark>, liderando equipos de 8+ personas.
          </p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide">Palabras clave</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
            {["roadmap", "discovery", "SQL", "A/B testing"].map((k) => (
              <span key={k} className="rounded-md bg-brand-soft px-2 py-0.5 font-semibold">
                ✓ {k}
              </span>
            ))}
            <span className="rounded-md bg-honey/15 px-2 py-0.5 font-semibold">+ OKRs</span>
          </div>
        </div>
        <div className="absolute -bottom-5 -right-2 flex flex-col items-end gap-1.5 sm:-right-6">
          {["Resumen alineado al rol", "Palabras clave del ATS", "Logros con impacto"].map((t) => (
            <span key={t} className="rounded-full bg-neon px-3 py-1.5 text-xs font-semibold shadow-md">
              ✦ {t}
            </span>
          ))}
        </div>
      </div>
      <div className="h-6" />
      <Caption />
    </figure>
  );
}
