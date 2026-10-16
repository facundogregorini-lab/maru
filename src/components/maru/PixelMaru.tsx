import { DESK_FRAMES, DESK_HEIGHT, DESK_WIDTH, FRAMES, HEAD_ONLY, HEIGHT, WIDTH, rects, type DeskFrame, type FrameName } from "./sprite";

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

/** Maru sentada en su escritorio, con la compu y el mate. El frame lo elige data-frame, como en MaruSprite. */
export function MaruDesk({ size = 84, frame = "typeA", className = "", ref }: { size?: number; frame?: DeskFrame; className?: string; ref?: React.Ref<SVGSVGElement> }) {
  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${DESK_WIDTH} ${DESK_HEIGHT}`}
      width={size}
      height={(size * DESK_HEIGHT) / DESK_WIDTH}
      shapeRendering="crispEdges"
      data-frame={frame}
      className={`maru-sprite ${className}`}
      aria-hidden
    >
      {(Object.keys(DESK_FRAMES) as DeskFrame[]).map((name) => (
        <g key={name} className={`f-${name}`}>
          {rects(DESK_FRAMES[name]).map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
          ))}
        </g>
      ))}
    </svg>
  );
}
