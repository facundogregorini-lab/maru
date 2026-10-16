import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/google", () => ({ googleEmail: async () => "Ana@Example.com", googleEnabled: () => true }));
import { createOAuthState, createSessionToken, OAUTH_COOKIE, readOAuthState, SESSION_COOKIE } from "@/lib/auth";
import { GET as googleCallback } from "@/app/api/auth/google/callback/route";
import { GET, PUT } from "@/app/api/sync/route";
import { GET as billingStatus } from "@/app/api/billing/status/route";
import { resetMemoryDb } from "@/lib/db";
beforeEach(() => resetMemoryDb());
describe("Google y magic link comparten la cuenta", () => {
  it("la sesión de Google lee el mismo perfil que una sesión por email", async () => {
    const emailCookie = `${SESSION_COOKIE}=${createSessionToken("ana@example.com")}`;
    const data = { profile: { nombre: "Ana", experiencia: [] }, savedAt: 1 };
    expect((await PUT(new Request("http://localhost/api/sync", { method: "PUT", headers: { cookie: emailCookie }, body: JSON.stringify({ doc: "perfil", data, baseVersion: 0 }) }))).status).toBe(200);
    const state = createOAuthState({ next: "/match", popup: false });
    const nonce = readOAuthState(state)!.n;
    const callback = await googleCallback(new Request(`http://localhost/api/auth/google/callback?code=valid&state=${encodeURIComponent(state)}`, { headers: { cookie: `${OAUTH_COOKIE}=${nonce}` } }));
    const session = callback.headers.getSetCookie().find((c) => c.startsWith(`${SESSION_COOKIE}=`))!.split(";")[0];
    const res = await GET(new Request("http://localhost/api/sync", { headers: { cookie: session } }));
    expect((await res.json()).docs.perfil.data).toEqual(data);
    const plan = await billingStatus(new Request("http://localhost/api/billing/status?suscripcion=ok", { headers: { cookie: session } }));
    expect((await plan.json()).plan).toBe("gratis");
  });
});
