// Genera las piezas de la tanda 1 (Meta) en PNG: feed 1080×1350, story 1080×1920 y carrusel 1080×1080.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(DIR, "out");
fs.mkdirSync(OUT, { recursive: true });
const fonts = fs.readFileSync(path.join(DIR, "fonts-local.css"), "utf8");

// --- Maru en pixel art (de src/components/maru/sprite.ts) ---
const PAL = { H: "#3b2416", h: "#5a3a24", N: "#00f0a0", S: "#f4c7a1", s: "#dc9f78", E: "#111111", R: "#f08a8a", M: "#b4472a", T: "#1c8c4c", t: "#136c39", P: "#1f2937", B: "#0a0a0a" };
const HEAD = [".....HHHHHH.....", "....HHHhHHHHN...", "...HHHhHHHHHHH..", "...HHHHHHHHSHH..", "..HHHSSSSSSSHHH.", "..HHSSESSSESSHH.", "..HHSSESSSESSHH.", "..HHRSSSSSSSRHH.", "..HHHSSMMSSSHHH."];
const BODY = ["..HHH..SS..HHH..", "..HHTTTTTTTTHH..", "...STTTtTTTTS...", "...STTTtTTTTS...", ".....TTTTTT.....", ".....PPPPPP....."];
function pixel(rows, size) {
  let r = "";
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (PAL[c]) r += `<rect x="${x}" y="${y}" width="1.05" height="1.05" fill="${PAL[c]}"/>`; }));
  return `<svg width="${size}" height="${(size * rows.length) / 16}" viewBox="0 0 16 ${rows.length}" shape-rendering="crispEdges">${r}</svg>`;
}
const head = (s) => pixel(HEAD, s);
const bust = (s) => pixel([...HEAD, ...BODY], s);

const logo = (dark = false) => `<div class="logo"><div class="logo-av">${head(46)}</div><span style="color:${dark ? "#fff" : "#000"}">Maru</span></div>`;
const cta = (t, cls = "") => `<div class="cta-row"><div class="btn ${cls}">${t}</div><div class="url">marucoach.com</div></div>`;
const ilus = (dark = false) => `<div class="ilus" style="color:${dark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.4)"}">Ejemplo ilustrativo</div>`;

const BASE = `
${fonts}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1080px;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}
.page{width:1080px;display:flex;flex-direction:column;padding:80px 80px 72px;position:relative;overflow:hidden}
.feed{height:1350px}.story{height:1920px;padding:220px 80px 300px}.square{height:1080px;width:1080px}
.logo{display:flex;align-items:center;gap:18px;font:700 44px Inter}
.logo-av{width:68px;height:68px;border-radius:50%;background:#d2ffc8;display:flex;align-items:center;justify-content:center;overflow:hidden;padding-top:10px}
.eyebrow{font:600 34px Inter;color:#1c8d4d;margin-top:44px}
.h{font-family:'Titillium Web';font-weight:700;line-height:.95;letter-spacing:-1px;text-transform:uppercase}
.sub{font:400 34px/1.38 Inter;color:#3d4248;margin-top:26px}
.grow{flex:1 0 auto;display:flex;flex-direction:column;justify-content:center;padding:30px 0}
.cta-row{display:flex;align-items:center;justify-content:space-between;margin-top:36px}
.btn{background:#00f0a0;color:#000;font:700 40px Inter;padding:28px 50px;border-radius:999px}
.url{font:500 30px Inter;color:#5c6066}
.ilus{position:absolute;right:80px;font:500 20px Inter;letter-spacing:.5px;text-transform:uppercase}
.feed .ilus,.square .ilus{bottom:26px}.story .ilus{bottom:290px}
.card{background:#fff;border-radius:28px;box-shadow:0 20px 60px rgba(0,0,0,.10);padding:36px 40px}
.chip{display:inline-flex;align-items:center;gap:10px;font:600 28px Inter;padding:12px 20px;border-radius:14px}
.ok{background:#e4f7d4;color:#136c39}.no{background:#ffe5e0;color:#9b1c2e}
.mark{background:#fff3c4;color:#8a5a00;border:2px dashed #e0b23c;padding:2px 12px;border-radius:8px;font-weight:600}
`;

const page = (fmt, bg, body, extra = "") => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${extra}</style></head><body><div class="page ${fmt}" style="background:${bg}">${body}</div></body></html>`;

// ---------- 1 · A · Silencio ----------
const silencio = (fmt) => page(fmt, "#0b0d0c", `
${logo(true)}
<div class="eyebrow" style="color:#00f0a0">CV con IA</div>
<div class="h" style="font-size:${fmt === "story" ? 124 : 118}px;color:#fff;margin-top:20px">40 CV enviados.</div>
<div class="h" style="font-size:${fmt === "story" ? 124 : 118}px;color:#00f0a0">0 respuestas.</div>
<div class="sub" style="color:#c9cfd4">Los filtros buscan las palabras del aviso. Maru adapta tu CV a cada uno.</div>
<div class="grow">
  <div style="display:flex;gap:24px">
    <div class="card" style="flex:1;background:#1a1d1c;box-shadow:none;border:2px solid #2c302e">
      <div style="font:600 24px Inter;color:#8b939c;text-transform:uppercase;letter-spacing:1px">El aviso pide</div>
      <div style="font:700 32px Inter;color:#fff;margin:10px 0 22px">Vendedor/a de salón</div>
      <div style="display:flex;flex-direction:column;gap:14px;align-items:flex-start">
        <span class="chip no">✗ Objetivos de venta</span><span class="chip ok">✓ Atención al público</span><span class="chip no">✗ Manejo de caja</span>
      </div>
      <div style="font:500 24px Inter;color:#8b939c;margin-top:20px">Tu CV de siempre</div>
    </div>
    <div class="card" style="flex:1;border:4px solid #00f0a0">
      <div style="font:600 24px Inter;color:#1c8d4d;text-transform:uppercase;letter-spacing:1px">Con Maru</div>
      <div style="font:700 32px Inter;color:#000;margin:10px 0 22px">Tu CV para este aviso</div>
      <div style="display:flex;flex-direction:column;gap:14px;align-items:flex-start">
        <span class="chip ok">✓ Objetivos de venta</span><span class="chip ok">✓ Atención al público</span><span class="chip ok">✓ Manejo de caja</span>
      </div>
      <div style="font:500 24px Inter;color:#5c6066;margin-top:20px">Con datos que vos le contaste</div>
    </div>
  </div>
</div>
${cta("Adaptar mi CV gratis")}
${ilus(true)}`, `.url{color:#8b939c}`);

// ---------- 2 · B · No inventa ----------
const noInventa = (fmt) => page(fmt, "linear-gradient(180deg,#ecffe0 0%,#ffffff 70%)", `
${logo()}
<div class="eyebrow">Coach de postulación</div>
<div class="h" style="font-size:${fmt === "story" ? 104 : 86}px;margin-top:20px">Maru no te inventa experiencia.</div>
<div class="h" style="font-size:${fmt === "story" ? 104 : 86}px;color:#1c8d4d">Te pregunta.</div>
<div class="grow" style="gap:22px">
  <div style="display:flex;gap:18px;align-items:flex-end">
    <div class="logo-av" style="width:76px;height:76px;flex:none">${head(52)}</div>
    <div style="background:#f2f4f5;border-radius:30px 30px 30px 8px;padding:26px 32px;font:500 32px/1.35 Inter;max-width:780px">El aviso pide manejo de equipos. ¿Tuviste gente a cargo?</div>
  </div>
  <div style="align-self:flex-end;background:#00f0a0;border-radius:30px 30px 8px 30px;padding:26px 32px;font:600 32px/1.35 Inter;max-width:700px">Sí, 3 personas en el turno noche.</div>
  <div class="card" style="margin-top:10px">
    <div style="font:600 24px Inter;color:#1c8d4d;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Así queda en tu CV</div>
    <div style="font:500 32px/1.45 Inter">Coordiné un equipo de 3 personas en el turno noche. Reduje los reclamos en <span class="mark">[completar]</span>.</div>
    <div style="font:500 25px/1.4 Inter;color:#5c6066;margin-top:16px">Si falta un dato, queda marcado para que lo completes vos.</div>
  </div>
</div>
${cta("Preparar mi postulación")}
${ilus()}`);

// ---------- 3 · C · Más de 3.000 búsquedas ----------
const busquedas = (fmt) => page(fmt, "#00f0a0", `
${logo()}
<div class="eyebrow" style="color:#0b3d22">Encontrá tu trabajo</div>
<div class="grow">
  <div class="h" style="font-size:${fmt === "story" ? 300 : 270}px;line-height:.9;letter-spacing:-6px">+3.000</div>
  <div class="h" style="font-size:${fmt === "story" ? 84 : 76}px;margin-top:10px">búsquedas abiertas<br>que podés tomar<br>desde Argentina</div>
  <div class="sub" style="color:#0b3d22;font-size:34px">Maru las ordena según tu CV y te dice por qué encajás en cada una.</div>
  <div style="display:flex;flex-wrap:wrap;gap:14px;margin-top:34px">
    ${["Ventas", "Administración", "Atención al cliente", "Logística", "Finanzas", "Tecnología", "RR. HH.", "Remoto"].map((t) => `<span class="chip" style="background:rgba(255,255,255,.75);color:#000">${t}</span>`).join("")}
  </div>
</div>
${cta("Ver mis matches", "dark")}`, `.btn.dark{background:#000;color:#00f0a0}.url{color:#0b3d22}`);

// ---------- 4 · D · Entrevista ----------
const entrevista = (fmt) => page(fmt, "#f2f4f5", `
${logo()}
<div class="eyebrow">Entrená tu entrevista</div>
<div class="h" style="font-size:${fmt === "story" ? 90 : 86}px;margin-top:20px">La pregunta que te traba,</div>
<div class="h" style="font-size:${fmt === "story" ? 90 : 86}px;color:#1c8d4d">practicala hoy.</div>
<div class="grow">
  <div style="background:#111614;border-radius:32px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.25)">
    <div style="height:${fmt === "story" ? 310 : 250}px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 40%,#1f3a2c,#111614 70%);position:relative">
      ${bust(fmt === "story" ? 170 : 120)}
      <div style="position:absolute;left:28px;top:24px;font:600 24px Inter;color:#fff;background:rgba(0,0,0,.45);padding:8px 16px;border-radius:10px">Maru · Entrevista de RR. HH.</div>
      <div style="position:absolute;right:28px;top:24px;font:600 22px Inter;color:#000;background:#00f0a0;padding:8px 16px;border-radius:10px">Pregunta 3 de 5</div>
    </div>
    <div style="padding:28px 34px;font:500 32px/1.4 Inter;color:#fff;background:#1a1f1d">"Contame de una vez que no llegaste a un objetivo. ¿Qué hiciste después?"</div>
    <div style="padding:20px 34px 26px;display:flex;gap:14px;background:#1a1f1d">
      <span class="chip" style="background:#2a302d;color:#fff">🎙 Respondé por voz</span><span class="chip" style="background:#2a302d;color:#fff">⌨ o por escrito</span>
    </div>
  </div>
  <div class="card" style="margin-top:24px;padding:22px 30px;display:${fmt === "story" ? "flex" : "none"};gap:16px;flex-wrap:wrap;align-items:center">
    <span style="font:700 28px Inter">Al final, tu informe:</span><span class="chip ok">✓ Qué hiciste bien</span><span class="chip no">↗ Qué mejorar</span><span class="chip" style="background:#f2f4f5">Una respuesta más fuerte</span>
  </div>
</div>
${cta("Practicar gratis")}
${ilus()}`);

// ---------- 5 · F · Primer empleo (nota) ----------
const primerEmpleo = (fmt) => page(fmt, "#fffbea", `
${logo()}
<div class="h" style="font-size:${fmt === "story" ? 100 : 84}px;margin-top:44px">No tenés experiencia.</div>
<div class="h" style="font-size:${fmt === "story" ? 100 : 84}px;color:#1c8d4d">Tenés cosas para contar.</div>
<div class="grow">
  <div style="background:#fff;border-radius:24px;box-shadow:0 18px 50px rgba(120,90,0,.14);padding:44px 48px;transform:rotate(-1.2deg);background-image:repeating-linear-gradient(180deg,transparent 0 63px,#f1e7c4 63px 65px);background-position:0 108px">
    <div style="font:700 36px Inter;margin-bottom:26px">Lo que sí puedo poner en mi primer CV</div>
    ${["El proyecto final de la tecnicatura", "Los sábados atendiendo el local de mi tía", "El curso de Excel que terminé en marzo", "Organizar la colecta del club del barrio"].map((t) => `<div style="font:500 33px/65px Inter;display:flex;gap:18px"><span style="color:#1c8d4d;font-weight:800">✓</span>${t}</div>`).join("")}
  </div>
  <div class="sub" style="margin-top:44px">Maru te hace unas preguntas y lo convierte en un CV claro, listo para los filtros automáticos.</div>
</div>
${cta("Armar mi primer CV")}
${ilus()}`);

// ---------- 6 · Match v2 (control) ----------
const matchCard = (ini, color, role, company, reason, pct, ok = true) => `
<div class="card" style="padding:28px 34px;display:flex;gap:24px;align-items:center">
  <div style="width:72px;height:72px;border-radius:16px;background:${color};color:#fff;font:700 34px Inter;display:flex;align-items:center;justify-content:center;flex:none">${ini}</div>
  <div style="flex:1;min-width:0">
    <div style="font:700 32px Inter">${role}</div>
    <div style="font:400 24px Inter;color:#5c6066;margin-top:4px">${company}</div>
    <div style="font:600 24px Inter;color:${ok ? "#136c39" : "#8a5a00"};margin-top:10px">${ok ? "✓" : "•"} ${reason}</div>
  </div>
  <div style="width:96px;height:96px;border-radius:50%;border:8px solid #00f0a0;display:flex;align-items:center;justify-content:center;font:700 30px Inter;flex:none">${pct}<span style="font-size:16px">%</span></div>
</div>`;
const match = (fmt) => page(fmt, "linear-gradient(160deg,#ffffff 40%,#e9fff3)", `
${logo()}
<div class="eyebrow">Match con IA</div>
<div class="h" style="font-size:${fmt === "story" ? 110 : 96}px;margin-top:20px">Encontrá tu</div>
<div class="h" style="font-size:${fmt === "story" ? 110 : 96}px;font-weight:400">trabajo perfecto</div>
<div class="sub">Búsquedas reales que podés tomar desde Argentina, ordenadas por compatibilidad con tu CV.</div>
<div class="grow" style="gap:18px;padding:20px 0">
  ${matchCard("V", "#d6801c", "Vendedor/a de salón", "Comercio · Presencial · Córdoba", "Pide atención al público: está en tu CV", 92)}
  ${matchCard("A", "#4b5ad8", "Administrativo/a contable", "Servicios · Híbrido · CABA", "Pide Tango: está en tu CV", 88)}
  ${matchCard("L", "#3c4652", "Asistente de logística", "Distribución · Presencial · Rosario", "Falta confirmar: licencia de conducir", 81, false)}
</div>
${cta("Encontrar mis matches")}
${ilus()}`);

// ---------- 7 · Carrusel A (1080×1080) ----------
const sq = (bg, body, extra = "") => page("square", bg, body, extra);
const carrusel = [
  sq("#0b0d0c", `${logo(true)}<div class="grow"><div class="h" style="font-size:118px;color:#fff">El mismo CV<br>para todos<br>los avisos</div><div class="h" style="font-size:118px;color:#00f0a0">da el mismo<br>resultado.</div></div><div style="font:600 34px Inter;color:#8b939c;text-align:right">Deslizá →</div>`),
  sq("#ffffff", `<div style="font:800 40px Inter;color:#1c8d4d">1 · Lo que pide el aviso</div><div class="grow" style="gap:30px"><div style="font:700 56px/1.15 Inter">Vendedor/a de salón</div><div style="display:flex;flex-wrap:wrap;gap:16px"><span class="chip" style="background:#f2f4f5;font-size:34px">Atención al público</span><span class="chip" style="background:#f2f4f5;font-size:34px">Objetivos de venta</span><span class="chip" style="background:#f2f4f5;font-size:34px">Manejo de caja</span></div><div class="card" style="border:2px solid #e8eaec;box-shadow:none"><div style="font:600 26px Inter;color:#5c6066;margin-bottom:10px">Tu CV dice:</div><div style="font:500 36px/1.4 Inter">"Vendedora en local de ropa (2021-2024)."</div></div></div>${ilus()}`),
  sq("#ecffe0", `<div style="font:800 40px Inter;color:#1c8d4d">2 · Maru te pregunta lo que falta</div><div class="grow" style="gap:26px"><div style="display:flex;gap:18px;align-items:flex-end"><div class="logo-av" style="width:80px;height:80px;flex:none">${head(54)}</div><div style="background:#fff;border-radius:30px 30px 30px 8px;padding:30px 34px;font:500 38px/1.35 Inter">¿Tenías objetivos de venta? ¿Cómo te fue?</div></div><div style="align-self:flex-end;background:#00f0a0;border-radius:30px 30px 8px 30px;padding:30px 34px;font:600 38px/1.35 Inter;max-width:760px">En diciembre pasé el objetivo por un 20%. También cerraba la caja.</div></div>${ilus()}`),
  sq("#ffffff", `<div style="font:800 40px Inter;color:#1c8d4d">3 · Tu CV para este aviso</div><div class="grow"><div class="card" style="border:4px solid #00f0a0"><div style="font:700 36px Inter">Vendedora · Local de ropa</div><div style="font:400 26px Inter;color:#5c6066;margin:6px 0 20px">2021 – 2024</div><div style="font:500 34px/1.5 Inter">Superé el <b style="background:#e4f7d4">objetivo de ventas</b> de diciembre en un 20%. <b style="background:#e4f7d4">Atención al público</b> y <b style="background:#e4f7d4">manejo de caja</b> en el cierre diario.</div></div><div style="font:500 30px Inter;color:#5c6066;margin-top:28px">Las palabras del aviso, con hechos tuyos.</div></div>${ilus()}`),
  sq("#00f0a0", `${logo()}<div class="grow"><div class="h" style="font-size:120px">Un CV distinto<br>para cada<br>búsqueda.</div><div class="sub" style="color:#0b3d22">Sin inventar nada. Empezá gratis.</div></div>${cta("Adaptar mi CV", "dark")}`, `.btn.dark{background:#000;color:#00f0a0}.url{color:#0b3d22}`),
];

const PIECES = { "t1-silencio": silencio, "t1-noinventa": noInventa, "t1-busquedas": busquedas, "t1-entrevista": entrevista, "t1-primerempleo": primerEmpleo, "t1-match-v2": match };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
async function shot(html, file, h) {
  const f = path.join(DIR, "_tmp.html");
  fs.writeFileSync(f, html);
  await p.setViewportSize({ width: 1080, height: h });
  await p.goto("file://" + f);
  await p.evaluate(() => document.fonts.ready);
  // Aviso si algo se desborda.
  const over = await p.evaluate(() => { const pg = document.querySelector(".page"); const d = pg.scrollHeight - pg.clientHeight; return d > 1 ? d : 0; });
  if (over) console.warn("DESBORDA:", file, over);
  await p.screenshot({ path: path.join(OUT, file), clip: { x: 0, y: 0, width: 1080, height: h } });
}
for (const [name, fn] of Object.entries(PIECES)) {
  await shot(fn("feed"), `${name}-feed.png`, 1350);
  await shot(fn("story"), `${name}-story.png`, 1920);
}
for (let i = 0; i < carrusel.length; i++) await shot(carrusel[i], `t1-carrusel-${i + 1}.png`, 1080);
await browser.close();
console.log("listo", fs.readdirSync(OUT).length);
