/** Estados de la fuente de una empresa del Radar (sin dependencias: lo usan la UI y el servidor). */

export type SourceState =
  /** Su bolsa está en el directorio y la última lectura fue completa. */
  | "monitoreada"
  /** Está en el directorio pero la última lectura falló. */
  | "error"
  /** No tiene bolsa propia, pero aparecen avisos suyos en portales que lee Maru. */
  | "portales"
  /** Tiene una URL de un ATS que Maru sabe leer, pero todavía no está en el directorio. */
  | "incorporable"
  /** Sin fuente que Maru pueda leer: queda para revisar a mano. */
  | "sin_fuente";

export type CompanyStatus = {
  state: SourceState;
  boards: string[];
  open: number;
  eligible: number;
  pending: number;
  lastOkAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
};

export const STATE_LABEL: Record<SourceState, string> = {
  monitoreada: "Monitoreada",
  error: "Error en la fuente",
  portales: "Vista en portales",
  incorporable: "Lista para sumar",
  sin_fuente: "Sin fuente",
};

export const STATE_HINT: Record<SourceState, string> = {
  monitoreada: "Maru lee su bolsa de empleo todos los días.",
  error: "La última lectura de su bolsa falló. Se conservan los avisos de la última lectura buena.",
  portales: "No leemos su bolsa propia, pero sus avisos aparecen en portales que Maru revisa.",
  incorporable: "Su página de empleo usa un sistema que Maru sabe leer. Falta sumarla al monitoreo diario.",
  sin_fuente: "No encontramos una fuente que Maru pueda leer. Cargá el link de su página de empleo.",
};
