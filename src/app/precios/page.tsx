import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import SubscribeButton from "@/components/plan/SubscribeButton";
import { FREE_MONTHLY_CREATIONS, PLAN_PRICE_ARS } from "@/lib/account";

export const metadata: Metadata = {
  title: "Precios · Maru",
  description: `Empezá gratis. El plan Maru cuesta $${PLAN_PRICE_ARS.toLocaleString("es-AR")} por mes y hace ilimitado todo lo que Maru arma para tu búsqueda.`,
};

const price = PLAN_PRICE_ARS.toLocaleString("es-AR");
const perDay = Math.round(PLAN_PRICE_ARS / 30).toLocaleString("es-AR");

const FREE = [
  "Búsquedas reales y match con tu CV, sin límite",
  "Seguimiento de postulaciones",
  "Extensión que completa formularios",
  `${FREE_MONTHLY_CREATIONS} creaciones por mes entre CV a medida, CV, carta, entrevista y video`,
];
const PLAN = [
  "Todo lo del plan gratis",
  "CV a medida de cada búsqueda, ilimitados",
  "Cartas de presentación ilimitadas",
  "Entrevistas de práctica con informe, ilimitadas",
  "Videos de presentación con feedback, ilimitados",
  "Descargas en PDF y Word",
];

const FAQ: [string, string][] = [
  ["¿Cómo se paga?", "Con Mercado Pago, con tarjeta o dinero en cuenta. Es una suscripción mensual en pesos: se renueva sola cada mes."],
  ["¿Puedo darlo de baja?", "Cuando quieras, desde «Mi cuenta». Seguís teniendo el plan hasta el final del mes pagado."],
  ["¿Y si me arrepiento?", "Tenés 10 días corridos desde la contratación para arrepentirte con el «Botón de arrepentimiento»: damos de baja el plan y te devolvemos lo que pagaste."],
  ["¿Qué es una creación?", "Cada CV a medida, CV, carta, entrevista de práctica o guion de video que Maru arma desde cero. Reescribir un párrafo, ajustar el diseño o completar formularios no cuenta."],
  ["¿Qué pasa con mis datos?", "Lo mismo que en el plan gratis: tu perfil y tus postulaciones viven en tu navegador. Para el plan guardamos sólo tu email y el estado de la suscripción."],
];

export default function PreciosPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl px-5 pb-10 pt-12 text-center sm:pt-16">
        <h1 className="font-display text-4xl font-bold uppercase leading-[1.05] sm:text-6xl">
          Empezá gratis.
          <br />
          <span className="font-light">Sumá el plan cuando lo necesites</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink/75">Usá Maru gratis todo lo que quieras. Cuando estés postulándote en serio, el plan hace ilimitado todo lo que Maru arma para tu búsqueda.</p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-5 md:grid-cols-2">
        <article className="flex flex-col rounded-[24px] bg-[#f2f4f5] p-7">
          <h2 className="text-xl font-bold">Gratis</h2>
          <p className="mt-3 font-display text-5xl font-extrabold">$0</p>
          <p className="mt-1 text-sm text-ink/60">Sin tarjeta</p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-white text-[9px] font-black ring-1 ring-black/15">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <Link href="/match" className="press mt-7 block rounded-full bg-white py-3 text-center font-semibold ring-1 ring-black/15 hover:bg-black/[0.04]">
            Empezar gratis
          </Link>
        </article>

        <article className="relative flex flex-col rounded-[24px] bg-ink p-7 text-white">
          <span className="absolute right-6 top-6 rounded-full bg-neon px-3 py-1 text-xs font-bold uppercase text-ink">Todo ilimitado</span>
          <h2 className="text-xl font-bold">Plan Maru</h2>
          <p className="mt-3 font-display text-5xl font-extrabold">
            ${price}
            <span className="ml-1 text-lg font-semibold text-white/60">/mes</span>
          </p>
          <p className="mt-1 text-sm text-neon">Son ${perDay} por día, en pesos.</p>
          <ul className="mt-6 flex-1 space-y-2.5 text-sm">
            {PLAN.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-neon text-[9px] font-black text-ink">✓</span>
                {f}
              </li>
            ))}
          </ul>
          <SubscribeButton className="maru-shine press relative mt-7 block w-full overflow-hidden rounded-full bg-neon py-3 text-center font-extrabold uppercase text-ink disabled:opacity-70" />
          <p className="mt-3 text-center text-xs text-white/60">Pagás con Mercado Pago. Lo das de baja cuando quieras.</p>
        </article>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-24 pt-16">
        <h2 className="text-center font-display text-3xl font-bold uppercase">Preguntas sobre el plan</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-2xl bg-[#f2f4f5] px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold [&::-webkit-details-marker]:hidden">{q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-ink/75">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center text-xs text-ink/50">
          Precio final en pesos argentinos. Ver{" "}
          <Link href="/terminos" className="underline underline-offset-4">
            términos
          </Link>{" "}
          y{" "}
          <Link href="/arrepentimiento" className="underline underline-offset-4">
            botón de arrepentimiento
          </Link>
          .
        </p>
      </section>
    </SiteShell>
  );
}
