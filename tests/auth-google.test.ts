import { beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";
import { OAUTH_COOKIE, finishGoogleLogin, startGoogleLogin, validateClaims } from "@/lib/googleAuth";

const CLIENT = "123-abc.apps.googleusercontent.com";
const ORIGIN = "http://localhost:3000";

beforeEach(() => {
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.GOOGLE_CLIENT_ID = CLIENT;
  process.env.GOOGLE_CLIENT_SECRET = "secreto";
});

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const idToken = (claims: object) => `${b64({ alg: "RS256" })}.${b64(claims)}.firma`;

/** Arranca el flujo y devuelve state, nonce (cookie) y la URL de Google. */
function start(query = "next=/cv") {
  const res = startGoogleLogin(new Request(`${ORIGIN}/api/auth/google?${query}`));
  const google = new URL(res.headers.get("location")!);
  const cookie = res.headers.get("set-cookie")!;
  const nonce = cookie.match(new RegExp(`${OAUTH_COOKIE}=([^;]+)`))![1];
  return { res, google, state: google.searchParams.get("state")!, nonce, cookie: `${OAUTH_COOKIE}=${nonce}` };
}

function tokenEndpoint(claims: object, capture?: (body: URLSearchParams) => void) {
  return (async (_url: RequestInfo | URL, init?: RequestInit) => {
    capture?.(new URLSearchParams(String(init?.body)));
    return new Response(JSON.stringify({ id_token: idToken(claims) }), { status: 200 });
  }) as typeof fetch;
}

const good = (nonce: string) => ({ iss: "https://accounts.google.com", aud: CLIENT, exp: Math.floor(Date.now() / 1000) + 600, email: "Ana@Gmail.com", email_verified: true, nonce });

describe("Continuar con Google", () => {
  it("redirige a Google con PKCE, nonce, sólo openid+email y una cookie httpOnly", () => {
    const { res, google, cookie } = start();
    expect(res.status).toBe(302);
    expect(google.origin + google.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(google.searchParams.get("scope")).toBe("openid email");
    expect(google.searchParams.get("code_challenge_method")).toBe("S256");
    expect(google.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/api/auth/google/callback`);
    expect(google.searchParams.get("nonce")).toBeTruthy();
    expect(res.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(cookie).toContain(google.searchParams.get("nonce")!);
  });

  it("canjea el código, valida el id_token y crea la misma sesión que el magic link", async () => {
    const { state, nonce, cookie } = start();
    let sent: URLSearchParams | null = null;
    const res = await finishGoogleLogin(
      new Request(`${ORIGIN}/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`, { headers: { cookie } }),
      tokenEndpoint(good(nonce), (b) => (sent = b)),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/cv?ingreso=ok`);
    const session = res.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(verifySessionToken(session.split(";")[0].split("=")[1])).toBe("ana@gmail.com");
    expect(sent!.get("code_verifier")).toBeTruthy();
    expect(sent!.get("client_secret")).toBe("secreto");
  });

  it("en ventana emergente responde una página que avisa y se cierra", async () => {
    const { state, nonce, cookie } = start("next=/cv&popup=1");
    const res = await finishGoogleLogin(new Request(`${ORIGIN}/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`, { headers: { cookie } }), tokenEndpoint(good(nonce)));
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain('"result":"ok"');
    expect(html).toContain("window.close");
  });

  it("rechaza si falta la cookie (CSRF) o si el state fue adulterado", async () => {
    const { state, nonce } = start();
    const noCookie = await finishGoogleLogin(new Request(`${ORIGIN}/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`), tokenEndpoint(good(nonce)));
    expect(noCookie.headers.get("location")).toContain("ingreso=google-error");
    expect(noCookie.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(false);

    const forged = await finishGoogleLogin(
      new Request(`${ORIGIN}/api/auth/google/callback?code=abc&state=${encodeURIComponent(state.slice(0, -2) + "xx")}`, { headers: { cookie: `${OAUTH_COOKIE}=${nonce}` } }),
      tokenEndpoint(good(nonce)),
    );
    expect(forged.headers.get("location")).toContain("ingreso=google-error");
  });

  it("si la persona cancela en Google, vuelve con aviso y sin sesión", async () => {
    const { state, cookie } = start();
    const res = await finishGoogleLogin(new Request(`${ORIGIN}/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(state)}`, { headers: { cookie } }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/cv?ingreso=google-cancelado`);
  });

  it("valida emisor, audiencia, vencimiento, nonce y email verificado", () => {
    const base = good("n1");
    expect(validateClaims(base, "n1", CLIENT)).toBe("ana@gmail.com");
    expect(validateClaims({ ...base, iss: "https://evil.example" }, "n1", CLIENT)).toBeNull();
    expect(validateClaims({ ...base, aud: "otra-app" }, "n1", CLIENT)).toBeNull();
    expect(validateClaims({ ...base, exp: 1 }, "n1", CLIENT)).toBeNull();
    expect(validateClaims(base, "otro-nonce", CLIENT)).toBeNull();
    expect(validateClaims({ ...base, email_verified: false }, "n1", CLIENT)).toBeNull();
  });

  it("sin credenciales configuradas no redirige a Google", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const res = startGoogleLogin(new Request(`${ORIGIN}/api/auth/google?next=/carta`));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/carta?ingreso=google-no-configurado`);
  });

  it("no permite redirecciones abiertas a otros sitios", async () => {
    const { state, nonce, cookie } = start(`next=${encodeURIComponent("//evil.example/x")}`);
    const res = await finishGoogleLogin(new Request(`${ORIGIN}/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`, { headers: { cookie } }), tokenEndpoint(good(nonce)));
    expect(new URL(res.headers.get("location")!).origin).toBe(ORIGIN);
  });
});
