"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { TRACKER_EVENT, TRACKER_KEY, listTracked, mergeRemoved, mergeTracked, readRemoved, replaceTracked, type Removed, type TrackItem } from "@/lib/tracker";

/**
 * Con sesión, mantiene el seguimiento igual en todos tus dispositivos: al entrar trae el de la cuenta
 * y lo junta con el de este navegador; cada cambio se sube (con una pausa para agrupar cambios seguidos).
 * Sin base de datos configurada, el servidor responde 503 y esto no hace nada.
 */
export default function TrackerSync() {
  const { email } = useAuth();

  useEffect(() => {
    if (!email) return;
    let off = false;
    let timer = 0;
    let applying = false;

    const push = async () => {
      const res = await fetch("/api/seguimiento", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: listTracked(), removed: readRemoved() }),
      }).catch(() => null);
      if (!res?.ok) {
        if (res?.status === 503 || res?.status === 401) off = true;
        return;
      }
      const data = (await res.json()) as { items: TrackItem[]; removed: Removed };
      const merged = mergeTracked(listTracked(), data.items, mergeRemoved(readRemoved(), data.removed));
      applying = true;
      replaceTracked(merged, mergeRemoved(readRemoved(), data.removed));
      applying = false;
    };

    const schedule = () => {
      if (off || applying) return;
      clearTimeout(timer);
      timer = window.setTimeout(push, 1500);
    };
    const onStorage = (e: StorageEvent) => e.key === TRACKER_KEY && schedule();

    void push();
    window.addEventListener(TRACKER_EVENT, schedule);
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(TRACKER_EVENT, schedule);
      window.removeEventListener("storage", onStorage);
    };
  }, [email]);

  return null;
}
