"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Priority } from "@/lib/radar/types";

/** Piezas visuales de Radar, con los tokens de Maru (globals.css). */

export const card = "rounded-2xl bg-white ring-1 ring-black/[0.06]";
export const field =
  "w-full rounded-xl border border-transparent bg-white px-3 py-2.5 text-sm outline-none ring-1 ring-black/[0.12] transition placeholder:text-ink/40 hover:ring-black/25 focus-visible:ring-2 focus-visible:ring-ink";
export const btn =
  "press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
export const btnDark = `${btn} bg-ink text-white hover:bg-black`;
export const btnNeon = `${btn} bg-neon text-ink hover:bg-neon-deep`;
export const btnGhost = `${btn} bg-white ring-1 ring-black/[0.12] hover:ring-black/30`;

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "warn" }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${tone === "warn" ? "text-danger-dark" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  P1: "bg-ink text-white",
  P2: "bg-mint text-ink",
  P3: "bg-surface text-ink",
  none: "bg-warning-soft text-ink",
};
export const priorityLabel = (p: Priority | null) => (p ? p : "Por clasificar");

export function PriorityPill({ p }: { p: Priority | null }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${PRIORITY_STYLE[p ?? "none"]}`}>{priorityLabel(p)}</span>;
}

export function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "warn" | "danger" | "ok" }) {
  const t = { plain: "bg-surface text-ink", warn: "bg-warning-soft text-ink", danger: "bg-danger-soft text-danger-dark", ok: "bg-banner text-brand-dark" }[tone];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

const PALETTE = ["#1c8d4d", "#136c39", "#3b4a5a", "#5a4fcf", "#b77d60", "#d98a36", "#405c95", "#6b7280"];
export function Monogram({ name, size = 36 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-xl font-bold text-white" style={{ width: size, height: size, background: PALETTE[h % PALETTE.length], fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

export function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "error" }) {
  const t = { info: "bg-surface-5 ring-black/[0.06]", warn: "bg-warning-soft/60 ring-warning/30", error: "bg-danger-soft ring-danger/25 text-danger-dark" }[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`rounded-xl px-4 py-3 text-sm ring-1 ${t}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className={`${card} flex flex-col items-center px-6 py-12 text-center`}>
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden className="text-muted">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 12 17.5 6.5M12 4v2M20 12h-2" />
        <circle cx="12" cy="12" r="1.2" />
      </svg>
      <h2 className="mt-3 text-lg font-bold">{title}</h2>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={`${card} space-y-3 p-4`} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
      ))}
    </div>
  );
}

/** Panel lateral (diálogo modal): Escape y el fondo lo cierran; el foco vuelve a donde estaba. */
export function Drawer({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    panel?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel) {
        const els = [...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-[var(--shadow-card)] ${wide ? "max-w-3xl" : "max-w-lg"}`}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className={`${btn} h-10 w-10 px-0`} aria-label="Cerrar">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Avisos cortos (role=status para lectores de pantalla). */
export function useToast() {
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setMsg({ text, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 4000);
  }, []);
  const node = (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[80] flex justify-center px-4">
      {msg && (
        <p className={`pointer-events-auto rounded-full px-5 py-2.5 text-sm font-medium shadow-[var(--shadow-pop)] ${msg.tone === "error" ? "bg-danger text-white" : "bg-ink text-white"}`}>{msg.text}</p>
      )}
    </div>
  );
  return { show, node };
}

export function Label({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold">
      {children}
      {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
    </label>
  );
}
