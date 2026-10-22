import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTENSION_VERSION } from "@/lib/extensionVersion";
import { autofillBlocks, matchOption, normalizeAnswers } from "@/lib/autofill";
import type { AutofillField, AutofillRequest, Profile } from "@/lib/schemas";

const askStructured = vi.fn();
vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  return { ...actual, askStructured: (...args: unknown[]) => askStructured(...args) };
});

const { POST } = await import("@/app/api/autofill/route");

const profile: Profile = {
  nombre: "Ana Pérez",
  titulo: "Frontend Engineer",
  ubicacion: "Buenos Aires, Argentina",
  email: "ana@mail.com",
  telefono: "+54 11 5555 5555",
  linkedin_url: "linkedin.com/in/anaperez",
  otros_links: ["github.com/anaperez"],
  resumen: "",
  aptitudes: ["React", "TypeScript"],
  experiencia: [
    { empresa: "Tucán", cargo: "Frontend Engineer", inicio: "05/2021", fin: "actual", ubicacion: "", descripcion: "", logros: ["x"], fragmentos_incompletos: [] },
  ],
  educacion: [],
  idiomas: [],
  certificaciones: [],
};

const fields: AutofillField[] = [
  { id: "0:f1", tipo: "texto", etiqueta: "First name" },
  { id: "0:f2", tipo: "seleccion", etiqueta: "Country", opciones: ["Select…", "Argentina", "Brazil"] },
  { id: "0:f3", tipo: "opcion_unica", etiqueta: "Authorized to work?", opciones: ["Yes", "No"] },
  { id: "0:f4", tipo: "multiple", etiqueta: "Skills", opciones: ["TypeScript", "React", "PHP"] },
  { id: "0:f5", tipo: "casilla", etiqueta: "I have a degree" },
  { id: "0:f6", tipo: "archivo", etiqueta: "Resume" },
  { id: "0:f7", tipo: "texto_largo", etiqueta: "Why us?", max_caracteres: 20 },
  { id: "0:f8", tipo: "numero", etiqueta: "Years of experience" },
  { id: "0:f9", tipo: "fecha", etiqueta: "Start date" },
];

const body: AutofillRequest = {
  profile,
  extras: "Pretensión: USD 3000",
  hasCv: true,
  page: { url: "https://jobs.lever.co/tucan/1", title: "Tucán", text: "Senior Frontend Engineer" },
  fields,
};

// La extensión manda su versión; sin ella la ruta pide actualizar.
const headers = { "X-Maru-Version": EXTENSION_VERSION };
const req = (b: unknown) => new Request("http://test/api/autofill", { method: "POST", headers, body: JSON.stringify(b) });

beforeEach(() => askStructured.mockReset());

describe("matchOption", () => {
  it("encuentra la opción exacta sin importar mayúsculas ni acentos", () => {
    expect(matchOption(["Sí", "No"], "si")).toBe("Sí");
    expect(matchOption(["Argentina", "Brasil"], "argentina")).toBe("Argentina");
  });
  it("traduce sí/no entre idiomas", () => {
    expect(matchOption(["Yes", "No"], "Sí")).toBe("Yes");
    expect(matchOption(["Yes, I am", "No, I am not"], "yes")).toBe("Yes, I am");
  });
  it("acepta un prefijo o fragmento sólo si es inequívoco", () => {
    expect(matchOption(["Argentina", "Armenia"], "Argen")).toBe("Argentina");
    expect(matchOption(["Argentina", "Armenia"], "Ar")).toBeNull();
    expect(matchOption(["Remote - LATAM", "Remote - EU"], "Remote")).toBeNull();
  });
  it("devuelve null si no hay ninguna parecida", () => {
    expect(matchOption(["Argentina", "Brasil"], "Chile")).toBeNull();
  });
});

describe("normalizeAnswers", () => {
  const a = (id: string, valor: string, revisar = false, nota = "") => ({ id, valor, revisar, nota });

  it("valida cada tipo y descarta lo que no corresponde", () => {
    const out = normalizeAnswers(
      fields,
      [
        a("0:f1", " Ana "),
        a("0:f2", "argentina"),
        a("0:f3", "Sí"),
        a("0:f4", "React\nTypeScript\nCOBOL\nreact"),
        a("0:f5", "no"),
        a("0:f6", "cv"),
        a("0:f7", "Porque me encanta el producto", true, "Redactado por Maru"),
        a("0:f8", "7 años"),
        a("0:f9", "01/11/2026"),
        a("0:inventado", "x"),
      ],
      true,
    );
    expect(out).toEqual([
      a("0:f1", "Ana"),
      a("0:f2", "Argentina"),
      a("0:f3", "Yes"),
      a("0:f4", "React\nTypeScript"),
      a("0:f6", "cv"),
      a("0:f7", "Porque me encanta el", true, "Redactado por Maru"),
      a("0:f8", "7"),
    ]);
  });

  it("nunca completa datos demográficos ni aceptaciones legales, aunque la IA lo intente", () => {
    const sensitive: AutofillField[] = [
      { id: "s1", tipo: "seleccion", etiqueta: "Gender", opciones: ["Female", "Male"] },
      { id: "s2", tipo: "seleccion", etiqueta: "Are you Hispanic/Latino?", opciones: ["Yes", "No"] },
      { id: "s3", tipo: "seleccion", etiqueta: "Veteran Status", opciones: ["I am not a protected veteran"] },
      { id: "s4", tipo: "seleccion", etiqueta: "Agreement to Arbitrate", opciones: ["I agree"] },
      { id: "s5", tipo: "casilla", etiqueta: "Acepto los términos y condiciones" },
      { id: "s6", tipo: "opcion_unica", etiqueta: "May we use AI notetakers?", ayuda: "We need your consent", opciones: ["Yes", "No"] },
      { id: "ok1", tipo: "texto", etiqueta: "In terms of salary, what do you expect?" },
    ];
    const answers = [
      a("s1", "Female"),
      a("s2", "No"),
      a("s3", "I am not a protected veteran"),
      a("s4", "I agree"),
      a("s5", "sí"),
      a("s6", "Yes"),
      a("ok1", "USD 3000"),
    ];
    expect(normalizeAnswers(sensitive, answers, true).map((x) => x.id)).toEqual(["ok1"]);
  });

  it("tampoco consentimientos, declaraciones ni datos étnicos comunes en Argentina", () => {
    const labels = [
      "Autorizo el tratamiento de mis datos personales (Ley 25.326)",
      "Acepto las bases y condiciones",
      "Declaro bajo juramento que los datos son verdaderos",
      "Acepto los Términos de uso",
      "Quiero recibir novedades por email",
      "¿Cuál es tu origen étnico?",
      "Edad",
    ];
    const fs: AutofillField[] = labels.map((etiqueta, i) => ({ id: `x${i}`, tipo: "casilla", etiqueta }));
    expect(normalizeAnswers(fs, fs.map((f) => a(f.id, "sí")), true)).toEqual([]);
    // Pero sí lo que se responde con el perfil o los datos extra.
    const ok: AutofillField[] = [
      { id: "w", tipo: "opcion_unica", etiqueta: "¿Tenés autorización para trabajar en Argentina?", opciones: ["Sí", "No"] },
      { id: "l", tipo: "seleccion", etiqueta: "Language level", opciones: ["Basic", "Advanced"] },
    ];
    expect(normalizeAnswers(ok, [a("w", "Sí"), a("l", "Advanced")], true).map((x) => x.id)).toEqual(["w", "l"]);
  });

  it("los números con punto de miles se leen bien", () => {
    const n: AutofillField[] = [{ id: "n", tipo: "numero", etiqueta: "Pretensión" }];
    expect(normalizeAnswers(n, [a("n", "USD 3.000")], true)[0].valor).toBe("3000");
    expect(normalizeAnswers(n, [a("n", "1.500.000")], true)[0].valor).toBe("1500000");
    expect(normalizeAnswers(n, [a("n", "2,5")], true)[0].valor).toBe("2.5");
    expect(normalizeAnswers(n, [a("n", "3,000")], true)[0].valor).toBe("3000");
  });

  it("no adjunta el CV si la persona no subió un archivo", () => {
    expect(normalizeAnswers(fields, [a("0:f6", "cv")], false)).toEqual([]);
  });

  it("no repite un campo y borra la nota si no hay que revisarlo", () => {
    expect(normalizeAnswers(fields, [a("0:f1", "Ana", false, "x"), a("0:f1", "Otra")], true)).toEqual([a("0:f1", "Ana")]);
  });
});

describe("autofillBlocks", () => {
  it("manda perfil, datos extra, página y un campo por línea", () => {
    const [block] = autofillBlocks(body, new Date("2026-10-15T12:00:00Z"));
    if (block.type !== "text") throw new Error("esperaba texto");
    expect(block.text).toContain("Fecha de hoy: 2026-10-15");
    expect(block.text).toContain('"nombre":"Ana Pérez"');
    expect(block.text).toContain("Pretensión: USD 3000");
    expect(block.text).toContain('<cv_adjuntable>sí');
    expect(block.text).toContain(JSON.stringify(fields[1]));
  });
});

describe("/api/autofill", () => {
  it("devuelve las respuestas validadas", async () => {
    askStructured.mockResolvedValue({ campos: [{ id: "0:f2", valor: "Argentina", revisar: false, nota: "" }, { id: "0:f3", valor: "Quizás", revisar: false, nota: "" }] });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ answers: [{ id: "0:f2", valor: "Argentina", revisar: false, nota: "" }] });
    expect(askStructured.mock.calls[0][0]).toMatchObject({ effort: "low" });
  });

  it("rechaza un pedido sin campos o sin perfil, sin llamar a la IA", async () => {
    for (const bad of [{ ...body, fields: [] }, { ...body, profile: undefined }, "no es json"]) {
      const res = await POST(typeof bad === "string" ? new Request("http://test", { method: "POST", headers, body: bad }) : req(bad));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("BAD_REQUEST");
    }
    expect(askStructured).not.toHaveBeenCalled();
  });
});
