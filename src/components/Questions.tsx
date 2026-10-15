"use client";

import type { GapQuestion, Question } from "@/lib/schemas";
import VoiceButton from "./VoiceButton";
import { PrimaryButton } from "./ui";

type Answers = Record<string, string>;
type SetAnswers = React.Dispatch<React.SetStateAction<Answers>>;

/**
 * Paso de preguntas compartido: un resumen arriba (fortalezas / lo que falta),
 * datos faltantes del perfil y 3-5 preguntas cortas para destacar.
 */
export default function Questions({
  kicker,
  title,
  summary,
  strengths,
  strengthsTitle = "Por qué encajás",
  gapsTitle = "Lo que todavía no se ve en tu CV",
  gapsList,
  emptyGaps = "¡Nada importante! Tu perfil cubre lo que piden.",
  gaps,
  gapAnswers,
  setGapAnswers,
  preguntas,
  answers,
  setAnswers,
  onBack,
  backLabel,
  onNext,
  nextLabel,
}: {
  kicker: string;
  title: string;
  summary: string;
  strengths: string[];
  strengthsTitle?: string;
  gapsTitle?: string;
  gapsList: string[];
  emptyGaps?: string;
  gaps: GapQuestion[];
  gapAnswers: Answers;
  setGapAnswers: SetAnswers;
  preguntas: Question[];
  answers: Answers;
  setAnswers: SetAnswers;
  onBack: () => void;
  backLabel: string;
  onNext: () => void;
  nextLabel: string;
}) {
  const input =
    "mt-3 w-full rounded-xl border border-line bg-paper px-4 py-2.5 outline-none transition placeholder:text-muted/60 focus:border-celeste focus:ring-4 focus:ring-celeste-soft";
  return (
    <div className="animate-rise space-y-8">
      <section className="rounded-[2rem] bg-sand p-6 sm:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-celeste">{kicker}</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-muted">{summary}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-paper p-5">
            <h3 className="text-sm font-semibold text-sage">{strengthsTitle}</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
              {strengths.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-sage">●</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-paper p-5">
            <h3 className="text-sm font-semibold text-celeste-dark">{gapsTitle}</h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
              {gapsList.length ? (
                gapsList.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-celeste">○</span>
                    {b}
                  </li>
                ))
              ) : (
                <li className="text-muted">{emptyGaps}</li>
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
        <p className="mt-1 text-sm text-muted">Con una línea alcanza (o contalo en un audio). Si no sabés, dejala vacía.</p>
        <div className="mt-5 space-y-4">
          {preguntas.map((q, idx) => (
            <div key={q.id} className="rounded-3xl border border-line bg-paper/70 p-5 sm:p-6">
              <p className="font-medium">
                <span className="mr-2 font-serif text-celeste">{idx + 1}.</span>
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
                        answers[q.id] === o ? "border-celeste bg-celeste-soft text-celeste-dark" : "border-line bg-paper hover:border-celeste"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )}
              <input value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} placeholder="Tu respuesta…" className={input} />
              <div className="mt-2">
                <VoiceButton compact onText={(t) => setAnswers((a) => ({ ...a, [q.id]: a[q.id] ? `${a[q.id].trimEnd()} ${t}` : t }))} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onBack} className="px-5 py-3 text-sm text-muted hover:text-ink">
          {backLabel}
        </button>
        <PrimaryButton onClick={onNext}>{nextLabel}</PrimaryButton>
      </div>
    </div>
  );
}
