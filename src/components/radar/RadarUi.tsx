"use client";

import { useEffect, useRef } from "react";
import { monogram } from "@/lib/radar/identity";
import type { Priority } from "@/lib/radar/types";

/** Piezas visuales del Radar laboral: mismas tarjetas, bordes y botones que el resto de la app. */

export const card = "rounded-2xl border border-line bg-white p-4 sm:p-5";
export const btn = "press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-50";
export const btnNeon = "press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-neon px-4 text-sm font-bold text-ink hover:bg-neon-deep disabled:cursor-not-allowed disabled:opacity-50";
export const btnInk = "press inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-ink px-5 text-sm font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50";
export const field = "min-h-10 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/15";
export const label = "mb-1 block text-xs font-semibold text-muted";

const COLORS = ["#6554d6", "#23976a", "#b77d60", "#344151", "#d98a36", "#405c95", "#d66d91", "#171717"];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-xl font-bold text-white" style={{ width: size, height: size, background: COLORS[h % COLORS.length], fontSize: size * 0.42 }}>
      {monogram(name)}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "warn" | "bad" | "info" }) {
  const tones = {
    neutral: "bg-surface text-ink/70",
    ok: "bg-banner text-brand-dark",
    warn: "bg-warning-soft text-[#7a4f00]",
    bad: "bg-danger-soft text-danger-dark",
    info: "bg-[#e8f1ff] text-[#1d4f91]",
  } as const;
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function PriorityPill({ p }: { p: Priority | null }) {
  if (!p) return <Pill tone="warn">Sin clasificar</Pill>;
  return <Pill tone={p === "P1" ? "ok" : "neutral"}>{p}</Pill>;
}

export function Stat({ title, value, hint }: { title: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className={card}>
      <p className="text-[13px] text-muted">{title}</p>
      <p className="my-1.5 text-[28px] font-extrabold leading-none tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 rounded-xl border border-[#dce4e2] bg-[#f4faf7] px-4 py-3 text-xs leading-relaxed text-[#45584f]">{children}</div>;
}

/** Panel lateral accesible: foco adentro, Escape cierra y devuelve el foco a donde estaba. */
export function Drawer({ title, open, onClose, children, wide }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !ref.current) return;
      const els = [...ref.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea")].filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/40" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`h-full w-full overflow-y-auto bg-white p-5 shadow-2xl sm:p-6 ${wide ? "max-w-[720px]" : "max-w-[520px]"}`}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
          <button type="button" data-close onClick={onClose} aria-label="Cerrar" className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Mensaje breve que se anuncia a lectores de pantalla. */
export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[80] max-w-[90vw]">
      {message && <div className="rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">{message}</div>}
    </div>
  );
}
