"use client";

import type { MatchProfile } from "@/lib/match/types";
import { parseSpokenNumber, replaceSpoken } from "@/lib/voice";
import { PrimaryButton, StepCard } from "../ui";
import { DictateField } from "../VoiceButton";
import { Field, ListInput, dictateInputClass } from "./fields";

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
  return (
    <StepCard n={2} title="¿Entendimos bien tu perfil?" hint="Corregí lo que haga falta. Para ordenar usamos sólo datos profesionales: nunca edad, foto ni género.">
      <ProfileFields profile={profile} setProfile={setProfile} />
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

/** Los campos del perfil, sin tarjeta ni botones: también van plegados en el paso rápido del match. */
export function ProfileFields({ profile, setProfile }: { profile: MatchProfile; setProfile: (p: MatchProfile) => void }) {
  const set = <K extends keyof MatchProfile>(k: K, v: MatchProfile[K]) => setProfile({ ...profile, [k]: v });
  return (
    <div className="space-y-6">
      <Field label="Tu titular profesional">
        <DictateField onText={(t, first) => set("headline", replaceSpoken(profile.headline, t, first))}>
          <input value={profile.headline} onChange={(e) => set("headline", e.target.value)} className={dictateInputClass} placeholder="Ej.: Analista de datos con foco en fintech" />
        </DictateField>
      </Field>
      <Field label="Tus cargos, del más reciente al más antiguo" hint="Uno por renglón.">
        <ListInput multiline value={profile.titles} onChange={(v) => set("titles", v)} label="Cargos" />
      </Field>
      <Field label="Habilidades y herramientas" hint="Separadas por coma. Si manejás algo que no está en tu CV, sumalo acá.">
        <ListInput value={profile.skills} onChange={(v) => set("skills", v)} label="Habilidades" placeholder="SQL, Excel, negociación, Salesforce…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Años de experiencia (aprox.)">
          <DictateField
            onText={(t) => {
              const n = parseSpokenNumber(t);
              if (n === null) return false;
              set("yearsExperience", Math.max(0, Math.min(60, n)));
            }}
          >
            <input
              type="number"
              min={0}
              max={60}
              inputMode="numeric"
              value={profile.yearsExperience ?? ""}
              onChange={(e) => set("yearsExperience", e.target.value === "" ? null : Math.max(0, Math.min(60, Number(e.target.value))))}
              className={dictateInputClass}
            />
          </DictateField>
        </Field>
        <Field label="Dónde vivís">
          <DictateField onText={(t, first) => set("location", replaceSpoken(profile.location, t, first))}>
            <input value={profile.location} onChange={(e) => set("location", e.target.value)} className={dictateInputClass} placeholder="Ciudad, provincia" />
          </DictateField>
        </Field>
      </div>
    </div>
  );
}
