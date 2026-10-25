import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Background } from "../engine/Background";
import { Music } from "../engine/Music";
import { StepCaption, WordsIn } from "../engine/Captions";
import { out, prog } from "../engine/ease";
import { useFormat } from "../engine/layout";
import { Walkthrough } from "../engine/Walkthrough";
import { Glow, RevealCrop, TypeIn, keyFrames } from "../engine/widgets";
import { Logo, MaruDesk } from "./Logo";
import { CPS, FIELDS, MOTIVATION, buildExtension, buildMaru } from "./script";
import { C, theme } from "./theme";

const tl = buildMaru();
const m = tl.marks;
const ext = buildExtension();
const e = ext.marks;

export const HOOK = 96;
export const WALK = m.end + 4;
export const EXT = e.end + 4;
export const OUTRO = 132;
const T = 12;
export const TOTAL = HOOK + WALK + EXT + OUTRO - 3 * T;

// ---------- 1. Gancho ----------
const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const fmt = useFormat();
  const big = fmt === "landscape" ? 120 : 112;
  const frame = Math.floor(f / 5) % 2 === 0 ? "typeA" : "typeB";
  const a = prog(f, 40, 58, out);
  return (
    <AbsoluteFill>
      <Background theme={theme} glow={C.neon} glow2={C.aqua} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", textAlign: "center", padding: 70, gap: fmt === "landscape" ? 30 : 46 }}>
        <div style={{ transform: `translateY(${(1 - prog(f, 0, 16, out)) * 30}px)`, opacity: prog(f, 0, 12) }}>
          <MaruDesk size={fmt === "landscape" ? 200 : 260} frame={frame} />
        </div>
        <div style={{ fontFamily: theme.display, color: C.ink, lineHeight: 1 }}>
          <div style={{ fontWeight: 400, fontSize: big * 0.55, letterSpacing: "-0.01em" }}>
            <WordsIn text="Basta de buscar trabajo sin ayuda." from={6} stagger={3} />
          </div>
          <div style={{ fontWeight: 700, fontSize: big, letterSpacing: "-0.02em", marginTop: 34, lineHeight: 1.1, textTransform: "uppercase", opacity: a, transform: `scale(${0.92 + 0.08 * a})` }}>
            Hacelo con <span style={{ background: C.neon, padding: "0 16px", borderRadius: 14, display: "inline-block", lineHeight: 1.05 }}>IA</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Archivo PDF arrastrado. */
const PdfFile: React.FC<{ x: number; y: number; k: number }> = ({ x, y, k }) => (
  <div
    style={{
      position: "absolute",
      left: x - 10,
      top: y - 10,
      transform: `scale(${1 - k * 0.4}) rotate(-4deg)`,
      transformOrigin: "10px 10px",
      opacity: 1 - k,
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 18px 12px 12px",
      background: "#fff",
      borderRadius: 14,
      boxShadow: "0 24px 50px -12px rgba(0,0,0,.4), 0 0 0 1px rgba(0,0,0,.06)",
      fontFamily: theme.font,
    }}
  >
    <div style={{ width: 40, height: 50, borderRadius: 6, background: "#e8463a", color: "#fff", display: "grid", placeItems: "end center", paddingBottom: 6, fontSize: 11, fontWeight: 800 }}>PDF</div>
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.ink }}>CV-Lucia-Fernandez.pdf</div>
      <div style={{ fontSize: 12, color: C.muted }}>212 KB</div>
    </div>
  </div>
);

// ---------- 2. Match y postulación ----------
const Walk: React.FC = () => {
  const f = useCurrentFrame();
  const fmt = useFormat();
  const drop = tl.box("match-cv-mine.drop");
  return (
    <AbsoluteFill>
      <Background theme={theme} glow={C.neon} glow2={C.aqua} />
      <Walkthrough
        tl={tl}
        enter={prog(f, 0, 22, out)}
        accent={C.forest}
        url={(id) => (id.startsWith("match") ? "marucoach.com/match" : "marucoach.com/postulacion")}
        overlays={[
          (f) => <Glow f={f} box={drop} from={m.hover - 6} to={m.drop + 2} color={C.forest} radius={18} pad={2} />,
          (f, t) => {
            if (f < m.dragStart || f > m.drop + 8) return null;
            const c = t.cursorAt(f)!;
            return <PdfFile x={c.x + 14} y={c.y + 14} k={prog(f, m.drop, m.drop + 8)} />;
          },
          (f) => <Glow f={f} box={{ x: 1296, y: 474, w: 100, h: 100 }} from={m.ring + 20} to={m.ring + 64} color={C.neon} radius={50} pad={4} />,
          (f) => (
            <TypeIn
              f={f}
              box={tl.box("post-motivo-full.motivo")}
              text={MOTIVATION}
              from={m.typeStart}
              until={m.typeEnd}
              coverFrom={m.post}
              placeholder="Me encanta que… Creo que encajo porque… Lo que más me entusiasma es…"
              cps={CPS}
              font={theme.font}
              size={16}
              pad={{ x: 16, y: 12 }}
              radius={12}
              ring={C.ink}
            />
          ),
          (f) => <Glow f={f} box={{ x: 1036, y: 1250, w: 270, h: 200 }} from={m.ats + 26} to={m.ats + 82} color={C.neon} radius={16} pad={6} />,
        ]}
      />
      <StepCaption theme={theme} n={1} text="Subí tu CV" from={12} to={m.results} />
      <StepCaption theme={theme} n={2} text="Búsquedas reales que encajan con vos" sub={fmt === "landscape" ? "con el % de compatibilidad" : "Con el % de compatibilidad"} from={m.results + 4} to={m.post} />
      <StepCaption theme={theme} n={3} text="Una postulación para cada aviso" from={m.post + 4} to={m.resultado} />
      <StepCaption theme={theme} n={4} text="Tu CV adaptado al aviso" sub={fmt === "landscape" ? "y listo para los filtros ATS" : "Y listo para los filtros ATS"} from={m.resultado + 4} to={m.formulario} />
      <StepCaption theme={theme} n={5} text="Respuestas listas para el formulario" from={m.formulario + 4} to={WALK + 10} />
      {keyFrames(MOTIVATION, m.typeStart, CPS, 30, 3).map((k) => (
        <Sequence key={k} from={k} durationInFrames={4} layout="none">
          <Audio src={staticFile("sfx/key.wav")} volume={0.2} />
        </Sequence>
      ))}
      {fmt === "portrait" && <Footer />}
    </AbsoluteFill>
  );
};

const Footer: React.FC = () => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: 130, display: "flex", justifyContent: "center" }}>
    <Logo size={64} />
  </div>
);

// ---------- 3. Extensión ----------
const Extension: React.FC = () => {
  const f = useCurrentFrame();
  const fmt = useFormat();
  return (
    <AbsoluteFill>
      <Background theme={theme} glow={C.aqua} glow2={C.neon} />
      <Walkthrough
        tl={ext}
        enter={prog(f, 0, 20, out)}
        accent={C.forest}
        url="andesdata.com/empleos/data-analyst"
        extensionIcon="maru/ext-icon.png"
        extensionBadge={(f) => (
          <>
            {f >= e.click - 10 && f < e.filled + 10 && (
              <span style={{ position: "absolute", inset: -3, borderRadius: 8, background: "rgba(0,0,0,.08)", boxShadow: f >= e.click ? `0 0 0 ${Math.max(0, 3 - (f - e.click) / 6)}px ${C.neon}` : undefined }} />
            )}
            {f >= e.click ? (
            <span style={{ position: "absolute", right: -6, bottom: -4, minWidth: 18, height: 16, borderRadius: 4, background: "#1c8c4c", color: "#fff", fontFamily: theme.font, fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 3px" }}>
              {f < e.filled ? "…" : "9"}
            </span>
            ) : null}
          </>
        )}
        overlays={[
          ...FIELDS.map((id, i) => (f: number) => (
            <RevealCrop key={id} f={f} src={`maru/${ext.shot("ext-after").src}`} box={ext.box(`ext-after.${id}`)} from={e.fill + i * 7} pad={5} flash={C.neon} />
          )),
          (f) => (f >= e.filled ? null : <Glow f={f} box={ext.box("ext-before.form")} from={e.click + 4} to={e.filled} color={C.neon} radius={16} pad={4} />),
        ]}
      />
      <StepCaption theme={theme} n={6} text="Completá la postulación en un clic" sub={fmt === "landscape" ? "con la extensión para Chrome" : "Con la extensión para Chrome"} from={10} to={EXT + 10} />
      {FIELDS.map((_, i) => (
        <Sequence key={i} from={e.fill + i * 7} durationInFrames={10} layout="none">
          <Audio src={staticFile("sfx/pop.wav")} volume={0.18} />
        </Sequence>
      ))}
      {fmt === "portrait" && <Footer />}
    </AbsoluteFill>
  );
};

// ---------- 4. Cierre ----------
const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const fmt = useFormat();
  const t = prog(f, 0, 18, out);
  const b = prog(f, 24, 42, out);
  const frame = Math.floor(f / 8) % 4 === 0 ? "wave" : Math.floor(f / 8) % 4 === 2 ? "wave2" : "talk";
  return (
    <AbsoluteFill>
      <Background theme={theme} glow={C.neon} glow2={C.aqua} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: fmt === "landscape" ? 30 : 44, padding: 60, textAlign: "center" }}>
        <div style={{ opacity: t, transform: `scale(${0.9 + 0.1 * t})` }}>
          <Logo size={fmt === "landscape" ? 92 : 110} />
        </div>
        <div style={{ fontFamily: theme.display, fontWeight: 700, fontSize: fmt === "landscape" ? 72 : 80, lineHeight: 1.05, letterSpacing: "-0.02em", color: C.ink }}>
          <WordsIn text="Encontrá tu próximo trabajo" from={8} />
          {fmt === "portrait" && <br />}
          <WordsIn text="con IA" from={20} highlight={["IA"]} accent={C.forest} />
        </div>
        <div
          style={{
            opacity: b,
            transform: `translateY(${(1 - b) * 20}px)`,
            padding: fmt === "landscape" ? "22px 46px" : "26px 50px",
            borderRadius: 999,
            background: C.ink,
            color: "#fff",
            fontFamily: theme.display,
            fontWeight: 700,
            fontSize: fmt === "landscape" ? 40 : 44,
            letterSpacing: "0.02em",
          }}
        >
          PROBÁ GRATIS EN <span style={{ color: C.neon }}>MARUCOACH.COM</span>
        </div>
        <div style={{ opacity: b, fontFamily: theme.font, fontSize: 28, color: C.muted }}>Sin tarjeta</div>
        <div style={{ opacity: b }}>
          <MaruDesk size={fmt === "landscape" ? 130 : 170} frame={frame} />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 40, right: 40, bottom: fmt === "landscape" ? 26 : 70, textAlign: "center", fontFamily: theme.font, fontSize: 18, color: "rgba(0,0,0,.45)", opacity: b }}>
        La postulante y la empresa del formulario son ficticias. Las búsquedas son reales, del inventario de Maru.
      </div>
    </AbsoluteFill>
  );
};

export const MaruVideo: React.FC = () => {
  const tm = linearTiming({ durationInFrames: T });
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={HOOK}>
          <Hook />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={tm} />
        <TransitionSeries.Sequence durationInFrames={WALK}>
          <Walk />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={tm} />
        <TransitionSeries.Sequence durationInFrames={EXT}>
          <Extension />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={tm} />
        <TransitionSeries.Sequence durationInFrames={OUTRO}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Music file="maru.mp3" />
    </AbsoluteFill>
  );
};
