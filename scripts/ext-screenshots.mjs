/**
 * Capturas de 1280×800 para la ficha de la Chrome Web Store: `npm run ext:screenshots`.
 * Usa el popup real de la extensión (con un chrome.* de mentira y datos ficticios) junto a un formulario
 * de ejemplo coloreado como lo deja Maru: verde copiado del CV, amarillo redactado o deducido.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const popup = pathToFileURL(path.join(root, "extension", "popup.html")).href;
const out = path.join(root, "extension", "store");
const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

const field = (label, value, color, note = "") => `
  <label class="f"><span>${label}</span>
    <div class="in" style="box-shadow: 0 0 0 2px ${color}; background: ${color}14">${value}</div>
    ${note ? `<small>${note}</small>` : ""}
  </label>`;
const GREEN = "#6f8466";
const AMBER = "#d9a441";

const scene = (toast) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  body { margin: 0; width: 1280px; height: 800px; font: 15px/1.4 Inter, system-ui, sans-serif; background: #eef7e8; display: flex; gap: 40px; padding: 40px 56px; box-sizing: border-box; }
  .form { flex: 1; background: #fff; border-radius: 20px; padding: 28px 32px; box-shadow: 0 10px 40px rgba(0,0,0,.08); overflow: hidden; }
  h1 { margin: 0; font-size: 24px; } .co { color: #666; margin: 2px 0 18px; }
  .f { display: block; margin-bottom: 12px; } .f span { font-size: 13px; font-weight: 600; }
  .in { margin-top: 4px; border-radius: 8px; padding: 9px 12px; min-height: 18px; }
  .f small { color: #9a6b00; font-size: 12px; }
  .side { width: 380px; display: flex; flex-direction: column; gap: 18px; }
  iframe { width: 380px; height: ${toast ? 420 : 720}px; border: 0; border-radius: 16px; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,.12); }
  .toast { background: #fff; border-radius: 14px; padding: 14px 16px; box-shadow: 0 8px 30px rgba(43,36,32,.18); display: flex; gap: 10px; font-size: 14px; white-space: pre-line; }
  .dot { width: 22px; height: 22px; border-radius: 6px; background: #1c8c4c; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 12px; flex: none; }
  .btn { display: inline-block; margin-top: 8px; border-radius: 999px; background: #1c8c4c; color: #fff; padding: 5px 12px; font-weight: 600; font-size: 13px; }
</style></head><body>
  <div class="form">
    <h1>Product Manager, Analytics</h1><p class="co">Tucán · Buenos Aires · Greenhouse</p>
    ${field("Nombre", "Ana", GREEN)}${field("Apellido", "Pérez", GREEN)}${field("Email", "ana.perez@ejemplo.com", GREEN)}
    ${field("LinkedIn", "linkedin.com/in/anaperez", GREEN)}${field("CV", "📎 CV - Ana Pérez - Tucán.pdf", GREEN)}
    ${field("¿Por qué querés trabajar en Tucán?", "Uso Tucán todos los días y lideré el tablero de ventas que usaban 40 equipos en mi empresa actual…", AMBER, "Maru lo redactó con tu motivación: revisalo antes de enviar.")}
    ${field("Género", "", "#e5e7eb", "Maru no completa datos demográficos.")}
  </div>
  <div class="side">
    <iframe src="${popup}"></iframe>
    ${toast ? `<div class="toast"><div class="dot">M</div><div>${toast}</div></div>` : ""}
  </div>
</body></html>`;

const chromeStub = (today) => {
  const data = {
    profile: { nombre: "Ana Pérez", titulo: "Product Manager · Analytics" },
    cv: { name: "CV - Ana Pérez.pdf" },
    extras: "Pretensión salarial: USD 3.000 netos por mes\nDisponibilidad: inmediata\nModalidad: remoto o híbrido en CABA",
    quota: { remaining: 3, limit: 4, day: today },
  };
  window.chrome = {
    runtime: { id: "maru", getManifest: () => ({ version: "0.4.0", update_url: "https://clients2.google.com/service/update2/crx" }), sendMessage: async () => ({}), onMessage: { addListener() {} } },
    storage: { local: { get: async () => data, set: async () => {}, remove: async () => {} } },
    tabs: { create() {} },
  };
};

const shots = [
  { name: "1-completar.png", toast: 'Usamos tu CV personalizado para Tucán.\nListo: completamos 6 campos (5 en verde).\nRevisá el marcado en amarillo: Maru lo redactó.\nTe quedan 3 usos hoy.' },
  { name: "2-popup.png", toast: "", dashboard: true },
  { name: "3-seguimiento.png", toast: '¿La enviaste? Guardala en tu seguimiento para no perderle el rastro.<br><span class="btn">Guardar en mi seguimiento</span>' },
];

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
await mkdir(out, { recursive: true });
for (const shot of shots) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(chromeStub, today);
  const file = path.join(tmpdir(), `maru-scene-${shot.name}.html`);
  await writeFile(file, scene(shot.toast));
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 600));
  if (shot.dashboard) {
    const frame = page.frames().find((f) => f.url().endsWith("popup.html"));
    await frame.evaluate(() => {
      window.dashboard({ completados: 9, revisar: 2, pendientes: 1 });
      window.status("Usamos tu CV personalizado para Tucán. Revisá lo amarillo y enviá cuando quieras.");
    });
  }
  await page.screenshot({ path: path.join(out, shot.name) });
  console.log(`✓ extension/store/${shot.name}`);
}
await browser.close();
