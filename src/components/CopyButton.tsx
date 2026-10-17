"use client";

import { useState } from "react";

/**
 * `guard`: para copiar algo que exige login (p. ej. el CV), recibe la acción y decide si correrla.
 * `onCopied`: se llama sólo si el navegador confirmó la copia.
 */
export default function CopyButton({ text, label = "Copiar", guard, onCopied }: { text: string; label?: string; guard?: (copy: () => Promise<void>) => void; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    onCopied?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button
      type="button"
      onClick={() => (guard ? guard(copy) : copy())}
      className="shrink-0 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink transition hover:border-brand hover:text-brand"
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
