import { MaruHead } from "@/components/maru/PixelMaru";

/**
 * Maquetas ilustrativas del producto para la home, al estilo jobright: tarjetas blancas
 * sobre un panel verde menta. Son ejemplos, no datos de una persona real.
 */

export function MockPanel({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <figure className="relative">
      {/* Como en jobright: panel menta de 24 px de radio y proporción 4:3 (768 × 576). */}
      <div className="relative grid place-items-center overflow-hidden rounded-[24px] bg-sand px-5 py-10 sm:aspect-[4/3] sm:px-10 sm:py-12">
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
export function MatchMock() {
  return (
    <MockPanel caption="Ejemplo ilustrativo de una recomendación">
      <div aria-hidden className="absolute left-10 right-16 top-6 h-24 -rotate-3 rounded-2xl bg-white/60" />
      <div className="animate-float relative mx-auto max-w-md rounded-2xl bg-white p-5 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.35)]">
        <div className="absolute -right-4 -top-6 grid h-20 w-20 place-items-center rounded-full bg-brand text-center text-white shadow-lg">
          <p className="font-display text-2xl font-bold leading-none">
            92<span className="text-sm">%</span>
          </p>
          <p className="-mt-3 text-[10px] font-semibold">compatible</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink font-display text-lg font-bold text-white">T</span>
          <div>
            <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand-dark">Nueva · hace 1 h</span>
            <p className="mt-1 font-display text-lg font-bold leading-tight">Product Manager Sr.</p>
            <p className="text-xs text-muted">Tucán · Buenos Aires · Híbrido</p>
          </div>
        </div>
        <div className="mt-5 flex justify-around">
          <Ring value={95} label="Experiencia" />
          <Ring value={90} label="Skills" />
          <Ring value={88} label="Seniority" />
        </div>
        <p className="mt-5 font-display text-sm font-bold">Por qué encajás</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["✓ Seniority", "✓ Producto B2B", "✓ Inglés C1", "✓ Contrata desde Argentina"].map((t) => (
            <span key={t} className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white">
              {t}
            </span>
          ))}
        </div>
      </div>
    </MockPanel>
  );
}

/** CV a medida: papel con mejoras resaltadas. */
export function CvMock() {
  return (
    <MockPanel caption="Ejemplo ilustrativo">
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
export function ChatMock() {
  return (
    <MockPanel caption="Ejemplo ilustrativo de una práctica">
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
export function VideoMock() {
  return (
    <MockPanel caption="Ejemplo ilustrativo">
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
