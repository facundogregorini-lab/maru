// Se inyecta en cada frame de la pestaña cuando la persona aprieta "Completar".
// Lee los campos del formulario (scan) y los completa con las respuestas de Maru (apply).
// No envía nada: el botón de enviar lo aprieta la persona.
(() => {
  const VERSION = "0.3.1";
  if (window.__maru?.version === VERSION) return;

  const ATTR = "data-maru-id";
  const MAX_FIELDS = 250;
  const MAX_OPTIONS = 400;
  const MAX_COMBOS = 60;
  const GREEN = "#6f8466";
  const AMBER = "#d9a441";

  const clean = (s) => (s || "").replace(/[\s​-‍⁠﻿]+/g, " ").trim();
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const norm = (s) =>
    clean(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, ms = 600) {
    for (let t = 0; t < ms; t += 30) {
      const v = fn();
      if (v) return v;
      await sleep(30);
    }
    return fn();
  }

  /* ---------- Listas nativas de la página y React Select (incluido HiringRoom) ---------- */

  const COMBO = "[role='combobox'], [aria-haspopup='listbox']";
  const REACT_VALUE = "[class*='__value-container']";
  const isLegacyCombo = (el) => el.matches("input[aria-autocomplete='list']") && !!comboBox(el)?.querySelector(REACT_VALUE);
  const isCombo = (el) => el.tagName !== "SELECT" && (el.matches(COMBO) || isLegacyCombo(el));
  const comboInput = (el) => el.tagName === "INPUT" ? el : el.querySelector("input:not([type='hidden'])") || el;
  const placeholder = (text) => /^(?:[-–—]+$|(?:please\s+)?(?:select|choose|pick)\b|seleccion[aáeé]?\w*\b|elegi\w*\b|escog\w*\b)/i.test(norm(text));

  /** Interacción completa: algunos menús escuchan pointerup/mousedown, no click. */
  function activate(el) {
    el.focus({ preventScroll: true });
    const Pointer = window.PointerEvent || window.MouseEvent;
    el.dispatchEvent(new Pointer("pointerdown", { bubbles: true, cancelable: true, pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1 }));
    el.dispatchEvent(new Pointer("pointerup", { bubbles: true, cancelable: true, pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0, buttons: 0 }));
    el.click();
  }

  /** Un botón usado como desplegable puede omitir type=button. Nunca enviar al abrirlo. */
  async function withoutSubmit(task) {
    const stop = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    window.addEventListener("submit", stop, true);
    try { return await task(); }
    finally { window.removeEventListener("submit", stop, true); }
  }
  /** Una tecla completa (keydown + keyup), como una persona: Greenhouse, por ejemplo, abre la lista en el keyup. */
  function press(el, k) {
    for (const type of ["keydown", "keyup"]) el.dispatchEvent(new KeyboardEvent(type, { key: k, code: k, bubbles: true, cancelable: true }));
  }

  /** Vacía si no tiene texto y muestra un placeholder ("Seleccioná…") en lugar de un valor elegido. */
  function comboEmpty(el) {
    const input = comboInput(el);
    if (clean(input.value) || clean(el.getAttribute("aria-valuetext")) || clean(el.getAttribute("data-value"))) return false;
    if (comboBox(el).querySelector("[class*='single-value'], [class*='singleValue'], [class*='multi-value'], [class*='multiValue']")) return false;
    if (el.hasAttribute("data-placeholder") || el.querySelector("[data-placeholder]")) return true;
    const described = (input.getAttribute("aria-describedby") || "").split(/\s+/).map((id) => id && document.getElementById(id));
    if (described.some((n) => n && /placeholder/i.test(`${n.id} ${n.className}`))) return true;
    if (input.tagName === "INPUT") return true;
    const text = clean(el.textContent);
    return !text || placeholder(text);
  }

  /** El recuadro de la lista: el ancestro más cercano que muestra el valor elegido o el placeholder. */
  function comboBox(el) {
    if (el.tagName !== "INPUT") return el;
    let node = el.parentElement;
    for (let i = 0; node && i < 4; i++, node = node.parentElement) {
      if (/control/i.test(node.className)) return node;
    }
    return el.parentElement;
  }

  function comboOptions(el) {
    const ids = [el, comboInput(el)].flatMap((node) => `${node.getAttribute("aria-controls") || ""} ${node.getAttribute("aria-owns") || ""}`.split(/\s+/)).filter(Boolean);
    let list = ids.map((id) => document.getElementById(id)).find((node) => node && isShown(node));
    // React Select antiguo (HiringRoom) no publica roles ni aria-controls. Limitamos
    // la búsqueda a SU contenedor, sin mezclar opciones de otros campos.
    if (!list && isLegacyCombo(el)) {
      const menu = comboBox(el)?.parentElement?.querySelector("[class*='__menu-list']");
      if (menu && isShown(menu)) list = menu;
    }
    // Sin aria-controls (versiones viejas de react-select): el listbox más cercano, sin pasar a otra lista.
    for (let node = el.parentElement, i = 0; !list && node && i < 6; node = node.parentElement, i++) {
      if ([...node.querySelectorAll("[role='combobox']")].some((c) => c !== el)) break;
      list = [...node.querySelectorAll("[role='listbox']")].find(isShown);
    }
    // Menú en un portal (al final del <body>): si hay una sola lista abierta en la página, es esta.
    if (!list) {
      const open = [...document.querySelectorAll("[role='listbox']")].filter(isShown);
      if (open.length === 1) list = open[0];
    }
    return list ? [...list.querySelectorAll("[role='option'], [class*='__option']")].filter((o) => isShown(o) && !o.hasAttribute("disabled") && o.getAttribute("aria-disabled") !== "true" && !o.className.includes("__option--is-disabled")) : [];
  }

  /** Abre la lista con ↓ (como haría alguien con el teclado) y devuelve sus opciones. */
  async function openCombo(el) {
    const input = comboInput(el);
    input.focus({ preventScroll: true });
    press(input, "ArrowDown");
    const read = () => {
      const found = comboOptions(el);
      return found.length ? found : null;
    };
    const options = await waitFor(read, 120);
    if (options) return options;
    // Si ya abrió, puede estar cargando opciones: no lo volvemos a cerrar con otro clic.
    if (el.getAttribute("aria-expanded") !== "true" && input.getAttribute("aria-expanded") !== "true") activate(el.tagName === "INPUT" && comboBox(el)?.querySelector(REACT_VALUE) ? comboBox(el) : el);
    return await waitFor(read, 1200) || [];
  }

  /** Cierra la lista y espera a que desaparezca, para no leer sus opciones como si fueran de la siguiente. */
  async function closeCombo(el) {
    const input = comboInput(el);
    press(input, "Escape");
    input.blur();
    if (input !== el) { press(el, "Escape"); el.blur(); }
    await waitFor(() => el.getAttribute("aria-expanded") !== "true" && !comboOptions(el).length);
  }

  async function fillCombo(el, valor) {
    if (!comboEmpty(el)) return false;
    const options = await openCombo(el);
    if (!comboEmpty(el)) { await closeCombo(el); return false; }
    const texts = options.map((o) => clean(o.textContent));
    const i = findOption(texts, valor);
    if (i < 0) {
      await closeCombo(el);
      return false;
    }
    activate(options[i]);
    const accepted = await waitFor(() => !comboEmpty(el), 600);
    await closeCombo(el);
    // Algunas listas muestran otra cosa que la opción ("+54" para "Argentina +54"): alcanza con que ya no esté vacía.
    return !!accepted;
  }

  /* ---------- Lectura ---------- */

  const NOT_TEXT = "select, option, textarea, script, style, button, [role='listbox'], [aria-hidden='true']";

  /**
   * Texto visible de un nodo, sin el de los controles que tenga adentro (un <label> que envuelve un <select>
   * traería todas las opciones) ni mensajes ocultos ("No se pudo leer el archivo…").
   */
  function textWithout(node, skip = () => false) {
    if (!node) return "";
    const out = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const p = t.parentElement;
      if (!p || p.closest(NOT_TEXT) || skip(p)) continue;
      if (p.checkVisibility && !p.checkVisibility({ visibilityProperty: true })) continue;
      out.push(t.nodeValue);
    }
    return clean(out.join(" "));
  }

  function byIds(ids) {
    return clean(
      (ids || "")
        .split(/\s+/)
        .map((id) => textWithout(id && document.getElementById(id)))
        .join(" "),
    );
  }

  /** La etiqueta que lee una persona: <label>, aria-labelledby, aria-label o el texto alrededor. */
  function labelOf(el) {
    const parts = [];
    if (el.labels) for (const l of el.labels) parts.push(textWithout(l));
    parts.push(byIds(el.getAttribute("aria-labelledby")), clean(el.getAttribute("aria-label")));
    const label = [...new Set(parts.filter(Boolean))].join(" — ");
    return label || nearbyText(el, (c) => c === el);
  }

  /** Sube hasta 4 niveles buscando un contenedor con texto que sólo tenga este campo (o este grupo). */
  function nearbyText(el, isOwn) {
    let node = el.parentElement;
    for (let i = 0; node && i < 4; i++, node = node.parentElement) {
      const controls = [...node.querySelectorAll("input, select, textarea")].filter((c) => c.type !== "hidden");
      if (controls.some((c) => !isOwn(c))) return "";
      const text = textWithout(node);
      if (text) return text;
    }
    return "";
  }

  function isHoneypot(el) {
    const r = el.getBoundingClientRect();
    const offPage = r.right + window.scrollX < 0 || r.bottom + window.scrollY < 0;
    return offPage || el.closest("[aria-hidden='true']") !== null;
  }

  function isShown(el) {
    if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }

  /** Radios y casillas suelen estar ocultos con CSS y se muestran con su <label>. */
  function choiceShown(el) {
    if (isShown(el)) return true;
    return [...(el.labels || [])].some(isShown);
  }

  const KIND = {
    text: "texto",
    email: "email",
    tel: "telefono",
    url: "url",
    number: "numero",
    date: "fecha",
    month: "mes",
  };

  let seq = 0;
  /** Número de lectura del formulario: una respuesta vieja no se aplica sobre una lectura nueva. */
  let pass = 0;
  /** id → elemento (o elementos, para grupos de radios y casillas). */
  const registry = new Map();
  /** Ids de los campos obligatorios, para marcar los que queden vacíos. */
  const required = new Set();

  function register(els) {
    const id = `f${++seq}`;
    for (const el of els) el.setAttribute(ATTR, id);
    registry.set(id, els);
    return id;
  }

  /** Un campo vacío: los que ya tienen algo no se tocan. */
  const isEmpty = (el) => !clean(el.value);

  function describe(el, base) {
    const ayuda = byIds(el.getAttribute("aria-describedby"));
    const field = { ...base, etiqueta: cut(base.etiqueta || clean(el.name) || "(sin etiqueta)", 300) };
    if (ayuda && ayuda !== field.etiqueta) field.ayuda = cut(ayuda, 300);
    if (el.placeholder) field.placeholder = cut(clean(el.placeholder), 150);
    if (el.required || el.getAttribute("aria-required") === "true") field.obligatorio = true;
    if (el.maxLength > 0 && el.maxLength < 100000) field.max_caracteres = el.maxLength;
    return field;
  }

  async function scan() {
    const { scrollX, scrollY } = window;
    try {
      return await withoutSubmit(scanFields);
    } finally {
      window.scrollTo(scrollX, scrollY);
    }
  }

  async function scanFields() {
    pass++;
    seq = 0;
    registry.clear();
    required.clear();
    document.querySelectorAll(`[${ATTR}]`).forEach((n) => n.removeAttribute(ATTR));

    const fields = [];
    const groups = new Map();
    const controls = document.querySelectorAll(`input, select, textarea, ${COMBO}`);

    for (const el of controls) {
      if (fields.length >= MAX_FIELDS) break;
      if (el.disabled || el.getAttribute("aria-disabled") === "true" || (el.readOnly && !isCombo(el))) continue;
      // Un combobox con buscador interno es un único campo, no dos controles distintos.
      if (el.parentElement?.closest(COMBO)) continue;
      const tag = el.tagName;
      const type = (el.type || "").toLowerCase();

      if (type === "radio" || type === "checkbox") {
        if (!choiceShown(el)) continue;
        // Radios del mismo grupo, y casillas con el mismo name, van juntos.
        const key = el.name ? `${type}:${el.form ? [...document.forms].indexOf(el.form) : -1}:${el.name}` : null;
        if (key && groups.has(key)) {
          groups.get(key).push(el);
          continue;
        }
        const list = [el];
        if (key) groups.set(key, list);
        fields.push({ list, type });
        continue;
      }
      if (type === "file") {
        // Casi siempre está oculto detrás de un botón "Adjuntar".
        if (el.files && el.files.length) continue;
        // El botón dice "Adjuntar"; qué archivo pide lo dice el grupo ("CV", "Carta de presentación").
        const group = el.closest("[role='group'], fieldset");
        const groupLabel = group ? byIds(group.getAttribute("aria-labelledby")) || textWithout(group.querySelector("legend")) : "";
        const etiqueta = [...new Set([groupLabel, labelOf(el)].filter(Boolean))].join(" — ");
        const base = { tipo: "archivo", etiqueta };
        if (group && group.getAttribute("aria-required") === "true") base.obligatorio = true;
        fields.push({ el, base });
        continue;
      }
      // Los dummyInput de React Select miden un píxel: importa el recuadro visible.
      const visibleControl = isCombo(el) ? comboBox(el) : el;
      if (!isShown(visibleControl) || isHoneypot(visibleControl)) continue;

      if (isCombo(el)) {
        if (comboEmpty(el)) fields.push({ el, combo: true, base: { tipo: "seleccion", etiqueta: labelOf(el) } });
      } else if (tag === "SELECT") {
        const options = [...el.options].filter((o) => !o.disabled && !o.closest("optgroup[disabled]") && clean(o.text));
        if (el.multiple || !selectEmpty(el)) continue;
        const texts = options.map((o) => cut(clean(o.text), 150)).slice(0, MAX_OPTIONS);
        fields.push({ el, base: { tipo: "seleccion", etiqueta: labelOf(el), opciones: texts } });
      } else if (tag === "TEXTAREA") {
        if (isEmpty(el)) fields.push({ el, base: { tipo: "texto_largo", etiqueta: labelOf(el) } });
      } else if (type in KIND || type === "") {
        // Autocompletar sin role=combobox (por ejemplo, buscadores de ciudades): todavía no.
        if (el.getAttribute("aria-autocomplete") === "list") continue;
        if (isEmpty(el)) fields.push({ el, base: { tipo: KIND[type] || "texto", etiqueta: labelOf(el) } });
      }
    }

    const out = [];
    let combos = 0;
    for (const f of fields) {
      if (f.list) {
        const { list, type } = f;
        if (list.some((c) => c.checked)) continue;
        const isGroup = list.length > 1;
        const own = (c) => list.includes(c);
        const fieldset = list[0].closest("fieldset");
        const legend = fieldset && fieldset.querySelector("legend");
        const container = list[0].closest("[role='radiogroup'], [role='group']");
        const question = isGroup
          ? textWithout(legend) ||
            byIds(container && container.getAttribute("aria-labelledby")) ||
            clean(container && container.getAttribute("aria-label")) ||
            groupText(list, own)
          : // Casilla suelta dentro de una pregunta ("¿Qué tecnologías usás?" → "Python"): sumar la pregunta.
            [textWithout(legend), labelOf(list[0])].filter(Boolean).join(" — ");
        const base = { etiqueta: question };
        if (type === "radio" || isGroup) {
          base.tipo = type === "radio" ? "opcion_unica" : "multiple";
          base.opciones = list.map((c) => cut(labelOf(c) || clean(c.value), 150));
        } else {
          base.tipo = "casilla";
        }
        out.push(describe(list[0], { id: register(list), ...base }));
      } else if (f.combo) {
        // Las opciones aparecen recién al abrir la lista. Las que se cargan al tipear (ciudades) quedan para después.
        if (++combos > MAX_COMBOS) continue;
        const options = await openCombo(f.el);
        await closeCombo(f.el);
        if (!options.length) continue;
        const opciones = options.map((o) => cut(clean(o.textContent), 150)).slice(0, MAX_OPTIONS);
        out.push(describe(f.el, { id: register([f.el]), ...f.base, opciones }));
      } else {
        out.push(describe(f.el, { id: register([f.el]), ...f.base }));
      }
      const last = out[out.length - 1];
      if (last.obligatorio) required.add(last.id);
    }

    const top = window === window.top;
    return {
      pass,
      origin: location.origin,
      fields: out,
      title: top ? clean(document.title) : "",
      text: top ? cut(clean(document.body ? document.body.innerText : ""), 15000) : "",
    };
  }

  /** La pregunta de un grupo de opciones sin <fieldset>: el texto del contenedor común, sin las opciones. */
  function groupText(list, own) {
    let node = list[0].parentElement;
    while (node && !list.every((c) => node.contains(c))) node = node.parentElement;
    for (let i = 0; node && i < 3; i++, node = node.parentElement) {
      const controls = [...node.querySelectorAll("input, select, textarea")].filter((c) => c.type !== "hidden");
      if (controls.some((c) => !own(c))) return "";
      const text = textWithout(node, (p) => p.closest("label") !== null);
      if (text) return text;
    }
    return "";
  }

  /* ---------- Escritura ---------- */

  /** Setter nativo + eventos: React, Vue y Angular registran el cambio como si lo hubiera tipeado una persona. */
  function setValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    el.focus({ preventScroll: true });
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.blur();
  }

  function findOption(texts, wanted) {
    const w = norm(wanted);
    if (!w) return -1;
    const exact = texts.map((t, i) => norm(t) === w ? i : -1).filter((i) => i >= 0);
    if (exact.length) return exact.length === 1 ? exact[0] : -1;
    const starts = texts.map((t, i) => w.length >= 3 && norm(t).startsWith(w) ? i : -1).filter((i) => i >= 0);
    return starts.length === 1 ? starts[0] : -1;
  }

  function attachFile(el, cv) {
    const bytes = Uint8Array.from(atob(cv.base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], cv.name, { type: cv.mime }));
    el.files = transfer.files;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function fillOne(els, valor, cv) {
    const el = els[0];
    const type = (el.type || "").toLowerCase();
    if (isCombo(el)) return fillCombo(el, valor);
    if (type === "file") {
      if (!cv) return false;
      attachFile(el, cv);
      return el.files.length > 0;
    }
    if (type === "radio" || type === "checkbox") {
      if (els.length === 1 && type === "checkbox") {
        if (!el.checked) el.click();
        return el.checked;
      }
      const texts = els.map((c) => labelOf(c) || clean(c.value));
      let ok = false;
      for (const v of valor.split("\n")) {
        const i = findOption(texts, v);
        if (i < 0) continue;
        if (!els[i].checked) els[i].click();
        ok = ok || els[i].checked;
      }
      return ok;
    }
    if (el instanceof HTMLSelectElement) {
      if (el.multiple || !selectEmpty(el)) return false;
      const options = [...el.options].filter((o) => !o.disabled && !o.closest("optgroup[disabled]"));
      const i = findOption(
        options.map((o) => clean(o.text)),
        valor,
      );
      if (i < 0) return false;
      setValue(el, options[i].value);
      return el.value === options[i].value;
    }
    const max = el.maxLength > 0 ? el.maxLength : Infinity;
    // Un campo type="url" no acepta "linkedin.com/in/…" sin el https:// al enviar.
    if (type === "url" && !/^[a-z][a-z0-9+.-]*:/i.test(valor)) valor = `https://${valor}`;
    setValue(el, valor.slice(0, max));
    return clean(el.value) !== "";
  }

  /** Un select está sin elegir si no hay opción o la elegida es un "Seleccioná…" (vacía, deshabilitada u oculta). */
  function selectEmpty(el) {
    const o = el.options[el.selectedIndex];
    return !o || !clean(o.value) || o.disabled || o.hidden || placeholder(o.text);
  }

  function stillEmpty(els) {
    const el = els[0];
    if (els.length > 1 || el.type === "radio" || el.type === "checkbox") return !els.some((c) => c.checked);
    if (el.type === "file") return !(el.files && el.files.length);
    if (el instanceof HTMLSelectElement) return selectEmpty(el);
    if (el.getAttribute("role") === "combobox" || isCombo(el)) return comboEmpty(el);
    return isEmpty(el);
  }

  /** Dónde se ve el resaltado: el campo, o el label/contenedor si el control está oculto. */
  function outlineTarget(els) {
    const el = els[0];
    if (els.length > 1) return el.closest("fieldset, [role='radiogroup'], [role='group']") || el.parentElement;
    if (isCombo(el)) return comboBox(el);
    if (isShown(el)) return el;
    return (el.labels && el.labels[0]) || el.parentElement;
  }

  function mark(els, color, note) {
    const target = outlineTarget(els);
    if (!target) return;
    target.style.setProperty("outline", `2px solid ${color}`, "important");
    target.style.setProperty("outline-offset", "2px", "important");
    if (note) target.title = `Maru: ${note}`;
  }

  async function apply(answers, cv, forPass) {
    // Si el formulario se volvió a leer después de este pedido, los números de campo ya no son los mismos.
    if (forPass !== undefined && forPass !== pass) return { completados: 0, revisar: 0, pendientes: 0 };
    const { scrollX, scrollY } = window;
    try {
      return await withoutSubmit(() => applyAnswers(answers, cv));
    } finally {
      window.scrollTo(scrollX, scrollY);
    }
  }

  async function applyAnswers(answers, cv) {
    const stats = { completados: 0, revisar: 0, pendientes: 0 };
    const done = new Set();
    for (const a of answers) {
      const els = registry.get(a.id);
      if (!els || !els[0].isConnected) continue;
      // La persona lo completó mientras Maru pensaba: no se pisa.
      if (!stillEmpty(els)) continue;
      let ok = false;
      try {
        ok = await fillOne(els, a.valor, a.valor === "cv" ? cv : null);
      } catch (err) {
        console.warn("Maru no pudo completar un campo", err);
      }
      if (!ok) continue;
      done.add(a.id);
      stats.completados++;
      if (a.revisar) stats.revisar++;
      mark(els, a.revisar ? AMBER : GREEN, a.revisar ? a.nota || "revisá este campo" : "");
    }
    // Obligatorios que quedaron vacíos: los marca para que la persona los complete.
    for (const id of required) {
      const els = registry.get(id);
      if (done.has(id) || !els[0].isConnected || !stillEmpty(els)) continue;
      stats.pendientes++;
      mark(els, AMBER, "completalo vos");
    }
    return stats;
  }

  /* ---------- Aviso en la página ---------- */

  let toastHost = null;
  let toastTimer = 0;

  function toast(message, { sticky = false, error = false } = {}) {
    if (window !== window.top) return;
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.style.cssText = "position:fixed;z-index:2147483647;right:20px;bottom:20px;";
      const root = toastHost.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>
          .box { font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0a0a0a;
            background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px 14px; max-width: 340px;
            box-shadow: 0 8px 30px rgba(43,36,32,.18); display: flex; gap: 10px; align-items: flex-start; }
          .box.error { border-color: #c0623a; }
          .dot { width: 22px; height: 22px; border-radius: 6px; background: #1c8c4c; color: #fff; flex: none;
            display: grid; place-items: center; font-weight: 700; font-size: 12px; }
          .msg { flex: 1; white-space: pre-line; }
          button { all: unset; cursor: pointer; color: #75685f; padding: 0 2px; font-size: 16px; line-height: 1; }
        </style>
        <div class="box"><div class="dot">M</div><div class="msg"></div><button aria-label="Cerrar">×</button></div>`;
      root.querySelector("button").addEventListener("click", () => toastHost.remove());
    }
    if (!toastHost.isConnected) document.documentElement.appendChild(toastHost);
    const root = toastHost.shadowRoot;
    root.querySelector(".msg").textContent = message;
    root.querySelector(".box").classList.toggle("error", error);
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => toastHost.remove(), 12000);
  }

  window.__maru = { version: VERSION, scan, apply, toast };
})();
