"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CompanyTile from "@/components/busquedas/CompanyTile";
import { handoffJob, type HandoffTarget } from "@/lib/match/clientStore";
import {
  ARTIFACT_LABELS,
  STATUSES,
  TRACKER_EVENT,
  jobFromPage,
  TRACKER_KEY,
  listTracked,
  removeTracked,
  setNotes,
  setStatus,
  upsertTracked,
  type TrackItem,
  type TrackStatus,
} from "@/lib/tracker";

/** Las tarjetas del seguimiento, al día con lo que hagan las otras herramientas (y otras pestañas). */
function useTracked(): TrackItem[] | null {
  const [items, setItems] = useState<TrackItem[] | null>(null);
  useEffect(() => {
    const refresh = () => setItems(listTracked());
    const onStorage = (e: StorageEvent) => {
      if (e.key === TRACKER_KEY) refresh();
    };
    refresh();
    window.addEventListener(TRACKER_EVENT, refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TRACKER_EVENT, refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return items;
}

const DOT: Record<TrackStatus, string> = {
  guardada: "bg-[#c9ced4]",
  postulada: "bg-[#2457d6]",
  entrevista: "bg-[#d4831c]",
  oferta: "bg-neon",
  descartada: "bg-[#e2553d]",
};

const fmtDate = (t: number) => new Date(t).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

/** Tablero tipo kanban como el "Job Tracker" de jobright: columnas por estado; en celular, pestañas. */
export default function TrackerBoard() {
  const items = useTracked();
  const router = useRouter();

  // Viene de la extensión ("Guardar en mi seguimiento"): sumamos la postulación y limpiamos la URL.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const url = q.get("add");
    if (!url || !/^https?:\/\//.test(url)) return;
    const job = jobFromPage(q.get("title") ?? "", url);
    upsertTracked({ ...job, jobUrl: url, artifact: "extension" });
    router.replace("/seguimiento");
  }, [router]);
  const [tab, setTab] = useState<TrackStatus>("guardada");
  const [adding, setAdding] = useState(false);

  if (items === null) return <div className="h-64 animate-pulse rounded-2xl bg-white" aria-busy="true" />;

  const by = (s: TrackStatus) => items.filter((it) => it.status === s);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 py-1">
        <p className="text-[13px]" aria-live="polite">
          {items.length === 0 ? "Todavía no seguís ninguna postulación" : `${items.length} ${items.length === 1 ? "postulación" : "postulaciones"} en seguimiento`}
          <span className="text-ink/50"> · se guarda en este navegador y, si ingresás, en tu cuenta</span>
        </p>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          aria-expanded={adding}
          className="press ml-auto rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white hover:bg-black"
        >
          + Agregar una postulación
        </button>
      </div>
      {adding && <AddForm onDone={() => setAdding(false)} />}

      {items.length === 0 && !adding ? (
        <Empty />
      ) : (
        <>
          {/* Celular y tablet: una columna a la vez. */}
          <div role="tablist" aria-label="Estados" className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {STATUSES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={tab === s.id}
                onClick={() => setTab(s.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium ${tab === s.id ? "bg-ink text-white" : "bg-white hover:bg-black/[0.05]"}`}
              >
                {s.label}
                <span className={`rounded-full px-1.5 text-[11px] ${tab === s.id ? "bg-white/20" : "bg-[#f2f4f5]"}`}>{by(s.id).length}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 lg:hidden">
            <Column status={tab} items={by(tab)} />
          </div>

          {/* Escritorio: el tablero completo. */}
          <div className="mt-3 hidden gap-3 lg:grid lg:grid-cols-5">
            {STATUSES.map((s) => (
              <section key={s.id} aria-label={s.label} className="min-w-0 rounded-2xl bg-[#eceef0] p-2">
                <h2 className="flex items-center gap-2 px-2 pb-2 pt-1 text-[13px] font-semibold">
                  <span className={`h-2.5 w-2.5 rounded-full ${DOT[s.id]}`} aria-hidden />
                  {s.label}
                  <span className="ml-auto rounded-full bg-white px-2 text-[11px]">{by(s.id).length}</span>
                </h2>
                <Column status={s.id} items={by(s.id)} compact />
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

const HINTS: Record<TrackStatus, string> = {
  guardada: "Las búsquedas que guardaste o para las que armaste algo con Maru.",
  postulada: "Cuando te postules, mové la tarjeta acá.",
  entrevista: "¿Te llamaron? Practicá la entrevista con Maru.",
  oferta: "Las que llegaron a una oferta. ¡Ojalá se llene!",
  descartada: "Las que no avanzaron o dejaste de lado.",
};

function Column({ status, items, compact = false }: { status: TrackStatus; items: TrackItem[]; compact?: boolean }) {
  if (items.length === 0) return <p className={`rounded-xl border border-dashed border-black/10 p-4 text-center text-xs text-ink/50 ${compact ? "" : "bg-white"}`}>{HINTS[status]}</p>;
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.id}>
          <Card it={it} />
        </li>
      ))}
    </ul>
  );
}

function Card({ it }: { it: TrackItem }) {
  const router = useRouter();
  const [notesOpen, setNotesOpen] = useState(!!it.notes);
  const [notes, setNotesDraft] = useState(it.notes);

  function go(to: HandoffTarget) {
    handoffJob(to, { jobUrl: it.jobUrl, jobText: it.jobText ?? "", title: it.title, company: it.company });
    router.push(`/${to}#empezar`);
  }

  const action =
    it.status === "guardada"
      ? { to: "postulacion" as const, label: "Adaptar mi CV" }
      : it.status === "entrevista"
        ? { to: "entrevista" as const, label: "Practicar la entrevista" }
        : it.status === "postulada" && !it.artifacts.some((a) => a.kind === "carta")
          ? { to: "carta" as const, label: "Escribir mi carta" }
          : null;

  return (
    <article className="rounded-xl bg-white p-3 ring-1 ring-black/[0.04]">
      <div className="flex gap-3">
        <CompanyTile name={it.company || it.title} size={36} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug">{it.title || "Búsqueda sin título"}</h3>
          <p className="truncate text-xs text-ink/70">{it.company || "Empresa sin nombre"}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink/50">
        Agregada el {fmtDate(it.createdAt)}
        {it.updatedAt - it.createdAt > 60_000 && ` · actualizada el ${fmtDate(it.updatedAt)}`}
      </p>
      {it.artifacts.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="Lo que armaste con Maru">
          {it.artifacts.map((a) => (
            <li key={a.kind} className="rounded-md bg-neon/15 px-1.5 py-0.5 text-[10px] font-medium">
              ✓ {ARTIFACT_LABELS[a.kind]}
            </li>
          ))}
        </ul>
      )}

      <label className="mt-3 flex items-center gap-2 text-xs">
        <span className="sr-only">Estado</span>
        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[it.status]}`} aria-hidden />
        <select
          value={it.status}
          onChange={(e) => setStatus(it.id, e.target.value as TrackStatus)}
          className="w-full rounded-lg bg-[#f2f4f5] px-2 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ink"
        >
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.one}
            </option>
          ))}
        </select>
      </label>

      {notesOpen && (
        <textarea
          value={notes}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={() => notes !== it.notes && setNotes(it.id, notes.trim())}
          rows={2}
          placeholder="Con quién hablaste, fechas, próximos pasos…"
          aria-label="Notas"
          className="mt-2 w-full resize-y rounded-lg bg-[#f2f4f5] px-2 py-1.5 text-xs outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-ink"
        />
      )}

      {action && (
        <button type="button" onClick={() => go(action.to)} className="press mt-2 block w-full rounded-lg bg-neon py-1.5 text-center text-xs font-semibold">
          {action.label}
        </button>
      )}

      <div className="mt-2 flex items-center gap-3 text-[11px]">
        {it.jobUrl && (
          <a href={it.jobUrl} target="_blank" rel="noopener noreferrer nofollow" className="font-medium hover:underline">
            Ver aviso ↗
          </a>
        )}
        {!notesOpen && (
          <button type="button" onClick={() => setNotesOpen(true)} className="font-medium hover:underline">
            + Nota
          </button>
        )}
        <button
          type="button"
          onClick={() => window.confirm(`¿Sacar “${it.title || it.company}” de tu seguimiento?`) && removeTracked(it.id)}
          className="ml-auto text-ink/50 hover:text-danger"
        >
          Borrar
        </button>
      </div>
    </article>
  );
}

function AddForm({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [status, setStatusDraft] = useState<TrackStatus>("postulada");
  const field = "w-full rounded-lg bg-[#f2f4f5] px-3 py-2 text-sm outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-ink";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    upsertTracked({ title, company, jobUrl, status, force: true });
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded-2xl bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr_auto_auto]">
      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Puesto" aria-label="Puesto" className={field} />
      <input required value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa" aria-label="Empresa" className={field} />
      <input type="url" inputMode="url" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="Link del aviso (opcional)" aria-label="Link del aviso" className={field} />
      <select value={status} onChange={(e) => setStatusDraft(e.target.value as TrackStatus)} aria-label="Estado" className={field}>
        {STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.one}
          </option>
        ))}
      </select>
      <button type="submit" className="press rounded-full bg-neon px-5 py-2 text-sm font-bold uppercase">
        Agregar
      </button>
    </form>
  );
}

function Empty() {
  return (
    <div className="mt-4 rounded-2xl bg-white p-8 text-center sm:p-12">
      <p className="text-xl font-semibold">Tu seguimiento está vacío</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">
        Cuando guardes una búsqueda o armes un CV, una carta o una práctica de entrevista con Maru, la postulación aparece acá sola. Después la movés de estado a medida que avanza.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/busquedas" className="press rounded-full bg-ink px-6 py-3 text-sm font-medium text-white hover:bg-black">
          Ver búsquedas
        </Link>
        <Link href="/match" className="press rounded-full bg-neon px-6 py-3 text-sm font-bold uppercase">
          Mi match
        </Link>
      </div>
    </div>
  );
}
