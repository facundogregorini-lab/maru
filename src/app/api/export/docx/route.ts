import { Packer, type Document } from "docx";
import { authRequired, sessionEmail } from "@/lib/auth";
import { paidFeatures } from "@/lib/billing/http";
import { buildCvDocx } from "@/lib/export/docx";
import { buildLetterDocx } from "@/lib/export/letterDocx";
import type { CartaDoc, CvDoc } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = { kind?: "cv" | "carta"; doc?: CvDoc | CartaDoc };

/** Word del CV o de la carta. Igual que el PDF, exige haber ingresado. */
export async function POST(req: Request) {
  if (!sessionEmail(req)) return authRequired();
  if (!(await paidFeatures(req)))
    return Response.json({ error: "La descarga en Word es parte de los planes de Maru. El PDF sigue gratis.", code: "PLAN_FEATURE", upgradeUrl: "/precios" }, { status: 402 });
  const { kind = "cv", doc } = (await req.json().catch(() => ({}))) as Body;
  let file: Document;
  if (kind === "carta" && doc && "parrafos" in doc && Array.isArray(doc.parrafos)) file = buildLetterDocx(doc);
  else if (kind === "cv" && doc && "experiencia" in doc && Array.isArray(doc.experiencia)) file = buildCvDocx(doc);
  else return Response.json({ error: "El documento no es válido.", code: "BAD_DOC" }, { status: 400 });

  try {
    const buffer = await Packer.toBuffer(file);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export/docx] falló:", err instanceof Error ? (err.stack ?? err.message) : err);
    return Response.json({ error: "No pudimos generar el Word. Probá de nuevo.", code: "DOCX_FAILED" }, { status: 500 });
  }
}
