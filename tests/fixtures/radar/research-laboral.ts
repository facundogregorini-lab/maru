import JSZip from "jszip";

/**
 * Fixture del Sheet "Research Laboral" con los encabezados del prompt maestro (no hay export real en el repo).
 * Datos inventados o tomados de los ejemplos públicos del maestro. Sólo para tests: nunca se carga en una base.
 */

export const COMPANY_HEADERS = ["Ranking regional", "Empresa", "Sede", "Etapa", "Empleados estimados", "Actividad", "Áreas laborales sugeridas", "Careers", "Estado del enlace", "Fuentes", "Notas"];
export const JOB_HEADERS = ["Prioridad", "Score /100", "Empresa", "Ubicación", "Puesto", "F/S/G/P", "Motivos", "Barreras", "URL", "Evidencia", "Fecha", "Acción"];

type Cell = string | { v: string; link?: string; formulaLink?: string };
export type FixtureSheet = { name: string; rows: Cell[][] };

export const FIXTURE: FixtureSheet[] = [
  {
    name: "IA · Empresas",
    rows: [
      ["IA · EMPRESAS — RESEARCH LABORAL"],
      [],
      ["LATAM"],
      COMPANY_HEADERS,
      ["1", "Humand", "Buenos Aires, Argentina", "Serie A", "200-500", "Plataforma de comunicación interna", "Marketing; Growth", { v: "Careers", link: "https://careers.humand.co/jobs" }, "OK", "Crunchbase", "Conozco gente del equipo"],
      ["2", "Vercel", "Buenos Aires / San Francisco", "Serie E", "500-1000", "Plataforma de frontend", "Growth, Marketing", "https://vercel.com/careers", "OK", "Web oficial", ""],
      ["3", "", "Montevideo", "Seed", "", "", "", "", "", "", ""],
      [],
      ["GLOBAL"],
      COMPANY_HEADERS,
      ["1", "OpenAI", "San Francisco, EEUU", "Privada", "3000+", "Modelos de IA", "Growth", { v: "Ver careers", formulaLink: "https://openai.com/careers" }, "OK", "Web oficial", ""],
      ["2", "Anthropic", "San Francisco, EEUU", "Privada", "1000+", "Investigación y productos de IA", "GTM", "https://job-boards.greenhouse.io/anthropic", "OK", "", ""],
      ["3", "ElevenLabs", "Londres / Nueva York", "Serie C", "300+", "IA de voz", "Marketing B2B", "https://elevenlabs.io/careers", "OK", "", ""],
      [],
      ["JOB OPENINGS · PILOTO"],
      JOB_HEADERS,
      ["P1", "94", "Humand", "Argentina · Remoto", "Head of Marketing / CMO", "F", "Dirección integral", "Compensación", "https://careers.humand.co/jobs", "Aviso oficial", "45986", "Postular"],
      ["P1", "91", "ElevenLabs", "Southern Cone", "B2B Marketing – LATAM Southern Cone", "S", "Demand gen regional", "Elegibilidad", "https://elevenlabs.io/careers/c340cedd", "Aviso oficial", "25/11/2026", "Analizar"],
      ["P2", "89", "OpenAI", "São Paulo", "Growth Lead, Brazil", "G", "Crecimiento", "Portugués", "https://openai.com/careers/growth-lead-brazil", "Aviso oficial", "25/11/2026", "Analizar"],
      [],
      ["COBERTURA DEL PILOTO"],
      ["Empresa", "Revisadas", "Vacantes"],
      ["Humand", "1", "1"],
      ["Total", "10", "20"],
    ],
  },
  {
    name: "Space Exploration · Empresas",
    rows: [
      ["GLOBAL"],
      COMPANY_HEADERS,
      ["1", "The Exploration Company", "Múnich, Alemania", "Serie B", "200+", "Cápsulas espaciales", "Operaciones", "", "Sin link", "", ""],
      ["2", "PLD Space", "Elche, España", "Serie C", "300+", "Lanzadores", "Marketing", "https://www.pldspace.com/en/careers", "OK", "", ""],
      [],
      ["JOB OPENINGS · PILOTO"],
      JOB_HEADERS,
      ["P2", "80", "PLD Space", "Elche", "Marketing Manager", "S", "Sector", "Relocalización", "https://www.pldspace.com/en/careers/1", "", "25/11/2026", "Guardar"],
      ["COBERTURA DEL PILOTO"],
      ["Space", "10", "6"],
    ],
  },
  {
    name: "Tech Startups · A a pre-IPO",
    rows: [
      ["LATAM"],
      COMPANY_HEADERS,
      // Repetidas de IA: misma empresa por dominio (Vercel) y por nombre exacto sin link (Humand).
      ["1", "Vercel", "Buenos Aires / San Francisco", "Serie E", "500-1000", "Plataforma de frontend", "Producto", "https://vercel.com/careers", "OK", "", ""],
      ["2", "Humand", "Buenos Aires, Argentina", "Serie A", "", "", "", "", "", "", ""],
      ["GLOBAL"],
      COMPANY_HEADERS,
      ["1", "Supabase", "Singapur / EEUU", "Serie C", "200+", "Postgres como servicio", "Growth", "https://jobs.ashbyhq.com/supabase", "OK", "", ""],
      ["2", "Linear", "San Francisco", "Serie B", "100+", "Gestión de proyectos", "Marketing", "https://linear.app/careers", "OK", "", ""],
      ["JOB OPENINGS · PILOTO"],
      JOB_HEADERS,
      ["P1", "88", "Supabase", "Remoto", "Growth Manager, GEO/AEO", "G", "PLG", "", "https://jobs.ashbyhq.com/supabase/123", "", "25/11/2026", "Analizar"],
      ["P2", "84", "Stripe", "LatAm", "Regional Product Marketing Manager, Latin America", "S", "Fintech", "Dominio de pagos", "https://stripe.com/jobs/listing/1", "", "25/11/2026", "Analizar"],
      ["COBERTURA DEL PILOTO"],
      ["Tech Startups", "10", "14"],
    ],
  },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const col = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Arma un .xlsx mínimo (strings en línea, hipervínculos con rels y fórmulas HYPERLINK). */
export async function buildXlsx(sheets: FixtureSheet[] = FIXTURE): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`);
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("")}</Relationships>`,
  );
  sheets.forEach((s, si) => {
    const links: { ref: string; url: string }[] = [];
    const rows = s.rows
      .map((r, ri) => {
        const cells = r
          .map((cell, ci) => {
            const ref = `${col(ci)}${ri + 1}`;
            const c = typeof cell === "string" ? { v: cell } : cell;
            if (!c.v) return "";
            if (c.link) links.push({ ref, url: c.link });
            if (c.formulaLink) return `<c r="${ref}" t="str"><f>HYPERLINK("${esc(c.formulaLink)}","${esc(c.v)}")</f><v>${esc(c.v)}</v></c>`;
            if (/^\d+$/.test(c.v)) return `<c r="${ref}"><v>${c.v}</v></c>`;
            return `<c r="${ref}" t="inlineStr"><is><t>${esc(c.v)}</t></is></c>`;
          })
          .join("");
        return `<row r="${ri + 1}">${cells}</row>`;
      })
      .join("");
    const hl = links.length ? `<hyperlinks>${links.map((l, i) => `<hyperlink ref="${l.ref}" r:id="rIdL${i}"/>`).join("")}</hyperlinks>` : "";
    zip.file(
      `xl/worksheets/sheet${si + 1}.xml`,
      `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>${rows}</sheetData>${hl}</worksheet>`,
    );
    if (links.length)
      zip.file(
        `xl/worksheets/_rels/sheet${si + 1}.xml.rels`,
        `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${links
          .map((l, i) => `<Relationship Id="rIdL${i}" Type="hyperlink" Target="${esc(l.url)}" TargetMode="External"/>`)
          .join("")}</Relationships>`,
      );
  });
  return zip.generateAsync({ type: "uint8array" });
}
