"use client";

import { useEffect, useRef, useState } from "react";
import { DOCX_MIME, MAX_FILE_BYTES, PDF_MIME, buildCvSource, looksLikeDocx, looksLikePdf, type CvFile, type CvMode } from "@/lib/cvSource";
import { forgetProfile, loadProfile, profileToText, type SavedProfile } from "@/lib/profileStore";
import type { CvSource } from "@/lib/schemas";
import LinkedinGuide from "./LinkedinGuide";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export type CvInput = ReturnType<typeof useCvInput>;

/**
 * Estado de "tu experiencia": PDF de LinkedIn, CV (PDF/Word), texto pegado
 * o el perfil que ya cargaste en otra sección de Maru.
 */
export function useCvInput() {
  const [mode, setMode] = useState<CvMode>("linkedin");
  const [file, setFile] = useState<CvFile | null>(null);
  const [reading, setReading] = useState(false);
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState("");
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [useSaved, setUseSaved] = useState(false);
  const readSeq = useRef(0);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const s = loadProfile();
    setSaved(s);
    setUseSaved(!!s);
  }, []);

  function switchMode(m: CvMode) {
    readSeq.current += 1; // descarta una lectura de archivo en curso
    setMode(m);
    setFile(null);
    setReading(false);
    setFileError("");
  }

  async function onFile(f: File | null) {
    setFileError("");
    if (!f) return;
    const isPdf = f.type === PDF_MIME || f.name.toLowerCase().endsWith(".pdf");
    const isDocx = f.type === DOCX_MIME || f.name.toLowerCase().endsWith(".docx");
    if (mode === "linkedin" && !isPdf) return setFileError("El perfil de LinkedIn se descarga en PDF. Subí ese archivo.");
    if (!isPdf && !isDocx) return setFileError("Aceptamos CVs en PDF o Word (.docx).");
    if (f.size > MAX_FILE_BYTES) return setFileError("El archivo pesa más de 3 MB. Exportalo más liviano o pegá tu experiencia.");
    if (f.size === 0) return setFileError("El archivo está vacío. Probá descargarlo de nuevo.");

    // "Listo ✓" aparece recién cuando el archivo está leído, validado y guardado en el estado.
    const seq = ++readSeq.current;
    setFile(null);
    setReading(true);
    try {
      const base64 = await readAsBase64(f);
      if (seq !== readSeq.current) return; // eligió otro archivo o cambió de pestaña mientras leíamos
      if (isPdf ? !looksLikePdf(base64) : !looksLikeDocx(base64)) {
        return setFileError(`No pudimos leer “${f.name}”: no parece un ${isPdf ? "PDF" : "Word"} válido. Probá exportarlo de nuevo o pegá tu experiencia.`);
      }
      setFile({ name: f.name, base64, mime: isPdf ? PDF_MIME : DOCX_MIME });
    } catch {
      if (seq === readSeq.current) setFileError("No pudimos leer el archivo. Probá de nuevo.");
    } finally {
      if (seq === readSeq.current) setReading(false);
    }
  }

  /** Ante un CV ilegible o muy pesado, pasamos a "pegar texto" y le damos foco. */
  function fallbackToText() {
    setUseSaved(false);
    switchMode("texto");
    setTimeout(() => textRef.current?.focus(), 400);
  }

  const savedProfile = useSaved && saved ? saved.profile : null;
  // Una sola fuente de verdad: lo que habilita "Empezar" es exactamente lo que se envía.
  const source: CvSource | null = savedProfile ? { kind: "texto", text: profileToText(savedProfile) } : buildCvSource(mode, file, text);

  return {
    mode,
    switchMode,
    file,
    reading,
    text,
    setText,
    onFile,
    fileError,
    textRef,
    saved,
    useSaved,
    setUseSaved,
    forgetSaved: () => {
      forgetProfile();
      setSaved(null);
      setUseSaved(false);
    },
    /** El perfil ya estructurado, si eligió reutilizarlo (evita volver a leerlo). */
    savedProfile,
    source,
    ready: !!source && !reading,
    fallbackToText,
  };
}

/** UI del paso "Tu experiencia". */
export default function CvSourceField({ input }: { input: CvInput }) {
  const { mode, switchMode, file, reading, text, setText, onFile, fileError, textRef, saved, useSaved, setUseSaved, forgetSaved } = input;

  if (saved && useSaved) {
    const p = saved.profile;
    const last = p.experiencia[0];
    return (
      <div className="rounded-2xl border border-sage/40 bg-sage-soft/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">Ya tenemos tu perfil</p>
        <p className="mt-1 font-serif text-xl">{p.nombre || "Tu perfil"}</p>
        {last && (
          <p className="mt-0.5 text-sm text-muted">
            {last.cargo} · {last.empresa} · {p.experiencia.length} experiencia{p.experiencia.length === 1 ? "" : "s"}
          </p>
        )}
        <p className="mt-2 text-xs text-muted">Lo cargaste el {new Date(saved.savedAt).toLocaleDateString("es-AR")}. Queda guardado sólo en este navegador.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setUseSaved(false)} className="rounded-full border border-line bg-paper px-4 py-1.5 text-sm transition hover:border-clay hover:text-clay">
            Usar otro CV
          </button>
          <button type="button" onClick={forgetSaved} className="px-2 py-1.5 text-sm text-muted hover:text-clay-dark">
            Olvidar este perfil
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {saved && (
        <button type="button" onClick={() => setUseSaved(true)} className="mb-3 text-sm text-sage underline decoration-sage/40 underline-offset-4 hover:text-ink">
          ← Usar mi perfil guardado ({saved.profile.nombre || "último cargado"})
        </button>
      )}
      <div className="mb-4 flex flex-wrap gap-1 rounded-full bg-sand p-1 text-sm sm:inline-flex">
        {(
          [
            ["linkedin", "PDF de LinkedIn", "Recomendado"],
            ["cv", "Mi CV (PDF o Word)", ""],
            ["texto", "Pegar texto", ""],
          ] as const
        ).map(([m, label, badge]) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition ${mode === m ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
            {badge && <span className="rounded-full bg-sage-soft px-1.5 py-0.5 text-[10px] font-semibold text-sage">{badge}</span>}
          </button>
        ))}
      </div>

      {mode === "linkedin" && <LinkedinGuide />}

      {mode !== "texto" && (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-paper px-4 py-8 text-center transition hover:border-clay"
        >
          <input
            type="file"
            accept={mode === "linkedin" ? ".pdf,application/pdf" : `.pdf,.docx,${PDF_MIME},${DOCX_MIME}`}
            className="sr-only"
            onChange={(e) => {
              // El archivo queda en el estado (no en el input): reseteamos el input para poder elegir el mismo archivo otra vez.
              onFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {reading ? (
            <span className="font-medium text-muted">Leyendo tu archivo…</span>
          ) : file ? (
            <>
              <span className="font-medium text-ink">{file.name}</span>
              <span className="text-xs text-sage">Listo ✓ · tocá para cambiarlo</span>
            </>
          ) : (
            <>
              <span className="font-medium text-ink">{mode === "linkedin" ? "Arrastrá tu Profile.pdf o tocá para elegirlo" : "Arrastrá tu CV o tocá para elegirlo"}</span>
              <span className="text-xs text-muted">{mode === "linkedin" ? "PDF · hasta 3 MB" : "PDF o .docx · hasta 3 MB"}</span>
            </>
          )}
        </label>
      )}

      {mode === "texto" && (
        <textarea
          ref={textRef}
          rows={8}
          placeholder="Pegá tu perfil o tu experiencia: puestos, empresas, fechas, logros, estudios, idiomas…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm outline-none transition focus:border-clay focus:ring-4 focus:ring-clay-soft"
        />
      )}

      {fileError && <p className="mt-3 text-sm text-clay-dark">{fileError}</p>}
    </>
  );
}
