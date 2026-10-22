// Coordina el autocompletado: lee los campos de los frames de la pestaña,
// le pide a Maru qué poner en cada uno y los completa. Nunca envía el formulario.
// Permisos: sólo la pestaña donde la persona abre Maru (activeTab, con el clic en el ícono o Alt+Shift+M)
// y, si el formulario está embebido desde un ATS, ese dominio, con permiso pedido en el momento.

importScripts("jobkey.js", "ats.js");

const DEFAULT_SERVER = "https://www.marucoach.com";
/** Sitios de Maru: sólo desde ahí el puente (bridge.js) puede pasar postulaciones a la extensión. */
const MARU_ORIGINS = /^(https:\/\/(www\.)?marucoach\.com|http:\/\/localhost(:\d+)?)$/;

/** Error para mostrarle a la persona, con botones opcionales para el aviso (por ejemplo, "Ver planes"). */
class UserError extends Error {
  constructor(message, actions) {
    super(message);
    this.actions = actions || [];
  }
}

/** Instalada desde la Chrome Web Store (Chrome la actualiza sola) o cargada a mano desde el zip. */
const fromStore = () => !!chrome.runtime.getManifest().update_url;

/** Identificador al azar de esta instalación: sólo sirve para contar los usos gratis del día. */
async function installId() {
  const { installId: saved } = await chrome.storage.local.get("installId");
  if (saved) return saved;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

async function settings() {
  const data = await chrome.storage.local.get(["profile", "cv", "extras", "server", "postulaciones"]);
  return { ...data, server: (data.server || DEFAULT_SERVER).replace(/\/+$/, "") };
}

/** Corre `func` en los frames de la pestaña (en el mundo aislado de la extensión, donde vive window.__maru). */
async function run(tabId, func, args = [], frameIds) {
  const target = frameIds ? { tabId, frameIds } : { tabId, allFrames: true };
  let results;
  try {
    results = await chrome.scripting.executeScript({ target, func, args });
  } catch (err) {
    // Con activeTab, un iframe de otro dominio sin permiso no admite scripts: se sigue con la página principal.
    if (frameIds) throw err;
    results = await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func, args });
  }
  return results.filter((r) => r && r.result !== undefined && r.result !== null);
}

/** Inyecta content.js donde hay acceso: la pestaña (activeTab) y los iframes de ATS ya autorizados. */
async function inject(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content.js"] });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ["content.js"] });
  }
}

/**
 * Dominios de ATS embebidos en la página (iframes) para los que todavía no hay permiso.
 * Se leen desde la página principal, a la que sí hay acceso.
 */
async function missingAtsPermissions(tabId) {
  const [frame] = await run(tabId, () => [...document.querySelectorAll("iframe[src]")].map((f) => f.src).slice(0, 50), [], [0]).catch(() => []);
  const domains = new Set();
  for (const src of (frame && frame.result) || []) {
    try {
      const d = self.MARU_ATS.atsDomain(new URL(src).hostname);
      if (d) domains.add(d);
    } catch {
      // src inválido: se ignora
    }
  }
  const missing = [];
  for (const d of domains) if (!(await chrome.permissions.contains({ origins: [self.MARU_ATS.atsPattern(d)] }))) missing.push(d);
  return missing;
}

const toast = (tabId, message, opts) =>
  run(tabId, (m, o) => window.__maru && window.__maru.toast(m, o), [message, opts || {}], [0]).catch(() => {});

function progress(step) {
  chrome.runtime.sendMessage({ type: "progress", step }).catch(() => {});
}

/* ---------- Ícono: progreso real y error visible (que el botón nunca parezca no hacer nada) ---------- */

const badge = {
  working: (tabId) => {
    chrome.action.setBadgeBackgroundColor({ color: "#1c8c4c", tabId });
    chrome.action.setBadgeText({ text: "…", tabId });
  },
  done: (tabId, n) => {
    chrome.action.setBadgeBackgroundColor({ color: "#1c8c4c", tabId });
    chrome.action.setBadgeText({ text: n > 99 ? "99+" : String(n), tabId });
  },
  error: (tabId) => {
    chrome.action.setBadgeBackgroundColor({ color: "#c0623a", tabId });
    chrome.action.setBadgeText({ text: "!", tabId });
  },
};

/** Campos que sólo tiene un formulario de postulación (un widget de newsletter o de chat no los pide). */
const APPLY_WORDS = /cv|curr[ií]cul|resum[eé]|portfolio|portafolio|linkedin|github|postula|apply|application|experiencia|experience|cover letter|carta|pretensi|salar|disponibilidad|notice/i;

/** Nombre corto del ATS para el seguimiento (sin datos personales). */
function atsOf(url) {
  try {
    return self.MARU_ATS.atsDomain(new URL(url).hostname).split(".")[0];
  } catch {
    return "";
  }
}

/**
 * Sólo se completan los frames de la misma página, de un sitio de postulación conocido o que piden
 * datos de postulación: nunca widgets de terceros (newsletters, chats) que recibirían tus datos.
 */
function ownFrame(result, topOrigin) {
  const origin = result.origin;
  if (!origin || origin === topOrigin) return true;
  try {
    if (self.MARU_ATS.atsDomain(new URL(origin).hostname)) return true;
  } catch {
    return false;
  }
  return result.fields.some((f) => f.tipo === "archivo" || APPLY_WORDS.test(`${f.etiqueta} ${f.ayuda || ""}`));
}

/* ---------- La postulación que la persona armó en Maru para esta vacante ---------- */

/** La postulación guardada para alguna de las URLs (la pestaña y los frames del formulario). */
function findPostulacion(list, urls) {
  if (!Array.isArray(list)) return null;
  const keys = new Set(urls.map((u) => self.maruJobKey(u)).filter(Boolean));
  return list.find((p) => p && keys.has(p.key)) || null;
}

const safeName = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);

/**
 * El PDF del CV personalizado. Lo imprime Maru (necesita la sesión de Maru abierta en este Chrome) y queda
 * en caché hasta que la postulación cambie. Si no se puede, se usa el CV base.
 */
async function tailoredCv(server, post) {
  if (!post.cvHtml) return null;
  const name = `CV - ${safeName(post.nombre) || "CV"} - ${safeName(post.company) || "Empresa"}.pdf`;
  const { tailoredPdf } = await chrome.storage.local.get("tailoredPdf");
  if (tailoredPdf && tailoredPdf.key === post.key && tailoredPdf.updatedAt === post.updatedAt) return { name, mime: "application/pdf", base64: tailoredPdf.base64 };
  try {
    const res = await fetch(`${server}/api/export/pdf`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html: post.cvHtml, padY: post.padY }),
    });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const base64 = btoa(bin);
    await chrome.storage.local.set({ tailoredPdf: { key: post.key, updatedAt: post.updatedAt, base64 } });
    return { name, mime: "application/pdf", base64 };
  } catch {
    return null;
  }
}

/* ---------- Cupo del plan gratis ---------- */

const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

/** Guarda cuántos usos quedan hoy (lo muestra el popup). */
async function saveQuota(data) {
  if (typeof data.remaining !== "number") return chrome.storage.local.remove("quota");
  await chrome.storage.local.set({ quota: { remaining: data.remaining, limit: data.limit, day: today() } });
}

/** El link a los planes se ofrece una sola vez por día, para no insistir. */
async function upgradeOnce() {
  const { upgradeShown } = await chrome.storage.local.get("upgradeShown");
  if (upgradeShown === today()) return false;
  await chrome.storage.local.set({ upgradeShown: today() });
  return true;
}

function quotaLine(data) {
  if (typeof data.remaining !== "number") return "";
  if (data.remaining === 0) return "Era tu último autocompletado gratis de hoy.";
  return data.remaining === 1 ? "Te queda 1 uso hoy." : `Te quedan ${data.remaining} usos hoy.`;
}

/* ---------- Completar ---------- */

async function fillTab(tab) {
  if (!tab || !tab.id || !/^(https?|file):/.test(tab.url || "")) {
    throw new UserError("Abrí el formulario de postulación en esta pestaña y probá de nuevo.");
  }
  const { profile, cv, extras, server, postulaciones } = await settings();
  if (!profile) throw new UserError("Primero cargá tu CV: tocá el ícono de Maru en la barra de Chrome.");

  const tabId = tab.id;
  await inject(tabId);
  const blocked = await missingAtsPermissions(tabId);
  progress("Leyendo el formulario…");
  await toast(tabId, "Maru está leyendo el formulario…", { sticky: true });

  const allScans = await run(tabId, () => window.__maru.scan());
  const topOrigin = ((allScans.find((s) => s.frameId === 0) || {}).result || {}).origin;
  const scans = allScans.filter((s) => s.frameId === 0 || ownFrame(s.result, topOrigin));
  const fields = [];
  for (const { frameId, result } of scans) {
    for (const f of result.fields) fields.push({ ...f, id: `${frameId}:${f.id}` });
  }
  if (!fields.length) {
    if (blocked.length) throw new UserError(blockedMessage(blocked));
    throw new UserError("No encontramos campos vacíos para completar. Si el formulario aparece al tocar “Postularme”, abrilo y probá de nuevo.");
  }
  const top = (scans.find((s) => s.frameId === 0) || {}).result || { title: "", text: "" };

  // ¿Ya preparó esta postulación en Maru? Se busca por la pestaña y por los frames (Greenhouse embebido, etc.).
  const frameUrls = scans.map((s) => s.result.url).filter(Boolean);
  const post = findPostulacion(postulaciones, [tab.url, ...frameUrls]);
  let attach = cv;
  let tailored = false;
  if (post) {
    progress("Preparando tu CV personalizado…");
    const pdf = await tailoredCv(server, post);
    if (pdf) {
      attach = pdf;
      tailored = true;
    }
  }

  progress(`Completando ${fields.length} campos…`);
  await toast(tabId, `Maru está completando ${fields.length} campos…`, { sticky: true });
  let res;
  try {
    res = await fetch(`${server}/api/autofill`, {
      method: "POST",
      // Con la sesión de Maru abierta en Chrome, el cupo se cuenta en tu cuenta (y respeta tu plan).
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "X-Maru-Install": await installId(),
        "X-Maru-Version": chrome.runtime.getManifest().version,
        ...(fromStore() ? { "X-Maru-Source": "store" } : {}),
      },
      body: JSON.stringify({
        profile,
        extras: (extras || "").slice(0, 4000),
        hasCv: !!attach,
        page: { url: tab.url.slice(0, 2000), title: top.title.slice(0, 500), text: top.text },
        fields: fields.slice(0, 250),
        ...(post
          ? {
              postulacion: {
                empresa: String(post.company || "").slice(0, 200),
                puesto: String(post.title || "").slice(0, 300),
                motivacion: String(post.motivacion || "").slice(0, 4000),
                respuestas: (post.respuestas || []).slice(0, 20).map((r) => ({ pregunta: String(r.pregunta).slice(0, 500), respuesta: String(r.respuesta).slice(0, 4000) })),
              },
            }
          : {}),
      }),
    });
  } catch {
    throw new UserError(`No pudimos conectar con Maru (${server}). Revisá tu conexión y probá de nuevo.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.code === "PLAN_LIMIT") {
      await saveQuota({ remaining: 0, limit: data.limit });
      const actions = data.upgradeUrl && (await upgradeOnce()) ? [{ label: "Ver planes", href: data.upgradeUrl }] : [];
      throw new UserError(data.error || "Llegaste al límite gratis de hoy.", actions);
    }
    throw new UserError(data.error || "Algo falló del lado de Maru. Probá de nuevo.");
  }
  await saveQuota(data);

  // Cada frame recibe sólo sus respuestas.
  const byFrame = new Map();
  for (const a of data.answers || []) {
    const [frame, id] = [Number(a.id.split(":")[0]), a.id.slice(a.id.indexOf(":") + 1)];
    if (!byFrame.has(frame)) byFrame.set(frame, []);
    byFrame.get(frame).push({ ...a, id });
  }
  const total = { completados: 0, revisar: 0, pendientes: 0 };
  for (const { frameId } of scans) {
    const answers = byFrame.get(frameId) || [];
    const withCv = answers.some((a) => a.valor === "cv") ? attach : null;
    const pass = scans.find((s) => s.frameId === frameId).result.pass;
    const [r] = await run(tabId, (a, c, p) => window.__maru.apply(a, c, p), [answers, withCv, pass], [frameId]);
    if (r) for (const k of Object.keys(total)) total[k] += r.result[k];
  }

  const page = { url: tab.url, title: top.title || tab.title || "" };
  const lines = [summarize(total)];
  if (tailored) lines.unshift(`Usamos tu CV personalizado para ${post.company || "esta vacante"}.`);
  else if (post) lines.unshift("Usamos lo que preparaste en Maru para esta vacante. Para adjuntar tu CV personalizado, ingresá en Maru en este Chrome.");
  if (blocked.length) lines.push(`Una parte del formulario está dentro de ${blocked.join(", ")}: para completarla, tocá el ícono de Maru y aceptá el permiso.`);
  const quota = quotaLine(data);
  if (quota) lines.push(quota);
  // Hay una versión nueva: se avisa en el resumen y en el popup (desde la Store, Chrome la actualiza sola).
  if (data.update && data.update.latest) {
    await chrome.storage.local.set({ update: data.update });
    if (!fromStore()) lines.push(`Hay una versión nueva de Maru (${data.update.latest}): bajala en ${data.update.url}.`);
  }
  const actions = post ? [] : [{ label: "Personalizá tu CV para esta vacante", href: `${server}/postulacion?${new URLSearchParams({ url: tab.url })}#empezar`, secondary: true }];
  const summary = lines.join("\n");
  await toast(tabId, summary, { actions });

  // Queda atento al envío para ofrecer guardarla en el seguimiento (nunca envía nada).
  await chrome.storage.session.set({ [`track:${tabId}`]: { page, company: post ? post.company : "", ats: atsOf(tab.url) || atsOf(frameUrls[0] || ""), at: Date.now(), asked: false } });
  await run(tabId, () => window.__maru.watch(), [], [0]).catch(() => {});

  return { ...total, summary, tailored, company: post ? post.company : "", page, remaining: data.remaining, limit: data.limit };
}

/** El formulario está embebido desde un ATS sin permiso: el permiso se pide desde el popup (necesita el clic). */
function blockedMessage(domains) {
  return `El formulario está dentro de ${domains.join(", ")}. Tocá el ícono de Maru, después «Completar esta postulación» y aceptá el permiso para ese sitio.`;
}

function summarize({ completados, revisar, pendientes }) {
  if (!completados) return "No encontramos datos de tu CV para estos campos. Completalos vos o sumá datos extra en Maru.";
  const verdes = completados - revisar;
  const lines = [`Listo: completamos ${completados} ${completados === 1 ? "campo" : "campos"}${verdes && revisar ? ` (${verdes} en verde)` : revisar ? "" : " (en verde)"}.`];
  if (revisar) lines.push(revisar === 1 ? "Revisá el marcado en amarillo: Maru lo redactó o dedujo." : `Revisá los ${revisar} marcados en amarillo: Maru los redactó o dedujo.`);
  if (pendientes) lines.push(`${pendientes === 1 ? "Queda 1 obligatorio" : `Quedan ${pendientes} obligatorios`} para completar vos.`);
  lines.push("Revisá todo y enviá cuando quieras.");
  return lines.join("\n");
}

/** Pestañas que se están completando: un segundo pedido mientras corre el primero mezclaría los campos. */
const running = new Set();

async function fillActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab && tab.id && running.has(tab.id)) return { error: "Ya estoy completando este formulario: esperá unos segundos." };
  if (tab && tab.id) {
    running.add(tab.id);
    badge.working(tab.id);
  }
  try {
    const result = await fillTab(tab);
    if (tab && tab.id) badge.done(tab.id, result.completados);
    return result;
  } catch (err) {
    const message = err instanceof UserError ? err.message : "Algo salió mal. Recargá la página y probá de nuevo.";
    if (!(err instanceof UserError)) console.error(err);
    if (tab && tab.id) {
      badge.error(tab.id);
      await toast(tab.id, message, { error: true, actions: (err instanceof UserError && err.actions) || [] });
    }
    return { error: message };
  } finally {
    if (tab && tab.id) running.delete(tab.id);
  }
}

/* ---------- Seguimiento al enviar ---------- */

/** Ofrece guardar la postulación una sola vez por pestaña, cuando la página muestra que se envió. */
async function offerTracking(tabId) {
  const k = `track:${tabId}`;
  const { [k]: pending } = await chrome.storage.session.get(k);
  if (!pending || pending.asked || Date.now() - pending.at > 60 * 60 * 1000) return;
  await chrome.storage.session.set({ [k]: { ...pending, asked: true } });
  await toast(tabId, "¿La enviaste? Guardala en tu seguimiento para no perderle el rastro.", {
    sticky: true,
    actions: [{ label: "Guardar en mi seguimiento", message: { type: "track" } }],
  });
}

/** Guarda la postulación en el seguimiento de la cuenta; sin sesión, abre el seguimiento de Maru como antes. */
async function trackApplication(tabId, page, extra = {}) {
  const { server } = await settings();
  try {
    const res = await fetch(`${server}/api/tracking/application`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: page.url, title: (page.title || "").slice(0, 300), company: (extra.company || "").slice(0, 200), ats: extra.ats || "" }),
    });
    if (res.ok) {
      if (tabId) await toast(tabId, "Guardada en tu seguimiento como Postulada.");
      return { ok: true };
    }
  } catch {
    // sin conexión: se abre el seguimiento de Maru
  }
  const q = new URLSearchParams({ add: page.url, title: (page.title || "").slice(0, 200) });
  await chrome.tabs.create({ url: `${server}/seguimiento?${q}` });
  return { ok: true, opened: true };
}

// Con activeTab no se puede volver a inyectar después de navegar: la confirmación se detecta en la misma
// página (watch). Si el envío lleva a otra página, queda el botón «Guardar en mi seguimiento» del popup.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`track:${tabId}`).catch(() => {});
});

/* ---------- Puente con el sitio de Maru ---------- */

/** Limpia lo que llega del sitio de Maru antes de guardarlo: sólo campos conocidos y con tope de tamaño. */
function cleanPostulaciones(list) {
  if (!Array.isArray(list)) return [];
  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  return list.slice(0, 10).filter((p) => p && typeof p.key === "string" && p.key).map((p) => ({
    key: str(p.key, 300),
    jobUrl: str(p.jobUrl, 2000),
    company: str(p.company, 200),
    title: str(p.title, 300),
    nombre: str(p.nombre, 200),
    motivacion: str(p.motivacion, 4000),
    respuestas: Array.isArray(p.respuestas) ? p.respuestas.slice(0, 20).map((r) => ({ pregunta: str(r && r.pregunta, 500), respuesta: str(r && r.respuesta, 4000) })) : [],
    ...(typeof p.cvHtml === "string" && p.cvHtml.length < 600000 ? { cvHtml: p.cvHtml, padY: typeof p.padY === "number" ? p.padY : undefined } : {}),
    updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : 0,
  }));
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "fill") {
    fillActiveTab().then(sendResponse);
    return true;
  }
  if (msg.type === "postulaciones") {
    // Sólo el puente que corre en el sitio de Maru puede escribir esto.
    const origin = sender.origin || (sender.url ? new URL(sender.url).origin : "");
    if (sender.id !== chrome.runtime.id || !MARU_ORIGINS.test(origin)) return;
    chrome.storage.local.set({ postulaciones: cleanPostulaciones(msg.list) });
    return;
  }
  if (msg.type === "ats-permissions" && typeof msg.tabId === "number") {
    // El popup pregunta al abrirse qué dominios de ATS embebidos faltan autorizar en esta pestaña.
    missingAtsPermissions(msg.tabId).then(sendResponse, () => sendResponse([]));
    return true;
  }
  if (msg.type === "submitted" && sender.tab && sender.tab.id) {
    offerTracking(sender.tab.id);
    return;
  }
  if (msg.type === "track") {
    const tabId = sender.tab && sender.tab.id;
    (async () => {
      if (msg.page) return trackApplication(tabId, msg.page, msg);
      const k = `track:${tabId}`;
      const { [k]: pending } = await chrome.storage.session.get(k);
      if (!pending) return { ok: false };
      return trackApplication(tabId, pending.page, pending);
    })().then(sendResponse);
    return true;
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "fill") fillActiveTab();
});

// Para los tests de punta a punta.
self.fillActiveTab = fillActiveTab;
self.trackApplication = trackApplication;
