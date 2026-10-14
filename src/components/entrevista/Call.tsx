"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EntrevistaOpciones, EntrevistaPlan, Intercambio, Turno } from "@/lib/schemas";
import { speak, stopSpeaking, ttsSupported, useDictation } from "../speech";
import { post } from "../ui";

type Phase = "lobby" | "speaking" | "listening" | "thinking" | "done";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * La entrevista en sí, con formato de videollamada: la entrevistadora habla (voz del navegador),
 * la persona responde por voz (dictado) o por texto, y la IA reacciona y repregunta si hace falta.
 */
export default function Call({
  plan,
  opciones,
  onFinish,
  onCancel,
}: {
  plan: EntrevistaPlan;
  opciones: EntrevistaOpciones;
  onFinish: (historial: Intercambio[]) => void;
  onCancel: () => void;
}) {
  const lang = plan.idioma || "es";
  const dictation = useDictation(lang);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [voice, setVoice] = useState(true);
  const [camera, setCamera] = useState(false);
  const [caption, setCaption] = useState("");
  const [idx, setIdx] = useState(0); // pregunta del plan en curso
  const [current, setCurrent] = useState<{ texto: string; repregunta: boolean }>({ texto: "", repregunta: false });
  const [historial, setHistorial] = useState<Intercambio[]>([]);
  const [typed, setTyped] = useState("");
  const [answerStart, setAnswerStart] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const total = plan.preguntas.length;

  const useVoice = voice && dictation.supported;

  useEffect(() => {
    if (!answerStart) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [answerStart]);

  useEffect(
    () => () => {
      stopSpeaking();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function toggleCamera(on: boolean) {
    setCamera(on);
    if (!on) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = s;
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play().catch(() => null);
        }
      });
    } catch {
      setCamera(false);
      setError("No pudimos prender la cámara. Podés seguir sin cámara.");
    }
  }

  /** La entrevistadora dice algo y, al terminar, abrimos el turno de respuesta. */
  const say = useCallback(
    async (text: string, next: { texto: string; repregunta: boolean } | null) => {
      setPhase("speaking");
      setCaption(text);
      if (ttsSupported()) await speak(text, lang);
      else await new Promise((r) => setTimeout(r, Math.min(6000, 1200 + text.length * 25)));
      if (!next) return;
      setCurrent(next);
      dictation.reset();
      setTyped("");
      setAnswerStart(Date.now());
      setPhase("listening");
      if (voice && dictation.supported) dictation.start();
    },
    [lang, voice, dictation],
  );

  function join() {
    const first = plan.preguntas[0]?.pregunta ?? "";
    void say(`${plan.apertura} ${first}`, { texto: first, repregunta: false });
  }

  function repeat() {
    dictation.stop();
    void say(current.texto, current);
  }

  async function submit() {
    dictation.stop();
    const respuesta = (useVoice ? `${dictation.text} ${dictation.interim}` : typed).trim();
    const segundos = (Date.now() - answerStart) / 1000;
    setAnswerStart(0);
    const h: Intercambio[] = [...historial, { pregunta: current.texto, respuesta, segundos, repregunta: current.repregunta }];
    setHistorial(h);
    setPhase("thinking");
    setCaption("");

    const isLast = idx >= total - 1;
    let turno: Turno = { reaccion: "", repregunta: "" };
    try {
      // Una repregunta como máximo por pregunta del plan.
      ({ turno } = await post<{ turno: Turno }>("/api/entrevista/turno", { plan, opciones, historial: h, puede_repreguntar: !current.repregunta && !!respuesta }));
    } catch {
      // Si la IA tarda o falla, la entrevista sigue igual con la próxima pregunta.
    }

    if (turno.repregunta) {
      void say(`${turno.reaccion} ${turno.repregunta}`.trim(), { texto: turno.repregunta, repregunta: true });
      return;
    }
    if (isLast) {
      await say(`${turno.reaccion} ${plan.cierre}`.trim(), null);
      setPhase("done");
      onFinish(h);
      return;
    }
    const next = plan.preguntas[idx + 1].pregunta;
    setIdx(idx + 1);
    void say(`${turno.reaccion} ${next}`.trim(), { texto: next, repregunta: false });
  }

  function finishEarly() {
    dictation.stop();
    stopSpeaking();
    const respuesta = (useVoice ? dictation.text : typed).trim();
    const h = respuesta && phase === "listening" ? [...historial, { pregunta: current.texto, respuesta, segundos: (Date.now() - answerStart) / 1000, repregunta: current.repregunta }] : historial;
    onFinish(h);
  }

  const elapsed = answerStart ? Math.max(0, Math.round(((now || Date.now()) - answerStart) / 1000)) : 0;
  const live = `${dictation.text} ${dictation.interim}`.trim();

  /* ---------- Sala de espera ---------- */
  if (phase === "lobby") {
    return (
      <div className="animate-rise grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative grid place-items-center overflow-hidden rounded-3xl bg-ink" style={{ aspectRatio: "16 / 9" }}>
          {camera ? (
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover [transform:scaleX(-1)]" />
          ) : (
            <span className="grid h-24 w-24 place-items-center rounded-full bg-paper/10 font-serif text-3xl text-paper">Vos</span>
          )}
          <span className="absolute bottom-3 left-3 rounded-full bg-ink/60 px-3 py-1 text-xs text-paper">Vista previa</span>
        </div>
        <div className="rounded-3xl bg-paper p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-clay">Sala de espera</p>
          <h2 className="mt-1 font-serif text-2xl">
            {plan.entrevistador.nombre} te está esperando
          </h2>
          <p className="mt-1 text-sm text-muted">
            {plan.entrevistador.cargo}
            {plan.empresa ? ` · ${plan.empresa}` : ""} · {total} preguntas
          </p>
          <div className="mt-5 space-y-3 text-sm">
            <label className="flex items-center justify-between gap-3">
              <span>
                Responder con la voz
                {!dictation.supported && <span className="block text-xs text-muted">Tu navegador no transcribe: vas a responder por escrito.</span>}
              </span>
              <input type="checkbox" checked={useVoice} disabled={!dictation.supported} onChange={(e) => setVoice(e.target.checked)} className="h-5 w-5 accent-clay" />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span>Prender mi cámara (sólo para vos, no se graba)</span>
              <input type="checkbox" checked={camera} onChange={(e) => void toggleCamera(e.target.checked)} className="h-5 w-5 accent-clay" />
            </label>
          </div>
          {!ttsSupported() && <p className="mt-3 text-xs text-muted">Tu navegador no tiene voz: vas a leer las preguntas en pantalla.</p>}
          {error && <p className="mt-3 text-sm text-clay-dark">{error}</p>}
          <button type="button" onClick={join} className="mt-6 w-full rounded-full bg-clay px-6 py-3 font-medium text-paper transition hover:bg-clay-dark">
            Unirme a la entrevista
          </button>
          <button type="button" onClick={onCancel} className="mt-2 w-full px-6 py-2 text-sm text-muted hover:text-ink">
            ← Cambiar la configuración
          </button>
          <p className="mt-3 text-xs leading-relaxed text-muted">Tip: usá auriculares para que el micrófono no escuche la voz de la entrevistadora.</p>
        </div>
      </div>
    );
  }

  /* ---------- Llamada ---------- */
  const speakingNow = phase === "speaking";
  return (
    <div className="animate-rise overflow-hidden rounded-3xl bg-ink text-paper shadow-2xl">
      <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
        <span className="truncate text-paper/80">
          Entrevista · {plan.puesto}
          {plan.empresa ? ` · ${plan.empresa}` : ""}
        </span>
        <span className="shrink-0 rounded-full bg-paper/10 px-3 py-1 text-xs">
          Pregunta {Math.min(idx + 1, total)} de {total}
        </span>
      </div>

      <div className="grid gap-3 px-3 sm:grid-cols-2">
        {/* Entrevistadora */}
        <div className="relative grid place-items-center rounded-2xl bg-[#3a302b]" style={{ aspectRatio: "16 / 10" }}>
          <div className={`grid h-24 w-24 place-items-center rounded-full bg-clay font-serif text-3xl transition sm:h-28 sm:w-28 ${speakingNow ? "ring-4 ring-honey/80 ring-offset-4 ring-offset-[#3a302b]" : ""}`}>
            {initials(plan.entrevistador.nombre)}
          </div>
          {phase === "thinking" && <span className="absolute top-3 rounded-full bg-paper/10 px-3 py-1 text-xs">pensando…</span>}
          <span className="absolute bottom-2 left-2 rounded-lg bg-ink/60 px-2 py-1 text-xs">
            {plan.entrevistador.nombre} · {plan.entrevistador.cargo}
          </span>
        </div>
        {/* Vos */}
        <div className="relative grid place-items-center overflow-hidden rounded-2xl bg-[#2f2825]" style={{ aspectRatio: "16 / 10" }}>
          {camera ? (
            <video ref={videoRef} muted playsInline className="h-full w-full object-cover [transform:scaleX(-1)]" />
          ) : (
            <span className={`grid h-24 w-24 place-items-center rounded-full bg-paper/10 font-serif text-2xl transition ${phase === "listening" && dictation.listening ? "ring-4 ring-sage ring-offset-4 ring-offset-[#2f2825]" : ""}`}>
              Vos
            </span>
          )}
          <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-lg bg-ink/60 px-2 py-1 text-xs">
            {phase === "listening" && useVoice && <span className={`h-2 w-2 rounded-full ${dictation.listening ? "animate-pulse bg-sage" : "bg-paper/40"}`} />}
            Vos
          </span>
        </div>
      </div>

      {/* Subtítulos */}
      <div className="min-h-[5.5rem] px-5 pt-4 text-center" aria-live="polite">
        {phase === "speaking" && <p className="mx-auto max-w-3xl text-lg leading-relaxed">{caption}</p>}
        {phase === "listening" && (
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-paper/70">
            <span className="mr-2 text-xs uppercase tracking-[0.14em] text-honey">{current.repregunta ? "Repregunta" : "Pregunta"}</span>
            {current.texto}
          </p>
        )}
        {phase === "thinking" && <p className="text-sm text-paper/60">{plan.entrevistador.nombre} está tomando nota…</p>}
      </div>

      {/* Tu respuesta */}
      {phase === "listening" && (
        <div className="mx-3 mb-3 mt-3 rounded-2xl bg-paper p-4 text-ink">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>Tu respuesta {useVoice ? (dictation.listening ? "· te escuchamos" : "· micrófono en pausa") : ""}</span>
            <span className={elapsed > 150 ? "font-semibold text-clay-dark" : ""}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} {elapsed > 150 ? "· intentá cerrar" : ""}
            </span>
          </div>
          {useVoice ? (
            <p className="min-h-[3.5rem] text-[15px] leading-relaxed">
              {dictation.text}
              <span className="text-muted"> {dictation.interim}</span>
              {!live && <span className="text-muted">Hablá cuando quieras… (1 a 2 minutos es ideal)</span>}
            </p>
          ) : (
            <textarea
              autoFocus
              rows={4}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Escribí tu respuesta como si la dijeras…"
              className="w-full resize-y rounded-xl border border-line bg-cream px-3 py-2 text-[15px] leading-relaxed outline-none focus:border-clay focus:ring-4 focus:ring-clay-soft"
            />
          )}
          {dictation.error && <p className="mt-2 text-sm text-clay-dark">{dictation.error}</p>}
        </div>
      )}

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-5 pt-2">
        {phase === "listening" && useVoice && (
          <button
            type="button"
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
            className="rounded-full bg-paper/10 px-4 py-2.5 text-sm transition hover:bg-paper/20"
            aria-pressed={dictation.listening}
          >
            {dictation.listening ? "🎙 Pausar micrófono" : "🎙 Seguir hablando"}
          </button>
        )}
        {phase === "listening" && (
          <>
            <button type="button" onClick={repeat} className="rounded-full bg-paper/10 px-4 py-2.5 text-sm transition hover:bg-paper/20">
              ↺ Repetir pregunta
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!(useVoice ? live : typed.trim())}
              className="rounded-full bg-sage px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-sage/90 disabled:opacity-50"
            >
              Listo, enviar respuesta
            </button>
          </>
        )}
        <button type="button" onClick={finishEarly} className="rounded-full bg-red-600/90 px-4 py-2.5 text-sm font-medium transition hover:bg-red-600">
          Terminar
        </button>
      </div>
    </div>
  );
}
