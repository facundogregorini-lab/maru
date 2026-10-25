import data from "../../public/maru/shots.json";
import { Timeline } from "../engine/timeline";
import type { ShotsFile } from "../engine/types";

export const MOTIVATION =
  "Me encanta que usen datos para decidir producto. Vengo de armar tableros en fintech y quiero sumar análisis de experimentos.";
export const CPS = 48;

/** Match + postulación a medida, en el sitio real de Maru (30 fps). */
export function buildMaru() {
  const tl = new Timeline(data as ShotsFile, "maru");

  // 1. CV
  tl.show("match-cv-mine", 0);
  tl.camera({ landscape: { x: 720, y: 400 }, portrait: { x: 720, y: 420 } }, { landscape: 1.15, portrait: 0.9 }, 1, 0);
  tl.wait(16).place({ x: 1330, y: 860 }).mark("dragStart");
  tl.move("match-cv-mine.drop", 34, { arc: 0.06, dy: 10 }).mark("hover").wait(10).mark("drop");
  tl.show("match-cv-loaded", 6).wait(10);
  tl.move("match-cv-loaded.seguir", 20).click(4).mark("leyendo");
  tl.show("match-leyendo", 6);
  tl.camera({ x: 720, y: 330 }, { landscape: 1.35, portrait: 1.1 }, 24);
  tl.wait(30);

  // 2. Perfil entendido
  tl.show("match-profile", 8).mark("profile");
  tl.camera({ landscape: { x: 720, y: 290 }, portrait: { x: 500, y: 300 } }, { landscape: 1.3, portrait: 1.05 }, 26);
  tl.wait(26);
  tl.camera({ landscape: { x: 740, y: 330 }, portrait: { x: 1100, y: 380 } }, { landscape: 1.3, portrait: 1.1 }, 22);
  tl.move("match-profile.ver", 22).click(4).mark("results");

  // 3. Búsquedas reales con su compatibilidad
  tl.show("match-results", 8);
  tl.camera({ landscape: { x: 740, y: 470 }, portrait: { x: 470, y: 520 } }, { landscape: 1.08, portrait: 1.0 }, 1);
  tl.wait(22).mark("ring");
  tl.camera({ landscape: { x: 1180, y: 520 }, portrait: { x: 1150, y: 560 } }, { landscape: 1.55, portrait: 1.15 }, 26);
  tl.wait(34);
  tl.camera({ landscape: { x: 740, y: 1080 }, portrait: { x: 470, y: 1050 } }, { landscape: 1.05, portrait: 0.95 }, 40);
  tl.wait(40);
  tl.camera({ landscape: { x: 900, y: 600 }, portrait: { x: 1000, y: 640 } }, { landscape: 1.2, portrait: 1.05 }, 30);
  tl.wait(16).move("match-results.prepare0", 22).click(4).mark("post");

  // 4. Postulación a medida
  tl.show("post-motivo-full", 8);
  tl.camera({ landscape: { x: 720, y: 330 }, portrait: { x: 720, y: 360 } }, { landscape: 1.05, portrait: 0.95 }, 1);
  tl.wait(22);
  tl.camera({ landscape: { x: 720, y: 980 }, portrait: { x: 500, y: 980 } }, { landscape: 1.2, portrait: 1.0 }, 30);
  tl.wait(18).move("post-motivo-full.motivo", 18, { dx: -380, dy: -40 }).click(2).mark("typeStart");
  tl.wait(Math.ceil((MOTIVATION.length / CPS) * 30) + 8).mark("typeEnd");
  tl.camera({ x: 720, y: 1500 }, { landscape: 1.15, portrait: 1.0 }, 26);
  tl.wait(14).move("post-motivo-full.empezar", 20).click(4).mark("analizando");
  tl.show("post-analizando", 6);
  tl.camera({ x: 720, y: 330 }, { landscape: 1.35, portrait: 1.1 }, 1);
  tl.wait(26);
  tl.show("post-preguntas", 8).mark("preguntas");
  tl.camera({ landscape: { x: 720, y: 330 }, portrait: { x: 500, y: 340 } }, { landscape: 1.2, portrait: 1.0 }, 1);
  tl.wait(36);
  tl.camera({ x: 720, y: 520 }, { landscape: 1.2, portrait: 1.0 }, 20);
  tl.move("post-preguntas.armar", 20).click(4).mark("generando");
  tl.show("post-generando", 6);
  tl.camera({ x: 720, y: 330 }, { landscape: 1.35, portrait: 1.1 }, 1);
  tl.wait(28);

  // 5. Resultado: CV optimizado y respuestas
  tl.show("post-resultado", 10).mark("resultado");
  tl.camera({ landscape: { x: 720, y: 330 }, portrait: { x: 540, y: 340 } }, { landscape: 1.05, portrait: 0.92 }, 1);
  tl.wait(20);
  tl.camera({ landscape: { x: 640, y: 1300 }, portrait: { x: 540, y: 1330 } }, { landscape: 1.15, portrait: 0.95 }, 40);
  tl.wait(44).mark("ats");
  tl.camera({ landscape: { x: 1080, y: 1330 }, portrait: { x: 1170, y: 1340 } }, { landscape: 1.6, portrait: 1.25 }, 30);
  tl.wait(46);
  tl.camera({ landscape: { x: 620, y: 470 }, portrait: { x: 520, y: 480 } }, { landscape: 1.2, portrait: 1.05 }, 32);
  tl.wait(16).move("post-resultado.formTab", 22).click(4).mark("formulario");
  tl.show("post-formulario", 8);
  tl.camera({ landscape: { x: 720, y: 700 }, portrait: { x: 500, y: 720 } }, { landscape: 1.25, portrait: 1.05 }, 30);
  tl.wait(54).mark("end");
  return tl;
}

/** La extensión completa un formulario de ejemplo (empresa ficticia). */
export const FIELDS = ["first", "last", "email", "li", "city", "resume", "years", "english", "why"] as const;

export function buildExtension() {
  const tl = new Timeline(data as ShotsFile, "maru");
  tl.show("ext-before", 0);
  tl.camera({ landscape: { x: 720, y: 470 }, portrait: { x: 720, y: 480 } }, { landscape: 1.12, portrait: 0.85 }, 1, 0);
  tl.place({ x: 1000, y: 700 });
  tl.wait(20).moveUi("ext", 28).wait(4).click(6).mark("click");
  tl.show("ext-working", 6);
  tl.wait(22).mark("fill");
  // Cada campo aparece completado en orden (ver Video.tsx).
  tl.wait(FIELDS.length * 7 + 12).mark("filled");
  tl.show("ext-after", 10);
  tl.camera({ landscape: { x: 860, y: 560 }, portrait: { x: 760, y: 600 } }, { landscape: 1.25, portrait: 0.85 }, 34);
  tl.wait(56).mark("end");
  return tl;
}
