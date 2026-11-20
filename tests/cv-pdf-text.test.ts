import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cvBlocks, pdfText } from "@/lib/claude";
import { PDF_MIME } from "@/lib/cvSource";

/** PDF mínimo de una página con las líneas dadas (sin tabla xref válida: pdf.js la reconstruye). */
function pdfWith(lines: string[]): string {
  const stream = ["BT", "/F1 10 Tf", "40 800 Td", "12 TL", ...lines.map((l) => `(${l}) Tj T*`), "ET"].join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n `).join("\n")}\n`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "latin1").toString("base64");
}

const lines = [
  "Ana Perez - Analista de datos",
  "Experiencia: Analista de datos en Empresa Ficticia S.A. (2021 - actualidad).",
  "Armado de reportes de ventas con SQL y Power BI para 12 clientes.",
  "Automatizacion de tableros semanales con Python.",
  "Educacion: Licenciatura en Economia, Universidad Ficticia (2015 - 2020).",
];

describe("CV en PDF", () => {
  it("manda el texto del PDF en lugar del archivo cuando se puede leer", async () => {
    const base64 = pdfWith(lines);
    expect(await pdfText(base64)).toContain("Power BI para 12 clientes");
    const blocks = await cvBlocks({ kind: "cv", fileBase64: base64, mimeType: PDF_MIME });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "text" });
    expect((blocks[0] as { text: string }).text).toMatch(/^<cv titulo="CV de la persona">\n[\s\S]*Automatizacion de tableros[\s\S]*<\/cv>$/);
  });

  it("sigue mandando el PDF si casi no tiene texto (escaneo o imagen)", async () => {
    const base64 = readFileSync(new URL("./fixtures/cv.pdf", import.meta.url)).toString("base64");
    const blocks = await cvBlocks({ kind: "linkedin", fileBase64: base64, mimeType: PDF_MIME });
    expect(blocks[0]).toMatchObject({ type: "document", title: "Perfil de LinkedIn exportado a PDF" });
  });

  it("no falla con un PDF roto: devuelve texto vacío", async () => {
    expect(await pdfText(Buffer.from("%PDF-1.4 roto").toString("base64"))).toBe("");
  });
});
