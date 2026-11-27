"use client";

import { requestLogin } from "@/lib/loginRequest";

/** Llamadas a /api/radar/*. Sin sesión abre el ingreso con Google y reintenta una vez. */

export class ApiError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
  }
}

export async function radarApi<T>(url: string, init: { method?: string; body?: unknown; form?: FormData } = {}, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      cache: "no-store",
      headers: init.form ? undefined : { "Content-Type": "application/json" },
      body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    });
  } catch {
    throw new ApiError("No hay conexión. Revisá internet y probá de nuevo.", "OFFLINE");
  }
  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (res.ok) return data as T;
  if (res.status === 401 && data.code === "AUTH_REQUIRED" && !retried) {
    if (await requestLogin("usar Radar laboral")) return radarApi<T>(url, init, true);
  }
  throw new ApiError(typeof data.error === "string" ? data.error : "Algo salió mal. Probá de nuevo.", data.code as string | undefined, res.status);
}
