import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_TTL_S,
  SESSION_COOKIE,
  createLoginToken,
  createSessionToken,
  normalizeEmail,
  verifyLoginToken,
  verifySessionToken,
} from "@/lib/auth";

afterEach(() => vi.restoreAllMocks());

describe("tokens firmados", () => {
  it("login: válido 15 minutos y después no", () => {
    const now = Date.now();
    const t = createLoginToken("ana@mail.com", now);
    expect(verifyLoginToken(t, now + 60_000)).toBe("ana@mail.com");
    expect(verifyLoginToken(t, now + (LOGIN_TTL_S + 1) * 1000)).toBeNull();
  });

  it("rechaza tokens manipulados o de otro tipo", () => {
    const t = createLoginToken("ana@mail.com");
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), email: "otro@mail.com" })).toString("base64url");
    expect(verifyLoginToken(`${forged}.${sig}`)).toBeNull();
    const changedSignature = `${sig[0] === "x" ? "y" : "x"}${sig.slice(1)}`;
    expect(verifyLoginToken(`${body}.${changedSignature}`)).toBeNull();
    // Un link de login no sirve como sesión ni al revés.
    expect(verifySessionToken(t)).toBeNull();
    expect(verifyLoginToken(createSessionToken("ana@mail.com"))).toBeNull();
    expect(verifyLoginToken("basura")).toBeNull();
  });

  it("la sesión dura 180 días", () => {
    const now = Date.now();
    const s = createSessionToken("ana@mail.com", now);
    expect(verifySessionToken(s, now + 179 * 86_400_000)).toBe("ana@mail.com");
    expect(verifySessionToken(s, now + 181 * 86_400_000)).toBeNull();
  });

  it("normaliza emails", () => {
    expect(normalizeEmail("  Ana@Mail.COM ")).toBe("ana@mail.com");
    expect(normalizeEmail("ana@mail")).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});

/** El botón "Entrar" de la página del link: un POST de formulario desde el propio sitio. */
const confirm = (token: string, next = "/", origin = "http://maru.test") => {
  const body = new FormData();
  body.set("token", token);
  body.set("next", next);
  return new Request("http://maru.test/api/auth/verify", { method: "POST", body, headers: { origin } });
};

describe("flujo de magic link", () => {
  it("pedir link → abrirlo → cookie de sesión → /me devuelve el email", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { POST: request } = await import("@/app/api/auth/request/route");
    const { GET: open, POST: verify } = await import("@/app/api/auth/verify/route");
    const { GET: me } = await import("@/app/api/auth/me/route");

    const res = await request(new Request("http://maru.test/api/auth/request", { method: "POST", body: JSON.stringify({ email: "Ana@Mail.com" }) }));
    expect(res.status).toBe(200);
    const link = String(info.mock.calls.flat().join(" ")).match(/http:\/\/maru\.test\/api\/auth\/verify\?token=\S+/)?.[0];
    expect(link).toBeTruthy();

    // Abrir el link no crea la sesión: muestra la cuenta y un botón.
    const page = await open(new Request(link!));
    expect(page.status).toBe(200);
    expect(page.headers.get("set-cookie")).toBeNull();
    expect(await page.text()).toContain("ana@mail.com");

    const token = new URL(link!).searchParams.get("token")!;
    const back = await verify(confirm(token));
    expect(back.status).toBe(303);
    expect(back.headers.get("location")).toBe("http://maru.test/?ingreso=ok");
    const cookie = back.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Max-Age=15552000/);

    const who = await me(new Request("http://maru.test/api/auth/me", { headers: { cookie: cookie.split(";")[0] } }));
    expect((await who.json()).email).toBe("ana@mail.com");
  });

  it("link vencido o inválido vuelve con ?ingreso=vencido y sin cookie", async () => {
    const { GET: verify } = await import("@/app/api/auth/verify/route");
    const back = await verify(new Request("http://maru.test/api/auth/verify?token=nope"));
    expect(back.headers.get("location")).toBe("http://maru.test/?ingreso=vencido");
    expect(back.headers.get("set-cookie")).toBeNull();
  });

  it("el link sirve una vez y el botón no se puede apretar desde otro sitio", async () => {
    const { POST: verify } = await import("@/app/api/auth/verify/route");
    const token = createLoginToken("una@vez.com");
    expect((await verify(confirm(token, "/", "https://otro-sitio.com"))).status).toBe(403);
    expect((await verify(confirm(token))).headers.get("set-cookie")).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    const again = await verify(confirm(token));
    expect(again.headers.get("location")).toBe("http://maru.test/?ingreso=vencido");
    expect(again.headers.get("set-cookie")).toBeNull();
  });

  it("email inválido: 400", async () => {
    const { POST: request } = await import("@/app/api/auth/request/route");
    const res = await request(new Request("http://maru.test/x", { method: "POST", body: JSON.stringify({ email: "no-es-mail" }) }));
    expect(res.status).toBe(400);
  });
});

describe("descargas exigen sesión", () => {
  const cookie = () => `${SESSION_COOKIE}=${createSessionToken("ana@mail.com")}`;

  it("Word: 401 sin sesión, .docx con sesión", async () => {
    const { buildCvDoc } = await import("@/lib/cv");
    const { POST } = await import("@/app/api/export/docx/route");
    const doc = buildCvDoc(
      {
        nombre: "Ana Pérez", titulo: "Growth", ubicacion: "", email: "ana@mail.com", telefono: "", linkedin_url: "", otros_links: [], resumen: "",
        aptitudes: [], experiencia: [], educacion: [], idiomas: [], certificaciones: [],
      },
      { titular: "Growth Lead", resumen: "Resumen", logros_clave: [], habilidades: ["SEO"], experiencias: [] },
      { puesto: "Growth Lead", idioma: "es", pais: "AR", palabrasClave: [], templateRecomendado: "moderno", razonTemplate: "" },
    );
    const body = JSON.stringify({ kind: "cv", doc });
    expect((await POST(new Request("http://maru.test/api/export/docx", { method: "POST", body }))).status).toBe(401);
    const ok = await POST(new Request("http://maru.test/api/export/docx", { method: "POST", body, headers: { cookie: cookie() } }));
    expect(ok.status).toBe(200);
    expect(Buffer.from(await ok.arrayBuffer()).subarray(0, 2).toString()).toBe("PK");
  });

  it("PDF: 401 sin sesión", async () => {
    const { POST } = await import("@/app/api/export/pdf/route");
    const res = await POST(new Request("http://maru.test/api/export/pdf", { method: "POST", body: JSON.stringify({ html: "<p>x</p>" }) }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("AUTH_REQUIRED");
  });
});

describe("redirección después del link", () => {
  it("vuelve a la página donde estabas, sólo si es interna", async () => {
    const { safeNext } = await import("@/lib/auth");
    expect(safeNext("/cv")).toBe("/cv");
    expect(safeNext("/carta?x=1")).toBe("/carta?x=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(undefined)).toBe("/");

    const { createLoginToken } = await import("@/lib/auth");
    const { POST: verify } = await import("@/app/api/auth/verify/route");
    const back = await verify(confirm(createLoginToken("a@b.co"), "/entrevista"));
    expect(back.headers.get("location")).toBe("http://maru.test/entrevista?ingreso=ok");
  });
});

describe("ingreso con Google", () => {
  const idToken = (claims: Record<string, unknown>) =>
    ["e30", Buffer.from(JSON.stringify(claims)).toString("base64url"), "sig"].join(".");
  const valid = { aud: "cliente-test", iss: "https://accounts.google.com", exp: Math.floor(Date.now() / 1000) + 600, email: "Ana@Gmail.com", email_verified: true };

  function withGoogleEnv() {
    vi.stubEnv("GOOGLE_CLIENT_ID", "cliente-test");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "secreto-test");
  }
  afterEach(() => vi.unstubAllEnvs());

  async function start(query: string) {
    const { GET } = await import("@/app/api/auth/google/route");
    const res = await GET(new Request(`http://maru.test/api/auth/google?${query}`));
    const location = new URL(res.headers.get("location")!);
    const nonce = res.headers.get("set-cookie")!.match(/^maru_oauth=([^;]+)/)![1];
    return { res, location, state: location.searchParams.get("state")!, cookie: `maru_oauth=${nonce}` };
  }

  async function callback(state: string, cookie: string | null, claims: Record<string, unknown> = valid) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id_token: idToken(claims) }));
    const { GET } = await import("@/app/api/auth/google/callback/route");
    return GET(new Request(`http://maru.test/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`, { headers: cookie ? { cookie } : {} }));
  }

  it("sin credenciales: /me no ofrece Google y la ruta vuelve con error", async () => {
    const { GET: me } = await import("@/app/api/auth/me/route");
    expect((await (await me(new Request("http://maru.test/api/auth/me"))).json()).google).toBe(false);
    const { GET } = await import("@/app/api/auth/google/route");
    const res = await GET(new Request("http://maru.test/api/auth/google?next=%2Fcv"));
    expect(res.headers.get("location")).toBe("http://maru.test/cv?ingreso=google-error");
  });

  it("manda a Google con la URI de vuelta y un estado atado a este navegador", async () => {
    withGoogleEnv();
    const { GET: me } = await import("@/app/api/auth/me/route");
    expect((await (await me(new Request("http://maru.test/api/auth/me"))).json()).google).toBe(true);
    const { res, location, cookie } = await start("next=%2Fcv");
    expect(res.status).toBe(302);
    expect(location.origin + location.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(location.searchParams.get("client_id")).toBe("cliente-test");
    expect(location.searchParams.get("redirect_uri")).toBe("http://maru.test/api/auth/google/callback");
    expect(location.searchParams.get("scope")).toBe("openid email");
    expect(cookie).toMatch(/^maru_oauth=.+/);
  });

  it("vuelta válida: sesión con el email de Google y regreso a la página", async () => {
    withGoogleEnv();
    const { state, cookie } = await start("next=%2Fcv");
    const back = await callback(state, cookie);
    expect(back.status).toBe(303);
    expect(back.headers.get("location")).toBe("http://maru.test/cv?ingreso=ok");
    const session = back.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(verifySessionToken(session.split(";")[0].split("=")[1])).toBe("ana@gmail.com");
  });

  it("en ventana aparte: responde una página que avisa y se cierra", async () => {
    withGoogleEnv();
    const { state, cookie } = await start("popup=1&next=%2Fcarta");
    const back = await callback(state, cookie);
    expect(back.status).toBe(200);
    expect(back.headers.getSetCookie().some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(true);
    const html = await back.text();
    expect(html).toContain('BroadcastChannel("maru-auth").postMessage("ok")');
    expect(html).toContain("window.close()");
  });

  it("rechaza estado sin cookie, de otro navegador, email sin verificar u otro cliente", async () => {
    withGoogleEnv();
    const { state, cookie } = await start("next=%2Fcv");
    const other = await start("next=%2Fcv");
    for (const [s, c, claims] of [
      [state, null, valid],
      [state, other.cookie, valid],
      [state, cookie, { ...valid, email_verified: false }],
      [state, cookie, { ...valid, aud: "otro-cliente" }],
      ["basura", cookie, valid],
    ] as const) {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const back = await callback(s, c, claims);
      expect(back.headers.get("location")).toBe(s === "basura" ? "http://maru.test/?ingreso=google-error" : "http://maru.test/cv?ingreso=google-error");
      expect(back.headers.getSetCookie().some((x) => x.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
      vi.restoreAllMocks();
    }
  });
});
