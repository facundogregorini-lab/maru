import type { Metadata } from "next";
import CopyButton from "@/components/CopyButton";
import Reveal from "@/components/magic/Reveal";
import { ProductHero, ProductMore, ToolHeading } from "@/components/product/ProductLanding";
import SiteShell from "@/components/SiteShell";
import { EXTENSION_STORE_URL } from "@/lib/extensionVersion";

export const metadata: Metadata = {
  title: "Extensión para Chrome · Maru",
  description: "Cargá tu CV una vez y completá formularios de postulación con un clic. Vos revisás y enviás.",
};

const ZIP_URL = "/extension/maru-extension.zip";

export default function ExtensionPage() {
  return (
    <SiteShell>
      <ProductHero id="extension" ctaHref={EXTENSION_STORE_URL} />

      <ToolHeading title="Instalala en 1 minuto" hint="Gratis, desde la Chrome Web Store. Funciona en Chrome, Edge y Brave en la compu, y se actualiza sola." />
      <Reveal as="div">
        <ol className="mx-auto mt-10 grid max-w-[1000px] gap-4 sm:grid-cols-3">
          <Step n={1}>
            Abrí la{" "}
            <a href={EXTENSION_STORE_URL} className="font-semibold underline underline-offset-4">
              ficha de Maru en la Chrome Web Store
            </a>{" "}
            y tocá <strong>Agregar a Chrome</strong>.
          </Step>
          <Step n={2}>
            Fijala con el ícono de la pieza de rompecabezas para tenerla a mano.
          </Step>
          <Step n={3}>
            Abrila y <strong>subí tu CV</strong>. En cada formulario, tocá el ícono o usá <strong>Alt + Shift + M</strong>.
          </Step>
        </ol>
        <details className="mx-auto mt-6 max-w-[1000px] rounded-[24px] bg-[#f2f4f5] p-6">
          <summary className="cursor-pointer font-semibold">¿La instalaste antes con el archivo .zip?</summary>
          <div className="mt-3 space-y-3 leading-relaxed">
            <p>
              Pasate a la versión de la Store: se actualiza sola. Primero quitá la que cargaste a mano en{" "}
              <code className="rounded bg-sand px-1.5">chrome://extensions</code> <CopyButton text="chrome://extensions" /> con <strong>Quitar</strong>, y después agregala desde la Store. Vas a tener que subir tu CV otra vez.
            </p>
            <p className="text-sm text-muted">
              Si preferís seguir sin la Store,{" "}
              <a href={ZIP_URL} download className="underline underline-offset-4">
                el archivo sigue disponible
              </a>
              : descomprimilo en una carpeta fija, activá el <strong>Modo de desarrollador</strong> en{" "}
              <code className="rounded bg-sand px-1.5">chrome://extensions</code> y elegí la carpeta con <strong>Cargar descomprimida</strong>.
            </p>
          </div>
        </details>
      </Reveal>

      <ProductMore id="extension" ctaHref={EXTENSION_STORE_URL} />
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
