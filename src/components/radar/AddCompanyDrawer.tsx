"use client";

import { useEffect, useId, useState } from "react";
import type { Company, Priority } from "@/lib/radar/types";
import { trackRadar } from "@/lib/radar/analytics";
import { radarApi } from "./api";
import { Drawer, Label, Monogram, Notice, Tag, btnDark, btnGhost, field } from "./ui";

type Hit = { company: Company; following: boolean };
type Candidate = { name: string; domain: string | null; headquarters: string | null; description: string };

/** Agregar empresa: primero busca en el catálogo; si no está, la crea con nombre, dominio, sector y Careers. */
export default function AddCompanyDrawer({ open, onClose, onAdded, industries }: { open: boolean; onClose: () => void; onAdded: (name: string) => Promise<void>; industries: string[] }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [ai, setAi] = useState<Candidate[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [priority, setPriority] = useState<Priority | "">("P2");
  const [form, setForm] = useState({ name: "", domain: "", careersUrl: "", industry: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const listId = useId();

  useEffect(() => {
    if (!open) {
      setQ("");
      setHits(null);
      setAi(null);
      setError("");
      setForm({ name: "", domain: "", careersUrl: "", industry: "" });
    }
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) {
      setHits(null);
      return;
    }
    const t = setTimeout(() => {
      radarApi<{ results: Hit[] }>(`/api/radar/catalogo?q=${encodeURIComponent(q.trim())}`)
        .then((r) => setHits(r.results))
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  // Sugerencias de la IA: entiende errores de tipeo y distingue empresas con nombres parecidos.
  useEffect(() => {
    const text = q.trim();
    if (!open || text.length < 3) {
      setAi(null);
      setAiLoading(false);
      return;
    }
    setAiLoading(true);
    const t = setTimeout(() => {
      radarApi<{ results: Candidate[] }>(`/api/radar/empresas/sugerir?q=${encodeURIComponent(text)}`)
        .then((r) => setAi(r.results))
        .catch(() => setAi([]))
        .finally(() => setAiLoading(false));
    }, 450);
    return () => clearTimeout(t);
  }, [q, open]);

  async function follow(body: Record<string, unknown>, name: string) {
    setSaving(true);
    setError("");
    try {
      const v = await radarApi<{ company: { id: string; industries: string[] }; sources: { provider: string }[] }>("/api/radar/empresas", { method: "POST", body: { ...body, priority: priority || null } });
      trackRadar("radar_company_followed", { company_id: v.company.id, sector: v.company.industries[0], priority: priority || "sin", provider: v.sources[0]?.provider, action: body.companyId ? "catalogo" : "manual" });
      await onAdded(name);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer title="Agregar empresa" open={open} onClose={onClose}>
      <div>
        <Label htmlFor="radar-prio">Prioridad</Label>
        <select id="radar-prio" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} className={field}>
          <option value="P1">P1 · empresas soñadas</option>
          <option value="P2">P2 · empresas objetivo</option>
          <option value="P3">P3 · para explorar</option>
          <option value="">Por clasificar</option>
        </select>
      </div>

      <div className="mt-5">
        <Label htmlFor="radar-buscar">Empresa</Label>
        <input id="radar-buscar" data-autofocus type="search" value={q} onChange={(e) => { setQ(e.target.value); setForm((f) => ({ ...f, name: e.target.value })); }} placeholder="Escribí el nombre (aunque no sepas cómo se escribe)" className={field} autoComplete="off" aria-describedby="radar-buscar-ayuda" />
        <p id="radar-buscar-ayuda" className="mt-1 text-xs text-muted">Elegí la empresa correcta de la lista. Maru verifica su sitio y busca su página de empleos.</p>
        {hits && (
          <ul className="mt-2 space-y-1" aria-label="Resultados del catálogo">
            {hits.length > 0 && <li className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted">En Radar</li>}
            {hits.map((h) => (
              <li key={h.company.id} className="flex items-center gap-3 rounded-xl p-2 ring-1 ring-black/[0.06]">
                <Monogram name={h.company.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{h.company.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {h.company.industries.map((i) => <Tag key={i}>{i}</Tag>)}
                    {h.company.canonicalDomain && <span className="text-xs text-muted">{h.company.canonicalDomain}</span>}
                  </div>
                </div>
                {h.following ? (
                  <span className="text-xs font-semibold text-muted">Ya la seguís</span>
                ) : (
                  <button type="button" className={`${btnDark} h-9`} disabled={saving} onClick={() => void follow({ companyId: h.company.id }, h.company.name)}>
                    Seguir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {q.trim().length >= 3 && (
          <div className="mt-3" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Sugerencias de Maru (IA)</p>
            {aiLoading && <p className="mt-1 text-sm text-muted">Buscando…</p>}
            {!aiLoading && ai && ai.length === 0 && <p className="mt-1 text-sm text-muted">Sin sugerencias. Revisá cómo lo escribiste o creala abajo.</p>}
            {!aiLoading && ai && ai.length > 0 && (
              <ul className="mt-1 space-y-1" aria-label="Sugerencias de la IA">
                {ai
                  .filter((c) => !hits?.some((h) => (c.domain && h.company.canonicalDomain === c.domain) || h.company.name.toLowerCase() === c.name.toLowerCase()))
                  .map((c) => (
                    <li key={`${c.name}-${c.domain}`} className="flex items-center gap-3 rounded-xl p-2 ring-1 ring-black/[0.06]">
                      <Monogram name={c.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-muted">{[c.domain, c.headquarters].filter(Boolean).join(" · ")}</p>
                        <p className="text-xs">{c.description}</p>
                      </div>
                      <button type="button" className={`${btnDark} h-9`} disabled={saving} onClick={() => void follow({ create: { name: c.name, domain: c.domain ?? undefined, industry: form.industry || undefined }, verify: true }, c.name)}>
                        Agregar
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <p className="mt-1 text-xs text-muted">Sugerido por IA: al agregarla, Maru comprueba el dominio en el sitio oficial.</p>
          </div>
        )}
      </div>

      <form
        className="mt-6 space-y-3 border-t border-line pt-5"
        onSubmit={(e) => {
          e.preventDefault();
          void follow({ create: form, verify: true }, form.name.trim());
        }}
      >
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">¿No aparece? Creala a mano</h3>
        <div>
          <Label htmlFor="radar-nombre">Nombre</Label>
          <input id="radar-nombre" required minLength={2} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder="Ej. Anthropic" />
        </div>
        <div>
          <Label htmlFor="radar-dominio" hint="(opcional)">Dominio</Label>
          <input id="radar-dominio" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className={field} placeholder="empresa.com" inputMode="url" />
        </div>
        <div>
          <Label htmlFor="radar-careers" hint="(opcional)">Página de Careers</Label>
          <input id="radar-careers" type="url" value={form.careersUrl} onChange={(e) => setForm({ ...form, careersUrl: e.target.value })} className={field} placeholder="https://…" />
          <p className="mt-1 text-xs text-muted">Si no lo sabés, dejalo vacío: Maru busca su sitio y su página de empleos, verifica lo que encuentra y trae sus vacantes.</p>
        </div>
        <div>
          <Label htmlFor="radar-sector" hint="(opcional)">Sector</Label>
          <input id="radar-sector" list={listId} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={field} placeholder="IA, Space, Tech Startups…" maxLength={40} />
          <datalist id={listId}>
            {[...new Set(["IA", "Space", "Tech Startups", ...industries])].map((i) => <option key={i} value={i} />)}
          </datalist>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex gap-2">
          <button type="submit" className={btnDark} disabled={saving}>{saving ? "Agregando y revisando…" : "Agregar a mis empresas"}</button>
          <button type="button" className={btnGhost} onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Drawer>
  );
}
