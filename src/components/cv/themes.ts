import type { CSSProperties } from "react";
import type { CvStyle, Density, FontPairId, SectionKey, TemplateId, TextSize } from "@/lib/schemas";

/**
 * Todos los templates comparten estructura (una columna, texto real, títulos convencionales),
 * así que todos son ATS-friendly; cambian tipografía, color, encabezado, títulos y ritmo.
 * Los estilos son inline para que el PDF exportado sea idéntico a la vista previa.
 *
 * Cada template se arma a partir de un color de acento y un par tipográfico, así la persona
 * puede cambiar ambos sin romper el diseño.
 */
export type Categoria = "clasico" | "moderno" | "ejecutivo" | "minimal" | "creativo";

export type Theme = {
  id: TemplateId;
  nombre: string;
  ideal: string;
  categoria: Categoria;
  /** Fuentes del PDF/preview y su equivalente estándar en Word. */
  font: string;
  headFont: string;
  docx: { body: string; head: string };
  accent: string;
  text: string;
  muted: string;
  padX: number;
  padY: number;
  order: SectionKey[];
  header: CSSProperties;
  name: CSSProperties;
  titular: CSSProperties;
  contact: CSSProperties;
  /** Color de los separadores de contacto (por defecto, `muted`). */
  contactSep?: string;
  sectionGap: number;
  sectionTitle: CSSProperties;
  /** El título ocupa sólo su texto (estilo "pastilla") en lugar de todo el ancho. */
  titleInline?: boolean;
  body: CSSProperties;
  role: CSSProperties;
  company: CSSProperties;
  date: CSSProperties;
  bulletMarker: string;
  summaryBox?: CSSProperties;
  /** Muestra el bloque de logros clave arriba (templates ejecutivos). */
  keyAchievements: boolean;
};

/* ---------- tipografías (las tres se embeben en el PDF; ver lib/fonts.ts) ---------- */

const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const SANS3 = "'Source Sans 3', Arial, Helvetica, sans-serif";
const INTER = "Inter, Arial, Helvetica, sans-serif";

export const FONT_PAIRS: Record<FontPairId, { label: string; hint: string; body: string; head: string; docx: { body: string; head: string } }> = {
  sans: { label: "Moderna", hint: "Inter", body: INTER, head: INTER, docx: { body: "Arial", head: "Arial" } },
  "serif-clasica": { label: "Clásica", hint: "Títulos con serif", body: SANS3, head: SERIF, docx: { body: "Arial", head: "Georgia" } },
  serif: { label: "Elegante", hint: "Todo con serif", body: SERIF, head: SERIF, docx: { body: "Georgia", head: "Georgia" } },
  humanista: { label: "Humanista", hint: "Source Sans", body: SANS3, head: SANS3, docx: { body: "Calibri", head: "Calibri" } },
};

export const ACCENTS: { name: string; hex: string }[] = [
  { name: "Grafito", hex: "#1f1f1f" },
  { name: "Azul marino", hex: "#1e3a5f" },
  { name: "Azul", hex: "#3b5bdb" },
  { name: "Petróleo", hex: "#0e7490" },
  { name: "Verde", hex: "#2f6f62" },
  { name: "Violeta", hex: "#6741d9" },
  { name: "Bordó", hex: "#a23e48" },
  { name: "Terracota", hex: "#c0623a" },
  { name: "Naranja", hex: "#c2410c" },
  { name: "Dorado", hex: "#8a6d3b" },
];

export const CATEGORIES: { id: Categoria; label: string }[] = [
  { id: "clasico", label: "Clásicos" },
  { id: "moderno", label: "Modernos" },
  { id: "ejecutivo", label: "Ejecutivos" },
  { id: "minimal", label: "Minimalistas" },
  { id: "creativo", label: "Creativos" },
];

/* ---------- colores ---------- */

const HEX = /^#[0-9a-f]{6}$/i;

/** Mezcla un color con blanco: t=0 es el color, t=1 es blanco. */
function mix(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - t) + 255 * t);
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

type Ctx = { accent: string; soft: string; tint: string; ink: string; muted: string };

type Parts = Omit<Theme, "id" | "nombre" | "ideal" | "categoria" | "font" | "headFont" | "docx" | "accent" | "text" | "muted" | "keyAchievements" | "order"> & {
  order?: SectionKey[];
};

type Def = {
  id: TemplateId;
  nombre: string;
  ideal: string;
  categoria: Categoria;
  accent: string;
  fonts: FontPairId;
  ink?: string;
  muted?: string;
  keyAchievements?: boolean;
  build: (c: Ctx) => Parts;
};

const STD_ORDER: SectionKey[] = ["resumen", "logrosClave", "experiencia", "educacion", "habilidades", "idiomas", "certificaciones"];
const SKILLS_FIRST: SectionKey[] = ["resumen", "logrosClave", "habilidades", "experiencia", "educacion", "idiomas", "certificaciones"];

const caps = (fontSize: number, letterSpacing: string, fontWeight = 700): CSSProperties => ({
  fontSize,
  fontWeight,
  letterSpacing,
  textTransform: "uppercase",
});

/* ---------- la galería ---------- */

const DEFS: Def[] = [
  /* ===== Clásicos ===== */
  {
    id: "clasico",
    nombre: "Clásico",
    ideal: "Corporativos, finanzas, consultoría",
    categoria: "clasico",
    accent: "#1f1f1f",
    fonts: "serif-clasica",
    build: (c) => ({
      padX: 60,
      padY: 52,
      header: { textAlign: "center" },
      name: { fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15 },
      titular: { fontSize: 14.5, color: "#3d3d3d", marginTop: 4 },
      contact: { fontSize: 12, color: c.muted, marginTop: 8 },
      sectionGap: 18,
      sectionTitle: { ...caps(14, "0.04em", 600), borderBottom: `1px solid ${c.accent}`, paddingBottom: 3, marginBottom: 8 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { fontStyle: "italic" },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "harvard",
    nombre: "Harvard",
    ideal: "Académico, legal, consultoría estratégica",
    categoria: "clasico",
    accent: "#1f1f1f",
    fonts: "serif",
    build: (c) => ({
      padX: 64,
      padY: 54,
      header: { textAlign: "center" },
      name: { fontSize: 25, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", lineHeight: 1.2 },
      titular: { fontSize: 13.5, fontStyle: "italic", color: c.ink, marginTop: 4 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 7 },
      sectionGap: 16,
      sectionTitle: { ...caps(12.5, "0.08em", 600), borderBottom: `1px solid ${c.accent}`, paddingBottom: 2, marginBottom: 7 },
      body: { fontSize: 12.5, lineHeight: 1.45 },
      role: { fontWeight: 600 },
      company: { fontStyle: "italic" },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "banca",
    nombre: "Banca",
    ideal: "Bancos, finanzas, seguros",
    categoria: "clasico",
    accent: "#1e3a5f",
    fonts: "serif-clasica",
    build: (c) => ({
      padX: 58,
      padY: 50,
      header: { textAlign: "left", borderBottom: `3px solid ${c.accent}`, paddingBottom: 12 },
      name: { fontSize: 28, fontWeight: 600, color: c.accent, lineHeight: 1.15 },
      titular: { fontSize: 13.5, color: c.ink, marginTop: 4 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 7 },
      sectionGap: 17,
      sectionTitle: { ...caps(12.5, "0.06em"), color: c.accent, borderBottom: `1px solid ${c.tint}`, paddingBottom: 3, marginBottom: 7 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { color: c.accent },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "consultor",
    nombre: "Consultor",
    ideal: "Consultoría, auditoría, management",
    categoria: "clasico",
    accent: "#7a2e2e",
    fonts: "serif-clasica",
    build: (c) => ({
      padX: 58,
      padY: 50,
      header: { textAlign: "left" },
      name: { fontSize: 28, fontWeight: 600, lineHeight: 1.15 },
      titular: { fontSize: 14, fontWeight: 600, color: c.accent, marginTop: 4 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 7 },
      sectionGap: 18,
      sectionTitle: { fontSize: 14.5, fontWeight: 600, borderLeft: `3px solid ${c.accent}`, paddingLeft: 9, marginBottom: 7 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { color: c.muted },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "›",
    }),
  },
  {
    id: "tradicional",
    nombre: "Tradicional",
    ideal: "Legal, sector público, educación",
    categoria: "clasico",
    accent: "#333333",
    fonts: "serif",
    build: (c) => ({
      padX: 62,
      padY: 54,
      header: { textAlign: "center" },
      name: { fontSize: 24, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", lineHeight: 1.2 },
      titular: { fontSize: 13, letterSpacing: "0.04em", color: c.muted, marginTop: 5 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 7 },
      sectionGap: 18,
      sectionTitle: {
        ...caps(12, "0.18em", 600),
        textAlign: "center",
        borderTop: `1px solid ${c.accent}`,
        borderBottom: `1px solid ${c.accent}`,
        padding: "3px 0",
        marginBottom: 8,
      },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 600 },
      company: { fontStyle: "italic" },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "sobrio",
    nombre: "Sobrio",
    ideal: "Operaciones, industria, logística",
    categoria: "clasico",
    accent: "#374151",
    fonts: "humanista",
    build: (c) => ({
      padX: 54,
      padY: 44,
      header: { textAlign: "left" },
      name: { fontSize: 27, fontWeight: 700, lineHeight: 1.15 },
      titular: { fontSize: 14, color: c.muted, marginTop: 3 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 6 },
      sectionGap: 14,
      sectionTitle: { ...caps(12.5, "0.1em"), color: c.accent, borderBottom: `2px solid ${c.tint}`, paddingBottom: 3, marginBottom: 6 },
      body: { fontSize: 12, lineHeight: 1.45 },
      role: { fontWeight: 700 },
      company: { color: c.ink },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "•",
    }),
  },

  /* ===== Modernos ===== */
  {
    id: "moderno",
    nombre: "Moderno",
    ideal: "Tech, startups, marketing digital",
    categoria: "moderno",
    accent: "#b4532e",
    fonts: "sans",
    ink: "#22201e",
    muted: "#6b625c",
    build: (c) => ({
      padX: 56,
      padY: 48,
      order: SKILLS_FIRST,
      header: { textAlign: "left" },
      name: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
      titular: { fontSize: 14, fontWeight: 600, color: c.accent, marginTop: 5 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 18,
      sectionTitle: { ...caps(11, "0.14em"), color: c.accent, borderBottom: `1px solid ${c.tint}`, paddingBottom: 4, marginBottom: 8 },
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 600 },
      company: { color: c.ink },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "startup",
    nombre: "Startup",
    ideal: "Startups, scale-ups, growth",
    categoria: "moderno",
    accent: "#2f6f62",
    fonts: "sans",
    build: (c) => ({
      padX: 56,
      padY: 48,
      order: SKILLS_FIRST,
      header: { textAlign: "left" },
      name: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.05 },
      titular: { fontSize: 14, fontWeight: 600, color: c.accent, marginTop: 6 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 18,
      sectionTitle: { ...caps(10.5, "0.12em"), color: c.accent, background: c.soft, padding: "3px 10px", borderRadius: 999, marginBottom: 8 },
      titleInline: true,
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 600 },
      company: { color: c.ink },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "tech",
    nombre: "Tech",
    ideal: "Software, datos, ingeniería",
    categoria: "moderno",
    accent: "#3b5bdb",
    fonts: "sans",
    build: (c) => ({
      padX: 54,
      padY: 46,
      order: SKILLS_FIRST,
      header: { textAlign: "left" },
      name: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
      titular: { fontSize: 13.5, fontWeight: 500, color: c.accent, marginTop: 5 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 17,
      sectionTitle: { ...caps(11, "0.14em"), color: c.accent, borderBottom: `1px dashed ${c.tint}`, paddingBottom: 4, marginBottom: 7 },
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 600 },
      company: { color: c.accent },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "›",
    }),
  },
  {
    id: "producto",
    nombre: "Producto",
    ideal: "Product management, UX research",
    categoria: "moderno",
    accent: "#6741d9",
    fonts: "sans",
    build: (c) => ({
      padX: 56,
      padY: 48,
      header: { textAlign: "left", borderBottom: `4px solid ${c.accent}`, paddingBottom: 14 },
      name: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
      titular: { fontSize: 14, fontWeight: 500, color: c.accent, marginTop: 5 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 18,
      sectionTitle: { fontSize: 13.5, fontWeight: 700, color: c.accent, marginBottom: 6 },
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 600 },
      company: { color: c.ink },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "marketing",
    nombre: "Marketing",
    ideal: "Marketing, ventas, comunicación",
    categoria: "moderno",
    accent: "#c2410c",
    fonts: "sans",
    build: (c) => ({
      padX: 52,
      padY: 44,
      header: { textAlign: "left", background: c.accent, color: "#ffffff", padding: "22px 26px", borderRadius: 6 },
      name: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
      titular: { fontSize: 14, fontWeight: 600, color: "#ffffff", marginTop: 5 },
      contact: { fontSize: 11.5, color: "#ffffff", marginTop: 8 },
      contactSep: "#ffffff",
      sectionGap: 18,
      sectionTitle: { ...caps(11, "0.14em"), color: c.accent, borderBottom: `1px solid ${c.tint}`, paddingBottom: 4, marginBottom: 8 },
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 600 },
      company: { color: c.ink },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "fresco",
    nombre: "Fresco",
    ideal: "Salud, educación, ONGs",
    categoria: "moderno",
    accent: "#0e7490",
    fonts: "humanista",
    build: (c) => ({
      padX: 54,
      padY: 46,
      header: { textAlign: "left" },
      name: { fontSize: 28, fontWeight: 700, color: c.accent, lineHeight: 1.1 },
      titular: { fontSize: 14, fontWeight: 600, color: c.ink, marginTop: 5 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 16,
      sectionTitle: { ...caps(12, "0.08em"), color: c.accent, background: c.soft, borderLeft: `3px solid ${c.accent}`, padding: "4px 10px", marginBottom: 7 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { color: c.ink },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "•",
    }),
  },

  /* ===== Ejecutivos ===== */
  {
    id: "ejecutivo",
    nombre: "Ejecutivo",
    ideal: "Roles senior y de dirección",
    categoria: "ejecutivo",
    accent: "#2b2420",
    fonts: "humanista",
    ink: "#1e1b19",
    muted: "#5f5650",
    keyAchievements: true,
    build: (c) => ({
      padX: 56,
      padY: 48,
      header: { textAlign: "left", borderBottom: `2px solid ${c.accent}`, paddingBottom: 12 },
      name: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1 },
      titular: { ...caps(13, "0.08em", 600), color: c.muted, marginTop: 6 },
      contact: { fontSize: 12, color: c.muted, marginTop: 8 },
      sectionGap: 16,
      sectionTitle: { ...caps(13.5, "0.06em"), marginBottom: 6 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { fontWeight: 600, color: c.muted },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "▸",
      summaryBox: { background: mix(c.accent, 0.92), padding: "10px 14px", borderRadius: 2 },
    }),
  },
  {
    id: "director",
    nombre: "Director",
    ideal: "C-level, gerencia general, directorios",
    categoria: "ejecutivo",
    accent: "#1e3a5f",
    fonts: "humanista",
    keyAchievements: true,
    build: (c) => ({
      padX: 54,
      padY: 46,
      header: { textAlign: "left", background: c.accent, color: "#ffffff", padding: "24px 28px", borderRadius: 4 },
      name: { fontSize: 30, fontWeight: 700, lineHeight: 1.1 },
      titular: { ...caps(12.5, "0.1em", 600), color: "#ffffff", marginTop: 6 },
      contact: { fontSize: 11.5, color: "#ffffff", marginTop: 9 },
      contactSep: "#ffffff",
      sectionGap: 16,
      sectionTitle: { ...caps(13, "0.06em"), color: c.accent, borderBottom: `2px solid ${c.accent}`, paddingBottom: 3, marginBottom: 7 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { fontWeight: 600, color: c.accent },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "▸",
      summaryBox: { background: c.soft, padding: "10px 14px", borderRadius: 2 },
    }),
  },
  {
    id: "board",
    nombre: "Board",
    ideal: "Alta dirección, banca de inversión",
    categoria: "ejecutivo",
    accent: "#222222",
    fonts: "serif-clasica",
    keyAchievements: true,
    build: (c) => ({
      padX: 60,
      padY: 52,
      header: { textAlign: "center" },
      name: { fontSize: 32, fontWeight: 600, lineHeight: 1.1 },
      titular: { ...caps(12.5, "0.16em", 400), color: c.muted, marginTop: 7 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 17,
      sectionTitle: { ...caps(14, "0.05em", 600), borderBottom: `3px double ${c.accent}`, paddingBottom: 3, marginBottom: 8 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { fontStyle: "italic" },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "•",
      summaryBox: { borderLeft: `3px solid ${c.accent}`, paddingLeft: 12 },
    }),
  },
  {
    id: "gerencial",
    nombre: "Gerencial",
    ideal: "Gerencias comerciales y de área",
    categoria: "ejecutivo",
    accent: "#9e4d2b",
    fonts: "sans",
    keyAchievements: true,
    build: (c) => ({
      padX: 56,
      padY: 48,
      header: { textAlign: "left", borderBottom: `1px solid ${c.tint}`, paddingBottom: 12 },
      name: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
      titular: { ...caps(13, "0.08em", 600), color: c.accent, marginTop: 6 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 17,
      sectionTitle: { ...caps(12, "0.1em"), borderTop: `2px solid ${c.accent}`, paddingTop: 5, marginBottom: 7 },
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 700 },
      company: { fontWeight: 600, color: c.accent },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "▸",
      summaryBox: { background: c.soft, padding: "10px 14px", borderRadius: 4 },
    }),
  },

  /* ===== Minimalistas ===== */
  {
    id: "minimal",
    nombre: "Minimal",
    ideal: "Diseño, producto, UX",
    categoria: "minimal",
    accent: "#8a8079",
    fonts: "sans",
    ink: "#2a2725",
    muted: "#8a8079",
    build: (c) => ({
      padX: 72,
      padY: 64,
      header: { textAlign: "left" },
      name: { fontSize: 30, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1 },
      titular: { fontSize: 13.5, fontWeight: 400, color: "#5a5450", marginTop: 6 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 10 },
      sectionGap: 26,
      sectionTitle: { ...caps(10, "0.24em", 500), color: c.accent, marginBottom: 10 },
      body: { fontSize: 12, lineHeight: 1.65, fontWeight: 300 },
      role: { fontWeight: 500 },
      company: { color: "#5a5450" },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "–",
    }),
  },
  {
    id: "nordico",
    nombre: "Nórdico",
    ideal: "Investigación, sustentabilidad, educación",
    categoria: "minimal",
    accent: "#4b5563",
    fonts: "sans",
    build: (c) => ({
      padX: 70,
      padY: 60,
      header: { textAlign: "left" },
      name: { fontSize: 28, fontWeight: 300, letterSpacing: "-0.01em", lineHeight: 1.15 },
      titular: { fontSize: 13, color: c.muted, marginTop: 6 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 9 },
      sectionGap: 24,
      sectionTitle: { fontSize: 11.5, fontWeight: 500, letterSpacing: "0.08em", color: c.accent, borderBottom: `1px solid ${c.tint}`, paddingBottom: 4, marginBottom: 8 },
      body: { fontSize: 12, lineHeight: 1.6, fontWeight: 300 },
      role: { fontWeight: 500 },
      company: { color: c.muted },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "·",
    }),
  },
  {
    id: "suizo",
    nombre: "Suizo",
    ideal: "Diseño, arquitectura, agencias",
    categoria: "minimal",
    accent: "#111111",
    fonts: "sans",
    build: (c) => ({
      padX: 60,
      padY: 54,
      header: { textAlign: "left" },
      name: { fontSize: 36, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1 },
      titular: { fontSize: 15, color: c.ink, marginTop: 8 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 10 },
      sectionGap: 22,
      sectionTitle: { fontSize: 12, fontWeight: 700, color: c.ink, marginBottom: 6 },
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 700 },
      company: { color: c.muted },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "—",
    }),
  },
  {
    id: "aire",
    nombre: "Aire",
    ideal: "Moda, hospitalidad, lifestyle",
    categoria: "minimal",
    accent: "#9a8478",
    fonts: "serif-clasica",
    build: (c) => ({
      padX: 76,
      padY: 64,
      header: { textAlign: "center" },
      name: { fontSize: 30, fontWeight: 400, letterSpacing: "0.02em", lineHeight: 1.15 },
      titular: { fontSize: 13, color: c.muted, marginTop: 6 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 9 },
      sectionGap: 26,
      sectionTitle: { ...caps(10, "0.3em", 500), textAlign: "center", color: c.accent, marginBottom: 10 },
      body: { fontSize: 12, lineHeight: 1.7 },
      role: { fontWeight: 600 },
      company: { color: c.muted },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "·",
    }),
  },

  /* ===== Creativos ===== */
  {
    id: "editorial",
    nombre: "Editorial",
    ideal: "Contenido, periodismo, cultura",
    categoria: "creativo",
    accent: "#a23e48",
    fonts: "serif-clasica",
    build: (c) => ({
      padX: 60,
      padY: 52,
      header: { textAlign: "left" },
      name: { fontSize: 34, fontWeight: 600, lineHeight: 1.05 },
      titular: { fontSize: 15, fontStyle: "italic", color: c.accent, marginTop: 6 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 9 },
      sectionGap: 18,
      sectionTitle: { fontSize: 16, fontWeight: 600, color: c.accent, borderBottom: `1px solid ${c.tint}`, paddingBottom: 3, marginBottom: 7 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { fontStyle: "italic" },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "–",
    }),
  },
  {
    id: "calidez",
    nombre: "Calidez",
    ideal: "Personas, RR.HH., atención al cliente",
    categoria: "creativo",
    accent: "#c0623a",
    fonts: "sans",
    build: (c) => ({
      padX: 52,
      padY: 44,
      header: { textAlign: "left", background: c.soft, padding: "22px 26px", borderRadius: 10 },
      name: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
      titular: { fontSize: 14, fontWeight: 600, color: c.accent, marginTop: 5 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 18,
      sectionTitle: { ...caps(10.5, "0.12em"), color: "#ffffff", background: c.accent, padding: "3px 10px", borderRadius: 999, marginBottom: 8 },
      titleInline: true,
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 600 },
      company: { color: c.ink },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "•",
    }),
  },
  {
    id: "bloque",
    nombre: "Bloque",
    ideal: "Ingeniería, construcción, energía",
    categoria: "creativo",
    accent: "#334155",
    fonts: "humanista",
    build: (c) => ({
      padX: 54,
      padY: 46,
      header: { textAlign: "left" },
      name: { fontSize: 30, fontWeight: 700, lineHeight: 1.1 },
      titular: { fontSize: 14, color: c.muted, marginTop: 5 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 16,
      sectionTitle: { ...caps(12, "0.1em"), color: "#ffffff", background: c.accent, padding: "4px 10px", marginBottom: 7 },
      body: { fontSize: 12.5, lineHeight: 1.5 },
      role: { fontWeight: 700 },
      company: { color: c.accent },
      date: { fontSize: 12, color: c.muted },
      bulletMarker: "▸",
    }),
  },
  {
    id: "acento",
    nombre: "Acento",
    ideal: "Branding, eventos, industrias creativas",
    categoria: "creativo",
    accent: "#be185d",
    fonts: "sans",
    build: (c) => ({
      padX: 56,
      padY: 48,
      header: { textAlign: "left" },
      name: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: c.accent, lineHeight: 1.1 },
      titular: { fontSize: 14, fontWeight: 500, color: c.ink, marginTop: 5 },
      contact: { fontSize: 11.5, color: c.muted, marginTop: 8 },
      sectionGap: 18,
      sectionTitle: { ...caps(12, "0.1em"), borderBottom: `2px solid ${c.accent}`, paddingBottom: 3, marginBottom: 7 },
      body: { fontSize: 12, lineHeight: 1.55 },
      role: { fontWeight: 600 },
      company: { color: c.accent },
      date: { fontSize: 11.5, color: c.muted },
      bulletMarker: "•",
    }),
  },
];

export const TEMPLATES: { id: TemplateId; nombre: string; ideal: string; categoria: Categoria; accent: string; fonts: FontPairId }[] = DEFS.map(
  ({ id, nombre, ideal, categoria, accent, fonts }) => ({ id, nombre, ideal, categoria, accent, fonts }),
);

const BY_ID = new Map(DEFS.map((d) => [d.id, d]));

export function isTemplate(id: string): boolean {
  return BY_ID.has(id);
}

export function templateDefaults(id: TemplateId): { accent: string; fonts: FontPairId; keyAchievements: boolean } {
  const d = BY_ID.get(id) ?? DEFS[0];
  return { accent: d.accent, fonts: d.fonts, keyAchievements: !!d.keyAchievements };
}

/* ---------- densidad y tamaño ---------- */

const DENSITY: Record<Density, { gap: number; pad: number; line: number }> = {
  compacto: { gap: 0.72, pad: 0.82, line: -0.08 },
  normal: { gap: 1, pad: 1, line: 0 },
  amplio: { gap: 1.25, pad: 1.1, line: 0.08 },
};
const SIZE: Record<TextSize, number> = { chico: 0.93, normal: 1, grande: 1.07 };

function scaled(style: CSSProperties, k: number): CSSProperties {
  return typeof style.fontSize === "number" && k !== 1 ? { ...style, fontSize: Math.round(style.fontSize * k * 4) / 4 } : style;
}

/** El tema final: template + acento, tipografía, densidad, tamaño y orden elegidos por la persona. */
export function themeFor(id: TemplateId, style?: CvStyle): Theme {
  const def = BY_ID.get(id) ?? DEFS[0];
  const accent = style?.accent && HEX.test(style.accent) ? style.accent : def.accent;
  const fontId = style?.fonts && FONT_PAIRS[style.fonts] ? style.fonts : def.fonts;
  const fonts = FONT_PAIRS[fontId];
  const ink = def.ink ?? "#1f1f1f";
  const muted = def.muted ?? "#5c5c5c";
  const parts = def.build({ accent, soft: mix(accent, 0.9), tint: mix(accent, 0.72), ink, muted });

  const dens = DENSITY[style?.density ?? "normal"];
  const k = SIZE[style?.size ?? "normal"];
  const lh = typeof parts.body.lineHeight === "number" ? parts.body.lineHeight + dens.line : parts.body.lineHeight;

  return {
    ...parts,
    id: def.id,
    nombre: def.nombre,
    ideal: def.ideal,
    categoria: def.categoria,
    font: fonts.body,
    headFont: fonts.head,
    docx: fonts.docx,
    accent,
    text: ink,
    muted,
    keyAchievements: !!def.keyAchievements,
    order: style?.order?.length ? style.order : (parts.order ?? STD_ORDER),
    padY: Math.round(parts.padY * dens.pad),
    sectionGap: Math.round(parts.sectionGap * dens.gap),
    name: scaled(parts.name, k),
    titular: scaled(parts.titular, k),
    contact: scaled(parts.contact, k),
    sectionTitle: scaled(parts.sectionTitle, k),
    body: { ...scaled(parts.body, k), lineHeight: lh },
    date: scaled(parts.date, k),
  };
}

export function resolveTheme(doc: { template: TemplateId; style?: CvStyle }): Theme {
  return themeFor(doc.template, doc.style);
}
