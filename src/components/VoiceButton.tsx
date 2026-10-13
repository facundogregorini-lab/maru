"use client";

import { useEffect, useRef, useState } from "react";

// La Web Speech API no está tipada en lib.dom; declaramos lo mínimo que usamos.
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Dictado por voz: transcribe en vivo y entrega cada frase terminada. */
export default function VoiceButton({ onText, lang = "es-AR" }: { onText: (text: string) => void; lang?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => setSupported(getCtor() !== null), []);
  useEffect(() => () => recRef.current?.stop(), []);

  function start() {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onTextRef.current(r[0].transcript.trim());
        else partial += r[0].transcript;
      }
      setInterim(partial);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setError("Necesitamos permiso para usar el micrófono.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setError("No pudimos escucharte bien. Probá de nuevo.");
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    setError("");
    rec.start();
    setListening(true);
  }

  function stop() {
    recRef.current?.stop();
  }

  if (!supported) {
    return <p className="text-xs text-muted">Tu navegador no permite dictado por voz. Probá desde Chrome, Edge o Safari.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={listening ? stop : start}
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
          listening ? "bg-clay text-paper" : "border border-line bg-paper text-ink hover:border-clay hover:text-clay"
        }`}
        aria-pressed={listening}
      >
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${listening ? "bg-paper" : "bg-clay"}`}>
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-paper/70" />}
        </span>
        {listening ? "Terminar de grabar" : "Contalo en un audio"}
      </button>
      {listening && <span className="text-sm italic text-muted">{interim || "Te escuchamos…"}</span>}
      {error && <span className="text-sm text-clay-dark">{error}</span>}
    </div>
  );
}
