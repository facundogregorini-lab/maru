import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FREE_MONTHLY_CREATIONS, checkCreation, getAccount, isPaid, recordCreation, upsertAccount, type Who } from "@/lib/account";
import { dbEnabled, getJson, incr, resetMemoryDb, sadd, setJson, smembers, srem } from "@/lib/db";
import { authUrl, parseIdToken } from "@/lib/google";

beforeEach(() => resetMemoryDb());
afterEach(() => vi.unstubAllEnvs());

const token = (payload: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;

describe("base de datos en memoria", () => {
  it("guarda, cuenta y maneja conjuntos como Redis", async () => {
    expect(dbEnabled()).toBe(false);
    await setJson("a", { x: 1 });
    expect(await getJson("a")).toEqual({ x: 1 });
    expect(await incr("c", 60)).toBe(1);
    expect(await incr("c", 60)).toBe(2);
    await sadd("s", "1", "2");
    await srem("s", "1");
    expect(await smembers("s")).toEqual(["2"]);
  });

  it("usa Upstash por REST cuando hay variables", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "t");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: JSON.stringify({ ok: true }) })));
    vi.stubGlobal("fetch", fetchMock);
    expect(dbEnabled()).toBe(true);
    expect(await getJson("k")).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://kv.example");
    expect(init.body).toBe(JSON.stringify(["GET", "k"]));
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t");
    vi.unstubAllGlobals();
  });
});

describe("cuenta y plan", () => {
  it("sin base de datos no hay límites", async () => {
    for (let i = 0; i < 10; i++) {
      const q = await checkCreation({ email: null, ip: "1" });
      expect(q.allowed).toBe(true);
      await recordCreation({ email: null, ip: "1" }, q);
    }
  });

  it("con base: el plan gratis tiene un tope por mes y el pago no", async () => {
    vi.stubEnv("KV_REST_API_URL", "https://kv.example");
    vi.stubEnv("KV_REST_API_TOKEN", "t");
    const store = new Map<string, string>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init: RequestInit) => {
        const [op, k, v] = JSON.parse(String(init.body)) as string[];
        let result: unknown = null;
        if (op === "GET") result = store.get(k) ?? null;
        if (op === "SET") (store.set(k, v), (result = "OK"));
        if (op === "INCR") (store.set(k, String(Number(store.get(k) ?? 0) + 1)), (result = Number(store.get(k))));
        if (op === "EXPIRE") result = 1;
        return new Response(JSON.stringify({ result }));
      }),
    );
    const who: Who = { email: "ana@x.com", ip: "1" };
    const take = async () => {
      const q = await checkCreation(who);
      if (q.allowed) await recordCreation(who, q);
      return q;
    };
    for (let i = 0; i < FREE_MONTHLY_CREATIONS; i++) expect((await take()).allowed).toBe(true);
    expect((await take()).allowed).toBe(false);
    // Otra persona (u otra IP sin sesión) tiene su propio cupo.
    expect((await checkCreation({ email: null, ip: "2" })).allowed).toBe(true);
    await upsertAccount("ana@x.com", { plan: "maru", status: "authorized" });
    expect(isPaid(await getAccount("ana@x.com"))).toBe(true);
    expect(await checkCreation(who)).toMatchObject({ allowed: true, paid: true });
    vi.unstubAllGlobals();
  });
});

describe("Google", () => {
  it("arma la URL de ingreso y valida el id_token", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "cid");
    expect(authUrl("https://maru.app", "st")).toContain("redirect_uri=https%3A%2F%2Fmaru.app%2Fapi%2Fauth%2Fgoogle%2Fcallback");
    const now = Date.now();
    const ok = { iss: "https://accounts.google.com", aud: "cid", exp: now / 1000 + 60, email: "Ana@Gmail.com", email_verified: true, name: "Ana" };
    expect(parseIdToken(token(ok), now)).toEqual({ email: "ana@gmail.com", name: "Ana", picture: "" });
    expect(parseIdToken(token({ ...ok, aud: "otro" }), now)).toBeNull();
    expect(parseIdToken(token({ ...ok, email_verified: false }), now)).toBeNull();
    expect(parseIdToken(token({ ...ok, exp: now / 1000 - 1 }), now)).toBeNull();
    expect(parseIdToken("basura", now)).toBeNull();
  });
});
