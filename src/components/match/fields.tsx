"use client";

import { useState } from "react";
import { inputClass } from "../ui";

/** Piezas de formulario del match (mismo estilo que el resto de Maru). */

export function MultiChips<T extends string>({ value, options, onChange }: { value: T[]; options: readonly (readonly [T, string])[]; onChange: (v: T[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => {
        const on = value.includes(v);
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-clay bg-clay-soft text-clay-dark" : "border-line bg-paper hover:border-clay"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Lista editable como texto separado por comas (o renglones). Mantiene lo que la persona escribe. */
export function ListInput({
  value,
  onChange,
  placeholder,
  multiline = false,
  label,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
  label?: string;
}) {
  const sep = multiline ? "\n" : ", ";
  const [draft, setDraft] = useState(value.join(sep));
  const commit = (t: string) => {
    setDraft(t);
    onChange(
      t
        .split(multiline ? /\n/ : /[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  };
  return multiline ? (
    <textarea aria-label={label} rows={4} value={draft} placeholder={placeholder} onChange={(e) => commit(e.target.value)} className={`${inputClass} text-sm`} />
  ) : (
    <input aria-label={label} value={draft} placeholder={placeholder} onChange={(e) => commit(e.target.value)} className={inputClass} />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="font-medium">{label}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
