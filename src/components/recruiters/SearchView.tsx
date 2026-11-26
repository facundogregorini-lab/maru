"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { RecError, icpActual, recApi, type Snapshot } from "@/lib/recruiters/client";
import type { IcpEdit } from "@/lib/recruiters/types";
import Afinar from "./Afinar";
import IcpEditor from "./IcpEditor";
import Outreach from "./Outreach";
import Results from "./Results";

export default function SearchView({ id }: { id: string }) {
  const { email } = useAuth();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState("");
  const [showAfinar, setShowAfinar] = useState(false);
  const [vista, setVista] = useState<"candidatos" | "contacto">("candidatos");

  const act = useCallback(
    async (body: Record<string, unknown>) => {
      const s = await recApi<Snapshot>(`/busquedas/${id}`, { email, body });
      setSnap(s);
      return s;
    },
    [id, email],
  );

  useEffect(() => {
    if (email === undefined) return;
    if (email === null) return setError("Ingresá con Google para ver esta búsqueda.");
    recApi<Snapshot>(`/busquedas/${id}`, { email })
      .then((s) => { setSnap(s); setError(""); })
      .catch((err) => setError(err instanceof RecError ? err.message : "No pudimos cargar la búsqueda."));
  }, [id, email]);

  /** Evalúa los pendientes de a 3 por pedido, mostrando el avance. */
  const runEvaluations = useCallback(
    async (start: Snapshot) => {
      let s = start;
      try {
        while (s.pendientes > 0) {
          setWorking(`Maru está leyendo perfiles: ${s.pendientes} ${s.pendientes === 1 ? "pendiente" : "pendientes"}`);
          const before = s.pendientes;
          s = await act({ accion: "evaluar", max: 3 });
          if (s.pendientes >= before) break;
        }
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pudimos evaluar los perfiles.");
      } finally {
        setWorking("");
      }
    },
    [act],
  );

  async function wrap(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  if (!snap) {
    return (
      <div className="rounded-[20px] border border-line bg-white p-8 text-center">
        {error ? (
          <>
            <p role="alert" className="text-base font-semibold">{error}</p>
            <Link href="/recruiters" className="mt-3 inline-block text-sm underline underline-offset-4">Volver a tus búsquedas</Link>
          </>
        ) : (
          <p className="text-sm text-muted">Cargando la búsqueda…</p>
        )}
      </div>
    );
  }

  const b = snap.busqueda;
  const icp = icpActual(b);
  const modoIcp = b.borrador || editing;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/recruiters" className="self-start text-sm text-muted underline-offset-4 hover:underline">← Tus búsquedas</Link>
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-dark">{error}</p>}
      {modoIcp ? (
        <IcpEditor
          snap={snap}
          busy={busy}
          onCancel={!b.borrador ? () => setEditing(false) : undefined}
          onSave={(edit: IcpEdit) => wrap(async () => void (await act({ accion: "editar_icp", icp: edit })))}
          onAnswer={(preguntaId, respuesta) => wrap(async () => void (await act({ accion: "responder", preguntaId, respuesta })))}
          onApprove={(edit, dirty) =>
            wrap(async () => {
              if (dirty) await act({ accion: "editar_icp", icp: edit });
              const s = await act({ accion: "aprobar" });
              setEditing(false);
              if (s.pendientes > 0) void runEvaluations(s);
            })
          }
        />
      ) : (
        <>
          <div role="tablist" aria-label="Secciones de la búsqueda" className="flex gap-1.5">
            {([["candidatos", `Candidatos (${snap.candidatos.length})`], ["contacto", `Contacto${snap.outreach.inscripciones.some((i) => i.tarea) ? " · tareas" : ""}`]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={vista === k} onClick={() => setVista(k)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${vista === k ? "bg-ink text-white" : "border border-line bg-white"}`}>
                {label}
              </button>
            ))}
          </div>
          {vista === "contacto" && <Outreach snap={snap} act={act} />}
          {vista === "candidatos" && showAfinar && (
            <Afinar
              propuestas={b.propuestas}
              version={icp.version}
              busy={busy}
              onClose={() => setShowAfinar(false)}
              onApply={(aceptadas) =>
                wrap(async () => {
                  const s = await act({ accion: "aplicar", aceptadas });
                  setShowAfinar(false);
                  if (s.pendientes > 0) void runEvaluations(s);
                })
              }
            />
          )}
          {vista === "candidatos" && <Results
            snap={snap}
            act={act}
            working={working || (busy ? "Pensando ajustes al perfil…" : "")}
            runEvaluations={runEvaluations}
            onEditIcp={() => setEditing(true)}
            onPropose={() =>
              wrap(async () => {
                await act({ accion: "proponer" });
                setShowAfinar(true);
              })
            }
          />}
        </>
      )}
    </div>
  );
}
