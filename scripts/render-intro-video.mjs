// Renderiza video/intro.html cuadro por cuadro y arma public/video/maru-intro.mp4 y .webm (+ póster).
//
//   FFMPEG_PATH=/ruta/a/ffmpeg node scripts/render-intro-video.mjs
//
// Usa Chromium (CHROME_PATH o el de Playwright) y ffmpeg con libx264. Los datos salen del
// inventario real (data/match/inventory.json) y Maru, de src/components/maru/sprite.ts.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FPS = 30;
const OUT_DIR = path.join(ROOT, "public", "video");
// La misma agrupación que /busquedas y la home: no contar un aviso por cada ciudad.
// Las oportunidades no se guardan en el archivo: se reconstruyen desde las publicaciones como en la web.
const grouping = await build({ stdin: { contents: 'export { groupOpportunities } from "./src/lib/match/group.ts"; export { opportunitiesOf } from "./src/lib/match/inventory.ts";', resolveDir: ROOT, loader: "ts" }, bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent" });
const { groupOpportunities, opportunitiesOf } = await import(`data:text/javascript;base64,${Buffer.from(grouping.outputFiles[0].text).toString("base64")}`);


/** Números y búsquedas reales del inventario. */
function inventoryData() {
  const inv = JSON.parse(readFileSync(path.join(ROOT, "data", "match", "inventory.json"), "utf8"));
  // Los avisos importados van en archivos aparte: inventory-imported.json, -2, -3… (src/lib/match/inventory-file.ts).
  for (let n = 1; ; n++) {
    const importedFile = path.join(ROOT, "data", "match", n === 1 ? "inventory-imported.json" : `inventory-imported-${n}.json`);
    if (!existsSync(importedFile)) break;
    inv.postings.push(...JSON.parse(readFileSync(importedFile, "utf8")).postings);
  }
  const open = groupOpportunities(opportunitiesOf(inv)).opportunities.filter((o) => o.status === "abierta");
  const eligible = open.filter((o) => o.eligibility?.status === "elegible");
  // Búsquedas publicadas por día en los últimos 7 días completos (el día en curso queda afuera).
  const byDay = new Map();
  for (const o of open) {
    const day = (o.publishedAt ?? "").slice(0, 10);
    if (day) byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = [...byDay.keys()].sort().slice(-8, -1);
  const seen = new Set();
  const jobs = [];
  for (const o of [...eligible].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt))) {
    if (seen.has(o.company) || o.title.length > 38) continue;
    seen.add(o.company);
    jobs.push([o.title, o.company]);
    if (jobs.length === 72) break;
  }
  return {
    total: open.length,
    companies: new Set(open.map((o) => o.company)).size,
    eligible: eligible.length,
    perDay: days.map((d) => byDay.get(d)),
    jobs,
  };
}

/** window.__MARU(frame, size) → SVG de Maru, compilado desde el mismo sprite que usa la web. */
async function maruScript() {
  const result = await build({
    stdin: {
      contents: `import { FRAMES, rects, WIDTH, HEIGHT } from "./src/components/maru/sprite";
        window.__MARU = (frame, size) => {
          const rows = FRAMES[frame] || FRAMES.idle;
          return '<svg viewBox="0 0 ' + WIDTH + ' ' + HEIGHT + '" width="' + size + '" height="' + (size * HEIGHT) / WIDTH + '" shape-rendering="crispEdges">' +
            rects(rows).map((r) => '<rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="1" fill="' + r.fill + '"/>').join("") + "</svg>";
        };`,
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "iife",
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const data = inventoryData();
  const maru = await maruScript();
  console.log(`Datos: ${data.total} búsquedas, ${data.companies} empresas, ${data.eligible} desde Argentina, ${data.jobs.length} títulos.`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--force-color-profile=srgb"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(`window.__CONTROLLED = true; window.__DATA = ${JSON.stringify(data)};`);
  await page.evaluateOnNewDocument(maru);
  await page.goto(pathToFileURL(path.join(ROOT, "video", "intro.html")).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const duration = await page.evaluate(() => window.T_END);
  const frames = Math.round(duration * FPS);

  // Vista previa: --preview=1.5,4.4,12 --out=carpeta → un PNG por instante, sin video.
  const preview = process.argv.find((a) => a.startsWith("--preview="));
  if (preview) {
    const dir = (process.argv.find((a) => a.startsWith("--out=")) ?? "--out=.").slice(6);
    for (const t of preview.slice(10).split(",").map(Number)) {
      await page.evaluate((x) => window.render(x), t);
      await page.screenshot({ path: path.join(dir, `t${t.toFixed(2)}.png`) });
    }
    await browser.close();
    return;
  }

  const out = path.join(OUT_DIR, "maru-intro.mp4");
  const ff = spawn(
    FFMPEG,
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const done = new Promise((resolve, reject) => ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg terminó con ${code}`)))));

  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.render(t), i / FPS);
    const png = await page.screenshot({ type: "png", optimizeForSpeed: true });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 150 === 0) console.log(`  cuadro ${i}/${frames}`);
  }
  ff.stdin.end();
  await done;

  // WebM (VP9) para los navegadores sin H.264 (Chromium libre, algunos Firefox en Linux).
  const webm = path.join(OUT_DIR, "maru-intro.webm");
  await new Promise((resolve, reject) => {
    const vp9 = spawn(FFMPEG, ["-y", "-loglevel", "error", "-i", out, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "34", "-row-mt", "1", "-an", webm], { stdio: "inherit" });
    vp9.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg (webm) terminó con ${code}`))));
  });

  // Póster: la tarjeta de estrategia ya armada.
  await page.evaluate(() => window.render(2.9));
  await page.screenshot({ path: path.join(OUT_DIR, "maru-intro-poster.jpg"), type: "jpeg", quality: 88 });
  await browser.close();
  console.log(`Listo: ${path.relative(ROOT, out)} (${frames} cuadros, ${duration}s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
