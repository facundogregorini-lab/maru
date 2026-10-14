"use client";

import { useMemo, useState } from "react";
import { atsReport } from "@/lib/ats";
import { cvToText, fileBaseName, photoRecommended, setTemplate } from "@/lib/cv";
import type { CvContext, CvDoc, SectionKey } from "@/lib/schemas";
import CopyButton from "../CopyButton";
import PhotoCropper from "../PhotoCropper";
import AtsPanel from "./AtsPanel";
import CvPaper from "./CvPaper";
import StylePanel from "./StylePanel";
import TemplatePicker from "./TemplatePicker";
import { resolveTheme } from "./themes";

const SECTION_LABELS: Record<SectionKey, string> = {
  resumen: "Perfil / resumen",
  logrosClave: "Logros clave",
  experiencia: "Experiencia",
  educacion: "Educación",
  habilidades: "Habilidades",
  idiomas: "Idiomas",
  certificaciones: "Certificaciones",
};

const NO_PHOTO_NAMES: Record<string, string> = { US: "EE.UU.", GB: "Reino Unido", UK: "Reino Unido", CA: "Canadá", IE: "Irlanda", AU: "Australia", NZ: "Nueva Zelanda" };

export default function CvEditor({
  doc,
  setDoc,
  context,
  cambios,
}: {
  doc: CvDoc;
  setDoc: (fn: (d: CvDoc) => CvDoc) => void;
  context: CvContext;
  cambios: string[];
}) {
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState("");
  // Si falla el PDF, ofrecemos el Word (mismo contenido) desde el mismo aviso.
  const [pdfFailed, setPdfFailed] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const report = useMemo(() => atsReport(doc, context.palabrasClave), [doc, context.palabrasClave]);
  const filename = fileBaseName(doc, context.puesto);
  const photoOk = photoRecommended(context.pais);
  const order = resolveTheme(doc).order;

  function moveSection(i: number, to: number) {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    const [k] = next.splice(i, 1);
    next.splice(to, 0, k);
    setDoc((d) => ({ ...d, style: { ...d.style, order: next } }));
  }

  async function regenerate(expId: string, bulletId: string) {
    const exp = doc.experiencia.find((e) => e.id === expId);
    const bullet = exp?.bullets.find((b) => b.id === bulletId);
    if (!exp || !bullet?.text.trim()) return;
    setRegenerating(bulletId);
    setError("");
    try {
      const res = await fetch("/api/bullet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bullet: bullet.text,
          cargo: exp.cargo,
          empresa: exp.empresa,
          otros: exp.bullets.filter((b) => b.id !== bulletId).map((b) => b.text),
          puesto: context.puesto,
          palabrasClave: context.palabrasClave,
          idioma: doc.lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDoc((d) => ({
        ...d,
        experiencia: d.experiencia.map((e) =>
          e.id === expId ? { ...e, bullets: e.bullets.map((b) => (b.id === bulletId ? { ...b, text: data.texto } : b)) } : e,
        ),
      }));
    } catch (e) {
      setError((e as Error).message || "No pudimos regenerar el logro.");
    } finally {
      setRegenerating(null);
    }
  }

  async function exportAs(kind: "pdf" | "docx") {
    // Confirmamos cualquier edición en curso antes de exportar.
    (document.activeElement as HTMLElement | null)?.blur();
    setBusy(kind);
    setError("");
    setPdfFailed(false);
    try {
      await new Promise((r) => setTimeout(r, 0));
      if (kind === "pdf") await (await import("@/lib/export/pdf")).downloadPdf(doc, filename);
      else await (await import("@/lib/export/docx")).downloadDocx(doc, filename);
    } catch (e) {
      setError((e as Error).message || "No pudimos generar el archivo.");
      if (kind === "pdf") setPdfFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section>
        <h2 className="mb-3 font-serif text-xl tracking-tight">Elegí el diseño</h2>
        <TemplatePicker doc={doc} recommended={context.templateRecomendado} reason={context.razonTemplate} onPick={(t) => setDoc((d) => setTemplate(d, t))} />
      </section>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-clay/30 bg-clay-soft px-4 py-3 text-sm text-clay-dark sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          {pdfFailed && (
            <button
              type="button"
              onClick={() => exportAs("docx")}
              disabled={!!busy}
              className="shrink-0 rounded-full bg-clay px-4 py-2 text-sm font-medium text-paper transition hover:bg-clay-dark disabled:opacity-70"
            >
              {busy === "docx" ? "Generando Word…" : "Descargar Word"}
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <p className="mb-3 flex items-center gap-2 text-sm text-muted">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-clay-soft text-xs text-clay-dark">✎</span>
            Tocá cualquier texto para editarlo. Los cambios se guardan solos.
          </p>
          <div className="cv-scroll">
            <CvPaper doc={doc} onChange={setDoc} onRegenerate={regenerate} regenerating={regenerating} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="flex flex-col gap-2 rounded-3xl bg-paper p-5 lg:sticky lg:top-4">
            <button
              type="button"
              onClick={() => exportAs("pdf")}
              disabled={!!busy}
              className="rounded-full bg-clay px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-clay-dark disabled:opacity-70"
            >
              {busy === "pdf" ? "Generando PDF…" : "Descargar PDF"}
            </button>
            <button
              type="button"
              onClick={() => exportAs("docx")}
              disabled={!!busy}
              className="rounded-full border border-clay px-4 py-2.5 text-sm font-medium text-clay-dark transition hover:bg-clay-soft disabled:opacity-70"
            >
              {busy === "docx" ? "Generando Word…" : "Descargar Word (.docx)"}
            </button>
            <CopyButton text={cvToText(doc)} label="Copiar como texto" />
            <p className="text-xs leading-relaxed text-muted">El PDF tiene texto real y seleccionable, listo para cualquier ATS.</p>
          </div>

          <AtsPanel report={report} />

          <div className="rounded-3xl bg-paper p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Foto</h3>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <span className="text-muted">Incluir foto</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={doc.showPhoto}
                  onChange={(e) => setDoc((d) => ({ ...d, showPhoto: e.target.checked }))}
                  className="peer sr-only"
                />
                <span className="relative h-6 w-10 rounded-full bg-line transition peer-checked:bg-sage peer-focus-visible:ring-4 peer-focus-visible:ring-clay-soft after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-paper after:shadow after:transition peer-checked:after:translate-x-4" />
              </label>
            </div>
            <p className={`mt-2 text-xs leading-relaxed ${photoOk ? "text-muted" : "text-clay-dark"}`}>
              {photoOk
                ? "Recomendada en LatAm y Europa. No se recomienda para empresas de EE.UU. o Reino Unido."
                : `Buscás en ${NO_PHOTO_NAMES[context.pais.toUpperCase()] ?? "un país anglosajón"}: allí se recomienda no incluir foto, por eso la desactivamos.`}
            </p>
            {cropFile ? (
              <div className="mt-3">
                <PhotoCropper
                  file={cropFile}
                  initialShape={doc.photo?.shape}
                  onCancel={() => setCropFile(null)}
                  onDone={(dataUrl, shape) => {
                    setDoc((d) => ({ ...d, photo: { dataUrl, shape }, showPhoto: true }));
                    setCropFile(null);
                  }}
                />
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-3">
                {doc.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doc.photo.dataUrl} alt="Tu foto" className={`h-12 w-12 object-cover ${doc.photo.shape === "circle" ? "rounded-full" : "rounded-md"}`} />
                )}
                <label className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-medium transition hover:border-clay hover:text-clay">
                  {doc.photo ? "Cambiar foto" : "Subir foto"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setCropFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {doc.photo && (
                  <button type="button" onClick={() => setDoc((d) => ({ ...d, photo: null, showPhoto: false }))} className="text-xs text-muted hover:text-clay-dark">
                    Quitar
                  </button>
                )}
              </div>
            )}
          </div>

          <StylePanel doc={doc} setDoc={setDoc} />

          <div className="rounded-3xl bg-paper p-5">
            <h3 className="text-sm font-semibold">Secciones</h3>
            <p className="mt-1 text-xs text-muted">Mostralas, ocultalas o cambiá su orden.</p>
            <ul className="mt-3 space-y-1">
              {order.map((key, i) => (
                <li key={key} className="flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!doc.hidden[key]}
                      onChange={(e) => setDoc((d) => ({ ...d, hidden: { ...d.hidden, [key]: !e.target.checked } }))}
                      className="h-4 w-4 accent-clay"
                    />
                    {SECTION_LABELS[key]}
                  </label>
                  <span className="flex">
                    <button type="button" aria-label={`Subir ${SECTION_LABELS[key]}`} disabled={i === 0} onClick={() => moveSection(i, i - 1)} className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-clay-soft hover:text-clay-dark disabled:opacity-30">
                      ↑
                    </button>
                    <button type="button" aria-label={`Bajar ${SECTION_LABELS[key]}`} disabled={i === order.length - 1} onClick={() => moveSection(i, i + 1)} className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-clay-soft hover:text-clay-dark disabled:opacity-30">
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {cambios.length > 0 && (
            <div className="rounded-3xl bg-paper p-5">
              <h3 className="text-sm font-semibold">Qué cambiamos y por qué</h3>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
                {cambios.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
