import { fold } from "./text";
import type { EmploymentType, Extracted, Field, LanguageReq, RoleFamily, Seniority } from "./types";

/**
 * Extracción por reglas (sin IA): familia de rol, seniority, tipo de contrato, idiomas,
 * habilidades obligatorias/deseables y años de experiencia. Cada dato guarda su procedencia.
 * Si algo no aparece, queda vacío: nunca se completa con supuestos.
 */

export const EXTRACTION_VERSION = 6;

/* ---------- Habilidades: término canónico → variantes (es/en) ---------- */

export const SKILLS: Record<string, string[]> = {
  // tecnología
  javascript: ["javascript", "js"],
  typescript: ["typescript"],
  python: ["python"],
  java: ["java"],
  "c#": ["c#", ".net", "dotnet"],
  go: ["golang"],
  ruby: ["ruby", "rails", "ruby on rails"],
  php: ["php", "laravel"],
  react: ["react", "react.js", "reactjs"],
  "node.js": ["node", "node.js", "nodejs"],
  angular: ["angular"],
  "vue.js": ["vue", "vue.js"],
  sql: ["sql", "postgresql", "postgres", "mysql"],
  aws: ["aws", "amazon web services"],
  gcp: ["gcp", "google cloud"],
  azure: ["azure"],
  docker: ["docker"],
  kubernetes: ["kubernetes", "k8s"],
  terraform: ["terraform"],
  "ci/cd": ["ci/cd", "continuous integration"],
  qa: ["qa", "quality assurance", "testing", "test automation", "automatización de pruebas"],
  ios: ["ios", "swift"],
  android: ["android", "kotlin"],
  "machine learning": ["machine learning", "ml", "aprendizaje automático"],
  "inteligencia artificial": ["ai", "artificial intelligence", "inteligencia artificial", "llm", "llms", "genai", "ia generativa"],
  ciberseguridad: ["cybersecurity", "security engineering", "ciberseguridad", "seguridad informática"],
  // datos y análisis
  excel: ["excel", "spreadsheets", "planillas", "hojas de cálculo"],
  "power bi": ["power bi", "powerbi"],
  tableau: ["tableau"],
  looker: ["looker"],
  "google analytics": ["google analytics", "ga4"],
  "análisis de datos": ["data analysis", "análisis de datos", "analytics", "analítica"],
  estadística: ["statistics", "estadística"],
  // producto y diseño
  "product management": ["product management", "gestión de producto", "product manager", "roadmap"],
  figma: ["figma"],
  "ux/ui": ["ux", "ui", "user experience", "experiencia de usuario", "ux/ui"],
  "user research": ["user research", "investigación de usuarios"],
  // marketing
  seo: ["seo"],
  sem: ["sem", "google ads", "paid search"],
  "performance marketing": ["performance marketing", "paid media", "medios pagos", "paid acquisition", "adquisición paga"],
  "meta ads": ["meta ads", "facebook ads", "instagram ads"],
  "marketing digital": ["digital marketing", "marketing digital"],
  "growth marketing": ["growth", "growth marketing", "growth hacking"],
  "email marketing": ["email marketing", "crm marketing", "lifecycle", "retention marketing", "retención"],
  "contenidos": ["content marketing", "copywriting", "contenidos", "redacción", "content creation"],
  "redes sociales": ["social media", "redes sociales", "community management"],
  ecommerce: ["ecommerce", "e-commerce", "comercio electrónico", "marketplace"],
  branding: ["branding", "marca", "brand"],
  // ventas y clientes
  ventas: ["sales", "ventas", "selling", "comercial"],
  "b2b": ["b2b"],
  "desarrollo de negocios": ["business development", "desarrollo de negocios", "partnerships", "alianzas"],
  prospección: ["prospecting", "prospección", "outbound", "lead generation", "generación de leads"],
  negociación: ["negotiation", "negociación"],
  crm: ["crm", "salesforce", "hubspot"],
  "customer success": ["customer success", "éxito del cliente", "account management", "gestión de cuentas"],
  "atención al cliente": ["customer service", "customer support", "atención al cliente", "soporte al cliente", "help desk", "zendesk"],
  // operaciones, finanzas, personas
  operaciones: ["operations", "operaciones", "process improvement", "mejora de procesos"],
  "supply chain": ["supply chain", "cadena de suministro", "logística", "logistics", "abastecimiento", "procurement", "compras"],
  "gestión de proyectos": ["project management", "gestión de proyectos", "pmp", "scrum", "agile", "metodologías ágiles", "jira"],
  contabilidad: ["accounting", "contabilidad", "contable", "accounts payable", "cuentas a pagar", "accounts receivable", "cuentas a cobrar"],
  finanzas: ["finance", "finanzas", "fp&a", "financial planning", "planeamiento financiero", "presupuesto", "budgeting"],
  impuestos: ["tax", "taxes", "impuestos", "tributaria"],
  auditoría: ["audit", "auditoría"],
  "recursos humanos": ["human resources", "recursos humanos", "rrhh", "people operations", "hr"],
  reclutamiento: ["recruiting", "recruitment", "reclutamiento", "talent acquisition", "selección"],
  payroll: ["payroll", "liquidación de sueldos", "nómina"],
  legal: ["legal", "compliance", "cumplimiento normativo", "contracts", "contratos"],
  sap: ["sap"],
  erp: ["erp", "netsuite", "oracle"],
  liderazgo: ["leadership", "liderazgo", "people management", "gestión de equipos", "team management", "liderar equipos"],
  "comunicación": ["communication skills", "comunicación"],
};

const SKILL_PATTERNS: [string, RegExp][] = Object.entries(SKILLS).map(([canon, variants]) => [
  canon,
  new RegExp(`(?:^|[^a-z0-9+#])(?:${variants.map((v) => fold(v).replace(/[.+#/]/g, (c) => `\\${c}`)).join("|")})(?![a-z0-9+#])`),
]);

export function findSkills(text: string): string[] {
  const f = ` ${fold(text)} `;
  return SKILL_PATTERNS.filter(([, re]) => re.test(f)).map(([canon]) => canon);
}

/* ---------- Secciones obligatorio / deseable ---------- */

const DESIRABLE_HEAD = /(nice to have|bonus|plus|preferred|deseable|valorable|suma|se valorar|would be great|extra points|ideally)/i;
const REQUIRED_HEAD = /(requirements|requisitos|qualifications|must have|what you.ll need|what we.re looking for|buscamos|you have|you bring|lo que necesit|skills|experience)/i;

/** Divide la descripción en bloques y los etiqueta según su encabezado. */
export function splitSections(text: string): { required: string; desirable: string; other: string } {
  const lines = text.split(/\n+/);
  let mode: "required" | "desirable" | "other" = "other";
  const out = { required: [] as string[], desirable: [] as string[], other: [] as string[] };
  for (const line of lines) {
    const isHeader = line.length < 90 && !line.startsWith("•");
    if (isHeader && DESIRABLE_HEAD.test(line)) mode = "desirable";
    else if (isHeader && REQUIRED_HEAD.test(line)) mode = "required";
    else if (isHeader && /(benefits|beneficios|what we offer|ofrecemos|about us|sobre nosotros|perks|why join)/i.test(line)) mode = "other";
    // Una viñeta suelta con "plus"/"deseable" es deseable aunque esté en requisitos.
    const target = line.startsWith("•") && DESIRABLE_HEAD.test(line) ? "desirable" : mode;
    out[target].push(line);
  }
  return { required: out.required.join("\n"), desirable: out.desirable.join("\n"), other: out.other.join("\n") };
}

/* ---------- Familia de rol ---------- */

/**
 * Primera regla que coincide. El orden importa: lo específico va antes que lo genérico
 * ("Data Collector" es entrenamiento de IA, no datos; "Operario de armado de pedidos" es logística, no producción).
 */
const FAMILY_RULES: [RoleFamily, RegExp][] = [
  ["entrenamiento_ia", /\b(ai trainers?|trainers network|ai tutor|data collector|recolector de datos|collecteur|data collection|video collection|data contributor|(audio|voice|video) (data )?contributor|rater|annotat|anotador|etiquetador|transcription|transcripci|linguists?|evaluator|validator|speech (& voice|and voice|data)|voice ai|(mathematics|physics|chemistry|biology|bioinformatics) expert)/],
  ["datos", /\b(data (analyst|scientist|science|engineer|reporting)|analista de datos|analista de reporting|cientific[oa] de datos|business intelligence|\bbi\b|analytics|insights analyst|research scientist|machine learning|ml engineer)/],
  ["producto", /\b(product (manager|owner|lead|director|operations|analyst|management)|desarrollo de producto|gerente de producto|\bpm\b|product ops)/],
  ["diseno", /\b(designer|diseñador|disenador|ux|ui|product design|motion|graphic|grafic)/],
  ["educacion", /\b(docente|profesor|maestr[oa] de)/],
  // Ingenierías que no son de software: antes que "engineer" (software).
  ["produccion", /\b((civil|mechanical|electrical|industrial|chemical|manufacturing|structural|maintenance) engineer|ingenier[oa]s? (civil|industrial|mecanic|electric|electromecanic|quimic|en alimentos|agronom|de planta|de mantenimiento|de produccion|de campo))/],
  ["software", /\b(it operations|cloud operations|network operations|security operations?|noc\b|soc analyst|engineer|developer|desarrollador|programador|programacion|software|devops|sre|qa|sdet|tester|frontend|backend|full[ -]?stack|architect|tech lead|technical lead|technical staff|cto|mobile|ios|android|infraestructura|sistemas|funcional cloud|it networking|network (analyst|administrator|support)|redes y telecomunicaciones|seguridad electronica|security analyst|aiops|database administrator|base de datos|dba|(it|desktop|technical|application) support|soporte (it|tecnico|de sistemas)|responsable de (it|tecnologia)|sap security)/],
  ["marketing", /\b(marketing|growth|seo\b|sem\b|ppc|programmatic|paid ads|paid social|affiliate (manager|marketing)|martech|content|contenido|copywriter|writer|editor|multimedia|podcast|ugc|creative (strategist|director)|art direction|brand|community|social media|media buyer|paid media|performance|crm|lifecycle|comunicaci|relaciones publicas|public relations|asuntos publicos)/],
  ["comercio", /\b(cajer[oa]s?|repositor[ae]?s?|reposicion|merchandiser|visual merchandising|mystery shopper|comprador sorpresa|store manager|responsable de tienda|lider de tienda|encargad[oa] de (local|tienda|sucursal)|vendedor[a]? de salon|atencion en (local|tienda|sucursal)|personal para caja)/],
  ["gastronomia", /\b(cocin[ae]|cociner[oa]|chef|mozo|moza|mozoa|camarer[oa]|bartender|barista|pizzero|pastel|panader|parrillero|bachero|mucama|hoteleria|room service|lavanderia|housekeeping|gastronom|restaurant)/],
  ["ventas", /\b(revenue operations|revops|sales operations|sales ops|sales|ventas|vendas|account executive|account manager|client partner|territory manager|industry manager|(channel|strategic|alliances?) partner(ship)? manager|partnership manager|sdr|bdr|business development|desarrollo de negocios|comercial|vendedor|prevendedor|preventista|promovendedor|promotor|telemarket|cold caller|lead generation|(agente|asesor|vendedor|corredor)[a]? inmobiliari|ejecutivo[a/ ]* de cuentas|partnerships|key account)/],
  ["atencion_cliente", /\b(customer (support|service|success|experience|care)|client service|support (agent|specialist)|atencion al (cliente|publico)|atencion a clientes|servicio al cliente|soporte|help ?desk|call center|onboarding specialist)/],
  ["finanzas", /\b(finance|financ|finanz|accountant|accounting|contador|contable|contabilidad|cuentas (a|por) (pagar|cobrar)|cuentas corrientes|cobranza|cobros|cobrador|receptor pagador|pago a proveedores|accounts (payables?|receivables?)|pricing|precios|costos|presupuesto|riesgo crediticio|credit|underwrit|claims|fraud|fraude|risk analyst|settlement|lending|valuation|derivatives|rates analysis|record to report|order to cash|fp&a|controller|tesorer|tesour|treasury|tax|impuest|auditor|billing|facturaci|impositivo|payroll|oficial de (empresas|negocios|cuentas))/],
  ["rrhh", /\b(recruit|talent|people|personas (y|&) cultura|(de|bp) personas\b|human resources|recursos humanos|rr\.? ?hh|hr |hrbp|seleccion|compensaci|beneficios|total rewards|relaciones laborales|liquidacion de sueldos|liquidador|job grading|bienestar)/],
  ["legal", /\b(legal|lawyer|abogad|counsel|compliance|paralegal|attorney|patent|judicial|mediaci|privacy)/],
  ["salud", /\b(nurse|enfermer|medic|doctor|clinical|clinic|pharma|farmac|health|salud|therap|psicolog|neurolog|cardiolog|fonoaudiolog|kinesiolog|odontolog|bioquimic|extraccionista|electromedicina|veterinari|adultos mayores|cuidador|social worker)/],
  ["seguridad", /\b(vigilador|vigilancia|seguridad (privada|fisica|patrimonial)|security guard|guardia de seguridad|personal (para|de) (empresa de )?seguridad|supervisor de seguridad|operador de monitoreo|monitoreo de (alarmas|camaras))/],
  ["logistica", /\b(logistic|logistica|logisitca|supply chain|warehouse|deposito|depot|fleet|transport|procurement|purchasing|compras|abastecimiento|last mile|comercio exterior|comex|global trade|procure to pay|chofer|conductor|driver|repartidor|reparto|cadete|picker|armad[oa] de pedidos|carga y descarga|mudanza|distribucion|stock|inventario|almacen|inbound|voyage)/],
  ["educacion", /\b(teacher|docente|profesor|maestr[oa] de|tutor|instructor|curriculum|education|educacion)/],
  ["consultoria", /\b(consultant|consultor|advisory|asesor)/],
  ["administracion", /\b(administrative|administrativ|administracion|administrador|assistant|asistente|office manager|recepcion|data entry|secretar|virtual assistant|archivo)/],
  ["produccion", /\b(operari[oa]s?|tecnic[oa]s? (de|en|electric|electronic|electromecanic|mecanic|industrial|de campo)|electrotecnic|electromecanic|electricista|mantenimiento|maintenance|metalurgic|soldador|tornero|plegador|albanil|pintor|carpinter|marmolero|torrero|liniero|topadorista|operador[a]? de (maquina|equipos|retro|grua|autoelevador|planta|produccion)|retroexcavadora|autoelevador|cnc|bobinad|extrusi|envasado|empaque|produccion|production|planta|industrial|construction|construccion|obra|estimator|proyectista|inspector|limpieza)/],
  ["operaciones", /\b(operations|operaciones|operation manager|ops\b|project manager|program manager|gerente de proyecto|coordinator|coordinador|process|procesos|business analyst|strategy|estrategia|calidad|quality analyst|mejora continua|planeamiento|planificaci|planning|planner|gestion de produccion|analista de gestion|analista ambiente|seguridad e higiene|transaction management)/],
];

/** "Operario/a", "Cocinero/a", "Repositores/as": se quita la variante de género para que las reglas no la repitan. */
const GENDER_SUFFIX = /\/(a|as|o|os|es|ra|ras)\b/g;

export function familyFromTitle(title: string): RoleFamily {
  const t = ` ${fold(title).replace(GENDER_SUFFIX, "")} `;
  for (const [fam, re] of FAMILY_RULES) if (re.test(t)) return fam;
  return "otros";
}

/* ---------- Seniority ---------- */

const SENIORITY_RULES: [Seniority, RegExp][] = [
  ["ejecutivo", /\b(chief|ceo|cto|cfo|coo|cmo|vp|vice ?president|vicepresidente|country manager|general manager|gerente general)\b/],
  ["director", /\b(director|directora|head of|head,|jefe de area)\b/],
  ["manager", /\b(manager|gerente|jefe|jefa|supervisor|supervisora|encargad[oa])\b/],
  ["lead", /\b(lead|lider|staff|principal|architect|arquitect)\b/],
  ["semi_senior", /\b(semi ?senior|ssr\.?|mid|mid-level|ii)\b/],
  ["senior", /\b(senior|sr\.?|sssr|iii)\b/],
  ["junior", /\b(junior|jr\.?|entry level|trainee|associate|graduate|i|ayudante|auxiliar|cadete|aprendiz|medio oficial)\b/],
  ["pasantia", /\b(intern|internship|pasante|pasantia|becari|practicante|practicas profesionales)\b/],
];

/** "Product Manager", "Account Manager"… suelen ser roles individuales: "manager" no indica gestión de personas. */
const IC_MANAGER = /\b(product|account|customer success|success|project|program|community|campaign|partner|partnership|office|case|key account|social media|channel|category|content|brand|ecommerce|e-commerce|growth|crm|lifecycle)\s+manager\b/g;

export function seniorityFromTitle(title: string): Seniority | null {
  const t = ` ${fold(title).replace(IC_MANAGER, "$1")} `;
  for (const [s, re] of SENIORITY_RULES) if (re.test(t)) return s;
  return null;
}

export function yearsRequired(text: string): number | null {
  const f = fold(text.replace(/[–—−]/g, "-").replace(/(\d),(\d)/g, "$1.$2"));
  const m = f.match(/(?<![\d.])\b(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:(?:-|to|a|y)\s*\d{1,2}(?:\.\d+)?\s*)?(?:years|year|anos|ano)\s+(?:of\s+)?(?:de\s+)?(?:experience|experiencia|exp\b|relevant|professional|in|en)/);
  const n = m ? Number(m[1]) : null;
  return n !== null && n > 0 && n < 31 ? n : null;
}

function seniorityFromYears(y: number): Seniority {
  if (y <= 1) return "junior";
  if (y <= 3) return "semi_senior";
  if (y <= 6) return "senior";
  return "lead";
}

/* ---------- Contrato ---------- */

export function employmentFromText(raw: string): EmploymentType | null {
  const t = fold(raw);
  if (/\b(intern|internship|pasantia|pasante)\b/.test(t)) return "pasantia";
  if (/\b(freelance|freelancer|independiente)\b/.test(t)) return "freelance";
  if (/\b(contract|contractor|contrato|monotribut|independent contractor|b2b contract)\b/.test(t)) return "contrato";
  if (/\b(part[- ]?time|medio tiempo|media jornada)\b/.test(t)) return "part_time";
  if (/\b(temporary|temporal|temp\b|eventual)\b/.test(t)) return "temporal";
  if (/\b(full[- ]?time|tiempo completo|jornada completa|relacion de dependencia|permanent|permanente)\b/.test(t)) return "full_time";
  return null;
}

/* ---------- Idiomas ---------- */

const LANGS: [string, RegExp][] = [
  ["inglés", /\b(english|ingles)\b/],
  ["portugués", /\b(portuguese|portugues)\b/],
  ["español", /\b(spanish|espanol|castellano)\b/],
  ["francés", /\b(french|frances)\b/],
  ["alemán", /\b(german|aleman)\b/],
  ["italiano", /\b(italian|italiano)\b/],
  ["chino", /\b(chinese|chino|mandarin)\b/],
  ["japonés", /\b(japanese|japones)\b/],
  ["ruso", /\b(russian|ruso)\b/],
  ["árabe", /\b(arabic|arabe)\b/],
  ["hebreo", /\b(hebrew|hebreo)\b/],
  ["neerlandés", /\b(dutch|neerlandes|holandes)\b/],
];
const LEVEL = /(native|nativo|bilingual|bilingue|fluent|fluido|fluency|proficient|advanced|avanzado|c2|c1|b2|b1|intermediate|intermedio|conversational|conversacional|basic|basico)/;

const EN_WORDS = new Set(["the", "and", "you", "will", "with", "our", "for", "are", "we", "your", "to", "of", "is", "in", "be", "this", "team", "experience"]);
const ES_WORDS = new Set(["el", "la", "los", "las", "de", "que", "y", "para", "con", "en", "nuestro", "nuestra", "una", "del", "por", "experiencia", "equipo"]);

/** ¿El aviso está escrito en inglés? Cuenta palabras funcionales de los primeros 2.000 caracteres. */
export function writtenInEnglish(text: string): boolean {
  let en = 0;
  let es = 0;
  for (const w of fold(text.slice(0, 2000)).split(/\s+/)) {
    if (EN_WORDS.has(w)) en++;
    else if (ES_WORDS.has(w)) es++;
  }
  return en >= 12 && en > 3 * es;
}

/** Nivel que se infiere cuando el aviso está escrito en inglés y no dice cuál pide. */
export const ENGLISH_IMPLICIT = "intermedio o más (el aviso está escrito en inglés)";

export function languagesFrom(text: string, desirableText: string): LanguageReq[] {
  const out: LanguageReq[] = [];
  const f = fold(text);
  const fd = fold(desirableText);
  for (const [lang, re] of LANGS) {
    const m = f.match(re);
    if (!m) continue;
    const around = f.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 60);
    // "Español" sólo cuenta si se pide como requisito, no si el aviso está escrito en español.
    if (lang === "español" && !LEVEL.test(around)) continue;
    const level = around.match(LEVEL)?.[1] ?? "";
    out.push({ language: lang, level, required: !re.test(fd) });
  }
  // Un aviso entero en inglés (típico de empresas de EE. UU.) casi siempre exige trabajar en inglés,
  // aunque no lo diga como requisito. Lo marcamos explícito para que el filtro de idioma funcione.
  if (writtenInEnglish(text)) {
    const en = out.find((l) => l.language === "inglés");
    if (!en) out.push({ language: "inglés", level: ENGLISH_IMPLICIT, required: true });
    else if (!en.level) en.level = ENGLISH_IMPLICIT;
  }
  return out;
}

export function timezoneNote(text: string): string | undefined {
  const m = text.match(/(?:UTC|GMT)\s?[-+−]\s?\d{1,2}(?::\d{2})?(?:\s?(?:to|a|-|–)\s?(?:UTC|GMT)?\s?[-+−]\s?\d{1,2})?|\b(?:EST|EDT|PST|PDT|CST|CET|ET|PT)\b[^.\n]{0,40}(?:overlap|hours|time ?zone|horario)|(?:overlap|superposici[oó]n)[^.\n]{0,60}/i);
  return m ? m[0].trim().slice(0, 120) : undefined;
}

/* ---------- Todo junto ---------- */

export function extract(input: {
  title: string;
  descriptionText: string;
  employmentHint?: string | null;
  seniorityHint?: string | null;
  department?: string;
}): Extracted {
  const { title, descriptionText } = input;
  const sections = splitSections(descriptionText);
  const req = findSkills(sections.required);
  const des = findSkills(sections.desirable).filter((s) => !req.includes(s));
  const all = findSkills(`${title}\n${descriptionText}`);
  const mentioned = all.filter((s) => !req.includes(s) && !des.includes(s));

  const famTitle = familyFromTitle(title);
  const family: Field<RoleFamily> =
    famTitle !== "otros" || !input.department
      ? { value: famTitle, from: "titulo", evidence: title }
      : { value: familyFromTitle(input.department), from: "fuente", evidence: input.department };

  const years = yearsRequired(sections.required || descriptionText);
  const sTitle = seniorityFromTitle(title);
  const sHint = input.seniorityHint ? seniorityFromTitle(input.seniorityHint) : null;
  const seniority: Field<Seniority> | null = sTitle
    ? { value: sTitle, from: "titulo", evidence: title }
    : sHint
      ? { value: sHint, from: "fuente", evidence: input.seniorityHint! }
      : years !== null
      ? { value: seniorityFromYears(years), from: "descripcion", evidence: `${years}+ años de experiencia` }
      : null;

  const hinted = input.employmentHint ? employmentFromText(input.employmentHint) : null;
  const fromDesc = hinted ? null : employmentFromText(`${title}\n${descriptionText.slice(0, 3000)}`);
  const employmentType: Field<EmploymentType> | null = hinted
    ? { value: hinted, from: "fuente", evidence: input.employmentHint! }
    : fromDesc
      ? { value: fromDesc, from: "descripcion" }
      : null;

  return {
    family,
    seniority,
    employmentType,
    // El título también cuenta: "Recruiter con chino", "Customer Support - Portuguese".
    languages: languagesFrom(`${title}\n${descriptionText}`, sections.desirable),
    skillsRequired: req,
    skillsDesirable: des,
    skillsMentioned: mentioned,
    yearsRequired: years,
  };
}
