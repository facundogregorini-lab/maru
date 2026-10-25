import { localFont } from "../engine/fonts";
import type { Theme } from "../engine/types";

const titillium = localFont("Titillium Web", "titillium-web", [400, 600, 700]);
const inter = localFont("Inter", "inter", [400, 500, 600, 700]);

// Colores de src/app/globals.css de Maru.
export const C = {
  neon: "#00f0a0",
  forest: "#1c8d4d",
  forestDark: "#136c39",
  hero: "#ecffe0",
  panel: "#effbe8",
  banner: "#e4f7d4",
  mint: "#b5ffe4",
  ink: "#000000",
  muted: "#5c6066",
  aqua: "#14c8f0",
};

export const theme: Theme = {
  bg: "#f3fdea",
  bg2: "#dff6cf",
  accent: C.forest,
  ink: C.ink,
  muted: C.muted,
  pill: C.ink,
  pillInk: "#ffffff",
  step: C.neon,
  stepInk: C.ink,
  font: inter,
  display: titillium,
  dark: false,
};
