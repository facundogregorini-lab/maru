import { z } from "zod";
import { FREQUENCIES, type RadarSettings } from "./types";

/** Ajustes de monitoreo de Radar. En esta etapa se guardan y se leen; todavía no ejecutan nada. */

export const DEFAULT_WEIGHTS = { experiencia: 40, seniority: 20, ubicacion: 20, compensacion: 10, interes: 10 };

export function defaultSettings(timezone = "America/Argentina/Buenos_Aires"): RadarSettings {
  return {
    enabled: false,
    frequencies: { P1: "diaria", P2: "semanal", P3: "mensual" },
    timezone,
    digest: { enabled: true, day: 1, time: "09:00" },
    instantAlerts: { enabled: false, threshold: 85 },
    channels: { inApp: true, email: false },
    weights: { ...DEFAULT_WEIGHTS },
    updatedAt: null,
  };
}

export function validTimezone(tz: string): boolean {
  if (!tz || tz.length > 64 || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const freq = z.enum(FREQUENCIES as [string, ...string[]]);
const pct = z.number().int().min(0).max(100);

export const settingsInput = z
  .object({
    enabled: z.boolean(),
    frequencies: z.object({ P1: freq, P2: freq, P3: freq }),
    timezone: z.string().refine(validTimezone, "Elegí una zona horaria válida (por ejemplo, America/Argentina/Buenos_Aires)."),
    digest: z.object({
      enabled: z.boolean(),
      day: z.number().int().min(0).max(6),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora tiene que ser HH:MM."),
    }),
    instantAlerts: z.object({ enabled: z.boolean(), threshold: z.number().int().min(50).max(100) }),
    channels: z.object({ inApp: z.literal(true), email: z.boolean() }),
    weights: z.object({ experiencia: pct, seniority: pct, ubicacion: pct, compensacion: pct, interes: pct }),
  })
  .refine((s) => Object.values(s.weights).reduce((a, b) => a + b, 0) === 100, { message: "Los pesos del match tienen que sumar 100.", path: ["weights"] });

export function parseSettings(raw: unknown, now = new Date()): { ok: true; settings: RadarSettings } | { ok: false; error: string } {
  const r = settingsInput.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Revisá los datos." };
  return { ok: true, settings: { ...(r.data as Omit<RadarSettings, "updatedAt">), updatedAt: now.toISOString() } };
}
