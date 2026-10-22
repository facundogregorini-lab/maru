import { load, save } from "./storage";
import { capture } from "./tracking/posthog";

/**
 * Seguimiento de postulaciones (el "Job Tracker" de jobright): vive en este navegador, como el perfil, y con sesión
 * se copia a la cuenta (src/lib/sync/client.ts).
 * Las herramientas de Maru crean y actualizan las tarjetas solas; la persona mueve el estado y anota.
 */

export const TRACKER_KEY = "maru:tracker:v1";
export const TRACKER_EVENT = "maru:tracker";

export type TrackStatus = "guardada" | "postulada" | "entrevista" | "oferta" | "descartada";
export type ArtifactKind = "cv" | "respuestas" | "carta" | "entrevista" | "video" | "extension";

export type TrackItem = {
  /** Id del inventario si existe; si no, un hash del link o de puesto + empresa. */
  id: string;
  title: string;
  company: string;
  /** Link del aviso. */
  jobUrl: string;
  /** Texto del aviso: sirve para mandarlo a otra herramienta con handoffJob. */
  jobText?: string;
  status: TrackStatus;
  artifacts: { kind: ArtifactKind; at: number }[];
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export const STATUSES: readonly { id: TrackStatus; label: string; one: string }[] = [
  { id: "guardada", label: "Guardadas", one: "Guardada" },
  { id: "postulada", label: "Postuladas", one: "Postulada" },
  { id: "entrevista", label: "Entrevista", one: "Entrevista" },
  { id: "oferta", label: "Oferta", one: "Oferta" },
  { id: "descartada", label: "Descartadas", one: "Descartada" },
];

export const ARTIFACT_LABELS: Record<ArtifactKind, string> = {
  cv: "CV a medida",
  respuestas: "Respuestas",
  carta: "Carta",
  entrevista: "Práctica de entrevista",
  video: "Video",
  extension: "Autocompletada",
};

/** Orden del avance: una herramienta nunca hace retroceder una tarjeta (descartada queda como está). */
const RANK: Record<TrackStatus, number> = { guardada: 0, postulada: 1, entrevista: 2, oferta: 3, descartada: 4 };

export type TrackInput = {
  id?: string;
  title: string;
  company: string;
  jobUrl?: string;
  jobText?: string;
  status?: TrackStatus;
  artifact?: ArtifactKind | ArtifactKind[];
  /** Pisa el estado aunque sea "para atrás" (lo elige la persona). */
  force?: boolean;
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Mismo aviso aunque cambie el "#", la barra final o los parámetros de campaña. */
export function normalizeUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|gh_src$|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    return `${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `t${(h >>> 0).toString(16)}`;
}

export function trackId(input: Pick<TrackInput, "id" | "jobUrl" | "title" | "company">): string {
  if (input.id) return input.id;
  const url = normalizeUrl(input.jobUrl ?? "");
  return hash(url || `${fold(input.title)}|${fold(input.company)}`);
}

function read(): TrackItem[] {
  const items = load<TrackItem[]>(TRACKER_KEY);
  return Array.isArray(items) ? items : [];
}

function write(items: TrackItem[]): void {
  save(TRACKER_KEY, items);
  try {
    window.dispatchEvent(new Event(TRACKER_EVENT));
  } catch {
    // sin window (tests de servidor): no hay vista que refrescar
  }
}

/** Las tarjetas, la más reciente primero. */
export function listTracked(): TrackItem[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

function findIndex(items: TrackItem[], input: TrackInput): number {
  const id = trackId(input);
  const url = normalizeUrl(input.jobUrl ?? "");
  const key = `${fold(input.title)}|${fold(input.company)}`;
  return items.findIndex(
    // Una tarjeta sin link (agregada a mano) es la misma si coincide puesto y empresa, aunque ahora llegue con link.
    (it) => it.id === id || (url && normalizeUrl(it.jobUrl) === url) || (!it.jobUrl && `${fold(it.title)}|${fold(it.company)}` === key),
  );
}

/**
 * Crea la tarjeta o suma lo nuevo a la que ya existe (mismo id, mismo link o, sin link, mismo puesto y empresa),
 * sobre una lista dada. Sin localStorage: la usa también el servidor (seguimiento desde la extensión).
 */
export function upsertInto(items: TrackItem[], input: TrackInput, now = Date.now()): { items: TrackItem[]; item: TrackItem } | null {
  if (!input.title.trim() && !input.company.trim() && !input.jobUrl?.trim()) return null;
  const kinds = input.artifact ? (Array.isArray(input.artifact) ? input.artifact : [input.artifact]) : [];
  const list = [...items];
  const i = findIndex(list, input);
  const prev = i >= 0 ? list[i] : null;

  const status: TrackStatus = !prev
    ? (input.status ?? "guardada")
    : input.status && (input.force || (prev.status !== "descartada" && RANK[input.status] > RANK[prev.status]))
      ? input.status
      : prev.status;
  const artifacts = [...(prev?.artifacts ?? [])];
  for (const kind of kinds) {
    const j = artifacts.findIndex((a) => a.kind === kind);
    if (j >= 0) artifacts[j] = { kind, at: now };
    else artifacts.push({ kind, at: now });
  }

  const next: TrackItem = {
    id: prev?.id ?? trackId(input),
    title: input.title.trim() || prev?.title || "",
    company: input.company.trim() || prev?.company || "",
    jobUrl: input.jobUrl?.trim() || prev?.jobUrl || "",
    jobText: input.jobText?.trim() || prev?.jobText || undefined,
    status,
    artifacts,
    notes: prev?.notes ?? "",
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  if (i >= 0) list[i] = next;
  else list.push(next);
  return { items: list, item: next };
}

/** Crea la tarjeta o suma lo nuevo a la que ya existe, en este navegador. */
export function upsertTracked(input: TrackInput): TrackItem | null {
  const out = upsertInto(read(), input);
  if (!out) return null;
  write(out.items);
  return out.item;
}

function patch(id: string, fn: (it: TrackItem) => TrackItem): void {
  const items = read();
  const i = items.findIndex((it) => it.id === id);
  if (i < 0) return;
  items[i] = { ...fn(items[i]), updatedAt: Date.now() };
  write(items);
}

/** La persona mueve la tarjeta: acá sí puede ir para atrás. */
export function setStatus(id: string, status: TrackStatus): void {
  patch(id, (it) => ({ ...it, status }));
  capture("seguimiento_estado", { estado: status });
}

export function setNotes(id: string, notes: string): void {
  patch(id, (it) => ({ ...it, notes }));
}

export function removeTracked(id: string): void {
  const items = read();
  const next = items.filter((it) => it.id !== id);
  if (next.length !== items.length) write(next);
}

export function findTracked(input: Pick<TrackInput, "id" | "jobUrl" | "title" | "company">): TrackItem | null {
  const items = read();
  const i = findIndex(items, input);
  return i >= 0 ? items[i] : null;
}

/**
 * Puesto y empresa a partir del título de la página de un formulario (lo que manda la extensión).
 * Greenhouse: "Job Application for Product Manager at Acme"; Lever: "Acme - Product Manager"; si no, el título tal cual.
 */
export function jobFromPage(title: string, url: string): { title: string; company: string } {
  const t = title.replace(/\s+/g, " ").trim();
  const at = t.match(/^(?:job application for\s+)?(.+?)\s+(?:at|en|@)\s+(.+)$/i);
  if (at) return { title: at[1].trim(), company: at[2].trim() };
  const dash = t.split(/\s+[-–|]\s+/);
  if (/lever\.co/.test(url) && dash.length >= 2) return { company: dash[0], title: dash.slice(1).join(" - ") };
  let company = "";
  try {
    const u = new URL(url);
    // boards.greenhouse.io/acme/…, jobs.lever.co/acme/…, jobs.ashbyhq.com/acme/…: la empresa es la primera parte de la ruta.
    company = /greenhouse|lever|ashby|workable|recruitee|breezy/.test(u.host) ? (u.pathname.split("/")[1] ?? "") : u.host.replace(/^(www|jobs|careers|apply)\./, "").split(".")[0];
  } catch {
    // link inválido: sin empresa
  }
  return { title: t || "Postulación", company: company.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}
