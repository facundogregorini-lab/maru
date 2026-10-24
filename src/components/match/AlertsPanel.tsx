"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DEFAULT_ALERT_SCORE, MAX_ALERT_SCORE, MIN_ALERT_SCORE, type AlertView } from "@/lib/alertsShared";
import { rememberReturnTo } from "@/lib/billing/returnTo";
import { requestLogin } from "@/lib/loginRequest";
import type { Filters } from "@/lib/match/ranking";
import type { Interactions, MatchPrefs, MatchProfile } from "@/lib/match/types";
import { capture } from "@/lib/tracking/posthog";

type Status = { disponible: boolean; envio: boolean; pro: boolean; alerta: AlertView | null };

const countFilters = (f: Filters) => Object.values(f).filter((v) => (Array.isArray(v) ? v.length : v !== undefined && v !== false && v !== "")).length;

/**
 * Alertas semanales: el lunes, por mail, las búsquedas nuevas que superan tu % mínimo.
 * Desde los resultados toma los filtros que están puestos; desde «Lo que busco» (sin `filters`) conserva los guardados.
 */
export default function AlertsPanel({ profile, prefs, interactions, filters }: { profile: MatchProfile; prefs: MatchPrefs; interactions: Interactions; filters?: Filters }) {
  const { email } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [minScore, setMinScore] = useState(DEFAULT_ALERT_SCORE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    if (!email) return setStatus(null);
    const res = await fetch("/api/alertas", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setStatus(null);
    const s = (await res.json()) as Status;
    setStatus(s);
    if (s.alerta) setMinScore(s.alerta.minScore);
  }, [email]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(active: boolean) {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      const res = await fetch("/api/alertas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active, minScore, filters: filters ?? status?.alerta?.filters ?? {}, profile, prefs, interactions }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "No pudimos guardar tu alerta.");
      setStatus(d as Status);
      setSaved(active ? "Alerta guardada." : "Alertas apagadas.");
      capture(active ? "alertas_activadas" : "alertas_apagadas", { minimo: minScore, filtros: countFilters(filters ?? {}) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const active = !!status?.alerta?.active;
  const shownFilters = filters ?? status?.alerta?.filters ?? {};
  const n = countFilters(shownFilters);

  return (
    <section aria-labelledby="alertas-t" className="mt-4 rounded-[24px] bg-white p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="alertas-t" className="text-lg font-semibold">
          Alertas semanales
        </h2>
        {active && <span className="rounded-full bg-neon/20 px-2.5 py-0.5 text-xs font-semibold">Activas</span>}
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">Plan de Maru</span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Cada lunes te mandamos por mail las búsquedas nuevas que coinciden en {minScore}% o más con tu perfil
        {filters ? (n ? `, con los ${n === 1 ? "filtro" : `${n} filtros`} que tenés puestos ahora` : ", sin filtros") : n ? `, con los ${n === 1 ? "filtro" : `${n} filtros`} que guardaste` : ""}. Nunca repetimos una que ya te mandamos.
      </p>

      {!email ? (
        <button type="button" onClick={() => void requestLogin("activar tus alertas")} className="press mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
          Ingresá para activar tus alertas
        </button>
      ) : !status ? (
        <p className="mt-4 text-sm text-muted">Cargando tu alerta…</p>
      ) : !status.disponible ? (
        <p className="mt-4 text-sm text-muted">Las alertas todavía no están disponibles.</p>
      ) : !status.pro ? (
        <div className="mt-4 rounded-2xl bg-sand p-4 text-sm">
          <p>Las alertas semanales son del plan de Maru.{active ? " Tu alerta quedó en pausa hasta que vuelvas a tener el plan." : ""}</p>
          <Link href="/precios" onClick={() => rememberReturnTo("/match")} className="press mt-3 inline-flex rounded-full bg-neon px-4 py-2 font-bold">
            Ver los planes
          </Link>
          {active && (
            <button type="button" disabled={busy} onClick={() => save(false)} className="ml-3 text-sm text-ink/60 underline underline-offset-2">
              Apagar alertas
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <label className="block text-sm font-medium" htmlFor="alerta-minimo">
            Compatibilidad mínima: <span className="tabular-nums">{minScore}%</span>
          </label>
          <input
            id="alerta-minimo"
            type="range"
            min={MIN_ALERT_SCORE}
            max={MAX_ALERT_SCORE}
            step={5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="mt-2 w-full max-w-sm accent-[#00c080]"
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy} onClick={() => save(true)} className="press rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Guardando…" : active ? "Guardar cambios" : "Activar alertas"}
            </button>
            {active && (
              <button type="button" disabled={busy} onClick={() => save(false)} className="text-sm text-ink/60 underline underline-offset-2 hover:text-ink">
                Apagar alertas
              </button>
            )}
          </div>
          {active && !status.envio && <p className="mt-3 text-xs text-muted">Tu alerta quedó guardada. Los mails empiezan a salir apenas terminemos de habilitar el envío.</p>}
          {status.alerta?.lastSentAt && <p className="mt-3 text-xs text-muted">Último mail: {new Date(status.alerta.lastSentAt).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}.</p>}
        </div>
      )}
      {saved && <p role="status" className="mt-3 text-sm text-sage">{saved}</p>}
      {error && <p role="alert" className="mt-3 text-sm text-danger-dark">{error}</p>}
    </section>
  );
}
