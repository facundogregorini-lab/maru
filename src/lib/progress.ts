/**
 * Avance estimado de una espera de `expected` segundos: sube rápido al principio, a los `expected` segundos
 * marca ~80% y nunca pasa de 95% (la IA no informa avance real; llegar a 100% sin resultado sería mentir).
 */
export function estimatedProgress(elapsedSec: number, expected: number): number {
  if (elapsedSec <= 0 || expected <= 0) return 0;
  return Math.min(0.95, 1 - Math.exp((-1.6 * elapsedSec) / expected));
}
