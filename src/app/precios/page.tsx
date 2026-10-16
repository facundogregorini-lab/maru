import type { Metadata } from "next";
import Link from "next/link";
import SiteShell from "@/components/SiteShell";
import BillingPanel from "@/components/billing/BillingPanel";
import { landingData } from "@/lib/landing";
import { BILLING_ENABLED, FREE_LIMITS } from "@/lib/plans";

export const metadata: Metadata = { title: "Planes y precios · Maru", description: "Elegí tu plan de Maru: semanal, mensual o trimestral. CV a medida, cartas, entrevistas y videos sin esperar al día siguiente." };
// Los números del inventario se regeneran cada hora, como en la home.
export const revalidate = 3600;

const fmt = (n: number) => n.toLocaleString("es-AR");
const free = (k: keyof typeof FREE_LIMITS) => `${FREE_LIMITS[k].limit} por ${FREE_LIMITS[k].window === "dia" ? "día" : "semana"}`;

/** Fila de la tabla: `true` es ✓, `false` es ✕, un texto se muestra tal cual. */
const FEATURES: { name: string; benefit: string; paid: string | true; free: string | boolean; strong?: boolean }[] = [
  { name: "CV a medida y CV perfecto", benefit: "Pasá el ATS con las palabras exactas de la búsqueda", paid: "Ilimitado", free: free("cv"), strong: true },
  { name: "Carta de presentación", benefit: "Una carta distinta para cada empresa", paid: "Ilimitado", free: free("carta"), strong: true },
  { name: "Entrená para tu entrevista", benefit: "Practicá con repreguntas, como en la real", paid: "Ilimitado", free: free("entrevista") },
  { name: "Video de presentación", benefit: "Guion a medida y teleprompter", paid: "Ilimitado", free: free("video") },
  { name: "Respuesta más fuerte (STAR) en el informe", benefit: "Sabé cómo responder mejor cada pregunta", paid: true, free: false },
  { name: "Feedback de cámara en tu video", benefit: "Encuadre, luz, fondo y mirada en cada toma", paid: true, free: false },
  { name: "Descarga en Word", benefit: "Editá tu CV y tu carta donde quieras", paid: true, free: "Sólo PDF" },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <span aria-label="Incluido" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-light font-bold">✓</span>;
  if (value === false) return <span aria-label="No incluido" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-soft font-bold text-danger">✕</span>;
  return <span>{value}</span>;
}

export default async function PreciosPage() {
  const data = await landingData();
  const forAll = [
    `Búsquedas reales: ${fmt(data.total)} de ${fmt(data.companies)} empresas`,
    `Match con tu perfil (${fmt(data.eligible)} búsquedas desde Argentina)`,
    "Filtros por modalidad, área y seniority",
    "Seguimiento de postulaciones",
    "Chat con Maru sobre las búsquedas",
    "Extensión que completa postulaciones",
    "Perfil sincronizado entre dispositivos",
    "Descarga de CV y carta en PDF",
    "24 diseños de CV ATS-friendly",
  ];
  return <SiteShell>
    <section className="mx-auto max-w-5xl py-8 sm:py-14" aria-labelledby="planes-titulo">
      <p className="text-center text-sm font-bold uppercase tracking-wider text-ink/60">Tu próxima oportunidad empieza con vos</p>
      <h1 id="planes-titulo" className="mt-4 text-center font-display text-4xl font-bold uppercase leading-tight sm:text-6xl">Postulate sin esperar<br />a mañana.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-center text-lg leading-relaxed text-ink/70">El plan gratis te da pedidos cada día. Con un plan de Maru armás un CV y una carta para cada búsqueda que te interesa, y practicás todas las veces que quieras.</p>
      {!BILLING_ENABLED && <p className="mx-auto mt-6 max-w-2xl rounded-2xl bg-sand p-4 text-center leading-relaxed">Los planes todavía no están a la venta: hoy podés usar todas las herramientas gratis. Los precios y límites de abajo son los del lanzamiento.</p>}

      <div className="mt-12"><BillingPanel /></div>

      <div className="mt-12 overflow-hidden rounded-[24px] border border-line">
        <div className="flex flex-wrap items-baseline justify-between gap-2 bg-[#f2f4f5] px-5 py-4 sm:px-6">
          <h2 className="text-xl font-bold sm:text-2xl">Todo lo que incluyen los planes</h2>
          <Link href="/match" className="text-sm font-semibold underline underline-offset-4">Empezar gratis</Link>
        </div>
        <table className="w-full text-left text-sm sm:text-base">
          <thead className="text-xs uppercase tracking-wider text-ink/60">
            <tr className="border-b border-line">
              <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Función</th>
              <th scope="col" className="px-2 py-3 text-center font-semibold">Planes</th>
              <th scope="col" className="px-5 py-3 text-center font-semibold sm:px-6">Gratis</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => <tr key={f.name} className="border-b border-line last:border-0">
              <th scope="row" className="px-5 py-3.5 font-normal sm:px-6">
                <span className={f.strong ? "font-bold" : "font-medium"}>{f.name}</span>
                <span className="mt-0.5 block text-xs text-ink/60 sm:text-sm">{f.benefit}</span>
              </th>
              <td className="px-2 py-3.5 text-center">{f.paid === true ? <Cell value /> : <span className="inline-block rounded-full bg-brand-light px-3 py-1 text-sm font-semibold">{f.paid}</span>}</td>
              <td className="px-5 py-3.5 text-center text-ink/80 sm:px-6"><Cell value={f.free} /></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-center text-xs leading-relaxed text-ink/60">Ilimitado con uso razonable, para cuidar el servicio de todos. Los pedidos gratis diarios se renuevan a las 0 h (hora de Argentina) y los semanales, los lunes.</p>

      <div className="mt-12 rounded-[24px] bg-sand p-6 sm:p-8">
        <h2 className="text-center text-2xl font-bold">Gratis en todos los planes</h2>
        <p className="mt-2 text-center text-ink/70">Lo que necesitás para buscar con orden, sin tarjeta.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {forAll.map((item) => <li key={item} className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3"><span>{item}</span><Cell value /></li>)}
        </ul>
      </div>

      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {[
          ["¿Qué plan me conviene?", "Si tu búsqueda va a llevar más de un mes, el trimestral: sale $7.500 por mes. El semanal sirve para un empujón puntual, como preparar varias postulaciones o una entrevista esta semana."],
          ["¿Cómo se confirma el pago?", "Mercado Pago procesa la suscripción y nos confirma la acreditación. Volver a Maru desde el pago no activa por sí solo el plan. Si la confirmación tarda, usá Actualizar estado de mi pago."],
          ["¿Puedo cancelar o cambiar de plan?", "Sí. Cancelás la renovación desde esta página o desde tus suscripciones en Mercado Pago, y conservás el acceso hasta que termine el período pagado. Para cambiar de plan, cancelá la renovación y elegí el nuevo cuando termine."],
          ["¿Qué significa ilimitado?", "Que no contás pedidos: armás un CV, una carta o una práctica para cada búsqueda que te interese. Para cuidar el servicio hay un tope de uso razonable por día que una búsqueda normal no alcanza."],
          ["¿Qué pasa con mis datos?", "Sin cuenta, quedan en tu navegador. Al ingresar, perfil, preferencias y seguimiento se guardan también en tu cuenta. Los documentos que generás siguen en el navegador."],
          ["¿Maru me garantiza un trabajo?", "No. Maru te ayuda a preparar mejor cada postulación y cada entrevista; las decisiones son de cada empresa."],
        ].map(([q, a]) => <details key={q} className="rounded-2xl bg-[#f2f4f5] px-5 py-4"><summary className="min-h-8 cursor-pointer font-semibold">{q}</summary><p className="mt-3 leading-relaxed text-ink/75">{a}</p></details>)}
      </div>
    </section>
  </SiteShell>;
}
