/** Versión publicada de la extensión de Chrome (la de extension/manifest.json, que se descarga desde /extension). */
export const EXTENSION_VERSION = "0.4.1";
/**
 * Versión mínima que puede autocompletar. Desde la 0.3.2 la extensión manda su identificador de instalación,
 * que cuenta el cupo gratis; las anteriores reciben un aviso para actualizar.
 */
export const MIN_EXTENSION_VERSION = "0.3.2";

/** Compara versiones "x.y.z": negativo si a < b, 0 si son iguales, positivo si a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** La extensión que no manda versión es anterior a la 0.3.2. */
export const extensionOutdated = (version: string | null) => !version || compareVersions(version, MIN_EXTENSION_VERSION) < 0;
export const extensionUpdateAvailable = (version: string | null) => !version || compareVersions(version, EXTENSION_VERSION) < 0;
