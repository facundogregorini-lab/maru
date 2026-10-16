"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { loadProfile } from "@/lib/profileStore";
import { useAuth } from "@/components/auth/AuthProvider";

type Message = { role: "user" | "assistant"; text: string; jobs?: { id: string; title: string; company: string }[] };
export default function MaruChat() {
  const { email } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [useProfile, setUseProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { generation.current++; setMessages([]); setUseProfile(false); setBusy(false); setError(""); }, [email]);
  useEffect(() => { if (messages.length) end.current?.scrollIntoView({ block: "nearest" }); }, [messages]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const gen = generation.current;
    const question = text.trim();
    const history = messages.slice(-8).map(({ role, text }) => ({ role, text }));
    setText(""); setBusy(true); setError("");
    setMessages((m) => [...m, { role: "user", text: question }]);
    try {
      const profile = useProfile ? loadProfile()?.profile : undefined;
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: question, history, profile }) });
      const body = await res.json();
      if (gen !== generation.current) return;
      if (!res.ok) throw new Error(body.error ?? "No pude responder. Probá otra vez.");
      setMessages((m) => [...m, { role: "assistant", text: body.answer, jobs: body.jobs }]);
    } catch (err) { if (gen === generation.current) { setError(err instanceof Error ? err.message : "No pude conectar. Probá otra vez."); setText(question); } }
    finally { if (gen === generation.current) setBusy(false); }
  }
  return <section aria-label="Conversar con Maru" className="mt-4 rounded-2xl border border-line bg-white p-3">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Conversá con Maru</h2><button type="button" disabled={busy} onClick={() => { generation.current++; setMessages([]); setError(""); }} className="min-h-11 rounded-full px-3 text-xs underline disabled:opacity-40">Nueva charla</button></div>
    <p className="text-xs leading-relaxed text-ink/65">Consultame sobre tu búsqueda, CV o entrevista. Esta charla no se guarda al salir de la página.</p>
    <div role="log" aria-label="Mensajes" aria-live="polite" className="mt-3 max-h-[360px] space-y-3 overflow-y-auto overscroll-contain">
      {messages.length === 0 && <p className="rounded-xl bg-sand p-3 text-sm leading-relaxed">¿Qué querés lograr en tu próxima búsqueda? Contame el rol o el desafío y lo vemos.</p>}
      {messages.map((m,i) => <div key={i} className={`rounded-xl p-3 text-sm leading-relaxed ${m.role === "user" ? "ml-5 bg-[#f2f4f5]" : "bg-sand"}`}><p className="mb-1 text-xs font-bold">{m.role === "user" ? "Vos" : "Maru"}</p><p className="whitespace-pre-wrap break-words">{m.text}</p>{m.jobs?.map((job) => <Link key={job.id} href={`/busquedas/${job.id}`} className="mt-2 block rounded-lg bg-white p-2 font-semibold underline underline-offset-2">{job.title} · {job.company}</Link>)}</div>)}
      {busy && <p role="status" className="p-2 text-sm text-ink/70">Maru está preparando tu respuesta…</p>}<div ref={end} />
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    <form onSubmit={send} className="mt-3 space-y-3">
      <label className="flex min-h-11 items-center gap-2 text-xs leading-relaxed"><input type="checkbox" checked={useProfile} onChange={(e) => setUseProfile(e.target.checked)} className="h-4 w-4" />Usar mi perfil guardado para esta charla</label>
      <label htmlFor="maru-chat-message" className="block text-sm font-medium">Tu consulta</label><textarea id="maru-chat-message" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} disabled={busy} className="w-full resize-y rounded-xl border border-line p-3 text-base focus:outline-2 focus:outline-ink" placeholder="Por ejemplo: ¿cómo preparo una entrevista para producto?" />
      <button type="submit" disabled={busy || !text.trim()} className="press min-h-11 w-full rounded-full bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Preparando respuesta…" : "Enviar consulta"}</button>
    </form>
  </section>;
}
