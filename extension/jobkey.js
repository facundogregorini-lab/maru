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

  /* ---------- Sin coincidencia por link: la postulación de la misma empresa ---------- */

  // El aviso puede estar en LinkedIn u otra bolsa y el formulario en el ATS de la empresa: ahí las claves no
  // coinciden. Entonces se busca una postulación reciente cuya empresa aparezca en la página del formulario.
  const RECENT_MS = 30 * 24 * 3600 * 1000;
  const NOISE = new Set(["com", "ar", "io", "co", "net", "org", "ai", "app", "inc", "llc", "ltd", "sa", "srl", "sas", "s", "a", "corp", "group", "grupo", "the", "la", "el"]);
  const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const companyWords = (company) => norm(company).split(" ").filter((w) => w && !NOISE.has(w));
  const hasPhrase = (haystack, words) => (" " + haystack + " ").includes(" " + words.join(" ") + " ");

  /** Palabras del puesto (las de 4 letras o más) que aparecen en la página. */
  function titleHits(title, page) {
    const words = norm(title).split(" ").filter((w) => w.length >= 4);
    return words.filter((w) => hasPhrase(page, [w])).length;
  }

  /**
   * La postulación de los últimos 30 días cuya empresa aparece en las URLs (el host o el path del formulario),
   * en el título o en el texto de la página. En el texto sólo cuenta si también aparece alguna palabra del puesto.
   * Si dos postulaciones empatan, no se elige ninguna: mejor el CV general que el de otro puesto.
   */
  function maruMatchByCompany(list, page, now) {
    if (!Array.isArray(list)) return null;
    const at = typeof now === "number" ? now : Date.now();
    const urls = norm((page.urls || []).join(" ")).replace(/ /g, "");
    const title = norm(page.title);
    const text = norm(String(page.text || "").slice(0, 15000));
    const all = title + " " + text;
    const scored = [];
    for (const p of list) {
      if (!p || !(at - (p.updatedAt || 0) < RECENT_MS)) continue;
      const words = companyWords(p.company);
      const slug = words.join("");
      if (slug.length < 3) continue;
      const hits = titleHits(p.title, all);
      const strong = urls.includes(slug) || hasPhrase(title, words);
      if (!strong && !(hasPhrase(text, words) && hits > 0)) continue;
      scored.push({ p, score: hits });
    }
    if (!scored.length) return null;
    scored.sort((x, y) => y.score - x.score);
    if (scored.length > 1 && scored[0].score === scored[1].score) return null;
    return scored[0].p;
  }
  root.maruMatchByCompany = maruMatchByCompany;
})(typeof self !== "undefined" ? self : globalThis);
