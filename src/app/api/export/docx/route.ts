import { Packer } from "docx";
import { authRequired, sessionEmail } from "@/lib/auth";
import { buildDocx } from "@/lib/export/docx";
import type { CvDoc } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!sessionEmail(req)) return authRequired();
  const { doc } = (await req.json().catch(() => ({}))) as { doc?: CvDoc };
  if (!doc?.titulos || !Array.isArray(doc.experiencia)) {
    return Response.json({ error: "El CV no es válido.", code: "BAD_DOC" }, { status: 400 });
  }
  try {
    const buffer = await Packer.toBuffer(buildDocx(doc));
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export/docx] falló:", err instanceof Error ? err.stack ?? err.message : err);
    return Response.json({ error: "No pudimos generar el Word. Probá de nuevo.", code: "DOCX_FAILED" }, { status: 500 });
  }
}
