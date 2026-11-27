"use client";

import { useEffect, useState } from "react";
import { COMPANY_FIELD_LABELS, JOB_FIELD_LABELS, type CompanyField, type JobField } from "@/lib/radar/fields";
import { radarApi } from "./api";
import { Drawer, Notice, Tag, btnDark, btnGhost, field } from "./ui";

type Col<T> = { index: number; header: string; field: T };
type Tab = {
  name: string;
  industry: string;
  companyColumns: Col<CompanyField>[] | null;
  jobColumns: Col<JobField>[] | null;
  sections: { label: string; rows: number }[];
  companyRows: number;
  jobRows: number;
  coverageRows: number;
  ignoredRows: number;
};
type Preview = {
  step: "preview" | "confirm";
  tabs: Tab[];
  companies: { id: string; name: string; identity: string; domain: string | null; industries: string[]; rows: number; isNew: boolean; changed: boolean; following: boolean }[];
  totals: { rows: number; unique: number; newCompanies: number; updatedCompanies: number; targetsCreated: number; targetsKept: number; pilotJobs: number; ignoredRows: number; errors: number };
  pilotSample: { company: string; title: string; editorialScore: number | null; date: string }[];
  notices: { kind: string; message: string }[];
  errors: { tab: string; row: number; message: string }[];
};
type Overrides = Record<string, { companies?: Record<number, CompanyField>; jobs?: Record<number, JobField> }>;

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1OZf2mWFzyqTT3wMCO5ngHU1HQH8787sHdvDQS3YrRZQ/edit";

/** Importar empresas: archivo → vista previa con mapeo, dedup, conflictos y errores → confirmación. */
export default function ImportDrawer({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (msg: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [industries, setIndustries] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [working, setWorking] = useState<"preview" | "confirm" | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreview(null);
      setOverrides({});
      setIndustries({});
      setError("");
      setDirty(false);
    }
  }, [open]);

  async function send(step: "preview" | "confirm") {
    if (!file) return;
    setWorking(step);
    setError("");
    const form = new FormData();
    form.set("file", file);
    form.set("step", step);
    form.set("overrides", JSON.stringify(overrides));
    form.set("industries", JSON.stringify(industries));
    try {
      const r = await radarApi<Preview>("/api/radar/importar", { method: "POST", form });
      setPreview(r);
      setDirty(false);
      if (step === "confirm") {
        const t = r.totals;
        await onImported(`Importación lista: ${t.targetsCreated} empresas nuevas en tu lista, ${t.targetsKept} ya estaban.`);
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el archivo.");
    } finally {
      setWorking(null);
    }
  }

  const setField = (tab: string, kind: "companies" | "jobs", index: number, value: string) => {
    setOverrides((o) => ({ ...o, [tab]: { ...o[tab], [kind]: { ...o[tab]?.[kind], [index]: value } } }));
    setDirty(true);
  };

  const t = preview?.totals;

  return (
    <Drawer title="Importar empresas" open={open} onClose={onClose} wide>
      <p className="text-sm">
        Subí el export de Research Laboral (en Google Sheets: Archivo → Descargar → .xlsx) con las pestañas IA, Space y Tech Startups, o un .csv con una lista.
        No hace falta compartir la planilla.{" "}
        <a href={SHEET_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Abrir el Sheet</a>
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className={`${btnGhost} cursor-pointer focus-within:ring-2 focus-within:ring-ink`}>
          <input
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setOverrides({});
              setIndustries({});
            }}
          />
          Elegir archivo
        </label>
        <span className="min-w-0 truncate text-sm text-muted">{file ? file.name : "Ningún archivo elegido"}</span>
        <button type="button" className={btnDark} disabled={!file || !!working} onClick={() => void send("preview")}>
          {working === "preview" ? "Leyendo…" : preview ? "Actualizar vista previa" : "Ver vista previa"}
        </button>
      </div>

      {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}

      {preview && t && (
        <div className="mt-6 space-y-6">
          <section aria-labelledby="imp-resumen">
            <h3 id="imp-resumen" className="text-sm font-bold uppercase tracking-wide text-muted">Resumen</h3>
            <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
              <li><b>{t.unique}</b> empresas únicas (de {t.rows} filas)</li>
              <li><b>{t.newCompanies}</b> nuevas en el catálogo · <b>{t.updatedCompanies}</b> con datos completados</li>
              <li><b>{t.targetsCreated}</b> se suman a tu lista · <b>{t.targetsKept}</b> ya estaban (no se tocan)</li>
              <li><b>{t.pilotJobs}</b> vacantes del piloto, aparte</li>
              <li><b>{t.ignoredRows}</b> {t.ignoredRows === 1 ? "fila ignorada" : "filas ignoradas"} (cobertura, títulos)</li>
              <li className={t.errors ? "text-danger-dark" : ""}><b>{t.errors}</b> {t.errors === 1 ? "fila" : "filas"} con errores</li>
            </ul>
            <p className="mt-2 text-xs text-muted">Las empresas nuevas entran como «Por clasificar». Tus prioridades y notas no cambian.</p>
          </section>

          <section aria-labelledby="imp-pestanas">
            <h3 id="imp-pestanas" className="text-sm font-bold uppercase tracking-wide text-muted">Pestañas y columnas</h3>
            <div className="mt-2 space-y-4">
              {preview.tabs.map((tab) => (
                <div key={tab.name} className="rounded-xl p-3 ring-1 ring-black/[0.08]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{tab.name}</p>
                    <label className="ml-auto flex items-center gap-2 text-sm">
                      Sector
                      <input
                        value={industries[tab.name] ?? tab.industry}
                        onChange={(e) => {
                          setIndustries((x) => ({ ...x, [tab.name]: e.target.value }));
                          setDirty(true);
                        }}
                        className={`${field} w-40 py-1.5`}
                        maxLength={40}
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {tab.sections.map((s) => `${s.label}: ${s.rows}`).join(" · ") || "Sin secciones reconocidas"}
                  </p>
                  {(["companies", "jobs"] as const).map((kind) => {
                    const cols = kind === "companies" ? tab.companyColumns : tab.jobColumns;
                    if (!cols) return null;
                    const labels = (kind === "companies" ? COMPANY_FIELD_LABELS : JOB_FIELD_LABELS) as Record<string, string>;
                    return (
                      <details key={kind} className="mt-2" open={kind === "companies"}>
                        <summary className="cursor-pointer text-sm font-semibold">{kind === "companies" ? "Columnas de empresas" : "Columnas de vacantes del piloto"}</summary>
                        <table className="mt-2 w-full text-sm">
                          <thead className="text-left text-xs text-muted">
                            <tr><th scope="col" className="py-1 pr-2 font-semibold">En el archivo</th><th scope="col" className="py-1 font-semibold">Se importa como</th></tr>
                          </thead>
                          <tbody>
                            {cols.map((c) => (
                              <tr key={c.index}>
                                <td className="py-1 pr-2">{c.header}</td>
                                <td className="py-1">
                                  <select
                                    aria-label={`Columna «${c.header}» de ${tab.name}`}
                                    value={overrides[tab.name]?.[kind]?.[c.index] ?? c.field}
                                    onChange={(e) => setField(tab.name, kind, c.index, e.target.value)}
                                    className={`${field} py-1.5`}
                                  >
                                    {Object.entries(labels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </details>
                    );
                  })}
                </div>
              ))}
            </div>
            {dirty && <p className="mt-2 text-sm text-honey">Cambiaste el mapeo o el sector: actualizá la vista previa antes de importar.</p>}
          </section>

          {preview.notices.length > 0 && (
            <section aria-labelledby="imp-conflictos">
              <h3 id="imp-conflictos" className="text-sm font-bold uppercase tracking-wide text-muted">Fusiones y conflictos</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {preview.notices.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <Tag tone={n.kind === "conflicto" ? "warn" : "plain"}>{n.kind === "fusion" ? "Fusión" : n.kind === "conflicto" ? "Conflicto" : "Dato"}</Tag>
                    <span>{n.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview.errors.length > 0 && (
            <section aria-labelledby="imp-errores">
              <h3 id="imp-errores" className="text-sm font-bold uppercase tracking-wide text-danger-dark">Errores</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {preview.errors.map((e, i) => <li key={i}>{e.tab}, fila {e.row}: {e.message}</li>)}
              </ul>
            </section>
          )}

          <section aria-labelledby="imp-empresas">
            <h3 id="imp-empresas" className="text-sm font-bold uppercase tracking-wide text-muted">Empresas ({preview.companies.length})</h3>
            <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-xl text-sm ring-1 ring-black/[0.08]">
              {preview.companies.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="font-semibold">{c.name}</span>
                  {c.industries.map((i) => <Tag key={i}>{i}</Tag>)}
                  {c.rows > 1 && <span className="text-xs text-muted">{c.rows} filas unidas</span>}
                  <span className="ml-auto text-xs text-muted">
                    {c.following ? "Ya la seguís" : c.isNew ? "Nueva" : "En el catálogo"}
                    {c.identity === "provisoria" ? " · identidad provisoria" : c.domain ? ` · ${c.domain}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {t.pilotJobs > 0 && (
            <section aria-labelledby="imp-piloto">
              <h3 id="imp-piloto" className="text-sm font-bold uppercase tracking-wide text-muted">Vacantes del piloto</h3>
              <Notice>Piloto 25/11/2026 · vigencia no verificada. Se guardan aparte como históricas; el score es editorial, no el match de Radar.</Notice>
              <ul className="mt-2 space-y-1 text-sm">
                {preview.pilotSample.map((j, i) => (
                  <li key={i}>
                    <b>{j.company}</b> · {j.title}
                    {j.editorialScore !== null && <span className="text-muted"> · {j.editorialScore}/100 editorial</span>}
                  </li>
                ))}
                {t.pilotJobs > preview.pilotSample.length && <li className="text-muted">y {t.pilotJobs - preview.pilotSample.length} más</li>}
              </ul>
            </section>
          )}

          <div className="sticky bottom-0 -mx-5 flex flex-wrap gap-2 border-t border-line bg-white px-5 py-4">
            <button type="button" className={btnDark} disabled={!!working || dirty || t.unique + t.pilotJobs === 0} onClick={() => void send("confirm")}>
              {working === "confirm" ? "Importando…" : `Importar ${t.unique} empresas`}
            </button>
            <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
