"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { requestLogin } from "@/lib/loginRequest";
import type { MatchPrefs } from "@/lib/match/types";
import { loadProfile } from "@/lib/profileStore";
import { capture } from "@/lib/tracking/posthog";

type Status = { disponible: boolean; activo: boolean; actualizadoEn: number | null };

/**
 * «Abierto a propuestas»: que empresas que usan Maru Recruiters puedan encontrar tu experiencia.
 * Ven tu experiencia, estudios y aptitudes; tu nombre completo y tu contacto, sólo si aceptás una propuesta.
 */
export default function TalentPanel({ prefs }: { prefs: MatchPrefs }) {
  const { email } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!email) return setStatus(null);
    const res = await fetch("/api/talento", { cache: "no-store", headers: { "X-Maru-Account": email } }).catch(() => null);
    setStatus(res?.ok ? ((await res.json()) as Status) : null);
  }, [email]);
  useEffect(() => {
    void load();
  }, [load]);

  async function save(activo: boolean) {
    setError("");
    if (!email) {
      if (!(await requestLogin("activar «Abierto a propuestas»"))) return;
    }
    const saved = loadProfile();
    if (activo && !saved) return setError("Cargá tu CV en Maru antes de activar esta opción.");
    setBusy(true);
    try {
      const res = await fetch("/api/talento", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          activo
            ? { activo, profile: saved!.profile, prefs: { objetivo: prefs.objetivo.slice(0, 300), roles: prefs.rolesDeseados.slice(0, 10), ciudad: prefs.ciudad.slice(0, 120), modalidades: prefs.modalidades.slice(0, 5) } }
            : { activo },
        ),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "No pudimos guardar el cambio.");
      setStatus(d as Status);
      capture(activo ? "talento_activado" : "talento_apagado", {});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (status && !status.disponible) return null;
  const activo = !!status?.activo;

  return (
    <section aria-labelledby="talento-t" className="mt-4 rounded-[24px] bg-white p-6 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="talento-t" className="text-lg font-semibold">Abierto a propuestas</h2>
        {activo && <span className="rounded-full bg-neon/20 px-2.5 py-0.5 text-xs font-semibold">Activo</span>}
        <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold">Gratis</span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Que las empresas que buscan con Maru Recruiters te encuentren. Ven tu experiencia, estudios y aptitudes, sin tu apellido ni tu contacto. Si una empresa te escribe, la propuesta te llega por mail y decidís si responder.
      </p>
      <ul className="mt-3 grid gap-1 text-[13px] text-muted">
        <li>• La IA de las empresas no usa edad, género, nacionalidad ni foto.</li>
        <li>• Podés apagarlo cuando quieras: se borra tu perfil de las búsquedas.</li>
        <li>• Si actualizás tu CV en Maru, volvé a guardar para que lo vean actualizado.</li>
      </ul>
      {error && <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-2.5 text-sm text-danger-dark">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {activo ? (
          <>
            <button type="button" disabled={busy} onClick={() => void save(true)} className="press inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-60">
              Actualizar mi perfil
            </button>
            <button type="button" disabled={busy} onClick={() => void save(false)} className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-sm font-medium disabled:opacity-60">
              Apagar
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => void save(true)} className="press inline-flex min-h-11 items-center rounded-full bg-neon px-5 text-sm font-semibold disabled:opacity-60">
            {busy ? "Guardando…" : "Activar"}
          </button>
        )}
      </div>
    </section>
  );
}
