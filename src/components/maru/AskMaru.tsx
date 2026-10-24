"use client";

import { useId, useState } from "react";
import { openCopilot } from "@/lib/copilotClient";

/** Acceso al copiloto dentro de una pantalla: la pregunta se manda en el panel de Maru del rincón. */
export default function AskMaru({ suggestions, className = "" }: { suggestions: string[]; className?: string }) {
  const [text, setText] = useState("");
  const inputId = useId();
  const ask = (q: string) => {
    if (!q.trim()) return;
    openCopilot(q.trim());
    setText("");
  };
  return (
    <section aria-label="Preguntale a Maru" className={`rounded-2xl border border-line bg-white p-3 ${className}`}>
      <h2 className="font-semibold">Preguntale a Maru</h2>
      <p className="text-xs leading-relaxed text-ink/65">Tu copiloto conoce tu CV y tu match, te dice qué avisos te convienen y te abre la postulación.</p>
      <div className="mt-3 flex flex-col items-start gap-1.5">
        {suggestions.map((s) => (
          <button key={s} type="button" onClick={() => ask(s)} className="rounded-full bg-[#f2f4f5] px-3 py-1.5 text-left text-[13px] hover:bg-black/[0.08]">
            {s}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="mt-3 flex gap-2"
      >
        <label htmlFor={inputId} className="sr-only">
          Tu consulta
        </label>
        <input id={inputId} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Escribile a Maru…" className="min-h-11 w-full rounded-full border border-line px-4 text-base focus:outline-2 focus:outline-ink sm:text-sm" />
        <button type="submit" disabled={!text.trim()} className="press min-h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">
          Preguntar
        </button>
      </form>
    </section>
  );
}
