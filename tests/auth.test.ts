import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { SESSION_COOKIE, createSessionToken, normalizeEmail, verifySessionToken } from "@/lib/auth";

afterEach(() => vi.restoreAllMocks());

describe("tokens firmados", () => {
  it("rechaza tokens manipulados o de otro tipo", async () => {
    const { createOAuthState } = await import("@/lib/auth");
    const t = createSessionToken("ana@mail.com");
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), email: "otro@mail.com" })).toString("base64url");
    expect(verifySessionToken(`${forged}.${sig}`)).toBeNull();
    const changedSignature = `${sig[0] === "x" ? "y" : "x"}${sig.slice(1)}`;
    expect(verifySessionToken(`${body}.${changedSignature}`)).toBeNull();
    // Un estado de OAuth no sirve como sesión.
    expect(verifySessionToken(createOAuthState({ next: "/", popup: false }))).toBeNull();
    expect(verifySessionToken("basura")).toBeNull();
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

describe("sólo se entra con Google", () => {
  it("ya no existen las rutas del link por email", () => {
    expect(existsSync("src/app/api/auth/request/route.ts")).toBe(false);
    expect(existsSync("src/app/api/auth/verify/route.ts")).toBe(false);
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

describe("redirección después de ingresar", () => {
  it("vuelve a la página donde estabas, sólo si es interna", async () => {
    const { safeNext } = await import("@/lib/auth");
    expect(safeNext("/cv")).toBe("/cv");
    expect(safeNext("/carta?x=1")).toBe("/carta?x=1");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
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
