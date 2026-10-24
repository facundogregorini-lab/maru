import type { CopilotAction } from "./copilot";
import { handoffToPostulacion } from "./match/clientStore";
import { load, remove, save } from "./storage";
import { upsertTracked } from "./tracker";

/** Abre el copiloto desde cualquier pantalla (home, búsquedas, match). Con `question`, la manda apenas abre. */
export const OPEN_COPILOT_EVENT = "maru:copiloto";
export function openCopilot(question?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COPILOT_EVENT, { detail: { question } }));
}

export type CopilotJobLink = { id: string; title: string; company: string; score?: number };
export type CopilotMessage = { role: "user" | "assistant"; text: string; jobs?: CopilotJobLink[]; actions?: CopilotAction[] };

/** La charla dura lo que la pestaña: así sobrevive a las acciones que cambian de pantalla. */
const CHAT_KEY = "maru:copiloto:charla";
/** Si la persona apagó el uso de su CV y su match (por defecto, encendido). */
const CONTEXT_KEY = "maru:copiloto:contexto";

export function loadChat(owner: string): CopilotMessage[] {
  try {
    const raw = sessionStorage.getItem(CHAT_KEY);
    const s = raw ? (JSON.parse(raw) as { owner: string; messages: CopilotMessage[] }) : null;
    return s && s.owner === owner && Array.isArray(s.messages) ? s.messages.slice(-30) : [];
  } catch {
    return [];
  }
}
export function saveChat(owner: string, messages: CopilotMessage[]): void {
  try {
    sessionStorage.setItem(CHAT_KEY, JSON.stringify({ owner, messages: messages.slice(-30) }));
  } catch {
    // sin sessionStorage la charla vive sólo en memoria
  }
}
export const readContextPref = () => load<boolean>(CONTEXT_KEY) !== false;
export const setUseContextPref = (on: boolean) => (on ? remove(CONTEXT_KEY) : save(CONTEXT_KEY, false));

/** «Preparar mi postulación»: trae el aviso completo, lo deja listo para el coach y lo suma al seguimiento. */
export async function prepareApplication(job: { id: string; title: string; company: string }): Promise<string> {
  const res = await fetch(`/api/match/oportunidad?id=${encodeURIComponent(job.id)}`);
  const d = (await res.json().catch(() => ({}))) as { url?: string; text?: string; error?: string };
  if (!res.ok) throw new Error(d.error ?? "No pudimos abrir esta búsqueda.");
  const jobUrl = d.url?.startsWith("maru:") ? "" : (d.url ?? "");
  handoffToPostulacion({ id: job.id, jobUrl, jobText: d.text ?? "", title: job.title, company: job.company });
  upsertTracked({ id: job.id, title: job.title, company: job.company, jobUrl, jobText: d.text ?? "" });
  return "/postulacion#empezar";
}
