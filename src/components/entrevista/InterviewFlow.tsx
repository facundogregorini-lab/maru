"use client";

import { useEffect, useRef, useState } from "react";
import type { EntrevistaOpciones, EntrevistaPlan, Informe, Intercambio } from "@/lib/schemas";
import { load, remove, save } from "@/lib/storage";
import { upsertTracked } from "@/lib/tracker";
import CvSourceField, { useCvInput } from "../CvSourceField";
import JobField, { useJobInput } from "../JobField";
import { Chips, ErrorBanner, Loading, PrimaryButton, StepCard, post } from "../ui";
import Call from "./Call";
import Report from "./Report";
import { ProductHero, ProductMore, ToolHeading } from "../product/ProductLanding";

type Stage = "inicio" | "preparando" | "llamada" | "evaluando" | "informe";
const SESSION_KEY = "maru:entrevista:v1";

const TIPOS: readonly (readonly [EntrevistaOpciones["tipo"], string])[] = [
  ["rrhh", "Primera entrevista (RR. HH.)"],
  ["hiring", "Con quien sería tu líder"],
  ["tecnica", "Técnica / caso"],
];
const DIFICULTADES: readonly (readonly [EntrevistaOpciones["dificultad"], string])[] = [
  ["amable", "Amable"],
  ["estandar", "Estándar"],
  ["exigente", "Exigente"],
];
const CANTIDADES: readonly (readonly ["4" | "6" | "8", string])[] = [
  ["4", "4 preguntas · ~10 min"],
  ["6", "6 preguntas · ~15 min"],
  ["8", "8 preguntas · ~20 min"],
];
const IDIOMAS: readonly (readonly [EntrevistaOpciones["idioma"], string])[] = [
  ["auto", "El de la búsqueda"],
  ["es", "Español"],
  ["en", "Inglés"],
  ["pt", "Portugués"],
];

type Session = {
  job: ReturnType<ReturnType<typeof useJobInput>["snapshot"]>;
  opciones: EntrevistaOpciones;
  plan: EntrevistaPlan;
  historial: Intercambio[];
  informe: Informe | null;
};

export default function InterviewFlow() {
  const [stage, setStage] = useState<Stage>("inicio");
  const [error, setError] = useState("");
  const job = useJobInput("entrevista");
  const cv = useCvInput();
  const [opciones, setOpciones] = useState<EntrevistaOpciones>({ tipo: "rrhh", dificultad: "estandar", preguntas: 6, idioma: "auto" });
  const [plan, setPlan] = useState<EntrevistaPlan | null>(null);
  const [historial, setHistorial] = useState<Intercambio[]>([]);
  const [informe, setInforme] = useState<Informe | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Retomamos el último informe si se recarga la página.
  useEffect(() => {
    // Llegó desde una búsqueda ("Entrená la entrevista"): empieza con esa, no con la práctica anterior.
    if (job.fromHandoff.current) {
      remove(SESSION_KEY);
      return;
    }
    const s = load<Session>(SESSION_KEY);
    if (!s?.plan) return;
    job.restore(s.job);
    setOpciones(s.opciones);
    setPlan(s.plan);
    setHistorial(s.historial);
    setInforme(s.informe);
    if (s.informe) setStage("informe");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (plan) save(SESSION_KEY, { job: job.snapshot(), opciones, plan, historial, informe } satisfies Session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, historial, informe, opciones]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  const canStart = job.ready && cv.ready;

  async function prepare() {
    setError("");
    setStage("preparando");
    try {
      const { plan } = await post<{ plan: EntrevistaPlan }>("/api/entrevista/preparar", { ...job.payload(), source: cv.source, opciones });
      setPlan(plan);
      setHistorial([]);
      setInforme(null);
      setStage("llamada");
    } catch (e) {
      const err = e as Error & { code?: string };
      setStage("inicio");
      setError(err.message);
      if (err.code === "JOB_FETCH_FAILED") job.fallbackToText();
      if (err.code === "CV_UNREADABLE" || err.code === "CV_INVALID" || err.code === "CV_TOO_LARGE") cv.fallbackToText();
    }
  }

  async function evaluate(h: Intercambio[]) {
    if (stage === "evaluando") return;
    setHistorial(h);
    if (!plan) return;
    if (!h.some((x) => x.respuesta.trim())) {
      setError("No llegaste a responder ninguna pregunta. Cuando quieras, probá de nuevo.");
      setStage("inicio");
      return;
    }
    setError("");
    setStage("evaluando");
    try {
      const { informe } = await post<{ informe: Informe }>("/api/entrevista/informe", { plan, opciones, historial: h });
      setInforme(informe);
      setStage("informe");
      // Si practicó para una búsqueda concreta, queda en el seguimiento.
      if (job.modo === "busqueda") {
        const o = job.origin;
        upsertTracked({
          id: o?.jobUrl === job.jobUrl.trim() ? o.id : undefined,
          title: plan.puesto || o?.title || "",
          company: plan.empresa || o?.company || "",
          jobUrl: job.jobUrl.trim(),
          jobText: job.jobText.trim() || undefined,
          artifact: "entrevista",
        });
      }
    } catch (e) {
      setError((e as Error).message);
      setStage("informe");
    }
  }

  function restart() {
    remove(SESSION_KEY);
    setPlan(null);
    setHistorial([]);
    setInforme(null);
    setStage("inicio");
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <ErrorBanner message={error} />

      {stage === "inicio" && (
        <>
          <ProductHero id="entrevista" />
          <ToolHeading />
          <div className="mt-10 space-y-6">
            <StepCard n={1} title="¿Para qué entrevista?" hint="Con la búsqueda, las preguntas apuntan a lo que piden. Sin búsqueda, al rol en general.">
              <JobField input={job} generalLabel="Un rol en general" />
            </StepCard>
            <StepCard n={2} title="Tu experiencia" hint="La entrevistadora la usa para preguntarte por lo que hiciste de verdad.">
              <CvSourceField input={cv} />
            </StepCard>
            <StepCard n={3} title="Cómo querés practicar" hint="Empezá amable y subí la dificultad a medida que ganes confianza.">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">Tipo de entrevista</p>
                  <Chips value={opciones.tipo} options={TIPOS} onChange={(tipo) => setOpciones((o) => ({ ...o, tipo }))} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Dificultad</p>
                  <Chips value={opciones.dificultad} options={DIFICULTADES} onChange={(dificultad) => setOpciones((o) => ({ ...o, dificultad }))} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Duración</p>
                  <Chips
                    value={String(opciones.preguntas) as "4" | "6" | "8"}
                    options={CANTIDADES}
                    onChange={(v) => setOpciones((o) => ({ ...o, preguntas: Number(v) as 4 | 6 | 8 }))}
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Idioma</p>
                  <Chips value={opciones.idioma} options={IDIOMAS} onChange={(idioma) => setOpciones((o) => ({ ...o, idioma }))} />
                </div>
              </div>
            </StepCard>
            <div className="flex flex-col items-center gap-3 pt-2">
              <PrimaryButton onClick={prepare} disabled={!canStart}>
                Preparar mi entrevista
              </PrimaryButton>
              {!canStart && <p className="text-xs text-muted">{[job.issue, cv.issue].filter(Boolean).join(" ")}</p>}
            </div>
          </div>
          <ProductMore id="entrevista" />
        </>
      )}

      {stage === "preparando" && <Loading messages={["Leyendo la búsqueda…", "Repasando tu experiencia…", "Preparando las preguntas…", "Tu entrevistadora ya casi llega…"]} />}

      {stage === "llamada" && plan && <Call plan={plan} opciones={opciones} onFinish={evaluate} onCancel={() => setStage("inicio")} />}

      {stage === "evaluando" && <Loading messages={["Repasando tus respuestas…", "Buscando tus mejores momentos…", "Escribiendo tu informe…"]} />}

      {stage === "informe" && plan && (
        <>
          {informe ? (
            <Report informe={informe} historial={historial} />
          ) : (
            <div className="rounded-3xl bg-paper p-6 text-center">
              <p>No pudimos armar tu informe.</p>
              <button type="button" onClick={() => void evaluate(historial)} className="mt-4 rounded-full bg-brand px-6 py-3 font-medium text-paper hover:bg-brand-dark">
                Intentar de nuevo
              </button>
            </div>
          )}
          <div className="mt-10 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={restart} className="px-5 py-3 text-sm text-muted hover:text-ink">
              Nueva entrevista
            </button>
            <button
              type="button"
              onClick={() => {
                setHistorial([]);
                setInforme(null);
                setStage("llamada");
              }}
              className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-paper transition hover:bg-brand-dark"
            >
              Practicar de nuevo con las mismas preguntas
            </button>
          </div>
        </>
      )}
    </div>
  );
}
