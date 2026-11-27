"use client";

import { useEffect, useState } from "react";
import type { TargetView } from "@/lib/radar/types";
import { PrioritySelect, SourceTag } from "./bits";
import { Drawer, Monogram, Notice, Tag, btnDark, btnGhost, field } from "./ui";

const SOURCE_STATUS: Record<string, string> = {
  pendiente: "Pendiente de verificar",
  verificada: "Verificada",
  verificada_vacia: "Verificada, sin vacantes",
  parcial: "Revisión incompleta",
  error: "Con error",
};
const PROVIDER: Record<string, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", careers: "Página de Careers" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children || <span className="text-muted">Sin dato</span>}</dd>
    </div>
  );
}

/** Ficha de una empresa seguida: datos del catálogo, fuentes, notas personales y prioridad. */
export default function CompanyDrawer({
  view,
  onClose,
  onPatch,
  onUnfollow,
  busy,
}: {
  view: TargetView;
  onClose: () => void;
  onPatch: (body: Record<string, unknown>, ok?: string) => Promise<void>;
  onUnfollow: () => Promise<void>;
  busy: boolean;
}) {
  const { company: c, target: t, sources } = view;
  const [notes, setNotes] = useState(t.notes);
  useEffect(() => setNotes(t.notes), [t.notes]);
  const archived = t.status === "archivada";

  return (
    <Drawer title={c.name} open onClose={onClose}>
      <div className="flex items-start gap-3">
        <Monogram name={c.name} size={48} />
        <div className="min-w-0">
          <p className="text-sm text-muted">{[c.headquarters, c.region].filter(Boolean).join(" · ") || "Ubicación a confirmar"}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {c.industries.map((i) => <Tag key={i}>{i}</Tag>)}
            <SourceTag view={view} />
            {archived && <Tag tone="warn">Archivada</Tag>}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-sm font-semibold">Prioridad</p>
          <PrioritySelect label={`Prioridad de ${c.name}`} value={t.priority} disabled={busy} onChange={(p) => void onPatch({ priority: p }, `${c.name}: ${p ?? "por clasificar"}`)} />
        </div>
        <p className="pb-2 text-xs text-muted">Una sola prioridad para todos sus sectores.</p>
      </div>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Empresa</h3>
      <dl className="mt-1">
        <Row label="Actividad">{c.description}</Row>
        <Row label="Sede">{c.headquarters}</Row>
        <Row label="Etapa">{c.stage}</Row>
        <Row label="Tamaño estimado">
          {c.employeeBand && (
            <>
              {c.employeeBand}
              {c.metadataSource && <span className="text-muted"> · {c.metadataSource.label}, {c.metadataSource.at}</span>}
            </>
          )}
        </Row>
        <Row label="Áreas sugeridas">{c.suggestedAreas.join(", ")}</Row>
        <Row label="Identidad">
          {c.canonicalDomain ? (
            <>
              {c.canonicalDomain} <span className="text-muted">({c.domainVerified ? "verificado" : "dominio declarado, sin verificar"})</span>
            </>
          ) : (
            <span>Provisoria: sin dominio. Se confirma al verificar la fuente.</span>
          )}
        </Row>
        {c.rankings.length > 0 && <Row label="Ranking del Sheet">{c.rankings.map((r) => `${r.industry}${r.region ? ` ${r.region}` : ""}: #${r.rank}`).join(" · ")}</Row>}
      </dl>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Fuentes y monitoreo</h3>
      {sources.length ? (
        <ul className="mt-2 space-y-2">
          {sources.map((s) => (
            <li key={s.id} className="rounded-xl p-3 text-sm ring-1 ring-black/[0.08]">
              <p className="font-semibold">{PROVIDER[s.provider]}{s.externalBoardId ? ` · ${s.externalBoardId}` : ""}</p>
              <a href={s.careersUrl} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">{s.careersUrl}</a>
              <p className="mt-1 text-xs text-muted">
                {SOURCE_STATUS[s.status]}
                {s.declaredStatus && ` · En el Sheet: «${s.declaredStatus}»`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Sin página de Careers registrada.</p>
      )}
      <dl className="mt-2">
        <Row label="Última revisión">Nunca</Row>
        <Row label="Próximo chequeo">Sin programar</Row>
        <Row label="Vacantes">Sin vacantes detectadas todavía</Row>
      </dl>
      <div className="mt-2">
        <button type="button" className={btnGhost} disabled aria-describedby="revisar-nota">Revisar ahora</button>
        <p id="revisar-nota" className="mt-1 text-xs text-muted">Disponible cuando Maru pueda revisar fuentes verificadas.</p>
      </div>

      <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-muted">Notas personales</h3>
      <label htmlFor="radar-notas" className="sr-only">Notas personales sobre {c.name}</label>
      <textarea id="radar-notas" rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${field} mt-2`} placeholder="Contactos, por qué te interesa, qué averiguar…" />
      <div className="mt-2 flex items-center gap-2">
        <button type="button" className={btnDark} disabled={busy || notes === t.notes} onClick={() => void onPatch({ notes }, "Notas guardadas")}>Guardar notas</button>
        <span className="text-xs text-muted">Sólo las ves vos.</span>
      </div>

      <div className="mt-8 border-t border-line pt-5">
        <Notice>Archivar o dejar de seguir no toca tus postulaciones en Seguimiento.</Notice>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnGhost} disabled={busy} onClick={() => void onPatch({ status: archived ? "activa" : "archivada" }, archived ? `${c.name} volvió a tus empresas` : `${c.name} archivada`)}>
            {archived ? "Reactivar" : "Archivar"}
          </button>
          <button
            type="button"
            className={`${btnGhost} text-danger-dark`}
            disabled={busy}
            onClick={() => {
              if (window.confirm(`¿Dejar de seguir ${c.name}? Se borran tu prioridad y tus notas de esta empresa.`)) void onUnfollow();
            }}
          >
            Dejar de seguir
          </button>
        </div>
      </div>
    </Drawer>
  );
}
