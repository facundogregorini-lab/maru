"use client";

import { useEffect, useMemo, useState } from "react";
import { fold } from "@/lib/match/text";
import { boardFromUrl, parseUrl } from "@/lib/radar/identity";
import { addCompany } from "@/lib/radar/state";
import { PRIORITIES, type Priority } from "@/lib/radar/types";
import { Drawer, btn, btnNeon, field, label } from "./RadarUi";
import { useRadar } from "./useRadar";

type CatalogItem = { name: string; board: string; sector: string; url: string };

let catalogCache: CatalogItem[] | null = null;

export default function AddCompany({ open, onClose, industries, onAdded }: { open: boolean; onClose: () => void; industries: string[]; onAdded: (name: string, existed: boolean) => void }) {
  const { update } = useRadar();
  const [catalog, setCatalog] = useState<CatalogItem[]>(catalogCache ?? []);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [industry, setIndustry] = useState(industries[0] ?? "IA");
  const [custom, setCustom] = useState("");
  const [priority, setPriorityValue] = useState<Priority | "">("P2");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || catalogCache) return;
    fetch("/api/radar/catalogo")
      .then((r) => (r.ok ? r.json() : { companies: [] }))
      .then((d: { companies?: CatalogItem[] }) => {
        catalogCache = d.companies ?? [];
        setCatalog(catalogCache);
      })
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (open) return;
    setQ("");
    setName("");
    setUrl("");
    setCustom("");
    setError("");
  }, [open]);

  const matches = useMemo(() => {
    const f = fold(q);
    if (f.length < 2) return [];
    return catalog.filter((c) => fold(c.name).includes(f)).slice(0, 8);
  }, [q, catalog]);

  const save = (n: string, careers: string) => {
    const clean = n.trim();
    if (!clean) {
      setError("Escribí el nombre de la empresa.");
      return;
    }
    if (careers.trim() && !parseUrl(careers)) {
      setError("El link de Careers no es una URL válida.");
      return;
    }
    const tag = (custom.trim() || industry).slice(0, 40);
    let result = { id: "", existed: false };
    update((s) => {
      const r = addCompany(s, { name: clean, careersUrl: careers.trim() || undefined, industries: tag ? [tag] : [], priority: priority || null });
      result = r;
      return r.state;
    });
    onAdded(clean, result.existed);
    onClose();
  };

  const detected = url.trim() ? boardFromUrl(url) : null;

  return (
    <Drawer title="Agregar empresa" open={open} onClose={onClose}>
      <p className="mb-4 text-sm text-muted">Buscala entre las empresas que Maru ya revisa todos los días o cargala con el link de su página de empleo.</p>

      <label className="block">
        <span className={label}>Buscar en el catálogo</span>
        <input className={`${field} w-full`} placeholder="Ej.: Nubank, Despegar…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      {matches.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {matches.map((m) => (
            <li key={m.board} className="flex items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{m.name}</p>
                <p className="truncate text-xs text-muted">{m.sector || m.board}</p>
              </div>
              <button type="button" className={btn} onClick={() => save(m.name, m.url)}>
                Seguir
              </button>
            </li>
          ))}
        </ul>
      )}
      {fold(q).length >= 2 && !matches.length && <p className="mt-2 text-xs text-muted">No está en el catálogo. Cargala abajo.</p>}

      <hr className="my-5 border-line" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(name, url);
        }}
        className="flex flex-col gap-3"
      >
        <label className="block">
          <span className={label}>Nombre</span>
          <input className={`${field} w-full`} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Anthropic" />
        </label>
        <label className="block">
          <span className={label}>Página de empleo (Careers), opcional</span>
          <input className={`${field} w-full`} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          {detected && <span className="mt-1 block text-xs text-brand-dark">Usa {detected.split(":")[0]}: Maru puede leer sus búsquedas.</span>}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={label}>Sector</span>
            <select className={`${field} w-full`} value={industry} onChange={(e) => setIndustry(e.target.value)}>
              {industries.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>Prioridad</span>
            <select className={`${field} w-full`} value={priority} onChange={(e) => setPriorityValue(e.target.value as Priority | "")}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="">Sin clasificar</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className={label}>Otro sector (opcional)</span>
          <input className={`${field} w-full`} maxLength={40} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Ej.: Fintech" />
        </label>
        {error && (
          <p role="alert" className="text-sm text-danger-dark">
            {error}
          </p>
        )}
        <button type="submit" className={`${btnNeon} mt-1`}>
          Agregar a mis empresas
        </button>
      </form>
    </Drawer>
  );
}
