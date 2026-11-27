"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { safeHref } from "@/lib/radar/identity";
import { archiveCompany, setPriority, updateCompany } from "@/lib/radar/state";
import { STATE_HINT, type CompanyStatus } from "@/lib/radar/sourceState";
import type { Priority } from "@/lib/radar/types";
import { PrioritySelect, SourcePill } from "./Controls";
import { Avatar, Drawer, Note, btn, btnNeon, field, fmtDate, fmtDateTime, label } from "./RadarUi";
import { useRadar } from "./useRadar";

export default function CompanyDetail({ id, status, statusLoading, onRefresh, onClose, onToast }: { id: string | null; status: CompanyStatus | undefined; statusLoading: boolean; onRefresh: () => void; onClose: () => void; onToast: (m: string) => void }) {
  const { state, update } = useRadar();
  const co = id ? state.companies[id] : undefined;
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    setNotes(co?.notes ?? "");
    setUrl(co?.careersUrl ?? "");
    // Sólo al abrir otra empresa: no pisar lo que la persona está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!co) return null;
  const careers = safeHref(co.careersUrl);
  const saveNotes = () => notes !== co.notes && update((s) => updateCompany(s, co.id, { notes: notes.slice(0, 4000) }));
  const saveUrl = () => {
    if (url.trim() === (co.careersUrl ?? "")) return;
    if (url.trim() && !safeHref(url)) {
      onToast("El link de Careers no es una URL válida.");
      return;
    }
    update((s) => updateCompany(s, co.id, { careersUrl: url.trim() || undefined }));
    onToast("Guardamos el link. Revisamos de nuevo su fuente.");
  };

  return (
    <Drawer title={co.name} open={!!id} onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <Avatar name={co.name} size={48} />
        <div className="min-w-0">
          <p className="text-sm text-muted">{[co.industries.join(" · "), co.hq, co.region].filter(Boolean).join(" · ") || "Sin datos de sede"}</p>
          {co.domain && <p className="text-xs text-muted">{co.domain}</p>}
        </div>
      </div>

      {co.archived && <Note>Dejaste de seguir esta empresa. Tus postulaciones y notas siguen guardadas.</Note>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div>
          <span className={label}>Prioridad</span>
          <PrioritySelect value={co.priority} name={co.name} onChange={(p: Priority | null) => update((s) => setPriority(s, co.id, p))} />
        </div>
        <div>
          <span className={label}>Búsquedas abiertas</span>
          <p className="text-sm">
            {status ? (
              <>
                <b>{status.open}</b> · {status.eligible} desde Argentina · {status.pending} por confirmar
              </>
            ) : (
              "—"
            )}
          </p>
          {status && status.open > 0 && (
            <Link href={`/radar/oportunidades?empresa=${encodeURIComponent(co.id)}`} className="text-sm font-semibold underline underline-offset-4">
              Ver oportunidades
            </Link>
          )}
        </div>
      </div>

      {(co.activity || co.stage || co.employees || co.areas) && (
        <section className="mb-5">
          <h3 className="mb-2 text-sm font-bold">Sobre la empresa</h3>
          {co.activity && <p className="mb-2 text-sm leading-relaxed">{co.activity}</p>}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {co.stage && (
              <>
                <dt className="text-muted">Etapa</dt>
                <dd>{co.stage}</dd>
              </>
            )}
            {co.employees && (
              <>
                <dt className="text-muted">Empleados (estimado)</dt>
                <dd>{co.employees}</dd>
              </>
            )}
            {co.areas && (
              <>
                <dt className="text-muted">Áreas sugeridas</dt>
                <dd>{co.areas}</dd>
              </>
            )}
          </dl>
          {co.origin === "importada" && <p className="mt-2 text-xs text-muted">Datos de tu planilla de research, sin verificar por Maru.</p>}
        </section>
      )}

      <section className="mb-5 rounded-xl border border-line p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Monitoreo</h3>
          <SourcePill s={status} loading={statusLoading} />
        </div>
        {status && <p className="text-sm text-muted">{STATE_HINT[status.state]}</p>}
        {status?.lastError && <p className="mt-2 text-xs text-danger-dark">Último error: {status.lastError}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">Última lectura buena</dt>
          <dd>{fmtDateTime(status?.lastOkAt)}</dd>
          <dt className="text-muted">Último intento</dt>
          <dd>{fmtDateTime(status?.lastAttemptAt)}</dd>
          <dt className="text-muted">Próxima revisión</dt>
          <dd>{status?.state === "monitoreada" || status?.state === "error" ? "En la sincronización diaria" : "—"}</dd>
        </dl>
        <label className="mt-4 block">
          <span className={label}>Página de empleo (Careers)</span>
          <div className="flex gap-2">
            <input className={`${field} min-w-0 flex-1`} type="url" value={url} onChange={(e) => setUrl(e.target.value)} onBlur={saveUrl} placeholder="https://…" />
            {careers && (
              <a href={careers} target="_blank" rel="noopener noreferrer" className={btn}>
                Abrir ↗
              </a>
            )}
          </div>
        </label>
        <button type="button" className={`${btn} mt-3`} onClick={onRefresh} disabled={statusLoading}>
          {statusLoading ? "Revisando…" : "Actualizar estado"}
        </button>
        <p className="mt-2 text-xs text-muted">Muestra lo último que leyó Maru. Las bolsas se vuelven a leer una vez por día ({fmtDate(status?.lastOkAt)}).</p>
      </section>

      {co.research && (
        <section className="mb-5">
          <h3 className="mb-1 text-sm font-bold">De tu research</h3>
          <p className="whitespace-pre-line text-sm text-muted">{co.research}</p>
        </section>
      )}

      <label className="mb-5 block">
        <span className={label}>Notas personales</span>
        <textarea className={`${field} w-full py-2`} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="Contactos, referidos, por qué te interesa…" />
      </label>

      <div className="flex flex-wrap gap-2">
        {co.archived ? (
          <button
            type="button"
            className={btnNeon}
            onClick={() => {
              update((s) => archiveCompany(s, co.id, false));
              onToast(`Volviste a seguir ${co.name}.`);
            }}
          >
            Volver a seguir
          </button>
        ) : (
          <button
            type="button"
            className={btn}
            onClick={() => {
              saveNotes();
              update((s) => archiveCompany(s, co.id, true));
              onToast(`Dejaste de seguir ${co.name}. Quedó en archivadas.`);
              onClose();
            }}
          >
            Dejar de seguir
          </button>
        )}
      </div>
    </Drawer>
  );
}
