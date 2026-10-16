// Popup: cargar el CV una vez (Maru lo lee con /api/profile), datos extra y botón para completar.

const DEFAULT_SERVER = "https://maru-grego7.vercel.app";
const MAX_FILE_BYTES = 3 * 1024 * 1024; // igual que la web: Vercel acepta hasta 4,5 MB por request
const MIN_TEXT_CHARS = 80;

const $ = (id) => document.getElementById(id);
let pickedFile = null;

function status(message, error = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
}

async function server() {
  const { server } = await chrome.storage.local.get("server");
  return (server || DEFAULT_SERVER).replace(/\/+$/, "");
}

async function render() {
  const { profile, cv, extras, server } = await chrome.storage.local.get(["profile", "cv", "extras", "server"]);
  $("server").value = server || "";
  $("setup").hidden = !!profile;
  $("ready").hidden = !profile;
  if (!profile) return;
  $("name").textContent = profile.nombre || "Tu perfil";
  $("headline").textContent = profile.titulo || "";
  $("cv-file").textContent = cv ? `CV para adjuntar: ${cv.name}` : "Sin archivo para adjuntar (cargaste texto)";
  $("extras").value = extras || "";
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function canRead() {
  $("read").disabled = !pickedFile && $("cv-text").value.trim().length < MIN_TEXT_CHARS;
}

$("file").addEventListener("change", () => {
  const file = $("file").files[0];
  pickedFile = null;
  status("");
  if (file && file.size > MAX_FILE_BYTES) status("El archivo pesa más de 3 MB. Probá exportarlo de nuevo o pegá tu experiencia.", true);
  else if (file) pickedFile = file;
  $("file-name").textContent = pickedFile ? pickedFile.name : "Elegí tu CV o el PDF de tu LinkedIn (PDF o Word)";
  canRead();
});
$("cv-text").addEventListener("input", canRead);

$("read").addEventListener("click", async () => {
  $("read").disabled = true;
  status("Maru está leyendo tu CV. Tarda unos 20 segundos…");
  try {
    let cv = null;
    let source;
    if (pickedFile) {
      const base64 = await toBase64(pickedFile);
      const mime = pickedFile.type || (pickedFile.name.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf");
      cv = { name: pickedFile.name, mime, base64 };
      source = { kind: "cv", fileBase64: base64, mimeType: mime };
    } else {
      source = { kind: "texto", text: $("cv-text").value.trim() };
    }
    const res = await fetch(`${await server()}/api/profile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "No pudimos leer tu CV. Probá de nuevo.");
    await chrome.storage.local.set({ profile: data.profile, cv });
    status("¡Listo! Abrí un formulario de postulación y tocá “Completar esta postulación”.");
    await /** Completitud: los campos que Maru completó (los "para revisar" incluidos) sobre esos más los obligatorios vacíos. */
function dashboard({ completados = 0, revisar = 0, pendientes = 0 }) {
  const total = completados + pendientes;
  if (!total) return;
  const pct = Math.round((completados / total) * 100);
  $("pct").textContent = `${pct}%`;
  $("bar").style.width = `${pct}%`;
  $("n-ok").textContent = completados - revisar;
  $("n-warn").textContent = revisar;
  $("n-todo").textContent = pendientes;
  $("dashboard").hidden = false;
}

render();
  } catch (err) {
    const offline = err instanceof TypeError;
    status(offline ? `No pudimos conectar con Maru (${await server()}).` : err.message, true);
    canRead();
  }
});

$("change").addEventListener("click", async () => {
  await chrome.storage.local.remove(["profile", "cv"]);
  pickedFile = null;
  $("file").value = "";
  $("file-name").textContent = "Elegí tu CV o el PDF de tu LinkedIn (PDF o Word)";
  status("");
  await /** Completitud: los campos que Maru completó (los "para revisar" incluidos) sobre esos más los obligatorios vacíos. */
function dashboard({ completados = 0, revisar = 0, pendientes = 0 }) {
  const total = completados + pendientes;
  if (!total) return;
  const pct = Math.round((completados / total) * 100);
  $("pct").textContent = `${pct}%`;
  $("bar").style.width = `${pct}%`;
  $("n-ok").textContent = completados - revisar;
  $("n-warn").textContent = revisar;
  $("n-todo").textContent = pendientes;
  $("dashboard").hidden = false;
}

render();
  canRead();
});

let saveTimer = 0;
$("extras").addEventListener("input", () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await chrome.storage.local.set({ extras: $("extras").value });
    $("saved").textContent = "Guardado";
  }, 400);
});

$("server").addEventListener("change", async () => {
  const value = $("server").value.trim();
  if (value) await chrome.storage.local.set({ server: value });
  else await chrome.storage.local.remove("server");
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "progress") status(msg.step);
});

$("fill").addEventListener("click", async () => {
  $("fill").disabled = true;
  status("Empezando…");
  const result = await chrome.runtime.sendMessage({ type: "fill" });
  $("fill").disabled = false;
  if (!result) return status("Algo salió mal. Probá de nuevo.", true);
  status(result.error || result.summary, !!result.error);
  if (!result.error) dashboard(result);
});

/** Completitud: los campos que Maru completó (los "para revisar" incluidos) sobre esos más los obligatorios vacíos. */
function dashboard({ completados = 0, revisar = 0, pendientes = 0 }) {
  const total = completados + pendientes;
  if (!total) return;
  const pct = Math.round((completados / total) * 100);
  $("pct").textContent = `${pct}%`;
  $("bar").style.width = `${pct}%`;
  $("n-ok").textContent = completados - revisar;
  $("n-warn").textContent = revisar;
  $("n-todo").textContent = pendientes;
  $("dashboard").hidden = false;
}

render();
