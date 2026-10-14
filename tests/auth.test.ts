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
    expect(verifyLoginToken(`${body}.x${sig.slice(1)}`)).toBeNull();
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

describe("flujo de magic link", () => {
  it("pedir link → abrirlo → cookie de sesión → /me devuelve el email", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { POST: request } = await import("@/app/api/auth/request/route");
    const { GET: verify } = await import("@/app/api/auth/verify/route");
    const { GET: me } = await import("@/app/api/auth/me/route");

    const res = await request(new Request("http://maru.test/api/auth/request", { method: "POST", body: JSON.stringify({ email: "Ana@Mail.com" }) }));
    expect(res.status).toBe(200);
    const link = String(info.mock.calls.flat().join(" ")).match(/http:\/\/maru\.test\/api\/auth\/verify\?token=\S+/)?.[0];
    expect(link).toBeTruthy();

    const back = await verify(new Request(link!));
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
    const { GET: verify } = await import("@/app/api/auth/verify/route");
    const back = await verify(new Request(`http://maru.test/api/auth/verify?token=${createLoginToken("a@b.co")}&next=%2Fentrevista`));
    expect(back.headers.get("location")).toBe("http://maru.test/entrevista?ingreso=ok");
  });
});
