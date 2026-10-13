import { readFile } from "node:fs/promises";
import path from "node:path";

/** Fuentes que usan los templates, embebidas en el PDF para que se vea igual en cualquier lado. */
const FONTS: { family: string; pkg: string; file: string; weights: number[] }[] = [
  { family: "Inter", pkg: "inter", file: "inter", weights: [300, 400, 500, 600, 700] },
  { family: "Source Serif 4", pkg: "source-serif-4", file: "source-serif-4", weights: [400, 600] },
  { family: "Source Sans 3", pkg: "source-sans-3", file: "source-sans-3", weights: [400, 600, 700] },
];

let cache: string | null = null;

export async function fontFaceCss(): Promise<string> {
  if (cache) return cache;
  const rules: string[] = [];
  for (const f of FONTS) {
    for (const w of f.weights) {
      for (const subset of ["latin", "latin-ext"]) {
        const file = path.join(process.cwd(), "node_modules", "@fontsource", f.pkg, "files", `${f.file}-${subset}-${w}-normal.woff2`);
        const data = await readFile(file).catch(() => null);
        if (!data) continue;
        rules.push(
          `@font-face{font-family:'${f.family}';font-weight:${w};font-style:normal;src:url(data:font/woff2;base64,${data.toString("base64")}) format('woff2');}`,
        );
      }
    }
  }
  cache = rules.join("\n");
  return cache;
}
