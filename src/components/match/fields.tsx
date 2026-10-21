"use client";

import { useState } from "react";
import { capitalize, spokenList } from "@/lib/voice";
import { inputClass } from "../ui";
import { DictateField } from "../VoiceButton";

/** Campo de texto con lugar para el micrófono de dictado (`DictateField`). */
export const dictateInputClass = `${inputClass} pr-12!`;

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
            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-paper hover:border-brand"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Lista editable como texto separado por comas (o renglones). Mantiene lo que la persona escribe. Se puede dictar. */
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
  // Lo dictado se suma como ítems nuevos: un renglón por frase, o separado por comas ("SQL, Python y Excel").
  const dictate = (spoken: string) => {
    const items = multiline ? [capitalize(spoken)].filter(Boolean) : spokenList(spoken);
    if (!items.length) return;
    const base = draft.replace(/[\s,;]+$/, "");
    commit(base ? `${base}${sep}${items.join(sep)}` : items.join(sep));
  };
  return (
    <DictateField onText={dictate} multiline={multiline}>
      {multiline ? (
        <textarea aria-label={label} rows={4} value={draft} placeholder={placeholder} onChange={(e) => commit(e.target.value)} className={`${dictateInputClass} text-sm`} />
      ) : (
        <input aria-label={label} value={draft} placeholder={placeholder} onChange={(e) => commit(e.target.value)} className={dictateInputClass} />
      )}
    </DictateField>
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
