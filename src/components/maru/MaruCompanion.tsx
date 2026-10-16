"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { load, save } from "@/lib/storage";
import {
  GUIDE_KEY,
  GUIDE_STEPS,
  NEW_GUIDE,
  PLAN_PER_DAY_TEXT,
  PLAN_PRICE_TEXT,
  type GuideState,
} from "./guide";
import { MaruDesk, MaruHead } from "./PixelMaru";
import type { DeskFrame } from "./sprite";

/**
 * Maru en su rincón: sentada en su escritorio, tipeando, con el mate humeando. No sigue al mouse.
 * La primera vez levanta la vista, saluda y ofrece un recorrido corto por todo lo que hace,
 * en modo checklist. Al final, si no sos cliente, la oferta. Tocándola, el recorrido vuelve.
 */

type Mode = "work" | "ask" | "guide" | "mini";

const OFFER = GUIDE_STEPS.length; // el paso que viene después de los productos
const ASK_AFTER_MS = 2600;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function MaruCompanion() {
  const path = usePathname();
  const svg = useRef<SVGSVGElement>(null);
  const [guide, setGuideState] = useState<GuideState>(NEW_GUIDE);
  const [mode, setModeState] = useState<Mode>("work");
  const [client, setClient] = useState(false);
  const [ready, setReady] = useState(false);
  const hopEl = useRef<HTMLSpanElement>(null);
  /** El panel toma el foco sólo si lo abrió la persona (no al cargar la página). */
  const focusPanel = useRef(false);

  // El "director" de la animación lee esto sin re-render.
  const modeRef = useRef<Mode>("work");
  const waveRef = useRef(0);
  const talkUntil = useRef(0);
  const hover = useRef(false);
  const kickRef = useRef<() => void>(() => {});

  const setGuide = useCallback((fn: (g: GuideState) => GuideState) => {
    setGuideState((g) => {
      const next = fn(g);
      save(GUIDE_KEY, next);
      return next;
    });
  }, []);

  const setMode = useCallback((m: Mode, opts: { wave?: boolean; talk?: boolean } = {}) => {
    modeRef.current = m;
    if (opts.wave) waveRef.current = 8;
    if (opts.talk) talkUntil.current = Date.now() + 1300;
    setModeState(m);
    if (opts.wave && hopEl.current) {
      // Un saltito al levantar la vista (reiniciamos la animación sin re-render).
      const el = hopEl.current;
      el.classList.remove("maru-hop");
      void el.offsetWidth;
      el.classList.add("maru-hop");
    }
    kickRef.current();
  }, []);

  const { email: accountEmail } = useAuth();
  useEffect(() => {
    let active = true;
    setClient(false);
    if (accountEmail) fetch("/api/billing/status", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).then((s) => { if (active) setClient(s?.plan === "maru"); }).catch(() => {});
    return () => { active = false; };
  }, [accountEmail]);

  // El recorrido es local; el plan se consulta al servidor.
  useEffect(() => {
    const g = { ...NEW_GUIDE, ...(load<GuideState>(GUIDE_KEY) ?? {}) };
    setGuideState(g);
    setReady(true);
    if (g.status === "abierta") setMode(g.min ? "mini" : "guide");
    if (g.status !== "nueva") return;
    const t = window.setTimeout(() => setMode("ask", { wave: true, talk: true }), ASK_AFTER_MS);
    return () => clearTimeout(t);
  }, [setMode]);

  // Visitar la página de un producto tilda su ítem del checklist.
  useEffect(() => {
    if (!ready) return;
    const step = GUIDE_STEPS.find((s) => path === s.href || path.startsWith(`${s.href}/`));
    if (step) setGuide((g) => (g.done.includes(step.id) ? g : { ...g, done: [...g.done, step.id] }));
  }, [path, ready, setGuide]);

  // El director: elige el frame según lo que esté haciendo Maru.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = (f: DeskFrame) => {
      if (el.dataset.frame !== f) el.dataset.frame = f;
    };
    let timer = 0;
    let typing = 0; // golpes de teclado que le quedan a la ráfaga
    let flip = false;
    let lastBlink = Date.now();

    const next = () => {
      clearTimeout(timer);
      const m = modeRef.current;
      const now = Date.now();
      let wait = 140;

      if (reduce) {
        frame(m === "work" ? "think" : "look");
        return;
      }
      if (m !== "work" || hover.current) {
        // Te mira: saluda, habla un poquito y parpadea de a ratos.
        if (waveRef.current > 0) {
          waveRef.current--;
          frame(waveRef.current % 2 ? "wave" : "wave2");
          wait = 170;
        } else if (talkUntil.current > now) {
          flip = !flip;
          frame(flip ? "talk" : "look");
          wait = 130;
        } else if (now - lastBlink > rand(2600, 4200)) {
          frame("blink");
          lastBlink = now;
          wait = 150;
        } else {
          frame("look");
          wait = 220;
        }
      } else if (typing > 0) {
        typing--;
        flip = !flip;
        frame(flip ? "typeA" : "typeB");
        wait = rand(110, 170);
      } else {
        const r = Math.random();
        if (r < 0.1) {
          frame("look"); // levanta la vista un segundo
          wait = rand(1100, 1700);
        } else if (r < 0.32) {
          frame(now - lastBlink > 2500 ? "blink" : "think");
          lastBlink = now;
          wait = rand(500, 1300);
        } else {
          typing = Math.round(rand(8, 22));
          wait = 60;
        }
      }
      timer = window.setTimeout(next, wait);
    };
    kickRef.current = next;
    next();
    return () => clearTimeout(timer);
  }, []);

  const open = useCallback(
    (step?: number) => {
      focusPanel.current = true;
      setGuide((g) => ({ ...g, status: "abierta", min: false, step: step ?? (g.status === "terminada" ? 0 : g.step) }));
      setMode("guide", { talk: true });
    },
    [setGuide, setMode],
  );

  const close = useCallback(
    (status: GuideState["status"]) => {
      setGuide((g) => ({ ...g, status, min: false }));
      setMode("work");
    },
    [setGuide, setMode],
  );

  const goTo = useCallback(
    (step: number) => {
      setGuide((g) => {
        const cur = GUIDE_STEPS[g.step];
        // Avanzar tilda el paso en el que estaba.
        const done = cur && step > g.step && !g.done.includes(cur.id) ? [...g.done, cur.id] : g.done;
        return { ...g, step: Math.max(0, Math.min(OFFER, step)), done };
      });
      talkUntil.current = Date.now() + 1100;
      kickRef.current();
    },
    [setGuide],
  );

  /** "Probarlo": se achica para no tapar y te espera en el rincón. */
  const tryIt = useCallback(() => {
    setGuide((g) => {
      const cur = GUIDE_STEPS[g.step];
      return { ...g, min: true, done: cur && !g.done.includes(cur.id) ? [...g.done, cur.id] : g.done };
    });
    setMode("mini");
  }, [setGuide, setMode]);

  // En celular se corre mientras scrolleás (para no tapar lo que leés) y vuelve al frenar.
  const dock = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    let t = 0;
    const onScroll = () => {
      if (window.innerWidth >= 640 || modeRef.current !== "work") return;
      el.dataset.away = "1";
      clearTimeout(t);
      t = window.setTimeout(() => delete el.dataset.away, 900);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);

  const onMaru = () => {
    if (mode === "guide") return close("cerrada");
    if (mode === "ask") return open(0);
    open();
  };

  return (
    <div ref={dock} className="maru-dock pointer-events-none fixed bottom-3 right-3 z-50 flex flex-col items-end print:hidden sm:bottom-4 sm:right-5">
      {mode === "ask" && (
        <Ask
          onYes={() => open(0)}
          onNo={() => {
            close("rechazada");
          }}
        />
      )}
      {mode === "guide" && <Guide focus={focusPanel} state={guide} client={client} onGo={goTo} onTry={tryIt} onClose={() => close("cerrada")} onFinish={() => close("terminada")} />}
      {mode === "mini" && (
        <button
          type="button"
          onClick={() => open()}
          className="maru-panel-in maru-glow pointer-events-auto mb-2 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-black"
        >
          Seguimos el recorrido · {Math.min(guide.done.length, GUIDE_STEPS.length)}/{GUIDE_STEPS.length} →
        </button>
      )}

      <button
        type="button"
        onClick={onMaru}
        onPointerEnter={() => {
          hover.current = true;
          kickRef.current();
        }}
        onPointerLeave={() => {
          hover.current = false;
          kickRef.current();
        }}
        aria-label={mode === "guide" ? "Cerrar el recorrido de Maru" : "Maru: hacer el recorrido por todo lo que hace"}
        aria-expanded={mode === "guide"}
        data-mode={mode}
        className={`maru-desk maru-scale group pointer-events-auto relative block rounded-2xl outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ink ${ready ? "opacity-100" : "opacity-0"}`}
      >
        <span ref={hopEl} className="relative block">
          <MaruDesk ref={svg} size={84} />
          {/* Vapor del mate */}
          <span aria-hidden className="maru-steam absolute left-[76px] top-[30px] h-[3px] w-[3px] bg-[#b9c0c7]" />
          <span aria-hidden className="maru-steam absolute left-[79px] top-[27px] h-[3px] w-[3px] bg-[#b9c0c7] [animation-delay:1.2s]" />
          {/* Lo que va saliendo de la compu mientras trabaja */}
          {[
            ["</>", "-22px", "0s"],
            ["✓", "-8px", "1.2s"],
            ["{ }", "-34px", "2.4s"],
          ].map(([t, dx, delay]) => (
            <span
              key={t}
              aria-hidden
              className="maru-code absolute left-[2px] top-[34px] rounded bg-ink px-1 font-mono text-[9px] font-bold leading-[14px] text-neon"
              style={{ "--dx": dx, animationDelay: delay } as React.CSSProperties}
            >
              {t}
            </span>
          ))}
        </span>
        <span aria-hidden className="mx-auto -mt-0.5 block h-1.5 w-[88px] rounded-full bg-black/10 blur-[2px]" />
        {mode === "work" && (
          <span className="pointer-events-none absolute -top-7 right-0 whitespace-nowrap rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold opacity-0 shadow-md ring-1 ring-black/5 transition-opacity group-hover:opacity-100">
            ¿Te muestro todo? 👋
          </span>
        )}
      </button>
    </div>
  );
}

function Ask({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div role="dialog" aria-label="Maru te saluda" className="maru-panel-in pointer-events-auto relative mb-3 w-[min(300px,calc(100vw-24px))] rounded-[20px] bg-white p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
      <p className="text-[15px] font-semibold leading-snug">¡Hola! Soy Maru 👋</p>
      <p className="mt-1 text-sm leading-snug text-ink/75">¿Te muestro en un minuto todo lo que puedo hacer por vos?</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onYes} className="press maru-glow rounded-full bg-neon px-4 py-2 text-sm font-bold">
          ¡Dale!
        </button>
        <button type="button" onClick={onNo} className="rounded-full px-3 py-2 text-sm text-ink/60 hover:bg-black/[0.05] hover:text-ink">
          Ahora no
        </button>
      </div>
      <span aria-hidden className="absolute -bottom-2 right-10 h-4 w-4 rotate-45 bg-white ring-0" />
    </div>
  );
}

function Guide({
  focus,
  state,
  client,
  onGo,
  onTry,
  onClose,
  onFinish,
}: {
  focus: React.RefObject<boolean>;
  state: GuideState;
  client: boolean;
  onGo: (step: number) => void;
  onTry: () => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const total = GUIDE_STEPS.length;
  const done = GUIDE_STEPS.filter((s) => state.done.includes(s.id)).length;
  const step = GUIDE_STEPS[state.step];
  const isOffer = state.step >= OFFER;

  useEffect(() => {
    if (!focus.current) return;
    focus.current = false;
    panel.current?.focus();
  }, [focus]);

  // Teclado sólo con el foco en el panel: nunca le gana a lo que la persona está escribiendo en la página.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowRight" && !isOffer) onGo(state.step + 1);
    if (e.key === "ArrowLeft") onGo(state.step - 1);
  };

  return (
    <div
      ref={panel}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="dialog"
      aria-label="Recorrido con Maru"
      className="maru-panel-in pointer-events-auto relative mb-3 flex max-h-[calc(100dvh-140px)] w-[min(372px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_30px_80px_-24px_rgba(0,0,0,0.45)] outline-none ring-1 ring-black/5"
    >
      {/* Encabezado con progreso */}
      <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neon">
          <MaruHead size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Recorrido con Maru</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eceef0]">
              <span className="block h-full rounded-full bg-neon transition-[width] duration-700 ease-out" style={{ width: `${(done / total) * 100}%` }} />
            </span>
            <span className="text-[11px] tabular-nums text-ink/60">
              {done}/{total}
            </span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar el recorrido" className="grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-ink/50 hover:bg-black/[0.05] hover:text-ink">
          ×
        </button>
      </div>

      <div className="overflow-y-auto overscroll-contain">
        {isOffer ? (
          <Offer key="offer" client={client} sawAll={done === total} onFinish={onFinish} />
        ) : (
          <div key={step.id} className="maru-step-in px-4 pb-3 pt-4">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#b5ffe4,#d2ffc8)] text-xl" aria-hidden>
                {step.emoji}
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">
                  Paso {state.step + 1} de {total}
                </p>
                <h2 className="text-lg font-bold leading-tight">{step.title}</h2>
              </div>
            </div>
            <p className="mt-2.5 text-sm leading-relaxed text-ink/80">{step.text}</p>
            <div className="mt-3 flex items-center gap-2">
              <Link href={step.href} onClick={onTry} className="press rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white hover:bg-black">
                {step.cta} →
              </Link>
              <button type="button" onClick={() => onGo(state.step - 1)} disabled={state.step === 0} className="ml-auto rounded-full px-3 py-2 text-[13px] text-ink/60 hover:bg-black/[0.05] disabled:invisible">
                Atrás
              </button>
              <button type="button" onClick={() => onGo(state.step + 1)} className="press rounded-full bg-neon px-4 py-2 text-[13px] font-bold">
                {state.step === total - 1 ? "¡Listo!" : "Siguiente"}
              </button>
            </div>
          </div>
        )}

        {/* El checklist: se tilda a medida que avanzás o visitás cada producto */}
        <ol className={`${isOffer ? "hidden" : "grid"} grid-cols-1 gap-0.5 border-t border-black/[0.06] px-2 py-2 min-[380px]:grid-cols-2`}>
          {GUIDE_STEPS.map((s, i) => {
            const ok = state.done.includes(s.id);
            const on = i === state.step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onGo(i)}
                  aria-current={on ? "step" : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors ${on ? "bg-[#f2f4f5] font-semibold" : "hover:bg-black/[0.04]"}`}
                >
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${ok ? "bg-neon text-ink" : "ring-1 ring-black/20"}`}>
                    {ok && (
                      <span key={`ok-${s.id}`} className="maru-pop font-black">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className={`truncate ${ok && !on ? "text-ink/50 line-through decoration-ink/30" : ""}`}>{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** El final: si no es cliente, la oferta "no-brainer"; si ya lo es, gracias. */
function Offer({ client, sawAll, onFinish }: { client: boolean; sawAll: boolean; onFinish: () => void }) {
  if (client)
    return (
      <div className="maru-step-in px-4 py-5 text-center">
        <p className="text-3xl" aria-hidden>
          💚
        </p>
        <h2 className="mt-2 text-lg font-bold">¡Ya tenés todo Maru!</h2>
        <p className="mt-1 text-sm text-ink/75">Gracias por confiar. Cuando quieras, tocame y repasamos lo que necesites.</p>
        <button type="button" onClick={onFinish} className="press mt-4 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white">
          ¡Gracias, Maru!
        </button>
      </div>
    );

  const perks = ["Match con búsquedas reales", "CV y carta a medida de cada aviso", "Extensión que completa formularios", "Entrevistas de práctica con informe", "Video con teleprompter y feedback", "Tu seguimiento, todo en un lugar"];
  return (
    <div className="maru-step-in relative overflow-hidden px-4 pb-4 pt-5">
      <Confetti />
      <p className="text-center text-[11px] font-bold uppercase tracking-wide text-ink/50">{sawAll ? "Ya lo viste todo 🎉" : "Llegaste al final 🎉"}</p>
      <h2 className="mt-1 text-center text-xl font-extrabold leading-tight">Todo Maru, para toda tu búsqueda</h2>
      <div className="mt-3 rounded-2xl bg-ink px-4 py-4 text-center text-white">
        <p className="font-display text-[40px] font-extrabold leading-none tracking-tight">
          {PLAN_PRICE_TEXT}
          <span className="ml-1 text-base font-semibold text-white/70">/mes</span>
        </p>
        <p className="mt-1.5 text-xs text-neon">Con el plan trimestral: {PLAN_PER_DAY_TEXT} por día, en pesos.</p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {perks.map((p, i) => (
          <li key={p} className="maru-step-in flex items-center gap-2 text-[13px]" style={{ animationDelay: `${200 + i * 90}ms` }}>
            <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-neon text-[9px] font-black">✓</span>
            {p}
          </li>
        ))}
      </ul>
      <Link href="/precios" onClick={onFinish} className="maru-shine press relative mt-4 block overflow-hidden rounded-full bg-neon py-3 text-center text-[15px] font-extrabold uppercase">Conocer los planes</Link>
      <p className="mt-2 text-center text-[11px] text-ink/60">Consultá disponibilidad, límites y condiciones antes de contratar.</p>
      <button type="button" onClick={onFinish} className="mt-2 block w-full rounded-full py-2 text-center text-[13px] text-ink/60 hover:bg-black/[0.04] hover:text-ink">
        Ahora no, gracias
      </button>
    </div>
  );
}

/** Papelitos de pixel que saltan al llegar a la oferta. */
function Confetti() {
  const colors = ["#00f0a0", "#111", "#2457d6", "#d4831c", "#e2553d", "#7a3fd1"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        const d = 70 + (i % 5) * 18;
        return (
          <span
            key={i}
            className="maru-confetti absolute h-1.5 w-1.5"
            style={
              {
                background: colors[i % colors.length],
                "--dx": `${Math.round(Math.cos(a) * d)}px`,
                "--dy": `${Math.round(Math.sin(a) * d * 0.7 + 30)}px`,
                "--r": `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
                animationDelay: `${(i % 4) * 40}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
