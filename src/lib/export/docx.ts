import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Paragraph,
  ShadingType,
  TabStopType,
  TextRun,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  type IParagraphOptions,
} from "docx";
import { resolveTheme } from "@/components/cv/themes";
import { contactLine, visible } from "../cv";
import type { CvDoc, Item, SectionKey } from "../schemas";

const PAGE_W = 11906; // A4 en twips
const PX = 15; // 1px CSS ≈ 15 twips
const hp = (px: number) => Math.round(px * 1.5); // px CSS → medios puntos de Word (12px ≈ 9pt ≈ 18)
const hex = (c: string) => c.replace("#", "");

/** "1px solid #abcdef" → borde de Word. */
function border(css: unknown): { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string; space: number } | undefined {
  const m = /([\d.]+)px\s+(solid|dashed|dotted|double)\s+(#[0-9a-f]{6})/i.exec(String(css ?? ""));
  if (!m) return undefined;
  const style = { solid: BorderStyle.SINGLE, dashed: BorderStyle.DASHED, dotted: BorderStyle.DOTTED, double: BorderStyle.DOUBLE }[m[2].toLowerCase() as "solid"];
  return { style, size: Math.max(4, Math.round(Number(m[1]) * 6)), color: hex(m[3]), space: 3 };
}

const fill = (bg: unknown) => (typeof bg === "string" && /^#[0-9a-f]{6}$/i.test(bg) ? { type: ShadingType.CLEAR, fill: hex(bg), color: "auto" } : undefined);

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** DOCX con el mismo contenido y orden que la vista previa, en fuentes estándar de Word. Se arma en el servidor. */
export function buildCvDocx(doc: CvDoc): Document {
  const t = resolveTheme(doc);
  const font = t.docx.body;
  const headFont = t.docx.head;
  const size = hp(Number(t.body.fontSize ?? 12));
  const margin = t.padX * PX;
  const rightTab = PAGE_W - margin * 2;
  const text = hex(t.text);
  const muted = hex(t.muted);
  const accent = hex(t.accent);
  const upper = (s: string, style: { textTransform?: string }) => (style.textTransform === "uppercase" ? s.toUpperCase() : s);

  const children: Paragraph[] = [];
  const p = (opts: IParagraphOptions) => children.push(new Paragraph(opts));

  // Encabezado
  const centered = t.header.textAlign === "center";
  const align = centered ? AlignmentType.CENTER : AlignmentType.LEFT;
  const photo =
    doc.showPhoto && doc.photo
      ? new ImageRun({
          type: doc.photo.dataUrl.startsWith("data:image/png") ? "png" : "jpg",
          data: dataUrlToBytes(doc.photo.dataUrl),
          transformation: { width: 88, height: 88 },
          ...(centered
            ? {}
            : {
                floating: {
                  horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, align: "right" as const },
                  verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
                  wrap: { type: TextWrappingType.SQUARE },
                },
              }),
        })
      : null;
  if (photo && centered) p({ alignment: AlignmentType.CENTER, children: [photo], spacing: { after: 120 } });

  // Encabezados con fondo de color (templates "banda"): sombreado en los párrafos del encabezado.
  const band = fill(t.header.background);
  const headerColor = band && typeof t.header.color === "string" ? hex(t.header.color) : null;
  const nameColor = headerColor ?? hex(String(t.name.color ?? t.text));
  p({
    alignment: align,
    shading: band,
    spacing: band ? { before: 0 } : undefined,
    children: [
      ...(photo && !centered ? [photo] : []),
      new TextRun({ text: doc.nombre, font: headFont, size: hp(Number(t.name.fontSize)), bold: Number(t.name.fontWeight) >= 600, color: nameColor }),
    ],
  });
  if (doc.titular)
    p({
      alignment: align,
      shading: band,
      spacing: { before: band ? 0 : 60 },
      children: [
        new TextRun({
          text: upper(doc.titular, t.titular as { textTransform?: string }),
          font,
          size: hp(Number(t.titular.fontSize)),
          bold: Number(t.titular.fontWeight ?? 400) >= 600,
          color: headerColor ?? hex(String(t.titular.color ?? t.text)),
        }),
      ],
    });
  const contact = contactLine(doc);
  if (contact.length)
    p({
      alignment: align,
      shading: band,
      spacing: { before: band ? 0 : 100, after: 80 },
      children: [new TextRun({ text: contact.join("  |  "), font, size: hp(Number(t.contact.fontSize)), color: headerColor ?? muted })],
      border: border(t.header.borderBottom) ? { bottom: { ...border(t.header.borderBottom)!, space: 6 } } : undefined,
    });

  const title = (key: SectionKey) => {
    const st = t.sectionTitle;
    const bottom = border(st.borderBottom);
    const top = border(st.borderTop);
    const left = border(st.borderLeft);
    p({
      spacing: { before: t.sectionGap * PX, after: 100 },
      keepNext: true,
      alignment: st.textAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
      shading: fill(st.background),
      border: bottom || top || left ? { bottom, top, left: left ? { ...left, space: 6 } : undefined } : undefined,
      children: [
        new TextRun({
          text: upper(doc.titulos[key], st as { textTransform?: string }),
          font: headFont,
          size: hp(Number(st.fontSize)),
          bold: Number(st.fontWeight ?? 400) >= 600,
          color: hex(String(st.color ?? t.text)),
          characterSpacing: st.letterSpacing ? Math.round(parseFloat(String(st.letterSpacing)) * Number(st.fontSize) * PX) : undefined,
        }),
      ],
    });
  };

  const bullets = (items: Item[]) =>
    items
      .filter((b) => b.text.trim())
      .forEach((b) =>
        p({
          indent: { left: 240, hanging: 240 },
          spacing: { before: 40 },
          children: [new TextRun({ text: `${t.bulletMarker}\t`, font, size, color: accent }), new TextRun({ text: b.text, font, size, color: text })],
          tabStops: [{ type: TabStopType.LEFT, position: 240 }],
        }),
      );

  const sections: Record<SectionKey, () => void> = {
    resumen: () => {
      title("resumen");
      p({
        children: [new TextRun({ text: doc.resumen, font, size, color: text })],
        shading: fill(t.summaryBox?.background),
        border: border(t.summaryBox?.borderLeft) ? { left: { ...border(t.summaryBox?.borderLeft)!, space: 8 } } : undefined,
      });
    },
    logrosClave: () => {
      title("logrosClave");
      bullets(doc.logrosClave);
    },
    experiencia: () => {
      title("experiencia");
      doc.experiencia.forEach((e, i) => {
        p({
          spacing: { before: i === 0 ? 40 : 200 },
          keepNext: true,
          tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
          children: [
            new TextRun({ text: e.cargo, font, size, bold: true, color: text }),
            new TextRun({ text: " · ", font, size, color: muted }),
            new TextRun({ text: e.empresa, font, size, italics: t.company.fontStyle === "italic", color: hex(String(t.company.color ?? t.text)) }),
            new TextRun({ text: `\t${e.periodo}`, font, size: size - 1, color: muted }),
          ],
        });
        if (e.ubicacion) p({ keepNext: true, children: [new TextRun({ text: e.ubicacion, font, size: size - 1, color: muted })] });
        bullets(e.bullets);
      });
    },
    educacion: () => {
      title("educacion");
      doc.educacion.forEach((ed) =>
        p({
          spacing: { before: 40 },
          tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
          children: [
            new TextRun({ text: ed.titulo, font, size, bold: true, color: text }),
            new TextRun({ text: ` · ${ed.institucion}`, font, size, color: text }),
            new TextRun({ text: `\t${ed.periodo}`, font, size: size - 1, color: muted }),
          ],
        }),
      );
    },
    habilidades: () => {
      title("habilidades");
      p({ children: [new TextRun({ text: doc.habilidades, font, size, color: text })] });
    },
    idiomas: () => {
      title("idiomas");
      p({ children: [new TextRun({ text: doc.idiomas, font, size, color: text })] });
    },
    certificaciones: () => {
      title("certificaciones");
      bullets(doc.certificaciones);
    },
  };

  for (const key of t.order) if (visible(doc, key)) sections[key]();

  return new Document({
    creator: "Maru",
    title: `${doc.nombre} — CV`,
    styles: { default: { document: { run: { font, size } } } },
    sections: [
      {
        properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: t.padY * PX, bottom: t.padY * PX, left: margin, right: margin } } },
        children,
      },
    ],
  });
}
