import { describe, expect, it } from "vitest";
import { cleanSalary, salaryFromText } from "@/lib/match/salary";

const v = (t: string) => salaryFromText(t)?.value ?? null;

describe("salario publicado en el texto del aviso", () => {
  it("lee rangos en pesos y en dólares con su período", () => {
    expect(v("Sueldo: $1.200.000,00 - $1.300.000,00 al mes")).toMatchObject({ min: 1_200_000, max: 1_300_000, currency: "ARS", period: "mes" });
    expect(v("The salary range for this role is $5,000 - $9,500 per month (Gross in USD).")).toMatchObject({ min: 5000, max: 9500, currency: "USD", period: "mes" });
    expect(v("Compensation: ARS 2,500,000–2,800,000 gross per month")).toMatchObject({ min: 2_500_000, max: 2_800_000, currency: "ARS" });
    expect(v("Remuneración bruta mensual: $2.400.000")).toMatchObject({ min: 2_400_000, max: null, currency: "ARS", period: "mes" });
    expect(v("compensation range is $10-15/hr USD.")).toMatchObject({ min: 10, max: 15, period: "hora" });
    expect(v("The salary range is $120,000 to $200,000 (NY).")).toMatchObject({ currency: "USD", period: "anio" });
    expect(v("salary package: €55,000- €65,000 gross annual salary")).toMatchObject({ min: 55_000, max: 65_000, currency: "EUR", period: "anio" });
  });

  it("no confunde inversiones, estimaciones ni otros números con un sueldo", () => {
    for (const t of [
      "We raised $400 million in funding from top-tier investors.",
      "Salario estimado para vendedor en Argentina: ARS 95.000 - 700.000 al mes, según 7 avisos",
      "La remuneración es 100% variable, sin sueldo fijo.",
      "Competitive salary, stock options and 401k plan.",
      "Sueldos y cargas sociales (F.931) conforme a convenio.",
      "Salario según CCT 659/13 (Farmacia)",
      "Salario Nominal: Entre $ 240 y $ 360",
      "Remuneración publicada: 60000 por semana.",
      "Compensation includes 15 paid working days (PTO).",
    ]) expect(v(t), t).toBeNull();
  });

  it("guarda de dónde salió", () => {
    const s = salaryFromText("Beneficios varios.\nSueldo: A partir de $900.000,00 al mes")!;
    expect(s.from).toBe("descripcion");
    expect(s.evidence).toMatch(/900\.000/);
  });

  it("lee «Monthly base of…» y «Base: …», no «Knowledge base»", () => {
    expect(v("Remote from LATAM. Monthly base of US$800-US$1,000 based on experience.")).toMatchObject({ min: 800, max: 1000, currency: "USD", period: "mes" });
    expect(v("Compensation\n• Base: $1,000 USD/month, guaranteed")).toMatchObject({ min: 1000, currency: "USD", period: "mes" });
    expect(v("Knowledge base: 2000 articles")).toBeNull();
  });
});

describe("cleanSalary: salario que la fuente trae sólo como texto", () => {
  const f = (text: string, currency = "") => cleanSalary({ value: { min: null, max: null, currency, period: "desconocido", text }, from: "fuente" })?.value ?? null;
  it("deduce moneda, período y montos por el formato", () => {
    expect(f("$18,000.00/yr - $24,000.00/yr")).toMatchObject({ currency: "USD", period: "anio", min: 18000, max: 24000 });
    expect(f("$90.00/hr - $170.00/hr")).toMatchObject({ currency: "USD", period: "hora", min: 90, max: 170 });
    expect(f("OTE $25k - $35k")).toMatchObject({ currency: "USD", period: "anio", min: 25000, max: 35000 });
    expect(f("$ 1.200.000,00 (Mensual)")).toMatchObject({ currency: "ARS", period: "mes", min: 1200000 });
    expect(f("Rango publicado en Get on Board: 2500 – 3750")).toMatchObject({ currency: "USD", period: "mes", min: 2500, max: 3750 });
  });
  it("descarta números de relleno y sueldos imposibles", () => {
    for (const t of ["$ 11.111,00 (Mensual)", "$ 1.111.111,00 (Mensual) + Comisiones", "$ 9.999,00 (Mensual)", "$ 10.000,00 (Mensual)"]) expect(f(t)).toBeNull();
  });
  it("si no lo entiende, lo deja como vino", () => {
    expect(f("A convenir")).toMatchObject({ currency: "", text: "A convenir" });
    expect(f("$1000 per task")).toMatchObject({ currency: "", text: "$1000 per task" });
  });
});
