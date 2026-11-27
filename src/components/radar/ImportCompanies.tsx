"use client";

import { useEffect, useMemo, useState } from "react";
import { capture } from "@/lib/tracking/posthog";
import { FIELD_LABEL, applyImport, parseSheets, planSheets, previewImport, type CompanyField, type SheetPlan } from "@/lib/radar/importer";
import type { Sheet } from "@/lib/radar/table";
import { loadRadar } from "@/lib/radar/store";
import { Drawer, Note, btn, btnNeon, field, label } from "./RadarUi";
import { useRadar } from "./useRadar";

type Step = "archivo" | "mapeo" | "listo";

/** Campos que se muestran en el mapeo (los demás se detectan solos). */
const MAPPED: CompanyField[] = ["name", "careersUrl", "hq", "region", "stage", "employees", "activity", "areas", "rank", "sources", "notes", "linkStatus", "industry", "domain"];

export default function ImportCompanies({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const { state, update } = useRadar();
  const [step, setStep] = useState<Step>("archivo");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [plans, setPlans] = useState<SheetPlan[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggest, setSuggest] = useState(false);
  const [mergeConflicts, setMergeConflicts] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  useEffect(() => {
    if (open) return;
    setStep("archivo");
    setSheets([]);
    setPlans([]);
    setError("");
    setFileName("");
    setShowMapping(false);
  }, [open]);

  const parsed = useMemo(() => (sheets.length ? parseSheets(sheets, plans) : null), [sheets, plans]);
  const preview = useMemo(() => (parsed ? previewImport(parsed, state) : null), [parsed, state]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const { MAX_FILE_BYTES, parseCsv, parseXlsx } = await import("@/lib/radar/table");
      if (file.size > MAX_FILE_BYTES) throw new Error("El archivo pesa más de 8 MB. Exportá sólo las pestañas de empresas.");
      const lower = file.name.toLowerCase();
      let read: Sheet[];
      if (lower.endsWith(".xlsx")) read = await parseXlsx(await file.arrayBuffer());
      else if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) read = [parseCsv(await file.text(), file.name.replace(/\.[^.]+$/, ""))];
      else throw new Error("Subí un .xlsx (Excel o Google Sheets → Descargar → .xlsx) o un .csv.");
      const p = planSheets(read);
      if (!p.some((x) => x.usable)) throw new Error("No encontramos una columna «Empresa» en ninguna pestaña. Revisá que el archivo tenga encabezados.");
      setSheets(read);
      setPlans(p);
      setFileName(file.name);
      setStep("mapeo");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos leer el archivo.");
    } finally {
      setBusy(false);
    }
  };

  const setCol = (si: number, f: CompanyField, col: number) => {
    setPlans((ps) => ps.map((p, i) => (i === si ? { ...p, mapping: { ...p.mapping, [f]: col < 0 ? undefined : col } } : p)));
  };
  const setIndustry = (si: number, value: string) => setPlans((ps) => ps.map((p, i) => (i === si ? { ...p, industry: value.slice(0, 40) } : p)));
  const toggleSheet = (si: number, usable: boolean) => setPlans((ps) => ps.map((p, i) => (i === si ? { ...p, usable: usable && p.headerRow >= 0 } : p)));

  const confirm = () => {
    if (!parsed) return;
    const before = loadRadar();
    const result = applyImport(before, parsed, { suggestPriority: suggest, mergeConflicts });
    update(() => result.state);
    capture("radar_import_completed", { nuevas: result.created, actualizadas: result.updated, vacantes: result.jobs, source: "radar" });
    const parts = [`${result.created} nuevas`, `${result.updated} actualizadas`];
    if (result.unchanged) parts.push(`${result.unchanged} sin cambios`);
    onDone(`Importación lista: ${parts.join(", ")}.`);
    setStep("listo");
    onClose();
  };

  return (
    <Drawer title="Importar empresas" open={open} onClose={onClose} wide>
      {step === "archivo" && (
        <div>
          <p className="mb-4 text-sm text-muted">
            Subí tu planilla de research en Excel (.xlsx) o CSV. Si está en Google Sheets: Archivo → Descargar → Microsoft Excel. Cada pestaña se toma como un sector y las empresas repetidas entre pestañas quedan una sola vez.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface-5 px-4 py-10 text-center hover:border-black/25">
            <span className="text-sm font-semibold">{busy ? "Leyendo el archivo…" : "Elegí el archivo"}</span>
            <span className="text-xs text-muted">.xlsx o .csv, hasta 8 MB. No se sube a ningún servidor: se lee en tu navegador.</span>
            <input type="file" accept=".xlsx,.csv,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger-dark">
              {error}
            </p>
          )}
        </div>
      )}

      {step === "mapeo" && preview && parsed && (
        <div>
          <p className="mb-3 text-sm">
            <b>{fileName}</b>
          </p>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Box n={preview.unique.length} t="Empresas únicas" />
            <Box n={preview.create.length} t="Nuevas" />
            <Box n={preview.merge.length} t="Ya las seguís" />
            <Box n={preview.duplicatesInFile} t="Repetidas entre pestañas" />
          </div>

          <section className="mb-4">
            <h3 className="mb-2 text-sm font-bold">Pestañas</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {plans.map((p, si) => {
                const rows = preview.bySheet.find((b) => b.sheet === p.sheet)?.rows ?? 0;
                return (
                  <li key={p.sheet + si} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                    <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-[#00a975]" checked={p.usable} disabled={p.headerRow < 0} onChange={(e) => toggleSheet(si, e.target.checked)} />
                      <span className="truncate font-semibold">{p.sheet}</span>
                    </label>
                    {p.headerRow < 0 ? (
                      <span className="text-xs text-muted">Sin columna «Empresa»: se omite</span>
                    ) : (
                      <>
                        <span className="text-xs text-muted">{rows} filas de empresas</span>
                        <label className="flex items-center gap-1.5 text-xs">
                          Sector
                          <input className={`${field} w-36`} value={p.industry} onChange={(e) => setIndustry(si, e.target.value)} aria-label={`Sector de la pestaña ${p.sheet}`} />
                        </label>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted">
              {parsed.jobs.length} vacantes del piloto se guardan como dato histórico (sin vigencia verificada). {parsed.ignoredCoverage > 0 && `${parsed.ignoredCoverage} filas de cobertura se ignoran.`}
            </p>
          </section>

          <button type="button" className={`${btn} mb-3`} aria-expanded={showMapping} onClick={() => setShowMapping((v) => !v)}>
            {showMapping ? "Ocultar columnas" : "Revisar columnas"}
          </button>
          {showMapping && (
            <section className="mb-4 flex flex-col gap-4">
              {plans.map((p, si) =>
                p.usable ? (
                  <div key={p.sheet + si} className="rounded-xl border border-line p-3">
                    <h4 className="mb-2 text-sm font-bold">{p.sheet}</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {MAPPED.map((f) => (
                        <label key={f} className="flex items-center justify-between gap-2 text-xs">
                          <span className={label + " mb-0"}>{FIELD_LABEL[f]}</span>
                          <select className={`${field} w-44`} value={p.mapping[f] ?? -1} onChange={(e) => setCol(si, f, Number(e.target.value))}>
                            <option value={-1}>— No importar —</option>
                            {p.headers.map((h, i) => (
                              <option key={i} value={i}>
                                {h || `Columna ${i + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}
            </section>
          )}

          {preview.conflicts.length > 0 && (
            <section className="mb-4">
              <h3 className="mb-2 text-sm font-bold">Para revisar ({preview.conflicts.length})</h3>
              <ul className="mb-2 flex flex-col gap-1 text-xs text-muted">
                {preview.conflicts.slice(0, 10).map((c) => (
                  <li key={c.company.sheet + c.company.row}>{c.reason}</li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[#00a975]" checked={mergeConflicts} onChange={(e) => setMergeConflicts(e.target.checked)} />
                Son la misma empresa: sumar los datos a la que ya sigo
              </label>
            </section>
          )}

          {preview.errors.length > 0 && (
            <section className="mb-4">
              <h3 className="mb-2 text-sm font-bold">Avisos ({preview.errors.length})</h3>
              <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-muted">
                {preview.errors.slice(0, 30).map((e) => (
                  <li key={`${e.sheet}-${e.row}-${e.message}`}>
                    {e.sheet}, fila {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Note>
            Las empresas que ya seguís conservan su prioridad, orden y notas: sólo se suman sectores y datos que faltaban. Las nuevas entran sin clasificar, salvo que elijas la prioridad sugerida.
          </Note>
          <label className="mb-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#00a975]" checked={suggest} onChange={(e) => setSuggest(e.target.checked)} />
            <span>Asignar prioridad sugerida a las nuevas según el ranking del archivo: las primeras 20 como P1, las 100 siguientes como P2 y el resto como P3.</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnNeon} onClick={confirm} disabled={!preview.create.length && !preview.merge.length && !(mergeConflicts && preview.conflicts.length) && !parsed.jobs.length}>
              Importar {preview.create.length} nuevas
            </button>
            <button type="button" className={btn} onClick={() => setStep("archivo")}>
              Elegir otro archivo
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Box({ n, t }: { n: number; t: string }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="text-xl font-extrabold">{n}</p>
      <p className="text-xs text-muted">{t}</p>
    </div>
  );
}
