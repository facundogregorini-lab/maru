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
      <section className="relative isolate overflow-hidden rounded-[32px] bg-paper px-6 py-12 ring-1 ring-line/70 sm:px-12 sm:py-16">
        <div aria-hidden className="aurora -z-10" />
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr] [&>*]:min-w-0">
          <div>
            <p className="animate-rise inline-flex items-center gap-2 rounded-full bg-paper/80 px-3 py-1 text-sm font-medium text-celeste-dark ring-1 ring-celeste/15">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-celeste" />
              Extensión para Chrome
            </p>
            <h1 className="animate-rise mt-5 font-serif text-[2.6rem] leading-[1.02] [animation-delay:90ms] sm:text-6xl">
              Completá postulaciones con <em className="shine-text -mr-[0.06em] pr-[0.06em]">un clic</em>.
            </h1>
            <p className="animate-rise mt-5 max-w-xl text-lg leading-relaxed text-muted [animation-delay:180ms]">
              Cargás tu CV una vez y Maru completa los formularios de postulación por vos. Vos revisás y enviás: nunca manda nada sola.
            </p>
            <div className="animate-rise [animation-delay:260ms]">
              <a
                href={ZIP_URL}
                download
                className="beam press group mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 font-medium text-paper shadow-[0_18px_40px_-18px_rgba(14,27,44,0.7)] hover:bg-celeste-dark"
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
        <h2 id="instalar-t" className="font-serif text-4xl sm:text-5xl">
          Instalala en <em className="text-celeste">1 minuto</em>
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

      <section aria-labelledby="usar-t" className="mt-16 rounded-[32px] bg-[linear-gradient(160deg,var(--color-celeste-soft),var(--color-paper)_60%)] p-6 ring-1 ring-celeste/15 sm:p-10">
        <h2 id="usar-t" className="font-serif text-4xl">
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
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-celeste-soft font-serif text-xl italic text-celeste-dark">{n}</span>
      <div className="leading-relaxed">{children}</div>
    </li>
  );
}
