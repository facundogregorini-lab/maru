"use client";

import { useEffect, useRef, useState } from "react";
import { load, save } from "@/lib/storage";
import { useAuth } from "./AuthProvider";

const LAST_EMAIL_KEY = "maru:email";

/**
 * Pide el email y manda el magic link. Mientras espera, consulta la sesión cada 3 s:
 * si la persona abre el link en otra pestaña de este navegador, este diálogo se entera solo y sigue.
 */
export default function LoginDialog({ open, reason, onClose, onLoggedIn }: { open: boolean; reason: string; onClose: () => void; onLoggedIn: () => void }) {
  const { refresh, googleEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [waitingGoogle, setWaitingGoogle] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
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
      setWaitingGoogle(false);
      setError("");
      d.showModal();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || !sentTo) return;
    const id = setInterval(async () => {
      if (await refresh()) onLoggedIn();
    }, 3000);
    return () => clearInterval(id);
  }, [open, sentTo, refresh, onLoggedIn]);

  // Ventana de Google abierta: la sesión es la misma cookie, así que alcanza con consultarla.
  // (Google puede cortar el vínculo con la ventana emergente, por eso no dependemos sólo del mensaje.)
  useEffect(() => {
    if (!open || !waitingGoogle) return;
    let done = false;
    const check = async () => {
      if (done) return;
      if (await refresh()) {
        done = true;
        setWaitingGoogle(false);
        onLoggedIn();
      }
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "maru:auth") return;
      if (e.data.result === "ok") check();
      else {
        setWaitingGoogle(false);
        setError(e.data.result === "google-cancelado" ? "Cancelaste el ingreso con Google." : "No pudimos completar el ingreso con Google. Probá de nuevo o pedí el link por email.");
      }
    };
    window.addEventListener("message", onMessage);
    const id = setInterval(check, 1500);
    const stop = setTimeout(() => setWaitingGoogle(false), 3 * 60_000);
    return () => {
      done = true;
      window.removeEventListener("message", onMessage);
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [open, waitingGoogle, refresh, onLoggedIn]);

  function google() {
    setError("");
    const next = window.location.pathname + window.location.search;
    const url = `/api/auth/google?next=${encodeURIComponent(next)}`;
    // Ventana emergente para no perder lo que la persona está armando; si el navegador la bloquea, redirigimos.
    const w = window.open(`${url}&popup=1`, "maru-google", "width=500,height=640");
    if (!w) {
      window.location.href = url;
      return;
    }
    setWaitingGoogle(true);
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
      className="m-auto w-[calc(100%-32px)] max-w-md rounded-3xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]"
      aria-labelledby="login-title"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-clay font-serif text-lg text-paper">m</span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink">
            ✕
          </button>
        </div>

        {!sentTo ? (
          <form onSubmit={send}>
            <h2 id="login-title" className="mt-4 font-serif text-2xl tracking-tight">
              Ingresá para {reason}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Sin contraseña: {googleEnabled ? "entrá con tu cuenta de Google o te mandamos un link a tu email" : "te mandamos un link a tu email y listo"}. Este
              navegador te va a recordar.
            </p>
            {googleEnabled && (
              <>
                <button
                  type="button"
                  onClick={google}
                  disabled={waitingGoogle}
                  className="mt-5 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-paper px-6 py-3 font-medium transition hover:border-clay disabled:opacity-60"
                >
                  <GoogleLogo />
                  {waitingGoogle ? "Terminá en la ventana de Google…" : "Continuar con Google"}
                </button>
                {waitingGoogle && (
                  <p className="mt-2 text-center text-xs text-muted">
                    ¿No se abrió?{" "}
                    <a href={`/api/auth/google?next=${encodeURIComponent(typeof window === "undefined" ? "/" : window.location.pathname)}`} className="underline underline-offset-4">
                      Seguí en esta pestaña
                    </a>
                  </p>
                )}
                <div className="mt-5 flex items-center gap-3 text-xs text-muted">
                  <span className="h-px flex-1 bg-line" />o con tu email<span className="h-px flex-1 bg-line" />
                </div>
              </>
            )}
            <label className="mt-5 block text-sm font-medium" htmlFor="login-email">
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
              placeholder="nombre@mail.com"
              className="mt-1.5 w-full rounded-xl border border-line bg-cream px-4 py-3 text-base outline-none transition focus:border-clay focus:ring-4 focus:ring-clay-soft"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-clay-dark">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="mt-5 w-full rounded-full bg-clay px-6 py-3 font-medium text-paper transition hover:bg-clay-dark disabled:opacity-60"
            >
              {sending ? "Enviando…" : "Mandame el link"}
            </button>
            <p className="mt-3 text-center text-xs text-muted">Lo que armaste queda guardado: no perdés nada mientras tanto.</p>
          </form>
        ) : (
          <div aria-live="polite">
            <h2 id="login-title" className="mt-4 font-serif text-2xl tracking-tight">
              Revisá tu email
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Te mandamos un link a <span className="font-medium text-ink">{sentTo}</span>. Abrilo <b>en este mismo navegador</b>: apenas
              entres, seguimos donde estabas.
            </p>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-sand px-4 py-3 text-sm text-muted">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-clay/60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-clay" />
              </span>
              Esperando que abras el link… (vence en 15 minutos)
            </div>
            {error && (
              <p role="alert" className="mt-2 text-sm text-clay-dark">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <button type="button" onClick={() => send()} disabled={sending} className="text-clay-dark underline underline-offset-4 disabled:opacity-60">
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
    </dialog>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
