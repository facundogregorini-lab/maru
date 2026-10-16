"use client";

import { useEffect, useRef, useState } from "react";
import { takeHandoff, type HandoffTarget } from "@/lib/match/clientStore";
import type { TargetInput } from "@/lib/schemas";
import { inputClass } from "./ui";

export type JobFieldState = ReturnType<typeof useJobInput>;

/** "Para qué búsqueda": link/texto de una vacante concreta, o un rol/empresa en general. */
export function useJobInput(target?: HandoffTarget) {
  const [modo, setModo] = useState<"busqueda" | "general">("busqueda");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [showJobText, setShowJobText] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [rol, setRol] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Viene de una búsqueda de Maru ("Entrená la entrevista", "Grabá tu video"): arrancamos con ella.
  const tookRef = useRef(false);
  useEffect(() => {
    if (!target || tookRef.current) return;
    tookRef.current = true;
    const h = takeHandoff(target);
    if (!h) return;
    setModo("busqueda");
    setJobUrl(h.jobUrl);
    setJobText(h.jobText);
    setShowJobText(!!h.jobText);
  }, [target]);

  const ready = modo === "busqueda" ? !!jobUrl.trim() || jobText.trim().length > 100 : !!rol.trim();
  const payload = (): TargetInput =>
    modo === "busqueda"
      ? { job: { jobUrl: jobUrl.trim(), jobText: showJobText ? jobText : undefined } }
      : { general: { rol: rol.trim(), empresa: empresa.trim() } };

  /** Si el portal bloquea la lectura del link, pedimos pegar el texto. */
  function fallbackToText() {
    setShowJobText(true);
    setTimeout(() => textRef.current?.focus(), 400);
  }

  return {
    modo,
    setModo,
    jobUrl,
    setJobUrl,
    jobText,
    setJobText,
    showJobText,
    setShowJobText,
    empresa,
    setEmpresa,
    rol,
    setRol,
    textRef,
    ready,
    payload,
    fallbackToText,
    /** Para mostrar en títulos. */
    label: modo === "general" ? [rol, empresa].filter(Boolean).join(" · ") : "",
    snapshot: () => ({ modo, jobUrl, jobText, empresa, rol }),
    restore: (s: { modo: "busqueda" | "general"; jobUrl: string; jobText: string; empresa: string; rol: string }) => {
      setModo(s.modo);
      setJobUrl(s.jobUrl);
      setJobText(s.jobText);
      setShowJobText(!!s.jobText);
      setEmpresa(s.empresa);
      setRol(s.rol);
    },
  };
}

export default function JobField({ input, generalLabel = "Sin búsqueda concreta" }: { input: JobFieldState; generalLabel?: string }) {
  const { modo, setModo, jobUrl, setJobUrl, jobText, setJobText, showJobText, setShowJobText, empresa, setEmpresa, rol, setRol, textRef } = input;
  return (
    <>
      <div className="mb-4 inline-flex flex-wrap gap-1 rounded-full bg-sand p-1 text-sm">
        {(
          [
            ["busqueda", "Tengo la búsqueda"],
            ["general", generalLabel],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            className={`rounded-full px-4 py-1.5 transition ${modo === m ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {modo === "busqueda" ? (
        <>
          <input type="url" inputMode="url" placeholder="https://…" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} className={inputClass} aria-label="Link de la búsqueda" />
          {showJobText ? (
            <textarea
              ref={textRef}
              rows={7}
              placeholder="Pegá acá el texto completo de la búsqueda (el job description)."
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              className={`mt-3 ${inputClass} text-sm`}
            />
          ) : (
            <button type="button" onClick={() => setShowJobText(true)} className="mt-2 text-sm text-muted underline decoration-line underline-offset-4 hover:text-brand">
              ¿No tenés link? Pegá el job description
            </button>
          )}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Rol al que apuntás (ej.: Product Manager)" value={rol} onChange={(e) => setRol(e.target.value)} className={inputClass} />
          <input placeholder="Empresa o industria (opcional)" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inputClass} />
        </div>
      )}
    </>
  );
}
