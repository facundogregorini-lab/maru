"use client";

import MaruWorking from "./maru/MaruWorking";
import { notifyPlanLimit } from "@/lib/tracking/paywall";
import { capture, herramientaDeResultado } from "@/lib/tracking/posthog";

/** Piezas visuales compartidas por todas las secciones de Maru. */

export function StepCard({ n, title, hint, children }: { n: number; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section
      className="animate-rise rounded-[24px] bg-[#f2f4f5] p-5 sm:p-8"
      style={{ animationDelay: `${n * 70}ms` }}
    >
      <div className="mb-5 flex items-start gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neon font-bold">{n}</span>
        <div>
          <h2 className="text-xl font-semibold leading-tight sm:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-ink/70">{hint}</p>
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
      className="press inline-flex h-14 items-center rounded-full bg-ink px-10 text-lg font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-black/15 disabled:text-white sm:text-xl"
    >
      {children}
    </button>
  );
}

export function Loading({ messages }: { messages: string[] }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <MaruWorking title="Maru está trabajando" steps={messages} every={6000} note="Puede tardar un minuto. Vale la pena." />
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


export const inputClass =
  "w-full rounded-xl border border-transparent bg-white px-4 py-3 text-base outline-none ring-1 ring-black/[0.06] transition placeholder:text-ink/40 hover:ring-black/20 focus:ring-2 focus:ring-ink";

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
          className={`press rounded-lg px-3.5 py-1.5 text-sm font-medium ${value === v ? "bg-ink text-white" : "bg-white ring-1 ring-black/[0.06] hover:ring-black/20"}`}
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
  if (!res.ok) {
    // Si el cupo gratis frenó la acción, se abren los planes (PaywallHost). El mensaje de error sigue igual.
    notifyPlanLimit(url, res.status, data.code);
    throw Object.assign(new Error(data.error ?? "Algo salió mal."), { code: data.code as string | undefined });
  }
  const herramienta = herramientaDeResultado(url);
  if (herramienta) capture("herramienta_resultado", { herramienta });
  return data as T;
}
