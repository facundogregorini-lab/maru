// Coordina el autocompletado: lee los campos de todos los frames de la pestaña,
// le pide a Maru qué poner en cada uno y los completa. Nunca envía el formulario.

const DEFAULT_SERVER = "https://maru-grego7.vercel.app";

class UserError extends Error {}

async function settings() {
  const data = await chrome.storage.local.get(["profile", "cv", "extras", "server"]);
  return { ...data, server: (data.server || DEFAULT_SERVER).replace(/\/+$/, "") };
}

/** Corre `func` en los frames de la pestaña (en el mundo aislado de la extensión, donde vive window.__maru). */
async function run(tabId, func, args = [], frameIds) {
  const target = frameIds ? { tabId, frameIds } : { tabId, allFrames: true };
  const results = await chrome.scripting.executeScript({ target, func, args });
  return results.filter((r) => r && r.result !== undefined && r.result !== null);
}

const toast = (tabId, message, opts) =>
  run(tabId, (m, o) => window.__maru && window.__maru.toast(m, o), [message, opts || {}], [0]).catch(() => {});

function progress(step) {
  chrome.runtime.sendMessage({ type: "progress", step }).catch(() => {});
}

async function fillTab(tab) {
  if (!tab || !tab.id || !/^(https?|file):/.test(tab.url || "")) {
    throw new UserError("Abrí el formulario de postulación en esta pestaña y probá de nuevo.");
  }
  const { profile, cv, extras, server } = await settings();
  if (!profile) throw new UserError("Primero cargá tu CV: tocá el ícono de Maru en la barra de Chrome.");

  const tabId = tab.id;
  await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content.js"] });
  progress("Leyendo el formulario…");
  await toast(tabId, "Maru está leyendo el formulario…", { sticky: true });

  const scans = await run(tabId, () => window.__maru.scan());
  const fields = [];
  for (const { frameId, result } of scans) {
    for (const f of result.fields) fields.push({ ...f, id: `${frameId}:${f.id}` });
  }
  if (!fields.length) {
    throw new UserError("No encontramos campos vacíos para completar. Si el formulario aparece al tocar “Postularme”, abrilo y probá de nuevo.");
  }
  const top = (scans.find((s) => s.frameId === 0) || {}).result || { title: "", text: "" };

  progress(`Completando ${fields.length} campos…`);
  await toast(tabId, `Maru está completando ${fields.length} campos…`, { sticky: true });
  let res;
  try {
    res = await fetch(`${server}/api/autofill`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profile,
        extras: extras || "",
        hasCv: !!cv,
        page: { url: tab.url.slice(0, 2000), title: top.title.slice(0, 500), text: top.text },
        fields: fields.slice(0, 250),
      }),
    });
  } catch {
    throw new UserError(`No pudimos conectar con Maru (${server}). Revisá tu conexión y probá de nuevo.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new UserError(data.error || "Algo falló del lado de Maru. Probá de nuevo.");

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
    const withCv = answers.some((a) => a.valor === "cv") ? cv : null;
    const [r] = await run(tabId, (a, c) => window.__maru.apply(a, c), [answers, withCv], [frameId]);
    if (r) for (const k of Object.keys(total)) total[k] += r.result[k];
  }

  const summary = summarize(total);
  await toast(tabId, summary);
  return { ...total, summary };
}

function summarize({ completados, revisar, pendientes }) {
  if (!completados) return "No encontramos datos de tu CV para estos campos. Completalos vos o sumá datos extra en Maru.";
  const lines = [`Listo: completamos ${completados} ${completados === 1 ? "campo" : "campos"} (en verde).`];
  if (revisar) lines.push(`Revisá ${revisar === 1 ? "el marcado" : `los ${revisar} marcados`} en amarillo: Maru los redactó o dedujo.`);
  if (pendientes) lines.push(`${pendientes === 1 ? "Queda 1 obligatorio" : `Quedan ${pendientes} obligatorios`} para completar vos.`);
  lines.push("Revisá todo y enviá cuando quieras.");
  return lines.join("\n");
}

async function fillActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  chrome.action.setBadgeText({ text: "…" });
  try {
    return await fillTab(tab);
  } catch (err) {
    const message = err instanceof UserError ? err.message : "Algo salió mal. Recargá la página y probá de nuevo.";
    if (!(err instanceof UserError)) console.error(err);
    if (tab && tab.id) await toast(tab.id, message, { error: true });
    return { error: message };
  } finally {
    chrome.action.setBadgeText({ text: "" });
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "fill") {
    fillActiveTab().then(sendResponse);
    return true;
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "fill") fillActiveTab();
});

// Para los tests de punta a punta.
self.fillActiveTab = fillActiveTab;
