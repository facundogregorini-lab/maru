// Se inyecta en cada frame de la pestaña cuando la persona aprieta "Completar".
// Lee los campos del formulario (scan) y los completa con las respuestas de Maru (apply).
// No envía nada: el botón de enviar lo aprieta la persona.
(() => {
  if (window.__maru) return;

  const ATTR = "data-maru-id";
  const MAX_FIELDS = 250;
  const MAX_OPTIONS = 400;
  const GREEN = "#6f8466";
  const AMBER = "#d9a441";

  const clean = (s) => (s || "").replace(/[\s​-‍⁠﻿]+/g, " ").trim();
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const norm = (s) =>
    clean(s)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  /* ---------- Lectura ---------- */

  const NOT_TEXT = "select, option, textarea, script, style, button, [aria-hidden='true']";

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

  function scan() {
    seq = 0;
    registry.clear();
    required.clear();
    document.querySelectorAll(`[${ATTR}]`).forEach((n) => n.removeAttribute(ATTR));

    const fields = [];
    const groups = new Map();
    const controls = document.querySelectorAll("input, select, textarea");

    for (const el of controls) {
      if (fields.length >= MAX_FIELDS) break;
      if (el.disabled || el.readOnly) continue;
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
      if (!isShown(el) || isHoneypot(el)) continue;

      if (tag === "SELECT") {
        const options = [...el.options].filter((o) => !o.disabled && clean(o.text));
        // Ya elegido por la persona (la primera opción suele ser "Seleccioná…").
        if (el.multiple || el.selectedIndex > 0) continue;
        const texts = options.map((o) => cut(clean(o.text), 150)).slice(0, MAX_OPTIONS);
        fields.push({ el, base: { tipo: "seleccion", etiqueta: labelOf(el), opciones: texts } });
      } else if (tag === "TEXTAREA") {
        if (isEmpty(el)) fields.push({ el, base: { tipo: "texto_largo", etiqueta: labelOf(el) } });
      } else if (type in KIND || type === "") {
        // Los combos accesibles (role=combobox) se completan eligiendo de una lista: todavía no los manejamos.
        if (el.getAttribute("role") === "combobox" || el.getAttribute("aria-autocomplete") === "list") continue;
        if (isEmpty(el)) fields.push({ el, base: { tipo: KIND[type] || "texto", etiqueta: labelOf(el) } });
      }
    }

    const out = [];
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
          : labelOf(list[0]);
        const base = { etiqueta: question };
        if (type === "radio" || isGroup) {
          base.tipo = type === "radio" ? "opcion_unica" : "multiple";
          base.opciones = list.map((c) => cut(labelOf(c) || clean(c.value), 150));
        } else {
          base.tipo = "casilla";
        }
        out.push(describe(list[0], { id: register(list), ...base }));
      } else {
        out.push(describe(f.el, { id: register([f.el]), ...f.base }));
      }
      const last = out[out.length - 1];
      if (last.obligatorio) required.add(last.id);
    }

    const top = window === window.top;
    return {
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
    let i = texts.findIndex((t) => norm(t) === w);
    if (i < 0) i = texts.findIndex((t) => norm(t).startsWith(w));
    return i;
  }

  function attachFile(el, cv) {
    const bytes = Uint8Array.from(atob(cv.base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], cv.name, { type: cv.mime }));
    el.files = transfer.files;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillOne(els, valor, cv) {
    const el = els[0];
    const type = (el.type || "").toLowerCase();
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
      const options = [...el.options];
      const i = findOption(
        options.map((o) => clean(o.text)),
        valor,
      );
      if (i < 0) return false;
      setValue(el, options[i].value);
      return el.selectedIndex === i;
    }
    const max = el.maxLength > 0 ? el.maxLength : Infinity;
    setValue(el, valor.slice(0, max));
    return clean(el.value) !== "";
  }

  /** Dónde se ve el resaltado: el campo, o el label/contenedor si el control está oculto. */
  function outlineTarget(els) {
    const el = els[0];
    if (els.length > 1) return el.closest("fieldset, [role='radiogroup'], [role='group']") || el.parentElement;
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

  function apply(answers, cv) {
    const stats = { completados: 0, revisar: 0, pendientes: 0 };
    const done = new Set();
    for (const a of answers) {
      const els = registry.get(a.id);
      if (!els || !els[0].isConnected) continue;
      let ok = false;
      try {
        ok = fillOne(els, a.valor, a.valor === "cv" ? cv : null);
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
      if (done.has(id) || !els[0].isConnected) continue;
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
          .box { font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #2b2420;
            background: #fffdf9; border: 1px solid #eadfd3; border-radius: 14px; padding: 12px 14px; max-width: 340px;
            box-shadow: 0 8px 30px rgba(43,36,32,.18); display: flex; gap: 10px; align-items: flex-start; }
          .box.error { border-color: #c0623a; }
          .dot { width: 22px; height: 22px; border-radius: 50%; background: #c0623a; color: #fff; flex: none;
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

  window.__maru = { scan, apply, toast };
})();
