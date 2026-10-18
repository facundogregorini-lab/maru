import Link from "next/link";

/**
 * Insignias con laureles como las de jobright (Product Hunt, OpenAI, Trustpilot), pero con datos
 * verdaderos de Maru en vez de premios que no tenemos. Cada sello lleva a la página que lo respalda.
 */

// Rama izquierda: un tallo curvo con hojas que apuntan hacia arriba y afuera.
const STEM = { x0: 15, y0: 46, cx: 1, cy: 26, x1: 9, y1: 3 };
const at = (t: number) => {
  const u = 1 - t;
  return {
    x: u * u * STEM.x0 + 2 * u * t * STEM.cx + t * t * STEM.x1,
    y: u * u * STEM.y0 + 2 * u * t * STEM.cy + t * t * STEM.y1,
  };
};
const leaf = (x: number, y: number, deg: number, len: number) => {
  const a = (deg * Math.PI) / 180;
  const tx = x + Math.cos(a) * len;
  const ty = y + Math.sin(a) * len;
  const nx = -Math.sin(a) * len * 0.32;
  const ny = Math.cos(a) * len * 0.32;
  const mx = (x + tx) / 2;
  const my = (y + ty) / 2;
  return `M${x.toFixed(1)} ${y.toFixed(1)}Q${(mx + nx).toFixed(1)} ${(my + ny).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}Q${(mx - nx).toFixed(1)} ${(my - ny).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}Z`;
};
const LEAVES = [0.12, 0.3, 0.48, 0.66, 0.84]
  .flatMap((t) => {
    const p = at(t);
    return [leaf(p.x, p.y, -150 + t * 70, 8), leaf(p.x, p.y, -60 + t * 10, 6)];
  })
  .concat(leaf(STEM.x1, STEM.y1 + 1, -95, 6))
  .join("");

function Branch({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="-4 0 24 48" aria-hidden className={`h-full w-auto shrink-0 ${flip ? "-scale-x-100" : ""}`}>
      <path d={`M${STEM.x0} ${STEM.y0}Q${STEM.cx} ${STEM.cy} ${STEM.x1} ${STEM.y1}`} fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d={LEAVES} fill="currentColor" />
    </svg>
  );
}

export type Laurel = { top: string; main: string; href: string; label: string };

/** Fila de sellos con las medidas de jobright: 108 × 30 en mobile y 144 × 40 desde 1024 px, separados por 12. */
export default function Laurels({ items }: { items: Laurel[] }) {
  return (
    <ul className="flex justify-center gap-3 lg:justify-start">
      {items.map((it) => (
        <li key={it.main} className="min-w-0 max-w-[108px] flex-1 lg:max-w-36">
          <Link href={it.href} aria-label={it.label} className="flex h-[30px] w-full items-center justify-between transition-opacity hover:opacity-70 lg:h-10">
            <Branch />
            <span className="min-w-0 text-center">
              <span className="block whitespace-nowrap text-[8px] font-semibold leading-[10px] lg:text-[11px] lg:leading-[13px]">{it.top}</span>
              <span className="block whitespace-nowrap font-display text-[13px] font-bold uppercase leading-[14px] lg:text-[17px] lg:leading-[19px]">{it.main}</span>
            </span>
            <Branch flip />
          </Link>
        </li>
      ))}
    </ul>
  );
}
