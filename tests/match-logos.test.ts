import { describe, expect, it } from "vitest";
import { companyKey, shareCompanyLogos } from "@/lib/match/logos";
import type { StoredPosting } from "@/lib/match/types";

const p = (key: string, company: string, companyLogo?: string) => ({ key, company, ...(companyLogo ? { companyLogo } : {}) }) as StoredPosting;

describe("logos compartidos por empresa", () => {
  it("normaliza el nombre sin sufijos societarios ni 'Argentina'", () => {
    expect(companyKey("Randstad Argentina")).toBe("randstad");
    expect(companyKey("Molinos Río de la Plata S.A.")).toBe("molinos rio de la plata");
    expect(companyKey("Newsan S.R.L.")).toBe("newsan");
  });

  it("completa el logo que falta con el de la misma empresa, y nunca en confidenciales", () => {
    const out = shareCompanyLogos([
      p("a", "Randstad Argentina", "https://img/randstad.png"),
      p("b", "Randstad"),
      p("c", "Confidencial", "https://img/x.png"),
      p("d", "Confidencial"),
      p("e", "Otra SA"),
      p("f", "Randstad", "http://inseguro/logo.png"),
    ]);
    expect(out.find((x) => x.key === "b")!.companyLogo).toBe("https://img/randstad.png");
    expect(out.find((x) => x.key === "d")!.companyLogo).toBeUndefined();
    expect(out.find((x) => x.key === "e")!.companyLogo).toBeUndefined();
    expect(out.find((x) => x.key === "f")!.companyLogo).toBe("http://inseguro/logo.png");
  });
});
