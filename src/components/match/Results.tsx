"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExternalJob } from "@/lib/match/api-schemas";
import { handoffToPostulacion } from "@/lib/match/clientStore";
import { track } from "@/lib/match/events";
import { FAMILY_LABEL, SENIORITY_LABEL, WORKPLACE_OPTIONS } from "@/lib/match/labels";
import { roleTokens, type Filters, type RankedItem, type RankOutput } from "@/lib/match/ranking";
import type { DiscardReason, Interactions, MatchPrefs, MatchProfile, RoleFamily, Seniority, Workplace } from "@/lib/match/types";
import { ErrorBanner, inputClass, post } from "../ui";
import { MultiChips } from "./fields";

type RankingResponse = RankOutput & { inventory: { generatedAt: string | null; open: number } };
type Tab = "elegibles" | "pendientes" | "guardadas";

const DISCARD_REASONS: [DiscardReason, string][] = [
  ["rol", "No me interesa este rol"],
  ["seniority", "No es mi nivel"],
  ["ubicacion", "Ubicación o modalidad"],
  ["empresa", "No quiero esta empresa"],
  ["salario", "Salario"],
  ["otro", "Otro motivo"],
];

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function Results({
  profile,
  prefs,
  interactions,
  setInteractions,
  external,
  setExternal,
  onEditProfile,
  onEditPrefs,
}: {
  profile: MatchProfile;
  prefs: MatchPrefs;
  interactions: Interactions;
  setInteractions: (i: Interactions) => void;
  external: ExternalJob[];
  setExternal: (e: ExternalJob[]) => void;
  onEditProfile: () => void;
  onEditPrefs: () => void;
}) {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("elegibles");
  const [filters, setFilters] = useState<Filters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const res = await post<RankingResponse>("/api/match/ranking", { profile, prefs, interactions, filters, external });
      if (n !== seq.current) return;
      setData(res);
      track("match_ranking_visto", { resultados: res.counts.eligible, pendientes: res.counts.pending, filtros: Object.keys(filters).length });
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [profile, prefs, interactions, filters, external]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const list = !data ? [] : tab === "elegibles" ? data.eligible : tab === "pendientes" ? data.pending : data.saved;

  function save(item: RankedItem) {
    const on = interactions.saved.includes(item.id);
    setInteractions({ ...interactions, saved: on ? interactions.saved.filter((x) => x !== item.id) : [...interactions.saved, item.id] });
    if (!on) track("match_guardar", { familia: item.family });
  }

  function discard(item: RankedItem, reason: DiscardReason) {
    setInteractions({
      saved: interactions.saved.filter((x) => x !== item.id),
      discarded: [...interactions.discarded, { id: item.id, reason, family: item.family, company: item.company, titleTokens: [...roleTokens(item.title)].slice(0, 20) }],
    });
    track("match_descartar", { motivo: reason });
  }

  const hasActiveFilters = Object.values(filters).some((v) => (Array.isArray(v) ? v.length : v));

  return (
    <div className="animate-rise">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-brand">Tus búsquedas</p>
          <h1 className="mt-1 font-display text-3xl tracking-tight sm:text-4xl">Oportunidades para vos</h1>
          {data && (
            <p className="mt-2 text-sm text-muted">
              {data.inventory.generatedAt
                ? `Revisamos ${data.inventory.open.toLocaleString("es-AR")} búsquedas abiertas de fuentes públicas (actualizado el ${fmtDate(data.inventory.generatedAt)}). No es todo el mercado: es lo que podemos leer gratis y con permiso.`
                : "Todavía no hay búsquedas cargadas en el inventario."}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-sm">
          <button type="button" onClick={onEditProfile} className="rounded-full border border-line bg-paper px-4 py-2 transition hover:border-brand hover:text-brand">
            Mi perfil
          </button>
          <button type="button" onClick={onEditPrefs} className="rounded-full border border-line bg-paper px-4 py-2 transition hover:border-brand hover:text-brand">
            Lo que busco
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap rounded-full bg-sand p-1 text-sm">
          {(
            [
              ["elegibles", `Para vos${data ? ` (${data.counts.eligible})` : ""}`],
              ["pendientes", `Por confirmar${data ? ` (${data.counts.pending})` : ""}`],
              ["guardadas", `Guardadas (${interactions.saved.length})`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-4 py-2 transition ${tab === k ? "bg-paper font-medium shadow-sm" : "text-muted hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setShowFilters((x) => !x)} className={`rounded-full border px-4 py-2 text-sm transition ${hasActiveFilters ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-paper hover:border-brand"}`}>
          Filtros{hasActiveFilters ? " activos" : ""}
        </button>
        <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-line bg-paper px-4 py-2 text-sm transition hover:border-brand hover:text-brand">
          + Agregar una búsqueda
        </button>
      </div>

      {tab === "pendientes" && (
        <p className="mt-4 rounded-2xl bg-honey/15 px-4 py-3 text-sm leading-relaxed text-ink">
          Estas búsquedas pueden servirte, pero el aviso no deja claro si contratan a personas que viven en Argentina (o falta otro dato importante). Confirmalo antes de postularte.
        </p>
      )}

      {showFilters && <FilterPanel filters={filters} setFilters={setFilters} />}
      {adding && <AddExternal onClose={() => setAdding(false)} onAdd={(job) => setExternal([job, ...external])} />}

      <div className="mt-6">
        <ErrorBanner message={error} />
        {error && (
          <button type="button" onClick={load} className="mb-6 text-sm text-brand-dark underline underline-offset-4">
            Reintentar
          </button>
        )}
        {loading && !data && <Skeleton />}
        {data && !data.inventory.generatedAt && tab !== "guardadas" && !external.length && <EmptyInventory />}
        {data && (data.inventory.generatedAt || external.length > 0 || tab === "guardadas") && list.length === 0 && !loading && (
          <EmptyResults tab={tab} hasFilters={hasActiveFilters} pending={data.counts.pending} onShowPending={() => setTab("pendientes")} onClearFilters={() => setFilters({})} />
        )}
        <div className={`space-y-4 transition ${loading && data ? "opacity-60" : ""}`}>
          {list.map((item, i) => (
            <JobCard
              key={item.id}
              item={item}
              position={i + 1}
              saved={interactions.saved.includes(item.id)}
              onSave={() => save(item)}
              onDiscard={(r) => discard(item, r)}
              onRemoveExternal={item.external ? () => setExternal(external.filter((e) => e.id !== item.id)) : undefined}
              external={external.find((e) => e.id === item.id)}
            />
          ))}
        </div>
        {data && tab === "elegibles" && data.eligible.length > 0 && data.eligible.length < 5 && (
          <p className="mt-6 text-center text-sm text-muted">
            Encontramos pocas coincidencias. Probá sumar roles, quitar alguna condición indispensable o mirar las búsquedas por confirmar.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- tarjeta ---------- */

function JobCard({
  item,
  position,
  saved,
  onSave,
  onDiscard,
  onRemoveExternal,
  external,
}: {
  item: RankedItem;
  position: number;
  saved: boolean;
  onSave: () => void;
  onDiscard: (r: DiscardReason) => void;
  onRemoveExternal?: () => void;
  external?: ExternalJob;
}) {
  const router = useRouter();
  const [discarding, setDiscarding] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [err, setErr] = useState("");
  const main = item.sources.find((s) => s.kind === "ats") ?? item.sources[0];
  const required = item.sources.filter((s) => s.required);
  const tone = item.score >= 70 ? "bg-sage-soft text-sage" : item.score >= 45 ? "bg-honey/20 text-ink" : "bg-sand text-muted";

  async function prepare() {
    setErr("");
    setPreparing(true);
    try {
      let jobUrl = main?.applyUrl || main?.url || "";
      let jobText = external?.text ?? "";
      if (!item.external) {
        const res = await fetch(`/api/match/oportunidad?id=${encodeURIComponent(item.id)}`);
        const d = (await res.json()) as { url?: string; text?: string; error?: string };
        if (!res.ok) throw new Error(d.error ?? "No pudimos abrir esta búsqueda.");
        jobUrl = d.url || jobUrl;
        jobText = d.text ?? "";
      }
      handoffToPostulacion({ jobUrl: jobUrl.startsWith("maru:") ? "" : jobUrl, jobText, title: item.title, company: item.company });
      track("match_preparar_postulacion", { posicion: position, fuente: main?.kind ?? "" });
      router.push("/postulacion");
    } catch (e) {
      setErr((e as Error).message);
      setPreparing(false);
    }
  }

  return (
    <article className="rounded-3xl border border-line bg-paper p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-snug tracking-tight sm:text-2xl">{item.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {[item.company, item.locations.slice(0, 2).join(" · ") || null, item.workplace !== "desconocido" ? item.workplaceLabel : "Modalidad no informada"].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {item.seniority && <span className="rounded-full bg-sand px-2.5 py-1">{SENIORITY_LABEL[item.seniority]}</span>}
            <span className="rounded-full bg-sand px-2.5 py-1">{FAMILY_LABEL[item.family]}</span>
            {item.external && <span className="rounded-full bg-sage-soft px-2.5 py-1 text-sage">Agregada por vos · privada</span>}
            {item.status === "cerrada" && <span className="rounded-full bg-danger-soft px-2.5 py-1 text-danger-dark">Ya no figura en la fuente</span>}
          </div>
        </div>
        <div className={`shrink-0 rounded-2xl px-4 py-2 text-center ${tone}`} title="Compatibilidad estimada a partir de tu perfil y lo que buscás. No es una probabilidad de contratación.">
          <p className="font-display text-2xl leading-none">{item.score}%</p>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-wide">Compatibilidad estimada</p>
          <p className="text-[11px]">Información {item.confidence === "alta" ? "completa" : item.confidence === "media" ? "parcial" : "escasa"}</p>
        </div>
      </div>

      {item.reasons.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">Por qué te la mostramos</p>
          <ul className="mt-1.5 space-y-1 text-sm leading-relaxed">
            {item.reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        </div>
      )}
      {(item.gaps.length > 0 || item.pending.length > 0) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {item.gaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-danger">Brechas</p>
              <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-muted">
                {item.gaps.map((g) => (
                  <li key={g}>• {g}</li>
                ))}
              </ul>
            </div>
          )}
          {item.pending.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-honey">Para confirmar</p>
              <ul className="mt-1.5 space-y-1 text-sm leading-relaxed text-muted">
                {item.pending.map((g) => (
                  <li key={g}>• {g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted">Salario:</dt>
          <dd>{item.salary ?? "No informado"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">{item.reviewedLabel}:</dt>
          <dd>{fmtDate(item.reviewedAt)}</dd>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <dt className="text-muted">Fuente:</dt>
          <dd className="min-w-0">
            {item.sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 && " · "}
                {s.kind === "usuario" ? (
                  "Agregada por vos"
                ) : (
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" onClick={() => track("match_ver_busqueda", { fuente: s.kind })} className="underline decoration-line underline-offset-4 hover:text-brand">
                    {s.attribution ?? s.name.replace(/ (Job Board API|Postings API|Public Job Posting API)$/, "")}
                  </a>
                )}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      {err && <p className="mt-3 text-sm text-brand-dark">{err}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={prepare}
          disabled={preparing}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-paper transition hover:bg-brand-dark disabled:bg-muted/40"
        >
          {preparing ? "Abriendo…" : "Preparar mi postulación"}
        </button>
        {main && main.kind !== "usuario" && (
          <a
            href={(required[0] ?? main).url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={() => track("match_ver_busqueda", { fuente: (required[0] ?? main).kind })}
            className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium transition hover:border-brand hover:text-brand"
          >
            Ver búsqueda
          </a>
        )}
        {external?.url && (
          <a href={external.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full border border-line bg-paper px-5 py-2.5 text-sm font-medium transition hover:border-brand hover:text-brand">
            Ver búsqueda
          </a>
        )}
        <button type="button" onClick={onSave} aria-pressed={saved} className={`rounded-full border px-4 py-2.5 text-sm transition ${saved ? "border-sage bg-sage-soft text-sage" : "border-line bg-paper hover:border-brand"}`}>
          {saved ? "Guardada ✓" : "Guardar"}
        </button>
        {onRemoveExternal ? (
          <button type="button" onClick={onRemoveExternal} className="px-3 py-2.5 text-sm text-muted hover:text-brand-dark">
            Quitar
          </button>
        ) : (
          <button type="button" onClick={() => setDiscarding((x) => !x)} className="px-3 py-2.5 text-sm text-muted hover:text-brand-dark">
            Descartar
          </button>
        )}
      </div>
      {discarding && (
        <div className="mt-3 rounded-2xl bg-sand p-4">
          <p className="text-sm font-medium">¿Por qué la descartás? Lo usamos para ordenar mejor.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DISCARD_REASONS.map(([r, label]) => (
              <button key={r} type="button" onClick={() => onDiscard(r)} className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm transition hover:border-brand">
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

/* ---------- filtros ---------- */

function FilterPanel({ filters, setFilters }: { filters: Filters; setFilters: (f: Filters) => void }) {
  const families = useMemo(() => (Object.entries(FAMILY_LABEL) as [RoleFamily, string][]).filter(([k]) => k !== "otros"), []);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters({ ...filters, [k]: v });
  return (
    <div className="mt-4 space-y-4 rounded-3xl border border-line bg-paper p-5">
      <div>
        <p className="mb-2 text-sm font-medium">Área</p>
        <MultiChips value={filters.families ?? []} onChange={(v) => set("families", v)} options={families} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium">Modalidad</p>
          <MultiChips value={filters.workplaces ?? []} onChange={(v) => set("workplaces", v as Workplace[])} options={WORKPLACE_OPTIONS} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Seniority</p>
          <MultiChips value={filters.seniorities ?? []} onChange={(v) => set("seniorities", v)} options={Object.entries(SENIORITY_LABEL) as [Seniority, string][]} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-2 block font-medium">Ubicación</span>
          <input value={filters.location ?? ""} onChange={(e) => set("location", e.target.value || undefined)} className={inputClass} placeholder="Ej.: Córdoba" />
        </label>
        <label className="text-sm">
          <span className="mb-2 block font-medium">Idioma</span>
          <select value={filters.language ?? ""} onChange={(e) => set("language", (e.target.value || undefined) as Filters["language"])} className={inputClass}>
            <option value="">Todos</option>
            <option value="sin_ingles">Sin requisito de inglés</option>
            <option value="con_ingles">Piden inglés</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-2 block font-medium">Publicadas</span>
          <select value={filters.maxAgeDays ?? ""} onChange={(e) => set("maxAgeDays", e.target.value ? Number(e.target.value) : undefined)} className={inputClass}>
            <option value="">Cualquier fecha</option>
            <option value="7">Última semana</option>
            <option value="30">Último mes</option>
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!filters.salaryPublished} onChange={(e) => set("salaryPublished", e.target.checked || undefined)} className="h-4 w-4 accent-[var(--color-brand)]" />
        Sólo con salario publicado
      </label>
    </div>
  );
}

/* ---------- agregar búsqueda externa ---------- */

function AddExternal({ onClose, onAdd }: { onClose: () => void; onAdd: (j: ExternalJob) => void }) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [needsText, setNeedsText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await post<{ job: { title: string; company: string; url: string; text: string; location: string } | null; acceptedText?: boolean }>("/api/match/externa", {
        url: url.trim() || undefined,
        text: needsText ? text : undefined,
      });
      const job = res.job;
      onAdd({
        id: `u-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        title: job?.title || title.trim() || "Búsqueda agregada",
        company: job?.company || company.trim(),
        url: job?.url || url.trim(),
        text: job?.text || text.trim(),
        location: job?.location || "",
        addedAt: new Date().toISOString(),
      });
      track("match_busqueda_externa", { fuente: job ? "ats" : "texto" });
      onClose();
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "NEEDS_TEXT") setNeedsText(true);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-3xl border border-brand/40 bg-paper p-5">
      <p className="font-medium">Agregar una búsqueda que encontraste</p>
      <p className="text-sm text-muted">Queda privada, sólo en tu navegador. Si el link es de Greenhouse, Lever o Ashby la leemos sola; si no, pegá la descripción.</p>
      <input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={inputClass} aria-label="Link de la búsqueda" />
      {needsText ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Puesto" className={inputClass} aria-label="Puesto" />
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa" className={inputClass} aria-label="Empresa" />
          </div>
          <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pegá la descripción completa de la búsqueda." className={`${inputClass} text-sm`} />
        </>
      ) : (
        <button type="button" onClick={() => setNeedsText(true)} className="text-sm text-muted underline underline-offset-4 hover:text-brand">
          No tengo link: pegar la descripción
        </button>
      )}
      {error && <p className="text-sm text-danger-dark">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || (!url.trim() && text.trim().length < 200)}
          className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-paper transition hover:bg-brand-dark disabled:bg-muted/40"
        >
          {busy ? "Leyendo…" : "Agregar"}
        </button>
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-muted hover:text-ink">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ---------- estados ---------- */

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy aria-label="Buscando oportunidades">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-3xl bg-sand" />
      ))}
    </div>
  );
}

function EmptyInventory() {
  return (
    <div className="rounded-3xl border border-line bg-paper p-8 text-center">
      <p className="font-display text-2xl">Estamos cargando las primeras búsquedas</p>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
        El inventario se actualiza una vez por día desde fuentes públicas y gratuitas. Mientras tanto, tu perfil y lo que buscás quedan guardados en este navegador, y podés agregar una búsqueda que ya
        tengas para ver qué tan compatible es.
      </p>
    </div>
  );
}

function EmptyResults({ tab, hasFilters, pending, onShowPending, onClearFilters }: { tab: Tab; hasFilters: boolean; pending: number; onShowPending: () => void; onClearFilters: () => void }) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-8 text-center">
      <p className="font-display text-2xl">{tab === "guardadas" ? "Todavía no guardaste búsquedas" : "No encontramos coincidencias con estas condiciones"}</p>
      {tab !== "guardadas" && (
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          {hasFilters && (
            <button type="button" onClick={onClearFilters} className="rounded-full border border-line px-4 py-2 hover:border-brand">
              Quitar filtros
            </button>
          )}
          {tab === "elegibles" && pending > 0 && (
            <button type="button" onClick={onShowPending} className="rounded-full border border-line px-4 py-2 hover:border-brand">
              Ver {pending} por confirmar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
