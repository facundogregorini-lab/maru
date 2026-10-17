// Fixture compartida por JSDOM y el QC manual en Chrome. Sin red ni datos reales.
(() => {
  const configs = [
    { id: "button-country", open: "click", choose: "pointerup" },
    { id: "readonly-country", open: "click", choose: "mousedown" },
    { id: "availability", open: "pointerdown", choose: "pointerup", options: ["Tiempo completo", "Medio tiempo"] },
    { id: "delayed-country", open: "click", choose: "click", delay: 750 },
    { id: "prefilled-country", open: "click", choose: "click" },
    { id: "composite", open: "click", choose: "click" },
    { id: "blocked-country", open: "click", choose: "click", blocked: true },
  ];
  let submitted = 0;
  function state() {
    const values = {};
    for (const { id } of configs) {
      const el = document.getElementById(id);
      if (el) values[id] = el.getAttribute("aria-valuetext") || "";
    }
    for (const id of ["native-country", "native-prefilled", "ambiguous-country"]) {
      const el = document.getElementById(id);
      if (el) values[id] = el.value;
    }
    for (const id of ["legacy-country", "legacy-language", "legacy-prefilled"]) {
      const el = document.getElementById(id);
      if (el) values[id] = el.closest(".custom-hr-select-container").querySelector(".custom-hr-select__single-value")?.textContent || "";
    }
    document.getElementById("state").textContent = JSON.stringify({ ...values, submitted }, null, 2);
  }
  // Estructura observada en los pasos 2 y 3 de HiringRoom: sin roles, inputs mínimos,
  // opciones por clase y estado en single-value, no en input.value.
  for (const id of ["legacy-country", "legacy-language"]) {
    const input = document.getElementById(id);
    if (!input) continue;
    const root = input.closest(".custom-hr-select-container");
    const menu = root.querySelector(".custom-hr-select__menu");
    const list = root.querySelector(".custom-hr-select__menu-list");
    const close = () => { menu.hidden = true; };
    function open() {
      menu.hidden = false;
      list.replaceChildren();
      const options = id === "legacy-country" ? ["Argentina", "Brasil", "Uruguay"] : ["Español", "Inglés"];
      for (const text of [...options, "No disponible"]) {
        const option = document.createElement("div");
        const disabled = text === "No disponible";
        option.className = "custom-hr-select__option" + (disabled ? " custom-hr-select__option--is-disabled" : "");
        option.textContent = text;
        option.addEventListener("click", () => {
          if (disabled) return;
          const chosen = root.querySelector(".custom-hr-select__placeholder, .custom-hr-select__single-value");
          chosen.className = "custom-hr-select__single-value";
          chosen.textContent = text;
          close();
          state();
        });
        list.appendChild(option);
      }
    }
    root.querySelector(".custom-hr-select__control").addEventListener("mousedown", open);
    input.addEventListener("keydown", (event) => { if (event.key === "ArrowDown") open(); else if (event.key === "Escape") close(); });
    input.addEventListener("blur", close);
  }
  for (const config of configs) {
    const trigger = document.getElementById(config.id);
    const list = document.getElementById(`${config.id}-list`);
    if (!trigger || !list) continue;
    let timer;
    function close() {
      clearTimeout(timer);
      trigger.setAttribute("aria-expanded", "false");
      list.hidden = true;
    }
    function render() {
      list.replaceChildren();
      for (const text of config.options || ["Argentina", "Brasil", "Uruguay"]) {
        const option = document.createElement("div");
        option.setAttribute("role", "option");
        option.textContent = text;
        option.addEventListener(config.choose, () => {
          if (config.blocked) return;
          trigger.setAttribute("aria-valuetext", text);
          trigger.removeAttribute("data-placeholder");
          if (trigger.tagName === "INPUT") trigger.value = text;
          else if (trigger.querySelector("span")) trigger.querySelector("span").textContent = text;
          else trigger.textContent = text;
          close();
          state();
        });
        list.appendChild(option);
      }
    }
    trigger.addEventListener(config.open, () => {
      if (trigger.getAttribute("aria-expanded") === "true") return;
      trigger.setAttribute("aria-expanded", "true");
      list.hidden = false;
      if (config.delay) timer = setTimeout(render, config.delay);
      else render();
    });
    trigger.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
  }
  for (const select of document.querySelectorAll("select")) select.addEventListener("change", state);
  document.getElementById("application").addEventListener("submit", (event) => {
    event.preventDefault();
    submitted++;
    state();
  });
  state();
})();
