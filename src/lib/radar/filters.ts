import { fold } from "./identity";
import type { CompanySource, Priority, SourceStatus, TargetView } from "./types";

/** Filtros combinables de "Mis empresas". Corre en el navegador sobre la lista ya ordenada por el servidor. */

export type MonitorState = "todas" | "pendiente" | "error" | "verificada" | "manual" | "sin_fuente";

export type CompanyFilters = {
  industry: string; // "Todas" o una etiqueta
  priority: "Todas" | Priority | "sin";
  region: string; // "Todas" o LatAm / Global / …
  q: string;
  monitor: MonitorState;
  archived: boolean; // true: muestra sólo las archivadas
};

export const DEFAULT_FILTERS: CompanyFilters = { industry: "Todas", priority: "Todas", region: "Todas", q: "", monitor: "todas", archived: false };

export function monitorState(sources: CompanySource[]): Exclude<MonitorState, "todas"> {
  if (!sources.length) return "sin_fuente";
  const st = new Set<SourceStatus>(sources.map((s) => s.status));
  if (st.has("success") || st.has("verified_empty") || st.has("partial")) return "verificada";
  if (st.has("error")) return "error";
  if (st.has("manual")) return "manual";
  return "pendiente";
}

export const MONITOR_LABELS: Record<Exclude<MonitorState, "todas">, string> = {
  sin_fuente: "Sin fuente",
  pendiente: "Fuente pendiente",
  error: "Fuente con error",
  manual: "Revisión manual",
  verificada: "Fuente verificada",
};

const tagsOf = (v: TargetView) => [...v.company.industries, ...v.target.tags];

export function applyFilters(items: TargetView[], f: CompanyFilters): TargetView[] {
  const q = fold(f.q);
  return items.filter((v) => {
    if ((v.target.status === "archivada") !== f.archived) return false;
    if (f.industry !== "Todas" && !tagsOf(v).some((t) => fold(t) === fold(f.industry))) return false;
    if (f.priority === "sin" ? v.target.priority !== null : f.priority !== "Todas" && v.target.priority !== f.priority) return false;
    if (f.region !== "Todas" && fold(v.company.region) !== fold(f.region)) return false;
    if (f.monitor !== "todas" && monitorState(v.sources) !== f.monitor) return false;
    if (q && ![v.company.name, ...v.company.aliases, v.company.canonicalDomain ?? "", v.company.headquarters].some((s) => fold(s).includes(q))) return false;
    return true;
  });
}

/** Opciones de los filtros a partir de los datos de la persona (sectores y regiones reales). */
export function filterOptions(items: TargetView[]): { industries: string[]; regions: string[] } {
  const ind = new Map<string, string>();
  const reg = new Map<string, string>();
  for (const v of items) {
    for (const t of tagsOf(v)) if (!ind.has(fold(t))) ind.set(fold(t), t);
    if (v.company.region && !reg.has(fold(v.company.region))) reg.set(fold(v.company.region), v.company.region);
  }
  const order = ["ia", "space", "tech startups"];
  const industries = [...ind.values()].sort((a, b) => {
    const ia = order.indexOf(fold(a));
    const ib = order.indexOf(fold(b));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "es");
  });
  return { industries, regions: [...reg.values()].sort((a, b) => a.localeCompare(b, "es")) };
}
