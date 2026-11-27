"use client";

import { useCallback, useEffect, useState } from "react";
import { capture } from "@/lib/tracking/posthog";
import { normalizeSettings, setSettings, validTimezone } from "@/lib/radar/state";
import { FREQUENCIES, PRIORITIES, PRIORITY_LABEL, type Frequency, type RadarSettings } from "@/lib/radar/types";
import { Note, Pill, Toast, btnNeon, card, field } from "./RadarUi";
import { useRadar } from "./useRadar";

const FREQ_LABEL: Record<Frequency, string> = { diaria: "Diaria", semanal: "Semanal", mensual: "Mensual", pausada: "Pausada" };
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const HINT: Record<string, string> = { P1: "Tus empresas soñadas · objetivo 20", P2: "Empresas objetivo · objetivo 100", P3: "Exploración" };

export default function Automatizacion() {
  const { state, ready, update } = useRadar();
  const [draft, setDraft] = useState<RadarSettings>(state.settings);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const clearToast = useCallback(() => setToast(""), []);

  useEffect(() => {
    if (ready) setDraft(state.settings);
  }, [ready, state.settings]);

  if (!ready) return <p className="py-10 text-center text-sm text-muted">Cargando…</p>;

  const set = <K extends keyof RadarSettings>(k: K, v: RadarSettings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const save = () => {
    if (!validTimezone(draft.timezone)) {
      setError("La zona horaria no es válida. Usá el formato de la lista (por ejemplo, America/Argentina/Buenos_Aires).");
      return;
    }
    setError("");
    update((s) => setSettings(s, normalizeSettings(draft)));
    capture("radar_settings_saved", { activo: draft.enabled, p1: draft.frequency.P1, resumen: draft.digest, source: "radar" });
    setToast("Guardamos tus preferencias.");
  };

  const row = (title: string, hint: string, control: React.ReactNode, id?: string) => (
    <div key={title} className="flex items-center justify-between gap-4 border-b border-line py-3.5 last:border-0">
      <div>
        <p className="text-sm font-semibold" id={id}>
          {title}
        </p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      {control}
    </div>
  );
  const toggle = (k: "enabled" | "instant" | "digest" | "emailConsent", labelId: string) => (
    <input type="checkbox" aria-labelledby={labelId} className="h-5 w-5 shrink-0 accent-[#00a975]" checked={draft[k]} onChange={(e) => set(k, e.target.checked)} />
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-4">
        <section className={card}>
          <h2 className="mb-1 text-base font-bold">Frecuencia de los avisos</h2>
          {row("Radar activo", "Maru revisa las búsquedas de las empresas que seguís.", toggle("enabled", "radar-activo"), "radar-activo")}
          {PRIORITIES.map((p) =>
            row(
              PRIORITY_LABEL[p],
              HINT[p],
              <label>
                <span className="sr-only">Frecuencia para {PRIORITY_LABEL[p]}</span>
                <select className={field} value={draft.frequency[p]} onChange={(e) => set("frequency", { ...draft.frequency, [p]: e.target.value as Frequency })}>
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {FREQ_LABEL[f]}
                    </option>
                  ))}
                </select>
              </label>,
            ),
          )}
        </section>

        <section className={card}>
          <h2 className="mb-1 text-base font-bold">Alertas y resumen semanal</h2>
          {row("Alertas de Prioridad 1", "Una búsqueda nueva con match alto y sin requisitos que te dejen afuera.", toggle("instant", "radar-alertas"), "radar-alertas")}
          {row(
            "Match mínimo para alertar",
            "Sobre 100.",
            <label>
              <span className="sr-only">Match mínimo</span>
              <select className={field} value={draft.threshold} onChange={(e) => set("threshold", Number(e.target.value))}>
                {[75, 80, 85, 90, 95].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>,
          )}
          {row("Resumen semanal", "Las 5 mejores, lo que cambió y las fuentes con problemas.", toggle("digest", "radar-resumen"), "radar-resumen")}
          {row(
            "Día",
            "Cuándo te llega el resumen.",
            <label>
              <span className="sr-only">Día del resumen</span>
              <select className={field} value={draft.digestDay} onChange={(e) => set("digestDay", Number(e.target.value))}>
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>,
          )}
          {row(
            "Hora",
            "En tu zona horaria.",
            <label>
              <span className="sr-only">Hora del resumen</span>
              <input type="time" className={field} value={draft.digestTime} onChange={(e) => set("digestTime", e.target.value)} />
            </label>,
          )}
          <label className="mt-2 block">
            <span className="mb-1 block text-xs font-semibold text-muted">Zona horaria</span>
            <input className={`${field} w-full`} value={draft.timezone} onChange={(e) => set("timezone", e.target.value.trim())} list="radar-tz" />
            <datalist id="radar-tz">
              {["America/Argentina/Buenos_Aires", "America/Montevideo", "America/Santiago", "America/Sao_Paulo", "America/Bogota", "America/Mexico_City", "America/New_York", "Europe/Madrid"].map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </label>
          {row("Recibir el resumen por email", "Además de verlo en Maru. Podés darte de baja cuando quieras.", toggle("emailConsent", "radar-email"), "radar-email")}
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger-dark">
              {error}
            </p>
          )}
          <button type="button" className={`${btnNeon} mt-3`} onClick={save}>
            Guardar preferencias
          </button>
        </section>
      </div>

      <div className="flex flex-col gap-4">
        <section className={card}>
          <h2 className="mb-2 text-base font-bold">Estado del monitoreo</h2>
          <Pill tone="info">Sincronización diaria de Maru</Pill>
          <p className="mt-3 text-sm text-muted">
            Maru lee las bolsas de empleo de su catálogo una vez por día, para todas las personas a la vez. Tu frecuencia define cada cuánto te avisamos, no cuántas veces se consulta a cada empresa.
          </p>
          <Note>Las alertas y el resumen todavía no se envían: se activan en la próxima etapa del Radar. Tus preferencias quedan guardadas.</Note>
        </section>
        <section className={card}>
          <h2 className="mb-2 text-base font-bold">Cómo se calcula el match</h2>
          <p className="text-sm text-muted">Es el mismo match de Maru: encaje de rol 40 %, seniority 25 %, requisitos 20 % y preferencias 15 %. Lo que el aviso no informa no cuenta en contra, y un requisito que te deja afuera nunca se compensa con puntaje alto.</p>
        </section>
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}
