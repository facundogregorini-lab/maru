"use client";

import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  TabStopType,
  TextRun,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  type IParagraphOptions,
} from "docx";
import { THEMES } from "@/components/cv/themes";
import { contactLine, visible } from "../cv";
import type { CvDoc, Item, SectionKey } from "../schemas";
import { downloadBlob } from "./download";

const PAGE_W = 11906; // A4 en twips
const PX = 15; // 1px CSS ≈ 15 twips
const hp = (px: number) => Math.round(px * 1.5); // px CSS → medios puntos de Word (12px ≈ 9pt ≈ 18)
const hex = (c: string) => c.replace("#", "");

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** DOCX con el mismo contenido y orden que la vista previa, en fuentes estándar de Word. */
export async function downloadDocx(doc: CvDoc, filename: string): Promise<void> {
  const t = THEMES[doc.template];
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

  p({
    alignment: align,
    children: [
      ...(photo && !centered ? [photo] : []),
      new TextRun({ text: doc.nombre, font: headFont, size: hp(Number(t.name.fontSize)), bold: Number(t.name.fontWeight) >= 600, color: text }),
    ],
  });
  if (doc.titular)
    p({
      alignment: align,
      spacing: { before: 60 },
      children: [
        new TextRun({
          text: upper(doc.titular, t.titular as { textTransform?: string }),
          font,
          size: hp(Number(t.titular.fontSize)),
          bold: Number(t.titular.fontWeight ?? 400) >= 600,
          color: hex(String(t.titular.color ?? t.text)),
        }),
      ],
    });
  const contact = contactLine(doc);
  if (contact.length)
    p({
      alignment: align,
      spacing: { before: 100, after: 80 },
      children: [new TextRun({ text: contact.join("  |  "), font, size: hp(Number(t.contact.fontSize)), color: muted })],
      border: doc.template === "ejecutivo" ? { bottom: { style: BorderStyle.SINGLE, size: 12, color: accent, space: 6 } } : undefined,
    });

  const title = (key: SectionKey) => {
    const st = t.sectionTitle;
    const ruled = !!st.borderBottom;
    p({
      spacing: { before: t.sectionGap * PX, after: 100 },
      keepNext: true,
      border: ruled ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: doc.template === "moderno" ? "EAD9CC" : text, space: 2 } } : undefined,
      children: [
        new TextRun({
          text: upper(doc.titulos[key], st as { textTransform?: string }),
          font: doc.template === "clasico" ? headFont : font,
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
        shading: t.summaryBox ? { type: ShadingType.CLEAR, fill: "F5EDE5", color: "auto" } : undefined,
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
            new TextRun({ text: e.empresa, font, size, italics: doc.template === "clasico", color: doc.template === "ejecutivo" ? muted : text }),
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

  const file = new Document({
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
  downloadBlob(await Packer.toBlob(file), `${filename}.docx`);
}
