"use client";

import { useEffect, useRef, useState } from "react";
import { load, save } from "@/lib/storage";
import { MaruHead } from "../maru/PixelMaru";
import { useAuth } from "./AuthProvider";

const LAST_EMAIL_KEY = "maru:email";

/**
 * Ingreso con Google (en una ventana aparte, para no perder lo que hay en esta pestaña) o con magic link.
 * Mientras espera, consulta la sesión cada 3 s (y escucha a la ventana de Google):
 * si la persona entra en otra pestaña o ventana de este navegador, este diálogo se entera solo y sigue.
 */
export default function LoginDialog({ open, reason, onClose, onLoggedIn }: { open: boolean; reason: string; onClose: () => void; onLoggedIn: () => void }) {
  const { refresh, google } = useAuth();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [withGoogle, setWithGoogle] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setEmail((e) => e || load<string>(LAST_EMAIL_KEY) || "");
      setSentTo(null);
      setWithGoogle(false);
      setError("");
      d.showModal();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || (!sentTo && !withGoogle)) return;
    const check = async () => {
      if (await refresh()) onLoggedIn();
    };
    const id = setInterval(check, 3000);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("maru-auth");
      channel.onmessage = (e) => {
        if (e.data === "ok") void check();
        else if (e.data === "error") {
          setWithGoogle(false);
          setError("No pudimos ingresar con Google. Probá de nuevo o usá tu email.");
        }
      };
    } catch {
      // sin BroadcastChannel: queda la consulta cada 3 s
    }
    return () => {
      clearInterval(id);
      channel?.close();
    };
  }, [open, sentTo, withGoogle, refresh, onLoggedIn]);

  function continueWithGoogle() {
    setError("");
    const next = encodeURIComponent(window.location.pathname);
    const w = window.open(`/api/auth/google?popup=1&next=${next}`, "maru-google", "popup,width=500,height=650");
    // Si el navegador bloquea la ventana, vamos a Google en esta misma pestaña (y volvemos a esta página).
    if (!w) return void window.location.assign(`/api/auth/google?next=${next}`);
    setWithGoogle(true);
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next: window.location.pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No pudimos enviarte el email.");
      save(LAST_EMAIL_KEY, email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="m-auto w-[calc(100%-32px)] max-w-[860px] overflow-hidden rounded-[28px] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
      aria-labelledby="login-title"
    >
      <div className="grid md:grid-cols-[1fr_1fr]">
      {/* Como el registro de jobright: a la izquierda la promesa, a la derecha el formulario. */}
      <div className="hidden flex-col justify-between bg-[radial-gradient(circle_at_20%_85%,rgba(0,240,160,0.55),transparent_55%),linear-gradient(135deg,#ffffff,#e9fbf3)] p-8 md:flex">
        <div>
          <p className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-neon">
              <MaruHead size={22} />
            </span>
            <span className="font-display text-2xl font-bold">Maru</span>
          </p>
          <p className="mt-10 text-[28px] leading-tight">
            <strong className="font-bold">Un camino rápido y claro</strong> a tu próximo trabajo
          </p>
          <hr className="mt-6 border-ink/10" />
        </div>
        <ul className="mt-10 space-y-2.5 text-sm">
          {[
            ["Búsquedas reales", "que podés tomar desde Argentina"],
            ["Tu CV a medida", "de cada búsqueda"],
            ["Postulaciones completas", "en 1 clic con la extensión"],
          ].map(([b, t]) => (
            <li key={b} className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-[10px] font-bold ring-1 ring-ink/20">✓</span>
              <span>
                <strong>{b}</strong> {t}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-6 sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-neon md:invisible">
            <MaruHead size={24} />
          </span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink">
            ✕
          </button>
        </div>

        {!sentTo ? (
          <form onSubmit={send}>
            <h2 id="login-title" className="mt-2 text-center text-2xl">
              Ingresá a <strong>Maru</strong>
            </h2>
            {reason !== "entrar a Maru" && <p className="mt-1 text-center text-sm text-muted">para {reason}</p>}
            {google && (
              <>
                <button
                  type="button"
                  onClick={continueWithGoogle}
                  className="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-white px-6 py-3 font-bold text-ink ring-1 ring-ink/20 transition hover:bg-[#f5f6f7] disabled:opacity-60"
                >
                  <GoogleIcon />
                  Continuar con Google
                </button>
                {withGoogle && (
                  <p aria-live="polite" className="mt-2 text-center text-xs text-muted">
                    Terminá en la ventana de Google: apenas entres, seguimos acá.
                  </p>
                )}
                <p className="mt-6 flex items-center gap-3 text-xs uppercase text-muted before:h-px before:flex-1 before:bg-ink/10 after:h-px after:flex-1 after:bg-ink/10">
                  o con tu email
                </p>
              </>
            )}
            <label className="sr-only" htmlFor="login-email">
              Tu email
            </label>
            <input
              id="login-email"
              ref={inputRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu email"
              className={`${google ? "mt-6" : "mt-8"} w-full rounded-lg bg-[#f5f6f7] px-4 py-3 text-base outline-none transition placeholder:text-ink/40 focus:ring-2 focus:ring-ink`}
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-brand-dark">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="mt-5 w-full rounded-lg bg-ink px-6 py-3 font-bold uppercase text-white transition hover:bg-black disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Mandame el link"}
            </button>
            <p className="mt-4 text-center text-xs leading-relaxed text-muted">
              Sin contraseña: {google ? "entrá con Google o con " : "te mandamos "}un link a tu email. Lo que armaste queda guardado mientras tanto.
            </p>
          </form>
        ) : (
          <div aria-live="polite">
            <h2 id="login-title" className="mt-4 font-display text-2xl tracking-tight">
              Revisá tu email
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Te mandamos un link a <span className="font-medium text-ink">{sentTo}</span>. Abrilo <b>en este mismo navegador</b>: apenas
              entres, seguimos donde estabas.
            </p>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-sm text-muted">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
              </span>
              Esperando que abras el link… (vence en 15 minutos)
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-brand-dark">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <button type="button" onClick={() => send()} disabled={sending} className="text-brand-dark underline underline-offset-4 disabled:opacity-60">
                {sending ? "Reenviando…" : "Reenviar el link"}
              </button>
              <button type="button" onClick={() => setSentTo(null)} className="text-muted underline underline-offset-4 hover:text-ink">
                Usar otro email
              </button>
            </div>
            <p className="mt-4 text-xs text-muted">¿No llega? Revisá spam o promociones.</p>
          </div>
        )}
      </div>
      </div>
    </dialog>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
