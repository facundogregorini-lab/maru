import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/autofill/route";
import { EXTENSION_VERSION, compareVersions, extensionOutdated, extensionUpdateAvailable } from "@/lib/extensionVersion";

describe("versión de la extensión", () => {
  it("coincide con el manifest que se descarga", () => {
    const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8")) as { version: string };
    expect(manifest.version).toBe(EXTENSION_VERSION);
  });

  it("compara versiones y detecta las desactualizadas", () => {
    expect(compareVersions("0.3.10", "0.3.2")).toBeGreaterThan(0);
    expect(compareVersions("0.3.2", "0.3.2")).toBe(0);
    expect(extensionOutdated(null)).toBe(true);
    expect(extensionOutdated("0.3.1")).toBe(true);
    expect(extensionOutdated("0.3.2")).toBe(false);
    expect(extensionUpdateAvailable("0.3.2")).toBe(true);
    expect(extensionUpdateAvailable(EXTENSION_VERSION)).toBe(false);
  });

  it("una extensión sin versión recibe el aviso de actualizar como error", async () => {
    const res = await POST(new Request("https://maru.test/api/autofill", { method: "POST", body: "{}" }));
    expect(res.status).toBe(426);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("EXTENSION_OUTDATED");
    expect(body.error).toContain("desactualizada");
  });
});
