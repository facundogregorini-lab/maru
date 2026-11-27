"use client";

import { MONITOR_LABELS, monitorState, type MonitorState } from "@/lib/radar/filters";
import type { Priority, TargetView } from "@/lib/radar/types";
import { Tag } from "./ui";

const MONITOR_TONE: Record<Exclude<MonitorState, "todas">, "plain" | "warn" | "danger" | "ok"> = { sin_fuente: "plain", pendiente: "warn", error: "danger", verificada: "ok" };

export function SourceTag({ view }: { view: TargetView }) {
  const st = monitorState(view.sources);
  return <Tag tone={MONITOR_TONE[st]}>{MONITOR_LABELS[st]}</Tag>;
}

export function PrioritySelect({ value, onChange, label, disabled }: { value: Priority | null; onChange: (p: Priority | null) => void; label: string; disabled?: boolean }) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange((e.target.value || null) as Priority | null)}
      className="min-h-10 rounded-lg bg-white px-2 text-sm font-semibold ring-1 ring-black/[0.12] outline-none hover:ring-black/30 focus-visible:ring-2 focus-visible:ring-ink"
    >
      <option value="P1">P1</option>
      <option value="P2">P2</option>
      <option value="P3">P3</option>
      <option value="">Por clasificar</option>
    </select>
  );
}

