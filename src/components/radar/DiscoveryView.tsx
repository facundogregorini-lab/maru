"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { requestLogin } from "@/lib/loginRequest";
import { trackRadar } from "@/lib/radar/analytics";
import type { Company } from "@/lib/radar/types";
import { radarApi } from "./api";
import { EmptyState, Monogram, Notice, Skeleton, Tag, btnDark, btnGhost, card, useToast } from "./ui";

type Suggestion = { company: Company; reason: string; signals: { text: string; source: string; date: string }[]; careersUrl: string | null; pendingVerification: boolean };

/** Descubrimiento: hasta 10 empresas por semana que no seguís, con el motivo y sólo señales verificadas. */
export default function DiscoveryView() {
  const { email } = useAuth();
  const [data, setData] = useState<{ week: string; items: Suggestion[] } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!email) return;
    radarApi<{ week: string; items: Suggestion[] }>("/api/radar/descubrimiento")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "No pudimos cargar las sugerencias."));
  }, [email]);

  async function act(s: Suggestion, action: "P1" | "P2" | "no") {
    setBusy(s.company.id);
    try {
      await radarApi("/api/radar/descubrimiento", { method: "POST", body: { companyId: s.company.id, action } });
      if (action !== "no") trackRadar("radar_recommendation_accepted", { company_id: s.company.id, priority: action, sector: s.company.industries[0] });
      setData((d) => (d ? { ...d, items: d.items.filter((x) => x.company.id !== s.company.id) } : d));
      toast.show(action === "no" ? `No te vamos a sugerir ${s.company.name}` : `${s.company.name} quedó en tu ${action}`);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "No se pudo.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (email === undefined) return <Skeleton />;
  if (email === null) return <EmptyState title="Ingresá para ver tus sugerencias" actions={<button type="button" className={btnDark} onClick={() => void requestLogin("usar Radar laboral")}>Ingresar con Google</button>} />;
  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <Skeleton />;

  if (!data.items.length)
    return (
      <EmptyState title="No hay sugerencias esta semana" actions={<Link href="/radar/empresas" className={btnDark}>Agregar empresas</Link>}>
        <p>Maru sugiere empresas del catálogo parecidas a las que seguís. Cuantas más empresas sigas y clasifiques, mejores sugerencias. No se repiten las que ya seguís ni las que marcaste «No me interesa».</p>
      </EmptyState>
    );

  return (
    <section className={`${card} p-4 sm:p-5`} aria-labelledby="desc-titulo">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="desc-titulo" className="mr-auto text-lg font-bold">Empresas que Maru descubrió para vos</h2>
        <span className="text-sm text-muted">Semana {data.week.split("-W")[1]}</span>
      </div>
      <p className="mt-1 text-sm text-muted">Sacadas del catálogo por afinidad con las empresas que seguís y con tu área. No subimos ninguna a tu lista sin que lo elijas.</p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {data.items.map((s) => (
          <li key={s.company.id} className="flex flex-col rounded-xl p-4 ring-1 ring-black/[0.08]">
            <div className="flex items-start gap-3">
              <Monogram name={s.company.name} size={40} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{s.company.name}</h3>
                <p className="text-xs text-muted">{[s.company.headquarters, s.company.region].filter(Boolean).join(" · ") || "Ubicación a confirmar"}</p>
                <div className="mt-1 flex flex-wrap gap-1">{s.company.industries.map((i) => <Tag key={i}>{i}</Tag>)}</div>
              </div>
            </div>
            <p className="mt-3 text-sm">{s.reason}</p>
            <div className="mt-2 space-y-1">
              {s.signals.map((g, i) => (
                <p key={i} className="text-xs"><Tag tone="ok">Verificado</Tag> {g.text} · {g.source} · {g.date}</p>
              ))}
              {s.pendingVerification && <p className="text-xs"><Tag tone="warn">Pendiente de verificación</Tag> Todavía no leímos su página de Careers.</p>}
            </div>
            {s.careersUrl && (
              <a href={s.careersUrl.startsWith("https://") ? s.careersUrl : undefined} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs underline underline-offset-2">Página de Careers</a>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnDark} disabled={busy === s.company.id} onClick={() => void act(s, "P1")}>Agregar a P1</button>
              <button type="button" className={btnGhost} disabled={busy === s.company.id} onClick={() => void act(s, "P2")}>Agregar a P2</button>
              <button type="button" className={btnGhost} disabled={busy === s.company.id} onClick={() => void act(s, "no")}>No me interesa</button>
            </div>
          </li>
        ))}
      </ul>
      {toast.node}
    </section>
  );
}
