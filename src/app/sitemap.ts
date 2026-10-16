import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { loadInventory } from "@/lib/match/load";

// Se regenera cada hora, como el inventario.
export const revalidate = 3600;

const PAGES = ["", "/match", "/busquedas", "/postulacion", "/cv", "/carta", "/video", "/entrevista", "/extension", "/seguimiento", "/terminos", "/privacidad"];

/** Las páginas del sitio y cada búsqueda abierta (las búsquedas son lo que más se encuentra desde Google). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { inv } = await loadInventory();
  const now = inv.generatedAt ? new Date(inv.generatedAt) : new Date();
  return [
    ...PAGES.map((p) => ({ url: `${SITE_URL}${p}`, lastModified: now, changeFrequency: p === "/busquedas" ? ("hourly" as const) : ("weekly" as const), priority: p === "" ? 1 : 0.8 })),
    ...inv.opportunities
      .filter((o) => o.status === "abierta")
      .map((o) => ({ url: `${SITE_URL}/busquedas/${o.id}`, lastModified: new Date(o.lastSeenAt || o.firstSeenAt), changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
