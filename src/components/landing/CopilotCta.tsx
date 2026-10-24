"use client";

import { openCopilot } from "@/lib/copilotClient";

/** Abre el copiloto de Maru en la misma página. */
export default function CopilotCta({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => openCopilot()} className={className}>
      {children}
    </button>
  );
}
