"use client";

import { useEffect, useRef, useState } from "react";
import type { Analysis, CandidateInput, Result } from "@/lib/schemas";
import { cvToText } from "@/lib/cvText";
import CopyButton from "./CopyButton";
import CvDocument from "./CvDocument";
import VoiceButton from "./VoiceButton";

type Stage = "inicio" | "analizando" | "preguntas" | "generando" | "resultado";
type CvMode = "pdf" | "linkedin" | "texto";

const MAX_PDF_BYTES = 4 * 1024 * 1024;

const GUIDE = [
  "¿Por qué te parece una buena vacante?",
  "¿Por qué sentís que sos un buen fit para el rol?",
  "¿Qué te encanta del desafío y de la empresa?",
];

const LOADING_ANALYZE = [
  "Leyendo la vacante con atención…",
  "Buscando lo que el ATS va a filtrar…",
  "Cruzando tu experiencia con lo que piden…",
  "Pensando qué preguntarte…",
];
const LOADING_GENERATE = [
  "Reescribiendo tu CV para este rol…",
  "Ordenando tus logros por relevancia…",
  "Integrando las palabras clave con naturalidad…",
  "Preparando cada respuesta del formulario…",
  "Últimos retoques…",
];

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
  const [cvMode, setCvMode] = useState<CvMode>("pdf");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvPdfBase64, setCvPdfBase64] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [cvText, setCvText] = useState("");

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);

  const jobTextRef = useRef<HTMLTextAreaElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  function candidate(): CandidateInput {
    return {
      jobUrl: jobUrl.trim(),
      jobText: showJobText ? jobText : undefined,
      feedback,
      cvPdfBase64: cvMode === "pdf" || cvMode === "linkedin" ? cvPdfBase64 || undefined : undefined,
      linkedinUrl: cvMode === "linkedin" ? linkedinUrl.trim() : undefined,
      cvText: cvMode === "texto" ? cvText : undefined,
    };
  }

  async function onFile(file: File | null) {
    setError("");
    if (!file) return;
    if (file.type !== "application/pdf") return setError("Por ahora aceptamos CVs en PDF.");
    if (file.size > MAX_PDF_BYTES) return setError("El PDF pesa más de 4 MB. Probá exportarlo más liviano.");
    setCvFile(file);
    setCvPdfBase64(await readAsBase64(file));
  }

  const hasCv =
    (cvMode === "pdf" && !!cvPdfBase64) ||
    (cvMode === "linkedin" && (!!linkedinUrl.trim() || !!cvPdfBase64)) ||
    (cvMode === "texto" && cvText.trim().length > 80);
  const canAnalyze = (jobUrl.trim() || jobText.trim().length > 100) && feedback.trim().length > 20 && hasCv;

  async function analyze() {
    setError("");
    setStage("analizando");
    try {
      const { analysis } = await post<{ analysis: Analysis }>("/api/analyze", candidate());
      setAnalysis(analysis);
      setAnswers({});
      setStage("preguntas");
    } catch (e) {
      const err = e as Error & { code?: string };
      setStage("inicio");
      setError(err.message);
      if (err.code === "JOB_FETCH_FAILED") {
        setShowJobText(true);
        setTimeout(() => jobTextRef.current?.focus(), 400);
      }
      if (err.code === "LINKEDIN_BLOCKED") setCvMode("linkedin");
    }
  }

  async function generate() {
    if (!analysis) return;
    setError("");
    setStage("generando");
    try {
      const { result } = await post<{ result: Result }>("/api/generate", { ...candidate(), analysis, answers });
      setResult(result);
      setStage("resultado");
    } catch (e) {
      setStage("preguntas");
      setError((e as Error).message);
    }
  }

  function restart() {
    setStage("inicio");
    setAnalysis(null);
    setResult(null);
    setAnswers({});
  }

  return (
    <div ref={topRef} className="scroll-mt-6">
      {error && (
        <div role="alert" className="animate-rise mb-6 rounded-2xl border border-clay/30 bg-clay-soft px-5 py-4 text-sm text-clay-dark print:hidden">
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

            <StepCard n={3} title="Tu experiencia" hint="Usamos tu CV actual como base. No inventamos nada: sólo lo ponemos en su mejor versión.">
              <div className="mb-4 inline-flex rounded-full bg-sand p-1 text-sm">
                {(
                  [
                    ["pdf", "CV en PDF"],
                    ["linkedin", "LinkedIn"],
                    ["texto", "Pegar texto"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCvMode(mode)}
                    className={`rounded-full px-4 py-1.5 transition ${cvMode === mode ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {cvMode === "linkedin" && (
                <div className="mb-3 space-y-2">
                  <input
                    type="url"
                    placeholder="https://www.linkedin.com/in/tu-perfil"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none transition focus:border-clay focus:ring-4 focus:ring-clay-soft"
                  />
                  <p className="text-xs text-muted">
                    LinkedIn suele bloquear la lectura automática. Lo más seguro: en tu perfil tocá <b>Más → Guardar en PDF</b> y subilo acá abajo.
                  </p>
                </div>
              )}

              {(cvMode === "pdf" || cvMode === "linkedin") && (
                <label
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onFile(e.dataTransfer.files?.[0] ?? null);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-paper px-4 py-8 text-center transition hover:border-clay"
                >
                  <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
                  {cvFile ? (
                    <>
                      <span className="font-medium text-ink">{cvFile.name}</span>
                      <span className="text-xs text-sage">Listo ✓ · tocá para cambiarlo</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-ink">Arrastrá tu PDF o tocá para elegirlo</span>
                      <span className="text-xs text-muted">Hasta 4 MB</span>
                    </>
                  )}
                </label>
              )}

              {cvMode === "texto" && (
                <textarea
                  rows={8}
                  placeholder="Pegá tu CV o un resumen de tu experiencia: puestos, empresas, fechas, logros, estudios…"
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
        <Questions analysis={analysis} answers={answers} setAnswers={setAnswers} onBack={() => setStage("inicio")} onNext={generate} />
      )}

      {stage === "resultado" && result && analysis && <Results result={result} analysis={analysis} onRestart={restart} onBack={() => setStage("preguntas")} />}
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
          Contanos qué te entusiasma, respondé un par de preguntas cortas y Maru te devuelve tu CV optimizado para ATS y para las personas que lo
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
  answers,
  setAnswers,
  onBack,
  onNext,
}: {
  analysis: Analysis;
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onBack: () => void;
  onNext: () => void;
}) {
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

      <section>
        <h2 className="font-serif text-2xl tracking-tight">Unas preguntas rápidas</h2>
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
              <input
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder="Tu respuesta…"
                className="mt-3 w-full rounded-xl border border-line bg-paper px-4 py-2.5 outline-none transition focus:border-clay focus:ring-4 focus:ring-clay-soft"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="px-5 py-3 text-sm text-muted hover:text-ink">
          ← Volver
        </button>
        <PrimaryButton onClick={onNext}>Armar mi postulación</PrimaryButton>
      </div>
    </div>
  );
}

function Results({ result, analysis, onRestart, onBack }: { result: Result; analysis: Analysis; onRestart: () => void; onBack: () => void }) {
  const [tab, setTab] = useState<"cv" | "form">("cv");
  const plain = cvToText(result.cv);

  return (
    <div className="animate-rise">
      <div className="print:hidden">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clay">Tu postulación para</p>
        <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">
          {analysis.puesto} <span className="text-muted">· {analysis.empresa}</span>
        </h1>

        <div className="mt-6 inline-flex rounded-full bg-sand p-1 text-sm">
          {(
            [
              ["cv", "CV optimizado"],
              ["form", `Formulario (${result.recomendaciones_formulario.length})`],
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
      </div>

      {tab === "cv" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <CvDocument cv={result.cv} />
          </div>
          <aside className="space-y-4 print:hidden">
            <div className="flex flex-col gap-2 rounded-3xl bg-paper p-5">
              <button type="button" onClick={() => window.print()} className="rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-clay-dark">
                Descargar PDF
              </button>
              <CopyButton text={plain} label="Copiar como texto" />
              <p className="text-xs leading-relaxed text-muted">En el diálogo de impresión elegí “Guardar como PDF”. El texto queda seleccionable, ideal para ATS.</p>
            </div>

            {result.completar_antes_de_enviar.length > 0 && (
              <div className="rounded-3xl border border-honey/50 bg-honey/10 p-5">
                <h3 className="text-sm font-semibold">Completá antes de enviar</h3>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
                  {result.completar_antes_de_enviar.map((c, i) => (
                    <li key={i}>• {c}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-3xl bg-paper p-5">
              <h3 className="text-sm font-semibold">Qué cambiamos y por qué</h3>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
                {result.cambios_clave.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl bg-paper p-5">
              <h3 className="text-sm font-semibold">Palabras clave para el ATS</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {result.cobertura_ats.incluidas.map((k) => (
                  <span key={k} className="rounded-full bg-sage-soft px-2.5 py-1 text-xs text-sage">
                    ✓ {k}
                  </span>
                ))}
                {result.cobertura_ats.faltantes.map((k) => (
                  <span key={k} className="rounded-full bg-sand px-2.5 py-1 text-xs text-muted line-through decoration-muted/50">
                    {k}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">{result.cobertura_ats.nota}</p>
            </div>
          </aside>
        </div>
      )}

      {tab === "form" && (
        <div className="mt-6 space-y-4 print:hidden">
          {result.recomendaciones_formulario.map((f, i) => (
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

      <div className="mt-10 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row print:hidden">
        <button type="button" onClick={onBack} className="px-5 py-3 text-sm text-muted hover:text-ink">
          ← Ajustar respuestas
        </button>
        <button type="button" onClick={onRestart} className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-medium transition hover:border-clay hover:text-clay">
          Postularme a otra vacante
        </button>
      </div>
    </div>
  );
}
