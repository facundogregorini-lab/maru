"use client";
import { useState } from "react";
import { post } from "../ui";
import type { PilotProvider, PilotResult } from "@/lib/match/provider-pilot";
export default function ProviderPilot() {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Partial<Record<PilotProvider, PilotResult>>>({});
  const [error, setError] = useState("");
  async function run(provider: PilotProvider, action: "status" | "sample") {
    setBusy(true); setError("");
    try { const result = await post<PilotResult>("/api/match/admin/proveedores", { provider, action }); setResults((old) => ({ ...old, [provider]: result })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-line bg-paper p-5 sm:p-6">
    <h2 className="font-display text-xl">Pruebas de fuentes de avisos</h2>
    <p className="mt-2 text-sm text-muted">Consultas manuales para comparar cobertura y calidad desde Argentina. Las claves quedan en el servidor. Los resultados no se publican ni activan sincronizaciones. Tope global diario: dos muestras por proveedor y tres consultas de estado.</p>
    {error && <p role="alert" className="mt-3 text-sm text-danger-dark">{error}</p>}
    <div className="mt-5 grid gap-5 lg:grid-cols-2">{(["fantastic", "serp"] as const).map((provider) => <div key={provider} className="rounded-2xl border border-line p-4">
      <h3 className="font-medium">{provider === "fantastic" ? "Fantastic.jobs" : "SerpAPI · Google Jobs"}</h3>
      <p className="mt-1 text-xs text-muted">{provider === "fantastic" ? "Estado: cuatro conteos sin créditos de avisos. Muestra: hasta 50 créditos incluidos, ATS + job boards." : "Estado: cuota sin consumir búsquedas. Muestra: una búsqueda incluida, hasta 10 avisos."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => run(provider, "status")} className="rounded-full border border-line px-4 py-2 text-sm disabled:opacity-40">Consultar estado de {provider === "fantastic" ? "Fantastic" : "SerpAPI"}</button>
        <button type="button" disabled={busy} onClick={() => run(provider, "sample")} className="rounded-full bg-brand px-4 py-2 text-sm text-paper disabled:opacity-40">Probar muestra de {provider === "fantastic" ? "Fantastic" : "SerpAPI"}</button>
      </div>
      {results[provider] && <Result result={results[provider]} />}
    </div>)}</div>
    {busy && <p role="status" className="mt-3 text-sm text-muted">Consultando al proveedor… Puede demorar hasta tres minutos.</p>}
  </section>;
}
function Result({ result }: { result: PilotResult }) {
  return <div className="mt-4 space-y-3 text-sm">
    <p className="text-xs text-muted">{new Date(result.checkedAt).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23" })}</p>
    <dl>{Object.entries({ ...result.quota, ...result.counts }).map(([key, value]) => <div key={key} className="flex justify-between gap-3 border-b border-line py-1"><dt>{key}</dt><dd>{value ?? "Sin dato"}</dd></div>)}</dl>
    {result.summary && <p>Recibidos: {result.summary.received} · con datos suficientes: {result.summary.usable} · nuevos por URL: {result.summary.newUsable} · duplicados por URL: {result.summary.duplicates}. La comparación por URL puede no detectar todas las copias entre portales.</p>}
    <p className="text-xs text-muted">{result.note}</p>
    {result.jobs && <details open><summary className="cursor-pointer">Ver avisos y observaciones</summary><ul className="mt-3 space-y-3">{result.jobs.map((job, i) => <li key={`${job.id}-${i}`} className="border-t border-line pt-3">
      {job.url ? <a href={job.url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-dark underline">{job.title || "Sin título"}</a> : <strong>{job.title || "Sin título"}</strong>}
      <p>{job.company} · {job.location} · {job.source}</p><p className="text-xs text-muted">{job.descriptionChars} caracteres · {job.publishedAt || (job.publishedLabel ? `Fecha relativa: ${job.publishedLabel}` : "Fecha sin dato")}{job.duplicate ? " · URL repetida" : ""}</p>
      {job.issues.length > 0 && <p className="mt-1 text-danger-dark">{job.issues.join(". ")}</p>}
      <p className="mt-1 text-xs text-muted">{job.excerpt}</p>
    </li>)}</ul></details>}
  </div>;
}
