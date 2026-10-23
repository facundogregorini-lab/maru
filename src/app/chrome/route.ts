import { EXTENSION_STORE_URL } from "@/lib/extensionVersion";

/** Link corto para compartir (marucoach.com/chrome): lleva a la ficha de la extensión en la Chrome Web Store. */
export function GET() {
  // Temporal (307): si la ficha cambia, el link corto sigue sirviendo.
  return Response.redirect(EXTENSION_STORE_URL, 307);
}
