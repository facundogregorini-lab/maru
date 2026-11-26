import type { Metadata } from "next";
import { Suspense } from "react";
import SiteShell from "@/components/SiteShell";
import RespuestaConfirm from "@/components/recruiters/RespuestaConfirm";

export const metadata: Metadata = {
  title: "Tu respuesta · Maru",
  robots: { index: false, follow: false },
};

export default function RespuestaPage() {
  return (
    <SiteShell>
      <div className="mx-auto max-w-xl px-4 py-16">
        <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
          <RespuestaConfirm />
        </Suspense>
      </div>
    </SiteShell>
  );
}
