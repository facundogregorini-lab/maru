import { FRAMES, HEAD_ONLY, HEIGHT, WIDTH, rects, type FrameName } from "./sprite";

/** Todos los frames de Maru en un SVG; el que se ve lo elige data-frame (sin re-render por frame). */
export function MaruSprite({ size = 48, frame = "idle", className = "" }: { size?: number; frame?: FrameName; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={size}
      height={(size * HEIGHT) / WIDTH}
      shapeRendering="crispEdges"
      data-frame={frame}
      className={`maru-sprite ${className}`}
      aria-hidden
    >
      {(Object.keys(FRAMES) as FrameName[]).map((name) => (
        <g key={name} className={`f-${name}`}>
          {rects(FRAMES[name]).map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** La cara de Maru en pixel art: logo del header y favicon. */
export function MaruHead({ size = 32, className = "" }: { size?: number; className?: string }) {
  const rows = HEAD_ONLY.length;
  return (
    <svg viewBox={`1 0 ${WIDTH - 1} ${rows}`} width={size} height={(size * rows) / (WIDTH - 1)} shapeRendering="crispEdges" className={className} aria-hidden>
      {rects(HEAD_ONLY).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
