"use client";
import { useState } from "react";
import type { BillingEvent } from "@/lib/billing/log";

type Diagnostics = { ready: boolean; missing: string[]; tokenKind: string; account: { ok: boolean; site?: string; error?: string }; events: BillingEvent[] };
/** Estado del cobro: credenciales, conexión con Mercado Pago y las últimas notificaciones recibidas. */
export default function BillingDiagnostics() {
  const [d, setD] = useState<Diagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/billing/admin", { cache: "no-store" });
      if (!res.ok) throw new Error("No pudimos consultar el cobro.");
      setD(await res.json());
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-line bg-paper p-5 sm:p-6">
    <h2 className="font-display text-xl">Cobros con Mercado Pago</h2>
    <p className="mt-2 text-sm text-muted">Revisa las credenciales y muestra las últimas 30 notificaciones y actualizaciones de estado, sin emails ni datos de pago. Si un pago aprobado no aparece acá como notificación, Mercado Pago no está avisando a <code>/api/billing/webhook</code>.</p>
    <button type="button" disabled={busy} onClick={() => void load()} className="mt-3 rounded-full border border-line px-4 py-2 text-sm disabled:opacity-40">{busy ? "Consultando…" : d ? "Volver a consultar" : "Consultar cobros"}</button>
    {error && <p role="alert" className="mt-3 text-sm text-danger-dark">{error}</p>}
    {d && <div className="mt-4 space-y-3 text-sm">
      <dl>
        <Row label="Cobro habilitado" value={d.ready ? "Sí" : `No. Falta: ${d.missing.join(", ")}`} />
        <Row label="Credencial" value={d.tokenKind} />
        <Row label="Conexión con Mercado Pago" value={d.account.ok ? `Responde (sitio ${d.account.site ?? "sin dato"})` : d.account.error ?? "Sin respuesta"} />
      </dl>
      {d.events.length === 0 ? <p className="text-muted">Todavía no llegó ninguna notificación ni se actualizó ningún estado desde que existe este registro.</p>
        : <ul className="space-y-2">{d.events.map((e, i) => <li key={`${e.at}-${i}`} className="border-t border-line pt-2">
          <p><span className="font-medium">{e.source === "webhook" ? "Notificación" : "Actualizar estado"}</span>{e.type ? ` · ${e.type}` : ""} · {e.result}</p>
          <p className="text-xs text-muted">{new Date(e.at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23" })}{e.detail ? ` · ${e.detail}` : ""}</p>
        </li>)}</ul>}
    </div>}
  </section>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 border-b border-line py-1"><dt>{label}</dt><dd className="text-right">{value}</dd></div>;
}
