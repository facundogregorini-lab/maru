// Imita el perfil de LinkedIn: botón «Conectar» (directo o dentro de «Más»), ventana de la invitación,
// «Añadir una nota», el campo de la nota y «Enviar». window.__mode elige el caso. Registra en #state lo que pasa.
(() => {
  const state = { sent: false, sentWithoutNote: false, wrongPerson: false, note: "" };
  const save = () => (document.getElementById("state").textContent = JSON.stringify(state));
  save();
  const mode = window.__mode || "direct";
  const actions = document.querySelector(".actions");
  const button = (label, text, onClick, role) => {
    const el = document.createElement(role ? "div" : "button");
    if (role) el.setAttribute("role", role);
    el.setAttribute("aria-label", label);
    el.textContent = text;
    el.addEventListener("click", onClick);
    return el;
  };
  document.getElementById("other").addEventListener("click", () => {
    state.wrongPerson = true;
    save();
  });

  function openDialog() {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.innerHTML = "<h2>¿Querés añadir una nota a tu invitación?</h2>";
    dialog.append(
      button("Añadir una nota", "Añadir una nota", () => {
        dialog.innerHTML = "";
        if (mode === "limit") {
          dialog.innerHTML = "<h2>Probá Premium para enviar invitaciones con nota ilimitadas</h2>";
          dialog.append(button("Enviar sin nota", "Enviar sin nota", () => ((state.sentWithoutNote = true), save())));
          return;
        }
        const area = document.createElement("textarea");
        area.setAttribute("maxlength", "200");
        area.addEventListener("input", () => ((state.note = area.value), save()));
        dialog.append(area, button("Enviar invitación", "Enviar", () => ((state.sent = true), save())));
      }),
      button("Enviar sin nota", "Enviar sin nota", () => ((state.sentWithoutNote = true), save())),
    );
    document.body.append(dialog);
  }

  if (mode === "direct" || mode === "limit") actions.append(button("Invitar a Laura Gómez a conectar", "Conectar", openDialog));
  if (mode === "pending") actions.append(button("Pendiente, haz clic para retirar la invitación enviada a Laura Gómez", "Pendiente", () => {}));
  if (mode === "connected") actions.append(button("Enviar mensaje a Laura Gómez", "Mensaje", () => {}));
  if (mode === "more") {
    actions.append(
      button("Más acciones", "Más", () => {
        const menu = document.createElement("div");
        menu.setAttribute("role", "menu");
        menu.append(button("Invitar a Laura Gómez a conectar", "Conectar", openDialog, "button"));
        actions.append(menu);
      }),
    );
  }
})();
