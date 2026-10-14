import { AlignmentType, BorderStyle, Document, Paragraph, ShadingType, TextRun } from "docx";
import { resolveTheme } from "@/components/cv/themes";
import { remitenteLine } from "../carta";
import type { CartaDoc } from "../schemas";

const PAGE_W = 11906;
const PX = 15;
const hp = (px: number) => Math.round(px * 1.5);
const hex = (c: string) => c.replace("#", "");
const isHex = (c: unknown): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c);

/** Carta en Word, con el mismo diseño que la vista previa. Se arma en el servidor. */
export function buildLetterDocx(doc: CartaDoc): Document {
  const t = resolveTheme(doc);
  const font = t.docx.body;
  const head = t.docx.head;
  const size = hp((typeof t.body.fontSize === "number" ? t.body.fontSize : 12) + 0.75);
  const align = t.header.textAlign === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const band = isHex(t.header.background) ? { type: ShadingType.CLEAR, fill: hex(t.header.background), color: "auto" } : undefined;
  const onBand = band && isHex(t.header.color) ? hex(t.header.color) : null;
  const upper = (s: string, st: { textTransform?: unknown }) => (st.textTransform === "uppercase" ? s.toUpperCase() : s);
  const r = doc.remitente;
  const contact = remitenteLine(doc);
  const ruled = /([\d.]+)px\s+solid\s+(#[0-9a-f]{6})/i.exec(String(t.header.borderBottom ?? ""));

  const children: Paragraph[] = [
    new Paragraph({
      alignment: align,
      shading: band,
      children: [
        new TextRun({
          text: upper(r.nombre, t.name),
          font: head,
          size: hp(Number(t.name.fontSize)),
          bold: Number(t.name.fontWeight ?? 400) >= 600,
          color: onBand ?? hex(isHex(t.name.color) ? t.name.color : t.text),
        }),
      ],
    }),
  ];
  if (r.titular)
    children.push(
      new Paragraph({
        alignment: align,
        shading: band,
        spacing: { before: band ? 0 : 60 },
        children: [
          new TextRun({
            text: upper(r.titular, t.titular),
            font,
            size: hp(Number(t.titular.fontSize)),
            bold: Number(t.titular.fontWeight ?? 400) >= 600,
            color: onBand ?? hex(isHex(t.titular.color) ? t.titular.color : t.text),
          }),
        ],
      }),
    );
  if (contact.length)
    children.push(
      new Paragraph({
        alignment: align,
        shading: band,
        spacing: { before: band ? 0 : 100 },
        border: ruled ? { bottom: { style: BorderStyle.SINGLE, size: Math.round(Number(ruled[1]) * 6), color: hex(ruled[2]), space: 6 } } : undefined,
        children: [new TextRun({ text: contact.join("  |  "), font, size: hp(Number(t.contact.fontSize)), color: onBand ?? hex(t.muted) })],
      }),
    );

  const p = (text: string, opts: { before?: number; after?: number; color?: string; bold?: boolean; f?: string } = {}) =>
    new Paragraph({
      spacing: { before: opts.before ?? 0, after: opts.after ?? 180, line: 360 },
      children: [new TextRun({ text, font: opts.f ?? font, size, color: opts.color ?? hex(t.text), bold: opts.bold })],
    });

  children.push(p(doc.fecha, { before: 520, after: 300, color: hex(t.muted) }));
  children.push(p(doc.saludo, { after: 220 }));
  for (const par of doc.parrafos) if (par.text.trim()) children.push(p(par.text));
  children.push(p(doc.cierre, { before: 120, after: 80 }));
  children.push(p(doc.firma, { bold: true, color: hex(t.accent), f: head }));

  const margin = (t.padX + 8) * PX;
  return new Document({
    creator: "Maru",
    title: `${r.nombre} — Carta de presentación`,
    styles: { default: { document: { run: { font, size } } } },
    sections: [
      {
        properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: t.padY * PX, bottom: t.padY * PX, left: margin, right: margin } } },
        children,
      },
    ],
  });
}
