import { afterEach, expect, it, vi } from "vitest";
import { adminEmails, adminDenied } from "@/lib/match/admin";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
afterEach(() => vi.unstubAllEnvs());
it("admite listas mixtas por coma, espacio y salto de línea con coincidencia exacta", () => {
  vi.stubEnv("AUTH_SECRET", "x".repeat(40));
  vi.stubEnv("ADMIN_EMAILS", " uno@example.com DOS@example.com,\ntres@example.com\tuno@example.com ");
  expect([...adminEmails()]).toEqual(["uno@example.com", "dos@example.com", "tres@example.com"]);
  const req = (email?: string) => new Request("https://maru.test/match/admin", { headers: email ? { cookie: `${SESSION_COOKIE}=${createSessionToken(email)}` } : {} });
  expect(adminDenied(req("dos@example.com"))).toBeNull();
  expect(adminDenied(req("otros@example.com"))?.status).toBe(403);
  expect(adminDenied(req("uno@example.com.evil.test"))?.status).toBe(403);
  expect(adminDenied(req())?.status).toBe(401);
});
it("ignora fragmentos inválidos y no interpreta dominios ni comodines como permisos", () => {
  vi.stubEnv("AUTH_SECRET", "x".repeat(40));
  vi.stubEnv("ADMIN_EMAILS", "@example.com garbage invalid@local *@example.com");
  expect(adminEmails().has("@example.com")).toBe(false);
  const req = new Request("https://maru.test", { headers: { cookie: `${SESSION_COOKIE}=${createSessionToken("user@example.com")}` } });
  expect(adminDenied(req)?.status).toBe(403);
  expect(adminEmails({})).toEqual(new Set());
});
