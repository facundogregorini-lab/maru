"use client";

import { useCallback, useEffect, useState } from "react";
import { STORAGE_EVENT } from "@/lib/storage";
import { SYNC_EVENT } from "@/lib/sync/client";
import { loadRadar, saveRadar } from "@/lib/radar/store";
import { EMPTY_RADAR, RADAR_EVENT, RADAR_KEY, type RadarState } from "@/lib/radar/types";

/** Estado del Radar de este navegador, al día con otras pestañas y con la cuenta. */
export function useRadar() {
  const [state, setState] = useState<RadarState>(EMPTY_RADAR);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => setState(loadRadar());
    refresh();
    setReady(true);
    const onSync = (e: Event) => {
      if ((e as CustomEvent<{ doc?: string }>).detail?.doc === "radar") refresh();
    };
    const onStorage = (e: Event) => {
      if ((e as CustomEvent<{ key?: string }>).detail?.key === RADAR_KEY) refresh();
    };
    const onOtherTab = (e: StorageEvent) => {
      if (e.key === RADAR_KEY) refresh();
    };
    window.addEventListener(RADAR_EVENT, refresh);
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener(STORAGE_EVENT, onStorage);
    window.addEventListener("storage", onOtherTab);
    return () => {
      window.removeEventListener(RADAR_EVENT, refresh);
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener(STORAGE_EVENT, onStorage);
      window.removeEventListener("storage", onOtherTab);
    };
  }, []);

  /** Aplica un cambio sobre el último estado guardado (no sobre uno viejo de este render). */
  const update = useCallback((fn: (s: RadarState) => RadarState) => {
    const current = loadRadar();
    const next = fn(current);
    if (next !== current) {
      saveRadar(next);
      setState(next);
    }
    return next;
  }, []);

  return { state, ready, update };
}
