"use client";

import Image from "next/image";
import { useState } from "react";
/**
 * Logo de la empresa: el que informa la fuente (https), si no una marca verificada en assets locales
 * (SOURCES.json) y, sin correspondencia exacta, inicial y color. Si el logo remoto no carga, cae a la inicial.
 */
const COLORS = ["#1c8c4c", "#2457d6", "#e2553d", "#7a3fd1", "#0f9fb5", "#d4831c", "#c2367a", "#3f4a5a", "#118a7e", "#5b6ee1"];

export default function CompanyTile({ name, size = 48, logo }: { name: string; size?: number; logo?: string }) {
  const [failed, setFailed] = useState(false);
  const brands: Record<string, string> = { pinterest: "pinterest", nubank: "nubank", "mercado pago": "mercadopago", gitlab: "gitlab", github: "github", anthropic: "anthropic", spotify: "spotify", stripe: "stripe", shopify: "shopify", cloudflare: "cloudflare", zapier: "zapier", notion: "notion", vercel: "vercel", figma: "figma", airbnb: "airbnb" };
  const slug = brands[name.trim().toLowerCase()];
  if (slug) return <span aria-hidden className="grid shrink-0 place-items-center rounded-[10px] bg-white ring-1 ring-black/10" style={{ width: size, height: size }}><Image src={`/companies/${slug}.svg`} alt="" width={Math.round(size * .65)} height={Math.round(size * .65)} /></span>;
  if (logo?.startsWith("https://") && !failed)
    return (
      <span aria-hidden className="grid shrink-0 place-items-center overflow-hidden rounded-[10px] bg-white ring-1 ring-black/10" style={{ width: size, height: size }}>
        {/* Logos de terceros con dominios variables: <img> simple, sin optimizador ni referrer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="" width={Math.round(size * 0.8)} height={Math.round(size * 0.8)} loading="lazy" referrerPolicy="no-referrer" className="object-contain" onError={() => setFailed(true)} />
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
