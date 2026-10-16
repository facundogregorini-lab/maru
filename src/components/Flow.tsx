"use client";

import { jobInputIssue } from "@/lib/inputValidation";
import { useEffect, useRef, useState } from "react";
import { buildCvDoc } from "@/lib/cv";
import { applyGapAnswers, findGaps } from "@/lib/gaps";
import { takeHandoff, type Handoff } from "@/lib/match/clientStore";
import { saveProfile } from "@/lib/profileStore";
import { contextFromAnalysis, type Analysis, type CvDoc, type GapQuestion, type Generation, type Profile } from "@/lib/schemas";
import { load, remove, save } from "@/lib/storage";
import { upsertTracked } from "@/lib/tracker";
import CopyButton from "./CopyButton";
import CvEditor from "./cv/CvEditor";
import CvSourceField, { useCvInput } from "./CvSourceField";
import Questions from "./Questions";
import { ProductHero, ProductMore, ToolHeading } from "./product/ProductLanding";
import { ErrorBanner, Loading, PrimaryButton, StepCard, post } from "./ui";
import VoiceButton from "./VoiceButton";

type Stage = "inicio" | "analizando" | "preguntas" | "generando" | "resultado";
const SESSION_KEY = "maru:sesion:v2";

const GUIDE = [
  "¿Por qué te parece una buena vacante?",
  "¿Por qué sentís que sos un buen fit para el rol?",
  "¿Qué te encanta del desafío y de la empresa?",
];

const LOADING_ANALYZE = [
  "Leyendo tu perfil con atención…",
  "Leyendo la vacante…",
  "Buscando lo que el ATS va a filtrar…",
  "Cruzando tu experiencia con lo que piden…",
  "Pensando qué preguntarte…",
];
const LOADING_GENERATE = [
  "Escribiendo tu CV para este rol…",
  "Ordenando tus logros por relevancia…",
  "Integrando las palabras clave con naturalidad…",
  "Preparando cada respuesta del formulario…",
  "Últimos retoques…",
];

/** Lo que guardamos para no perder nada si se recarga la página. */
type Session = {
  jobUrl: string;
  jobText: string;
  feedback: string;
  analysis: Analysis;
  profile: Profile;
  gaps: GapQuestion[];
  answers: Record<string, string>;
  gapAnswers: Record<string, string>;
  generation: Generation | null;
  doc: CvDoc | null;
};

export default function Flow() {
  const [stage, setStage] = useState<Stage>("inicio");
  const [error, setError] = useState("");

  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [showJobText, setShowJobText] = useState(false);
  const [feedback, setFeedback] = useState("");
  const cv = useCvInput();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gaps, setGaps] = useState<GapQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gapAnswers, setGapAnswers] = useState<Record<string, string>>({});
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [doc, setDocState] = useState<CvDoc | null>(null);

  const jobTextRef = useRef<HTMLTextAreaElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const restoredRef = useRef(false);
  const originRef = useRef<Handoff | null>(null);

  // Retomamos la última postulación si se recargó la página.
  useEffect(() => {
    // StrictMode corre el efecto dos veces: la segunda ya no encontraría el handoff y pisaría con la sesión vieja.
    if (restoredRef.current) return;
    restoredRef.current = true;
    // Viene de "Encontrá tu trabajo perfecto" → "Preparar mi postulación": arrancamos con esa búsqueda
    // y descartamos la postulación anterior para que un recargo no la traiga de vuelta.
    const handoff = takeHandoff();
    if (handoff) {
      remove(SESSION_KEY);
      originRef.current = handoff;
      setJobUrl(handoff.jobUrl);
      setJobText(handoff.jobText);
      setShowJobText(!!handoff.jobText);
      return;
    }
    const s = load<Session>(SESSION_KEY);
    if (!s?.analysis || !s.profile) return;
    setJobUrl(s.jobUrl);
    setJobText(s.jobText);
    setFeedback(s.feedback);
    setAnalysis(s.analysis);
    setProfile(s.profile);
    setGaps(s.gaps);
    setAnswers(s.answers);
    setGapAnswers(s.gapAnswers);
    setGeneration(s.generation);
    setDocState(s.doc);
    setStage(s.doc && s.generation ? "resultado" : "preguntas");
  }, []);

  useEffect(() => {
    if (!analysis || !profile) return;
    save(SESSION_KEY, { jobUrl, jobText, feedback, analysis, profile, gaps, answers, gapAnswers, generation, doc } satisfies Session);
  }, [jobUrl, jobText, feedback, analysis, profile, gaps, answers, gapAnswers, generation, doc]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  const setDoc = (fn: (d: CvDoc) => CvDoc) => setDocState((d) => (d ? fn(d) : d));

  const missing = [jobInputIssue(jobUrl, jobText), cv.issue, !feedback.trim() ? "Contanos por qué te interesa esta vacante." : null].filter(Boolean);
  const canAnalyze = missing.length === 0;
  const job = () => ({ jobUrl: jobUrl.trim(), jobText: showJobText ? jobText : undefined });

  async function analyze() {
    setError("");
    setStage("analizando");
    try {
      // Perfil y vacante en paralelo: la espera es la del más lento, no la suma.
      // Si reutiliza su perfil guardado, no hace falta volver a leerlo.
      const saved = cv.savedProfile;
      const [p, a] = await Promise.all([
        saved ? Promise.resolve({ profile: saved, gaps: findGaps(saved) }) : post<{ profile: Profile; gaps: GapQuestion[] }>("/api/profile", { source: cv.source }),
        post<{ analysis: Analysis }>("/api/analyze", { ...job(), feedback, source: cv.source }),
      ]);
      if (!saved) saveProfile(p.profile);
      setProfile(p.profile);
      setGaps(p.gaps);
      setAnalysis(a.analysis);
      setAnswers({});
      setGapAnswers({});
      setGeneration(null);
      setDocState(null);
      setStage("preguntas");
    } catch (e) {
      const err = e as Error & { code?: string };
      setStage("inicio");
      setError(err.message);
      if (err.code === "JOB_FETCH_FAILED") {
        setShowJobText(true);
        setTimeout(() => jobTextRef.current?.focus(), 400);
      }
      // PDF ilegible (imagen de Canva, escaneo) o muy pesado: ofrecemos pegar el texto.
      if (err.code === "CV_UNREADABLE" || err.code === "CV_INVALID" || err.code === "CV_TOO_LARGE") cv.fallbackToText();
    }
  }

  async function generate() {
    if (!analysis || !profile) return;
    setError("");
    setStage("generando");
    try {
      const completed = applyGapAnswers(profile, gaps, gapAnswers);
      const { generation: g } = await post<{ generation: Generation }>("/api/generate", {
        ...job(),
        feedback,
        profile: completed,
        analysis,
        answers,
      });
      const next = buildCvDoc(completed, g, contextFromAnalysis(analysis));
      // Si ya había una foto, la conservamos al regenerar.
      if (doc?.photo) Object.assign(next, { photo: doc.photo, showPhoto: doc.showPhoto });
      setGeneration(g);
      setDocState(next);
      setStage("resultado");
      // La postulación queda en el seguimiento, con el CV y las respuestas que armó.
      const origin = originRef.current?.jobUrl === jobUrl.trim() ? originRef.current : null;
      upsertTracked({
        id: origin?.id,
        title: analysis.puesto || origin?.title || "",
        company: analysis.empresa || origin?.company || "",
        jobUrl: jobUrl.trim(),
        jobText: jobText.trim() || undefined,
        artifact: ["cv", "respuestas"],
      });
    } catch (e) {
      setStage("preguntas");
      setError((e as Error).message);
    }
  }

  function restart() {
    remove(SESSION_KEY);
    setStage("inicio");
    setAnalysis(null);
    setProfile(null);
    setGeneration(null);
    setDocState(null);
    setAnswers({});
    setGapAnswers({});
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <ErrorBanner message={error} />

      {stage === "inicio" && (
        <>
          <ProductHero id="postulacion" />
          <ToolHeading />
          <div className="mt-10 space-y-6">
            <StepCard n={1} title="La vacante que te gustó" hint="Pegá el link de la publicación (LinkedIn, Greenhouse, Lever, Workable, la web de la empresa…).">
              <input
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                className="w-full rounded-xl border border-transparent bg-white px-4 py-3 ring-1 ring-black/[0.06] text-base outline-none transition placeholder:text-muted/60 focus:ring-2 focus:ring-ink"
              />
              {showJobText ? (
                <textarea
                  ref={jobTextRef}
                  rows={7}
                  placeholder="Pegá acá el texto completo de la vacante (y, si los ves, los campos del formulario)."
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-transparent bg-white px-4 py-3 ring-1 ring-black/[0.06] text-sm outline-none transition focus:ring-2 focus:ring-ink"
                />
              ) : (
                <button type="button" onClick={() => setShowJobText(true)} className="mt-2 text-sm text-muted underline decoration-line underline-offset-4 hover:text-brand">
                  ¿No tenés link? Pegá el texto de la vacante
                </button>
              )}
            </StepCard>

            <StepCard n={2} title="¿Por qué esta vacante?" hint="Contalo con tus palabras, como si se lo contaras a alguien de confianza. Escribilo o grabalo.">
              <ul className="mb-3 grid gap-2 sm:grid-cols-3">
                {GUIDE.map((g) => (
                  <li key={g} className="rounded-xl bg-sand px-3 py-2 text-xs leading-snug text-muted">
                    {g}
                  </li>
                ))}
              </ul>
              <textarea
                rows={6}
                placeholder="Me encanta que… Creo que encajo porque… Lo que más me entusiasma es…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full rounded-xl border border-transparent bg-white px-4 py-3 ring-1 ring-black/[0.06] text-base leading-relaxed outline-none transition placeholder:text-muted/60 focus:ring-2 focus:ring-ink"
              />
              <div className="mt-3">
                <VoiceButton onText={(t) => setFeedback((f) => (f ? `${f.trimEnd()} ${t}` : t))} />
              </div>
            </StepCard>

            <StepCard n={3} title="Tu experiencia" hint="La usamos tal cual: cargos, fechas y estudios se copian de tu perfil, sin inventar nada.">
              <CvSourceField input={cv} />
            </StepCard>

            <div className="flex flex-col items-center gap-3 pt-2">
              <PrimaryButton onClick={analyze} disabled={!canAnalyze}>
                Empezar
              </PrimaryButton>
              {!canAnalyze && <p className="text-xs text-muted">{missing.join(" ")}</p>}
            </div>
          </div>
          <ProductMore id="postulacion" />
        </>
      )}

      {stage === "analizando" && <Loading messages={LOADING_ANALYZE} />}
      {stage === "generando" && <Loading messages={LOADING_GENERATE} />}

      {stage === "preguntas" && analysis && (
        <Questions
          kicker={analysis.empresa}
          title={analysis.puesto}
          summary={analysis.resumen_vacante}
          strengths={analysis.fortalezas_detectadas}
          gapsList={analysis.brechas}
          preguntas={analysis.preguntas}
          nextLabel="Armar mi postulación"
          gaps={gaps}
          answers={answers}
          setAnswers={setAnswers}
          gapAnswers={gapAnswers}
          setGapAnswers={setGapAnswers}
          onBack={() => setStage(doc ? "resultado" : "inicio")}
          backLabel={doc ? "← Volver a mi CV" : "← Volver"}
          onNext={generate}
        />
      )}

      {stage === "resultado" && doc && generation && analysis && (
        <Results doc={doc} setDoc={setDoc} generation={generation} analysis={analysis} onRestart={restart} onBack={() => setStage("preguntas")} />
      )}
    </div>
  );
}

/* ---------- piezas ---------- */

function Results({
  doc,
  setDoc,
  generation,
  analysis,
  onRestart,
  onBack,
}: {
  doc: CvDoc;
  setDoc: (fn: (d: CvDoc) => CvDoc) => void;
  generation: Generation;
  analysis: Analysis;
  onRestart: () => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"cv" | "form">("cv");

  return (
    <div className="animate-rise">
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand">Tu postulación para</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">
        {analysis.puesto} <span className="text-muted">· {analysis.empresa}</span>
      </h1>

      <div className="mt-6 inline-flex rounded-full bg-white p-1 text-sm ring-1 ring-black/[0.08]">
        {(
          [
            ["cv", "CV optimizado"],
            ["form", `Formulario (${generation.recomendaciones_formulario.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-5 py-2 transition ${tab === key ? "bg-ink font-medium text-white" : "text-ink/70 hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cv" && <CvEditor doc={doc} setDoc={setDoc} context={contextFromAnalysis(analysis)} cambios={generation.cambios_clave} />}

      {tab === "form" && (
        <div className="mt-6 space-y-4">
          {generation.recomendaciones_formulario.map((f, i) => (
            <div key={i} className="rounded-3xl border border-line bg-paper p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-xl tracking-tight">{f.campo}</h3>
                <CopyButton text={f.respuesta_sugerida} />
              </div>
              <p className="mt-3 whitespace-pre-line rounded-2xl bg-cream px-4 py-3 leading-relaxed">{f.respuesta_sugerida}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                <span className="font-medium text-ink">Por qué funciona: </span>
                {f.por_que}
              </p>
              {f.tip && (
                <p className="mt-2 text-sm leading-relaxed text-sage">
                  <span className="font-medium">Tip: </span>
                  {f.tip}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="px-5 py-3 text-sm text-muted hover:text-ink">
          ← Ajustar respuestas
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-medium transition hover:border-brand hover:text-brand"
        >
          Postularme a otra vacante
        </button>
      </div>
    </div>
  );
}
