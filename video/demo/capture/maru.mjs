// Captura el recorrido real de Maru en producción. La IA se reemplaza por datos ficticios
// (capture/maru/fixtures.mjs) y el ranking se pide sin IA: no se gasta nada ni se escribe nada.
// Uso: node capture/maru.mjs [--base=https://maru-grego7.vercel.app]
import path from "node:path";
import fs from "node:fs";
import { openBrowser, Recorder, hide } from "./lib.mjs";
import { profile, prefs, motivation, analysisFor, generationFor } from "./maru/fixtures.mjs";

const base = process.argv.find((a) => a.startsWith("--base="))?.slice(7) || "https://maru-grego7.vercel.app";
const out = path.resolve("public/maru");
const rec = new Recorder(out);
const { browser, context } = await openBrowser();
let chosen = { puesto: "Data Analyst", empresa: "la empresa" };

await context.route("**/api/**", async (route) => {
  const r = route.request();
  const u = r.url();
  // Las respuestas tardan un poco, como la IA real, para capturar las pantallas de espera.
  const later = (json) => new Promise((r) => setTimeout(r, 2600)).then(() => route.fulfill({ json }));
  if (u.includes("/api/profile")) return later({ profile });
  if (u.includes("/api/analyze")) return later({ analysis: analysisFor(chosen.puesto, chosen.empresa) });
  if (u.includes("/api/generate")) return later({ generation: generationFor(chosen.puesto, chosen.empresa) });
  if (u.includes("/api/match/ranking")) {
    // Orden por reglas (sin IA) y sin la segunda pasada de afinado.
    const body = JSON.parse(r.postData() || "{}");
    body.ia = false;
    const res = await route.fetch({ postData: JSON.stringify(body) });
    const json = await res.json();
    json.ia = { disponible: false, aplicada: false };
    return route.fulfill({ response: res, json });
  }
  if (r.method() !== "GET") {
    console.log(`  ⛔ bloqueado ${r.method()} ${u}`);
    return route.fulfill({ json: {} });
  }
  return route.continue();
});
// Sin el saludo de Maru y con «lo que busco» ya cargado (como si la persona lo hubiera elegido).
await context.addInitScript(([prefs]) => {
  if (localStorage.getItem("maru:video-init")) return;
  localStorage.setItem("maru:video-init", "1");
  localStorage.setItem("maru:guia:v1", JSON.stringify({ status: "rechazada", step: 0, min: false, done: [] }));
  localStorage.setItem("maru:match:v1", JSON.stringify({ profile: null, prefs, interactions: { saved: [], discarded: [] }, external: [], updatedAt: Date.now() }));
}, [prefs]);

const page = await context.newPage();
const cvPdf = path.resolve("capture/maru/CV-Lucia-Fernandez.pdf");
if (!fs.existsSync(cvPdf)) {
  const p = await context.newPage();
  await p.setContent("<h1>Lucía Fernández</h1><p>Analista de Datos</p>");
  await p.pdf({ path: cvPdf });
  await p.close();
}
const HIDE = ["[aria-label*='cookies' i]"];
// Las búsquedas «ocultas» difuminadas (gancho del plan pago) se sacan para que la lista se lea limpia.
const hideTeasers = (page) => page.evaluate(() => {
  for (const a of document.querySelectorAll("article")) if (a.textContent.includes("Búsqueda que no está en LinkedIn")) a.remove();
});

// 1. CV
await page.goto(base + "/match#empezar", { waitUntil: "load" });
await page.waitForTimeout(2500);
await hide(page, HIDE);
await page.evaluate(() => scrollTo(0, 0));
await rec.shot(page, "match-cv", {
  upload: page.getByRole("button", { name: /Mi CV/ }),
  linkedin: page.getByRole("button", { name: /PDF de LinkedIn/ }),
  drop: "label:has(input[type=file]), [class*=border-dashed]",
  seguir: page.getByRole("button", { name: /^Seguir$/ }),
});
await page.getByRole("button", { name: /Mi CV/ }).click().catch(() => {});
await page.waitForTimeout(300);
await rec.shot(page, "match-cv-mine", {
  drop: "label:has(input[type=file]), [class*=border-dashed]",
  seguir: page.getByRole("button", { name: /^Seguir$/ }),
});
await page.locator("input[type=file]").first().setInputFiles(cvPdf);
await page.waitForTimeout(800);
await rec.shot(page, "match-cv-loaded", {
  drop: "label:has(input[type=file]), [class*=border-dashed]",
  seguir: page.getByRole("button", { name: /^Seguir$/ }),
});

// 2. Perfil entendido
await page.getByRole("button", { name: /^Seguir$/ }).click();
await page.waitForTimeout(1300);
await rec.shot(page, "match-leyendo");
await page.getByRole("button", { name: /Ver mis búsquedas/ }).waitFor();
await page.waitForTimeout(800);
await page.evaluate(() => scrollTo(0, 0));
await rec.shot(page, "match-profile", {
  card: "text=Así entendimos tu perfil",
  skills: "ul:has(li:text-is('SQL'))",
  ver: page.getByRole("button", { name: /Ver mis búsquedas/ }),
});

// 3. Ranking de búsquedas reales
await page.getByRole("button", { name: /Ver mis búsquedas/ }).click();
await page.locator("article h3").first().waitFor({ timeout: 120000 });
await page.waitForTimeout(2500);
await hide(page, HIDE);
await hideTeasers(page);
await page.waitForTimeout(300);
const cards = await page.$$eval("article", (as) =>
  as.slice(0, 12).map((a, i) => ({ i, title: a.querySelector("h3")?.textContent?.trim() ?? "", company: a.querySelector("h3 + p")?.textContent?.trim() ?? "" })),
);
console.log(cards.map((c) => `${c.i}. ${c.title} | ${c.company}`).join("\n"));
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(400);
await rec.shot(page, "match-results", {
  first: "article >> nth=0",
  second: "article >> nth=1",
  score0: "article >> nth=0 >> [aria-label*='%'], article >> nth=0 >> svg",
  prepare0: page.locator("article").nth(0).getByRole("button", { name: /Postulación personalizada/ }),
}, { fullPage: true });

const pickIndex = Number(process.env.MARU_PICK ?? 0);
const pick = page.locator("article").nth(pickIndex);
const title = (await pick.locator("h3").textContent())?.trim() ?? "";
const company = ((await pick.locator("h3 + p").textContent()) ?? "").split("/")[0].trim();
chosen = { puesto: title, empresa: company };
fs.writeFileSync(path.join(out, "chosen.json"), JSON.stringify({ ...chosen, cards }, null, 2));

// 4. Postulación a medida
await pick.getByRole("button", { name: /Postulación personalizada/ }).click();
await page.waitForURL(/postulacion/);
await page.waitForTimeout(2500);
await hide(page, HIDE);
await page.evaluate(() => scrollTo(0, 0));
await rec.shot(page, "post-inicio", {
  url: "input[type=url]",
  motivo: "textarea[placeholder^='Me encanta']",
  empezar: page.getByRole("button", { name: /^Empezar$/ }),
});
await page.locator("textarea[placeholder^='Me encanta']").fill(motivation);
await page.waitForTimeout(300);
await page.locator("textarea[placeholder^='Me encanta']").scrollIntoViewIfNeeded();
await rec.shot(page, "post-motivo", {
  url: "input[type=url]",
  motivo: "textarea[placeholder^='Me encanta']",
  empezar: page.getByRole("button", { name: /^Empezar$/ }),
});
await rec.shot(page, "post-motivo-full", { empezar: page.getByRole("button", { name: /^Empezar$/ }), motivo: "textarea[placeholder^='Me encanta']", url: "input[type=url]" }, { fullPage: true });
await page.getByRole("button", { name: /^Empezar$/ }).click();
await page.waitForTimeout(1300);
await rec.shot(page, "post-analizando");
await page.getByRole("button", { name: /Armar mi postulación/ }).first().waitFor();
await page.waitForTimeout(1200);
await page.evaluate(() => scrollTo(0, 0));
await rec.shot(page, "post-preguntas", {
  armar: page.getByRole("button", { name: /Armar mi postulación/ }).first(),
}, { fullPage: true });
await page.getByRole("button", { name: /Armar mi postulación/ }).first().click();
await page.waitForTimeout(1300);
await rec.shot(page, "post-generando");
await page.waitForTimeout(3500);
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(800);
const resultBoxes = {
  banner: "text=Siguiente paso: completá el formulario",
  cvTab: page.getByRole("button", { name: /CV optimizado/ }),
  formTab: page.getByRole("button", { name: /^Formulario/ }),
  templates: "text=Elegí el diseño",
  paper: page.locator("text=Lucía Fernández").last(),
  ats: "text=Compatibilidad ATS",
  keywords: "text=Palabras clave",
  pdf: page.getByRole("button", { name: /Descargar PDF/ }),
  cambios: "text=Qué cambiamos y por qué",
};
await rec.shot(page, "post-resultado", resultBoxes, { fullPage: true });
await page.getByRole("button", { name: /^Formulario/ }).click();
await page.waitForTimeout(1200);
await page.evaluate(() => scrollTo(0, 0));
await rec.shot(page, "post-formulario", { formTab: page.getByRole("button", { name: /^Formulario/ }), first: "text=¿Por qué querés trabajar con nosotros?" }, { fullPage: true });

rec.save({ base, chosen });
await browser.close();
