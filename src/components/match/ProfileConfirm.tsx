"use client";

import type { MatchProfile } from "@/lib/match/types";
import { PrimaryButton, StepCard, inputClass } from "../ui";
import { Field, ListInput } from "./fields";

/** Paso B: la persona confirma (y corrige) lo que Maru entendió de su CV. */
export default function ProfileConfirm({
  profile,
  setProfile,
  onNext,
  onBack,
}: {
  profile: MatchProfile;
  setProfile: (p: MatchProfile) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const set = <K extends keyof MatchProfile>(k: K, v: MatchProfile[K]) => setProfile({ ...profile, [k]: v });
  return (
    <StepCard n={2} title="¿Entendimos bien tu perfil?" hint="Corregí lo que haga falta. Para ordenar usamos sólo datos profesionales: nunca edad, foto ni género.">
      <div className="space-y-6">
        <Field label="Tu titular profesional">
          <input value={profile.headline} onChange={(e) => set("headline", e.target.value)} className={inputClass} placeholder="Ej.: Analista de datos con foco en fintech" />
        </Field>
        <Field label="Tus cargos, del más reciente al más antiguo" hint="Uno por renglón.">
          <ListInput multiline value={profile.titles} onChange={(v) => set("titles", v)} label="Cargos" />
        </Field>
        <Field label="Habilidades y herramientas" hint="Separadas por coma. Si manejás algo que no está en tu CV, sumalo acá.">
          <ListInput value={profile.skills} onChange={(v) => set("skills", v)} label="Habilidades" placeholder="SQL, Excel, negociación, Salesforce…" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Años de experiencia (aprox.)">
            <input
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              value={profile.yearsExperience ?? ""}
              onChange={(e) => set("yearsExperience", e.target.value === "" ? null : Math.max(0, Math.min(60, Number(e.target.value))))}
              className={inputClass}
            />
          </Field>
          <Field label="Dónde vivís">
            <input value={profile.location} onChange={(e) => set("location", e.target.value)} className={inputClass} placeholder="Ciudad, provincia" />
          </Field>
        </div>
      </div>
      <div className="mt-8 flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-muted hover:text-ink">
          ← Cambiar CV
        </button>
        <PrimaryButton onClick={onNext} disabled={!profile.titles.length && !profile.skills.length}>
          Sí, es así
        </PrimaryButton>
      </div>
    </StepCard>
  );
}
