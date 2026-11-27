import type { CompanySource, Frequency, Priority, RadarSettings, TargetsDoc } from "./types";

/**
 * Frecuencias del monitoreo. La frecuencia global de una fuente es el intervalo más corto que pide alguna
 * persona activa que sigue la empresa (Radar activo, empresa activa y su prioridad sin pausar).
 * Las alertas y el resumen respetan después la configuración de cada persona.
 */

export const INTERVAL_MS: Record<Frequency, number | null> = { diaria: 24 * 3600_000, semanal: 7 * 24 * 3600_000, mensual: 30 * 24 * 3600_000, pausada: null };

/** Intervalo que pide una persona para una empresa (null = no la quiere revisar). */
export function intervalFor(settings: RadarSettings, targets: TargetsDoc, companyId: string): number | null {
  const t = targets.items[companyId];
  if (!settings.enabled || !t || t.status !== "activa") return null;
  const p: Priority = t.priority ?? "P3";
  return INTERVAL_MS[settings.frequencies[p]];
}

/** El mínimo entre quienes la siguen. */
export function globalInterval(intervals: (number | null)[]): number | null {
  const xs = intervals.filter((x): x is number => x !== null);
  return xs.length ? Math.min(...xs) : null;
}

/** Vencida: nunca leída bien, o su próxima revisión ya pasó (las fuentes manuales no se leen solas). */
export function isDue(s: CompanySource, now: number): boolean {
  if (s.status === "manual") return false;
  if (s.nextDueAt) return Date.parse(s.nextDueAt) <= now;
  return true;
}

/** Fecha y hora local (zona IANA) para el resumen. */
export function localParts(now: Date, timeZone: string): { day: number; minutes: number; date: string } {
  const f = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit", hourCycle: "h23" });
  const parts = Object.fromEntries(f.formatToParts(now).map((p) => [p.type, p.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute), date: `${parts.year}-${parts.month}-${parts.day}` };
}

/** Semana ISO (para que el resumen salga una sola vez por semana). */
export function isoWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - first.getTime()) / 86_400_000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * ¿Toca el resumen ahora? Ya pasó su día y hora en la semana local (lunes a domingo). Quien llama verifica que no
 * se haya enviado esta semana: así, con un cron diario, sale en la primera corrida posterior y no se pierde.
 */
export function digestDue(settings: RadarSettings, now: Date): { due: boolean; week: string } {
  const lp = localParts(now, settings.timezone);
  const [h, m] = settings.digest.time.split(":").map(Number);
  const weekMinutes = (d: number, mins: number) => ((d + 6) % 7) * 1440 + mins;
  const late = weekMinutes(lp.day, lp.minutes) - weekMinutes(settings.digest.day, h * 60 + m);
  // Hasta 48 h después de la hora elegida (un cron diario siempre entra en esa ventana).
  return { due: settings.enabled && settings.digest.enabled && late >= 0 && late < 48 * 60, week: isoWeek(lp.date) };
}
