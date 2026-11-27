"use client";

import { useEffect, useState } from "react";

/**
 * Si la navegación muestra Radar laboral. Con el flag apagado en el build no hace ningún pedido.
 * Prendido, pregunta una vez por pestaña a /api/radar/estado (respeta la allowlist).
 */

const FLAG = process.env.NEXT_PUBLIC_RADAR_ENABLED === "true";
let cached: Promise<boolean> | null = null;

export function useRadarVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!FLAG) return;
    let alive = true;
    cached ??= fetch("/api/radar/estado", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { visible: false }))
      .then((d: { visible?: boolean }) => d.visible === true)
      .catch(() => false);
    void cached.then((v) => alive && setVisible(v));
    return () => {
      alive = false;
    };
  }, []);
  return visible;
}
