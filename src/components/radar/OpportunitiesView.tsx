"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { fold } from "@/lib/radar/identity";
import { requestLogin } from "@/lib/loginRequest";
import type { JobOpening, PilotJob, Priority } from "@/lib/radar/types";
import { radarApi } from "./api";
import { REMOTE_LABEL, ago, fmtDate } from "./bits";
import { EmptyState, Monogram, Notice, PriorityPill, Skeleton, Stat, Tag, btnDark, btnGhost, card, field } from "./ui";

type Detected = JobOpening & { companyName: string; priority: Priority | null; industries: string[] };
type Data = { jobs: Detected[]; pilot: PilotJob[]; companies: { total: number; checked: number; lastSuccessAt: string | null } };

const LAST_VISIT = "maru:radar:ultima-visita";

function readLastVisit(): string | null {
  try {
    return localStorage.getItem(LAST_VISIT);
  } catch {
    return null;
  }
}

/** Oportunidades: vacantes detectadas en las empresas que seguís. Todavía sin evaluar con tu perfil. */
export default function OpportunitiesView() {
  const { email } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [since, setSince] = useState<string | null>(null);
  const [f, setF] = useState({ view: "todas" as "todas" | "nuevas", industry: "Todas", priority: "Todas", q: "", remote: false });

  useEffect(() => {
    if (!email) return;
    const prev = readLastVisit();
    setSince(prev);
    radarApi<Data>("/api/radar/oportunidades")
      .then((d) => {
        setData(d);
        try {
          localStorage.setItem(LAST_VISIT, new Date().toISOString());
        } catch {
          // sin almacenamiento: "nuevas" cuenta desde siempre
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No pudimos cargar las oportunidades."));
  }, [email]);

  const isNew = (j: Detected) => !since || j.firstSeenAt > since;
  const industries = useMemo(() => [...new Set((data?.jobs ?? []).flatMap((j) => j.industries))].sort((a, b) => a.localeCompare(b, "es")), [data]);
  const shown = useMemo(() => {
    const q = fold(f.q);
    return (data?.jobs ?? []).filter(
      (j) =>
        (f.view === "todas" || isNew(j)) &&
        (f.industry === "Todas" || j.industries.includes(f.industry)) &&
        (f.priority === "Todas" || (f.priority === "sin" ? !j.priority : j.priority === f.priority)) &&
        (!f.remote || j.remoteType === "remoto") &&
        (!q || fold(`${j.title} ${j.companyName} ${j.location}`).includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, f, since]);

  if (email === undefined) return <Skeleton />;
  if (email === null)
    return (
      <EmptyState title="Ingresá para ver tus oportunidades" actions={<button type="button" className={btnDark} onClick={() => void requestLogin("usar Radar laboral")}>Ingresar con Google</button>} />
    );
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <Skeleton />;

  const newCount = data.jobs.filter(isNew).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Nuevas" value={newCount} hint={since ? `Desde tu última visita (${ago(since)})` : "Primera visita"} />
        <Stat label="Match alto" value="—" hint="Todavía sin evaluar" />
        <Stat label="Empresas revisadas" value={`${data.companies.checked}/${data.companies.total}`} hint="Con al menos una lectura buena" />
        <Stat label="Última actualización" value={data.companies.lastSuccessAt ? ago(data.companies.lastSuccessAt) : "—"} hint={data.companies.lastSuccessAt ? fmtDate(data.companies.lastSuccessAt) : "Sin revisiones"} />
      </div>

      {data.jobs.length === 0 ? (
        <EmptyState
          title={data.companies.checked ? "No hay vacantes abiertas en tus empresas" : "Todavía no hay fuentes verificadas"}
          actions={<Link href="/radar/empresas" className={btnDark}>Ir a Mis empresas</Link>}
        >
          <p>{data.companies.checked ? "Maru leyó sus páginas y no encontró avisos publicados." : "Abrí la ficha de una empresa y tocá «Revisar ahora» para leer su página de Careers."}</p>
        </EmptyState>
      ) : (
        <section className={`${card} p-4 sm:p-5`} aria-labelledby="ops-titulo">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="ops-titulo" className="mr-auto text-lg font-bold">Vacantes detectadas</h2>
            <Tag tone="warn">Sin evaluar</Tag>
          </div>
          <p className="mt-1 text-sm text-muted">Están abiertas según la fuente oficial. El match con tu perfil llega en la próxima etapa: por ahora se ordenan por prioridad de la empresa y novedad.</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[auto_1fr_auto_auto_auto]">
            <div className="flex rounded-xl p-1 ring-1 ring-black/[0.12]" role="group" aria-label="Mostrar">
              {(["todas", "nuevas"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={f.view === v} onClick={() => setF({ ...f, view: v })} className={`min-h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink ${f.view === v ? "bg-ink text-white" : ""}`}>
                  {v === "todas" ? "Todas" : `Nuevas (${newCount})`}
                </button>
              ))}
            </div>
            <input type="search" aria-label="Buscar puesto o empresa" placeholder="Buscar puesto o empresa…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className={field} />
            <select aria-label="Sector" value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} className={field}>
              <option value="Todas">Todos los sectores</option>
              {industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
            <select aria-label="Prioridad de la empresa" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className={field}>
              <option value="Todas">Toda prioridad</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="sin">Por clasificar</option>
            </select>
            <label className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm ring-1 ring-black/[0.12]">
              <input type="checkbox" checked={f.remote} onChange={(e) => setF({ ...f, remote: e.target.checked })} className="h-4 w-4 accent-ink" />
              Sólo remoto
            </label>
          </div>

          <p className="mt-3 text-sm text-muted" aria-live="polite">{shown.length === 1 ? "1 vacante" : `${shown.length} vacantes`}</p>
          <ul className="mt-2 grid gap-2 lg:grid-cols-2">
            {shown.slice(0, 200).map((j) => (
              <li key={j.id} className="flex flex-col rounded-xl p-4 ring-1 ring-black/[0.08]">
                <div className="flex items-start gap-3">
                  <Monogram name={j.companyName} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted">{j.companyName}</p>
                    <h3 className="font-semibold leading-snug">{j.title}</h3>
                  </div>
                  <PriorityPill p={j.priority} />
                </div>
                <p className="mt-2 text-sm">{[j.location, REMOTE_LABEL[j.remoteType]].filter(Boolean).join(" · ") || "Ubicación sin dato"}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {isNew(j) && <Tag tone="ok">Nueva</Tag>}
                  <Tag>{j.publishedAt ? `Publicada ${fmtDate(j.publishedAt)}` : "Sin fecha de publicación"}</Tag>
                  <Tag>Detectada {ago(j.firstSeenAt)}</Tag>
                  <Tag>Vista {ago(j.lastSeenAt)}</Tag>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={j.url?.startsWith("https://") ? j.url : undefined} target="_blank" rel="noopener noreferrer" className={btnGhost}>
                    Ver aviso original <span aria-hidden>↗</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
          {shown.length > 200 && <p className="mt-2 text-sm text-muted">Mostramos las primeras 200. Usá los filtros para achicar la lista.</p>}
        </section>
      )}

      {data.pilot.length > 0 && (
        <details className={`${card} p-4 sm:p-5`}>
          <summary className="cursor-pointer text-base font-bold">Vacantes del piloto ({data.pilot.length}) · histórico</summary>
          <div className="mt-3">
            <Notice tone="warn">Piloto 25/11/2026 · vigencia no verificada. Son las del Sheet que importaste: no se tratan como abiertas y el score es editorial, no el match de Radar.</Notice>
          </div>
          <ul className="mt-3 space-y-2">
            {data.pilot.map((j) => (
              <li key={j.id} className="rounded-xl p-3 text-sm ring-1 ring-black/[0.08]">
                <p className="font-semibold">{j.company} · {j.title}</p>
                <p className="text-xs text-muted">
                  {[j.location, j.editorialScore !== null ? `${j.editorialScore}/100 editorial` : "", j.date].filter(Boolean).join(" · ")}
                </p>
                {j.url && (
                  <a href={j.url.startsWith("https://") ? j.url : undefined} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs underline underline-offset-2">
                    Link del piloto
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
