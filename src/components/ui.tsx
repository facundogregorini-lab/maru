"use client";

import { useEffect, useState } from "react";

/** Piezas visuales compartidas por todas las secciones de Maru. */

export function StepCard({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section
      className="animate-rise rounded-[28px] bg-paper p-5 shadow-[0_1px_2px_rgba(14,27,44,0.04),0_18px_40px_-28px_rgba(21,82,126,0.35)] ring-1 ring-line/70 sm:p-8"
      style={{ animationDelay: `${n * 70}ms` }}
    >
      <div className="mb-5 flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-celeste-soft font-serif text-xl italic text-celeste-dark">{n}</span>
        <div>
          <h2 className="font-serif text-[1.7rem] leading-tight tracking-tight">{title}</h2>
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
      className="press rounded-full bg-celeste px-8 py-3.5 text-base font-medium text-paper shadow-[0_14px_30px_-12px_rgba(31,111,168,0.7)] hover:bg-celeste-dark disabled:cursor-not-allowed disabled:bg-muted/30 disabled:text-paper/80 disabled:shadow-none"
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
      <div className="relative h-24 w-24">
        <div className="animate-breathe absolute inset-0 rounded-full bg-[conic-gradient(from_120deg,var(--color-celeste),var(--color-aqua),var(--color-celeste-light),var(--color-celeste))] blur-md" />
        <div className="animate-breathe absolute inset-3 rounded-full bg-[conic-gradient(from_200deg,var(--color-celeste),var(--color-aqua),var(--color-celeste))]" />
      </div>
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
    <div role="alert" className="animate-rise mb-6 rounded-2xl border border-celeste/30 bg-celeste-soft px-5 py-4 text-sm text-celeste-dark">
      {message}
    </div>
  );
}

/** Encabezado grande de cada sección. */
export function SectionHero({ kicker, title, children }: { kicker: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden rounded-[32px] bg-paper px-6 py-12 ring-1 ring-line/70 sm:px-12 sm:py-16">
      <div aria-hidden className="aurora -z-10" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(14,27,44,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(14,27,44,0.04)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_top_right,#000_20%,transparent_70%)]" />
      <div className="relative max-w-2xl">
        <p className="animate-rise inline-flex items-center gap-2 rounded-full bg-paper/80 px-3 py-1 text-sm font-medium text-celeste-dark ring-1 ring-celeste/15">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-celeste" />
          {kicker}
        </p>
        <h1 className="animate-rise mt-5 font-serif text-[2.6rem] leading-[1.02] tracking-tight [animation-delay:90ms] sm:text-6xl">{title}</h1>
        <p className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-muted [animation-delay:180ms]">{children}</p>
      </div>
    </section>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none transition placeholder:text-muted/60 hover:border-celeste/40 focus:border-celeste focus:ring-4 focus:ring-celeste-soft";

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
          className={`press rounded-full border px-3.5 py-1.5 text-sm ${value === v ? "border-celeste bg-celeste-soft text-celeste-dark" : "border-line bg-paper hover:border-celeste/50"}`}
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
