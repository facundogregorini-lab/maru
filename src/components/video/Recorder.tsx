"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VideoFeedback } from "@/lib/schemas";
import { downloadBlob } from "@/lib/export/download";
import { useLoginGate } from "../auth/useLoginGate";
import { speechStats, useDictation } from "../speech";
import { post } from "../ui";
import FeedbackCard from "./FeedbackCard";

type Phase = "off" | "preview" | "countdown" | "recording" | "review";

const MIME_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

/**
 * Cámara + teleprompter + grabación en el navegador. El video nunca sale del navegador:
 * sólo si la persona pide feedback mandamos la transcripción y 3 fotogramas chicos a la IA.
 */
export default function Recorder({ script, target, lang, filename }: { script: string; target: number; lang: string; filename: string }) {
  const [phase, setPhase] = useState<Phase>("off");
  const [error, setError] = useState("");
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [speed, setSpeed] = useState(34); // px por segundo
  const [fontSize, setFontSize] = useState(26);
  const [prompter, setPrompter] = useState(true);
  const [take, setTake] = useState<{ url: string; blob: Blob; seconds: number; mime: string } | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<VideoFeedback | null>(null);
  const [asking, setAsking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef(0);
  const prompterRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const frameTimers = useRef<number[]>([]);
  const dictation = useDictation(lang);
  const gate = useLoginGate();

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(
    () => () => {
      stopCamera();
      cancelAnimationFrame(rafRef.current);
      frameTimers.current.forEach(clearTimeout);
    },
    [stopCamera],
  );

  useEffect(() => () => void (take && URL.revokeObjectURL(take.url)), [take]);

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) return setError("Tu navegador no permite usar la cámara. Probá con Chrome, Edge o Safari actualizados.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      setPhase("preview");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => null);
        }
      });
    } catch (e) {
      const name = (e as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Necesitamos permiso para usar la cámara y el micrófono. Habilitalo en el candado de la barra de direcciones."
          : "No encontramos una cámara disponible. Revisá que no la esté usando otra app.",
      );
    }
  }

  function grabFrame(): string | null {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const w = 480;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")?.drawImage(v, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.7).split(",")[1] ?? null;
  }

  function scrollPrompter(prev: number) {
    rafRef.current = requestAnimationFrame((now) => {
      const el = prompterRef.current;
      if (el && prev) el.scrollTop += ((now - prev) / 1000) * speedRef.current;
      setElapsed((Date.now() - startRef.current) / 1000);
      scrollPrompter(now);
    });
  }
  const speedRef = useRef(speed);
  speedRef.current = speed;

  function countdownThenRecord() {
    setPhase("countdown");
    setCount(3);
    let n = 3;
    const id = window.setInterval(() => {
      n -= 1;
      if (n === 0) {
        clearInterval(id);
        record();
      } else setCount(n);
    }, 1000);
  }

  function record() {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch {
      setPhase("preview");
      return setError("Tu navegador no puede grabar video. Probá con Chrome, Edge o Safari actualizados.");
    }
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || mime || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const seconds = (Date.now() - startRef.current) / 1000;
      setTake({ url: URL.createObjectURL(blob), blob, seconds, mime: type });
      setPhase("review");
    };
    recorderRef.current = rec;
    if (prompterRef.current) prompterRef.current.scrollTop = 0;
    dictation.reset();
    if (dictation.supported) dictation.start();
    setFrames([]);
    setFeedback(null);
    // Tres fotogramas a lo largo de la toma, para el feedback de encuadre y luz.
    frameTimers.current = [0.2, 0.5, 0.8].map((f) =>
      window.setTimeout(() => {
        const fr = grabFrame();
        if (fr) setFrames((x) => [...x, fr]);
      }, target * 1000 * f),
    );
    startRef.current = Date.now();
    setElapsed(0);
    rec.start(1000);
    setPhase("recording");
    scrollPrompter(0);
  }

  function stop() {
    cancelAnimationFrame(rafRef.current);
    frameTimers.current.forEach(clearTimeout);
    if (frames.length === 0) {
      const fr = grabFrame();
      if (fr) setFrames([fr]);
    }
    dictation.stop();
    recorderRef.current?.stop();
  }

  function retake() {
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    setFeedback(null);
    setPhase("preview");
    requestAnimationFrame(() => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        void videoRef.current.play().catch(() => null);
      }
    });
  }

  const stats = take ? speechStats(dictation.text, take.seconds) : null;

  async function askFeedback() {
    if (!take || !stats) return;
    setAsking(true);
    setError("");
    try {
      const { feedback } = await post<{ feedback: VideoFeedback }>("/api/video/feedback", {
        guion: script,
        transcripcion: dictation.text,
        segundos: take.seconds,
        wpm: stats.wpm,
        muletillas: stats.fillers,
        fotogramas: frames,
      });
      setFeedback(feedback);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAsking(false);
    }
  }

  function download() {
    if (!take) return;
    gate.run("descargar tu video", () => downloadBlob(take.blob, `${filename}.${take.mime.includes("mp4") ? "mp4" : "webm"}`));
  }

  const over = elapsed > target;
  const pct = Math.min(100, (elapsed / target) * 100);

  return (
    <div className="space-y-4">
      {gate.dialog}
      {error && (
        <div role="alert" className="rounded-2xl border border-clay/30 bg-clay-soft px-4 py-3 text-sm text-clay-dark">
          {error}
        </div>
      )}

      <div className="relative overflow-hidden rounded-3xl bg-ink shadow-xl" style={{ aspectRatio: "16 / 9" }}>
        {phase === "review" && take ? (
          <video key={take.url} src={take.url} controls playsInline className="h-full w-full bg-ink object-contain" />
        ) : (
          <video ref={videoRef} muted playsInline className={`h-full w-full object-cover [transform:scaleX(-1)] ${phase === "off" ? "hidden" : ""}`} />
        )}

        {phase === "off" && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-paper">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-paper/10 text-3xl" aria-hidden>
                ●
              </div>
              <p className="mt-4 font-serif text-2xl">Tu estudio de grabación</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-paper/70">El guion pasa en pantalla mientras grabás. El video se queda en tu navegador.</p>
              <button type="button" onClick={startCamera} className="mt-6 rounded-full bg-clay px-6 py-3 font-medium text-paper transition hover:bg-clay-dark">
                Prender la cámara
              </button>
            </div>
          </div>
        )}

        {/* Teleprompter: arriba y centrado, cerca de la cámara, para no perder la mirada. */}
        {prompter && (phase === "preview" || phase === "countdown" || phase === "recording") && (
          <div
            ref={prompterRef}
            className="pointer-events-auto absolute inset-x-[8%] top-3 max-h-[42%] overflow-hidden rounded-2xl bg-ink/65 px-6 py-4 text-center text-paper backdrop-blur-sm"
            style={{ fontSize, lineHeight: 1.35 }}
            aria-label="Teleprompter"
          >
            <div className="h-[30%]" aria-hidden />
            <p className="whitespace-pre-line font-medium">{script}</p>
            <div className="h-[80%]" aria-hidden />
          </div>
        )}

        {phase === "countdown" && (
          <div className="absolute inset-0 grid place-items-center bg-ink/40">
            <span key={count} className="animate-rise font-serif text-8xl text-paper">
              {count}
            </span>
          </div>
        )}

        {phase === "recording" && (
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="flex items-center gap-3 text-sm text-paper">
              <span className="flex items-center gap-2 rounded-full bg-ink/60 px-3 py-1 backdrop-blur">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                {fmt(elapsed)} / {fmt(target)}
              </span>
              {over && <span className="rounded-full bg-clay px-3 py-1 text-xs font-medium">Te pasaste del tiempo: cerrá con tu frase final</span>}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper/25">
              <div className={`h-full transition-[width] ${over ? "bg-clay" : "bg-paper"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      {(phase === "preview" || phase === "recording" || phase === "countdown") && (
        <div className="flex flex-col gap-4 rounded-3xl bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid flex-1 gap-3 text-sm sm:grid-cols-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={prompter} onChange={(e) => setPrompter(e.target.checked)} className="h-4 w-4 accent-clay" />
              Teleprompter
            </label>
            <label className="flex items-center gap-2 text-muted">
              Velocidad
              <input type="range" min={15} max={70} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="flex-1 accent-clay" />
            </label>
            <label className="flex items-center gap-2 text-muted">
              Letra
              <input type="range" min={18} max={40} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1 accent-clay" />
            </label>
          </div>
          {phase === "recording" ? (
            <button type="button" onClick={stop} className="rounded-full bg-ink px-6 py-3 font-medium text-paper transition hover:bg-ink/85">
              ■ Terminar toma
            </button>
          ) : (
            <button
              type="button"
              onClick={countdownThenRecord}
              disabled={phase === "countdown"}
              className="rounded-full bg-clay px-6 py-3 font-medium text-paper transition hover:bg-clay-dark disabled:opacity-60"
            >
              ● Grabar
            </button>
          )}
        </div>
      )}

      {phase === "review" && take && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              [fmt(take.seconds), `de ${fmt(target)} objetivo`],
              [stats.wpm ? `${stats.wpm}` : "—", stats.wpm ? "palabras por minuto" : "sin transcripción"],
              [dictation.text ? `${stats.fillerCount}` : "—", "muletillas"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-paper p-4 text-center">
                <p className="font-serif text-3xl text-clay">{v}</p>
                <p className="text-xs text-muted">{l}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={askFeedback}
              disabled={asking}
              className="rounded-full bg-clay px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-clay-dark disabled:opacity-60"
            >
              {asking ? "Mirando tu toma…" : feedback ? "Pedir feedback otra vez" : "✨ Feedback de Maru"}
            </button>
            <button type="button" onClick={download} className="rounded-full border border-clay px-5 py-2.5 text-sm font-medium text-clay-dark transition hover:bg-clay-soft">
              Descargar video
            </button>
            <button type="button" onClick={retake} className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium transition hover:border-clay hover:text-clay">
              Grabar otra toma
            </button>
          </div>
          <p className="text-xs text-muted">
            Para el feedback mandamos a la IA lo que se transcribió y 3 fotogramas chicos de la toma. El video completo no sale de tu navegador.
          </p>
          {feedback && <FeedbackCard feedback={feedback} />}
        </div>
      )}
    </div>
  );
}
