// Captura la extensión real de Maru completando un formulario de ejemplo (empresa ficticia).
// La IA la reemplaza un servidor local (capture/maru/mock-server.mjs).
// Uso (desde video/demo): node capture/maru-extension.mjs [--ext=../../extension]
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import { Recorder } from "./lib.mjs";
import { start } from "./maru/mock-server.mjs";
import { profile } from "./maru/fixtures.mjs";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(path.join(require("node:child_process").execSync("npm root -g").toString().trim(), "playwright")); }

const ext = path.resolve(process.argv.find((a) => a.startsWith("--ext="))?.slice(6) || "../../extension");
const out = path.resolve("public/maru");
const rec = new Recorder(out);
Object.assign(rec.shots, JSON.parse(fs.readFileSync(path.join(out, "shots.json"), "utf8")).shots);
const server = await start();
const port = server.address().port;
const base = `http://localhost:${port}`;

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "maru-ext-"));
const context = await pw.chromium.launchPersistentContext(userDataDir, {
  headless: true,
  channel: "chromium",
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "es-AR",
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent("serviceworker");
const cvPdf = fs.readFileSync(path.resolve("capture/maru/CV-Lucia-Fernandez.pdf")).toString("base64");
await sw.evaluate(
  async ([profile, cv, server]) => chrome.storage.local.set({ profile, cv, server }),
  [profile, { name: "CV-Lucia-Fernandez.pdf", mime: "application/pdf", base64: cvPdf }, base],
);

const page = await context.newPage();
await page.goto(`${base}/form`, { waitUntil: "load" });
await page.waitForTimeout(800);
const fields = { submit: "button[type=submit]", title: "h1", first: "#first", last: "#last", email: "#email", phone: "#phone", li: "#li", city: "#city", resume: "#resume", years: "#years", english: "#english", why: "#why", salary: "#salary", form: "form" };
await rec.shot(page, "ext-before", fields);
await page.bringToFront();
const fill = sw.evaluate(() => fillActiveTab());
// El aviso «Maru está completando…» aparece antes de las respuestas.
await page.waitForTimeout(900);
await rec.shot(page, "ext-working", fields);
const result = await fill;
console.log("  resultado:", JSON.stringify(result).slice(0, 300));
await page.waitForTimeout(900);
await rec.shot(page, "ext-after", fields);
rec.save();
await context.close();
server.close();
