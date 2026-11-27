"use client";

import { STATE_LABEL, type CompanyStatus, type SourceState } from "@/lib/radar/sourceState";
import { PRIORITIES, type Priority } from "@/lib/radar/types";
import { Pill, field } from "./RadarUi";

const STATE_TONE: Record<SourceState, "ok" | "warn" | "bad" | "info" | "neutral"> = {
  monitoreada: "ok",
  error: "bad",
  portales: "info",
  incorporable: "warn",
  sin_fuente: "neutral",
};

export function SourcePill({ s, loading }: { s: CompanyStatus | undefined; loading?: boolean }) {
  if (!s) return <Pill>{loading ? "Revisando…" : "Sin datos"}</Pill>;
  return <Pill tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Pill>;
}

export function PrioritySelect({ value, name, onChange }: { value: Priority | null; name: string; onChange: (p: Priority | null) => void }) {
  return (
    <label>
      <span className="sr-only">Prioridad de {name}</span>
      <select className={field} value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as Priority | null)}>
        <option value="">Sin clasificar</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}
