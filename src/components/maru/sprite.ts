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

/* ---------- Maru en su escritorio: sentada, tipeando en la compu, con un mate al lado ---------- */

Object.assign(PALETTE, {
  L: "#d5dae0", // tapa de la notebook
  l: "#b3bac3", // borde de la tapa
  K: "#8b939c", // base de la notebook
  D: "#c89f74", // escritorio
  d: "#9c7552", // frente del escritorio
  G: "#6b4a33", // mate
  g: "#8a6446", // brillo del mate
  Y: "#c0c6cc", // bombilla
});

type Eyes = "down" | "up" | "closed";
type Hand = "up" | "down" | "wave" | "wave2";

const pad = (row: string) => `....${row}....`; // la cabeza de 16 px centrada en 24
const set = (row: string, at: number, s: string) => row.slice(0, at) + s + row.slice(at + s.length);

/** Arma un frame de 28 × 20: Maru (24 px) detrás de la notebook y el mate a la derecha. */
function deskFrame(eyes: Eyes, left: Hand, right: Hand, mouth: "smile" | "open" = "smile"): string[] {
  const head = (eyes === "closed" ? HEAD_BLINK : HEAD).map(pad);
  if (eyes === "down") {
    // Mirada a la pantalla: párpado arriba y pupilas abajo.
    head[5] = pad("..HHSSsSSSsSSHH.");
    head[6] = pad("..HHSSESSSESSHH.");
  }
  if (mouth === "open") head[8] = pad("..HHHSSMMSSSHHH.").replace("SSMMSS", "SMMMMS");

  const rows = [
    ...head,
    "......HHH..SS..HHH......",
    "......HHTTTTTTTTHH......",
    "....TTlLLLLLLLLLLLLlTT..",
    "...TTTlLLLLLLLLLLLLlTTT.",
    "...TTTlLLLLLNNLLLLLlTTT.",
    "...TTTlLLLLLNNLLLLLlTTT.",
    "...TTTlLLLLLLLLLLLLlTTT.",
    "....KKKKKKKKKKKKKKKKKK..",
  ];
  // Manos: arriba (sobre la tapa) o abajo (en el teclado); "wave" saluda al lado de la cara.
  const hand = (side: "l" | "r", h: Hand) => {
    const at = side === "l" ? 4 : 20;
    if (h === "up") rows[15] = set(rows[15], at, "SS");
    if (h === "down") rows[16] = set(rows[16], at, "SS");
    if (h === "wave" || h === "wave2") {
      // "wave2" corre la mano un píxel: alternando los dos, saluda.
      const x = (side === "l" ? 2 : 20) + (h === "wave2" ? (side === "l" ? -1 : 1) : 0);
      rows[8] = set(rows[8], x, "SS");
      rows[9] = set(rows[9], x, "SS");
      rows[10] = set(rows[10], side === "l" ? 3 : 20, "S");
    }
  };
  hand("l", left);
  hand("r", right);

  // El mate (con bombilla) a la derecha, sobre el escritorio.
  const mate = ["..Y.", "..Y.", ".GGg", "GGGg", "GGGg", ".GG."];
  const out = rows.map((r, i) => r + (i >= rows.length - 6 ? mate[i - (rows.length - 6)] : "...."));
  return [...out, "D".repeat(28), "d".repeat(28), "..d......................d.."];
}

export const DESK_FRAMES = {
  typeA: deskFrame("down", "up", "down"),
  typeB: deskFrame("down", "down", "up"),
  think: deskFrame("down", "down", "down"),
  blink: deskFrame("closed", "down", "down"),
  look: deskFrame("up", "down", "down"),
  talk: deskFrame("up", "down", "down", "open"),
  wave: deskFrame("up", "down", "wave", "open"),
  wave2: deskFrame("up", "down", "wave2", "open"),
} as const;

export type DeskFrame = keyof typeof DESK_FRAMES;
export const DESK_WIDTH = 28;
export const DESK_HEIGHT = DESK_FRAMES.typeA.length;
