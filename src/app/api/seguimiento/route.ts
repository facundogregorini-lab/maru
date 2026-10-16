import { sessionEmail } from "@/lib/auth";
import { dbEnabled, getJson, setJson } from "@/lib/db";
import { mergeRemoved, mergeTracked, type Removed, type TrackItem } from "@/lib/tracker";

export const runtime = "nodejs";

/** El seguimiento de la cuenta, para tenerlo en todos tus dispositivos. */
type Stored = { items: TrackItem[]; removed: Removed };
const key = (email: string) => `seguimiento:${email}`;
const MAX_ITEMS = 500;

function guard(req: Request): string | Response {
  if (!dbEnabled()) return Response.json({ error: "La sincronización no está configurada.", code: "DB_OFF" }, { status: 503 });
  const email = sessionEmail(req);
  return email ?? Response.json({ error: "Ingresá para sincronizar.", code: "AUTH_REQUIRED" }, { status: 401 });
}

export async function GET(req: Request) {
  const email = guard(req);
  if (email instanceof Response) return email;
  const stored = (await getJson<Stored>(key(email))) ?? { items: [], removed: {} };
  return Response.json(stored, { headers: { "Cache-Control": "no-store" } });
}

/** Recibe el tablero de este navegador, lo junta con el de la cuenta y devuelve el resultado. */
export async function PUT(req: Request) {
  const email = guard(req);
  if (email instanceof Response) return email;
  const raw = await req.text();
  if (raw.length > 1_500_000) return Response.json({ error: "El seguimiento es demasiado grande.", code: "TOO_LARGE" }, { status: 413 });
  let body: Partial<Stored>;
  try {
    body = JSON.parse(raw) as Partial<Stored>;
  } catch {
    return Response.json({ error: "Pedido inválido.", code: "BAD_REQUEST" }, { status: 400 });
  }
  const incoming = Array.isArray(body.items) ? body.items.filter((it) => it && typeof it.id === "string" && typeof it.updatedAt === "number") : [];
  const stored = (await getJson<Stored>(key(email))) ?? { items: [], removed: {} };
  const removed = mergeRemoved(stored.removed ?? {}, body.removed && typeof body.removed === "object" ? body.removed : {});
  const items = mergeTracked(stored.items ?? [], incoming, removed)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_ITEMS);
  await setJson(key(email), { items, removed });
  return Response.json({ items, removed });
}
