import type { CSSProperties } from "react";
import type { SectionKey, TemplateId } from "@/lib/schemas";

/**
 * Los 4 templates comparten estructura (una columna, texto real, títulos convencionales)
 * y sólo cambian tipografía, color y ritmo. Todo con estilos inline para que el HTML
 * exportado a PDF sea idéntico a la vista previa.
 */
export type Theme = {
  id: TemplateId;
  nombre: string;
  ideal: string;
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
  sectionGap: number;
  sectionTitle: CSSProperties;
  body: CSSProperties;
  role: CSSProperties;
  company: CSSProperties;
  date: CSSProperties;
  bulletMarker: string;
  summaryBox?: CSSProperties;
};

const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const SANS3 = "'Source Sans 3', Arial, Helvetica, sans-serif";
const INTER = "Inter, Arial, Helvetica, sans-serif";

const STD_ORDER: SectionKey[] = ["resumen", "logrosClave", "experiencia", "educacion", "habilidades", "idiomas", "certificaciones"];

export const THEMES: Record<TemplateId, Theme> = {
  clasico: {
    id: "clasico",
    nombre: "Clásico",
    ideal: "Corporativos, finanzas, consultoría",
    font: SANS3,
    headFont: SERIF,
    docx: { body: "Arial", head: "Georgia" },
    accent: "#1f1f1f",
    text: "#1f1f1f",
    muted: "#5c5c5c",
    padX: 60,
    padY: 52,
    order: STD_ORDER,
    header: { textAlign: "center" },
    name: { fontFamily: SERIF, fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.15 },
    titular: { fontSize: 14.5, color: "#3d3d3d", marginTop: 4 },
    contact: { fontSize: 12, color: "#5c5c5c", marginTop: 8 },
    sectionGap: 18,
    sectionTitle: {
      fontFamily: SERIF,
      fontSize: 14,
      fontWeight: 600,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      borderBottom: "1px solid #1f1f1f",
      paddingBottom: 3,
      marginBottom: 8,
    },
    body: { fontSize: 12.5, lineHeight: 1.5 },
    role: { fontWeight: 700 },
    company: { fontStyle: "italic" },
    date: { fontSize: 12, color: "#5c5c5c" },
    bulletMarker: "•",
  },
  moderno: {
    id: "moderno",
    nombre: "Moderno",
    ideal: "Tech, startups, marketing digital",
    font: INTER,
    headFont: INTER,
    docx: { body: "Arial", head: "Arial" },
    accent: "#b4532e",
    text: "#22201e",
    muted: "#6b625c",
    padX: 56,
    padY: 48,
    order: ["resumen", "logrosClave", "habilidades", "experiencia", "educacion", "idiomas", "certificaciones"],
    header: { textAlign: "left" },
    name: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 },
    titular: { fontSize: 14, fontWeight: 600, color: "#b4532e", marginTop: 5 },
    contact: { fontSize: 11.5, color: "#6b625c", marginTop: 8 },
    sectionGap: 18,
    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "#b4532e",
      borderBottom: "1px solid #ead9cc",
      paddingBottom: 4,
      marginBottom: 8,
    },
    body: { fontSize: 12, lineHeight: 1.55 },
    role: { fontWeight: 600 },
    company: { color: "#22201e" },
    date: { fontSize: 11.5, color: "#6b625c" },
    bulletMarker: "•",
  },
  ejecutivo: {
    id: "ejecutivo",
    nombre: "Ejecutivo",
    ideal: "Roles senior y de dirección",
    font: SANS3,
    headFont: SANS3,
    docx: { body: "Calibri", head: "Calibri" },
    accent: "#2b2420",
    text: "#1e1b19",
    muted: "#5f5650",
    padX: 56,
    padY: 48,
    order: STD_ORDER,
    header: { textAlign: "left", borderBottom: "2px solid #2b2420", paddingBottom: 12 },
    name: { fontSize: 30, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.1 },
    titular: { fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5f5650", marginTop: 6 },
    contact: { fontSize: 12, color: "#5f5650", marginTop: 8 },
    sectionGap: 16,
    sectionTitle: { fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 },
    body: { fontSize: 12.5, lineHeight: 1.5 },
    role: { fontWeight: 700 },
    company: { fontWeight: 600, color: "#5f5650" },
    date: { fontSize: 12, color: "#5f5650" },
    bulletMarker: "▸",
    summaryBox: { background: "#f5ede5", padding: "10px 14px", borderRadius: 2 },
  },
  minimal: {
    id: "minimal",
    nombre: "Minimal",
    ideal: "Diseño, producto, UX",
    font: INTER,
    headFont: INTER,
    docx: { body: "Arial", head: "Arial" },
    accent: "#8a8079",
    text: "#2a2725",
    muted: "#8a8079",
    padX: 72,
    padY: 64,
    order: STD_ORDER,
    header: { textAlign: "left" },
    name: { fontSize: 30, fontWeight: 300, letterSpacing: "-0.02em", lineHeight: 1.1 },
    titular: { fontSize: 13.5, fontWeight: 400, color: "#5a5450", marginTop: 6 },
    contact: { fontSize: 11.5, color: "#8a8079", marginTop: 10 },
    sectionGap: 26,
    sectionTitle: { fontSize: 10, fontWeight: 500, letterSpacing: "0.24em", textTransform: "uppercase", color: "#8a8079", marginBottom: 10 },
    body: { fontSize: 12, lineHeight: 1.65, fontWeight: 300 },
    role: { fontWeight: 500 },
    company: { color: "#5a5450" },
    date: { fontSize: 11.5, color: "#8a8079" },
    bulletMarker: "–",
  },
};
