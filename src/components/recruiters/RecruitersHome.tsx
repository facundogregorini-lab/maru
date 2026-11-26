"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import VoiceButton from "@/components/VoiceButton";
import { DOCX_MIME, MAX_FILE_BYTES, PDF_MIME } from "@/lib/cvSource";
import { RecError, recApi, type BusquedaItem, type BusquedaView } from "@/lib/recruiters/client";
import { readFileBase64 } from "./files";

const EJEMPLO = "Head of Growth para una fintech de pagos en CABA. Que haya escalado adquisición paga y CRM, con equipo a cargo de 5 o más personas. Ideal si viene de una fintech o un marketplace. Híbrido, 3 días en oficina.";

export default function RecruitersHome() {
  const { email } = useAuth();
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [showAviso, setShowAviso] = useState(false);
  const [ref, setRef] = useState<{ name: string; base64: string; mime: string } | null>(null);
  const [propios, setPropios] = useState(true);
  const [maru, setMaru] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lista, setLista] = useState<BusquedaItem[] | null>(null);

  useEffect(() => {
    if (!email) return setLista(email === null ? [] : null);
    recApi<{ busquedas: BusquedaItem[] }>("/busquedas", { email }).then((d) => setLista(d.busquedas)).catch(() => setLista([]));
  }, [email]);

  async function pickRef(f: File | undefined) {
    setError("");
    if (!f) return setRef(null);
    const isPdf = f.type === PDF_MIME || f.name.toLowerCase().endsWith(".pdf");
    const isDocx = f.type === DOCX_MIME || f.name.toLowerCase().endsWith(".docx");
    if (!isPdf && !isDocx) return setError("El CV de referencia tiene que ser PDF o Word (.docx).");
    if (f.size > MAX_FILE_BYTES) return setError("El CV de referencia pesa más de 3 MB.");
    setRef({ name: f.name, base64: await readFileBase64(f), mime: isPdf ? PDF_MIME : DOCX_MIME });
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (brief.trim().length < 20) return setError("Contanos a quién buscás en al menos una oración.");
    setBusy(true);
    setError("");
    try {
      const { busqueda } = await recApi<{ busqueda: BusquedaView }>("/busquedas", {
        email,
        body: {
          brief: brief.trim(),
          ...(jobUrl.trim() ? { jobUrl: jobUrl.trim() } : {}),
          ...(jobText.trim() ? { jobText: jobText.trim() } : {}),
          ...(ref ? { referencia: { kind: "cv", fileBase64: ref.base64, mimeType: ref.mime } } : {}),
          fuentes: { propios, maru },
        },
      });
      router.push(`/recruiters/${busqueda.id}`);
    } catch (err) {
      setError(err instanceof RecError ? err.message : "Algo salió mal. Probá de nuevo.");
      setBusy(false);
    }
  }

  const fuente = (on: boolean, set: (v: boolean) => void, title: string, desc: string, soon = false) => (
    <button
      type="button"
      disabled={soon}
      aria-pressed={!soon && on}
      onClick={() => set(!on)}
      className={`flex min-h-[132px] flex-col items-start gap-2 rounded-2xl p-4 text-left transition-colors ${soon ? "cursor-not-allowed border border-dashed border-line bg-surface-3 opacity-80" : on ? "border-2 border-neon-deep bg-white" : "border border-line bg-white hover:border-black/20"}`}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="text-[15px] font-semibold">{title}</span>
        {soon ? (
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted">Pronto</span>
        ) : (
          <span className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[13px] font-bold ${on ? "bg-neon" : "border border-line"}`} aria-hidden>
            {on ? "✓" : ""}
          </span>
        )}
      </span>
      <span className="text-[13px] leading-snug text-muted">{desc}</span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-start gap-8">
      <form onSubmit={crear} className="flex min-w-0 max-w-[820px] flex-[999_1_520px] flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="self-start rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-[#0b4a2a]">Nueva búsqueda</span>
          <h1 className="font-display text-[34px] leading-tight sm:text-[40px]">¿A quién estás buscando?</h1>
          <p className="max-w-[620px] text-base leading-relaxed text-muted">Contalo como se lo contarías a un colega. Maru arma el perfil ideal y vos lo ajustás antes de buscar.</p>
        </div>

        <div className="flex flex-col gap-4 rounded-[20px] border border-line bg-white p-5 shadow-soft">
          <label htmlFor="brief" className="text-[13px] font-semibold">Brief de la búsqueda</label>
          <textarea
            id="brief"
            rows={5}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            maxLength={4000}
            placeholder={EJEMPLO}
            className="w-full resize-y rounded-xl border border-line p-3.5 text-[15px] leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-2">
            <VoiceButton compact label="Dictar" onText={(t) => setBrief((b) => (b ? `${b} ${t}` : t))} />
            <button type="button" onClick={() => setShowAviso((v) => !v)} className="inline-flex min-h-10 items-center rounded-full border border-line bg-white px-3.5 text-sm font-medium hover:border-black/20" aria-expanded={showAviso}>
              Sumar el aviso
            </button>
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line bg-white px-3.5 text-sm font-medium hover:border-black/20">
              CV de referencia
              <input type="file" accept=".pdf,.docx,application/pdf" className="sr-only" onChange={(e) => void pickRef(e.target.files?.[0])} />
            </label>
            {ref && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-1.5 text-[13px] text-[#0b4a2a]">
                {ref.name}
                <button type="button" onClick={() => setRef(null)} aria-label="Quitar el CV de referencia" className="px-1">×</button>
              </span>
            )}
          </div>
          {showAviso && (
            <div className="grid gap-3">
              <label className="grid gap-1 text-[13px] font-semibold">
                Link del aviso
                <input value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} type="url" placeholder="https://…" className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
              </label>
              <label className="grid gap-1 text-[13px] font-semibold">
                O pegá el texto del aviso
                <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} rows={4} maxLength={20000} className="rounded-xl border border-line p-3 text-sm font-normal" />
              </label>
            </div>
          )}
          <p className="text-xs text-muted">El CV de referencia es de alguien que ya funcionó en el rol: Maru lo usa como ejemplo de «esto sí».</p>
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-lg font-semibold">¿Dónde buscamos?</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {fuente(propios, setPropios, "Tus postulantes", "Subí CVs en PDF o Word. Maru los lee y los evalúa contra el perfil ideal.")}
            {fuente(maru, setMaru, "Candidatos de Maru", "Personas que activaron «Abierto a propuestas». Ves su experiencia; el contacto llega cuando aceptan.", true)}
            {fuente(false, () => {}, "Base externa", "Perfiles licenciados a proveedores de datos. Lo sumamos cuando haya volumen.", true)}
          </div>
        </fieldset>

        {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-dark">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <span className="text-[13px] text-muted">Armar y editar el perfil ideal usa 1 lectura con IA; editarlo a mano, ninguna.</span>
          <button type="submit" disabled={busy} className="press inline-flex min-h-12 items-center gap-2 rounded-full bg-neon px-6 text-[15px] font-semibold text-ink disabled:opacity-60">
            {busy ? "Armando el perfil ideal…" : "Armar perfil ideal →"}
          </button>
        </div>
      </form>

      <aside aria-label="Tus búsquedas" className="flex max-w-[320px] flex-[1_1_260px] flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Tus búsquedas</h2>
        {lista === null && <p className="text-sm text-muted">Cargando…</p>}
        {lista?.length === 0 && <p className="rounded-2xl bg-white p-4 text-sm text-muted">{email ? "Todavía no creaste búsquedas." : "Ingresá para ver tus búsquedas."}</p>}
        {lista?.map((b) => (
          <Link key={b.id} href={`/recruiters/${b.id}`} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-white px-4 py-3.5 hover:border-black/20">
            <span className="text-sm font-semibold">{b.titulo}</span>
            <span className="text-xs text-muted">Perfil v{b.version}{b.borrador ? " · borrador" : ""}</span>
          </Link>
        ))}
        <div className="rounded-2xl bg-panel p-4 text-[13px] leading-relaxed text-[#0b4a2a]">
          <span className="font-semibold">Cómo funciona:</span> Maru arma el perfil ideal, lee cada CV y te dice qué criterio cumple con la evidencia. Vos decidís; la IA nunca descarta a nadie.
        </div>
      </aside>
    </div>
  );
}
