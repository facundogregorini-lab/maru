"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import CompanyTile from "@/components/busquedas/CompanyTile";
import { MaruHead } from "@/components/maru/PixelMaru";
import { post } from "@/components/ui";
import { loadMatch } from "@/lib/match/clientStore";

type Job = { id: string; title: string; company: string; where: string; logo: string };
type Msg = { role: "user" | "maru"; text: string; jobs?: Job[]; verMas?: string | null; herramienta?: { href: string; label: string } | null };
type Reply = { respuesta: string; jobs: Job[]; verMas: string | null; herramienta: { href: string; label: string } | null };

const KEY = "maru:chat:v1";
const SUGGESTIONS = ["Busco trabajo remoto de Product Manager", "¿Cómo adapto mi CV a un aviso?", "Tengo una entrevista la semana que viene", "Quiero cambiar de carrera a datos"];

/** El perfil del match, en pocas líneas, para que Maru responda sobre vos (queda en tu navegador; viaja sólo con cada pregunta). */
function perfil(): string {
  const p = loadMatch().profile;
  if (!p) return "";
  return [p.headline, p.titles.length ? `Cargos: ${p.titles.slice(0, 3).join(", ")}` : "", p.skills.length ? `Habilidades: ${p.skills.slice(0, 12).join(", ")}` : "", p.yearsExperience != null ? `${p.yearsExperience} años de experiencia` : ""]
    .filter(Boolean)
    .join("\n");
}

/** Chat con Maru en el panel derecho de Búsquedas (el "Orion" de jobright). */
export default function ChatPanel({ label, total }: { label: string; total: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) setMsgs(JSON.parse(raw) as Msg[]);
    } catch {
      // sin sessionStorage: arrancamos de cero
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20)));
    } catch {
      // idem
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const next = [...msgs, { role: "user" as const, text: question }];
    setMsgs(next);
    setText("");
    setError("");
    setBusy(true);
    try {
      const r = await post<Reply>("/api/chat", { messages: next.map(({ role, text }) => ({ role, text })), perfil: perfil() });
      setMsgs([...next, { role: "maru", text: r.respuesta, jobs: r.jobs, verMas: r.verMas, herramienta: r.herramienta }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-neon">
          <MaruHead size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold leading-tight">Maru</p>
          <p className="text-xs">Tu coach de carrera con IA</p>
        </div>
        {msgs.length > 0 && (
          <button type="button" onClick={() => setMsgs([])} className="text-xs text-ink/50 hover:text-ink">
            Nueva charla
          </button>
        )}
      </div>

      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed" aria-live="polite">
        <div className="rounded-[2px_12px_12px_12px] bg-[#f7f8f9] p-4">
          <p className="text-[15px] font-bold">{label || "Búsquedas reales"}</p>
          <p className="mt-2">
            Encontré {total.toLocaleString("es-AR")} búsquedas abiertas{label ? ` para “${label}”` : ""}. Contame qué buscás o en qué te trabás y te ayudo: te muestro búsquedas, te digo
            qué herramienta usar o cómo prepararte.
          </p>
        </div>

        {msgs.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] rounded-[12px_2px_12px_12px] bg-ink px-3.5 py-2.5 text-white">
              {m.text}
            </p>
          ) : (
            <div key={i} className="max-w-[95%] space-y-2">
              <p className="rounded-[2px_12px_12px_12px] bg-[#f7f8f9] px-3.5 py-2.5 whitespace-pre-line">{m.text}</p>
              {m.jobs?.map((j) => (
                <Link key={j.id} href={`/busquedas/${j.id}`} className="flex items-center gap-2.5 rounded-xl bg-white p-2.5 ring-1 ring-black/[0.06] hover:ring-black/20">
                  <CompanyTile name={j.company} logo={j.logo} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{j.title}</span>
                    <span className="block truncate text-xs text-ink/60">
                      {j.company}
                      {j.where ? ` · ${j.where}` : ""}
                    </span>
                  </span>
                </Link>
              ))}
              <div className="flex flex-wrap gap-2">
                {m.verMas && (
                  <Link href={m.verMas} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-black/10 hover:ring-black/30">
                    Ver todas →
                  </Link>
                )}
                {m.herramienta && (
                  <Link href={m.herramienta.href} className="rounded-full bg-neon px-3 py-1.5 text-xs font-bold">
                    {m.herramienta.label} →
                  </Link>
                )}
              </div>
            </div>
          ),
        )}
        {busy && <p className="w-fit rounded-[2px_12px_12px_12px] bg-[#f7f8f9] px-3.5 py-2.5 text-ink/60">Maru está escribiendo…</p>}
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full bg-white px-3 py-1.5 text-left text-xs ring-1 ring-black/10 hover:ring-black/30">
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="mt-3 flex items-end gap-2 rounded-2xl bg-[#f7f8f9] p-2"
      >
        <label htmlFor="chat-maru" className="sr-only">
          Escribile a Maru
        </label>
        <textarea
          id="chat-maru"
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder="Preguntale a Maru…"
          maxLength={1500}
          className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink/40"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Enviar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </form>
    </div>
  );
}
