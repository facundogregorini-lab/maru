"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechLang = (lang: string) => ({ es: "es-AR", en: "en-US", pt: "pt-BR" })[lang.slice(0, 2)] ?? "es-AR";

/**
 * Dictado continuo para respuestas largas (entrevista, video): acumula el texto final,
 * muestra el parcial y se reinicia solo si el navegador corta por silencio.
 */
export function useDictation(lang: string) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);

  useEffect(() => setSupported(recognitionCtor() !== null), []);
  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.abort();
    },
    [],
  );

  const begin = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = speechLang(lang);
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let partial = "";
      let finals = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += `${r[0].transcript.trim()} `;
        else partial += r[0].transcript;
      }
      if (finals) setText((t) => `${t}${finals}`);
      setInterim(partial);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantRef.current = false;
        setError("Necesitamos permiso para usar el micrófono.");
      }
    };
    rec.onend = () => {
      setInterim("");
      // Chrome corta tras un silencio: si la persona sigue respondiendo, reanudamos.
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* se cerró: caemos al estado detenido */
        }
      }
      setListening(false);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [lang]);

  const start = useCallback(() => {
    setError("");
    wantRef.current = true;
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setText("");
    setInterim("");
  }, []);

  return { supported, listening, text: text.trim(), interim, error, start, stop, reset, setText };
}

/* ---------- Voz de la entrevistadora (Text-to-Speech) ---------- */

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const full = speechLang(lang);
  const base = full.slice(0, 2);
  return (
    voices.find((v) => v.lang === full) ??
    voices.find((v) => v.lang.startsWith(`${base}-`) && /female|mujer|paulina|monica|helena|luciana|samantha|google/i.test(v.name)) ??
    voices.find((v) => v.lang.startsWith(base)) ??
    null
  );
}

/** Lee un texto en voz alta. Resuelve al terminar (o enseguida si el navegador no tiene voz). */
export function speak(text: string, lang: string, opts: { rate?: number; onStart?: () => void } = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported() || !text.trim()) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang(lang);
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = opts.rate ?? 1;
    u.onstart = () => opts.onStart?.();
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
    // Algunos navegadores nunca disparan onend si no hay voces: no nos quedamos colgados.
    setTimeout(resolve, Math.max(4000, text.length * 120));
  });
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

/** Muletillas comunes en español e inglés, para el feedback de ritmo. */
const FILLERS = ["eh", "ehh", "em", "emm", "este", "o sea", "bueno", "digamos", "tipo", "viste", "en plan", "um", "uh", "like", "you know", "basically"];

export function speechStats(text: string, seconds: number) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lower = ` ${text.toLowerCase().replace(/[.,;:!?¿¡]/g, " ")} `;
  const fillers: Record<string, number> = {};
  for (const f of FILLERS) {
    const n = lower.split(` ${f} `).length - 1;
    if (n > 0) fillers[f] = n;
  }
  return { words, wpm: seconds > 0 ? Math.round((words / seconds) * 60) : 0, fillers, fillerCount: Object.values(fillers).reduce((a, b) => a + b, 0) };
}
