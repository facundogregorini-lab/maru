"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLoginGate } from "@/components/auth/useLoginGate";
import { post } from "@/components/ui";
import type { JobQuery } from "@/lib/jobFilters";

/** "Avisame de búsquedas nuevas": guarda los filtros actuales como alerta diaria por email. */
export default function AlertButton({ query }: { query: JobQuery }) {
  const { db } = useAuth();
  const gate = useLoginGate();
  const [state, setState] = useState<"idle" | "busy" | "ok">("idle");
  const [error, setError] = useState("");
  if (!db) return null;

  async function save() {
    setError("");
    setState("busy");
    try {
      await post("/api/alertas", { ...query, pagina: undefined });
      setState("ok");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => gate.run("recibir alertas de búsquedas nuevas", save)}
        disabled={state !== "idle"}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-medium hover:bg-black/[0.05] disabled:opacity-70"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
        </svg>
        {state === "ok" ? "Te avisamos por email ✓" : state === "busy" ? "Guardando…" : "Avisame de nuevas"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
      {gate.dialog}
    </>
  );
}
