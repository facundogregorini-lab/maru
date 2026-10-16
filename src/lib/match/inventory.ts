import { workplaceFromDescription } from "./connectors";
import { classifyEligibility } from "./eligibility";
import { EXTRACTION_VERSION, extract } from "./extract";
import { sourceById } from "./sources";
import { sha } from "./hash";
import { canonicalUrl, fold, shingleSimilarity } from "./text";
import type { BoardSyncResult, Eligibility, EligibilityResult, Inventory, NormalizedPosting, Opportunity, StoredPosting, SyncRun } from "./types";

/**
 * Núcleo del inventario compartido (puro, sin red ni disco):
 * - upsert idempotente de publicaciones con hash de contenido,
 * - política de cierre documentada,
 * - deduplicación en oportunidades canónicas.
 *
 * POLÍTICA DE CIERRE
 * 1. Si una fuente falla, no se toca ninguno de sus avisos.
 * 2. Una ausencia sólo cuenta si recibimos el listado COMPLETO de esa bolsa (todas las páginas).
 * 3. Un aviso se cierra tras CLOSE_AFTER_MISSES sincronizaciones completas seguidas sin aparecer.
 * 4. En feeds parciales (sólo traen los últimos N), la ausencia nunca cierra: se retira
 *    si pasan STALE_DAYS sin volver a verlo.
 * 5. Un vencimiento explícito informado por la fuente (expiresAt) cierra el aviso.
 * 6. Los avisos cerrados se conservan RETAIN_CLOSED_DAYS (para mostrar "cerrada" a quien la guardó) y después se purgan.
 */

export const CLOSE_AFTER_MISSES = 2;
export const STALE_DAYS = 30;
export const RETAIN_CLOSED_DAYS = 30;
/** Para avisos no elegibles guardamos sólo un extracto: no los mostramos por defecto y ocupan menos. */
const EXCERPT_NOT_ELIGIBLE = 400;

export function emptyInventory(kind: Inventory["kind"] = "real"): Inventory {
  return { version: 1, generatedAt: null, kind, opportunities: [], postings: [], runs: [], boards: {} };
}

export const postingKey = (p: Pick<NormalizedPosting, "boardId" | "externalId">) => `${p.boardId}:${p.externalId}`;

/** Hash de los campos que importan: si no cambió, no se reprocesa. */
export function contentHash(p: NormalizedPosting): string {
  return sha(
    JSON.stringify([
      EXTRACTION_VERSION,
      p.title,
      p.company,
      p.descriptionText,
      p.locations,
      p.countries,
      p.regionText,
      p.workplace.value,
      p.salary?.value ?? null,
      p.applyUrl,
      p.expiresAt,
      p.employmentHint ?? "",
      p.seniorityHint ?? "",
    ]),
  );
}

/** Si la fuente no informa modalidad, usamos la que el aviso declara explícitamente en su texto. */
export function withWorkplace(p: NormalizedPosting): NormalizedPosting {
  if (p.workplace.value !== "desconocido") return p;
  const found = workplaceFromDescription(p.descriptionText);
  return found ? { ...p, workplace: { value: found.value, from: "descripcion", evidence: found.evidence } } : p;
}

function analyze(p: NormalizedPosting): Pick<StoredPosting, "eligibility" | "extracted" | "employmentType"> {
  const eligibility = classifyEligibility(p);
  const extracted = extract({
    title: p.title,
    descriptionText: p.descriptionText,
    employmentHint: p.employmentHint,
    seniorityHint: p.seniorityHint,
    department: p.department,
  });
  return { eligibility, extracted, employmentType: extracted.employmentType };
}

function store(p: NormalizedPosting, a: ReturnType<typeof analyze>): NormalizedPosting {
  const descriptionText = a.eligibility.status === "no_elegible" ? p.descriptionText.slice(0, EXCERPT_NOT_ELIGIBLE) : p.descriptionText;
  return { ...p, descriptionText };
}

/** Publicación suelta (p. ej. agregada a mano por una persona) → registro analizado, sin guardarlo en ningún lado. */
export function analyzeStandalone(raw: NormalizedPosting, now: string): StoredPosting {
  const p = withWorkplace(raw);
  const a = analyze(p);
  return {
    ...p,
    ...a,
    key: postingKey(p),
    contentHash: contentHash(p),
    firstSeenAt: now,
    lastSeenAt: now,
    lastVerifiedAt: null,
    missedCompleteSyncs: 0,
    status: "abierta",
  };
}

export type UpsertStats = { created: number; updated: number; unchanged: number; closed: number };

/**
 * Aplica el resultado de UNA bolsa. `fetched = null` significa que la consulta falló:
 * en ese caso no se cierra ni se modifica nada (aislamiento de errores).
 */
export function applyBoard(inv: Inventory, boardId: string, sourceId: string, fetched: { postings: NormalizedPosting[]; complete: boolean } | null, now: string): UpsertStats {
  const stats: UpsertStats = { created: 0, updated: 0, unchanged: 0, closed: 0 };
  if (!fetched) return stats;
  const source = sourceById(sourceId);
  const isAts = source?.kind === "ats";
  const partial = source?.partialFeed ?? true;
  const byKey = new Map(inv.postings.map((p) => [p.key, p]));
  const seen = new Set<string>();

  for (const raw of fetched.postings) {
    if (!raw.title || !raw.sourceUrl) continue;
    const p = withWorkplace(raw);
    const key = postingKey(p);
    if (seen.has(key)) continue; // la misma publicación repetida en una respuesta
    seen.add(key);
    const hash = contentHash(p);
    const prev = byKey.get(key);
    if (!prev) {
      const a = analyze(p);
      const sp: StoredPosting = {
        ...store(p, a),
        ...a,
        key,
        contentHash: hash,
        firstSeenAt: now,
        lastSeenAt: now,
        lastVerifiedAt: isAts ? now : null,
        missedCompleteSyncs: 0,
        status: "abierta",
      };
      inv.postings.push(sp);
      byKey.set(key, sp);
      stats.created++;
      continue;
    }
    prev.lastSeenAt = now;
    if (isAts) prev.lastVerifiedAt = now;
    prev.missedCompleteSyncs = 0;
    if (prev.status === "cerrada") {
      prev.status = "abierta";
      delete prev.closedReason;
      delete prev.closedAt;
    }
    if (prev.contentHash === hash) {
      stats.unchanged++;
      continue;
    }
    const a = analyze(p);
    Object.assign(prev, store(p, a), a, { contentHash: hash });
    stats.updated++;
  }

  for (const p of inv.postings) {
    if (p.boardId !== boardId || p.status !== "abierta" || seen.has(p.key)) continue;
    if (p.expiresAt && p.expiresAt < now) {
      close(p, now, "Venció según la fuente");
      stats.closed++;
    } else if (fetched.complete && !partial) {
      p.missedCompleteSyncs++;
      if (p.missedCompleteSyncs >= CLOSE_AFTER_MISSES) {
        close(p, now, `No apareció en ${CLOSE_AFTER_MISSES} sincronizaciones completas seguidas`);
        stats.closed++;
      }
    } else if (partial && daysSince(p.lastSeenAt, now) > STALE_DAYS) {
      close(p, now, `Sin verse en ${STALE_DAYS} días en un feed parcial`);
      stats.closed++;
    }
  }
  return stats;
}

function close(p: StoredPosting, now: string, reason: string) {
  p.status = "cerrada";
  p.closedReason = reason;
  p.closedAt = now;
}

const daysSince = (a: string, now: string) => (new Date(now).getTime() - new Date(a).getTime()) / 86_400_000;

/**
 * Avisos importados de proveedores con cuota (no los consulta la sync diaria): se cierran por el
 * vencimiento informado o si pasan `staleDays` sin volver a verse. Así el catálogo no arrastra
 * avisos viejos cuando se termina el saldo de un proveedor.
 */
export function expireImported(inv: Inventory, now: string): number {
  let closed = 0;
  for (const p of inv.postings) {
    const source = sourceById(p.sourceId);
    if (!source?.imported || p.status !== "abierta") continue;
    if (p.expiresAt && Date.parse(p.expiresAt) < Date.parse(now)) close(p, now, "Venció según la fuente");
    else if (daysSince(p.lastSeenAt, now) > (source.staleDays ?? STALE_DAYS)) close(p, now, `Sin verse en ${source.staleDays ?? STALE_DAYS} días en una importación parcial`);
    else continue;
    closed++;
  }
  return closed;
}

/**
 * Los avisos importados no se vuelven a descargar en la sync diaria: cuando cambian las reglas de análisis
 * (EXTRACTION_VERSION, modalidad desde el texto) se re-analizan con el texto guardado.
 */
export function refreshImported(inv: Inventory): number {
  let n = 0;
  for (const p of inv.postings) {
    if (!sourceById(p.sourceId)?.imported || p.status !== "abierta") continue;
    const next = withWorkplace(p);
    const hash = contentHash(next);
    if (hash === p.contentHash) continue;
    Object.assign(p, { workplace: next.workplace }, analyze(next), { contentHash: hash });
    n++;
  }
  return n;
}

/** Purga avisos cerrados viejos y avisos de bolsas que ya no están en el directorio (salvo importados). */
export function purge(inv: Inventory, now: string, activeBoards?: Set<string>): number {
  const before = inv.postings.length;
  inv.postings = inv.postings.filter((p) => {
    if (activeBoards && !activeBoards.has(p.boardId) && !sourceById(p.sourceId)?.imported) return false;
    return !(p.status === "cerrada" && p.closedAt && daysSince(p.closedAt, now) > RETAIN_CLOSED_DAYS);
  });
  return before - inv.postings.length;
}

/* ---------- Deduplicación ---------- */

class UnionFind {
  parent = new Map<string, string>();
  boards = new Map<string, Set<string>>();
  constructor(items: StoredPosting[]) {
    for (const p of items) {
      this.parent.set(p.key, p.key);
      this.boards.set(p.key, new Set([p.boardId]));
    }
  }
  find(x: string): string {
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    this.parent.set(x, r);
    return r;
  }
  /** Une dos grupos sólo si no quedarían dos publicaciones de la misma bolsa (= requisiciones distintas). */
  union(a: string, b: string): boolean {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return true;
    const A = this.boards.get(ra)!;
    const B = this.boards.get(rb)!;
    for (const x of B) if (A.has(x)) return false;
    this.parent.set(rb, ra);
    for (const x of B) A.add(x);
    return true;
  }
}

const normCompany = (s: string) => fold(s).replace(/\b(inc|llc|ltd|sa|s\.a\.|srl|s\.r\.l\.|corp|corporation|gmbh|co|company|the|group|grupo|latam|argentina)\b/g, "").replace(/\s+/g, " ").trim();
const normTitle = (s: string) => fold(s).replace(/\([^)]*\)/g, " ").replace(/\b(remote|remoto|latam|argentina|hybrid|hibrido)\b/g, "").replace(/\s+/g, " ").trim();

export function groupPostings(postings: StoredPosting[]): StoredPosting[][] {
  const uf = new UnionFind(postings);
  // 1. Misma URL canónica (aviso del ATS replicado en un portal que enlaza al original).
  const byUrl = new Map<string, string>();
  for (const p of postings) {
    for (const u of new Set([canonicalUrl(p.sourceUrl), canonicalUrl(p.applyUrl)])) {
      const other = byUrl.get(u);
      if (other) uf.union(other, p.key);
      else byUrl.set(u, p.key);
    }
  }
  // 2. Misma empresa + cargo, en bolsas distintas, con descripción casi igual.
  const buckets = new Map<string, StoredPosting[]>();
  for (const p of postings) {
    const k = `${normCompany(p.company)}|${normTitle(p.title)}`;
    if (!normCompany(p.company)) continue;
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(p);
  }
  for (const group of buckets.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.boardId === b.boardId) continue; // misma bolsa, ids distintos ⇒ requisiciones distintas
        const sim = shingleSimilarity(a.descriptionText, b.descriptionText);
        const sameWhere = fold(a.locations.join(" ")) === fold(b.locations.join(" ")) || !a.locations.length || !b.locations.length;
        if (sim >= 0.6 || (sim >= 0.35 && sameWhere)) uf.union(a.key, b.key);
      }
    }
  }
  const groups = new Map<string, StoredPosting[]>();
  for (const p of postings) (groups.get(uf.find(p.key)) ?? groups.set(uf.find(p.key), []).get(uf.find(p.key))!).push(p);
  return [...groups.values()];
}

function combineEligibility(list: EligibilityResult[]): EligibilityResult {
  const has = (s: Eligibility) => list.some((e) => e.status === s);
  const timezone = list.find((e) => e.timezone)?.timezone;
  const pick = (s: Eligibility) => list.filter((e) => e.status === s).flatMap((e) => e.evidence);
  const tz = timezone ? { timezone } : {};
  if (has("elegible") && has("no_elegible")) return { status: "por_confirmar", evidence: ["Las fuentes no coinciden sobre dónde se puede trabajar.", ...pick("elegible"), ...pick("no_elegible")].slice(0, 4), ...tz };
  if (has("elegible")) return { status: "elegible", evidence: [...new Set(pick("elegible"))].slice(0, 3), ...tz };
  if (has("no_elegible")) return { status: "no_elegible", evidence: [...new Set(pick("no_elegible"))].slice(0, 3), ...tz };
  return { status: "por_confirmar", evidence: [...new Set(pick("por_confirmar"))].slice(0, 3), ...tz };
}

export function buildOpportunities(postings: StoredPosting[]): Opportunity[] {
  return groupPostings(postings).map((group) => {
    const sorted = [...group].sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt) || a.key.localeCompare(b.key));
    const primary = sorted.find((p) => sourceById(p.sourceId)?.kind === "ats" && p.status === "abierta") ?? sorted.find((p) => p.status === "abierta") ?? sorted[0];
    const open = group.filter((p) => p.status === "abierta");
    const salaryPost = group.find((p) => p.salary && (p.salary.value.min || p.salary.value.max)) ?? group.find((p) => p.salary);
    const verified = group.map((p) => p.lastVerifiedAt).filter(Boolean).sort().pop() ?? null;
    return {
      id: sha(`opp:${sorted[0].key}`, 14),
      title: primary.title,
      company: primary.company || group.find((p) => p.company)?.company || "",
      postingKeys: sorted.map((p) => p.key),
      locations: [...new Set(group.flatMap((p) => p.locations))].slice(0, 6),
      countries: [...new Set(group.flatMap((p) => p.countries))],
      workplace: group.map((p) => p.workplace).find((w) => w.value !== "desconocido") ?? primary.workplace,
      eligibility: combineEligibility(group.map((p) => p.eligibility)),
      extracted: primary.extracted,
      salary: salaryPost?.salary ?? null,
      primaryKey: primary.key,
      descriptionComplete: group.some((p) => p.descriptionComplete),
      publishedAt: group.map((p) => p.publishedAt).filter(Boolean).sort()[0] ?? null,
      firstSeenAt: sorted[0].firstSeenAt,
      lastSeenAt: group.map((p) => p.lastSeenAt).sort().pop()!,
      lastVerifiedAt: verified,
      status: open.length ? "abierta" : "cerrada",
      contentHash: sha(group.map((p) => p.contentHash).sort().join("|")),
    };
  });
}

/**
 * Lo que se guarda en data/match/inventory.json: las oportunidades se derivan de las publicaciones
 * (ids estables por hash), así que no se guardan y se reconstruyen al cargar. Ahorra ~30% del archivo,
 * que GitHub limita a 100 MB.
 */
export function forStorage(inv: Inventory): Inventory {
  return { ...inv, opportunities: [] };
}

/** Oportunidades del inventario: las guardadas (fixtures viejos) o reconstruidas desde las publicaciones. */
export function opportunitiesOf(inv: Pick<Inventory, "opportunities" | "postings">): Opportunity[] {
  return inv.opportunities?.length ? inv.opportunities : buildOpportunities(inv.postings);
}

export function recordRun(inv: Inventory, run: Omit<SyncRun, "id">, keep = 30) {
  inv.runs = [{ id: sha(run.startedAt, 10), ...run }, ...inv.runs].slice(0, keep);
}

export function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) out[key(it)] = (out[key(it)] ?? 0) + 1;
  return out;
}

export type { BoardSyncResult };
