import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { boardFromUrl, domainFromUrl, identify, sameCompany } from "@/lib/radar/identity";
import { applyImport, industryFromSheet, parseSheets, planSheets, previewImport } from "@/lib/radar/importer";
import { addCompany, archiveCompany, counts, filterCompanies, mergeRadar, move, normalizeSettings, setPriority, updateCompany, validWeights } from "@/lib/radar/state";
import { parseCsv, parseXlsx, type Sheet } from "@/lib/radar/table";
import { EMPTY_RADAR, type RadarState } from "@/lib/radar/types";

const HEAD = ["#", "Empresa", "Sede", "Etapa", "Empleados estimados", "Actividad", "Áreas laborales sugeridas", "Careers", "Estado del enlace", "Fuentes", "Notas"];
const row = (n: number, name: string, careers: string, sede = "EEUU") => [String(n), name, sede, "Serie C", "500", "Hace cosas", "Growth", careers, "OK", "web", ""];
const JOBS_HEAD = ["Prioridad", "Score /100", "Empresa", "Ubicación", "Puesto", "F/S/G/P", "Motivos", "Barreras", "URL", "Evidencia", "Fecha", "Acción"];

/** Mismo formato que el Research Laboral: regiones, empresas, vacantes del piloto y cobertura. */
function researchSheets(): Sheet[] {
  const ia: string[][] = [
    ["IA · Empresas (25/11/2026)"],
    HEAD,
    ["LatAm"],
    row(1, "Humand", "https://careers.humand.co/jobs", "Argentina"),
    row(2, "Vercel", "https://vercel.com/careers", "Argentina / EEUU"),
    ["Global"],
    row(1, "Anthropic", "https://job-boards.greenhouse.io/anthropic"),
    row(2, "OpenAI", "https://openai.com/careers/"),
    [],
    ["JOB OPENINGS · PILOTO 25/11/2026"],
    JOBS_HEAD,
    ["P1", "94", "Humand", "Argentina · Remoto", "Head of Marketing / CMO", "F", "Dirección integral", "Compensación", "https://careers.humand.co/jobs", "web", "25/11/2026", "Postular"],
    ["P1", "89", "OpenAI", "São Paulo", "Growth Lead, Brazil", "F", "Growth de ChatGPT", "Portugués", "https://openai.com/careers/growth-lead-brazil-sao-paulo/", "web", "25/11/2026", "Revisar"],
    ["COBERTURA DEL PILOTO"],
    ["Empresas revisadas", "10"],
    ["Vacantes", "20"],
  ];
  const tech: string[][] = [
    HEAD,
    ["LatAm"],
    row(1, "Vercel", "https://vercel.com/careers", "Argentina / EEUU"),
    row(2, "Humand", "https://careers.humand.co/jobs", "Argentina"),
    ["Global"],
    row(1, "Supabase", "https://supabase.com/careers"),
    row(2, "Linear", ""),
  ];
  const space: string[][] = [HEAD, ["Global"], row(1, "ICEYE", "https://www.iceye.com/careers"), row(2, "PLD Space", "pldspace.com/es/trabaja-con-nosotros")];
  return [
    { name: "IA · Empresas", rows: ia, links: {} },
    { name: "Space Exploration · Empresas", rows: space, links: {} },
    { name: "Tech Startups · A a pre-IPO", rows: tech, links: {} },
  ];
}

describe("identidad de empresas", () => {
  it("detecta la bolsa de ATS con el mismo id que el directorio de Match", () => {
    expect(boardFromUrl("https://job-boards.greenhouse.io/Anthropic/jobs/123")).toBe("greenhouse:anthropic");
    expect(boardFromUrl("https://jobs.lever.co/despegar?location=x")).toBe("lever:despegar");
    expect(boardFromUrl("https://jobs.ashbyhq.com/supabase")).toBe("ashby:supabase");
    expect(boardFromUrl("https://davidkennedy.teamtailor.com/jobs")).toBe("teamtailor:davidkennedy.teamtailor.com");
    expect(boardFromUrl("https://accenture.wd103.myworkdayjobs.com/AccentureCareers/job/x")).toBe("workday:accenture.wd103.accenturecareers");
    expect(boardFromUrl("https://openai.com/careers")).toBeNull();
  });
  it("el dominio de la empresa sale de su página de empleo, nunca de un ATS o una red", () => {
    expect(domainFromUrl("https://careers.humand.co/jobs")).toBe("humand.co");
    expect(domainFromUrl("https://www.iceye.com/careers")).toBe("iceye.com");
    expect(domainFromUrl("https://job-boards.greenhouse.io/anthropic")).toBeNull();
    expect(domainFromUrl("https://www.linkedin.com/company/x/jobs")).toBeNull();
    expect(domainFromUrl("javascript:alert(1)")).toBeNull();
  });
  it("no fusiona dos empresas con dominios distintos aunque se llamen igual", () => {
    const a = identify({ name: "Nova", careersUrl: "https://nova.com/careers" });
    const b = identify({ name: "Nova", careersUrl: "https://nova.io/jobs" });
    const c = identify({ name: "Nova S.A." });
    expect(sameCompany(a, b)).toBe(false);
    expect(sameCompany(a, c)).toBe(true);
  });
});

describe("lectura de planillas", () => {
  it("CSV con comillas, punto y coma y saltos de línea dentro de una celda", () => {
    const s = parseCsv('Empresa;Careers;Notas\n"Acme; SA";https://acme.com/jobs;"Línea 1\nLínea 2"\nBeta;;"dice ""hola"""\n');
    expect(s.rows).toEqual([
      ["Empresa", "Careers", "Notas"],
      ["Acme; SA", "https://acme.com/jobs", "Línea 1\nLínea 2"],
      ["Beta", "", 'dice "hola"'],
    ]);
  });

  it("XLSX: pestañas, texto compartido, celdas vacías y links de celda", async () => {
    const zip = new JSZip();
    zip.file("xl/workbook.xml", '<workbook><sheets><sheet name="IA · Empresas" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file("xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file("xl/sharedStrings.xml", "<sst><si><t>Empresa</t></si><si><t>Careers</t></si><si><r><t>Anth</t></r><r><t>ropic</t></r></si><si><t>Ver bolsa</t></si><si><t>Ben &amp; Jerry</t></si></sst>");
    zip.file(
      "xl/worksheets/sheet1.xml",
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2" t="s"><v>3</v></c></row><row r="4"><c r="A4" t="s"><v>4</v></c><c r="C4" t="str"><f>HYPERLINK("https://benjerry.com/careers","web")</f><v>web</v></c></row></sheetData><hyperlinks><hyperlink ref="C2" r:id="rId9"/></hyperlinks></worksheet>',
    );
    zip.file("xl/worksheets/_rels/sheet1.xml.rels", '<Relationships><Relationship Id="rId9" Type="hyperlink" Target="https://job-boards.greenhouse.io/anthropic" TargetMode="External"/></Relationships>');
    const sheets = await parseXlsx(await zip.generateAsync({ type: "uint8array" }));
    expect(sheets).toHaveLength(1);
    expect(sheets[0].rows[0]).toEqual(["Empresa", "", "Careers"]);
    expect(sheets[0].rows[1][0]).toBe("Anthropic");
    expect(sheets[0].rows[2]).toEqual([]);
    expect(sheets[0].links["1,2"]).toBe("https://job-boards.greenhouse.io/anthropic");

    const parsed = parseSheets(sheets, planSheets(sheets));
    expect(parsed.companies.map((c) => [c.name, c.fields.careersUrl, c.identity.id])).toEqual([
      ["Anthropic", "https://job-boards.greenhouse.io/anthropic", "ats:greenhouse:anthropic"],
      ["Ben & Jerry", "https://benjerry.com/careers", "dom:benjerry.com"],
    ]);
  });

  it("toma el sector del nombre de la pestaña", () => {
    expect(industryFromSheet("IA · Empresas")).toBe("IA");
    expect(industryFromSheet("Space Exploration · Empresas")).toBe("Space");
    expect(industryFromSheet("Tech Startups · A a pre-IPO")).toBe("Tech Startups");
    expect(industryFromSheet("Fintech")).toBe("Fintech");
  });
});

describe("importación del Research Laboral", () => {
  const sheets = researchSheets();
  const parsed = parseSheets(sheets, planSheets(sheets));

  it("separa empresas, vacantes del piloto y cobertura", () => {
    expect(parsed.companies).toHaveLength(10);
    expect(parsed.jobs.map((j) => j.title)).toEqual(["Head of Marketing / CMO", "Growth Lead, Brazil"]);
    expect(parsed.jobs[0].score).toBe(94);
    expect(parsed.ignoredCoverage).toBe(2);
    expect(parsed.pilotDate).toBe("25/11/2026");
    // Ni las vacantes ni la cobertura se cuelan como empresas.
    expect(parsed.companies.some((c) => /Head of|Empresas revisadas|Vacantes/.test(c.name))).toBe(false);
    expect(parsed.companies.find((c) => c.name === "Anthropic")?.region).toBe("Global");
    expect(parsed.companies.find((c) => c.name === "Humand")?.region).toBe("LatAm");
  });

  it("una empresa repetida entre sectores queda una sola vez con todas sus etiquetas", () => {
    const preview = previewImport(parsed, EMPTY_RADAR);
    expect(preview.unique).toHaveLength(8);
    expect(preview.duplicatesInFile).toBe(2);
    const vercel = preview.unique.find((c) => c.name === "Vercel")!;
    expect(vercel.industries.sort()).toEqual(["IA", "Tech Startups"]);
    expect(vercel.identity.id).toBe("dom:vercel.com");
  });

  it("es idempotente y no pisa prioridad, orden ni notas", () => {
    const first = applyImport(EMPTY_RADAR, parsed, { suggestPriority: false, mergeConflicts: false, now: 1 });
    expect(first.created).toBe(8);
    expect(first.jobs).toBe(2);
    expect(Object.values(first.state.companies).every((c) => c.priority === null)).toBe(true);
    expect(first.state.pilot.find((j) => j.company === "Humand")?.companyId).toBe("dom:humand.co");

    let s = setPriority(first.state, "dom:humand.co", "P1", 2);
    s = updateCompany(s, "dom:humand.co", { notes: "Hablar con Juli" }, 3);
    const before = JSON.stringify(s);

    const second = applyImport(s, parsed, { suggestPriority: true, mergeConflicts: false, now: 4 });
    expect(second.created).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.jobs).toBe(0);
    expect(JSON.stringify(second.state)).toBe(before);
    expect(second.state.companies["dom:humand.co"].priority).toBe("P1");
    expect(second.state.companies["dom:humand.co"].notes).toBe("Hablar con Juli");
  });

  it("suma etiquetas y completa datos vacíos de una empresa que ya se seguía", () => {
    const { state } = addCompany(EMPTY_RADAR, { name: "Vercel", careersUrl: "https://vercel.com/careers", industries: ["Infra"], priority: "P2" }, 1);
    const r = applyImport(state, parsed, { suggestPriority: false, mergeConflicts: false, now: 2 });
    const v = r.state.companies["dom:vercel.com"];
    expect(v.priority).toBe("P2");
    expect(v.industries.sort()).toEqual(["IA", "Infra", "Tech Startups"]);
    expect(v.hq).toBe("Argentina / EEUU");
    expect(r.updated).toBe(1);
  });

  it("prioridad sugerida opcional por ranking: P1, P2 y P3", () => {
    const r = applyImport(EMPTY_RADAR, parsed, { suggestPriority: true, mergeConflicts: false, now: 1 });
    expect(counts(r.state).P1).toBe(8);
  });

  it("marca como conflicto el mismo nombre con otro dominio y sólo fusiona si la persona lo confirma", () => {
    const { state } = addCompany(EMPTY_RADAR, { name: "Supabase", careersUrl: "https://supabase.io/jobs", industries: [], priority: "P1" }, 1);
    const preview = previewImport(parsed, state);
    expect(preview.conflicts.map((c) => c.company.name)).toEqual(["Supabase"]);
    expect(applyImport(state, parsed, { suggestPriority: false, mergeConflicts: false }).state.companies["dom:supabase.com"]).toBeUndefined();
    const merged = applyImport(state, parsed, { suggestPriority: false, mergeConflicts: true }).state;
    expect(Object.values(merged.companies).filter((c) => c.name === "Supabase")).toHaveLength(1);
  });

  it("informa links inválidos sin perder la fila", () => {
    const bad: Sheet[] = [{ name: "IA", rows: [["Empresa", "Careers"], ["Rara", "notaurl con espacios"]], links: {} }];
    const p = parseSheets(bad, planSheets(bad));
    expect(p.companies).toHaveLength(1);
    expect(p.errors[0].message).toContain("no es una URL válida");
  });
});

describe("operaciones del Radar", () => {
  const base = (): RadarState => {
    let s = EMPTY_RADAR;
    for (const [name, p] of [["Anthropic", "P1"], ["OpenAI", "P1"], ["Linear", "P3"]] as const) s = addCompany(s, { name, industries: ["IA"], priority: p }, 1).state;
    return s;
  };

  it("no duplica al agregar la misma empresa y reactiva una archivada", () => {
    let s = base();
    const id = Object.values(s.companies).find((c) => c.name === "Linear")!.id;
    s = archiveCompany(s, id, true, 2);
    const again = addCompany(s, { name: "linear", industries: ["Tech Startups"], priority: "P2" }, 3);
    expect(again.existed).toBe(true);
    expect(Object.keys(again.state.companies)).toHaveLength(3);
    expect(again.state.companies[id].archived).toBe(false);
    expect(again.state.companies[id].industries).toEqual(["IA", "Tech Startups"]);
  });

  it("reordena dentro de la prioridad y filtra por sector, prioridad y texto", () => {
    let s = base();
    const names = (st: RadarState) => filterCompanies(st, { industry: "todas", priority: "P1", region: "todas", q: "", archived: false }).map((c) => c.name);
    expect(names(s)).toEqual(["Anthropic", "OpenAI"]);
    s = move(s, Object.values(s.companies).find((c) => c.name === "OpenAI")!.id, -1, 2);
    expect(names(s)).toEqual(["OpenAI", "Anthropic"]);
    expect(filterCompanies(s, { industry: "Space", priority: "todas", region: "todas", q: "", archived: false })).toEqual([]);
    expect(filterCompanies(s, { industry: "todas", priority: "todas", region: "todas", q: "open", archived: false }).map((c) => c.name)).toEqual(["OpenAI"]);
  });

  it("une el Radar de dos dispositivos sin perder empresas ni cambios", () => {
    const a = addCompany(EMPTY_RADAR, { name: "Anthropic", industries: [], priority: "P1" }, 10).state;
    const b = addCompany(EMPTY_RADAR, { name: "OpenAI", industries: [], priority: "P2" }, 20).state;
    const m = mergeRadar(a, b);
    expect(Object.values(m.companies).map((c) => c.name).sort()).toEqual(["Anthropic", "OpenAI"]);
    const edited = setPriority(m, "nom:anthropic", "P3", 30);
    expect(mergeRadar(m, edited).companies["nom:anthropic"].priority).toBe("P3");
  });

  it("valida configuración: pesos que suman 100, zona horaria y valores fuera de rango", () => {
    expect(validWeights({ experiencia: 40, seniority: 20, ubicacion: 20, compensacion: 10, interes: 10 })).toBe(true);
    expect(validWeights({ experiencia: 50, seniority: 20, ubicacion: 20, compensacion: 10, interes: 10 })).toBe(false);
    const s = normalizeSettings({ timezone: "Marte/Olympus", threshold: 300, digestDay: 9, frequency: { P1: "cada hora" } });
    expect(s.timezone).toBe("America/Argentina/Buenos_Aires");
    expect(s.threshold).toBe(100);
    expect(s.digestDay).toBe(6);
    expect(s.frequency.P1).toBe("diaria");
  });
});
