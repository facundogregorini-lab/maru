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
    eligibility: { ...DEFAULT_ELIGIBILITY },
    updatedAt: null,
  };
}

export const DEFAULT_ELIGIBILITY = { authorizedCountries: [] as string[], relocation: "a_conversar" as const, remote: "cualquiera" as const, minMonthlyUsd: null };

/** Países que se pueden declarar (y "EU" = cualquier país de la Unión Europea). */
export const COUNTRY_OPTIONS: [string, string][] = [
  ["AR", "Argentina"], ["UY", "Uruguay"], ["CL", "Chile"], ["BR", "Brasil"], ["CO", "Colombia"], ["MX", "México"], ["PE", "Perú"],
  ["US", "Estados Unidos"], ["CA", "Canadá"], ["ES", "España"], ["PT", "Portugal"], ["IT", "Italia"], ["DE", "Alemania"], ["FR", "Francia"],
  ["NL", "Países Bajos"], ["IE", "Irlanda"], ["GB", "Reino Unido"], ["EU", "Unión Europea (cualquier país)"],
];

/** Ajustes guardados antes de que existiera un campo: se completan con los valores de fábrica. */
export function withDefaults(s: Partial<RadarSettings> | null): RadarSettings {
  const d = defaultSettings();
  if (!s) return d;
  return { ...d, ...s, eligibility: { ...d.eligibility, ...(s.eligibility ?? {}) }, weights: { ...d.weights, ...(s.weights ?? {}) } };
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
    eligibility: z
      .object({
        authorizedCountries: z.array(z.string().regex(/^([A-Z]{2})$/)).max(30).refine((xs) => xs.every((x) => COUNTRY_OPTIONS.some(([c]) => c === x)), "País no admitido."),
        relocation: z.enum(["si", "no", "a_conversar"]),
        remote: z.enum(["solo_remoto", "remoto_o_hibrido", "cualquiera"]),
        minMonthlyUsd: z.number().int().min(0).max(1_000_000).nullable(),
      })
      .default({ ...DEFAULT_ELIGIBILITY }),
  })
  .refine((s) => Object.values(s.weights).reduce((a, b) => a + b, 0) === 100, { message: "Los pesos del match tienen que sumar 100.", path: ["weights"] });

export function parseSettings(raw: unknown, now = new Date()): { ok: true; settings: RadarSettings } | { ok: false; error: string } {
  const r = settingsInput.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Revisá los datos." };
  return { ok: true, settings: { ...(r.data as Omit<RadarSettings, "updatedAt">), updatedAt: now.toISOString() } };
}
