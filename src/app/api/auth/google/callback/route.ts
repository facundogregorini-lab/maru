import { upsertAccount } from "@/lib/account";
import { createSessionToken, safeNext, sessionCookie } from "@/lib/auth";
import { OAUTH_COOKIE, exchangeCode } from "@/lib/google";

export const runtime = "nodejs";

/** Vuelta de Google: valida el estado, cambia el código por la identidad y deja la misma sesión que el magic link. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = decodeURIComponent(req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${OAUTH_COOKIE}=([^;]+)`))?.[1] ?? "");
  const [state, nextRaw] = raw.split("|");
  const next = new URL(safeNext(nextRaw), url.origin);
  const clear = `${OAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

  const fail = (why: string) => {
    next.searchParams.set("ingreso", why);
    return new Response(null, { status: 303, headers: { Location: next.toString(), "Set-Cookie": clear } });
  };

  const code = url.searchParams.get("code");
  if (!code || !state || url.searchParams.get("state") !== state) return fail("vencido");
  let user;
  try {
    user = await exchangeCode(code, url.origin);
  } catch (err) {
    console.error("[auth/google]", err instanceof Error ? err.message : err);
  }
  if (!user) return fail("vencido");

  await upsertAccount(user.email, { name: user.name, picture: user.picture }).catch(() => null);
  next.searchParams.set("ingreso", "ok");
  const headers = new Headers({ Location: next.toString() });
  headers.append("Set-Cookie", clear);
  headers.append("Set-Cookie", sessionCookie(createSessionToken(user.email)));
  return new Response(null, { status: 303, headers });
}
