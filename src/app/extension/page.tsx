import type { Metadata } from "next";
import CopyButton from "@/components/CopyButton";
import Reveal from "@/components/magic/Reveal";
import { ProductHero, ProductMore, ToolHeading } from "@/components/product/ProductLanding";
import SiteShell from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Extensión para Chrome · Maru",
  description: "Cargá tu CV una vez y completá formularios de postulación con un clic. Vos revisás y enviás.",
};

const ZIP_URL = "/extension/maru-extension.zip";

export default function ExtensionPage() {
  return (
    <SiteShell>
      <ProductHero id="extension" ctaHref={ZIP_URL} />

      <ToolHeading title="Instalala en 1 minuto" hint="Gratis, para Chrome, Edge o Brave en la compu. Mientras no esté en la Chrome Web Store, se instala desde el archivo." />
      <Reveal as="div">
        <ol className="mx-auto mt-10 grid max-w-[1000px] gap-4 sm:grid-cols-2">
          <Step n={1}>
            <a href={ZIP_URL} download className="font-semibold underline underline-offset-4">
              Descargá el archivo
            </a>{" "}
            y <strong>descomprimilo</strong>: queda una carpeta <code className="rounded bg-sand px-1.5">maru-extension</code>.
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

      <ProductMore id="extension" ctaHref={ZIP_URL} />
    </SiteShell>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li data-reveal style={{ "--i": n - 1 } as React.CSSProperties} className="flex gap-4 rounded-[24px] bg-[#f2f4f5] p-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neon font-bold">{n}</span>
      <div className="leading-relaxed">{children}</div>
    </li>
  );
}
