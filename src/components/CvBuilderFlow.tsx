"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildCvDoc } from "@/lib/cv";
import { applyGapAnswers, findGaps } from "@/lib/gaps";
import { IDIOMAS, INDUSTRIAS, NIVELES, PAISES } from "@/lib/objetivo";
import { saveProfile } from "@/lib/profileStore";
import { contextFromCvAnalysis, type CvAnalysis, type CvDoc, type CvGeneration, type GapQuestion, type Objetivo, type Profile } from "@/lib/schemas";
import { load, remove, save } from "@/lib/storage";
import CvEditor from "./cv/CvEditor";
import CvSourceField, { useCvInput } from "./CvSourceField";
import Questions from "./Questions";
import { Chips, ErrorBanner, Loading, PrimaryButton, StepCard, inputClass, post } from "./ui";
import VoiceButton from "./VoiceButton";
import { ProductHero, ProductMore, ToolHeading } from "./product/ProductLanding";

type Stage = "inicio" | "analizando" | "preguntas" | "generando" | "resultado";
const SESSION_KEY = "maru:cv:v1";

const EMPTY: Objetivo = { rol: "", nivel: "", industria: "", pais: "AR", idioma: "es" };

const GUIDE = ["Logros de los que estás orgulloso", "Qué tipo de trabajo buscás", "Algo que tu CV todavía no cuenta"];

const LOADING_ANALYZE = [
  "Leyendo tu perfil con atención…",
  "Pensando en lo que buscan los recruiters…",
  "Buscando las palabras clave de tu rol…",
  "Pensando qué preguntarte…",
];
const LOADING_GENERATE = [
  "Escribiendo tu CV…",
  "Ordenando tus logros por impacto…",
  "Integrando las palabras clave con naturalidad…",
  "Últimos retoques…",
];

type Session = {
  objetivo: Objetivo;
  notas: string;
  analysis: CvAnalysis;
  profile: Profile;
  gaps: GapQuestion[];
  answers: Record<string, string>;
  gapAnswers: Record<string, string>;
  generation: CvGeneration | null;
  doc: CvDoc | null;
};

export default function CvBuilderFlow() {
  const [stage, setStage] = useState<Stage>("inicio");
  const [error, setError] = useState("");
  const cv = useCvInput();
  const [objetivo, setObjetivo] = useState<Objetivo>(EMPTY);
  const [notas, setNotas] = useState("");

  const [analysis, setAnalysis] = useState<CvAnalysis | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gaps, setGaps] = useState<GapQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gapAnswers, setGapAnswers] = useState<Record<string, string>>({});
  const [generation, setGeneration] = useState<CvGeneration | null>(null);
  const [doc, setDocState] = useState<CvDoc | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Retomamos el último CV si se recargó la página.
  useEffect(() => {
    const s = load<Session>(SESSION_KEY);
    if (!s?.analysis || !s.profile) return;
    setObjetivo(s.objetivo);
    setNotas(s.notas);
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
    save(SESSION_KEY, { objetivo, notas, analysis, profile, gaps, answers, gapAnswers, generation, doc } satisfies Session);
  }, [objetivo, notas, analysis, profile, gaps, answers, gapAnswers, generation, doc]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  const setDoc = (fn: (d: CvDoc) => CvDoc) => setDocState((d) => (d ? fn(d) : d));
  const set = (patch: Partial<Objetivo>) => setObjetivo((o) => ({ ...o, ...patch }));

  async function analyze() {
    setError("");
    setStage("analizando");
    try {
      const saved = cv.savedProfile;
      const [p, a] = await Promise.all([
        saved ? Promise.resolve({ profile: saved, gaps: findGaps(saved) }) : post<{ profile: Profile; gaps: GapQuestion[] }>("/api/profile", { source: cv.source }),
        post<{ analysis: CvAnalysis }>("/api/cv/analyze", { source: cv.source, objetivo, notas }),
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
      if (err.code === "CV_UNREADABLE" || err.code === "CV_INVALID" || err.code === "CV_TOO_LARGE") cv.fallbackToText();
    }
  }

  async function generate() {
    if (!analysis || !profile) return;
    setError("");
    setStage("generando");
    try {
      const completed = applyGapAnswers(profile, gaps, gapAnswers);
      const { generation: g } = await post<{ generation: CvGeneration }>("/api/cv/generate", { profile: completed, objetivo, notas, analysis, answers });
      const next = buildCvDoc(completed, g, contextFromCvAnalysis(analysis, objetivo));
      // Si ya había un diseño o una foto, los conservamos al regenerar.
      if (doc) Object.assign(next, { template: doc.template, style: doc.style, photo: doc.photo, showPhoto: doc.showPhoto });
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
    <div ref={topRef} className="scroll-mt-24">
      <ErrorBanner message={error} />

      {stage === "inicio" && (
        <>
          <ProductHero id="cv" />
          <ToolHeading hint="Tu CV queda guardado sólo en este navegador." />

          <div className="mt-10 space-y-6">
            <StepCard n={1} title="Tu experiencia" hint="La usamos tal cual: cargos, fechas y estudios se copian de tu perfil, sin inventar nada.">
              <CvSourceField input={cv} />
            </StepCard>

            <StepCard n={2} title="¿A dónde querés llegar?" hint="Así priorizamos lo que más pesa para ese rol y ese mercado.">
              <label className="block text-sm font-medium" htmlFor="rol">
                Rol que buscás
              </label>
              <input
                id="rol"
                value={objetivo.rol}
                onChange={(e) => set({ rol: e.target.value })}
                placeholder="Ej.: Head of Growth, Analista de datos, Product Manager…"
                className={`mt-2 ${inputClass}`}
              />
              <p className="mt-1.5 text-xs text-muted">Si no estás seguro, dejalo vacío y lo deducimos de tu trayectoria.</p>

              <p className="mt-5 text-sm font-medium">Nivel</p>
              <div className="mt-2">
                <Chips value={objetivo.nivel} options={NIVELES.map((n) => [n, n || "Que lo defina Maru"] as const)} onChange={(v) => set({ nivel: v })} />
              </div>

              <p className="mt-5 text-sm font-medium">Industria o tipo de empresa</p>
              <div className="mt-2">
                <Chips
                  value={objetivo.industria}
                  options={[["", "Cualquiera"] as const, ...INDUSTRIAS.map((i) => [i, i] as const)]}
                  onChange={(v) => set({ industria: v })}
                />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium" htmlFor="pais">
                    ¿Dónde buscás?
                  </label>
                  <select id="pais" value={objetivo.pais} onChange={(e) => set({ pais: e.target.value })} className={`mt-2 ${inputClass}`}>
                    {PAISES.map(([code, label]) => (
                      <option key={code || "remoto"} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-sm font-medium">Idioma del CV</p>
                  <div className="mt-2">
                    <Chips value={objetivo.idioma} options={IDIOMAS} onChange={(v) => set({ idioma: v })} />
                  </div>
                </div>
              </div>
            </StepCard>

            <StepCard n={3} title="Lo que querés destacar" hint="Opcional, pero hace la diferencia. Escribilo o contalo en un audio.">
              <ul className="mb-3 grid gap-2 sm:grid-cols-3">
                {GUIDE.map((g) => (
                  <li key={g} className="rounded-xl bg-sand px-3 py-2 text-xs leading-snug text-muted">
                    {g}
                  </li>
                ))}
              </ul>
              <textarea
                rows={5}
                placeholder="Lideré… Me enorgullece… Busco un rol donde…"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className={`${inputClass} leading-relaxed`}
              />
              <div className="mt-3">
                <VoiceButton onText={(t) => setNotas((f) => (f ? `${f.trimEnd()} ${t}` : t))} />
              </div>
            </StepCard>

            <div className="flex flex-col items-center gap-3 pt-2">
              <PrimaryButton onClick={analyze} disabled={!cv.ready}>
                Armar mi CV
              </PrimaryButton>
              {!cv.ready && <p className="text-xs text-muted">Cargá tu experiencia para seguir.</p>}
            </div>
          </div>
          <ProductMore id="cv" />
        </>
      )}

      {stage === "analizando" && <Loading messages={LOADING_ANALYZE} />}
      {stage === "generando" && <Loading messages={LOADING_GENERATE} />}

      {stage === "preguntas" && analysis && (
        <Questions
          kicker="Tu objetivo"
          title={analysis.rol_objetivo}
          summary={analysis.resumen_objetivo}
          strengths={analysis.fortalezas}
          strengthsTitle="Lo que ya juega a tu favor"
          gapsTitle="Lo que conviene mostrar mejor"
          gapsList={analysis.oportunidades}
          emptyGaps="¡Tu perfil ya cubre lo importante!"
          preguntas={analysis.preguntas}
          nextLabel="Armar mi CV"
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
        <div className="animate-rise">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand">Tu CV para</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">{analysis.rol_objetivo}</h1>

          <CvEditor doc={doc} setDoc={setDoc} context={contextFromCvAnalysis(analysis, objetivo)} cambios={generation.cambios_clave} />

          {generation.consejos.length > 0 && (
            <section className="mt-8 rounded-3xl bg-sage-soft p-6 sm:p-8">
              <h2 className="font-display text-2xl tracking-tight">Para seguir sumando</h2>
              <ul className="mt-3 space-y-2 leading-relaxed">
                {generation.consejos.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-sage">●</span>
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/postulacion" className="group rounded-3xl border border-line bg-paper p-6 transition hover:border-brand">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">¿Encontraste una búsqueda?</p>
              <p className="mt-2 font-display text-xl">Adaptá tu CV a esa vacante →</p>
              <p className="mt-1 text-sm text-muted">Con el coach de postulación, más respuestas para el formulario.</p>
            </Link>
            <Link href="/carta" className="group rounded-3xl border border-line bg-paper p-6 transition hover:border-brand">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">Sumale una carta</p>
              <p className="mt-2 font-display text-xl">Armá tu carta de presentación →</p>
              <p className="mt-1 text-sm text-muted">Usamos el perfil que ya cargaste.</p>
            </Link>
          </section>

          <div className="mt-10 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => setStage("preguntas")} className="px-5 py-3 text-sm text-muted hover:text-ink">
              ← Ajustar respuestas
            </button>
            <button
              type="button"
              onClick={restart}
              className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-medium transition hover:border-brand hover:text-brand"
            >
              Empezar de nuevo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
