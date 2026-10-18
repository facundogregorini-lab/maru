"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { capture, capturePageview, initPostHog } from "@/lib/tracking/posthog";

/** Inicia PostHog, manda una visita por cada cambio de página y la descarga de la extensión. */
export default function PostHogPageviews() {
  const pathname = usePathname();

  useEffect(() => {
    if (initPostHog()) capturePageview();
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('a[href$="maru-extension.zip"]')) capture("extension_descarga");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
