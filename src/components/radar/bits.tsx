"use client";

import { MONITOR_LABELS, monitorState, type MonitorState } from "@/lib/radar/filters";
import type { Priority, TargetView } from "@/lib/radar/types";
import { Tag } from "./ui";

const MONITOR_TONE: Record<Exclude<MonitorState, "todas">, "plain" | "warn" | "danger" | "ok"> = { sin_fuente: "plain", pendiente: "warn", error: "danger", manual: "plain", verificada: "ok" };

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


/** "hoy", "hace 3 días", "hace 2 meses". */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "Nunca";
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const min = Math.round(ms / 60_000);
  if (min < 2) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ayer";
  if (d < 31) return `hace ${d} días`;
  const m = Math.round(d / 30);
  return m === 1 ? "hace 1 mes" : `hace ${m} meses`;
}

export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "");

/** Vacantes activas de una empresa según sus fuentes ("—" si nunca se leyó). */
export function openJobsLabel(view: TargetView): string {
  const read = view.sources.filter((s) => s.lastSuccessAt);
  if (!read.length) return "Sin revisar";
  const n = read.reduce((a, s) => a + (s.openJobs ?? 0), 0);
  return n === 1 ? "1 activa" : `${n} activas`;
}

export const lastSuccess = (view: TargetView) => view.sources.map((s) => s.lastSuccessAt).filter(Boolean).sort().pop() ?? null;

export const SOURCE_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente de verificar",
  success: "Leída completa",
  verified_empty: "Leída completa, sin vacantes",
  partial: "Lectura parcial (no cierra vacantes)",
  error: "Con error",
  manual: "Revisión manual",
};
export const PROVIDER_LABEL: Record<string, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", jsonld: "Página con JSON-LD", careers: "Página de Careers" };
export const REMOTE_LABEL: Record<string, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial", desconocido: "" };
