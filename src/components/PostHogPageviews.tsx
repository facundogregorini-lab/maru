"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { capture, capturePageview, initPostHog } from "@/lib/tracking/posthog";

/** Inicia PostHog, manda una visita por cada cambio de página y los clics para instalar la extensión (zip o Store). */
export default function PostHogPageviews() {
  const pathname = usePathname();

  useEffect(() => {
    if (initPostHog()) capturePageview();
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('a[href$="maru-extension.zip"]')) capture("extension_descarga");
      else if (target?.closest?.('a[href^="https://chromewebstore.google.com/"]')) capture("extension_store");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
