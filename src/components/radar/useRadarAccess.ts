"use client";

import { useEffect, useState } from "react";

const KEY = "maru:radar:acceso";
/** La respuesta se reusa unos minutos: después de ingresar con Google puede cambiar (allowlist). */
const TTL_MS = 5 * 60_000;

/**
 * Si la navegación muestra el Radar laboral (feature flag del servidor, `RADAR_ENABLED`).
 * Mientras `NEXT_PUBLIC_RADAR_NAV` no sea "1" (se lee al compilar) no consulta nada: con el Radar apagado,
 * ninguna visita suma un pedido al servidor.
 */
export function useRadarAccess(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_RADAR_NAV !== "1") return;
    let alive = true;
    try {
      const [value, at] = (window.sessionStorage.getItem(KEY) ?? "").split(":");
      if (value && Date.now() - Number(at) < TTL_MS) {
        setEnabled(value === "1");
        return;
      }
    } catch {
      // sin sessionStorage: consultamos igual
    }
    fetch("/api/radar/acceso", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => {
        if (!alive) return;
        setEnabled(d.enabled === true);
        try {
          window.sessionStorage.setItem(KEY, `${d.enabled === true ? "1" : "0"}:${Date.now()}`);
        } catch {
          // idem
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}
