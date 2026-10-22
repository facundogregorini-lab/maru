import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildExtensionZip } from "@/lib/extensionZip";

const { GET } = await import("@/app/extension/maru-extension.zip/route");

describe("descarga de la extensión", () => {
  it("el .zip trae una carpeta maru-extension con todo lo que pide el manifest", async () => {
    const zip = await JSZip.loadAsync(await buildExtensionZip());
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(names.every((n) => n.startsWith("maru-extension/"))).toBe(true);
    const manifest = JSON.parse(await zip.file("maru-extension/manifest.json")!.async("string"));
    const needed = [manifest.background.service_worker, manifest.action.default_popup, ...Object.values<string>(manifest.icons), "content.js", "popup.js", "popup.css"];
    for (const f of needed) expect(names).toContain(`maru-extension/${f}`);
  });

  it("se sirve como archivo para descargar", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toBe("application/zip");
    expect(res.headers.get("content-disposition")).toContain("maru-extension.zip");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});

describe("paquete para la Chrome Web Store", () => {
  it("no incluye el material de la ficha y deja el manifest en la raíz, sin localhost", async () => {
    const zip = await JSZip.loadAsync(await buildExtensionZip(undefined, { store: true }));
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    expect(names).toContain("manifest.json");
    expect(names.some((n) => n.startsWith("store/") || n === "STORE_LISTING.md")).toBe(false);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    const matches = manifest.content_scripts.flatMap((c: { matches: string[] }) => c.matches);
    expect(matches).toContain("https://www.marucoach.com/*");
    expect(matches.some((m: string) => m.includes("localhost"))).toBe(false);
    for (const f of ["bridge.js", "jobkey.js", "background.js", "content.js"]) expect(names).toContain(f);
  });
  it("el zip de descarga tampoco lleva la ficha", async () => {
    const zip = await JSZip.loadAsync(await buildExtensionZip());
    expect(Object.keys(zip.files).some((n) => n.includes("/store/") || n.endsWith("STORE_LISTING.md"))).toBe(false);
  });
});
