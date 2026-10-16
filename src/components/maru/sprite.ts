/**
 * Maru en pixel art (16 × 18), al estilo del monstruito de Claude Code.
 * Cada fila es una línea de píxeles; cada letra, un color. "." es transparente.
 */

export const PALETTE: Record<string, string> = {
  H: "#3b2416", // pelo
  h: "#5a3a24", // brillo del pelo
  N: "#00f0a0", // hebilla neón
  S: "#f4c7a1", // piel
  s: "#dc9f78", // sombra de la piel / párpado
  E: "#111111", // ojos
  R: "#f08a8a", // cachetes
  M: "#b4472a", // boca
  T: "#1c8c4c", // remera (verde de marca)
  t: "#136c39", // sombra de la remera
  P: "#1f2937", // pantalón
  B: "#0a0a0a", // zapatillas
};

const HEAD = [
  ".....HHHHHH.....",
  "....HHHhHHHHN...",
  "...HHHhHHHHHHH..",
  "...HHHHHHHHSHH..",
  "..HHHSSSSSSSHHH.",
  "..HHSSESSSESSHH.",
  "..HHSSESSSESSHH.",
  "..HHRSSSSSSSRHH.",
  "..HHHSSMMSSSHHH.",
];

/** Ojos cerrados: una línea. */
const HEAD_BLINK = HEAD.map((row, i) => (i === 5 ? "..HHSSSSSSSSSHH." : i === 6 ? "..HHSSsSSSsSSHH." : row));

const BODY = [
  "..HHH..SS..HHH..",
  "..HHTTTTTTTTHH..",
  "...STTTtTTTTS...",
  "...STTTtTTTTS...",
  ".....TTTTTT.....",
  ".....PPPPPP.....",
];

const LEGS_STAND = [".....PP..PP.....", ".....PP..PP.....", "....BBB..BBB...."];
const LEGS_WALK_A = ["....PP....PP....", "...PP......PP...", "..BBB......BBB.."];
const LEGS_WALK_B = ["......PPPP......", "......PPPP......", ".....BBBBBB....."];

/** Brazo en alto para saludar. */
const BODY_WAVE = [
  "..HHH..SS..HHHS.",
  "..HHTTTTTTTTHS..",
  "...STTTtTTTT....",
  "...STTTtTTTT....",
  ".....TTTTTT.....",
  ".....PPPPPP.....",
];

export const FRAMES = {
  idle: [...HEAD, ...BODY, ...LEGS_STAND],
  blink: [...HEAD_BLINK, ...BODY, ...LEGS_STAND],
  walkA: [...HEAD, ...BODY, ...LEGS_WALK_A],
  walkB: [...HEAD, ...BODY, ...LEGS_WALK_B],
  wave: [...HEAD, ...BODY_WAVE, ...LEGS_STAND],
} as const;

export type FrameName = keyof typeof FRAMES;

/** Sólo la cabeza, para el logo y el favicon. */
export const HEAD_ONLY = HEAD;

export const WIDTH = 16;
export const HEIGHT = FRAMES.idle.length;

/** Rectángulos de un frame, agrupando píxeles contiguos del mismo color por fila (menos nodos en el SVG). */
export function rects(rows: readonly string[]): { x: number; y: number; w: number; fill: string }[] {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (c === "." || !PALETTE[c]) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === c) w++;
      out.push({ x, y, w, fill: PALETTE[c] });
      x += w;
    }
  });
  return out;
}
