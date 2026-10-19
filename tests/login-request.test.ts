import { afterEach, describe, expect, it, vi } from "vitest";
import { post } from "@/components/ui";
import { motivoDe, requestLogin, setLoginHandler } from "@/lib/loginRequest";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ingreso pedido por una herramienta", () => {
  it("sin quién muestre el diálogo, no se queda esperando", async () => {
    await expect(requestLogin("armar tu CV")).resolves.toBe(false);
  });

  it("pedidos simultáneos comparten un solo diálogo", async () => {
    const handler = vi.fn(async () => true);
    const off = setLoginHandler(handler);
    const [a, b] = await Promise.all([requestLogin("leer tu CV"), requestLogin("analizar tu CV")]);
    expect([a, b]).toEqual([true, true]);
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("post: abre el ingreso y, si entra, repite la misma llamada", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.fn().mockResolvedValueOnce(json(401, { code: "AUTH_REQUIRED", error: "x" })).mockResolvedValueOnce(json(200, { ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    const reasons: string[] = [];
    const off = setLoginHandler(async (r) => (reasons.push(r), true));
    await expect(post("/api/cv/analyze", { a: 1 })).resolves.toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ a: 1 }));
    expect(reasons).toEqual([motivoDe("/api/cv/analyze")]);
    off();
  });

  it("post: si cierra el diálogo, avisa con un mensaje claro y no reintenta", async () => {
    vi.stubGlobal("window", {});
    const fetchMock = vi.fn().mockResolvedValue(json(401, { code: "AUTH_REQUIRED" }));
    vi.stubGlobal("fetch", fetchMock);
    const off = setLoginHandler(async () => false);
    await expect(post("/api/cv/generate", {})).rejects.toMatchObject({ code: "AUTH_REQUIRED", message: expect.stringMatching(/Ingresá con Google/) });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    off();
  });
});
