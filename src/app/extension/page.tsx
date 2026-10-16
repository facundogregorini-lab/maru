import type { Metadata } from "next";
import CopyButton from "@/components/CopyButton";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Extensión para Chrome · Maru",
  description: "Cargá tu CV una vez y completá formularios de postulación con un clic. Vos revisás y enviás.",
};

const ZIP_URL = "/extension/maru-extension.zip";

export default function ExtensionPage() {
  return (
    <SiteShell tagline="Extensión para Chrome">
      <section className="animate-rise rounded-[2rem] bg-sand px-6 py-10 sm:px-12 sm:py-14">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-celeste">Extensión para Chrome</p>
        <h1 className="mt-3 max-w-2xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl">
          Completá postulaciones con <em className="text-celeste">un clic</em>.
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
          Cargás tu CV una vez y Maru completa los formularios de postulación por vos. Vos revisás y enviás: nunca manda nada sola.
        </p>
        <a
          href={ZIP_URL}
          download
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-celeste px-7 py-3.5 font-medium text-white transition hover:bg-celeste-dark"
        >
          Descargar la extensión <span aria-hidden>↓</span>
        </a>
        <p className="mt-3 text-sm text-muted">Gratis · Chrome, Edge o Brave en la compu</p>
      </section>

      <section aria-labelledby="instalar-t" className="mt-12">
        <h2 id="instalar-t" className="font-serif text-3xl tracking-tight">
          Instalala en 1 minuto
        </h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2">
          <Step n={1}>
            <strong>Descomprimí</strong> el archivo que bajaste: queda una carpeta <code className="rounded bg-sand px-1.5">maru-extension</code>.
          </Step>
          <Step n={2}>
            <span className="flex flex-wrap items-center gap-2">
              Abrí <code className="rounded bg-sand px-1.5">chrome://extensions</code>
              <CopyButton text="chrome://extensions" />
            </span>
            <span className="mt-1 block">
              en una pestaña nueva y activá <strong>Modo de desarrollador</strong> (arriba a la derecha).
            </span>
          </Step>
          <Step n={3}>
            Tocá <strong>Cargar descomprimida</strong> y elegí la carpeta <code className="rounded bg-sand px-1.5">maru-extension</code>.
          </Step>
          <Step n={4}>
            Fijala con el ícono de la pieza de rompecabezas, abrila y <strong>subí tu CV</strong>.
          </Step>
        </ol>
      </section>

      <section aria-labelledby="usar-t" className="mt-12 rounded-3xl border border-line bg-paper p-6 sm:p-10">
        <h2 id="usar-t" className="font-serif text-3xl tracking-tight">
          Cómo se usa
        </h2>
        <ul className="mt-5 space-y-3 text-lg leading-relaxed text-muted">
          <li>
            En cualquier postulación, tocá la extensión y <strong className="text-ink">Completar esta postulación</strong> (o{" "}
            <kbd className="rounded border border-line bg-sand px-1.5 text-sm">Alt</kbd> + <kbd className="rounded border border-line bg-sand px-1.5 text-sm">Shift</kbd> +{" "}
            <kbd className="rounded border border-line bg-sand px-1.5 text-sm">M</kbd>).
          </li>
          <li>
            <span className="font-medium text-[#4a5f43]">Verde</span>: salió de tu CV. <span className="font-medium text-[#8a6418]">Amarillo</span>: lo redactó Maru o falta
            completarlo, revisalo.
          </li>
          <li>Tu CV queda guardado sólo en tu navegador. Género, diversidad y aceptaciones legales los completás siempre vos.</li>
        </ul>
      </section>
    </SiteShell>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 rounded-3xl border border-line bg-paper p-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-celeste-soft font-serif text-lg text-celeste-dark">{n}</span>
      <div className="leading-relaxed">{children}</div>
    </li>
  );
}
