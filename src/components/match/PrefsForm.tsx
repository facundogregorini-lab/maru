"use client";

import { CONTRACT_LABEL, SENIORITY_LABEL, WORKPLACE_OPTIONS } from "@/lib/match/labels";
import type { EmploymentType, Hardable, MatchPrefs, MatchProfile, Seniority } from "@/lib/match/types";
import { Chips, PrimaryButton, StepCard, inputClass } from "../ui";
import { Field, ListInput, MultiChips } from "./fields";

export const EMPTY_PREFS: MatchPrefs = {
  objetivo: "",
  rolesDeseados: [],
  evitar: [],
  ciudad: "",
  pais: "Argentina",
  otrosLugares: [],
  autorizacion: [],
  modalidades: [],
  seniorities: [],
  contratos: [],
  salario: null,
  indispensables: [],
  carrera: "ambas",
};

const SENIORITY_OPTIONS = Object.entries(SENIORITY_LABEL) as [Seniority, string][];
const CONTRACT_OPTIONS = Object.entries(CONTRACT_LABEL) as [EmploymentType, string][];
const HARD_OPTIONS: [Hardable, string][] = [
  ["modalidad", "Modalidad"],
  ["ubicacion", "Ubicación"],
  ["seniority", "Seniority"],
  ["contrato", "Tipo de contrato"],
  ["salario", "Salario"],
  ["idioma", "Idiomas"],
];
const LEVELS = ["Básico", "Intermedio", "Avanzado", "Nativo o bilingüe"];

/** Paso C: qué trabajo quiere y en qué condiciones. Todo editable sin volver a subir el CV. */
export default function PrefsForm({
  prefs,
  setPrefs,
  profile,
  setProfile,
  onNext,
  onBack,
}: {
  prefs: MatchPrefs;
  setPrefs: (p: MatchPrefs) => void;
  profile: MatchProfile;
  setProfile: (p: MatchProfile) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const set = <K extends keyof MatchPrefs>(k: K, v: MatchPrefs[K]) => setPrefs({ ...prefs, [k]: v });
  const sal = prefs.salario ?? { monto: null, moneda: "USD" as const, periodo: "mes" as const, tipo: "bruto" as const };
  const ready = prefs.rolesDeseados.length > 0 || prefs.objetivo.trim().length > 3;

  return (
    <StepCard n={3} title="¿Qué estás buscando?" hint="Con esto ordenamos las búsquedas. Lo que marques como indispensable filtra; el resto suma como preferencia.">
      <div className="space-y-7">
        <Field label="¿Qué te gustaría hacer?" hint="Contalo con tus palabras y sumá los roles que te interesan.">
          <textarea rows={3} value={prefs.objetivo} onChange={(e) => set("objetivo", e.target.value)} className={inputClass} placeholder="Ej.: quiero liderar equipos de marketing de performance en una fintech" />
          <ListInput value={prefs.rolesDeseados} onChange={(v) => set("rolesDeseados", v)} label="Roles deseados" placeholder="Roles, separados por coma: Product Manager, Growth Lead…" />
        </Field>

        <Field label="¿Buscás continuidad o un cambio de carrera?">
          <Chips
            value={prefs.carrera}
            onChange={(v) => set("carrera", v)}
            options={[
              ["continuidad", "Seguir en lo mío"],
              ["cambio", "Cambiar de área"],
              ["ambas", "Abierto a las dos"],
            ]}
          />
        </Field>

        <Field label="¿Qué roles o tareas querés evitar?" hint="Si el título del puesto los menciona, no te lo mostramos.">
          <ListInput value={prefs.evitar} onChange={(v) => set("evitar", v)} label="Evitar" placeholder="Ej.: call center, ventas en frío" />
        </Field>

        <Field label="¿Dónde vivís y dónde aceptarías trabajar?">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={prefs.ciudad} onChange={(e) => set("ciudad", e.target.value)} className={inputClass} placeholder="Tu ciudad (ej.: Buenos Aires)" aria-label="Ciudad" />
            <input value={prefs.pais} onChange={(e) => set("pais", e.target.value)} className={inputClass} placeholder="País" aria-label="País" />
          </div>
          <ListInput value={prefs.otrosLugares} onChange={(v) => set("otrosLugares", v)} label="Otros lugares" placeholder="Otras ciudades donde irías presencial o híbrido (opcional)" />
          <ListInput
            value={prefs.autorizacion}
            onChange={(v) => set("autorizacion", v)}
            label="Autorización de trabajo"
            placeholder="Opcional: otros países donde podés trabajar legalmente (ej.: Italia, Unión Europea)"
          />
        </Field>

        <Field label="¿Remoto, híbrido o presencial?">
          <MultiChips value={prefs.modalidades} onChange={(v) => set("modalidades", v)} options={WORKPLACE_OPTIONS} />
        </Field>

        <Field label="¿Qué seniority buscás?">
          <MultiChips value={prefs.seniorities} onChange={(v) => set("seniorities", v)} options={SENIORITY_OPTIONS} />
        </Field>

        <Field label="¿Qué tipo de contrato?">
          <MultiChips value={prefs.contratos} onChange={(v) => set("contratos", v)} options={CONTRACT_OPTIONS} />
        </Field>

        <Field label="¿Qué idiomas manejás?" hint="Tomamos los de tu CV; ajustá el nivel si hace falta.">
          <div className="space-y-2">
            {profile.languages.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  value={l.language}
                  onChange={(e) => setProfile({ ...profile, languages: profile.languages.map((x, j) => (j === i ? { ...x, language: e.target.value } : x)) })}
                  className={`${inputClass} max-w-[12rem]`}
                  aria-label="Idioma"
                />
                <select
                  value={LEVELS.includes(l.level) ? l.level : ""}
                  onChange={(e) => setProfile({ ...profile, languages: profile.languages.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)) })}
                  className={`${inputClass} max-w-[14rem]`}
                  aria-label="Nivel"
                >
                  <option value="">{l.level && !LEVELS.includes(l.level) ? l.level : "Nivel"}</option>
                  {LEVELS.map((lv) => (
                    <option key={lv}>{lv}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setProfile({ ...profile, languages: profile.languages.filter((_, j) => j !== i) })} className="text-sm text-muted hover:text-brand-dark">
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setProfile({ ...profile, languages: [...profile.languages, { language: "", level: "" }] })}
              className="text-sm text-brand-dark underline decoration-brand/40 underline-offset-4"
            >
              + Agregar idioma
            </button>
          </div>
        </Field>

        <Field label="¿Tenés una expectativa salarial?" hint="Opcional. No mostramos los avisos que publican un máximo menor. Si un aviso no informa salario, lo estimamos y te avisamos cuando parece menor.">
          <div className="grid gap-3 sm:grid-cols-4">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={sal.monto ?? ""}
              onChange={(e) => set("salario", e.target.value === "" ? null : { ...sal, monto: Math.max(0, Number(e.target.value)) })}
              className={inputClass}
              placeholder="Monto"
              aria-label="Monto"
            />
            <select value={sal.moneda} onChange={(e) => set("salario", { ...sal, moneda: e.target.value as typeof sal.moneda })} className={inputClass} aria-label="Moneda">
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
              <option value="EUR">EUR</option>
            </select>
            <select value={sal.periodo} onChange={(e) => set("salario", { ...sal, periodo: e.target.value as typeof sal.periodo })} className={inputClass} aria-label="Período">
              <option value="mes">por mes</option>
              <option value="anio">por año</option>
            </select>
            <select value={sal.tipo} onChange={(e) => set("salario", { ...sal, tipo: e.target.value as typeof sal.tipo })} className={inputClass} aria-label="Bruto o neto">
              <option value="bruto">bruto</option>
              <option value="neto">neto</option>
            </select>
          </div>
        </Field>

        <Field label="¿Qué condiciones son indispensables?" hint="Si un aviso no cumple una indispensable, no lo mostramos. Si no informa el dato, te avisamos que falta confirmarlo. El seniority y el salario que elegiste ya filtran aunque no los marques.">
          <MultiChips value={prefs.indispensables} onChange={(v) => set("indispensables", v)} options={HARD_OPTIONS} />
        </Field>
      </div>

      <div className="mt-8 flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-muted hover:text-ink">
          ← Volver a mi perfil
        </button>
        <div className="flex flex-col items-center gap-2">
          <PrimaryButton onClick={onNext} disabled={!ready}>
            Ver mis búsquedas
          </PrimaryButton>
          {!ready && <p className="text-xs text-muted">Contanos qué te gustaría hacer o sumá al menos un rol.</p>}
        </div>
      </div>
    </StepCard>
  );
}
