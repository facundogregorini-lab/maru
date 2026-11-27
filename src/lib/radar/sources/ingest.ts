import { createHash } from "node:crypto";
import type { JobEvent, JobOpening, SourceJobsDoc, SourceStatus } from "../types";
import type { RadarPosting, Snapshot } from "./adapters";

/**
 * Ingestión idempotente de un snapshot sobre el índice de vacantes de UNA fuente.
 * - Unicidad por (fuente, id externo). Sin id estable, la URL.
 * - Nueva / modificada (cambia el hash) / sin cambios; first_seen y last_seen.
 * - Cierre sólo si la fuente lo informa o tras `closeAfter` snapshots completos y exitosos seguidos sin la vacante.
 *   Nunca por un snapshot parcial ni por una caída brusca sin confirmar (ver SUSPICIOUS_DROP).
 * - Una reapertura conserva first_seen y el historial.
 */

export const CLOSE_AFTER = 2;
/** Caída mayor al 80 % entre snapshots (con al menos 5 abiertas antes): se trata como sospechosa. */
export const SUSPICIOUS_DROP = 0.8;
const MAX_HISTORY = 20;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function jobId(sourceId: string, externalId: string): string {
  return `job_${sha(`${sourceId}|${externalId}`).slice(0, 20)}`;
}

/** URL canónica para comparar entre fuentes: sin hash, sin utm, sin barra final, en minúsculas. */
export function canonicalUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|gh_src$|ref$|source$|lever-origin$)/i.test(k)) u.searchParams.delete(k);
    return `${u.protocol}//${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function contentHash(p: RadarPosting): string {
  return sha([p.title, p.location, p.remoteType, p.department, p.description].join("\u0001")).slice(0, 24);
}

export type IngestCounts = { created: number; modified: number; closed: number; reopened: number; unchanged: number };
export type IngestResult = { doc: SourceJobsDoc; counts: IngestCounts; status: SourceStatus; note?: string; changedDescriptions: Record<string, string> };

const pushEvent = (j: JobOpening, e: JobEvent) => {
  j.history = [...j.history, e].slice(-MAX_HISTORY);
};

export function applySnapshot(prev: SourceJobsDoc | null, snap: Snapshot, ctx: { sourceId: string; companyId: string; now: Date; closeAfter?: number }): IngestResult {
  const now = ctx.now.toISOString();
  const closeAfter = ctx.closeAfter ?? CLOSE_AFTER;
  const jobs: Record<string, JobOpening> = structuredClone(prev?.jobs ?? {});
  const counts: IngestCounts = { created: 0, modified: 0, closed: 0, reopened: 0, unchanged: 0 };
  const changedDescriptions: Record<string, string> = {};

  const prevOpen = Object.values(jobs).filter((j) => j.status === "open").length;
  const drop = snap.complete && prevOpen >= 5 && snap.jobs.length < prevOpen * (1 - SUSPICIOUS_DROP);
  // Confirmación: dos lecturas completas seguidas con la misma cantidad después de la caída.
  const confirmed = drop && prev?.pendingDrop?.count === snap.jobs.length;
  const suspicious = drop && !confirmed;
  const complete = snap.complete && !suspicious;

  const seen = new Set<string>();
  for (const p of snap.jobs) {
    if (!p.externalId || !p.title) continue;
    const id = jobId(ctx.sourceId, p.externalId);
    if (seen.has(id)) continue;
    seen.add(id);
    const hash = contentHash(p);
    const cur = jobs[id];
    if (!cur) {
      jobs[id] = {
        id,
        companyId: ctx.companyId,
        sourceId: ctx.sourceId,
        externalJobId: p.externalId,
        url: p.url,
        canonicalUrl: canonicalUrl(p.url),
        title: p.title,
        location: p.location,
        remoteType: p.remoteType,
        department: p.department,
        contentHash: hash,
        publishedAt: p.publishedAt,
        firstSeenAt: now,
        lastSeenAt: now,
        status: "open",
        closedAt: null,
        closedReason: null,
        missedCompleteSnapshots: 0,
        history: [{ at: now, event: "opened" }],
      };
      changedDescriptions[id] = p.description;
      counts.created++;
      continue;
    }
    const next: JobOpening = { ...cur, lastSeenAt: now, missedCompleteSnapshots: 0 };
    if (cur.status === "closed") {
      next.status = "open";
      next.closedAt = null;
      next.closedReason = null;
      pushEvent(next, { at: now, event: "reopened" });
      counts.reopened++;
    }
    if (cur.contentHash !== hash) {
      Object.assign(next, { title: p.title, location: p.location, remoteType: p.remoteType, department: p.department, contentHash: hash, url: p.url, canonicalUrl: canonicalUrl(p.url) });
      if (p.publishedAt) next.publishedAt = p.publishedAt;
      pushEvent(next, { at: now, event: "modified" });
      changedDescriptions[id] = p.description;
      counts.modified++;
    } else if (cur.status !== "closed") counts.unchanged++;
    jobs[id] = next;
  }

  const explicit = new Set((snap.closedIds ?? []).map((x) => jobId(ctx.sourceId, x)));
  for (const j of Object.values(jobs)) {
    if (j.status !== "open" || seen.has(j.id)) continue;
    if (explicit.has(j.id)) {
      Object.assign(j, { status: "closed", closedAt: now, closedReason: "La fuente la informa cerrada" });
      pushEvent(j, { at: now, event: "closed", reason: "fuente" });
      counts.closed++;
      continue;
    }
    if (!complete) continue; // snapshot parcial o sospechoso: no se cuentan ausencias
    j.missedCompleteSnapshots++;
    if (j.missedCompleteSnapshots >= closeAfter) {
      Object.assign(j, { status: "closed", closedAt: now, closedReason: `Ausente en ${closeAfter} lecturas completas seguidas` });
      pushEvent(j, { at: now, event: "closed", reason: "ausencia" });
      counts.closed++;
    }
  }

  const open = Object.values(jobs).filter((j) => j.status === "open").length;
  const status: SourceStatus = suspicious || !snap.complete ? "partial" : snap.jobs.length ? "success" : "verified_empty";
  const note = suspicious ? `Caída brusca (${prevOpen} → ${snap.jobs.length}): no se cerró nada hasta confirmar` : snap.note;
  const pendingDrop = drop ? { count: snap.jobs.length, at: prev?.pendingDrop?.count === snap.jobs.length ? prev.pendingDrop.at : now } : null;
  return { doc: { sourceId: ctx.sourceId, jobs, updatedAt: ctx.now.getTime(), pendingDrop }, counts, status: open === 0 && status === "success" ? "verified_empty" : status, note, changedDescriptions };
}
