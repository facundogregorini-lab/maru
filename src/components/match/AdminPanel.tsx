"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import LoginDialog from "../auth/LoginDialog";
import { FAMILY_LABEL, SENIORITY_LABEL } from "@/lib/match/labels";
import type { coverageMetrics } from "@/lib/match/metrics";
import { ErrorBanner, inputClass, post } from "../ui";

type Metrics = ReturnType<typeof coverageMetrics>;

const STATE_LABEL: Record<string, string> = {
  integrada: "Integradas con vacantes elegibles o por confirmar",
  sin_vacantes_elegibles: "Verificadas sin vacantes elegibles hoy",
  fallida: "Con error en la última sincronización",
  pendiente_primera_sync: "Pendientes de la primera sincronización",
  excluida: "No integrables",
};
const ELIG_LABEL: Record<string, string> = { elegible: "Elegibles", por_confirmar: "Por confirmar", no_elegible: "No elegibles (excluidas del ranking)" };
const WP_LABEL: Record<string, string> = { remoto: "Remoto", hibrido: "Híbrido", presencial: "Presencial", desconocido: "Sin dato" };

/** Panel sencillo de cobertura y calidad. Sólo cifras reales del inventario. */
export default function AdminPanel() {
  const { email } = useAuth();
  const [m, setM] = useState<Metrics | null>(null);
  const [status, setStatus] = useState<"cargando" | "ok" | "login" | "prohibido" | "error">("cargando");
  const [login, setLogin] = useState(false);

  useEffect(() => {
    if (email === undefined) return;
    fetch("/api/match/admin/metricas")
      .then(async (r) => {
        if (r.status === 401) return setStatus("login");
        if (r.status === 403) return setStatus("prohibido");
        if (!r.ok) return setStatus("error");
        setM(await r.json());
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [email]);

  if (status === "cargando") return <p className="py-20 text-center text-muted">Cargando…</p>;
  if (status === "login")
    return (
      <div className="py-20 text-center">
        <p className="font-serif text-2xl">Ingresá con tu email de administración</p>
        <button type="button" onClick={() => setLogin(true)} className="mt-4 rounded-full bg-clay px-6 py-2.5 text-paper">
          Ingresar
        </button>
        <LoginDialog open={login} reason="ver el panel" onClose={() => setLogin(false)} onLoggedIn={() => setLogin(false)} />
      </div>
    );
  if (status === "prohibido") return <p className="py-20 text-center text-muted">Tu cuenta no tiene permisos de administración (ADMIN_EMAILS).</p>;
  if (status === "error" || !m) return <ErrorBanner message="No pudimos cargar las métricas." />;

  const elig = m.eligibility as Record<string, number>;
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clay">Encontrá tu trabajo perfecto</p>
        <h1 className="mt-1 font-serif text-3xl tracking-tight">Cobertura y calidad del inventario</h1>
        <p className="mt-2 text-sm text-muted">
          {m.generatedAt ? `Última sincronización completa: ${new Date(m.generatedAt).toLocaleString("es-AR")}.` : "Todavía no corrió ninguna sincronización."} Son conteos del inventario propio: no son un
          porcentaje del mercado laboral.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Oportunidades únicas abiertas" value={m.uniqueOpen} />
        <Stat label="Publicaciones abiertas" value={m.postingsOpen} />
        <Stat label="Duplicados fusionados" value={m.duplicatesMerged} />
        <Stat label="Con salario publicado" value={m.withSalary} />
      </div>

      <Section title="Elegibilidad desde Argentina">
        <Bars data={elig} labels={ELIG_LABEL} />
      </Section>

      <Section title="Fuentes">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 font-medium">Fuente</th>
                <th className="font-medium">Estado</th>
                <th className="font-medium">Avisos abiertos</th>
                <th className="font-medium">Aporte exclusivo</th>
                <th className="font-medium">Límites</th>
              </tr>
            </thead>
            <tbody>
              {m.sources.map((s) => (
                <tr key={s.id} className="border-t border-line align-top">
                  <td className="py-2 pr-3">{s.name}</td>
                  <td className="pr-3">{s.active ? "Activa" : s.status.replace(/_/g, " ")}</td>
                  <td className="pr-3">{s.postingsOpen}</td>
                  <td className="pr-3">{s.exclusive}</td>
                  <td className="text-xs text-muted">{s.limits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Empresas del directorio (${m.companies.total})`}>
        <Bars data={m.companies.byState as Record<string, number>} labels={STATE_LABEL} />
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-clay-dark">Ver el listado</summary>
          <ul className="mt-3 space-y-1 text-sm">
            {m.companies.list.map((c) => (
              <li key={`${c.name}-${c.evidence}`} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted">· {STATE_LABEL[c.state] ?? c.state}</span>
                {"relevant" in c && c.state !== "excluida" && <span className="text-muted">· {c.relevant} relevantes de {c.open}</span>}
                {"reason" in c && c.reason && <span className="text-muted">· {c.reason}</span>}
                {"lastError" in c && c.lastError && <span className="text-clay-dark">· {c.lastError}</span>}
              </li>
            ))}
          </ul>
        </details>
      </Section>

      <div className="grid gap-6 sm:grid-cols-3">
        <Section title="Por área">
          <Bars data={m.byFamily as Record<string, number>} labels={FAMILY_LABEL} />
        </Section>
        <Section title="Por seniority">
          <Bars data={m.bySeniority as Record<string, number>} labels={{ ...SENIORITY_LABEL, sin_dato: "Sin dato" }} />
        </Section>
        <Section title="Por modalidad">
          <Bars data={m.byWorkplace as Record<string, number>} labels={WP_LABEL} />
          <p className="mt-3 text-sm text-muted">
            Descripciones completas: {(m.description as Record<string, number>).completa ?? 0} · parciales: {(m.description as Record<string, number>).parcial ?? 0}
          </p>
        </Section>
      </div>

      {m.lastRun && (
        <Section title="Última ejecución">
          <p className="text-sm">
            {m.lastRun.mode} · nuevas {m.lastRun.created} · actualizadas {m.lastRun.updated} · sin cambios {m.lastRun.unchanged} · cerradas {m.lastRun.closed} · errores {m.lastRun.errors}
          </p>
          {m.lastRun.failedBoards.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-clay-dark">
              {m.lastRun.failedBoards.map((b) => (
                <li key={b.boardId}>
                  {b.boardId}: {b.error}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <AddCompany />
    </div>
  );
}

function AddCompany() {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ received: number; counts: Record<string, number>; entry: unknown; alreadyInDirectory: boolean } | null>(null);

  async function validate() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await post("/api/match/admin/empresa", { url, name: name || undefined }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Agregar una empresa">
      <p className="mb-3 text-sm text-muted">Pegá la URL de su bolsa en Greenhouse, Lever o Ashby. Validamos el conector con la API pública y te damos la entrada para el directorio.</p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://job-boards.greenhouse.io/empresa" className={inputClass} aria-label="URL de la bolsa" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" className={inputClass} aria-label="Nombre" />
        <button type="button" onClick={validate} disabled={busy || !url} className="rounded-full bg-clay px-5 py-2.5 text-sm font-medium text-paper disabled:bg-muted/40">
          {busy ? "Validando…" : "Validar"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-clay-dark">{error}</p>}
      {result && (
        <div className="mt-4 rounded-2xl bg-sand p-4 text-sm">
          <p>
            {result.alreadyInDirectory ? "Ya está en el directorio. " : ""}La API respondió con {result.received} avisos: {result.counts.elegible} elegibles, {result.counts.por_confirmar} por confirmar y{" "}
            {result.counts.no_elegible} no elegibles.
          </p>
          {!result.alreadyInDirectory && (
            <>
              <p className="mt-2 text-muted">
                Para sumarla, corré <code>npm run match:add-company -- {url}</code> o agregá esta entrada en <code>data/match/companies.json</code>:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-paper p-3 text-xs">{JSON.stringify(result.entry, null, 2)}</pre>
            </>
          )}
        </div>
      )}
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="font-serif text-3xl">{value.toLocaleString("es-AR")}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-paper p-5 sm:p-6">
      <h2 className="mb-3 font-serif text-xl tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function Bars({ data, labels }: { data: Record<string, number>; labels: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-sm text-muted">Sin datos todavía.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {entries.map(([k, v]) => (
        <li key={k}>
          <div className="flex justify-between gap-3">
            <span>{labels[k] ?? k}</span>
            <span className="tabular-nums text-muted">{v}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-sand">
            <div className="h-1.5 rounded-full bg-clay" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
