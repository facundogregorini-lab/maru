"use client";

import { useEffect, useState } from "react";

/** Piezas visuales compartidas por todas las secciones de Maru. */

export function StepCard({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="animate-rise rounded-3xl border border-line bg-paper/70 p-5 sm:p-8" style={{ animationDelay: `${n * 70}ms` }}>
      <div className="mb-4 flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-clay-soft font-serif text-lg text-clay-dark">{n}</span>
        <div>
          <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
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
      className="rounded-full bg-clay px-8 py-3.5 text-base font-medium text-paper shadow-[0_10px_30px_-12px_rgba(192,98,58,0.8)] transition hover:bg-clay-dark disabled:cursor-not-allowed disabled:bg-muted/40 disabled:shadow-none"
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
      <div className="animate-breathe h-20 w-20 rounded-full bg-gradient-to-br from-clay to-honey" />
      <p key={i} className="animate-rise mt-8 font-serif text-2xl">
        {messages[i]}
      </p>
      <p className="mt-2 text-sm text-muted">Puede tardar un minuto. Vale la pena.</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="animate-rise mb-6 rounded-2xl border border-clay/30 bg-clay-soft px-5 py-4 text-sm text-clay-dark">
      {message}
    </div>
  );
}

/** Encabezado grande de cada sección. */
export function SectionHero({ kicker, title, children }: { kicker: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="animate-rise relative overflow-hidden rounded-[2rem] bg-sand px-6 py-12 sm:px-12 sm:py-16">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-clay-soft" />
      <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-sage-soft" />
      <div className="relative max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-clay">{kicker}</p>
        <h1 className="mt-3 font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">{children}</p>
      </div>
    </section>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-base outline-none transition placeholder:text-muted/60 focus:border-clay focus:ring-4 focus:ring-clay-soft";

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
          className={`rounded-full border px-3.5 py-1.5 text-sm transition ${value === v ? "border-clay bg-clay-soft text-clay-dark" : "border-line bg-paper hover:border-clay"}`}
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
