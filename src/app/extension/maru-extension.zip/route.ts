import { buildExtensionZip } from "@/lib/extensionZip";

// Se arma una vez al compilar y se sirve como archivo estático.
export const dynamic = "force-static";

export async function GET() {
  const zip = await buildExtensionZip();
  return new Response(zip as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="maru-extension.zip"',
    },
  });
}
