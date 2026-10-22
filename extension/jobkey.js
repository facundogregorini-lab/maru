// Clave estable de una vacante a partir de su URL, para encontrar la postulación que la persona armó en Maru.
// El aviso y el formulario pueden tener URLs distintas: en Greenhouse, Lever y Ashby se usa el id del puesto.
// Es la misma función que src/lib/jobKey.ts (un test controla que den lo mismo).
(function (root) {
  function maruJobKey(raw) {
    let u;
    try {
      u = new URL(String(raw || "").trim());
    } catch {
      return "";
    }
    if (!/^https?:$/.test(u.protocol)) return "";
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    const gh = u.searchParams.get("gh_jid") || u.searchParams.get("token");
    if (/(^|\.)greenhouse\.io$/.test(host)) {
      const i = parts.indexOf("jobs");
      if (i >= 0 && /^\d+$/.test(parts[i + 1] || "")) return `greenhouse:${parts[i + 1]}`;
      if (gh && /^\d+$/.test(gh)) return `greenhouse:${gh}`;
    } else if (u.searchParams.get("gh_jid") && /^\d+$/.test(u.searchParams.get("gh_jid"))) {
      // Página de empleos propia que embebe Greenhouse (?gh_jid=123).
      return `greenhouse:${u.searchParams.get("gh_jid")}`;
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
      const id = parts.find((p) => uuid.test(p));
      if (id) return `lever:${id.toLowerCase()}`;
    }
    if (host === "jobs.ashbyhq.com") {
      const id = parts.find((p) => uuid.test(p));
      if (id) return `ashby:${id.toLowerCase()}`;
    }
    // Resto: host + path, sin query, sin barra final y sin el paso del formulario.
    while (parts.length > 1 && /^(apply|application|aplicar|postular(se)?|postulacion)$/i.test(parts[parts.length - 1])) parts.pop();
    return `${host}/${parts.join("/")}`.toLowerCase();
  }
  root.maruJobKey = maruJobKey;
})(typeof self !== "undefined" ? self : globalThis);
