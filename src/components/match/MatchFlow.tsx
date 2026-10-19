"use client";

import AppShell from "@/components/app/AppShell";
import SiteShell from "@/components/SiteShell";
import { useEffect, useRef, useState } from "react";
import { EMPTY_STATE, forgetEverything, loadMatch, saveMatch, type MatchState } from "@/lib/match/clientStore";
import { track } from "@/lib/match/events";
import { profileToMatch } from "@/lib/match/profile";
import type { MatchPrefs, MatchProfile } from "@/lib/match/types";
import { forgetAccountData, SYNC_EVENT } from "@/lib/sync/client";
import { saveProfile } from "@/lib/profileStore";
import type { Profile } from "@/lib/schemas";
import CvSourceField, { useCvInput } from "../CvSourceField";
import type { Stat } from "@/lib/products";
import { ProductHero, ProductMore, ToolHeading } from "../product/ProductLanding";
import { useInAppEntry } from "../product/useInAppEntry";
import { ErrorBanner, Loading, PrimaryButton, StepCard, post } from "../ui";
import PrefsForm, { EMPTY_PREFS } from "./PrefsForm";
import ProfileConfirm from "./ProfileConfirm";
import Results from "./Results";

type Stage = "cv" | "leyendo" | "confirmar" | "preferencias" | "resultados";

const LOADING = ["Leyendo tu CV…", "Ordenando tu experiencia…", "Detectando tus habilidades…"];

/** "Encontrá tu trabajo perfecto": CV → confirmar → preferencias → ranking. */
export default function MatchFlow({ stats }: { stats?: Stat[] }) {
  // Desde otra pantalla de Maru (#empezar) se va directo al primer paso, sin la presentación.
  const entry = useInAppEntry();
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<MatchState>(EMPTY_STATE);
  const [stage, setStage] = useState<Stage>("cv");
  const [error, setError] = useState("");
  const cv = useCvInput();
  const topRef = useRef<HTMLDivElement>(null);
  const skipSave = useRef(true);

  useEffect(() => {
    const refresh = () => {
      const s = loadMatch();
      skipSave.current = true;
      setState(s);
      if (s.profile && s.prefs) setStage("resultados");
      else if (s.profile) setStage("preferencias");
      else setStage("cv");
      setHydrated(true);
    };
    refresh();
    const onSync = (e: Event) => { if ((e as CustomEvent).detail?.doc === "match") refresh(); };
    const onStorage = (e: StorageEvent) => { if (e.key === "maru:match:v1") refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SYNC_EVENT, onSync);
    track("match_inicio");
    return () => { window.removeEventListener(SYNC_EVENT, onSync); window.removeEventListener("storage", onStorage); };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) { skipSave.current = false; return; }
    saveMatch(state);
  }, [state, hydrated]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  const update = (patch: Partial<MatchState>) => setState((s) => ({ ...s, ...patch }));

  async function readCv() {
    setError("");
    setStage("leyendo");
    try {
      let profile: Profile;
      if (cv.savedProfile) profile = cv.savedProfile;
      else {
        const res = await post<{ profile: Profile }>("/api/profile", { source: cv.source });
        profile = res.profile;
        saveProfile(profile);
      }
      update({ profile: profileToMatch(profile) });
      track("match_cv_listo");
      setStage("confirmar");
    } catch (e) {
      const err = e as Error & { code?: string };
      setStage("cv");
      setError(err.message);
      // PDF escaneado o ilegible: ofrecemos pegar el texto.
      if (err.code === "CV_UNREADABLE" || err.code === "CV_INVALID" || err.code === "CV_TOO_LARGE") cv.fallbackToText();
    }
  }

  async function wipe() {
    if (!window.confirm("¿Borrar tus datos de este navegador y, si ingresaste, de tu cuenta? Perfil, preferencias, búsquedas, lo que armaste y tu seguimiento.")) return;
    forgetEverything();
    cv.forgetSaved();
    setState(EMPTY_STATE);
    setStage("cv");
    try { await forgetAccountData(); track("match_datos_borrados"); }
    catch (err) { setError(err instanceof Error ? err.message : "No pudimos confirmar el borrado de tu cuenta."); }
  }

  if (!hydrated) return <SiteShell><div className="min-h-[50vh]" /></SiteShell>;

  const content = (
    <div ref={topRef} className="scroll-mt-24">
      <ErrorBanner message={error} />

      {stage === "cv" && (
        <>
          {!entry.inApp && <ProductHero id="match" stats={stats} />}
          <ToolHeading compact={entry.inApp} />
          <div className="mt-10 space-y-6">
            <StepCard n={1} title="Tu CV" hint="Reutilizamos el que ya cargaste en Maru o subís uno nuevo. Queda guardado en este navegador y, si ingresás, en tu cuenta.">
              <CvSourceField input={cv} />
            </StepCard>
            <div className="flex flex-col items-center gap-3 pt-2">
              <PrimaryButton onClick={readCv} disabled={!cv.ready}>
                Seguir
              </PrimaryButton>
              {state.profile && (
                <button type="button" onClick={() => setStage("confirmar")} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
                  Seguir con mi perfil anterior
                </button>
              )}
            </div>
          </div>
          {!entry.inApp && <ProductMore id="match" />}
        </>
      )}

      {stage === "leyendo" && <Loading messages={LOADING} />}

      {stage === "confirmar" && state.profile && (
        <ProfileConfirm
          profile={state.profile}
          setProfile={(p: MatchProfile) => update({ profile: p })}
          onBack={() => setStage("cv")}
          onNext={() => {
            track("match_perfil_confirmado");
            if (!state.prefs) update({ prefs: { ...EMPTY_PREFS, ciudad: guessCity(state.profile!.location) } });
            setStage(state.prefs ? "resultados" : "preferencias");
          }}
        />
      )}

      {stage === "preferencias" && state.profile && (
        <PrefsForm
          prefs={state.prefs ?? { ...EMPTY_PREFS, ciudad: guessCity(state.profile.location) }}
          setPrefs={(p: MatchPrefs) => update({ prefs: p })}
          profile={state.profile}
          setProfile={(p) => update({ profile: p })}
          onBack={() => setStage("confirmar")}
          onNext={() => {
            if (!state.prefs) update({ prefs: { ...EMPTY_PREFS, ciudad: guessCity(state.profile!.location) } });
            track("match_preferencias_listas");
            setStage("resultados");
          }}
        />
      )}

      {stage === "resultados" && state.profile && state.prefs && (
        <Results
          profile={state.profile}
          prefs={state.prefs}
          interactions={state.interactions}
          setInteractions={(i) => update({ interactions: i })}
          external={state.external}
          setExternal={(e) => update({ external: e })}
          onEditProfile={() => setStage("confirmar")}
          onEditPrefs={() => setStage("preferencias")}
        />
      )}

      {stage !== "leyendo" && (state.profile || state.prefs) && (
        <p className="mt-12 text-center text-xs text-muted">
          Tu perfil y tus preferencias se guardan en este navegador y, si ingresás, en tu cuenta; para ordenar las búsquedas se envían a Maru sin quedar registrados.{" "}
          <button type="button" onClick={wipe} className="underline underline-offset-4 hover:text-brand-dark">
            Borrar mis datos
          </button>
        </p>
      )}
    </div>
  );
  return stage === "resultados" ? <AppShell title="Mi match">{content}</AppShell> : <SiteShell>{content}</SiteShell>;
}

function guessCity(location: string): string {
  return location.split(",")[0]?.trim() ?? "";
}
