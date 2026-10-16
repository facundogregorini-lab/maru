"use client";

import { useEffect, useRef, useState } from "react";

/** El video del hero sin controles del navegador (como jobright), con un botón propio de pausa: se mueve más de 5 s y hay que poder frenarlo. */
export default function HeroVideoPlayer() {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Con movimiento reducido arranca en pausa.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      setPlaying(false);
    }
  }, []);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().then(() => setPlaying(true)).catch(() => {});
    else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="group relative">
      <video
        ref={ref}
        className="block aspect-video w-full bg-[#f2f4f3]"
        poster="/video/maru-intro-poster.jpg"
        aria-label="Presentación de Maru: estrategia, matches, autocompletado y CV a medida"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        {/* H.264 para Safari y Chrome; VP9 para los navegadores sin H.264. */}
        <source src="/video/maru-intro.mp4" type='video/mp4; codecs="avc1.640020"' />
        <source src="/video/maru-intro.webm" type="video/webm; codecs=vp9" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar el video" : "Reproducir el video"}
        className={`absolute bottom-3 right-3 grid h-9 w-9 place-items-center rounded-full bg-ink/80 text-white backdrop-blur transition-opacity hover:bg-ink focus-visible:opacity-100 ${playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"}`}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
          {playing ? <path d="M4 3h3v10H4zM9 3h3v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
        </svg>
      </button>
    </div>
  );
}
