import { describe, expect, it } from "vitest";
import { jobInputIssue, MIN_JOB_TEXT_CHARS } from "@/lib/inputValidation";

describe("requisitos del aviso compartidos con el servidor", () => {
  it("explica lo que falta y acepta el límite exacto del aviso pegado", () => {
    expect(jobInputIssue("", "a".repeat(299))).toContain("1 caracteres");
    expect(jobInputIssue("", "a".repeat(MIN_JOB_TEXT_CHARS))).toBeNull();
    expect(jobInputIssue("", "   ")).toContain("link o el texto");
  });
  it("acepta un link HTTP o el texto suficiente aunque el link esté mal", () => {
    expect(jobInputIssue("https://example.com/jobs/1", "")).toBeNull();
    expect(jobInputIssue("javascript:alert(1)", "")).toContain("Revisá el link");
    expect(jobInputIssue("mal", "a".repeat(300))).toBeNull();
  });
});
