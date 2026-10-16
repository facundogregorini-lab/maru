"use client";

import { useState } from "react";

/** "Logo" de empresa: el real si la fuente lo publica; si no (o si no carga), su inicial sobre un color que sale del nombre. */
const COLORS = ["#1c8c4c", "#2457d6", "#e2553d", "#7a3fd1", "#0f9fb5", "#d4831c", "#c2367a", "#3f4a5a", "#118a7e", "#5b6ee1"];

export default function CompanyTile({ name, size = 48, logo = "" }: { name: string; size?: number; logo?: string }) {
  const [broken, setBroken] = useState(false);
  if (logo && !broken)
    return (
      <span aria-hidden className="grid shrink-0 place-items-center overflow-hidden rounded-[10px] bg-white ring-1 ring-black/[0.06]" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logos de terceros de cualquier dominio, sin optimizar */}
        <img src={logo} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-contain p-1" />
      </span>
    );
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-[10px] font-display font-bold text-white"
      style={{ width: size, height: size, background: COLORS[h % COLORS.length], fontSize: size * 0.46 }}
    >
      {name.trim()[0]?.toUpperCase() ?? "·"}
    </span>
  );
}
