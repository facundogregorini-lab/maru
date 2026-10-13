import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const LOCAL_CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const html = `<article style="font-family:'Source Sans 3'"><h1>Ana Pérez</h1><p>Growth Lead · Ejecutivo</p></article>`;
const req = (body: unknown) => new Request("http://test/api/export/pdf", { method: "POST", body: JSON.stringify(body) });

async function loadRoute(chromePath: string) {
  vi.resetModules();
  vi.stubEnv("CHROME_PATH", chromePath);
  return import("@/app/api/export/pdf/route");
}

afterEach(() => vi.unstubAllEnvs());

describe("/api/export/pdf", () => {
  it.skipIf(!existsSync(LOCAL_CHROME))("genera un PDF A4 con texto", async () => {
    const { POST } = await loadRoute(LOCAL_CHROME);
    const res = await POST(req({ html, padY: 48 }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);

  it("si Chromium no arranca: error útil, etapa y log con el detalle", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await loadRoute("/no/existe");
    const res = await POST(req({ html, padY: 48 }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data).toMatchObject({ code: "PDF_FAILED", stage: "launch" });
    expect(data.error).toMatch(/Word/);
    expect(data.detail).toMatch(/no\/existe/);
    expect(log.mock.calls.flat().join(" ")).toMatch(/launch/);
  });

  it("rechaza un cuerpo vacío", async () => {
    const { POST } = await loadRoute(LOCAL_CHROME);
    expect((await POST(req({}))).status).toBe(400);
  });
});
