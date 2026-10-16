import type { Metadata } from "next";
import CopyButton from "@/components/CopyButton";
import AutofillDemo from "@/components/landing/AutofillDemo";
import Reveal from "@/components/magic/Reveal";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Extensión para Chrome · Maru",
  description: "Cargá tu CV una vez y completá formularios de postulación con un clic. Vos revisás y enviás.",
};

const ZIP_URL = "/extension/maru-extension.zip";

export default function ExtensionPage() {
  return (
    <SiteShell tagline="Extensión para Chrome">
      <section className="relative overflow-hidden rounded-[32px] bg-sand px-6 py-12 sm:px-12 sm:py-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr] [&>*]:min-w-0">
          <div>
            <p className="animate-rise font-display text-sm font-bold uppercase tracking-[0.12em] text-brand">Extensión para Chrome</p>
            <h1 className="animate-rise mt-3 font-display [animation-delay:90ms]">
              <span className="block text-3xl font-light sm:text-4xl">Completá postulaciones</span>
              <span className="block text-5xl font-bold leading-[1.02] sm:text-7xl">
                con <span className="marker">un clic</span>
              </span>
            </h1>
            <p className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-muted [animation-delay:180ms]">
              Cargás tu CV una vez y Maru completa los formularios de postulación por vos. Vos revisás y enviás: nunca manda nada sola.
            </p>
            <div className="animate-rise [animation-delay:260ms]">
              <a
                href={ZIP_URL}
                download
                className="press group mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-10 py-4 font-display text-lg font-bold uppercase tracking-wide text-white hover:bg-black"
              >
                Descargar la extensión
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-y-0.5">
                  ↓
                </span>
              </a>
              <p className="mt-3 text-sm text-muted">Gratis · Chrome, Edge o Brave en la compu</p>
            </div>
          </div>
          <div className="animate-rise pb-6 [animation-delay:300ms]">
            <AutofillDemo />
          </div>
        </div>
      </section>

      <section aria-labelledby="instalar-t" className="mt-20">
        <h2 id="instalar-t" className="font-display text-4xl font-light uppercase sm:text-5xl">
          Instalala en <strong className="font-bold">1 minuto</strong>
        </h2>
        <Reveal as="div">
          <ol className="mt-8 grid gap-3 sm:grid-cols-2">
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
        </Reveal>
      </section>

      <section aria-labelledby="usar-t" className="mt-16 rounded-[32px] bg-sand p-6 sm:p-10">
        <h2 id="usar-t" className="font-display text-4xl">
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
    <li data-reveal style={{ "--i": n - 1 } as React.CSSProperties} className="flex gap-4 rounded-[24px] bg-paper p-5 ring-1 ring-line/70">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-bold text-white">{n}</span>
      <div className="leading-relaxed">{children}</div>
    </li>
  );
}
