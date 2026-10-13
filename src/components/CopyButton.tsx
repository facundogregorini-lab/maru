"use client";

import { useState } from "react";

export default function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="shrink-0 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink transition hover:border-clay hover:text-clay"
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
