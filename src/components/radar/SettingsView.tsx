"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { requestLogin } from "@/lib/loginRequest";
import { COUNTRY_OPTIONS } from "@/lib/radar/settings";
import type { Frequency, MatchWeights, RadarEligibilityPrefs, RadarSettings } from "@/lib/radar/types";
import { trackRadar } from "@/lib/radar/analytics";
import type { MonitoringRun } from "@/lib/radar/types";
import { radarApi } from "./api";
import { SOURCE_STATUS_LABEL, ago, fmtDate } from "./bits";
import { Drawer, EmptyState, Label, Notice, Skeleton, Tag, btnDark, btnGhost, card, field, useToast } from "./ui";

type Status = { enabled: boolean; lastRun: MonitoringRun | null; sources: { expected: number; verified: number; manual: number; errors: number }; nextDueAt: string | null; history: MonitoringRun[] };
const RUN_LABEL: Record<string, string> = { ...SOURCE_STATUS_LABEL, skipped: "Salteada (sin tiempo)", locked: "Otra revisión en curso" };
const TRIGGER: Record<string, string> = { manual: "Revisión a pedido", worker: "Revisión programada", script: "Script" };

/** Estado real del monitoreo, «Revisar ahora» (todas las empresas) e historial de corridas. */
function MonitoringPanel({ enabled }: { enabled: boolean }) {
  const [st, setSt] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [history, setHistory] = useState(false);
  const load = () =>
    radarApi<Status>("/api/radar/monitoreo")
      .then((d) => { setSt(d); setError(""); })
      .catch((e) => setError(e instanceof Error ? e.message : "No pudimos cargar el estado."));
  useEffect(() => { void load(); }, []);

  async function reviewAll() {
    setWorking(true);
    setMsg(null);
    try {
      const { run } = await radarApi<{ run: MonitoringRun }>("/api/radar/monitoreo/revisar", { method: "POST" });
      const t = run.totals;
      trackRadar("radar_scan_completed", { count: t.created, status: run.status, action: "todas" });
      setMsg({ text: `Revisión lista: ${t.sources} fuentes, ${t.created} vacantes nuevas, ${t.closed} cerradas${t.errors ? `, ${t.errors} con error` : ""}.`, tone: t.errors ? "error" : "info" });
      await load();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "No se pudo revisar.", tone: "error" });
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className={`${card} p-5`} aria-labelledby="ajustes-estado">
      <h2 id="ajustes-estado" className="text-lg font-bold">Estado del monitoreo</h2>
      {error && <div className="mt-2"><Notice tone="error">{error}</Notice></div>}
      {!st && !error && <p className="mt-2 text-sm text-muted">Cargando…</p>}
      {st && (
        <>
          <p className="mt-2">{enabled ? <Tag tone="ok">Radar activo</Tag> : <Tag tone="warn">Pausado: no se revisa solo ni se envían avisos</Tag>}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-muted">Última ejecución</dt><dd>{st.lastRun ? `${ago(st.lastRun.startedAt)} (${TRIGGER[st.lastRun.trigger] ?? st.lastRun.trigger})` : "Ninguna"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Fuentes al día</dt><dd>{st.sources.verified} de {st.sources.expected}{st.sources.manual ? ` · ${st.sources.manual} manual` : ""}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Con error</dt><dd className={st.sources.errors ? "font-semibold text-danger-dark" : ""}>{st.sources.errors}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-muted">Próximo ciclo</dt><dd>{!enabled ? "Pausado" : st.nextDueAt ? fmtDate(st.nextDueAt) : st.sources.expected ? "En la próxima corrida diaria" : "Sin fuentes para revisar"}</dd></div>
          </dl>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={btnDark} disabled={working || !st?.sources.expected} onClick={() => void reviewAll()}>{working ? "Revisando…" : "Revisar ahora"}</button>
        <button type="button" className={btnGhost} disabled={!st?.history.length} onClick={() => setHistory(true)}>Ver historial</button>
      </div>
      <p className="mt-1 text-xs text-muted">«Revisar ahora» lee todas tus empresas; se puede una vez cada 30 minutos.</p>
      {msg && <div className="mt-2" role="status"><Notice tone={msg.tone === "error" ? "error" : "info"}>{msg.text}</Notice></div>}
      <Drawer title="Historial de revisiones" open={history} onClose={() => setHistory(false)}>
        <ul className="space-y-3">
          {st?.history.map((r) => (
            <li key={r.id} className="rounded-xl p-3 text-sm ring-1 ring-black/[0.08]">
              <p className="font-semibold">{fmtDate(r.startedAt)} {new Date(r.startedAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })} · {TRIGGER[r.trigger] ?? r.trigger}</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                {r.items.map((i) => (
                  <li key={i.sourceId}>
                    {RUN_LABEL[i.status] ?? i.status} · {i.received} leídas · {i.created} nuevas · {i.closed} cerradas
                    {i.error && <span className="text-danger-dark"> · {i.error}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Drawer>
    </section>
  );
}

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const FREQ_LABEL: Record<Frequency, string> = { diaria: "Diaria", semanal: "Semanal", mensual: "Mensual", pausada: "Pausada" };
const WEIGHTS: [keyof MatchWeights, string][] = [
  ["experiencia", "Experiencia y competencias"],
  ["seniority", "Seniority y alcance"],
  ["ubicacion", "Ubicación y elegibilidad"],
  ["compensacion", "Compensación y equity"],
  ["interes", "Interés por empresa o sector"],
];

function Toggle({ checked, onChange, label, hint, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; id: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${checked ? "bg-forest" : "bg-black/20"}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
        <span className="sr-only">{checked ? "Activado" : "Desactivado"}</span>
      </button>
    </div>
  );
}

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

/** Automatización: guarda y lee las preferencias de monitoreo. En esta etapa no ejecuta revisiones ni envía avisos. */
export default function SettingsView() {
  const { email } = useAuth();
  const [s, setS] = useState<RadarSettings | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const zones = useMemo(timezones, []);

  useEffect(() => {
    if (!email) return;
    radarApi<{ settings: RadarSettings }>("/api/radar/ajustes")
      .then(({ settings }) => {
        // Primera vez: la zona horaria del navegador.
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const next = settings.updatedAt ? settings : { ...settings, timezone: tz || settings.timezone };
        setS(next);
        setSaved(JSON.stringify(settings));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No pudimos cargar tus preferencias."));
  }, [email]);

  if (email === undefined) return <Skeleton rows={6} />;
  if (email === null)
    return (
      <EmptyState title="Ingresá para configurar Radar" actions={<button type="button" className={btnDark} onClick={() => void requestLogin("usar Radar laboral")}>Ingresar con Google</button>}>
        <p>Tus preferencias de monitoreo se guardan en tu cuenta.</p>
      </EmptyState>
    );
  if (error && !s) return <Notice tone="error">{error}</Notice>;
  if (!s) return <Skeleton rows={6} />;

  const total = Object.values(s.weights).reduce((a, b) => a + b, 0);
  const up = (patch: Partial<RadarSettings>) => setS({ ...s, ...patch });
  const upE = (patch: Partial<RadarEligibilityPrefs>) => setS({ ...s, eligibility: { ...s.eligibility, ...patch } });
  const dirty = JSON.stringify({ ...s, updatedAt: null }) !== JSON.stringify({ ...JSON.parse(saved || "{}"), updatedAt: null });

  async function save() {
    if (!s) return;
    if (total !== 100) {
      setError(`Los pesos del match tienen que sumar 100 (ahora suman ${total}).`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { settings } = await radarApi<{ settings: RadarSettings }>("/api/radar/ajustes", { method: "PUT", body: s });
      setS(settings);
      setSaved(JSON.stringify(settings));
      toast.show("Preferencias guardadas");
      trackRadar("radar_settings_saved", { status: settings.enabled ? "activo" : "pausado", action: settings.channels.email ? "email" : "in_app" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Notice>Con Radar activo, Maru revisa tus empresas una vez por día según estas frecuencias, evalúa lo nuevo y te avisa en Oportunidades. El email es opcional y nunca se postula por vos.</Notice>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <section className={`${card} p-5`} aria-labelledby="ajustes-frecuencia">
            <h2 id="ajustes-frecuencia" className="text-lg font-bold">Frecuencia de monitoreo</h2>
            <Toggle id="radar-activo" checked={s.enabled} onChange={(enabled) => up({ enabled })} label="Radar activo" hint="Maru revisa las fuentes de las empresas que seguís." />
            {(["P1", "P2", "P3"] as const).map((p) => (
              <div key={p} className="flex items-center justify-between gap-4 border-t border-line py-3">
                <label htmlFor={`freq-${p}`} className="text-sm">
                  <span className="font-semibold">Prioridad {p.slice(1)}</span>
                  <span className="block text-xs text-muted">{p === "P1" ? "Empresas soñadas · objetivo 20" : p === "P2" ? "Empresas objetivo · objetivo 100" : "Para explorar"}</span>
                </label>
                <select id={`freq-${p}`} value={s.frequencies[p]} onChange={(e) => up({ frequencies: { ...s.frequencies, [p]: e.target.value as Frequency } })} className={`${field.replace("w-full ", "")} w-36 shrink-0`}>
                  {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
                </select>
              </div>
            ))}
            <button type="button" className={`${btnGhost} mt-2`} onClick={() => up({ frequencies: { P1: "semanal", P2: "semanal", P3: "semanal" } })}>Semanal para todas</button>
          </section>

          <section className={`${card} p-5`} aria-labelledby="ajustes-elegibilidad">
            <h2 id="ajustes-elegibilidad" className="text-lg font-bold">Dónde podés trabajar</h2>
            <p className="mt-1 text-xs text-muted">Lo usa el match para saber si una vacante te deja afuera. Maru no lo deduce de tu CV ni de tu nombre: si no lo declarás, esas vacantes quedan «por verificar».</p>
            <fieldset className="mt-3">
              <legend className="text-sm font-semibold">Países donde podés trabajar legalmente</legend>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                {COUNTRY_OPTIONS.map(([code, name]) => (
                  <label key={code} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ink"
                      checked={s.eligibility.authorizedCountries.includes(code)}
                      onChange={(e) => {
                        const set = new Set(s.eligibility.authorizedCountries);
                        if (e.target.checked) set.add(code);
                        else set.delete(code);
                        upE({ authorizedCountries: COUNTRY_OPTIONS.map(([c]) => c).filter((c) => set.has(c)) });
                      }}
                    />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="radar-reloc">Relocalización</Label>
                <select id="radar-reloc" value={s.eligibility.relocation} onChange={(e) => upE({ relocation: e.target.value as RadarEligibilityPrefs["relocation"] })} className={field}>
                  <option value="si">Me mudaría</option>
                  <option value="a_conversar">A conversar</option>
                  <option value="no">No me mudaría</option>
                </select>
              </div>
              <div>
                <Label htmlFor="radar-modalidad">Modalidad</Label>
                <select id="radar-modalidad" value={s.eligibility.remote} onChange={(e) => upE({ remote: e.target.value as RadarEligibilityPrefs["remote"] })} className={field}>
                  <option value="cualquiera">Cualquiera</option>
                  <option value="remoto_o_hibrido">Remoto o híbrido</option>
                  <option value="solo_remoto">Sólo remoto</option>
                </select>
              </div>
              <div>
                <Label htmlFor="radar-min" hint="(opcional)">Mínimo mensual USD</Label>
                <input
                  id="radar-min"
                  type="number"
                  min={0}
                  step={100}
                  inputMode="numeric"
                  value={s.eligibility.minMonthlyUsd ?? ""}
                  onChange={(e) => upE({ minMonthlyUsd: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                  className={field}
                  placeholder="Ej. 5000"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">Los roles, el nivel y tu experiencia salen de tu CV y tus preferencias en Match.</p>
          </section>

          <section className={`${card} p-5`} aria-labelledby="ajustes-alertas">
            <h2 id="ajustes-alertas" className="text-lg font-bold">Alertas y resumen semanal</h2>
            <Toggle id="radar-alertas" checked={s.instantAlerts.enabled} onChange={(enabled) => up({ instantAlerts: { ...s.instantAlerts, enabled } })} label="Alertas inmediatas de P1" hint="Sólo con match alto y sin requisitos que te dejen afuera." />
            <div className="flex items-center justify-between gap-4 border-t border-line py-3">
              <label htmlFor="radar-umbral" className="text-sm font-semibold">Match mínimo para alertar</label>
              <select id="radar-umbral" value={s.instantAlerts.threshold} onChange={(e) => up({ instantAlerts: { ...s.instantAlerts, threshold: Number(e.target.value) } })} className={`${field.replace("w-full ", "")} w-28 shrink-0`}>
                {[80, 85, 90, 95].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="border-t border-line">
              <Toggle id="radar-digest" checked={s.digest.enabled} onChange={(enabled) => up({ digest: { ...s.digest, enabled } })} label="Resumen semanal" hint="Las mejores 5 oportunidades, cambios, errores y cobertura." />
            </div>
            <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="radar-dia">Día</Label>
                <select id="radar-dia" value={s.digest.day} onChange={(e) => up({ digest: { ...s.digest, day: Number(e.target.value) } })} className={field}>
                  {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="radar-hora">Hora</Label>
                <input id="radar-hora" type="time" value={s.digest.time} onChange={(e) => up({ digest: { ...s.digest, time: e.target.value } })} className={field} />
              </div>
              <div>
                <Label htmlFor="radar-tz">Zona horaria</Label>
                {zones.length ? (
                  <select id="radar-tz" value={s.timezone} onChange={(e) => up({ timezone: e.target.value })} className={field}>
                    {!zones.includes(s.timezone) && <option value={s.timezone}>{s.timezone}</option>}
                    {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                  </select>
                ) : (
                  <input id="radar-tz" value={s.timezone} onChange={(e) => up({ timezone: e.target.value })} className={field} placeholder="America/Argentina/Buenos_Aires" />
                )}
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-sm font-semibold">Canales</p>
              <p className="mt-1 text-sm">En Maru <Tag tone="ok">Siempre</Tag></p>
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.channels.email} onChange={(e) => up({ channels: { ...s.channels, email: e.target.checked } })} className="h-4 w-4 accent-ink" />
                Quiero recibir las alertas y el resumen también por email
              </label>
              <p className="mt-1 text-xs text-muted">Se mandan a {email}. Cada email trae un link para darte de baja. Nada de WhatsApp.</p>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <MonitoringPanel enabled={s.enabled} />

          <section className={`${card} p-5`} aria-labelledby="ajustes-pesos">
            <h2 id="ajustes-pesos" className="text-lg font-bold">Pesos del match</h2>
            <p className="mt-1 text-xs text-muted">Tienen que sumar 100. Un requisito excluyente confirmado no se compensa con un score alto.</p>
            <div className="mt-3 space-y-3">
              {WEIGHTS.map(([k, label]) => (
                <div key={k} className="flex items-center gap-3">
                  <label htmlFor={`peso-${k}`} className="flex-1 text-sm">{label}</label>
                  <input
                    id={`peso-${k}`}
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={s.weights[k]}
                    onChange={(e) => up({ weights: { ...s.weights, [k]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) } })}
                    className={`${field.replace("w-full ", "")} w-20 shrink-0 text-right`}
                  />
                </div>
              ))}
            </div>
            <p className={`mt-3 text-sm font-semibold ${total === 100 ? "text-brand-dark" : "text-danger-dark"}`} aria-live="polite">
              Total: {total} {total === 100 ? "✓" : total < 100 ? `(faltan ${100 - total})` : `(sobran ${total - 100})`}
            </p>
          </section>
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={btnDark} disabled={saving || !dirty} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar preferencias"}</button>
        {!dirty && s.updatedAt && <span className="text-sm text-muted">Guardado</span>}
      </div>
      {toast.node}
    </div>
  );
}
