/**
 * Clave estable de una vacante a partir de su URL, para que la extensión encuentre la postulación armada en Maru.
 * El aviso y el formulario pueden tener URLs distintas: en Greenhouse, Lever y Ashby se usa el id del puesto.
 * Misma lógica que extension/jobkey.js (un test controla que den lo mismo).
 */
export function jobKey(raw: string): string {
  let u: URL;
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
  } else {
    const embedded = u.searchParams.get("gh_jid");
    // Página de empleos propia que embebe Greenhouse (?gh_jid=123).
    if (embedded && /^\d+$/.test(embedded)) return `greenhouse:${embedded}`;
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
