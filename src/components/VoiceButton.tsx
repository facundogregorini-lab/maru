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

/**
 * Estado del dictado. `onText` recibe lo terminado de cada tramo (`first`: primer tramo de esta grabación);
 * si devuelve false, se avisa que no se entendió (por ejemplo, un número).
 */
export function useDictation(onText: (text: string, first: boolean) => boolean | void, lang = "es-AR") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const firstRef = useRef(true);
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
      const done: string[] = [];
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) done.push(r[0].transcript.trim());
        else partial += r[0].transcript;
      }
      // Un solo llamado por evento: dos frases terminadas juntas no se pisan.
      const text = done.filter(Boolean).join(" ");
      if (text) {
        const ok = onTextRef.current(text, firstRef.current);
        firstRef.current = false;
        setError(ok === false ? "No te entendimos bien. Probá de nuevo." : "");
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
    firstRef.current = true;
    setError("");
    rec.start();
    setListening(true);
  }

  function stop() {
    recRef.current?.stop();
  }

  return { supported, listening, interim, error, start, stop };
}

/** Dictado por voz: transcribe en vivo y entrega cada frase terminada. */
/** `compact`: botón chico para respuestas cortas; si el navegador no dicta, no muestra nada. */
export default function VoiceButton({ onText, lang = "es-AR", compact = false, label }: { onText: (text: string) => void; lang?: string; compact?: boolean; label?: string }) {
  const { supported, listening, interim, error, start, stop } = useDictation((t) => onText(t), lang);

  if (!supported) {
    if (compact) return null;
    return <p className="text-xs text-muted">Tu navegador no permite dictado por voz. Probá desde Chrome, Edge o Safari.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={listening ? stop : start}
        className={`inline-flex items-center gap-2 rounded-full font-medium transition ${compact ? "px-3 py-1 text-xs" : "px-4 py-2 text-sm"} ${
          listening ? "bg-brand text-paper" : "border border-line bg-paper text-ink hover:border-brand hover:text-brand"
        }`}
        aria-pressed={listening}
      >
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${listening ? "bg-paper" : "bg-brand"}`}>
          {listening && <span className="absolute inset-0 animate-ping rounded-full bg-paper/70" />}
        </span>
        {listening ? "Terminar de grabar" : (label ?? (compact ? "Dictar" : "Contalo en un audio"))}
      </button>
      {listening && <span className="text-sm italic text-muted">{interim || "Te escuchamos…"}</span>}
      {error && <span className="text-sm text-danger-dark">{error}</span>}
    </div>
  );
}

/**
 * Campo con micrófono adentro (a la derecha): tocás, hablás y lo dictado entra en el campo. El campo hijo
 * necesita lugar a la derecha (`pr-12!`). Si el navegador no dicta, queda el campo solo.
 */
export function DictateField({
  onText,
  multiline = false,
  lang = "es-AR",
  className,
  children,
}: {
  onText: (text: string, first: boolean) => boolean | void;
  multiline?: boolean;
  lang?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { supported, listening, interim, error, start, stop } = useDictation(onText, lang);
  return (
    <div className={className}>
      <div className="relative">
        {children}
        {supported && (
          <button
            type="button"
            onClick={listening ? stop : start}
            aria-pressed={listening}
            aria-label={listening ? "Terminar de dictar" : "Dictar por voz"}
            title={listening ? "Terminar de dictar" : "Dictar por voz"}
            className={`absolute right-2 grid h-9 w-9 place-items-center rounded-full transition ${multiline ? "top-2" : "top-1/2 -translate-y-1/2"} ${
              listening ? "bg-ink text-neon" : "text-ink/60 hover:bg-black/[0.05] hover:text-ink"
            }`}
          >
            {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-ink/25" />}
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5.5" y="1.5" width="5" height="8" rx="2.5" />
              <path d="M3 7.5a5 5 0 0 0 10 0M8 12.5v2" />
            </svg>
          </button>
        )}
      </div>
      {listening && <p className="mt-1.5 text-xs italic text-muted">{interim || "Te escuchamos…"}</p>}
      {error && <p className="mt-1.5 text-xs text-danger-dark">{error}</p>}
    </div>
  );
}
