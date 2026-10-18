import { useId } from "react";

/** Nivel del match con los umbrales de siempre: el rótulo acompaña al número, no lo reemplaza. */
export function matchLevel(score: number): { label: string; tier: "fuerte" | "bueno" | "posible" } {
  return score >= 70 ? { label: "Match fuerte", tier: "fuerte" } : score >= 45 ? { label: "Buen match", tier: "bueno" } : { label: "Match posible", tier: "posible" };
}

const SIZES = {
  sm: { box: 48, stroke: 2, num: "text-[20px] font-semibold", pct: "text-[11px]" },
  md: { box: 72, stroke: 3, num: "text-[22px] font-bold", pct: "text-xs" },
  dark: { box: 80, stroke: 5, num: "text-2xl font-bold", pct: "text-xs" },
  lg: { box: 120, stroke: 5, num: "text-[44px] font-bold", pct: "text-base" },
} as const;

/**
 * Anillo de compatibilidad al estilo jobright: arranca abajo (a las 6), avanza en sentido horario,
 * puntas redondeadas y degradé neón → aqua. `dark` es el del panel negro de las tarjetas.
 */
export default function ScoreRing({ value, size = "sm", label }: { value: number; size?: keyof typeof SIZES; label?: string }) {
  const id = useId();
  const s = SIZES[size];
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const r = (s.box - s.stroke) / 2;
  const c = 2 * Math.PI * r;
  const tier = matchLevel(v).tier;
  const stroke = tier === "fuerte" ? `url(#${id})` : tier === "bueno" ? "var(--color-warning)" : size === "dark" ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)";
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: s.box, height: s.box }} role="img" aria-label={`${v}% de compatibilidad`}>
      <svg viewBox={`0 0 ${s.box} ${s.box}`} width={s.box} height={s.box} className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={size === "sm" ? "#59fcca" : "#00f0a0"} />
            <stop offset="100%" stopColor={size === "sm" ? "#53f0ec" : "#2ef7e0"} />
          </linearGradient>
        </defs>
        <circle cx={s.box / 2} cy={s.box / 2} r={r} fill="none" strokeWidth={s.stroke} stroke={size === "dark" ? "rgba(255,255,255,0.15)" : "var(--color-surface)"} />
        <circle
          cx={s.box / 2}
          cy={s.box / 2}
          r={r}
          fill="none"
          strokeWidth={s.stroke}
          strokeLinecap="round"
          stroke={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          transform={`rotate(90 ${s.box / 2} ${s.box / 2})`}
        />
      </svg>
      <span className="relative flex flex-col items-center leading-none">
        <span className={s.num}>
          {v}
          <span className={`${s.pct} font-semibold`}>%</span>
        </span>
        {label && <span className="mt-1 text-sm font-normal">{label}</span>}
      </span>
    </span>
  );
}
