import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOCX_MIME, PDF_MIME, buildCvSource, looksLikePdf, normalizeCvSource } from "@/lib/cvSource";

const pdfBase64 = readFileSync(new URL("./fixtures/cv.pdf", import.meta.url)).toString("base64");
const pdfFile = { name: "CV_FacundoGregorini_2026.pdf", base64: pdfBase64, mime: PDF_MIME };

describe("buildCvSource (la validación y el envío usan lo mismo)", () => {
  it("solo PDF, sin texto pegado: hay CV y se envía el archivo", () => {
    for (const mode of ["cv", "linkedin"] as const) {
      const source = buildCvSource(mode, pdfFile, "");
      expect(source).toEqual({ kind: mode, fileBase64: pdfBase64, mimeType: PDF_MIME });
    }
  });

  it("sin archivo en modo archivo: no hay CV", () => {
    expect(buildCvSource("cv", null, "un texto largo que no cuenta porque está en otra pestaña ".repeat(3))).toBeNull();
    expect(buildCvSource("cv", { ...pdfFile, base64: "" }, "")).toBeNull();
  });

  it("modo texto: exige un mínimo y no mira el archivo", () => {
    expect(buildCvSource("texto", pdfFile, "corto")).toBeNull();
    const text = "Experiencia: Head of Growth en Tucán (2021-2024), Mercado Libre (2020-2021). Ingeniería Industrial, UBA.";
    expect(buildCvSource("texto", pdfFile, `  ${text}  `)).toEqual({ kind: "texto", text });
  });
});

describe("normalizeCvSource", () => {
  it("acepta el formato actual", () => {
    const source = { kind: "cv" as const, fileBase64: pdfBase64, mimeType: PDF_MIME };
    expect(normalizeCvSource({ source })).toEqual(source);
  });

  it("acepta el formato de la versión anterior (pestaña abierta antes de un deploy)", () => {
    expect(normalizeCvSource({ cvPdfBase64: pdfBase64 })).toEqual({ kind: "cv", fileBase64: pdfBase64, mimeType: PDF_MIME });
    expect(normalizeCvSource({ cvPdfBase64: pdfBase64, linkedinUrl: "https://linkedin.com/in/x" })?.kind).toBe("linkedin");
    expect(normalizeCvSource({ cvText: "mi experiencia" })).toEqual({ kind: "texto", text: "mi experiencia" });
  });

  it("sin CV devuelve undefined", () => {
    expect(normalizeCvSource({ feedback: "hola" })).toBeUndefined();
    expect(normalizeCvSource(null)).toBeUndefined();
  });
});

describe("looksLikePdf", () => {
  it("reconoce la firma %PDF", () => {
    expect(looksLikePdf(pdfBase64)).toBe(true);
    expect(looksLikePdf(Buffer.from("hola").toString("base64"))).toBe(false);
    expect(DOCX_MIME).toContain("wordprocessingml");
  });
});
