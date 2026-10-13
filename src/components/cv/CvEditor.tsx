"use client";

import { useCallback, useMemo, useState } from "react";
import { atsReport } from "@/lib/ats";
import { cvToText, fileBaseName, photoRecommended, setTemplate } from "@/lib/cv";
import type { Analysis, CvDoc, SectionKey } from "@/lib/schemas";
import { useAuth } from "../auth/AuthProvider";
import LoginDialog from "../auth/LoginDialog";
import PhotoCropper from "../PhotoCropper";
import AtsPanel from "./AtsPanel";
import CvPaper from "./CvPaper";
import TemplatePicker from "./TemplatePicker";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "resumen", label: "Perfil / resumen" },
  { key: "logrosClave", label: "Logros clave" },
  { key: "experiencia", label: "Experiencia" },
  { key: "educacion", label: "Educación" },
  { key: "habilidades", label: "Habilidades" },
  { key: "idiomas", label: "Idiomas" },
  { key: "certificaciones", label: "Certificaciones" },
];

const NO_PHOTO_NAMES: Record<string, string> = { US: "EE.UU.", GB: "Reino Unido", UK: "Reino Unido", CA: "Canadá", IE: "Irlanda", AU: "Australia", NZ: "Nueva Zelanda" };

export default function CvEditor({
  doc,
  setDoc,
  analysis,
  cambios,
}: {
  doc: CvDoc;
  setDoc: (fn: (d: CvDoc) => CvDoc) => void;
  analysis: Analysis;
  cambios: string[];
}) {
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState("");
  // Si falla el PDF, ofrecemos el Word (mismo contenido) desde el mismo aviso.
  const [pdfFailed, setPdfFailed] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  // Descargar exige sesión: guardamos qué quería hacer para seguir apenas ingrese.
  const { email } = useAuth();
  const [pending, setPending] = useState<"pdf" | "docx" | "copy" | null>(null);
  const [copied, setCopied] = useState(false);

  const report = useMemo(() => atsReport(doc, analysis.palabras_clave_ats), [doc, analysis.palabras_clave_ats]);
  const filename = fileBaseName(doc, analysis.puesto);
  const photoOk = photoRecommended(analysis.pais_empresa);

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
          puesto: analysis.puesto,
          palabrasClave: analysis.palabras_clave_ats,
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

  /** `justLoggedIn`: viene del diálogo; el estado `email` todavía no se actualizó en esta closure y el servidor valida igual. */
  async function exportAs(kind: "pdf" | "docx", justLoggedIn = false) {
    if (!email && !justLoggedIn) return setPending(kind);
    // Confirmamos cualquier edición en curso antes de exportar.
    (document.activeElement as HTMLElement | null)?.blur();
    setBusy(kind);
    setError("");
    setPdfFailed(false);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const { downloadDocx, downloadPdf, DownloadError } = await import("@/lib/export/client");
      try {
        if (kind === "pdf") await downloadPdf(doc, filename);
        else await downloadDocx(doc, filename);
      } catch (e) {
        // La sesión venció o se cerró en otra pestaña: pedimos ingresar de nuevo.
        if (e instanceof DownloadError && e.code === "AUTH_REQUIRED") return setPending(kind);
        throw e;
      }
    } catch (e) {
      setError((e as Error).message || "No pudimos generar el archivo.");
      if (kind === "pdf") setPdfFailed(true);
    } finally {
      setBusy(null);
    }
  }

  async function copyText() {
    if (!email) return setPending("copy");
    await navigator.clipboard.writeText(cvToText(doc));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const onLoggedIn = useCallback(() => {
    const action = pending;
    setPending(null);
    // Seguimos con la descarga que había pedido. Copiar necesita un nuevo toque (el navegador lo exige).
    if (action === "pdf" || action === "docx") setTimeout(() => exportAs(action, true), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  return (
    <div className="mt-6 space-y-6">
      <LoginDialog
        open={!!pending}
        reason={pending === "copy" ? "copiar tu CV" : "descargar tu CV"}
        onClose={() => setPending(null)}
        onLoggedIn={onLoggedIn}
      />
      <section>
        <h2 className="mb-3 font-serif text-xl tracking-tight">Elegí el diseño</h2>
        <TemplatePicker doc={doc} recommended={analysis.template_recomendado} reason={analysis.razon_template} onPick={(t) => setDoc((d) => setTemplate(d, t))} />
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
            <button
              type="button"
              onClick={copyText}
              className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink transition hover:border-clay hover:text-clay"
            >
              {copied ? "¡Copiado!" : "Copiar como texto"}
            </button>
            <p className="text-xs leading-relaxed text-muted">
              {email === null ? "Para descargar te pedimos tu email: te mandamos un link y listo, sin contraseña." : "El PDF tiene texto real y seleccionable, listo para cualquier ATS."}
            </p>
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
                : `Esta vacante es de ${NO_PHOTO_NAMES[analysis.pais_empresa.toUpperCase()] ?? "un país anglosajón"}: allí se recomienda no incluir foto, por eso la desactivamos.`}
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

          <div className="rounded-3xl bg-paper p-5">
            <h3 className="text-sm font-semibold">Secciones</h3>
            <ul className="mt-2 space-y-1.5">
              {SECTIONS.map(({ key, label }) => (
                <li key={key}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!doc.hidden[key]}
                      onChange={(e) => setDoc((d) => ({ ...d, hidden: { ...d.hidden, [key]: !e.target.checked } }))}
                      className="h-4 w-4 accent-clay"
                    />
                    {label}
                  </label>
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
