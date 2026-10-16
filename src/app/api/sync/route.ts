import { sessionEmail } from "@/lib/auth";
import { dbConfigured } from "@/lib/db";
import { MAX_DOC_BYTES, isSyncDoc, validDocData } from "@/lib/sync/docs";
import { readDocs, writeDoc } from "@/lib/sync/server";

/**
 * Sincronización de la cuenta (perfil, match y seguimiento).
 * GET: todo lo guardado. PUT {doc, data}: guarda un documento (data null = borrado: queda la marca
 * para que los demás dispositivos también lo borren, sin ningún dato personal).
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function who(req: Request): string | null {
  try {
    return sessionEmail(req);
  } catch (err) {
    console.error("[sync]", err instanceof Error ? err.message : err);
    return null;
  }
}

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: NO_STORE });
const noSession = () => json({ error: "Ingresá con tu email para guardar tus datos en tu cuenta.", code: "AUTH_REQUIRED" }, 401);
const noDb = () => json({ error: "La base de datos todavía no está conectada.", code: "DB_NOT_CONFIGURED", configured: false }, 503);

function failed(err: unknown) {
  console.error("[sync]", err instanceof Error ? err.message : err);
  return json({ error: "No pudimos llegar a tu cuenta. Tus datos siguen en este navegador.", code: "DB_UNAVAILABLE" }, 503);
}

export async function GET(req: Request) {
  const email = who(req);
  if (!email) return noSession();
  if (!dbConfigured()) return json({ configured: false, docs: {} });
  try {
    return json({ configured: true, docs: await readDocs(email) });
  } catch (err) {
    return failed(err);
  }
}

export async function PUT(req: Request) {
  const email = who(req);
  if (!email) return noSession();
  if (!dbConfigured()) return noDb();

  const raw = await req.text();
  if (raw.length > MAX_DOC_BYTES + 100) return json({ error: "Es demasiado para guardar de una vez.", code: "TOO_LARGE" }, 413);
  let body: { doc?: unknown; data?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Pedido inválido.", code: "BAD_REQUEST" }, 400);
  }
  const { doc, data = null } = body ?? {};
  if (!isSyncDoc(doc) || !validDocData(doc, data)) return json({ error: "Pedido inválido.", code: "BAD_REQUEST" }, 400);

  try {
    const stored = await writeDoc(email, doc, data);
    return json({ updatedAt: stored.updatedAt });
  } catch (err) {
    return failed(err);
  }
}
