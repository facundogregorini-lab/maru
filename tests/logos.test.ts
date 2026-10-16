import { describe, expect, it } from "vitest";
import { normalizeJobicy, normalizeRemotive } from "@/lib/match/connectors";
import { isLowQuality } from "@/lib/match/quality";
import { BOARDS } from "./match-helpers";

describe("logos y calidad", () => {
  it("guarda el logo sólo si la fuente lo publica por https", () => {
    const base = { id: 1, url: "https://remotive.com/x", title: "PM", company_name: "Acme" };
    expect(normalizeRemotive({ ...base, company_logo: "https://cdn.remotive.com/acme.png" }, BOARDS.remotive).companyLogo).toBe("https://cdn.remotive.com/acme.png");
    expect(normalizeRemotive({ ...base, company_logo: "http://inseguro/x.png" }, BOARDS.remotive).companyLogo).toBeUndefined();
    expect(normalizeJobicy({ id: 2, url: "https://jobicy.com/x", jobTitle: "PM", companyName: "Acme", companyLogo: "https://jobicy.com/logo.png" }, BOARDS.jobicy).companyLogo).toBe(
      "https://jobicy.com/logo.png",
    );
  });

  it("reconoce los avisos masivos de baja calidad", () => {
    expect(isLowQuality("Audio Transcription Specialist (Czech language)")).toBe(true);
    expect(isLowQuality("AI Trainer with Norwegian language")).toBe(true);
    expect(isLowQuality("Senior Product Manager")).toBe(false);
  });
});
