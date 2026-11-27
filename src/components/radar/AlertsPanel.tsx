"use client";

import { useEffect, useState } from "react";
import type { RadarNotification } from "@/lib/radar/types";
import { radarApi } from "./api";
import { ago } from "./bits";
import { Tag, btnGhost, card } from "./ui";

/** Avisos in-app (alertas inmediatas y resúmenes semanales). */
export default function AlertsPanel() {
  const [items, setItems] = useState<RadarNotification[] | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    radarApi<{ items: RadarNotification[]; unread: number }>("/api/radar/avisos")
      .then((d) => {
        setItems(d.items);
        setUnread(d.unread);
      })
      .catch(() => setItems([]));
  }, []);

  if (!items || !items.length) return null;

  async function readAll() {
    const d = await radarApi<{ unread: number }>("/api/radar/avisos", { method: "POST", body: { all: true } }).catch(() => null);
    if (d) {
      setUnread(d.unread);
      setItems((xs) => xs?.map((n) => ({ ...n, read: true })) ?? null);
    }
  }

  return (
    <details className={`${card} p-4 sm:p-5`} open={unread > 0}>
      <summary className="cursor-pointer text-base font-bold">
        Avisos {unread > 0 && <span className="ml-1 rounded-full bg-neon px-2 py-0.5 text-xs">{unread} sin leer</span>}
      </summary>
      <ul className="mt-3 space-y-2">
        {items.slice(0, 10).map((n) => (
          <li key={n.id} className={`rounded-xl p-3 text-sm ring-1 ring-black/[0.08] ${n.read ? "opacity-75" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={n.kind === "alert" ? "ok" : "plain"}>{n.kind === "alert" ? "Alerta" : "Resumen semanal"}</Tag>
              <span className="font-semibold">{n.title}</span>
              <span className="ml-auto text-xs text-muted">{ago(n.at)}</span>
            </div>
            <p className="mt-1 whitespace-pre-line text-muted">{n.body}</p>
          </li>
        ))}
      </ul>
      {unread > 0 && (
        <button type="button" className={`${btnGhost} mt-3`} onClick={() => void readAll()}>
          Marcar todo como leído
        </button>
      )}
    </details>
  );
}
