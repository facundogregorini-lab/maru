import { MaruHead } from "@/components/maru/PixelMaru";

/**
 * Maquetas ilustrativas del producto para la home, al estilo jobright: tarjetas blancas
 * sobre un panel verde menta. Son ejemplos, no datos de una persona real.
 */

export function MockPanel({ children, caption, bare = false }: { children: React.ReactNode; caption?: string; bare?: boolean }) {
  // bare: sin el panel menta, para usarla sobre otro fondo (las landings de producto).
  if (bare)
    return (
      <figure className="relative">
        <div className="relative px-2 py-6">{children}</div>
        {caption && <figcaption className="mt-2 text-center text-xs text-muted">{caption}</figcaption>}
      </figure>
    );
  return (
    <figure className="relative">
      {/* Como en jobright: panel menta de 24 px de radio y proporción 4:3 (768 × 576). */}
      <div className="relative grid grid-cols-[minmax(0,1fr)] place-items-center overflow-hidden rounded-[24px] bg-sand px-5 py-10 sm:aspect-[4/3] sm:px-10 sm:py-12">
        <div className="w-full">{children}</div>
      </div>
      {caption && <figcaption className="mt-2 text-center text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}

function Ring({ value, size = 64, stroke = 6, label, big = false }: { value: number; size?: number; stroke?: number; label?: string; big?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-brand-soft" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            style={{ "--full": c, "--to": c * (1 - value / 100) } as React.CSSProperties}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="ring-fill stroke-brand"
          />
        </svg>
        <p className={`absolute inset-0 flex items-center justify-center font-display font-bold ${big ? "text-2xl" : "text-base"}`}>
          {value}
          <span className="text-[0.55em]">%</span>
        </p>
      </div>
      {label && <p className="mt-1 text-[11px] font-medium text-muted">{label}</p>}
    </div>
  );
}

/** Match: la búsqueda número 1 con su puntaje y el porqué. */
export function MatchMock({ bare = false }: { bare?: boolean }) {
  return (
    <MockPanel bare={bare} caption="Ejemplo ilustrativo de una recomendación">
      {/* Tarjetas de atrás inclinadas, como en jobright: una menta y una verde. */}
      <div aria-hidden className="absolute inset-x-[12%] bottom-[6%] top-[10%] -rotate-[6deg] rounded-[24px] bg-panel-back" />
      <div aria-hidden className="absolute inset-x-[16%] bottom-[4%] top-[30%] rotate-[3deg] rounded-[24px] bg-forest" />
      <div className="animate-float relative mx-auto max-w-[420px] rounded-[24px] bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="absolute -right-5 -top-8 grid h-24 w-24 place-items-center rounded-full bg-forest text-center text-white sm:h-28 sm:w-28">
          <p className="font-display text-[36px] font-bold leading-none sm:text-[44px]">
            92<span className="text-base">%</span>
          </p>
          <p className="-mt-2 text-sm">General</p>
        </div>
        <div className="flex items-center gap-3 pr-16">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-ink font-display text-xl font-bold text-white">T</span>
          <div className="min-w-0">
            <span className="rounded-[6px] bg-neon/10 px-1.5 py-0.5 text-xs">hace 1 h</span>
            <p className="mt-1 text-lg font-semibold leading-6">Product Manager Sr.</p>
            <p className="text-sm text-muted">Tucán · Buenos Aires</p>
          </div>
        </div>
        <hr className="my-4 border-surface" />
        <div className="flex justify-around">
          <Ring value={95} label="Experiencia" />
          <Ring value={90} label="Skills" />
          <Ring value={88} label="Seniority" />
        </div>
        <hr className="my-4 border-surface" />
        <p className="text-base font-medium">Por qué encajás</p>
        <div className="mt-3 flex flex-col items-start gap-2 text-sm">
          <span className="rounded-[6px] bg-forest px-3 py-1.5 font-medium text-white">✓ Seniority</span>
          <span className="rounded-[6px] bg-forest px-3 py-1.5 font-medium text-white">✓ Contrata desde Argentina</span>
          <span className="rounded-[6px] border border-forest px-3 py-1.5 font-medium text-forest">✕ Inglés avanzado</span>
        </div>
      </div>
    </MockPanel>
  );
}

/** CV a medida: papel con mejoras resaltadas. */
export function CvMock({ bare = false }: { bare?: boolean }) {
  return (
    <MockPanel bare={bare} caption="Ejemplo ilustrativo">
      <div className="relative mx-auto max-w-md">
        <div className="rounded-2xl bg-white p-5 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-bold">Ana Pérez</p>
              <p className="text-xs text-muted">Senior Frontend Engineer · Buenos Aires</p>
            </div>
            <div className="text-right">
              <p className="font-display text-3xl font-bold leading-none text-brand">94</p>
              <p className="text-[10px] font-semibold text-muted">match con el aviso</p>
            </div>
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wide">Resumen</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Ingeniera frontend con 7 años en <mark className="rounded bg-brand-soft px-0.5 text-ink">React y TypeScript</mark> para fintech y e-commerce.
          </p>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide">Experiencia</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            • Lideré la migración del checkout y <mark className="rounded bg-brand-soft px-0.5 text-ink">bajé 32% los errores de pago</mark>.
          </p>
          <div className="mt-3 space-y-1.5">
            <div className="h-1.5 w-11/12 rounded bg-line" />
            <div className="h-1.5 w-3/4 rounded bg-line" />
          </div>
        </div>
        <div className="absolute -bottom-6 -right-2 flex flex-col items-end gap-1.5 sm:-right-6">
          {["Resumen alineado al rol", "Palabras clave del ATS", "Logros con impacto"].map((t, i) => (
            <span
              key={t}
              className="animate-rise rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-md"
              style={{ animationDelay: `${300 + i * 150}ms` }}
            >
              ✦ {t}
            </span>
          ))}
        </div>
      </div>
    </MockPanel>
  );
}

/** Entrevista: chat con Maru. */
export function ChatMock({ bare = false }: { bare?: boolean }) {
  return (
    <MockPanel bare={bare} caption="Ejemplo ilustrativo de una práctica">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-4 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.35)] sm:p-5">
        <div className="flex items-center gap-2.5 border-b border-line pb-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft">
            <MaruHead size={26} />
          </span>
          <div>
            <p className="font-display font-bold leading-tight">Maru</p>
            <p className="flex items-center gap-1 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" /> te está entrevistando
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 text-[13px] leading-snug">
          <p className="max-w-[85%] rounded-2xl rounded-tl-md bg-black/[0.04] px-3.5 py-2.5">Contame de un proyecto donde hayas tenido impacto medible.</p>
          <p className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md bg-brand px-3.5 py-2.5 text-white">Migré el checkout a React y bajamos 32% los errores de pago…</p>
          <p className="max-w-[85%] rounded-2xl rounded-tl-md bg-black/[0.04] px-3.5 py-2.5">¡Buen dato! ¿Cuál fue tu rol puntual en el equipo?</p>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-full bg-black/[0.04] px-4 py-2 text-xs text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Respondé por voz o por escrito…
        </div>
      </div>
    </MockPanel>
  );
}

/** Video: teleprompter con feedback. */
export function VideoMock({ bare = false }: { bare?: boolean }) {
  return (
    <MockPanel bare={bare} caption="Ejemplo ilustrativo">
      <div className="relative mx-auto max-w-md">
        <div className="overflow-hidden rounded-2xl bg-ink shadow-[0_24px_50px_-30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between px-4 py-2.5 text-[11px] text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" /> Grabando · 0:24
            </span>
            <span>Toma 2</span>
          </div>
          <div className="px-6 pb-8 pt-4 text-center font-display text-xl font-semibold leading-snug text-white/40">
            Hola, soy Ana. <span className="text-white">Hace 7 años construyo productos web</span> que la gente usa todos los días…
          </div>
        </div>
        <div className="absolute -bottom-6 -left-2 rounded-2xl bg-white p-3 text-xs shadow-lg sm:-left-6">
          <p className="font-display font-bold">Feedback de la toma</p>
          <p className="mt-1 text-muted">
            Ritmo <span className="font-semibold text-brand">142 ppm ✓</span> · Mirada <span className="font-semibold text-brand">✓</span>
          </p>
        </div>
      </div>
    </MockPanel>
  );
}

/** Seguimiento: el tablero de postulaciones con lo que armó Maru para cada una. */
export function TrackerMock({ bare = false }: { bare?: boolean }) {
  const cols: { label: string; dot: string; cards: { t: string; c: string; chips: string[] }[] }[] = [
    { label: "Postuladas", dot: "bg-[#2457d6]", cards: [{ t: "Product Manager", c: "Fintech", chips: ["CV a medida", "Carta"] }, { t: "Analista de datos", c: "Retail", chips: ["CV a medida"] }] },
    { label: "Entrevista", dot: "bg-[#d4831c]", cards: [{ t: "UX Designer", c: "Startup", chips: ["CV a medida", "Práctica de entrevista"] }] },
    { label: "Oferta", dot: "bg-neon", cards: [{ t: "Data Engineer", c: "SaaS", chips: ["CV a medida", "Video"] }] },
  ];
  return (
    <MockPanel bare={bare} caption="Ejemplo ilustrativo">
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-2 rounded-2xl bg-[#f5f6f7] p-2.5 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.35)]">
        {cols.map((col) => (
          <div key={col.label} className="min-w-0 rounded-xl bg-[#eceef0] p-1.5">
            <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-semibold">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              {col.label}
            </p>
            <div className="space-y-1.5">
              {col.cards.map((card) => (
                <div key={card.t} className="rounded-lg bg-white p-2">
                  <p className="truncate text-[11px] font-semibold">{card.t}</p>
                  <p className="truncate text-[10px] text-ink/60">{card.c}</p>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {card.chips.map((ch) => (
                      <span key={ch} className="truncate rounded bg-neon/15 px-1 text-[9px] font-medium">
                        ✓ {ch}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </MockPanel>
  );
}
