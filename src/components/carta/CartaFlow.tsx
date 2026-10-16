"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buildCartaDoc, cartaFileName, cartaToText, lastCvDesign } from "@/lib/carta";
import { findGaps } from "@/lib/gaps";
import { profileToText, saveProfile } from "@/lib/profileStore";
import type { Carta, CartaDoc, CartaLargo, CartaOpciones, CartaTono, GapQuestion, Profile } from "@/lib/schemas";
import { load, remove, save } from "@/lib/storage";
import { useLoginGate } from "../auth/useLoginGate";
import CopyButton from "../CopyButton";
import CvSourceField, { useCvInput } from "../CvSourceField";
import StylePanel from "../cv/StylePanel";
import { CATEGORIES, TEMPLATES } from "../cv/themes";
import { Chips, ErrorBanner, Loading, PrimaryButton, SectionHero, StepCard, inputClass, post } from "../ui";
import VoiceButton from "../VoiceButton";
import LetterPaper, { type Rewrite } from "./LetterPaper";

type Stage = "inicio" | "escribiendo" | "resultado";
type Modo = "busqueda" | "espontanea";
const SESSION_KEY = "maru:carta:v1";

const TONOS: readonly (readonly [CartaTono, string])[] = [
  ["calido", "Cálido"],
  ["profesional", "Profesional"],
  ["entusiasta", "Entusiasta"],
  ["directo", "Directo"],
];
const LARGOS: readonly (readonly [CartaLargo, string])[] = [
  ["corta", "Corta"],
  ["media", "Media"],
  ["completa", "Completa"],
];
const IDIOMAS: readonly (readonly [CartaOpciones["idioma"], string])[] = [
  ["auto", "El de la búsqueda"],
  ["es", "Español"],
  ["en", "Inglés"],
  ["pt", "Portugués"],
];
const GUIDE = ["¿Por qué esa empresa?", "¿Por qué vos para ese rol?", "Una historia o logro que te represente"];
const LOADING = ["Leyendo la búsqueda…", "Eligiendo tus mejores argumentos…", "Escribiendo tu carta…", "Puliendo cada párrafo…"];

type Session = {
  modo: Modo;
  jobUrl: string;
  jobText: string;
  empresa: string;
  rol: string;
  motivacion: string;
  opciones: CartaOpciones;
  carta: Carta;
  profile: Profile;
  doc: CartaDoc;
};

export default function CartaFlow() {
  const [stage, setStage] = useState<Stage>("inicio");
  const [error, setError] = useState("");

  const [modo, setModo] = useState<Modo>("busqueda");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [showJobText, setShowJobText] = useState(false);
  const [empresa, setEmpresa] = useState("");
  const [rol, setRol] = useState("");
  const [motivacion, setMotivacion] = useState("");
  const cv = useCvInput();
  const [opciones, setOpciones] = useState<CartaOpciones>({ tono: "calido", largo: "media", idioma: "auto", destinatario: "" });

  const [carta, setCarta] = useState<Carta | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [doc, setDocState] = useState<CartaDoc | null>(null);

  const jobTextRef = useRef<HTMLTextAreaElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = load<Session>(SESSION_KEY);
    if (!s?.doc || !s.carta) return;
    setModo(s.modo);
    setJobUrl(s.jobUrl);
    setJobText(s.jobText);
    setShowJobText(!!s.jobText);
    setEmpresa(s.empresa);
    setRol(s.rol);
    setMotivacion(s.motivacion);
    setOpciones(s.opciones);
    setCarta(s.carta);
    setProfile(s.profile);
    setDocState(s.doc);
    setStage("resultado");
  }, []);

  useEffect(() => {
    if (!carta || !profile || !doc) return;
    save(SESSION_KEY, { modo, jobUrl, jobText, empresa, rol, motivacion, opciones, carta, profile, doc } satisfies Session);
  }, [modo, jobUrl, jobText, empresa, rol, motivacion, opciones, carta, profile, doc]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  const setDoc = (fn: (d: CartaDoc) => CartaDoc) => setDocState((d) => (d ? fn(d) : d));

  const hasJob = modo === "busqueda" ? !!jobUrl.trim() || jobText.trim().length > 100 : !!empresa.trim();
  const canWrite = hasJob && motivacion.trim().length > 15 && cv.ready;

  const busqueda = () =>
    modo === "busqueda" ? { job: { jobUrl: jobUrl.trim(), jobText: showJobText ? jobText : undefined } } : { espontanea: { empresa: empresa.trim(), rol: rol.trim() } };

  async function write() {
    setError("");
    setStage("escribiendo");
    try {
      const saved = cv.savedProfile;
      const [p, c] = await Promise.all([
        saved ? Promise.resolve({ profile: saved, gaps: findGaps(saved) }) : post<{ profile: Profile; gaps: GapQuestion[] }>("/api/profile", { source: cv.source }),
        post<{ carta: Carta }>("/api/carta", { ...busqueda(), motivacion, source: cv.source, opciones }),
      ]);
      if (!saved) saveProfile(p.profile);
      setProfile(p.profile);
      setCarta(c.carta);
      setDocState(buildCartaDoc(c.carta, p.profile, lastCvDesign() ?? { template: "moderno" }));
      setStage("resultado");
    } catch (e) {
      const err = e as Error & { code?: string };
      setStage("inicio");
      setError(err.message);
      if (err.code === "JOB_FETCH_FAILED") {
        setShowJobText(true);
        setTimeout(() => jobTextRef.current?.focus(), 400);
      }
      if (err.code === "CV_UNREADABLE" || err.code === "CV_INVALID" || err.code === "CV_TOO_LARGE") cv.fallbackToText();
    }
  }

  /** Reescribe toda la carta con otro tono o largo, conservando diseño y datos de contacto. */
  async function rewriteAll(next: CartaOpciones) {
    if (!profile) return;
    setError("");
    setOpciones(next);
    setStage("escribiendo");
    try {
      const { carta: c } = await post<{ carta: Carta }>("/api/carta", {
        ...busqueda(),
        motivacion,
        source: { kind: "texto", text: profileToText(profile) },
        opciones: next,
      });
      setCarta(c);
      setDocState((d) => {
        const fresh = buildCartaDoc(c, profile, d ?? { template: "moderno" });
        return d ? { ...fresh, remitente: d.remitente, firma: d.firma, fecha: d.lang === fresh.lang ? d.fecha : fresh.fecha } : fresh;
      });
      setStage("resultado");
    } catch (e) {
      setStage("resultado");
      setError((e as Error).message);
    }
  }

  function restart() {
    remove(SESSION_KEY);
    setCarta(null);
    setDocState(null);
    setStage("inicio");
  }

  return (
    <div ref={topRef} className="scroll-mt-24">
      <ErrorBanner message={error} />

      {stage === "inicio" && (
        <>
          <SectionHero kicker="Carta de presentación" title={<>Una carta que <em className="text-brand">se lee de verdad</em>.</>}>
            Traé la búsqueda, contanos con tus palabras (o en un audio) qué querés transmitir, y Maru escribe una carta concreta, humana y con tus mejores logros.
          </SectionHero>

          <div className="mt-10 space-y-6">
            <StepCard n={1} title="La búsqueda" hint="Pegá el link de la publicación, o escribile a una empresa aunque no haya una búsqueda abierta.">
              <div className="mb-4 inline-flex flex-wrap gap-1 rounded-full bg-sand p-1 text-sm">
                {(
                  [
                    ["busqueda", "Tengo la búsqueda"],
                    ["espontanea", "Carta espontánea"],
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
                  <input type="url" inputMode="url" placeholder="https://…" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} className={inputClass} />
                  {showJobText ? (
                    <textarea
                      ref={jobTextRef}
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
                  <input placeholder="Empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} className={inputClass} />
                  <input placeholder="Rol o área que te interesa (opcional)" value={rol} onChange={(e) => setRol(e.target.value)} className={inputClass} />
                </div>
              )}
            </StepCard>

            <StepCard n={2} title="Lo que querés contar" hint="Con tus palabras, como si se lo contaras a una amiga. Escribilo o grabalo.">
              <ul className="mb-3 grid gap-2 sm:grid-cols-3">
                {GUIDE.map((g) => (
                  <li key={g} className="rounded-xl bg-sand px-3 py-2 text-xs leading-snug text-muted">
                    {g}
                  </li>
                ))}
              </ul>
              <textarea
                rows={6}
                placeholder="Me encanta que… Lo que más me entusiasma es… Hace unos años…"
                value={motivacion}
                onChange={(e) => setMotivacion(e.target.value)}
                className={`${inputClass} leading-relaxed`}
              />
              <div className="mt-3">
                <VoiceButton onText={(t) => setMotivacion((f) => (f ? `${f.trimEnd()} ${t}` : t))} />
              </div>
            </StepCard>

            <StepCard n={3} title="Tu experiencia" hint="Para elegir los logros que mejor te representan. Nunca inventamos nada.">
              <CvSourceField input={cv} />
            </StepCard>

            <StepCard n={4} title="Ajustes" hint="Podés cambiarlos después y reescribirla en un clic.">
              <p className="text-sm font-medium">Tono</p>
              <div className="mt-2">
                <Chips value={opciones.tono} options={TONOS} onChange={(v) => setOpciones((o) => ({ ...o, tono: v }))} />
              </div>
              <p className="mt-5 text-sm font-medium">Largo</p>
              <div className="mt-2">
                <Chips value={opciones.largo} options={LARGOS} onChange={(v) => setOpciones((o) => ({ ...o, largo: v }))} />
              </div>
              <p className="mt-5 text-sm font-medium">Idioma</p>
              <div className="mt-2">
                <Chips value={opciones.idioma} options={IDIOMAS} onChange={(v) => setOpciones((o) => ({ ...o, idioma: v }))} />
              </div>
              <label className="mt-5 block text-sm font-medium" htmlFor="destinatario">
                ¿Sabés a quién va dirigida? <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                id="destinatario"
                placeholder="Ej.: Laura Gómez, Head of Talent"
                value={opciones.destinatario}
                onChange={(e) => setOpciones((o) => ({ ...o, destinatario: e.target.value }))}
                className={`mt-2 ${inputClass}`}
              />
            </StepCard>

            <div className="flex flex-col items-center gap-3 pt-2">
              <PrimaryButton onClick={write} disabled={!canWrite}>
                Escribir mi carta
              </PrimaryButton>
              {!canWrite && <p className="text-xs text-muted">Completá la búsqueda, lo que querés contar y tu experiencia.</p>}
            </div>
          </div>
        </>
      )}

      {stage === "escribiendo" && <Loading messages={LOADING} />}

      {stage === "resultado" && doc && carta && (
        <Result
          doc={doc}
          setDoc={setDoc}
          carta={carta}
          opciones={opciones}
          onRewriteAll={rewriteAll}
          onError={setError}
          onEdit={() => setStage("inicio")}
          onRestart={restart}
        />
      )}
    </div>
  );
}

function Result({
  doc,
  setDoc,
  carta,
  opciones,
  onRewriteAll,
  onError,
  onEdit,
  onRestart,
}: {
  doc: CartaDoc;
  setDoc: (fn: (d: CartaDoc) => CartaDoc) => void;
  carta: Carta;
  opciones: CartaOpciones;
  onRewriteAll: (o: CartaOpciones) => void;
  onError: (msg: string) => void;
  onEdit: () => void;
  onRestart: () => void;
}) {
  const [draft, setDraft] = useState<CartaOpciones>(opciones);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const filename = cartaFileName(doc, carta.empresa);
  const changed = draft.tono !== opciones.tono || draft.largo !== opciones.largo;

  async function rewrite(id: string, how: Rewrite) {
    const p = doc.parrafos.find((x) => x.id === id);
    if (!p?.text.trim()) return;
    setRewriting(id);
    onError("");
    try {
      const { texto } = await post<{ texto: string }>("/api/carta/parrafo", {
        parrafo: p.text,
        otros: doc.parrafos.filter((x) => x.id !== id).map((x) => x.text),
        instruccion: how,
        idioma: doc.lang,
        puesto: carta.puesto,
        empresa: carta.empresa,
      });
      setDoc((d) => ({ ...d, parrafos: d.parrafos.map((x) => (x.id === id ? { ...x, text: texto } : x)) }));
    } catch (e) {
      onError((e as Error).message || "No pudimos reescribir el párrafo.");
    } finally {
      setRewriting(null);
    }
  }

  // Descargar o copiar la carta exige haber ingresado con el magic link.
  const gate = useLoginGate();

  function exportAs(kind: "pdf" | "docx") {
    gate.run("descargar tu carta", () => doExport(kind));
  }

  async function doExport(kind: "pdf" | "docx"): Promise<void> {
    (document.activeElement as HTMLElement | null)?.blur();
    setBusy(kind);
    onError("");
    setPdfFailed(false);
    try {
      await new Promise((r) => setTimeout(r, 0));
      const { downloadLetterDocx, downloadLetterPdf, DownloadError } = await import("@/lib/export/client");
      try {
        if (kind === "pdf") await downloadLetterPdf(doc, filename);
        else await downloadLetterDocx(doc, filename);
      } catch (e) {
        if (e instanceof DownloadError && e.code === "AUTH_REQUIRED") {
          gate.ask("descargar tu carta", () => doExport(kind));
          return;
        }
        throw e;
      }
    } catch (e) {
      onError((e as Error).message || "No pudimos generar el archivo.");
      if (kind === "pdf") setPdfFailed(true);
    } finally {
      setBusy(null);
    }
  }

  const words = doc.parrafos.reduce((n, p) => n + (p.text.trim() ? p.text.trim().split(/\s+/).length : 0), 0);

  return (
    <div className="animate-rise">
      {gate.dialog}
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand">Tu carta para</p>
      <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">
        {carta.puesto || "la búsqueda"} {carta.empresa && <span className="text-muted">· {carta.empresa}</span>}
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-xs text-brand-dark">✎</span>
            Tocá cualquier texto para editarlo. Pasá por un párrafo para reescribirlo con IA.
            <span className="ml-auto text-xs">{words} palabras</span>
          </p>
          <div className="cv-scroll">
            <LetterPaper doc={doc} onChange={setDoc} onRewrite={rewrite} rewriting={rewriting} />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="flex flex-col gap-2 rounded-3xl bg-paper p-5">
            <button
              type="button"
              onClick={() => exportAs("pdf")}
              disabled={!!busy}
              className="rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-brand-dark disabled:opacity-70"
            >
              {busy === "pdf" ? "Generando PDF…" : "Descargar PDF"}
            </button>
            <button
              type="button"
              onClick={() => exportAs("docx")}
              disabled={!!busy}
              className={`rounded-full border px-4 py-2.5 text-sm font-medium transition disabled:opacity-70 ${
                pdfFailed ? "border-danger bg-danger-soft text-danger-dark" : "border-brand text-brand-dark hover:bg-brand-soft"
              }`}
            >
              {busy === "docx" ? "Generando Word…" : "Descargar Word (.docx)"}
            </button>
            <CopyButton text={cartaToText(doc)} label="Copiar como texto" guard={(copy) => gate.run("copiar tu carta", copy, { resume: false })} />
          </div>

          <div className="rounded-3xl bg-paper p-5">
            <h3 className="text-sm font-semibold">Reescribila</h3>
            <p className="mt-1 text-xs text-muted">Cambiá el tono o el largo y la escribimos de nuevo. Tu diseño y tus datos quedan.</p>
            <p className="mt-4 text-xs font-medium text-muted">Tono</p>
            <div className="mt-2">
              <Chips value={draft.tono} options={TONOS} onChange={(v) => setDraft((o) => ({ ...o, tono: v }))} />
            </div>
            <p className="mt-4 text-xs font-medium text-muted">Largo</p>
            <div className="mt-2">
              <Chips value={draft.largo} options={LARGOS} onChange={(v) => setDraft((o) => ({ ...o, largo: v }))} />
            </div>
            <button
              type="button"
              onClick={() => onRewriteAll({ ...draft, idioma: opciones.idioma, destinatario: opciones.destinatario })}
              className={`mt-4 w-full rounded-full px-4 py-2.5 text-sm font-medium transition ${
                changed ? "bg-ink text-paper hover:bg-ink/85" : "border border-line text-ink hover:border-brand hover:text-brand"
              }`}
            >
              {changed ? "Reescribir con estos ajustes" : "Escribir otra versión"}
            </button>
          </div>

          <div className="rounded-3xl bg-paper p-5">
            <label className="text-sm font-semibold" htmlFor="carta-template">
              Diseño
            </label>
            <p className="mt-1 text-xs text-muted">Usá el mismo que tu CV para que se vean como un set.</p>
            <select
              id="carta-template"
              value={doc.template}
              onChange={(e) => setDoc((d) => ({ ...d, template: e.target.value, style: { density: d.style?.density, size: d.style?.size } }))}
              className="mt-3 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {CATEGORIES.map((c) => (
                <optgroup key={c.id} label={c.label}>
                  {TEMPLATES.filter((t) => t.categoria === c.id).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <StylePanel doc={doc} setDoc={setDoc} hint={false} />
        </aside>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-paper p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl tracking-tight">Mensaje corto</h2>
              <p className="text-xs text-muted">Para LinkedIn o un email rápido al recruiter · {carta.mensaje_corto.length} caracteres</p>
            </div>
            <CopyButton text={carta.mensaje_corto} />
          </div>
          <p className="mt-3 whitespace-pre-line rounded-2xl bg-cream px-4 py-3 leading-relaxed">{carta.mensaje_corto}</p>
        </section>

        <section className="rounded-3xl border border-line bg-paper p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl tracking-tight">Asunto del email</h2>
              <p className="text-xs text-muted">Si la mandás por mail</p>
            </div>
            <CopyButton text={carta.asunto_email} />
          </div>
          <p className="mt-3 rounded-2xl bg-cream px-4 py-3 font-medium">{carta.asunto_email}</p>

          {carta.requisitos_cubiertos.length > 0 && (
            <>
              <h3 className="mt-5 text-sm font-semibold text-sage">Lo que tu carta demuestra</h3>
              <ul className="mt-2 space-y-2 text-sm leading-relaxed">
                {carta.requisitos_cubiertos.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-sage">●</span>
                    <span>
                      <span className="font-medium">{r.requisito}:</span> <span className="text-muted">{r.como}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {carta.consejos.length > 0 && (
        <section className="mt-4 rounded-3xl bg-sage-soft p-6">
          <h2 className="font-display text-xl tracking-tight">Antes de enviarla</h2>
          <ul className="mt-2 space-y-1.5 leading-relaxed">
            {carta.consejos.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-sage">●</span>
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/cv" className="rounded-3xl border border-line bg-paper p-6 transition hover:border-brand">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">Completá el set</p>
          <p className="mt-2 font-display text-xl">Creá tu CV con el mismo diseño →</p>
        </Link>
        <Link href="/postulacion" className="rounded-3xl border border-line bg-paper p-6 transition hover:border-brand">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">¿Hay formulario?</p>
          <p className="mt-2 font-display text-xl">Preparate con el coach de postulación →</p>
        </Link>
      </section>

      <div className="mt-10 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
        <button type="button" onClick={onEdit} className="px-5 py-3 text-sm text-muted hover:text-ink">
          ← Cambiar lo que cargué
        </button>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-full border border-line bg-paper px-6 py-3 text-sm font-medium transition hover:border-brand hover:text-brand"
        >
          Escribir otra carta
        </button>
      </div>
    </div>
  );
}
