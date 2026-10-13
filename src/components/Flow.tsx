"use client";

import { useEffect, useRef, useState } from "react";
import { buildCvDoc } from "@/lib/cv";
import { applyGapAnswers } from "@/lib/gaps";
import {
  DOCX_MIME,
  MAX_FILE_BYTES,
  PDF_MIME,
  buildCvSource,
  looksLikeDocx,
  looksLikePdf,
  type CvFile,
  type CvMode,
} from "@/lib/cvSource";
import type { Analysis, CvDoc, GapQuestion, Generation, Profile } from "@/lib/schemas";
import { load, remove, save } from "@/lib/storage";
import CopyButton from "./CopyButton";
import CvEditor from "./cv/CvEditor";
import LinkedinGuide from "./LinkedinGuide";
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

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 413) {
    throw Object.assign(new Error("Tu archivo es demasiado pesado para enviarlo. Exportalo más liviano (menos de 3 MB) o pegá tu experiencia."), {
      code: "CV_TOO_LARGE",
    });
  }
  const data = await res.json().catch(() => ({ error: "Respuesta inesperada del servidor." }));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Algo salió mal."), { code: data.code as string | undefined });
  return data as T;
}

export default function Flow() {
  const [stage, setStage] = useState<Stage>("inicio");
  const [error, setError] = useState("");

  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [showJobText, setShowJobText] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [cvMode, setCvMode] = useState<CvMode>("linkedin");
  const [file, setFile] = useState<CvFile | null>(null);
  const [reading, setReading] = useState(false);
  const [cvText, setCvText] = useState("");

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gaps, setGaps] = useState<GapQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gapAnswers, setGapAnswers] = useState<Record<string, string>>({});
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [doc, setDocState] = useState<CvDoc | null>(null);

  const jobTextRef = useRef<HTMLTextAreaElement>(null);
  const cvTextRef = useRef<HTMLTextAreaElement>(null);
  const readSeq = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  // Retomamos la última postulación si se recargó la página.
  useEffect(() => {
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

  // Una sola fuente de verdad: lo que habilita "Empezar" es exactamente lo que se envía.
  const cvSource = buildCvSource(cvMode, file, cvText);

  function switchMode(mode: CvMode) {
    readSeq.current += 1; // descarta una lectura de archivo en curso
    setCvMode(mode);
    setFile(null);
    setReading(false);
  }

  async function onFile(f: File | null) {
    setError("");
    if (!f) return;
    const isPdf = f.type === PDF_MIME || f.name.toLowerCase().endsWith(".pdf");
    const isDocx = f.type === DOCX_MIME || f.name.toLowerCase().endsWith(".docx");
    if (cvMode === "linkedin" && !isPdf) return setError("El perfil de LinkedIn se descarga en PDF. Subí ese archivo.");
    if (!isPdf && !isDocx) return setError("Aceptamos CVs en PDF o Word (.docx).");
    if (f.size > MAX_FILE_BYTES) return setError("El archivo pesa más de 3 MB. Exportalo más liviano o pegá tu experiencia.");
    if (f.size === 0) return setError("El archivo está vacío. Probá descargarlo de nuevo.");

    // "Listo ✓" aparece recién cuando el archivo está leído, validado y guardado en el estado.
    const seq = ++readSeq.current;
    setFile(null);
    setReading(true);
    try {
      const base64 = await readAsBase64(f);
      if (seq !== readSeq.current) return; // eligió otro archivo o cambió de pestaña mientras leíamos
      if (isPdf ? !looksLikePdf(base64) : !looksLikeDocx(base64)) {
        return setError(`No pudimos leer “${f.name}”: no parece un ${isPdf ? "PDF" : "Word"} válido. Probá exportarlo de nuevo o pegá tu experiencia.`);
      }
      setFile({ name: f.name, base64, mime: isPdf ? PDF_MIME : DOCX_MIME });
    } catch {
      if (seq === readSeq.current) setError("No pudimos leer el archivo. Probá de nuevo.");
    } finally {
      if (seq === readSeq.current) setReading(false);
    }
  }

  const canAnalyze = (jobUrl.trim() || jobText.trim().length > 100) && feedback.trim().length > 20 && !!cvSource && !reading;
  const job = () => ({ jobUrl: jobUrl.trim(), jobText: showJobText ? jobText : undefined });

  async function analyze() {
    setError("");
    setStage("analizando");
    try {
      // Perfil y vacante en paralelo: la espera es la del más lento, no la suma.
      const [p, a] = await Promise.all([
        post<{ profile: Profile; gaps: GapQuestion[] }>("/api/profile", { source: cvSource }),
        post<{ analysis: Analysis }>("/api/analyze", { ...job(), feedback, source: cvSource }),
      ]);
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
      if (err.code === "CV_UNREADABLE" || err.code === "CV_INVALID" || err.code === "CV_TOO_LARGE") {
        switchMode("texto");
        setTimeout(() => cvTextRef.current?.focus(), 400);
      }
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
      const next = buildCvDoc(completed, g, analysis);
      // Si ya había una foto, la conservamos al regenerar.
      if (doc?.photo) Object.assign(next, { photo: doc.photo, showPhoto: doc.showPhoto });
      setGeneration(g);
      setDocState(next);
      setStage("resultado");
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
    <div ref={topRef} className="scroll-mt-6">
      {error && (
        <div role="alert" className="animate-rise mb-6 rounded-2xl border border-clay/30 bg-clay-soft px-5 py-4 text-sm text-clay-dark">
          {error}
        </div>
      )}

      {stage === "inicio" && (
        <>
          <Hero />
          <div className="mt-10 space-y-6">
            <StepCard n={1} title="La vacante que te gustó" hint="Pegá el link de la publicación (LinkedIn, Greenhouse, Lever, Workable, la web de la empresa…).">
              <input
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-base outline-none transition placeholder:text-muted/60 focus:border-clay focus:ring-4 focus:ring-clay-soft"
              />
              {showJobText ? (
                <textarea
                  ref={jobTextRef}
                  rows={7}
                  placeholder="Pegá acá el texto completo de la vacante (y, si los ves, los campos del formulario)."
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-clay focus:ring-4 focus:ring-clay-soft"
                />
              ) : (
                <button type="button" onClick={() => setShowJobText(true)} className="mt-2 text-sm text-muted underline decoration-line underline-offset-4 hover:text-clay">
                  ¿No tenés link? Pegá el texto de la vacante
                </button>
              )}
            </StepCard>

            <StepCard n={2} title="¿Por qué esta vacante?" hint="Contalo con tus palabras, como si se lo contaras a una amiga. Escribilo o grabalo.">
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
                className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-base leading-relaxed outline-none transition placeholder:text-muted/60 focus:border-clay focus:ring-4 focus:ring-clay-soft"
              />
              <div className="mt-3">
                <VoiceButton onText={(t) => setFeedback((f) => (f ? `${f.trimEnd()} ${t}` : t))} />
              </div>
            </StepCard>

            <StepCard n={3} title="Tu experiencia" hint="La usamos tal cual: cargos, fechas y estudios se copian de tu perfil, sin inventar nada.">
              <div className="mb-4 flex flex-wrap gap-1 rounded-full bg-sand p-1 text-sm sm:inline-flex">
                {(
                  [
                    ["linkedin", "PDF de LinkedIn", "Recomendado"],
                    ["cv", "Mi CV (PDF o Word)", ""],
                    ["texto", "Pegar texto", ""],
                  ] as const
                ).map(([mode, label, badge]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => switchMode(mode)}
                    className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition ${cvMode === mode ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                  >
                    {label}
                    {badge && <span className="rounded-full bg-sage-soft px-1.5 py-0.5 text-[10px] font-semibold text-sage">{badge}</span>}
                  </button>
                ))}
              </div>

              {cvMode === "linkedin" && <LinkedinGuide />}

              {cvMode !== "texto" && (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-paper px-4 py-8 text-center transition hover:border-clay"
                >
                  <input
                    type="file"
                    accept={cvMode === "linkedin" ? ".pdf,application/pdf" : `.pdf,.docx,${PDF_MIME},${DOCX_MIME}`}
                    className="sr-only"
                    onChange={(e) => {
                      // El archivo queda en el estado (no en el input): reseteamos el input para poder elegir el mismo archivo otra vez.
                      onFile(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                  />
                  {reading ? (
                    <span className="font-medium text-muted">Leyendo tu archivo…</span>
                  ) : file ? (
                    <>
                      <span className="font-medium text-ink">{file.name}</span>
                      <span className="text-xs text-sage">Listo ✓ · tocá para cambiarlo</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-ink">
                        {cvMode === "linkedin" ? "Arrastrá tu Profile.pdf o tocá para elegirlo" : "Arrastrá tu CV o tocá para elegirlo"}
                      </span>
                      <span className="text-xs text-muted">{cvMode === "linkedin" ? "PDF · hasta 3 MB" : "PDF o .docx · hasta 3 MB"}</span>
                    </>
                  )}
                </label>
              )}

              {cvMode === "texto" && (
                <textarea
                  ref={cvTextRef}
                  rows={8}
                  placeholder="Pegá tu perfil o tu experiencia: puestos, empresas, fechas, logros, estudios, idiomas…"
                  value={cvText}
                  onChange={(e) => setCvText(e.target.value)}
                  className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-clay focus:ring-4 focus:ring-clay-soft"
                />
              )}
            </StepCard>

            <div className="flex flex-col items-center gap-3 pt-2">
              <PrimaryButton onClick={analyze} disabled={!canAnalyze}>
                Empezar
              </PrimaryButton>
              {!canAnalyze && <p className="text-xs text-muted">Completá los tres pasos para seguir.</p>}
            </div>
          </div>
        </>
      )}

      {stage === "analizando" && <Loading messages={LOADING_ANALYZE} />}
      {stage === "generando" && <Loading messages={LOADING_GENERATE} />}

      {stage === "preguntas" && analysis && (
        <Questions
          analysis={analysis}
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

function Hero() {
  return (
    <section className="animate-rise relative overflow-hidden rounded-[2rem] bg-sand px-6 py-12 sm:px-12 sm:py-16">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-clay-soft" />
      <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-sage-soft" />
      <div className="relative max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clay">Encontraste una vacante que te encanta</p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">
          Postulate con un CV pensado <em className="text-clay">para ese rol</em>.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Subí tu LinkedIn, contanos qué te entusiasma y respondé un par de preguntas cortas: Maru te devuelve tu CV optimizado para ATS y para las personas que lo
          van a leer, más una sugerencia para cada campo del formulario.
        </p>
      </div>
    </section>
  );
}

function StepCard({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="animate-rise rounded-3xl border border-line bg-paper/70 p-5 sm:p-8" style={{ animationDelay: `${n * 70}ms` }}>
      <div className="mb-4 flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-clay-soft font-serif text-lg text-clay-dark">{n}</span>
        <div>
          <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-full bg-clay px-8 py-3.5 text-base font-medium text-paper shadow-[0_10px_30px_-12px_rgba(192,98,58,0.8)] transition hover:bg-clay-dark disabled:cursor-not-allowed disabled:bg-muted/40 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

function Loading({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, messages.length - 1)), 6000);
    return () => clearInterval(id);
  }, [messages.length]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center" aria-live="polite">
      <div className="animate-breathe h-20 w-20 rounded-full bg-gradient-to-br from-clay to-honey" />
      <p key={i} className="animate-rise mt-8 font-serif text-2xl">
        {messages[i]}
      </p>
      <p className="mt-2 text-sm text-muted">Puede tardar un minuto. Vale la pena.</p>
    </div>
  );
}

function Questions({
  analysis,
  gaps,
  answers,
  setAnswers,
  gapAnswers,
  setGapAnswers,
  onBack,
  backLabel,
  onNext,
}: {
  analysis: Analysis;
  gaps: GapQuestion[];
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  gapAnswers: Record<string, string>;
  setGapAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onBack: () => void;
  backLabel: string;
  onNext: () => void;
}) {
  const input =
    "mt-3 w-full rounded-xl border border-line bg-paper px-4 py-2.5 outline-none transition placeholder:text-muted/60 focus:border-clay focus:ring-4 focus:ring-clay-soft";
  return (
    <div className="animate-rise space-y-8">
      <section className="rounded-[2rem] bg-sand p-6 sm:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clay">{analysis.empresa}</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">{analysis.puesto}</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted">{analysis.resumen_vacante}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-paper p-5">
            <h3 className="text-sm font-semibold text-sage">Por qué encajás</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
              {analysis.fortalezas_detectadas.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-sage">●</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-paper p-5">
            <h3 className="text-sm font-semibold text-clay-dark">Lo que todavía no se ve en tu CV</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
              {analysis.brechas.length ? (
                analysis.brechas.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-clay">○</span>
                    {b}
                  </li>
                ))
              ) : (
                <li className="text-muted">¡Nada importante! Tu perfil cubre lo que piden.</li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {gaps.length > 0 && (
        <section>
          <h2 className="font-serif text-2xl tracking-tight">Datos que faltan</h2>
          <p className="mt-1 text-sm text-muted">No están en tu perfil y no los vamos a inventar. Si no querés que figuren, dejalos vacíos.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {gaps.map((g) => (
              <div key={g.id} className={`rounded-3xl border border-line bg-paper/70 p-5 ${g.contexto ? "sm:col-span-2" : ""}`}>
                <p className="font-medium">{g.pregunta}</p>
                {g.contexto && <blockquote className="mt-2 rounded-xl bg-sand px-3 py-2 text-sm italic text-muted">“{g.contexto}”</blockquote>}
                <input
                  value={gapAnswers[g.id] ?? ""}
                  onChange={(e) => setGapAnswers((a) => ({ ...a, [g.id]: e.target.value }))}
                  placeholder={g.placeholder}
                  className={input}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-serif text-2xl tracking-tight">Para destacar</h2>
        <p className="mt-1 text-sm text-muted">Con una línea alcanza. Si no sabés, dejala vacía.</p>
        <div className="mt-5 space-y-4">
          {analysis.preguntas.map((q, idx) => (
            <div key={q.id} className="rounded-3xl border border-line bg-paper/70 p-5 sm:p-6">
              <p className="font-medium">
                <span className="mr-2 font-serif text-clay">{idx + 1}.</span>
                {q.pregunta}
              </p>
              <p className="mt-1 text-xs text-muted">{q.por_que}</p>
              {q.opciones_sugeridas.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.opciones_sugeridas.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        answers[q.id] === o ? "border-clay bg-clay-soft text-clay-dark" : "border-line bg-paper hover:border-clay"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
              <input value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Tu respuesta…" className={input} />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="px-5 py-3 text-sm text-muted hover:text-ink">
          {backLabel}
        </button>
        <PrimaryButton onClick={onNext}>Armar mi postulación</PrimaryButton>
      </div>
    </div>
  );
}

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
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-clay">Tu postulación para</p>
      <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">
        {analysis.puesto} <span className="text-muted">· {analysis.empresa}</span>
      </h1>

      <div className="mt-6 inline-flex rounded-full bg-sand p-1 text-sm">
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
            className={`rounded-full px-5 py-2 transition ${tab === key ? "bg-paper font-medium shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cv" && <CvEditor doc={doc} setDoc={setDoc} analysis={analysis} cambios={generation.cambios_clave} />}

      {tab === "form" && (
        <div className="mt-6 space-y-4">
          {generation.recomendaciones_formulario.map((f, i) => (
            <div key={i} className="rounded-3xl border border-line bg-paper p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-serif text-xl tracking-tight">{f.campo}</h3>
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
          className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-medium transition hover:border-clay hover:text-clay"
        >
          Postularme a otra vacante
        </button>
      </div>
    </div>
  );
}
