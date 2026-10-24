"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { rememberReturnTo } from "@/lib/billing/returnTo";
import type { CopilotAction } from "@/lib/copilot";
import { loadChat, prepareApplication, readContextPref, saveChat, setUseContextPref, type CopilotMessage } from "@/lib/copilotClient";
import { loadMatch } from "@/lib/match/clientStore";
import { capture } from "@/lib/tracking/posthog";
import { loadProfile } from "@/lib/profileStore";
import { post } from "../ui";
import { WorkingDots } from "./MaruWorking";
import { MaruHead } from "./PixelMaru";

type Reply = { answer: string; jobs: CopilotMessage["jobs"]; actions: CopilotAction[] };

const SUGGESTIONS = ["¿Qué búsquedas me convienen hoy?", "¿Qué le falta a mi CV para lo que busco?", "Ayudame a preparar mi próxima entrevista"];

/**
 * El copiloto, en el panel de Maru del rincón. Responde con el CV y el match guardados en este navegador
 * (si la persona lo deja activado) y ofrece acciones que ella ejecuta con un toque.
 */
export default function Copilot({ initial, onClose, onGuide }: { initial?: { text: string; n: number }; onClose: () => void; onGuide: () => void }) {
  const { email } = useAuth();
  const owner = email ?? "";
  const path = usePathname();
  const router = useRouter();
  const inputId = useId();
  // Sólo se monta en el navegador (al abrir el copiloto): puede leer la charla de la pestaña al iniciar.
  const [messages, setMessages] = useState<CopilotMessage[]>(() => loadChat(owner));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; limit: boolean } | null>(null);
  const [useContext, setUseContext] = useState(readContextPref);
  const [running, setRunning] = useState("");
  const generation = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(0);

  // Al cambiar de cuenta, la charla de la otra no se muestra y lo que estaba en camino se descarta.
  const lastOwner = useRef(owner);
  useEffect(() => {
    if (lastOwner.current === owner) return;
    lastOwner.current = owner;
    generation.current++;
    setMessages(loadChat(owner));
    setBusy(false);
    setError(null);
  }, [owner]);
  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  useEffect(() => {
    input.current?.focus();
  }, []);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const gen = generation.current;
    const history = messages.slice(-8).map(({ role, text: t }) => ({ role, text: t }));
    const withUser: CopilotMessage[] = [...messages, { role: "user", text: q }];
    setText("");
    setBusy(true);
    setError(null);
    setMessages(withUser);
    saveChat(owner, withUser);
    try {
      const m = useContext ? loadMatch() : null;
      const saved = useContext ? loadProfile()?.profile : undefined;
      // Los datos de contacto no salen del navegador: el copiloto no los necesita.
      const cv = saved && { ...saved, nombre: "", email: "", telefono: "", linkedin_url: "", otros_links: [] };
      const match = m?.profile && m.prefs ? { profile: m.profile, prefs: m.prefs, interactions: m.interactions } : undefined;
      const r = await post<Reply>("/api/copiloto", { message: q, history, path, ...(cv ? { cv } : {}), ...(match ? { match } : {}) });
      if (gen !== generation.current) return;
      const next: CopilotMessage[] = [...withUser, { role: "assistant", text: r.answer, jobs: r.jobs, actions: r.actions }];
      setMessages(next);
      saveChat(owner, next);
      capture("copiloto_respuesta", { acciones: r.actions.length, avisos: r.jobs?.length ?? 0, contexto: useContext });
    } catch (err) {
      if (gen !== generation.current) return;
      const e = err as Error & { code?: string };
      setError({ text: e.message || "No pude responder. Probá otra vez.", limit: e.code === "PLAN_LIMIT" });
      setMessages(messages);
      saveChat(owner, messages);
      setText(q);
    } finally {
      if (gen === generation.current) setBusy(false);
    }
  }

  // Lo que llega desde un botón de otra pantalla ("Preguntale a Maru…") se manda una sola vez.
  useEffect(() => {
    if (!initial || sentInitial.current === initial.n) return;
    sentInitial.current = initial.n;
    void send(initial.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  async function run(a: CopilotAction) {
    capture("copiloto_accion", { tipo: a.kind === "postular" ? "postular" : a.href.split(/[/?#]/)[1] || "inicio" });
    if (a.kind === "link") {
      router.push(a.href);
      return;
    }
    setRunning(a.id);
    try {
      router.push(await prepareApplication(a));
    } catch (err) {
      setError({ text: (err as Error).message, limit: false });
    } finally {
      setRunning("");
    }
  }

  function newChat() {
    generation.current++;
    setMessages([]);
    saveChat(owner, []);
    setError(null);
    setBusy(false);
    input.current?.focus();
  }

  return (
    <div
      role="dialog"
      aria-label="Copiloto de Maru"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="maru-panel-in pointer-events-auto relative mb-3 flex max-h-[min(640px,calc(100dvh-140px))] w-[min(392px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/5"
    >
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon">
          <MaruHead size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Copiloto de Maru</p>
          <p className="text-[11px] text-ink/55">Te ayudo con tu búsqueda y abro lo que necesites.</p>
        </div>
        <button type="button" onClick={newChat} disabled={busy || !messages.length} className="rounded-full px-2 py-1 text-[11px] text-ink/60 hover:bg-black/[0.05] hover:text-ink disabled:invisible">
          Nueva charla
        </button>
        <button type="button" onClick={onClose} aria-label="Cerrar el copiloto" className="grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-ink/50 hover:bg-black/[0.05] hover:text-ink">
          ×
        </button>
      </div>

      <div role="log" aria-label="Mensajes" aria-live="polite" className="min-h-[180px] flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
        {messages.length === 0 && (
          <div>
            <p className="rounded-2xl bg-sand p-3 text-sm leading-relaxed">
              ¡Hola! Preguntame lo que quieras de tu búsqueda: qué avisos te convienen, qué mejorar del CV o cómo encarar una entrevista. Si hace falta, te abro la herramienta o el aviso.
            </p>
            <div className="mt-3 flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full bg-[#f2f4f5] px-3 py-1.5 text-left text-[13px] hover:bg-black/[0.08]">
                  {s}
                </button>
              ))}
              <button type="button" onClick={onGuide} className="px-1 text-[12px] text-ink/60 underline underline-offset-2 hover:text-ink">
                Prefiero el recorrido por todo lo que hace Maru
              </button>
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-8 whitespace-pre-wrap break-words rounded-2xl bg-ink px-3 py-2 text-sm leading-relaxed text-white">
              {m.text}
            </p>
          ) : (
            <div key={i} className="mr-4">
              <p className="whitespace-pre-wrap break-words rounded-2xl bg-sand px-3 py-2 text-sm leading-relaxed">{m.text}</p>
              {m.jobs?.map((j) => (
                <Link key={j.id} href={`/busquedas/${j.id}`} className="mt-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px] ring-1 ring-black/[0.08] hover:ring-ink">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{j.title}</span>
                    <span className="block truncate text-ink/60">{j.company}</span>
                  </span>
                  {j.score !== undefined && <span className="shrink-0 rounded-full bg-neon/20 px-2 py-0.5 text-[11px] font-bold">{j.score}%</span>}
                </Link>
              ))}
              {!!m.actions?.length && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {m.actions.map((a) => (
                    <button
                      key={a.kind === "link" ? a.href : `p-${a.id}`}
                      type="button"
                      onClick={() => run(a)}
                      disabled={!!running}
                      className="press rounded-full bg-neon px-3 py-1.5 text-left text-[13px] font-semibold hover:bg-neon/80 disabled:opacity-60"
                    >
                      {a.kind === "postular" && running === a.id ? "Abriendo…" : `${a.label} →`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy && (
          <p role="status" className="text-sm text-ink/60">
            Maru está pensando
            <WorkingDots />
          </p>
        )}
        <div ref={end} />
      </div>

      {error && (
        <div role="alert" className="mx-4 mb-2 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger-dark">
          {error.text}
          {error.limit && (
            <Link href="/precios" onClick={() => rememberReturnTo(path)} className="ml-1 font-semibold underline underline-offset-2">
              Ver los planes
            </Link>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="border-t border-black/[0.06] px-4 pb-3 pt-2"
      >
        <label htmlFor={inputId} className="sr-only">
          Tu consulta
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={inputId}
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(text);
              }
            }}
            maxLength={1000}
            rows={2}
            disabled={busy}
            placeholder="Escribile a Maru…"
            className="min-h-11 w-full resize-none rounded-xl border border-line px-3 py-2 text-base focus:outline-2 focus:outline-ink sm:text-sm"
          />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Enviar" className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] leading-snug text-ink/60">
          <input
            type="checkbox"
            checked={useContext}
            onChange={(e) => {
              setUseContext(e.target.checked);
              setUseContextPref(e.target.checked);
            }}
            className="h-3.5 w-3.5"
          />
          Usar mi CV y mi match guardados en este navegador (sin datos de contacto)
        </label>
      </form>
    </div>
  );
}
