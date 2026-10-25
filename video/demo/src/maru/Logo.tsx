import React from "react";
import { HEAD_ONLY, WIDTH, rects, DESK_FRAMES, DESK_WIDTH, DESK_HEIGHT, type DeskFrame } from "./sprite";
import { C, theme } from "./theme";

/** La cara de Maru en pixel art (como MaruHead de src/components/maru/PixelMaru.tsx). */
export const MaruHead: React.FC<{ size?: number }> = ({ size = 24 }) => {
  const rows = HEAD_ONLY.length;
  return (
    <svg viewBox={`1 0 ${WIDTH - 1} ${rows}`} width={size} height={(size * rows) / (WIDTH - 1)} shapeRendering="crispEdges">
      {rects(HEAD_ONLY).map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
};

/** Maru en su escritorio (como MaruDesk). */
export const MaruDesk: React.FC<{ size?: number; frame?: DeskFrame }> = ({ size = 160, frame = "typeA" }) => (
  <svg viewBox={`0 0 ${DESK_WIDTH} ${DESK_HEIGHT}`} width={size} height={(size * DESK_HEIGHT) / DESK_WIDTH} shapeRendering="crispEdges">
    {rects(DESK_FRAMES[frame]).map((r, i) => (
      <rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
    ))}
  </svg>
);

/** Logo del header: la cara en un círculo neón y «Maru». */
export const Logo: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.22 }}>
    <span style={{ width: size, height: size, borderRadius: "50%", background: C.neon, display: "grid", placeItems: "center" }}>
      <MaruHead size={size * 0.66} />
    </span>
    <span style={{ fontFamily: theme.display, fontWeight: 700, fontSize: size * 0.72, letterSpacing: "-0.01em", lineHeight: 1, color: C.ink }}>Maru</span>
  </span>
);
