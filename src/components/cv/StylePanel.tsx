"use client";

import type { CvStyle, Density, FontPairId, TemplateId, TextSize } from "@/lib/schemas";
import { ACCENTS, FONT_PAIRS, resolveTheme, templateDefaults } from "./themes";

const DENSITIES: [Density, string][] = [
  ["compacto", "Compacto"],
  ["normal", "Normal"],
  ["amplio", "Amplio"],
];
const SIZES: [TextSize, string][] = [
  ["chico", "Chica"],
  ["normal", "Normal"],
  ["grande", "Grande"],
];

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-full bg-sand p-1 text-xs">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`rounded-full py-1.5 transition ${value === v ? "bg-paper font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type Styled = { template: TemplateId; style?: CvStyle };

/** Ajustes finos por encima del template: color, tipografía, densidad y tamaño. Sirve para el CV y para la carta. */
export default function StylePanel<T extends Styled>({ doc, setDoc, hint = true }: { doc: T; setDoc: (fn: (d: T) => T) => void; hint?: boolean }) {
  const theme = resolveTheme(doc);
  const defaults = templateDefaults(doc.template);
  const fonts = doc.style?.fonts ?? defaults.fonts;
  const set = (patch: Partial<CvStyle>) => setDoc((d) => ({ ...d, style: { ...d.style, ...patch } }));
  const customized = !!(doc.style?.accent || doc.style?.fonts || (doc.style?.density ?? "normal") !== "normal" || (doc.style?.size ?? "normal") !== "normal");

  return (
    <div className="rounded-3xl bg-paper p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Personalizá el diseño</h3>
        {customized && (
          <button
            type="button"
            onClick={() => setDoc((d) => ({ ...d, style: { order: d.style?.order } }))}
            className="text-xs text-muted hover:text-clay-dark"
          >
            Restablecer
          </button>
        )}
      </div>

      <p className="mt-4 text-xs font-medium text-muted">Color</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {[{ name: "Del template", hex: defaults.accent }, ...ACCENTS.filter((a) => a.hex !== defaults.accent)].map((a, i) => {
          const active = theme.accent.toLowerCase() === a.hex.toLowerCase();
          return (
            <button
              key={a.hex}
              type="button"
              title={a.name}
              aria-label={`Color ${a.name}`}
              aria-pressed={active}
              onClick={() => set({ accent: i === 0 ? undefined : a.hex })}
              className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-paper transition ${active ? "ring-2 ring-ink" : "hover:scale-110"}`}
              style={{ background: a.hex }}
            />
          );
        })}
        <label
          title="Elegí cualquier color"
          className="relative grid h-7 w-7 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-line text-sm text-muted transition hover:border-clay hover:text-clay"
        >
          +
          <input
            type="color"
            value={theme.accent}
            onChange={(e) => set({ accent: e.target.value })}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Color personalizado"
          />
        </label>
      </div>

      <p className="mt-5 text-xs font-medium text-muted">Tipografía</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(Object.keys(FONT_PAIRS) as FontPairId[]).map((id) => {
          const f = FONT_PAIRS[id];
          const active = fonts === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => set({ fonts: id === defaults.fonts ? undefined : id })}
              className={`rounded-2xl px-3 py-2 text-left transition ${active ? "bg-clay-soft ring-2 ring-clay" : "ring-1 ring-line hover:ring-clay/60"}`}
            >
              <span className="block text-lg leading-tight" style={{ fontFamily: f.head }}>
                Aa
              </span>
              <span className="block text-xs font-medium">{f.label}</span>
              <span className="block text-[10.5px] text-muted">{f.hint}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-5 text-xs font-medium text-muted">Espaciado</p>
      <div className="mt-2">
        <Segmented value={doc.style?.density ?? "normal"} options={DENSITIES} onChange={(v) => set({ density: v })} />
      </div>

      <p className="mt-4 text-xs font-medium text-muted">Tamaño de letra</p>
      <div className="mt-2">
        <Segmented value={doc.style?.size ?? "normal"} options={SIZES} onChange={(v) => set({ size: v })} />
      </div>
      {hint && <p className="mt-3 text-[11px] leading-relaxed text-muted">¿El CV pasa a 2 páginas por poco? Probá “Compacto” o letra “Chica”.</p>}
    </div>
  );
}
