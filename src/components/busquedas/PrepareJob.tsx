"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { handoffJob, type HandoffTarget } from "@/lib/match/clientStore";

/** Lleva esta búsqueda (link y texto completo) a otra herramienta de Maru, lista para usar. */
export default function PrepareJob({ id, to, children, className }: { id: string; to: HandoffTarget; children: React.ReactNode; className: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function go() {
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`/api/match/oportunidad?id=${encodeURIComponent(id)}`);
      const d = (await res.json()) as { url?: string; text?: string; title?: string; company?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? "No pudimos abrir esta búsqueda.");
      handoffJob(to, { jobUrl: d.url ?? "", jobText: d.text ?? "", title: d.title ?? "", company: d.company ?? "" });
      router.push(`/${to}#empezar`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={go} disabled={busy} className={className}>
        {busy ? "Abriendo…" : children}
      </button>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </>
  );
}
