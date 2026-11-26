"use client";

import { requestLogin } from "../loginRequest";
import type { Busqueda, Candidato, Categoria, Decision, Estado, Icp, IcpEdit } from "./types";

/** Lo que devuelve la API (sin datos internos). */
export type BusquedaView = Omit<Busqueda, "owner">;
export type CandidatoView = Omit<Candidato, "perfil" | "contacto"> & { perfilResumen: string; contacto: Candidato["contacto"] | null };
export type Snapshot = {
  busqueda: BusquedaView;
  candidatos: CandidatoView[];
  versiones: { version: number; creadoEn: number; calificados: number; si: number }[];
  pendientes: number;
  calificados: number;
  minCalificados: number;
};
export type BusquedaItem = { id: string; titulo: string; version: number; borrador: boolean; actualizadaEn: number };

export class RecError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

/** Llama a /api/recruiters…; si pide ingresar, abre el diálogo y repite el pedido. */
export async function recApi<T>(path: string, init: { method?: string; body?: unknown; email?: string | null } = {}, retried = false): Promise<T> {
  const res = await fetch(`/api/recruiters${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init.email ? { "X-Maru-Account": init.email } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }).catch(() => null);
  if (!res) throw new RecError("No pudimos conectar con Maru. Revisá tu conexión y probá de nuevo.", "NETWORK");
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    if (data.code === "AUTH_REQUIRED" && !retried && (await requestLogin("usar Maru Recruiters"))) return recApi<T>(path, { ...init, email: undefined }, true);
    throw new RecError(data.error ?? "Algo salió mal. Probá de nuevo.", data.code ?? "UNKNOWN");
  }
  return data as T;
}

export const icpActual = (b: BusquedaView): Icp => b.icps[b.icps.length - 1];
export const editable = (icp: Icp): IcpEdit => {
  const { version: _v, creadoEn: _c, ...rest } = icp;
  void _v;
  void _c;
  return structuredClone(rest);
};

export const CATEGORIA: Record<Categoria, { label: string; ring: string; orden: number }> = {
  fuerte: { label: "Encaje fuerte", ring: "border-neon", orden: 0 },
  bueno: { label: "Buen encaje", ring: "border-brand-light", orden: 1 },
  parcial: { label: "Encaje parcial", ring: "border-warning", orden: 2 },
  bajo: { label: "Encaje bajo", ring: "border-line", orden: 3 },
  inconcluso: { label: "Sin datos suficientes", ring: "border-dashed border-line", orden: 4 },
};
export const ESTADO_ICON: Record<Estado, string> = { cumple: "✓", no_cumple: "✗", sin_datos: "?" };
export const DECISION_LABEL: Record<Decision, string> = { si: "Sí", tal: "Tal vez", no: "No" };
export const MOTIVOS_NO = ["Muy junior para el alcance", "Muy senior", "Sin equipo a cargo", "Otra industria", "Fuera de zona", "No cumple un excluyente"];

/** CSV para compartir con el hiring manager (separador coma, comillas dobles). */
export function toCsv(s: Snapshot): string {
  const icp = icpActual(s.busqueda);
  const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
  const head = ["Nombre", "Titular", "Ubicación", "Fuente", "Encaje", ...icp.obligatorios.map((c) => c.texto), "Por qué", "Decisión", "Motivo", "Email", "Teléfono", "LinkedIn"];
  const rows = s.candidatos.map((c) => {
    const e = c.evaluacion?.icpVersion === icp.version ? c.evaluacion : null;
    const est = (id: string) => e?.criterios.find((x) => x.id === id)?.estado ?? "";
    return [
      c.nombre, c.titular, c.ubicacion, c.fuente === "maru" ? "Maru" : "Propio", e ? CATEGORIA[e.categoria].label : "Pendiente",
      ...icp.obligatorios.map((o) => (est(o.id) ? ESTADO_ICON[est(o.id) as Estado] : "")),
      e?.porQue ?? "", c.decision ? DECISION_LABEL[c.decision] : "", c.motivo, c.contacto?.email ?? "", c.contacto?.telefono ?? "", c.contacto?.linkedin ?? "",
    ];
  });
  return [head, ...rows].map((r) => r.map((x) => q(String(x))).join(",")).join("\n");
}
