"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CompanyStatus } from "@/lib/radar/sourceState";
import type { RadarState } from "@/lib/radar/types";

export type StatusResult = {
  statuses: Record<string, CompanyStatus>;
  generatedAt: string | null;
  loading: boolean;
  error: string;
  refresh: () => void;
};

/** Estado de monitoreo de las empresas seguidas (contra el inventario compartido de Maru). */
export function useCompanyStatus(state: RadarState, ready: boolean): StatusResult {
  const [statuses, setStatuses] = useState<Record<string, CompanyStatus>>({});
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  // Sólo lo que cambia el estado de la fuente (nombre, link, bolsa): editar notas o prioridad no vuelve a consultar.
  const query = useMemo(
    () =>
      JSON.stringify(
        Object.values(state.companies)
          .filter((c) => !c.archived)
          .map((c) => ({ id: c.id, name: c.name, ...(c.board ? { board: c.board } : {}), ...(c.careersUrl ? { careersUrl: c.careersUrl } : {}) }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      ),
    [state.companies],
  );

  useEffect(() => {
    if (!ready) return;
    const companies = JSON.parse(query) as unknown[];
    if (!companies.length) {
      setStatuses({});
      return;
    }
    let alive = true;
    setLoading(true);
    setError("");
    const t = setTimeout(() => {
      fetch("/api/radar/estado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companies: companies.slice(0, 1500) }) })
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error ?? "No pudimos revisar el estado de tus empresas.");
          return d as { statuses: Record<string, CompanyStatus>; generatedAt: string | null };
        })
        .then((d) => {
          if (!alive) return;
          setStatuses(d.statuses);
          setGeneratedAt(d.generatedAt);
        })
        .catch((e: Error) => alive && setError(e.message))
        .finally(() => alive && setLoading(false));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, ready, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { statuses, generatedAt, loading, error, refresh };
}

/** El inventario se actualiza una vez por día: más de 36 horas es dato viejo. */
export function isStale(generatedAt: string | null, now = Date.now()): boolean {
  if (!generatedAt) return false;
  const t = Date.parse(generatedAt);
  return Number.isFinite(t) && now - t > 36 * 3600_000;
}
