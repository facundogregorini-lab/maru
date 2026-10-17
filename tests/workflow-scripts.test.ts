import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Los workflows match-sync y match-providers corren los scripts con `npx tsx` SIN npm install:
 * ni los scripts ni lo que importan pueden depender de paquetes de npm (sólo node:*).
 * El 17/10 un `import cheerio` en connectors.ts rompió la sincronización diaria.
 */
const ROOT = process.cwd();
const ENTRIES = ["scripts/match-sync.ts", "scripts/match-import.ts", "scripts/match-liveness.ts"];

function resolveLocal(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, "src", spec.slice(2)) : path.resolve(path.dirname(from), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) if (existsSync(cand) && cand.match(/\.tsx?$/)) return cand;
  return null;
}

function externalImports(entry: string): Map<string, string> {
  const seen = new Set<string>();
  const external = new Map<string, string>();
  const stack = [path.join(ROOT, entry)];
  while (stack.length) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    // Sólo imports en tiempo de ejecución: los `import type` se borran al compilar.
    for (const m of src.matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
      const spec = m[1];
      if (spec.startsWith("node:")) continue;
      if (spec.startsWith(".") || spec.startsWith("@/")) {
        const next = resolveLocal(file, spec);
        if (next) stack.push(next);
        continue;
      }
      external.set(spec, path.relative(ROOT, file));
    }
  }
  return external;
}

describe("scripts de los workflows sin dependencias de npm", () => {
  for (const entry of ENTRIES) {
    it(entry, () => {
      expect(Object.fromEntries(externalImports(entry))).toEqual({});
    });
  }
});
