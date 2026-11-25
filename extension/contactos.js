// Página de contactos de una vacante. La abre el popup («Contactos de esta vacante») con la vacante ya leída.
// 1. Maru arma qué buscar (/api/contactos/plan, cuenta un uso del cupo).
// 2. Busca en el LinkedIn de la persona, en una pestaña aparte, y lee las tarjetas de resultados (linkedin.js).
// 3. Maru elige a quiénes escribirles y redacta la nota y el mensaje (/api/contactos/elegir).
// 4. «Preparar invitación»: abre el perfil, toca «Conectar» y deja la nota. La persona aprieta «Enviar».

const DEFAULT_SERVER = "https://www.marucoach.com";
const LINKEDIN = "https://www.linkedin.com/*";
const NOTE_MAX = 200;
/** Una búsqueda que quedó «buscando» más que esto se cortó (se cerró la página o se reinició Chrome). */
const STALE_MS = 3 * 60 * 1000;
const TIPOS = { hiring_manager: "Lidera el equipo", recruiter: "Recluta", people: "People / RR. HH." };
const ESTADOS = {
  preparada: "Invitación preparada en LinkedIn: falta que toques «Enviar».",
  invitado: "Invitación enviada ✓. Cuando acepte, mandale el mensaje.",
  conectado: "Ya están conectados: mandale el mensaje.",
};
/** Aviso en el perfil de LinkedIn según lo que pudo hacer linkedin.js. */
const AVISOS = {
  nota_lista: "Maru dejó la nota en la invitación. Revisala y tocá «Enviar»: Maru no envía nada por vos.",
  limite_notas:
    "LinkedIn no deja agregar más notas este mes en cuentas gratis. Enviá la invitación sin nota y, cuando acepte, mandale el mensaje que te dejamos en Maru.",
  pendiente: "Ya le mandaste una invitación a esta persona: está pendiente.",
  conectado: "Ya están conectados. Tocá «Mensaje» y pegá el mensaje que te dejamos en Maru.",
  sin_boton: "No encontramos el botón «Conectar» en este perfil. Copiá la nota desde Maru y mandala a mano.",
  sin_dialogo: "LinkedIn no abrió la ventana de la invitación. Copiá la nota desde Maru y mandala a mano.",
  login: "Ingresá a LinkedIn en este Chrome y volvé a tocar «Preparar invitación» en Maru.",
};

const $ = (id) => document.getElementById(id);
const key = new URLSearchParams(location.search).get("key") || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class UserError extends Error {
  constructor(message, actions) {
    super(message);
    this.actions = actions || [];
  }
}

/* ---------- Datos guardados ---------- */

async function sets() {
  const { contactSets } = await chrome.storage.local.get("contactSets");
  return Array.isArray(contactSets) ? contactSets : [];
}
const getSet = async () => (await sets()).find((s) => s.key === key) || null;

/** Cambia el set de esta vacante (patch es un objeto o una función que recibe el set y devuelve el nuevo). */
async function update(patch) {
  const all = await sets();
  const i = all.findIndex((s) => s.key === key);
  if (i < 0) return null;
  all[i] = typeof patch === "function" ? patch(all[i]) : { ...all[i], ...patch };
  await chrome.storage.local.set({ contactSets: all });
  return all[i];
}
const updateContact = (url, patch) => update((s) => ({ ...s, contactos: (s.contactos || []).map((c) => (c.url === url ? { ...c, ...patch } : c)) }));

/* ---------- Maru ---------- */

async function server() {
  const { server: saved } = await chrome.storage.local.get("server");
  return (saved || DEFAULT_SERVER).replace(/\/+$/, "");
}

async function installId() {
  const { installId: saved } = await chrome.storage.local.get("installId");
  if (saved) return saved;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ installId: id });
  return id;
}

async function api(path, body) {
  const base = await server();
  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "X-Maru-Install": await installId(),
        "X-Maru-Version": chrome.runtime.getManifest().version,
        ...(chrome.runtime.getManifest().update_url ? { "X-Maru-Source": "store" } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new UserError(`No pudimos conectar con Maru (${base}). Revisá tu conexión y probá de nuevo.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const upgrade = data.code === "PLAN_LIMIT" && data.upgradeUrl ? [{ label: "Ver planes", href: new URL(data.upgradeUrl, base).href }] : [];
    throw new UserError(data.error || "Algo falló del lado de Maru. Probá de nuevo.", upgrade);
  }
  return data;
}

/* ---------- Pestañas de LinkedIn ---------- */

/** Espera a que la pestaña termine de cargar (o 20 segundos). */
async function loaded(tabId, ms = 20000) {
  await sleep(600);
  for (let t = 0; t < ms; t += 400) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) throw new UserError("Se cerró la pestaña de LinkedIn. Probá de nuevo.");
    if (tab.status === "complete" && !tab.pendingUrl) return tab;
    await sleep(400);
  }
  return chrome.tabs.get(tabId);
}

const onLoginWall = (url) => /linkedin\.com\/(login|authwall|checkpoint|uas\/login|signup)/.test(url || "");

async function readSearch(tabId) {
  const tab = await loaded(tabId);
  if (onLoginWall(tab.url)) return { login: true, cards: [] };
  await chrome.scripting.executeScript({ target: { tabId }, files: ["linkedin.js"] });
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func: () => window.__maruLinkedIn.readSearch() });
  return (r && r.result) || { cards: [], timeout: true };
}

/** Las búsquedas de personas, una tras otra en una misma pestaña en segundo plano, con pausas como las de una persona. */
async function searchLinkedIn(busquedas) {
  const me = await chrome.tabs.getCurrent();
  const tarjetas = [];
  const seen = new Set();
  let tab = null;
  try {
    for (const [i, b] of busquedas.entries()) {
      if (i) await sleep(1500 + Math.random() * 1500);
      tab = tab
        ? await chrome.tabs.update(tab.id, { url: b.url })
        : await chrome.tabs.create({ url: b.url, active: false, ...(me ? { windowId: me.windowId, index: me.index + 1 } : {}) });
      let result = await readSearch(tab.id);
      if (result.login) throw new UserError("Ingresá a LinkedIn en este Chrome y tocá «Buscar de nuevo».");
      if (!result.cards.length && result.timeout) {
        // En segundo plano LinkedIn a veces no termina de dibujar: se muestra la pestaña un momento.
        await chrome.tabs.update(tab.id, { active: true });
        result = await readSearch(tab.id);
        if (me) await chrome.tabs.update(me.id, { active: true });
      }
      for (const c of result.cards) {
        if (seen.has(c.url)) continue;
        seen.add(c.url);
        tarjetas.push({ url: c.url, texto: c.texto, busqueda: b.tipo });
      }
    }
  } finally {
    if (tab) await chrome.tabs.remove(tab.id).catch(() => {});
  }
  return tarjetas.slice(0, 40);
}

/* ---------- Buscar ---------- */

let searching = false;

async function search() {
  if (searching) return;
  searching = true;
  let set = await update({ estado: "buscando", paso: "Leyendo la vacante…", error: "", actions: [], started: Date.now() });
  render(set);
  try {
    if (!set) throw new UserError("No encontramos la vacante. Volvé al aviso, abrí Maru y tocá «Contactos de esta vacante».");
    if (!(await chrome.permissions.contains({ origins: [LINKEDIN] }))) {
      throw new UserError("Maru necesita permiso para LinkedIn. Volvé al aviso, abrí Maru, tocá «Contactos de esta vacante» y aceptá el permiso.");
    }
    const plan = await api("/api/contactos/plan", { page: set.page, ...(set.postulacion ? { postulacion: set.postulacion } : {}) });
    set = await update({
      empresa: plan.empresa,
      puesto: plan.puesto,
      quota: typeof plan.remaining === "number" ? { remaining: plan.remaining, limit: plan.limit } : null,
      paso: `Buscando en tu LinkedIn a quienes deciden en ${plan.empresa}…`,
    });
    render(set);
    const tarjetas = await searchLinkedIn(plan.busquedas || []);
    if (!tarjetas.length) throw new UserError(`No encontramos en LinkedIn a nadie de ${plan.empresa} con esos cargos. Probá buscar «${plan.empresa}» en Personas.`);
    render(await update({ paso: "Eligiendo a quiénes escribirles y armando las notas…" }));
    const { profile } = await chrome.storage.local.get("profile");
    const out = await api("/api/contactos/elegir", {
      empresa: plan.empresa,
      puesto: plan.puesto,
      vacante: String(set.page.text || "").slice(0, 12000),
      ...(profile ? { profile } : {}),
      tarjetas,
    });
    if (!out.contactos || !out.contactos.length) throw new UserError(`En los resultados de LinkedIn no apareció nadie que hoy trabaje en ${plan.empresa}.`);
    await update({ estado: "listo", paso: "", contactos: out.contactos.map((c) => ({ ...c, estado: "sugerido" })), at: Date.now() });
  } catch (err) {
    if (!(err instanceof UserError)) console.error(err);
    await update({ estado: "error", paso: "", error: err instanceof UserError ? err.message : "Algo salió mal. Probá de nuevo.", actions: (err && err.actions) || [] });
  } finally {
    searching = false;
  }
  render(await getSet());
}

/* ---------- Preparar la invitación ---------- */

async function prepare(url, button) {
  const set = await getSet();
  const c = set && (set.contactos || []).find((x) => x.url === url);
  if (!c) return;
  button.disabled = true;
  try {
    if (!(await chrome.permissions.contains({ origins: [LINKEDIN] }))) throw new UserError(AVISOS.login);
    const tab = await chrome.tabs.create({ url: c.url, active: true });
    const loadedTab = await loaded(tab.id);
    let estado;
    if (onLoginWall(loadedTab.url)) estado = "login";
    else {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js", "linkedin.js"] });
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (n) => window.__maruLinkedIn.prepareInvite(n), args: [c.nota] });
      estado = (r && r.result && r.result.estado) || "sin_boton";
    }
    const ok = estado === "nota_lista" || estado === "limite_notas";
    await chrome.scripting
      .executeScript({ target: { tabId: tab.id }, func: (m, o) => window.__maru && window.__maru.toast(m, o), args: [AVISOS[estado] || AVISOS.sin_boton, { sticky: ok, error: !ok && estado !== "pendiente" && estado !== "conectado" }] })
      .catch(() => {});
    const next = ok ? "preparada" : estado === "pendiente" ? "invitado" : estado === "conectado" ? "conectado" : null;
    if (next && c.estado !== "invitado") await updateContact(c.url, { estado: next });
  } catch (err) {
    if (!(err instanceof UserError)) console.error(err);
    showError(err instanceof UserError ? err.message : "No pudimos abrir LinkedIn. Probá de nuevo.");
  } finally {
    button.disabled = false;
  }
}

/* ---------- Pantalla ---------- */

function showError(message, actions = []) {
  $("error-text").textContent = message;
  const box = $("error-actions");
  box.replaceChildren();
  for (const a of actions) {
    const link = document.createElement("a");
    link.href = a.href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = a.label;
    box.append(link);
  }
  $("error").hidden = false;
}

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const label = button.textContent;
    button.textContent = "Copiado";
    setTimeout(() => (button.textContent = label), 1500);
  } catch {
    button.textContent = "No se pudo copiar";
  }
}

const saveTimers = new Map();
function saveLater(url, field, value) {
  clearTimeout(saveTimers.get(url + field));
  saveTimers.set(
    url + field,
    setTimeout(() => updateContact(url, { [field]: value }), 400),
  );
}

function countNote(item, text) {
  const count = item.querySelector(".count");
  count.textContent = `${text.length}/${NOTE_MAX}`;
  count.classList.toggle("over", text.length > NOTE_MAX);
}

function renderContact(c) {
  const item = $("item").content.firstElementChild.cloneNode(true);
  const name = item.querySelector(".name");
  name.textContent = c.nombre;
  name.href = c.url;
  item.querySelector(".cargo").textContent = c.cargo;
  const tipo = item.querySelector(".tipo");
  tipo.textContent = TIPOS[c.tipo] || "";
  tipo.classList.add(c.tipo);
  item.querySelector(".motivo").textContent = c.motivo;
  const note = item.querySelector(".note textarea");
  note.value = c.nota;
  countNote(item, c.nota);
  note.addEventListener("input", () => {
    countNote(item, note.value);
    saveLater(c.url, "nota", note.value);
  });
  const message = item.querySelector(".message");
  message.value = c.mensaje;
  message.addEventListener("input", () => saveLater(c.url, "mensaje", message.value));
  item.querySelector(".copy-note").addEventListener("click", (e) => copy(note.value, e.currentTarget));
  item.querySelector(".copy-message").addEventListener("click", (e) => copy(message.value, e.currentTarget));
  const prep = item.querySelector(".prepare");
  if (c.estado === "invitado" || c.estado === "conectado") prep.textContent = "Abrir perfil en LinkedIn";
  prep.addEventListener("click", async (e) => {
    const button = e.currentTarget;
    // Lo que la persona acaba de escribir en la nota se guarda antes de abrir LinkedIn.
    clearTimeout(saveTimers.get(c.url + "nota"));
    await updateContact(c.url, { nota: note.value });
    if (c.estado === "invitado" || c.estado === "conectado") return chrome.tabs.create({ url: c.url });
    return prepare(c.url, button);
  });
  item.querySelector(".state").textContent = ESTADOS[c.estado] || "";
  return item;
}

function render(set) {
  $("empty").hidden = !!set;
  $("progress").hidden = true;
  $("error").hidden = true;
  $("results").hidden = true;
  if (!set) return;
  const empresa = set.empresa || (set.postulacion && set.postulacion.empresa) || "";
  const puesto = set.puesto || (set.postulacion && set.postulacion.puesto) || set.page.title;
  $("title").textContent = empresa ? `Quiénes deciden en ${empresa}` : "Contactos de la vacante";
  $("subtitle").textContent = puesto || "";
  document.title = `${empresa || "Contactos"} · Maru`;
  if (set.estado === "buscando" || set.estado === "nuevo") {
    $("step").textContent = set.paso || "Empezando…";
    $("progress").hidden = false;
    return;
  }
  if (set.estado === "error") {
    showError(set.error || "Algo salió mal.", set.actions || []);
    const retry = document.createElement("button");
    retry.className = "ghost";
    retry.textContent = "Probar de nuevo";
    retry.addEventListener("click", search);
    $("error-actions").append(retry);
    return;
  }
  const list = $("list");
  list.replaceChildren(...(set.contactos || []).map(renderContact));
  const q = set.quota;
  $("quota").textContent = q ? (q.remaining === 1 ? "Te queda 1 búsqueda de contactos hoy." : `Te quedan ${q.remaining} búsquedas de contactos hoy.`) : "";
  $("quota").hidden = !q;
  $("results").hidden = false;
}

$("again").addEventListener("click", search);

// Cambios desde otra parte (por ejemplo, la persona envió una invitación en LinkedIn). No se redibuja mientras escribe.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.contactSets || searching) return;
  if (document.activeElement && document.activeElement.tagName === "TEXTAREA") return;
  getSet().then(render);
});

(async () => {
  const set = await getSet();
  if (set && set.estado === "nuevo") return search();
  if (set && set.estado === "buscando" && Date.now() - (set.started || 0) > STALE_MS) {
    await update({ estado: "error", error: "La búsqueda se cortó antes de terminar." });
    return render(await getSet());
  }
  render(set);
})();
