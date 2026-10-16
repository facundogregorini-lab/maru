import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import BillingPanel from "@/components/billing/BillingPanel";
import { BILLING_ENABLED, FREE_LIMITS, PAID_MONTHLY_LIMIT, PLAN_PRICE_TEXT } from "@/lib/plans";
export const metadata: Metadata = { title: "Planes y precios · Maru", description: "Conocé las opciones de Maru para organizar tu búsqueda laboral, crear tu CV y practicar entrevistas." };
export default function PreciosPage() {
  return <SiteShell>
    <section className="mx-auto max-w-5xl py-8 sm:py-14" aria-labelledby="planes-titulo">
      <p className="text-center text-sm font-bold uppercase tracking-wider text-ink/60">Tu próxima oportunidad empieza con vos</p>
      <h1 id="planes-titulo" className="mt-4 text-center font-display text-4xl font-bold uppercase leading-tight sm:text-6xl">Una búsqueda más organizada.<br />Un plan a tu medida.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-ink/70">Búsquedas reales, herramientas para mostrar tu experiencia y práctica para llegar mejor a cada entrevista.</p>
      {!BILLING_ENABLED && <p className="mx-auto mt-6 max-w-2xl rounded-2xl bg-sand p-4 text-center leading-relaxed">La suscripción todavía no está a la venta. Hoy podés probar todas las herramientas gratis. Los límites de abajo corresponden al lanzamiento del plan.</p>}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <article className="rounded-[24px] bg-[#f2f4f5] p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Para empezar</h2><p className="mt-4 font-display text-5xl font-bold">$0</p><p className="mt-2 text-ink/70">Sin tarjeta.</p>
          <ul className="mt-7 space-y-3 leading-relaxed">
            <li>Búsquedas, Match y seguimiento de postulaciones.</li><li>Perfil y seguimiento sincronizados al ingresar.</li>
            <li>{FREE_LIMITS.cv} pedidos de CV por mes, general o a medida.</li><li>{FREE_LIMITS.carta} carta, {FREE_LIMITS.entrevista} práctica de entrevista y {FREE_LIMITS.video} guion de video por mes.</li><li>Descargas con tu cuenta de email.</li>
          </ul>
          <Link href="/match" className="press mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 py-3 font-bold uppercase text-white">Empezar gratis</Link>
        </article>
        <article className="rounded-[24px] border-2 border-ink bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Maru con vos</h2><p className="mt-4 font-display text-5xl font-bold">{PLAN_PRICE_TEXT}<span className="ml-1 text-lg font-medium">/mes</span></p><p className="mt-2 text-ink/70">Pesos argentinos. Renovación mensual.</p>
          <ul className="mt-7 space-y-3 leading-relaxed"><li>Todo lo del plan gratis.</li><li>Hasta {PAID_MONTHLY_LIMIT} pedidos por mes entre CV, cartas, prácticas de entrevista y guiones.</li><li>Editor, diseños de CV y descargas incluidos.</li><li>Cancelás la renovación desde esta página.</li><li>Sin promesas de empleo: herramientas para preparar mejor tu búsqueda.</li></ul>
          <BillingPanel />
        </article>
      </div>
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {[["¿Cómo se confirma el pago?", "Mercado Pago procesa la suscripción y nos confirma la acreditación. Volver a Maru desde el pago no activa por sí solo el plan. Si la confirmación tarda, usá Actualizar estado de mi pago."], ["¿Puedo cancelar?", "Sí. Cancelás la renovación desde esta página o desde tus suscripciones en Mercado Pago. Conservás el acceso hasta que termine el período ya pagado."], ["¿Cuándo se renuevan los límites?", "Los pedidos disponibles se renuevan al empezar cada mes calendario, en horario UTC. Los límites protegen la disponibilidad del servicio; no garantizan respuestas de empleadores ni entrevistas."], ["¿Qué pasa con mis datos?", "Sin cuenta, quedan en tu navegador. Al ingresar, perfil, preferencias y seguimiento se guardan también en tu cuenta. Los documentos que generás siguen en el navegador."]].map(([q,a]) => <details key={q} className="rounded-2xl bg-[#f2f4f5] px-5 py-4"><summary className="min-h-8 cursor-pointer font-semibold">{q}</summary><p className="mt-3 leading-relaxed text-ink/75">{a}</p></details>)}
      </div>
    </section>
  </SiteShell>;
}
