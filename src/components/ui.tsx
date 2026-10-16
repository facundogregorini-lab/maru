"use client";

import { useEffect, useState } from "react";
import { MaruSprite } from "./maru/PixelMaru";

/** Piezas visuales compartidas por todas las secciones de Maru. */

export function StepCard({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section
      className="animate-rise rounded-3xl bg-paper p-5 ring-1 ring-line sm:p-8"
      style={{ animationDelay: `${n * 70}ms` }}
    >
      <div className="mb-5 flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-bold text-white">{n}</span>
        <div>
          <h2 className="font-display text-2xl leading-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="press rounded-full bg-ink px-10 py-3.5 text-base font-bold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-black/15 disabled:text-white"
    >
      {children}
    </button>
  );
}

export function Loading({ messages }: { messages: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, messages.length - 1)), 6000);
    return () => clearInterval(id);
  }, [messages.length]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center" aria-live="polite">
      <WalkingMaru />
      <p key={i} className="animate-rise mt-6 font-display text-2xl">
        {messages[i]}
      </p>
      <p className="mt-2 text-sm text-muted">Puede tardar un minuto. Vale la pena.</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="animate-rise mb-6 rounded-2xl border border-danger/25 bg-danger-soft px-5 py-4 text-sm text-danger-dark">
      {message}
    </div>
  );
}

/** Maru caminando en el lugar: la espera tiene compañía. */
function WalkingMaru() {
  const [frame, setFrame] = useState<"walkA" | "walkB">("walkA");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setFrame((f) => (f === "walkA" ? "walkB" : "walkA")), 180);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid h-28 w-28 place-items-center rounded-full bg-sand">
      <MaruSprite size={56} frame={frame} />
    </div>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition placeholder:text-muted/60 hover:border-ink/30 focus:border-ink focus:ring-4 focus:ring-brand-soft";

/** Opciones tipo "chip" de selección única. */
export function Chips<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`press rounded-full border px-3.5 py-1.5 text-sm font-medium ${value === v ? "border-ink bg-ink text-white" : "border-line bg-paper hover:border-ink/40"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 413) {
    throw Object.assign(new Error("Tu archivo es demasiado pesado para enviarlo. Exportalo más liviano (menos de 3 MB) o pegá tu experiencia."), {
      code: "CV_TOO_LARGE",
    });
  }
  const data = await res.json().catch(() => ({ error: "Respuesta inesperada del servidor." }));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Algo salió mal."), { code: data.code as string | undefined });
  return data as T;
}
