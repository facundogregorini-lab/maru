"use client";

import { useEffect, useRef, useState } from "react";
import { capture } from "@/lib/tracking/posthog";
import { MaruHead } from "../maru/PixelMaru";
import { useAuth } from "./AuthProvider";

/**
 * Ingreso con Google, en una ventana aparte para no perder lo que hay en esta pestaña.
 * Mientras espera, consulta la sesión cada 3 s (y escucha a la ventana de Google):
 * si la persona entra en otra pestaña o ventana de este navegador, este diálogo se entera solo y sigue.
 */
export default function LoginDialog({ open, reason, onClose, onLoggedIn }: { open: boolean; reason: string; onClose: () => void; onLoggedIn: () => void }) {
  const { refresh, google } = useAuth();
  const [withGoogle, setWithGoogle] = useState(false);
  const [error, setError] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Para el funnel: si se cierra sin haber ingresado, es un abandono del login.
  const loggedIn = useRef(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      setWithGoogle(false);
      setError("");
      loggedIn.current = false;
      capture("login_pedido", { motivo: reason });
      d.showModal();
      setTimeout(() => buttonRef.current?.focus(), 50);
    }
    if (!open && d.open) d.close();
  }, [open, reason]);

  useEffect(() => {
    if (!open || !withGoogle) return;
    const check = async () => {
      if (loggedIn.current || !(await refresh())) return;
      loggedIn.current = true;
      capture("login_ok", { via: "ventana" });
      onLoggedIn();
    };
    const id = setInterval(check, 3000);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel("maru-auth");
      channel.onmessage = (e) => {
        if (e.data === "ok") void check();
        else if (e.data === "error") {
          capture("login_error", { via: "ventana" });
          setWithGoogle(false);
          setError("No pudimos ingresar con Google. Probá de nuevo.");
        }
      };
    } catch {
      // sin BroadcastChannel: queda la consulta cada 3 s
    }
    return () => {
      clearInterval(id);
      channel?.close();
    };
  }, [open, withGoogle, refresh, onLoggedIn]);

  function continueWithGoogle() {
    setError("");
    const next = encodeURIComponent(window.location.pathname);
    const w = window.open(`/api/auth/google?popup=1&next=${next}`, "maru-google", "popup,width=500,height=650");
    capture("login_google", { ventana: w ? "aparte" : "misma_pestana" });
    // Si el navegador bloquea la ventana, vamos a Google en esta misma pestaña (y volvemos a esta página).
    if (!w) return void window.location.assign(`/api/auth/google?next=${next}`);
    setWithGoogle(true);
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={() => {
        if (!loggedIn.current) capture("login_cerrado", { motivo: reason, con_google: withGoogle });
        onClose();
      }}
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

        <h2 id="login-title" className="mt-2 text-center text-2xl">
          Ingresá a <strong>Maru</strong>
        </h2>
        {reason !== "entrar a Maru" && <p className="mt-1 text-center text-sm text-muted">para {reason}</p>}
        {google ? (
          <>
            <button
              ref={buttonRef}
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
          </>
        ) : (
          <p className="mt-8 rounded-2xl bg-sand px-4 py-3 text-center text-sm text-muted">El ingreso no está disponible en este momento. Probá en un rato.</p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-center text-sm text-brand-dark">
            {error}
          </p>
        )}
        <p className="mt-4 text-center text-xs leading-relaxed text-muted">Sin contraseña: entrás con tu cuenta de Google. Lo que armaste queda guardado mientras tanto.</p>
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
