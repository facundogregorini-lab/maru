"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DOCX_MIME, MAX_FILE_BYTES, MIN_TEXT_CHARS, PDF_MIME } from "@/lib/cvSource";
import { CATEGORIA, DECISION_LABEL, ESTADO_ICON, MOTIVOS_NO, icpActual, toCsv, type CandidatoView, type Snapshot } from "@/lib/recruiters/client";
import type { Decision, Estado } from "@/lib/recruiters/types";
import { readFileBase64 } from "./files";

type Tab = "todos" | "sin" | Decision;
type Act = (body: Record<string, unknown>) => Promise<Snapshot>;

const estadoClase: Record<Estado, string> = {
  cumple: "bg-[#d9fdf2] text-[#0b4a2a]",
  no_cumple: "bg-surface text-muted line-through",
  sin_datos: "border border-dashed border-black/25 bg-white text-muted",
};
const decisionClase = (on: boolean, d: Decision) =>
  on ? (d === "si" ? "border-neon-deep bg-neon text-ink" : d === "no" ? "border-danger-dark bg-danger-dark text-white" : "border-honey bg-warning-soft text-ink") : "border-black/20 bg-white text-ink";

export default function Results({
  snap,
  act,
  working,
  runEvaluations,
  onEditIcp,
  onPropose,
}: {
  snap: Snapshot;
  act: Act;
  working: string;
  runEvaluations: (s: Snapshot) => Promise<void>;
  onEditIcp: () => void;
  onPropose: () => Promise<void>;
}) {
  const [aviso, setAviso] = useState("");
  async function buscarMaru() {
    setError("");
    setAviso("");
    setUploading("Buscando entre los candidatos de Maru");
    try {
      const s = await act({ accion: "buscar_maru" });
      setAviso(s.encontrados ? `Sumamos ${s.encontrados} ${s.encontrados === 1 ? "candidato" : "candidatos"} de Maru. La IA los está leyendo.` : "Por ahora no hay candidatos de Maru que coincidan con este perfil. Probá ampliar los requisitos o volvé en unos días.");
      setUploading("");
      if (s.pendientes > 0) await runEvaluations(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos buscar en Maru.");
    } finally {
      setUploading("");
    }
  }
  const icp = icpActual(snap.busqueda);
  const [tab, setTab] = useState<Tab>("todos");
  const [selId, setSelId] = useState<string | null>(null);
  const [uploading, setUploading] = useState("");
  const [pasted, setPasted] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const ordenados = useMemo(() => {
    const rank = (c: CandidatoView) => (c.evaluacion?.icpVersion === icp.version ? CATEGORIA[c.evaluacion.categoria].orden : 9);
    return [...snap.candidatos].sort((a, z) => rank(a) - rank(z) || a.agregadoEn - z.agregadoEn);
  }, [snap.candidatos, icp.version]);
  const filtrados = ordenados.filter((c) => (tab === "todos" ? true : tab === "sin" ? !c.decision : c.decision === tab));
  const sel = snap.candidatos.find((c) => c.id === selId) ?? filtrados[0] ?? null;
  const count = (d: Decision) => snap.candidatos.filter((c) => c.decision === d).length;

  async function rate(c: CandidatoView, d: Decision | null, motivo?: string) {
    setError("");
    setSelId(c.id);
    try {
      await act({ accion: "calificar", candidatoId: c.id, decision: c.decision === d && motivo === undefined ? null : d, ...(motivo !== undefined ? { motivo } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar la calificación.");
    }
  }

  // Atajos S / T / N sobre el candidato elegido (no mientras se escribe).
  const selRef = useRef(sel);
  selRef.current = sel;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!selRef.current || e.metaKey || e.ctrlKey || e.altKey || (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))) return;
      const map: Record<string, Decision> = { s: "si", t: "tal", n: "no" };
      const d = map[e.key.toLowerCase()];
      if (d) void rate(selRef.current, d);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // rate sólo usa act y setters estables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    const list = Array.from(files).slice(0, 50);
    let last: Snapshot | null = null;
    let fallos = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      setUploading(`Leyendo ${i + 1} de ${list.length}: ${f.name}`);
      const isPdf = f.type === PDF_MIME || f.name.toLowerCase().endsWith(".pdf");
      const isDocx = f.type === DOCX_MIME || f.name.toLowerCase().endsWith(".docx");
      if ((!isPdf && !isDocx) || f.size > MAX_FILE_BYTES) {
        fallos++;
        continue;
      }
      try {
        last = await act({ accion: "agregar_cv", source: { kind: "cv", fileBase64: await readFileBase64(f), mimeType: isPdf ? PDF_MIME : DOCX_MIME } });
      } catch (err) {
        fallos++;
        if (err instanceof Error && /lecturas con IA|ya tiene/.test(err.message)) {
          setError(err.message);
          break;
        }
      }
    }
    setUploading("");
    if (fallos) setError((e) => e || `No pudimos leer ${fallos} ${fallos === 1 ? "archivo" : "archivos"}. Aceptamos PDF o Word de hasta 3 MB con texto (no escaneos).`);
    if (fileRef.current) fileRef.current.value = "";
    if (last && last.pendientes > 0) await runEvaluations(last);
  }

  async function addPasted() {
    if (pasted.trim().length < MIN_TEXT_CHARS) return setError("Pegá el CV completo (al menos unas líneas de experiencia).");
    setError("");
    setUploading("Leyendo el CV pegado");
    try {
      const s = await act({ accion: "agregar_cv", source: { kind: "texto", text: pasted.trim() } });
      setPasted("");
      setShowPaste(false);
      if (s.pendientes > 0) await runEvaluations(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos leer el CV.");
    } finally {
      setUploading("");
    }
  }

  function exportCsv() {
    const blob = new Blob(["﻿", toCsv(snap)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${snap.busqueda.titulo.replace(/[^\w\sáéíóúñ-]/gi, "").trim() || "candidatos"}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const listos = snap.calificados >= snap.minCalificados;
  const tabs: [Tab, string, number][] = [
    ["todos", "Todos", snap.candidatos.length],
    ["sin", "Sin revisar", snap.candidatos.filter((c) => !c.decision).length],
    ["si", "Sí", count("si")],
    ["tal", "Tal vez", count("tal")],
    ["no", "No", count("no")],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[26px] leading-tight">{snap.busqueda.titulo}</h1>
          <button type="button" onClick={onEditIcp} className="rounded-full bg-mint px-2.5 py-1 text-xs font-semibold text-[#0b4a2a]">
            Perfil v{icp.version} · editar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="press inline-flex min-h-11 cursor-pointer items-center rounded-full bg-ink px-4 text-sm font-semibold text-white">
            Subir CVs
            <input ref={fileRef} type="file" multiple accept=".pdf,.docx,application/pdf" className="sr-only" onChange={(e) => void upload(e.target.files)} disabled={!!uploading || !!working} />
          </label>
          {snap.busqueda.fuentes.maru && (
            <button type="button" onClick={() => void buscarMaru()} disabled={!!uploading || !!working} className="inline-flex min-h-11 items-center rounded-full border border-neon-deep bg-white px-4 text-sm font-semibold disabled:opacity-60">
              Buscar en Maru
            </button>
          )}
          <button type="button" onClick={() => setShowPaste((v) => !v)} aria-expanded={showPaste} className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-medium">
            Pegar un CV
          </button>
          <button type="button" onClick={exportCsv} disabled={!snap.candidatos.length} className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-medium disabled:opacity-50">
            Exportar CSV
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4">
          <label htmlFor="cv-pegado" className="text-[13px] font-semibold">CV como texto</label>
          <textarea id="cv-pegado" rows={6} value={pasted} maxLength={60000} onChange={(e) => setPasted(e.target.value)} className="rounded-xl border border-line p-3 text-sm" />
          <button type="button" onClick={() => void addPasted()} disabled={!!uploading} className="self-end rounded-full bg-neon px-4 py-2 text-sm font-semibold disabled:opacity-60">
            Agregar candidato
          </button>
        </div>
      )}

      {(uploading || working) && (
        <div role="status" className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm">
          <span className="h-2.5 w-2.5 animate-breathe rounded-full bg-neon" aria-hidden />
          {uploading || working}
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-dark">{error}</p>}
      {aviso && <p role="status" className="rounded-xl bg-panel px-4 py-3 text-sm text-[#0b4a2a]">{aviso}</p>}

      {snap.candidatos.length > 0 && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${listos ? "border border-brand-light bg-panel" : "border border-dashed border-black/20 bg-white"}`}>
          <span className="text-sm leading-relaxed">
            {listos ? `Calificaste ${snap.calificados} perfiles. Maru ya puede proponerte ajustes al perfil ideal.` : `Calificaste ${snap.calificados} de ${snap.minCalificados}. Con ${snap.minCalificados} calificaciones Maru te propone ajustes al perfil ideal.`}
          </span>
          {listos && (
            <button type="button" onClick={() => void onPropose()} disabled={!!working} className="press inline-flex min-h-10 items-center rounded-full bg-neon px-4 text-sm font-semibold disabled:opacity-60">
              Afinar búsqueda
            </button>
          )}
        </div>
      )}

      {snap.candidatos.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-black/20 bg-white p-8 text-center">
          <p className="text-base font-semibold">Todavía no hay candidatos en esta búsqueda</p>
          <p className="mt-1 text-sm text-muted">Subí CVs en PDF o Word (hasta 50 por vez){snap.busqueda.fuentes.maru ? " o buscá entre los candidatos de Maru" : ""}. Maru los lee y los evalúa contra el perfil v{icp.version}.</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-3">
            <div role="tablist" aria-label="Filtrar por calificación" className="flex flex-wrap gap-1.5">
              {tabs.map(([k, label, n]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-9 rounded-full px-3.5 text-[13px] font-medium ${tab === k ? "bg-ink text-white" : "border border-line bg-white"}`}>
                  {label} <span className="opacity-70">{n}</span>
                </button>
              ))}
            </div>
            {filtrados.map((c) => (
              <Card key={c.id} c={c} version={icp.version} selected={sel?.id === c.id} onSelect={() => setSelId(c.id)} onRate={(d, m) => void rate(c, d, m)} criterios={icp.obligatorios.map((o) => ({ id: o.id, texto: o.texto }))} />
            ))}
            <p className="text-xs text-muted">Atajos con un candidato elegido: S (Sí), T (Tal vez), N (No).</p>
          </section>
          {sel && <Detail c={sel} version={icp.version} criterios={icp.obligatorios.map((o) => ({ id: o.id, texto: o.texto }))} onDelete={() => void act({ accion: "borrar_candidato", candidatoId: sel.id }).then(() => setSelId(null))} />}
        </div>
      )}

      {snap.versiones.length > 1 && (
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm font-semibold">Versiones del perfil</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-[13px] text-muted">
            {snap.versiones.map((v) => (
              <li key={v.version} className="rounded-xl bg-surface-5 px-3 py-2">
                v{v.version}: {v.calificados} calificados · {v.si} Sí
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Card({ c, version, selected, onSelect, onRate, criterios }: { c: CandidatoView; version: number; selected: boolean; onSelect: () => void; onRate: (d: Decision, motivo?: string) => void; criterios: { id: string; texto: string }[] }) {
  const e = c.evaluacion?.icpVersion === version ? c.evaluacion : null;
  const cumple = e ? e.criterios.filter((x) => x.estado === "cumple").length : 0;
  const [motivo, setMotivo] = useState(c.motivo);
  useEffect(() => setMotivo(c.motivo), [c.motivo]);
  return (
    <article className={`flex flex-col gap-3 rounded-[18px] bg-white p-4 ${selected ? "border-2 border-ink" : "border border-line"}`}>
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-3.5 text-left">
        <span className={`grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border-4 text-sm font-bold ${e ? CATEGORIA[e.categoria].ring : "border-dashed border-line text-muted"}`} aria-label={e ? CATEGORIA[e.categoria].label : "Pendiente"}>
          {e ? `${cumple}/${criterios.length}` : "…"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">{c.nombre}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.fuente === "maru" ? "bg-mint text-[#0b4a2a]" : "bg-[#e7f1fb] text-[#0c447c]"}`}>{c.fuente === "maru" ? "Maru" : "Tu postulante"}</span>
            {e && <span className="text-xs text-muted">{CATEGORIA[e.categoria].label}</span>}
          </span>
          <span className="text-[13px] text-muted">{[c.titular, c.ubicacion].filter(Boolean).join(" · ")}</span>
          <span className="text-[13px] leading-relaxed">{e ? e.porQue : "Maru todavía no lo evaluó con esta versión del perfil."}</span>
        </span>
      </button>
      {e && (
        <div className="flex flex-wrap gap-1.5">
          {criterios.map((o) => {
            const est = e.criterios.find((x) => x.id === o.id)?.estado ?? "sin_datos";
            return (
              <span key={o.id} className={`rounded-full px-2.5 py-1 text-xs ${estadoClase[est]}`} title={o.texto}>
                {ESTADO_ICON[est]} {o.texto.length > 28 ? `${o.texto.slice(0, 27)}…` : o.texto}
              </span>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {(["si", "tal", "no"] as Decision[]).map((d) => (
          <button key={d} type="button" aria-pressed={c.decision === d} onClick={() => onRate(d)} className={`min-h-10 min-w-[72px] rounded-full border px-4 text-sm font-semibold ${decisionClase(c.decision === d, d)}`}>
            {DECISION_LABEL[d]}
          </button>
        ))}
      </div>
      {(c.decision === "no" || c.decision === "tal") && (
        <div className="flex flex-col gap-2 rounded-xl bg-[#fff3f1] p-3">
          <span className="text-[13px] font-semibold">{c.decision === "no" ? "¿Por qué no?" : "¿Qué te hace dudar?"} Ayuda a afinar</span>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS_NO.map((m) => (
              <button key={m} type="button" onClick={() => onRate(c.decision as Decision, m)} className={`min-h-8 rounded-full px-3 text-xs font-medium ${c.motivo === m ? "bg-ink text-white" : "border border-line bg-white"}`}>
                {m}
              </button>
            ))}
          </div>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              onRate(c.decision as Decision, motivo.trim());
            }}
            className="flex gap-2"
          >
            <input aria-label="Motivo" value={motivo} maxLength={300} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Otro motivo" className="min-w-0 flex-1 rounded-full border border-line bg-white px-3.5 py-2 text-sm" />
            <button type="submit" className="rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white">Guardar</button>
          </form>
        </div>
      )}
    </article>
  );
}

function Detail({ c, version, criterios, onDelete }: { c: CandidatoView; version: number; criterios: { id: string; texto: string }[]; onDelete: () => void }) {
  const e = c.evaluacion?.icpVersion === version ? c.evaluacion : null;
  const [full, setFull] = useState(false);
  return (
    <aside aria-label="Detalle del candidato" className="flex w-full max-w-[420px] flex-[1_1_340px] flex-col gap-3.5 rounded-[20px] border border-line bg-white p-5 lg:sticky lg:top-20">
      <div className="flex flex-col gap-0.5">
        <span className="text-[17px] font-semibold">{c.nombre}</span>
        <span className="text-[13px] text-muted">{[c.titular, c.ubicacion].filter(Boolean).join(" · ")}</span>
      </div>
      {c.contacto && (c.contacto.email || c.contacto.telefono || c.contacto.linkedin) && (
        <div className="flex flex-col gap-1 rounded-xl bg-surface-5 p-3 text-[13px]">
          {c.contacto.email && <a href={`mailto:${c.contacto.email}`} className="underline">{c.contacto.email}</a>}
          {c.contacto.telefono && <span>{c.contacto.telefono}</span>}
          {c.contacto.linkedin && <a href={c.contacto.linkedin.startsWith("http") ? c.contacto.linkedin : `https://${c.contacto.linkedin}`} target="_blank" rel="noreferrer" className="underline">LinkedIn</a>}
        </div>
      )}
      {c.fuente === "maru" && <p className="rounded-xl bg-panel p-3 text-xs text-[#0b4a2a]">Nombre completo y contacto se comparten cuando acepte tu propuesta.</p>}
      {e ? (
        <>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold">Por qué apareció</h2>
            <p className="text-sm leading-relaxed">{e.porQue}</p>
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Criterio por criterio</h2>
            {criterios.map((o) => {
              const x = e.criterios.find((y) => y.id === o.id);
              const est = x?.estado ?? "sin_datos";
              return (
                <div key={o.id} className="flex items-start gap-2.5 rounded-xl bg-surface-5 p-3">
                  <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-xs font-bold ${est === "cumple" ? "bg-neon" : est === "no_cumple" ? "bg-surface text-muted" : "border border-dashed border-black/30 text-muted"}`} aria-hidden>
                    {ESTADO_ICON[est]}
                  </span>
                  <span className="flex flex-col gap-0.5 text-[13px] leading-snug">
                    <span className="font-semibold">{o.texto}</span>
                    <span className="text-muted">{x?.evidencia || "Sin datos en el CV."}</span>
                  </span>
                </div>
              );
            })}
          </div>
          {e.alertas.length > 0 && (
            <div className="rounded-xl bg-warning-soft p-3 text-[13px]">
              <span className="font-semibold">Para revisar:</span> {e.alertas.join(" ")} <span className="text-muted">Son señales, no motivos de descarte.</span>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">Pendiente de evaluar con el perfil v{version}.</p>
      )}
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={() => setFull((v) => !v)} aria-expanded={full} className="self-start text-[13px] font-medium underline underline-offset-4">
          {full ? "Ocultar el perfil" : "Ver el perfil leído"}
        </button>
        {full && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-surface-5 p-3 font-sans text-xs leading-relaxed">{c.perfilResumen}</pre>}
      </div>
      <p className="border-t border-surface pt-3 text-xs leading-relaxed text-muted">La IA no usa edad, género, nacionalidad ni foto. La decisión es tuya.</p>
      <button type="button" onClick={onDelete} className="self-start text-xs text-danger-dark underline underline-offset-4">Quitar de la búsqueda</button>
    </aside>
  );
}
