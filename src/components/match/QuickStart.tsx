"use client";

import { useState } from "react";
import { track } from "@/lib/match/events";
import type { MatchPrefs, MatchProfile } from "@/lib/match/types";
import { PrimaryButton, StepCard } from "../ui";
import { PrefsFields } from "./PrefsForm";
import { ProfileFields } from "./ProfileConfirm";

/**
 * Paso único después del CV: lo que entendimos y "Ver mis búsquedas". Corregir el perfil y decir qué busca
 * (roles, modalidad, seniority, salario, indispensables) queda plegado en "Personalización avanzada":
 * sigue disponible para quien quiera afinar, sin frenar al resto. Sin cargos ni habilidades se abre solo.
 */
export default function QuickStart({
  profile,
  setProfile,
  prefs,
  setPrefs,
  onNext,
  onBack,
}: {
  profile: MatchProfile;
  setProfile: (p: MatchProfile) => void;
  prefs: MatchPrefs;
  setPrefs: (p: MatchPrefs) => void;
  onNext: (personalizacion: boolean) => void;
  onBack: () => void;
}) {
  const canGo = profile.titles.length > 0 || profile.skills.length > 0;
  const [open, setOpen] = useState(!canGo);
  const [opened, setOpened] = useState(false);
  const facts = [profile.yearsExperience ? `${profile.yearsExperience} años de experiencia` : "", profile.location].filter(Boolean);

  const cta = (
    <div className="flex flex-col items-center gap-2">
      <PrimaryButton onClick={() => onNext(opened)} disabled={!canGo}>
        Ver mis búsquedas
      </PrimaryButton>
      {!canGo && <p className="text-xs text-muted">No encontramos cargos ni habilidades en tu CV: sumá al menos uno abajo.</p>}
    </div>
  );

  return (
    <StepCard n={2} title="Así entendimos tu perfil" hint="Con esto ordenamos las búsquedas. Para ordenar usamos sólo datos profesionales: nunca edad, foto ni género.">
      <div className="rounded-2xl bg-white p-5">
        {profile.headline && <p className="font-semibold leading-snug">{profile.headline}</p>}
        {profile.titles.length > 0 && <p className="mt-1 text-sm text-ink/70">{profile.titles.slice(0, 3).join(" · ")}</p>}
        {facts.length > 0 && <p className="mt-1 text-sm text-ink/70">{facts.join(" · ")}</p>}
        {profile.skills.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {profile.skills.slice(0, 10).map((s, i) => (
              <li key={`${i}-${s}`} className="rounded-md bg-[#f2f4f5] px-2.5 py-1 text-xs">
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="px-4 py-2 text-sm text-muted hover:text-ink">
          ← Cambiar CV
        </button>
        {cta}
      </div>

      <details
        open={open}
        onToggle={(e) => {
          const now = (e.currentTarget as HTMLDetailsElement).open;
          // Sólo cuenta la apertura de la persona (sin cargos ni habilidades se abre sola).
          if (now && !open) setOpened(true);
          setOpen(now);
        }}
        className="group mt-6 rounded-2xl bg-white p-5"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-semibold leading-tight">Personalización avanzada (opcional)</span>
            <span className="mt-1 block text-sm text-ink/70">Corregí tu perfil y contanos qué buscás: roles, modalidad, seniority, salario e indispensables. Podés escribir o dictar con el micrófono.</span>
          </span>
          <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f2f4f5] transition group-open:rotate-180">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </span>
        </summary>
        <div className="mt-6 space-y-8">
          <section>
            <h3 className="mb-4 text-lg font-semibold">Tu perfil</h3>
            <ProfileFields profile={profile} setProfile={setProfile} />
          </section>
          <section>
            <h3 className="mb-1 text-lg font-semibold">Lo que buscás</h3>
            <p className="mb-4 text-sm text-ink/70">Lo que marques como indispensable filtra; el resto suma como preferencia.</p>
            <PrefsFields prefs={prefs} setPrefs={setPrefs} profile={profile} setProfile={setProfile} />
          </section>
          {cta}
        </div>
      </details>
    </StepCard>
  );
}

/** Eventos del paso rápido: los mismos dos pasos de antes, para no cortar el funnel, más si abrió la personalización. */
export function trackQuickStart(personalizacion: boolean): void {
  const props = { personalizacion: personalizacion ? "abierta" : "cerrada" };
  track("match_perfil_confirmado", props);
  track("match_preferencias_listas", props);
}
