import { EXTENSION_VERSION, MIN_EXTENSION_VERSION } from "@/lib/extensionVersion";
import { SITE_URL } from "@/lib/site";

/** La extensión pregunta al abrirse si hay una versión nueva, para avisar en el popup. */
export function GET() {
  return Response.json(
    { latest: EXTENSION_VERSION, minimum: MIN_EXTENSION_VERSION, downloadUrl: `${SITE_URL}/extension` },
    { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } },
  );
}
