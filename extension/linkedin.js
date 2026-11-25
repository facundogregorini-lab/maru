// Se inyecta en pestañas de LinkedIn sólo cuando la persona busca contactos de una vacante desde Maru.
// readSearch: lee las tarjetas de una búsqueda de personas (url del perfil y el texto que se ve).
// prepareInvite: en un perfil, toca «Conectar», agrega la nota y resalta «Enviar». Nunca envía la invitación:
// el botón lo aprieta la persona.
(() => {
  const VERSION = "0.5.0";
  if (window.__maruLinkedIn?.version === VERSION) return;

  const GREEN = "#1c8c4c";
  const MAX_CARDS = 10;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clean = (s) => String(s || "").replace(/[\s​-‍⁠﻿]+/g, " ").trim();

  async function waitFor(fn, ms) {
    for (let t = 0; t <= ms; t += 250) {
      const v = fn();
      if (v) return v;
      await sleep(250);
    }
    return null;
  }

  /** Perfil sin query ni subpáginas: https://www.linkedin.com/in/<slug>/. "" si no es un perfil. Igual que src/lib/contactos.ts. */
  function profileUrl(raw) {
    let u;
    try {
      u = new URL(raw, location.href);
    } catch {
      return "";
    }
    if (u.protocol !== "https:" || !/(^|\.)linkedin\.com$/i.test(u.hostname)) return "";
    const m = u.pathname.match(/^\/in\/([^/]+)/);
    return m ? `https://www.linkedin.com/in/${m[1].toLowerCase()}/` : "";
  }

  /** LinkedIn pide ingresar: la búsqueda no sirve. */
  const loginWall = () => /^\/(login|authwall|checkpoint|uas\/login|signup)/.test(location.pathname);

  /** Texto visible de un elemento, en una línea, sin renglones repetidos (LinkedIn duplica textos para lectores de pantalla). */
  function textOf(el) {
    const raw = typeof el.innerText === "string" && el.innerText ? el.innerText : el.textContent || "";
    const lines = [];
    for (const line of raw.split("\n").map(clean)) if (line && line !== lines[lines.length - 1]) lines.push(line);
    return lines.join(" · ").slice(0, 600);
  }

  function isShown(el) {
    if (!el || el.closest("[hidden], [aria-hidden='true']")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  const CARD = 'li, [role="listitem"], [data-chameleon-result-urn], [data-view-name="search-entity-result-universal-template"]';

  /** Tarjeta de un resultado: el contenedor de la lista o, si no hay, el ancestro con texto suficiente. */
  function cardOf(a, root) {
    const card = a.closest(CARD);
    if (card && root.contains(card)) return card;
    let el = a;
    for (let i = 0; i < 6 && el.parentElement && el.parentElement !== root; i++) {
      el = el.parentElement;
      if (clean(el.textContent).length > 40) return el;
    }
    return el;
  }

  function cards() {
    const root = document.querySelector("main") || document.body;
    const byCard = new Map();
    for (const a of root.querySelectorAll('a[href*="/in/"]')) {
      const url = profileUrl(a.getAttribute("href"));
      if (!url) continue;
      const card = cardOf(a, root);
      // El primer perfil de cada tarjeta es el de la persona; los demás suelen ser conexiones en común.
      if (!byCard.has(card)) byCard.set(card, url);
    }
    const seen = new Set();
    const out = [];
    for (const [card, url] of byCard) {
      if (seen.has(url)) continue;
      const texto = textOf(card);
      if (texto.length < 8) continue;
      seen.add(url);
      out.push({ url, texto });
      if (out.length === MAX_CARDS) break;
    }
    return out;
  }

  const NO_RESULTS = /no (se encontraron|hay|encontramos) resultados|no results found|ningún resultado/i;

  /** Tarjetas de la búsqueda de personas abierta. Espera a que LinkedIn las dibuje. */
  async function readSearch(ms = 10000) {
    if (loginWall()) return { login: true, cards: [] };
    const found = await waitFor(() => {
      const list = cards();
      if (list.length) return list;
      return NO_RESULTS.test(clean((document.querySelector("main") || document.body).textContent)) ? [] : null;
    }, ms);
    // timeout: LinkedIn no terminó de dibujar (pasa en pestañas en segundo plano); [] con «sin resultados» no es timeout.
    return { login: loginWall(), cards: found || [], timeout: found === null };
  }

  /* ---------- Invitación con nota ---------- */

  const label = (el) => clean(el.getAttribute("aria-label") || (typeof el.innerText === "string" && el.innerText) || el.textContent);
  const CONNECT_TEXT = /^(conectar|connect)$/i;
  const CONNECT_LABEL = /(invitar|invite)\b.*\b(conectar|connect)/i;
  const PENDING = /^(pendiente|pending)\b/i;
  const MESSAGE = /^(enviar mensaje|mensaje|message)\b/i;
  const MORE = /^(más|more)( acciones| actions)?$/i;
  const ADD_NOTE = /(añadir|agregar) (una )?nota|add a note/i;
  const SEND_WITHOUT = /sin (una )?nota|without (a )?note/i;
  const SEND = /^(enviar|send)( invitación| invitation| ahora| now)?$/i;

  const clickable = (scope) => [...scope.querySelectorAll('button, a[role="button"], div[role="button"], [role="menuitem"], a[aria-label]')].filter(isShown);
  const find = (scope, test) => clickable(scope).find((el) => test(label(el)));
  const isConnect = (l) => CONNECT_TEXT.test(l) || CONNECT_LABEL.test(l);

  /** Opción de un menú desplegable abierto (el de «Más»), sin mirar el resto de la página: ahí hay botones de otras personas. */
  const inMenu = (test) => {
    for (const menu of document.querySelectorAll('[role="menu"], .artdeco-dropdown__content--is-open')) {
      const hit = find(menu, test);
      if (hit) return hit;
    }
    return null;
  };

  /** La tarjeta de arriba del perfil: la sección con el nombre (h1). */
  const topCard = () => [...document.querySelectorAll("main section")].find((s) => s.querySelector("h1")) || document.querySelector("main");

  const dialog = () => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].find(isShown) || null;

  function highlight(el) {
    el.style.outline = `3px solid ${GREEN}`;
    el.style.outlineOffset = "2px";
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "center" });
    el.focus();
  }

  /** Avisa a Maru cuando la persona aprieta «Enviar», para marcar el contacto como invitado. Maru no lo aprieta. */
  function onSend(btn) {
    btn.addEventListener(
      "click",
      () => {
        try {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) chrome.runtime.sendMessage({ type: "contact-invited", url: profileUrl(location.href) }).catch(() => {});
        } catch {
          // la extensión se actualizó o se quitó: no pasa nada
        }
      },
      { once: true },
    );
  }

  function setText(el, value) {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    el.focus();
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Recorta la nota al tope del campo (200 en cuentas gratis), en el último espacio. */
  function fit(note, max) {
    if (!max || note.length <= max) return note;
    const cut = note.slice(0, max);
    const space = cut.lastIndexOf(" ");
    return space > max * 0.6 ? cut.slice(0, space) : cut;
  }

  /**
   * En el perfil abierto: «Conectar» (o «Más» → «Conectar»), «Añadir una nota», la nota y «Enviar» resaltado.
   * Devuelve el estado para el aviso: nota_lista, limite_notas, pendiente, conectado, sin_boton, sin_dialogo o login.
   */
  async function prepareInvite(note, ms = 10000) {
    if (loginWall()) return { estado: "login" };
    const top = await waitFor(() => (document.querySelector("main h1") ? topCard() : null), ms);
    if (!top) return { estado: "sin_boton" };

    if (find(top, (l) => PENDING.test(l))) return { estado: "pendiente" };
    let connect = find(top, isConnect);
    if (!connect) {
      const more = find(top, (l) => MORE.test(l));
      if (more) {
        more.click();
        connect = await waitFor(() => find(top, isConnect) || inMenu(isConnect), 2000);
        if (!connect && (find(top, (l) => PENDING.test(l)) || inMenu((l) => PENDING.test(l)))) return { estado: "pendiente" };
      }
    }
    if (!connect) return { estado: find(top, (l) => MESSAGE.test(l)) ? "conectado" : "sin_boton" };

    connect.click();
    const box = await waitFor(dialog, 5000);
    if (!box) return { estado: "sin_dialogo" };

    let area = box.querySelector("textarea");
    if (!area) {
      const add = find(box, (l) => ADD_NOTE.test(l));
      if (add) {
        add.click();
        area = await waitFor(() => (dialog() || document).querySelector('[role="dialog"] textarea, [role="alertdialog"] textarea'), 3000);
      }
    }
    const current = dialog() || box;
    if (!area) {
      // Sin campo de nota: en cuentas gratis, LinkedIn ofrece Premium cuando se terminan las 5 notas del mes.
      const without = find(current, (l) => SEND_WITHOUT.test(l));
      if (without) {
        highlight(without);
        onSend(without);
      }
      return { estado: "limite_notas" };
    }

    const max = Number(area.getAttribute("maxlength")) || 0;
    const text = fit(String(note || ""), max);
    setText(area, text);
    const send = find(current, (l) => SEND.test(l) && !SEND_WITHOUT.test(l));
    if (send) {
      highlight(send);
      onSend(send);
    }
    return { estado: "nota_lista", recortada: text.length < String(note || "").length };
  }

  window.__maruLinkedIn = { version: VERSION, profileUrl, readSearch, prepareInvite };
})();
