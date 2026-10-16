"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoGuion, VideoOpciones } from "@/lib/schemas";
import { load, remove, save } from "@/lib/storage";
import { findTracked, upsertTracked } from "@/lib/tracker";
import CopyButton from "../CopyButton";
import CvSourceField, { useCvInput } from "../CvSourceField";
import JobField, { useJobInput } from "../JobField";
import { Chips, ErrorBanner, Loading, PrimaryButton, StepCard, inputClass, post } from "../ui";
import VoiceButton from "../VoiceButton";
import Recorder from "./Recorder";
import { ProductHero, ProductMore, ToolHeading } from "../product/ProductLanding";

type Stage = "inicio" | "escribiendo" | "guion" | "estudio";
const SESSION_KEY = "maru:video:v1";
const WORDS_PER_SECOND = 2.3;

const DURACIONES: readonly (readonly ["30" | "60" | "90", string])[] = [
  ["30", "30 segundos"],
  ["60", "1 minuto"],
  ["90", "1 minuto y medio"],
];
const TONOS: readonly (readonly [VideoOpciones["tono"], string])[] = [
  ["calido", "Cálido"],
  ["profesional", "Profesional"],
  ["energico", "Con energía"],
];
const IDIOMAS: readonly (readonly [VideoOpciones["idioma"], string])[] = [
  ["auto", "El de la búsqueda"],
  ["es", "Español"],
  ["en", "Inglés"],
  ["pt", "Portugués"],
];
const LOADING = ["Leyendo la búsqueda…", "Buscando tu mejor gancho…", "Escribiendo tu guion…", "Midiendo los tiempos…"];

type Bloque = VideoGuion["bloques"][number];
type Session = { job: ReturnType<ReturnType<typeof useJobInput>["snapshot"]>; motivacion: string; opciones: VideoOpciones; guion: VideoGuion };

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export default function VideoFlow() {
  const [stage, setStage] = useState<Stage>("inicio");
  const [error, setError] = useState("");
  const job = useJobInput("video");
  const cv = useCvInput();
  const [motivacion, setMotivacion] = useState("");
  const [opciones, setOpciones] = useState<VideoOpciones>({ duracion: 60, tono: "calido", idioma: "auto" });
  const [guion, setGuion] = useState<VideoGuion | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = load<Session>(SESSION_KEY);
    if (!s?.guion) return;
    job.restore(s.job);
    setMotivacion(s.motivacion);
    setOpciones(s.opciones);
    setGuion(s.guion);
    setStage("guion");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (guion) save(SESSION_KEY, { job: job.snapshot(), motivacion, opciones, guion } satisfies Session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guion, motivacion, opciones]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  const canWrite = job.ready && cv.ready && motivacion.trim().length > 15;

  async function write() {
    setError("");
    setStage("escribiendo");
    try {
      const { guion } = await post<{ guion: VideoGuion }>("/api/video/guion", { ...job.payload(), motivacion, source: cv.source, opciones });
      setGuion(guion);
      setStage("guion");
      // El guion no trae la empresa: sólo lo sumamos si la búsqueda vino de Maru o ya está en el seguimiento.
      const url = job.jobUrl.trim();
      const known = job.modo === "busqueda" ? (job.origin?.jobUrl === url ? job.origin : url ? findTracked({ jobUrl: url, title: "", company: "" }) : null) : null;
      if (known) upsertTracked({ id: known.id, title: known.title, company: known.company, jobUrl: url, artifact: "video" });
    } catch (e) {
      const err = e as Error & { code?: string };
      setStage("inicio");
      setError(err.message);
      if (err.code === "JOB_FETCH_FAILED") job.fallbackToText();
      if (err.code === "CV_UNREADABLE" || err.code === "CV_INVALID" || err.code === "CV_TOO_LARGE") cv.fallbackToText();
    }
  }

  function restart() {
    remove(SESSION_KEY);
    setGuion(null);
    setStage("inicio");
  }

  const setBloque = (i: number, patch: Partial<Bloque>) => setGuion((g) => (g ? { ...g, bloques: g.bloques.map((b, j) => (j === i ? { ...b, ...patch } : b)) } : g));
  const script = guion?.bloques.map((b) => b.texto.trim()).filter(Boolean).join("\n\n") ?? "";
  const totalWords = words(script);
  const estSeconds = Math.round(totalWords / WORDS_PER_SECOND);
  const filename = `Video_presentacion_${(guion?.titulo ?? "Maru").replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 40)}`;

  return (
    <div ref={topRef} className="scroll-mt-24">
      <ErrorBanner message={error} />

      {stage === "inicio" && (
        <>
          <ProductHero id="video" />
          <ToolHeading />
          <div className="mt-10 space-y-6">
            <StepCard n={1} title="¿Para qué es el video?" hint="Una búsqueda concreta, o una presentación general para el rol al que apuntás.">
              <JobField input={job} generalLabel="Presentación general" />
            </StepCard>
            <StepCard n={2} title="Tu experiencia" hint="Para que el guion tenga pruebas reales de lo que hiciste.">
              <CvSourceField input={cv} />
            </StepCard>
            <StepCard n={3} title="Lo que querés que se lleven" hint="Por qué te entusiasma, qué te hace distinta o distinto. Escribilo o grabalo.">
              <textarea
                rows={5}
                placeholder="Quiero que sepan que… Lo que más disfruto es… Un logro que me enorgullece…"
                value={motivacion}
                onChange={(e) => setMotivacion(e.target.value)}
                className={`${inputClass} leading-relaxed`}
              />
              <div className="mt-3">
                <VoiceButton onText={(t) => setMotivacion((m) => (m ? `${m.trimEnd()} ${t}` : t))} />
              </div>
            </StepCard>
            <StepCard n={4} title="Formato" hint="1 minuto es el estándar: alcanza para presentarte sin aburrir.">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">Duración</p>
                  <Chips value={String(opciones.duracion) as "30" | "60" | "90"} options={DURACIONES} onChange={(v) => setOpciones((o) => ({ ...o, duracion: Number(v) as 30 | 60 | 90 }))} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Tono</p>
                  <Chips value={opciones.tono} options={TONOS} onChange={(tono) => setOpciones((o) => ({ ...o, tono }))} />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Idioma</p>
                  <Chips value={opciones.idioma} options={IDIOMAS} onChange={(idioma) => setOpciones((o) => ({ ...o, idioma }))} />
                </div>
              </div>
            </StepCard>
            <div className="flex flex-col items-center gap-3 pt-2">
              <PrimaryButton onClick={write} disabled={!canWrite}>
                Escribir mi guion
              </PrimaryButton>
              {!canWrite && <p className="text-xs text-muted">Completá los tres primeros pasos para seguir.</p>}
            </div>
          </div>
          <ProductMore id="video" />
        </>
      )}

      {stage === "escribiendo" && <Loading messages={LOADING} />}

      {stage === "guion" && guion && (
        <div className="animate-rise">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand">Tu guion para</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">{guion.titulo}</h1>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-3">
              {guion.bloques.map((b, i) => {
                const secs = Math.round(words(b.texto) / WORDS_PER_SECOND);
                return (
                  <div key={i} className="rounded-3xl border border-line bg-paper p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="font-display text-lg">
                        <span className="mr-2 text-brand">{i + 1}.</span>
                        {b.nombre}
                      </h2>
                      <span className="text-xs text-muted">~{secs} s</span>
                    </div>
                    <textarea
                      value={b.texto}
                      onChange={(e) => setBloque(i, { texto: e.target.value })}
                      rows={Math.max(2, Math.ceil(b.texto.length / 70))}
                      className="mt-2 w-full resize-y rounded-xl border border-transparent bg-cream px-3 py-2 text-[15px] leading-relaxed outline-none transition hover:border-line focus:border-brand focus:ring-4 focus:ring-brand-soft"
                      aria-label={`Texto del bloque ${b.nombre}`}
                    />
                    <p className="mt-2 text-xs text-sage">
                      <b>Cómo decirlo:</b> {b.tip}
                    </p>
                  </div>
                );
              })}
            </div>

            <aside className="space-y-4">
              <div className="rounded-3xl bg-paper p-5 lg:sticky lg:top-4">
                <p className="text-xs text-muted">Duración estimada</p>
                <p className="font-display text-4xl text-brand">
                  {estSeconds}s <span className="text-base text-muted">/ {opciones.duracion}s</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand">
                  <div
                    className={`h-full ${estSeconds > opciones.duracion * 1.15 ? "bg-brand" : "bg-sage"}`}
                    style={{ width: `${Math.min(100, (estSeconds / opciones.duracion) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {totalWords} palabras{estSeconds > opciones.duracion * 1.15 ? " · recortá un poco para llegar con calma" : ""}
                </p>
                <button
                  type="button"
                  onClick={() => setStage("estudio")}
                  className="mt-4 w-full rounded-full bg-brand px-4 py-3 text-sm font-medium text-paper transition hover:bg-brand-dark"
                >
                  ● Grabar con teleprompter
                </button>
                <div className="mt-2 flex justify-center">
                  <CopyButton text={script} label="Copiar guion" />
                </div>
              </div>

              <div className="rounded-3xl bg-paper p-5">
                <h3 className="text-sm font-semibold">Antes de grabar</h3>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted">
                  {guion.consejos.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl bg-paper p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">Para mandarlo</h3>
                  <CopyButton text={guion.mensaje_envio} />
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">{guion.mensaje_envio}</p>
              </div>
            </aside>
          </div>

          <div className="mt-10 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => setStage("inicio")} className="px-5 py-3 text-sm text-muted hover:text-ink">
              ← Cambiar datos y reescribir
            </button>
            <button type="button" onClick={restart} className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-medium transition hover:border-brand hover:text-brand">
              Empezar otro video
            </button>
          </div>
        </div>
      )}

      {stage === "estudio" && guion && (
        <div className="animate-rise">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand">Estudio</p>
              <h1 className="mt-1 font-display text-3xl tracking-tight">{guion.titulo}</h1>
            </div>
            <button type="button" onClick={() => setStage("guion")} className="text-sm text-muted hover:text-ink">
              ← Volver al guion
            </button>
          </div>
          <Recorder script={script} target={opciones.duracion} lang={guion.idioma || "es"} filename={filename} />
        </div>
      )}
    </div>
  );
}
