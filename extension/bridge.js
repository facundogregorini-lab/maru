// Corre sólo en el sitio de Maru. Pasa a la extensión las postulaciones que la persona armó en Maru
// (guardadas en este navegador), para usar el CV personalizado y la motivación al completar ese formulario.
// No lee nada más del sitio y no manda nada a ningún servidor.
(() => {
  const KEY = "maru:postulaciones:v1";
  function push() {
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      list = [];
    }
    chrome.runtime.sendMessage({ type: "postulaciones", list: Array.isArray(list) ? list : [] }).catch(() => {});
  }
  push();
  window.addEventListener("maru:postulaciones", push);
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) push();
  });
})();
