import { fold } from "./text";
import type { EmploymentType, Extracted, Field, LanguageReq, RoleFamily, Seniority } from "./types";

/**
 * Extracción por reglas (sin IA): familia de rol, seniority, tipo de contrato, idiomas,
 * habilidades obligatorias/deseables y años de experiencia. Cada dato guarda su procedencia.
 * Si algo no aparece, queda vacío: nunca se completa con supuestos.
 */

export const EXTRACTION_VERSION = 24;

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
  // administración y finanzas (Argentina)
  facturación: ["facturación", "facturacion electronica", "invoicing", "billing"],
  "conciliaciones bancarias": ["conciliaciones bancarias", "conciliación bancaria", "conciliaciones", "bank reconciliation", "bank reconciliations", "reconciliations"],
  tesorería: ["tesorería", "treasury", "cash management", "flujo de fondos", "cash flow", "flujo de caja"],
  cobranzas: ["cobranzas", "gestión de cobranzas", "debt collection", "collections management", "créditos y cobranzas"],
  "impuestos argentinos": ["iva", "ingresos brutos", "impuesto a las ganancias", "afip", "arca", "liquidación de impuestos", "sicore", "siradig"],
  "tango gestión": ["tango", "tango gestión", "tango gestion"],
  bejerman: ["bejerman"],
  // personas
  onboarding: ["onboarding", "inducción"],
  "entrevistas por competencias": ["entrevistas por competencias", "realizar entrevistas", "interviewing", "competency-based interviews"],
  capacitación: ["gestión de capacitación", "diseño de capacitaciones", "programas de capacitación", "learning & development", "learning and development", "training and development", "l&d"],
  "clima laboral": ["clima laboral", "clima organizacional", "employee engagement", "encuesta de clima"],
  "relaciones laborales": ["relaciones laborales", "labor relations", "employee relations", "convenios colectivos"],
  "linkedin recruiter": ["linkedin recruiter"],
  // logística y comercio exterior
  wms: ["wms", "warehouse management system", "sistema de gestión de almacenes"],
  "gestión de inventario": ["gestión de inventario", "gestión de inventarios", "control de stock", "manejo de stock", "inventory management", "inventarios", "inventory control"],
  "comercio exterior": ["comercio exterior", "foreign trade", "importaciones", "exportaciones", "aduana", "customs", "despacho aduanero"],
  "planificación de demanda": ["planificación de demanda", "planeamiento de demanda", "demand planning", "s&op", "forecasting de demanda"],
  "última milla": ["última milla", "last mile", "ruteo", "routing de entregas", "distribución de mercadería"],
  autoelevador: ["autoelevador", "autoelevadorista", "clarkista", "forklift", "montacargas"],
  "licencia de conducir": ["licencia de conducir", "carnet de conducir", "registro de conducir", "licencia profesional", "driver's license", "drivers license"],
  // atención al público, comercio y oficios
  "atención al público": ["atención al público", "atencion al publico", "trato con el público", "public-facing"],
  "manejo de caja": ["manejo de caja", "arqueo de caja", "cash handling", "cobro en caja"],
  "venta telefónica": ["venta telefónica", "televentas", "telemarketing", "inside sales"],
  "visual merchandising": ["visual merchandising", "merchandising"],
  "manipulación de alimentos": ["manipulación de alimentos", "manipulador de alimentos", "food handling", "food safety"],
  "seguridad e higiene": ["seguridad e higiene", "higiene y seguridad", "hse", "ehs", "health and safety"],
  "mantenimiento preventivo": ["mantenimiento preventivo", "mantenimiento correctivo", "preventive maintenance"],
  // banca y finanzas
  "riesgo crediticio": ["riesgo crediticio", "riesgo de crédito", "credit risk", "análisis de crédito", "análisis crediticio", "credit analysis", "scoring", "credit scoring"],
  "prevención de lavado": ["prevención de lavado", "lavado de activos", "pld", "aml", "anti-money laundering", "kyc", "know your customer"],
  "mercado de capitales": ["mercado de capitales", "capital markets", "renta fija", "fixed income", "fondos comunes de inversión"],
  "modelos financieros": ["modelos financieros", "modelado financiero", "financial modeling", "financial modelling", "valuación de empresas", "dcf"],
  // marketing
  "trade marketing": ["trade marketing", "punto de venta", "pdv", "shopper marketing"],
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
// Auditoría del 22/10: «About You», «Who You Are», «Requerimientos», «Competencias», «Perfil buscado» no se reconocían.
const REQUIRED_HEAD = /(requirements|requisitos|qualifications|must have|what you.ll need|what we.re looking for|buscamos|you have|you bring|lo que necesit|skills|experience|about you|who you are|requerimientos|perfil (buscado|requerido)|tu perfil|qu[eé] necesit|^\s*-?\s*(competencias|conocimientos|formaci[oó]n|experiencia)( clave| t[eé]cnicos| requerida)?\s*:?\s*$)/i;

/**
 * Línea que pide algo a quien se postula: "• 3+ years of experience in…", "• Manejo de Excel avanzado".
 * Se usa sólo cuando el aviso no tiene un título de requisitos (22/10: 2.703 avisos elegibles sin requisitos así).
 */
const REQUIREMENT_CUE = /\b(experien\w*|conocimientos?|manejo de|dominio de|proven|strong (knowledge|experience|understanding|background)|familiar(ity)? with|knowledge of|proficien\w*|hands-on|years|anos de|excluyente|required|must|degree|bachelor|titulo|graduad[oa]s?|estudiante|nivel (avanzado|intermedio|basico)|ingles|english)\b/;

/** Divide la descripción en bloques y los etiqueta según su encabezado. */
export function splitSections(text: string): { required: string; desirable: string; other: string; implicit: string } {
  const lines = text.split(/\n+/);
  let mode: "required" | "desirable" | "other" = "other";
  // Dentro de "other": beneficios y "sobre nosotros" no piden nada.
  let offer = false;
  const out = { required: [] as string[], desirable: [] as string[], other: [] as string[], implicit: [] as string[] };
  for (const line of lines) {
    const isHeader = line.length < 90 && !line.startsWith("•");
    if (isHeader && DESIRABLE_HEAD.test(line)) mode = "desirable";
    else if (isHeader && REQUIRED_HEAD.test(line)) mode = "required";
    else if (isHeader && /(benefits|beneficios|what we offer|ofrecemos|about us|sobre nosotros|perks|why join)/i.test(line)) [mode, offer] = ["other", true];
    else if (isHeader && mode === "other" && line.trim().length < 60 && /[:?]\s*$|^[A-ZÁÉÍÓÚÑ¿][^.]*$/.test(line.trim())) offer = false;
    // Una viñeta suelta con "plus"/"deseable" es deseable aunque esté en requisitos.
    const target = line.startsWith("•") && DESIRABLE_HEAD.test(line) ? "desirable" : mode;
    out[target].push(line);
    if (target === "other" && !offer && line.startsWith("•") && REQUIREMENT_CUE.test(fold(line))) out.implicit.push(line);
  }
  return { required: out.required.join("\n"), desirable: out.desirable.join("\n"), other: out.other.join("\n"), implicit: out.implicit.join("\n") };
}

/* ---------- Familia de rol ---------- */

/**
 * Primera regla que coincide. El orden importa: lo específico va antes que lo genérico
 * ("Data Collector" es entrenamiento de IA, no datos; "Operario de armado de pedidos" es logística, no producción).
 */
const FAMILY_RULES: [RoleFamily, RegExp][] = [
  ["entrenamiento_ia", /\b(ai trainers?|ai training|entrenamiento de (la )?ia|ai code ranking|trainers network|ai tutor|data collector|recolector de datos|collecteur|data collection|video collection|data contributor|(audio|voice|video) (data )?contributor|rater|annotat|anotador|etiquetador|transcription|transcripci|linguists?|evaluator|validator|speech (& voice|and voice|data)|voice ai|(mathematics|physics|chemistry|biology|bioinformatics) expert)/],
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

/**
 * Títulos que las reglas principales no cubren ("Subject Matter Expert", "Due Diligence Analyst", "Go to Market").
 * Sólo se usan si el título no cae en ninguna regla principal, así no cambian lo ya clasificado.
 */
const EXTRA_TITLE_RULES: [RoleFamily, RegExp][] = [
  ["entrenamiento_ia", /\b(subject matter expert|domain expert|ai training|human data|generative ai analyst|evals?\b)/],
  ["finanzas", /\b(due diligence|ptp\b|asset titl|revenue management)/],
  ["marketing", /\b(customer insights|consumer insights|loyalty|cro\b|go[ -]to[ -]markets?|gtm\b|ambassador)/],
  ["ventas", /\b(partners? (manager|specialist)|soluciones digitales|leasing|tenant)/],
  ["software", /\b(incident manager|delivery (technical )?manager|technical program|automation|automatizaci|workflow)/],
  ["educacion", /\b(training specialist|enablement|career mentor|job placement)/],
  ["logistica", /\b(subcontrat|comprador)/],
  ["diseno", /\b(head of art|art director|animation)/],
  ["operaciones", /\b(gerente general|general manager|gerente de gestion|strategic project|project lead)/],
  // Auditoría del 22/10: 1.379 elegibles quedaban en "otros". El orden importa: la seguridad informática antes que
  // "riesgo" y las finanzas antes que "IT Audit". Sin reglas de salud ni producción: esos avisos profesionales
  // (ensayos clínicos, laboratorio) siguen en "otros", porque el filtro de importación deja afuera esas áreas.
  ["software", /\b(systems? analyst|threat hunting|sysadmin|arquitect|servicenow|dev\b|ingenier[oa]s? de redes|network engineer|it business|ciberseguridad|cybersecurity|cyber|seguridad informatica|seguridad de la informacion|information security|identity (and |& )?access|threat intelligence|incident response|malware|vulnerab|security (control|assessor|specialist)|cloud|sap\b|oracle|systems? administrator|administrador de sistemas|data center|it (analyst|service|support|manager|specialist|business partner)|trainee it|desarrollo it|analista funcional|functional analyst|analista tecnico funcional|technical (senior )?analyst|implementador de sistema|testing|bim\b|migration|edi\b|systems integration|po proxy|infrastructure|grc\b|technology (specialist|business))/],
  ["finanzas", /\b(capital markets|siniestros|activos fijos|cost optimization|medios de pago|accounts? payable|fx\b|audit|auditoria|fp ?a\b|fpa\b|control de gestion|controlling|control presupuestario|presupuest|capex|sox\b|control interno|internal control|actuari|seguros?\b|insurance|perdida esperada|mercado de capitales|wealth|margin analyst|product control|trading|titulos|aml\b|kyc\b|lavado de dinero|deals?\b|payments?\b|pagos|adquiren|collections|banking|banca|inversion|investment|riesgos?\b|risk)/],
  ["legal", /\b(public policy|politicas publicas|contracts? (specialist|manager|negotiation|advisor)|contract negotiation|contratos|contractual|regulatory|asuntos regulatorios|filings|immigration)/],
  ["diseno", /\b(diseno (cx|ux|ui|grafico|de experiencia|de producto|de servicios)|cx design|service design)/],
  ["datos", /\b(big data|data (specialist|integration|governance|management|quality|lead)|datos maestros|master data|reportes|reporting)/],
  ["marketing", /\b(consumer insights?|analista de categorias|category (manager|analyst)|e-commerce|generacion de demanda|demand generation|lead generat|jefe de producto|medios|media (manager|specialist|planner|buyer)|paid (search|advertising)|ads specialist|meta ads|campaign|campaing|influencer|e ?commerce|dtc\b|marketplace|category management|market access|conversion rate|search engine|creative|illustrat|lanzamiento|propuesta de valor|events?\b|eventos|analista digital)/],
  ["ventas", /\b(channel manager|alliance|relationship manager|client lead|commercial manager|sucursal|wholesale|franquicia|preventa|presales|pre sales|tender|quotation|rfp\b|proposal|business solutions|customer relationship|customer engagement|planes de ahorro|hunter|desarrollo de negocio)/],
  ["rrhh", /\b(departamento (de )?pessoal|rh\b|staffing|benefits|compensation|desarrollo y formacion|formacion|learning|resource management|wfm\b|workforce)/],
  ["logistica", /\b(vendor management|comercio internacional|importaci|exportaci|import ?export|sourcing|commodity|trafico|material master|hazardous materials|aduana)/],
  ["operaciones", /\b(gestion operativa|excelencia operativa|confiabilidad|reliability|oficina tecnica|traceability|transformation|proyectos?\b|projects?\b|program lead|planing|s ?op\b|demanda|demand|back office|hse\b|she\b|medio ambiente|environmental|seguridad operativa)/],
  ["consultoria", /\b(consulting|parthenon)/],
  ["administracion", /\b(documentacion|document specialist|archiving)/],
];

/** Áreas que informan algunas fuentes ("Technology & Product", "Risk", "Global Languages Services"). */
const DEPARTMENT_RULES: [RoleFamily, RegExp][] = [
  ["entrenamiento_ia", /\b(languages? services|ai services|stem|ai internal|welo data)/],
  ["datos", /\b(data|analytics)/],
  ["producto", /^\s*product\s*$|\bproduct (management|team)\b/],
  ["software", /\b(tech|technology|engineering|it\b|sistemas|tecnologia)/],
  ["finanzas", /\b(risk|riesgo|finance|finanzas|accounting)/],
  ["diseno", /\b(creative|design|diseno)/],
  ["ventas", /\b(commercial|comercial|go to market|sales|ventas|partners)/],
  ["atencion_cliente", /\b(clients?|customers?|service)\b/],
  ["produccion", /\b(fabricacion|manufactur|produccion)/],
];

/** Pistas fuertes en el texto del aviso: proyectos para entrenar modelos de IA. */
const AI_PROJECT_TEXT = /\b(train(ing)? (ai|llm|large language) models?|training data for( frontier)? ai|improve (ai|llm) models?|rlhf|ai training (project|platform)|evaluate ai (responses|outputs)|entrenar modelos de (ia|inteligencia artificial))\b/;

/** Área del puesto: el título manda; si no alcanza, el área que informa la fuente y por último el texto del aviso. */
export function familyOf(title: string, department?: string, description = ""): Field<RoleFamily> {
  const famTitle = familyFromTitle(title);
  if (famTitle !== "otros") return { value: famTitle, from: "titulo", evidence: title };
  const t = ` ${fold(title).replace(GENDER_SUFFIX, "")} `.replace(/\s+$/, "");
  const extra = EXTRA_TITLE_RULES.find(([, re]) => re.test(t));
  if (extra) return { value: extra[0], from: "titulo", evidence: title };
  if (department) {
    const byRules = familyFromTitle(department);
    const d = ` ${fold(department)} `;
    const fam = byRules !== "otros" ? byRules : DEPARTMENT_RULES.find(([, re]) => re.test(d))?.[0];
    if (fam) return { value: fam, from: "fuente", evidence: department };
  }
  if (AI_PROJECT_TEXT.test(fold(description.slice(0, 3000)))) return { value: "entrenamiento_ia", from: "descripcion", evidence: "Proyecto para entrenar o evaluar modelos de IA" };
  return { value: "otros", from: "titulo", evidence: title };
}

/** "Operario/a", "Cocinero/a", "Repositores/as": se quita la variante de género para que las reglas no la repitan. */
const GENDER_SUFFIX = /\/(a|as|o|os|es|ra|ras)\b/g;

export function familyFromTitle(title: string): RoleFamily {
  const t = ` ${fold(title).replace(GENDER_SUFFIX, "")} `;
  for (const [fam, re] of FAMILY_RULES) if (re.test(t)) return fam;
  return "otros";
}

/* ---------- Seniority ---------- */

const SENIORITY_RULES: [Seniority, RegExp][] = [
  ["ejecutivo", /\b(chief|ceo|cto|cfo|coo|cmo|[se]?vp|avp|vice ?president|vicepresidente|country manager|general manager|gerente general)\b/],
  ["director", /\b(director|directora|head of|head,|jefe de area)\b/],
  ["manager", /\b(manager|gerente|jefe|jefa|supervisor|supervisora|encargad[oa])\b/],
  ["lead", /\b(lead|lider|staff|principal|architect|arquitect)\b/],
  ["semi_senior", /\b(semi ?senior|ssr\.?|mid|mid-level|ii)\b/],
  ["senior", /\b(senior|sr\.?|sssr|iii)\b/],
  ["junior", /\b(junior|jr\.?|entry level|trainee|associate|graduate|i|ayudante|auxiliar|asistente|assistant|cadete|aprendiz|medio oficial)\b/],
  ["pasantia", /\b(intern|internship|pasante|pasantia|becari|practicante|practicas profesionales)\b/],
];

/** "Product Manager", "Account Manager"… suelen ser roles individuales: "manager" no indica gestión de personas. */
const IC_MANAGER = /\b(product|account|customer success|success|project|program|community|campaign|partner|partnership|office|case|key account|social media|channel|category|content|brand|ecommerce|e-commerce|growth|crm|lifecycle)\s+manager\b/g;

/** Niveles que informan los portales con otras palabras (Bumeran, Computrabajo, LinkedIn). */
const HINT_LEVELS: [Seniority, RegExp][] = [
  ["junior", /^(sin experiencia|entry level|internship|pasantia)$/],
  ["semi_senior", /^(intermedio|algo de responsabilidad|mid[- ]senior level)$/],
  ["director", /^(gerencia|director)/],
  ["ejecutivo", /^(executive|ejecutivo)$/],
];
export function seniorityFromHint(hint: string): Seniority | null {
  const h = fold(hint).trim();
  return HINT_LEVELS.find(([, re]) => re.test(h))?.[0] ?? null;
}

/** "Buscamos un/a PM Senior…", "con perfil semi senior": el nivel dicho en el texto, sólo en esas frases. */
const BODY_LEVEL = /\b(?:buscamos|incorporar|incorpora|sumar|we are looking for|we're looking for|looking for)\s+(?:a |an |un |una |un\/a )?(?:[a-z0-9.+#/-]+\s+){0,5}?(semi ?senior|ssr|senior|sr|junior|jr|trainee)\b|\bperfil (semi ?senior|ssr|senior|sr|junior|jr)\b/;
export function seniorityFromBody(text: string): { value: Seniority; evidence: string } | null {
  const m = fold(text.slice(0, 3000)).match(BODY_LEVEL);
  if (!m) return null;
  const w = (m[1] ?? m[2]).replace(" ", "");
  const value: Seniority = /^(semisenior|ssr)$/.test(w) ? "semi_senior" : /^(senior|sr)$/.test(w) ? "senior" : "junior";
  return { value, evidence: m[0].slice(0, 80) };
}

export function seniorityFromTitle(title: string): Seniority | null {
  const t = ` ${fold(title).replace(IC_MANAGER, "$1")} `;
  for (const [s, re] of SENIORITY_RULES) if (re.test(t)) return s;
  return null;
}

const NUM_WORD: Record<string, number> = { un: 1, uno: 1, una: 1, one: 1, dos: 2, two: 2, tres: 3, three: 3, cuatro: 4, four: 4, cinco: 5, five: 5, seis: 6, six: 6, siete: 7, seven: 7, ocho: 8, eight: 8, diez: 10, ten: 10 };
const N = String.raw`(\d{1,2}(?:\.\d+)?|un|uno|una|one|dos|two|tres|three|cuatro|four|cinco|five|seis|six|siete|seven|ocho|eight|diez|ten)`;
const RANGE_TAIL = String.raw`\s*\+?\s*(?:(?:-|to|a|y|o|or)\s*\d{1,2}(?:\.\d+)?\s*)?`;
const YEARS = String.raw`(?:years?|yrs|anos?)`;
const EXP = String.raw`(?:experience|experiencia|exp\b)`;
/** Patrones de años pedidos: "3+ años de experiencia", "5 years of progressive experience", "experiencia mínima de dos años", "3+ years". */
/** El tercer valor indica una frase de requisito explícita ("mínimo de 8 años de trayectoria"): ahí no aplica COMPANY_AFTER. */
const YEAR_PATTERNS: [RegExp, number, boolean?][] = [
  [new RegExp(String.raw`(?<![\d.])\b${N}${RANGE_TAIL}${YEARS}\s+(?:of\s+|de\s+)?(?:(?:[a-z-]+\s+){0,3}?${EXP}|relevant|professional|in\b|en\b)`), 1],
  [new RegExp(String.raw`${EXP}\s+(?:(?:minima|comprobable|previa|laboral|progresiva|demostrable)\s+)*(?:-\s*)?(?:de\s+|of\s+|between\s+|entre\s+|:\s*)?(?:al menos\s+|at least\s+|mas de\s+)?${N}${RANGE_TAIL}${YEARS}\b`), 1],
  [new RegExp(String.raw`(?<![\d.])\b(\d{1,2})\s*\+\s*${YEARS}\b`), 1],
  [new RegExp(String.raw`\b(?:minimum|minimo|at least|al menos)\s+(?:de\s+|of\s+)?${N}${RANGE_TAIL}${YEARS}\b`), 1],
  [new RegExp(String.raw`(?<![\d.])\b${N}\s+meses\s+de\s+${EXP}|${EXP}\s+(?:(?:minima|comprobable|previa)\s+)*(?:de\s+)?${N}\s+meses`), 1 / 12],
  // Auditoría del 22/10: "Requires 5 years clinical research", "idealmente entre 2 y 3 años", "Mínimo de 8 años de trayectoria".
  [new RegExp(String.raw`\b(?:minimo|minimum|al menos|at least|requires?|requiere|requerimos|must have|cuentes con|tengas|poseas|posean|idealmente|ideally|entre|between)\s+(?:de\s+|of\s+)?${N}${RANGE_TAIL}${YEARS}\b`), 1, true],
  // Al principio de una viñeta o después de un guión: "• 3 to 5 years hands-on in cybersecurity", "EXPERIENCE - 2-4 years".
  [new RegExp(String.raw`(?:\n\s*|\s-\s*)${N}${RANGE_TAIL}${YEARS}\b`), 1],
];
/** "Una empresa con más de 30 años de experiencia" habla de la empresa, no del puesto. */
const ABOUT_COMPANY = /\b(empresa|compania|company|firma|organizacion|we have|we've|tenemos|contamos con|founded|fundad[ao]|hace)\b[^.,;-]{0,15}$/;
const COMPANY_AFTER = /^\s*(business|the market|el mercado|el rubro|de trayectoria|de historia)\b/;

export function yearsRequired(text: string): number | null {
  // El principio de cada línea o viñeta queda como " - ": fold junta los saltos de línea.
  const f = fold(text.replace(/[–—−]/g, "-").replace(/(\d),(\d)/g, "$1.$2").replace(/\n\s*[•*·▪◦-]?\s*/g, " - "));
  let best: { at: number; years: number } | null = null;
  for (const [re, unit, explicit] of YEAR_PATTERNS) {
    for (const m of f.matchAll(new RegExp(re.source, "g"))) {
      const raw = m.slice(1).find((g) => g !== undefined);
      const at = m.index ?? 0;
      if (!raw || ABOUT_COMPANY.test(f.slice(Math.max(0, at - 50), at)) || (!explicit && COMPANY_AFTER.test(f.slice(at + m[0].length)))) continue;
      const n = (NUM_WORD[raw] ?? Number(raw)) * unit;
      // Más de 15 años casi siempre es una edad ("de 18 a 24 años") o la historia de la empresa.
      if (n > 0 && n <= 15 && (!best || at < best.at)) best = { at, years: Math.round(n * 10) / 10 };
      break;
    }
  }
  return best?.years ?? null;
}

/** Avisos de primer empleo: "sin experiencia", "no se requiere experiencia", "entry level". */
const ENTRY_LEVEL = /\b(sin experiencia|no (se )?requiere(s|n)? experiencia|no es necesaria experiencia|no necesitas experiencia|primer empleo|primera experiencia laboral|no (prior )?experience (is )?(required|needed|necessary)|entry[- ]level)\b/;
export const isEntryLevel = (text: string) => ENTRY_LEVEL.test(fold(text));

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

const OPTIONAL_INLINE = /\b(deseable|valorable|plus|no excluyente|preferentemente|preferred|nice to have|opcional|optional)\b/;
const OPTIONAL_BEFORE = /\b(deseable|valorable|preferentemente|preferred|nice to have|opcional|optional)\b/;

export function languagesFrom(text: string, desirableText: string): LanguageReq[] {
  const out: LanguageReq[] = [];
  const f = fold(text);
  const fd = fold(desirableText);
  const lines = text.split("\n").map(fold).join("\n");
  for (const [lang, re] of LANGS) {
    const m = f.match(re);
    if (!m) continue;
    const around = f.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + 60);
    // "Español" sólo cuenta si se pide como requisito, no si el aviso está escrito en español.
    if (lang === "español" && !LEVEL.test(around)) continue;
    const level = around.match(LEVEL)?.[1] ?? "";
    // "Inglés intermedio deseable", "Deseable: inglés", "inglés no excluyente": opcional aunque esté en la sección
    // de requisitos (22/10: 63 de 307 avisos así figuraban como requisito y no salían con «Sin requisito de inglés»).
    // Se mira la misma línea: "English advanced (C1)" seguido de un título "Nice to have" no es opcional.
    const lm = lines.match(re);
    const at = lm?.index ?? 0;
    const before = lm ? (lines.slice(Math.max(0, at - 30), at).split(/[.;\n]/).pop() ?? "") : "";
    // Hasta el próximo idioma: en "inglés y español (el portugués es un plus)" el plus es del portugués.
    const after = lm ? lines.slice(at + lm[0].length, at + lm[0].length + 45).split(/[.;\n]|\b(?:portugu|frances|french|aleman|german|italian|chin|espanol|spanish)/)[0] : "";
    // Antes, sin "plus": en "Portuguese, plus business-level English" el plus es "además".
    const optional = OPTIONAL_INLINE.test(after) || OPTIONAL_BEFORE.test(before);
    out.push({ language: lang, level, required: !optional && !re.test(fd) });
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
  // Sin título de requisitos, las viñetas que piden algo ("• Manejo de Excel avanzado") hacen de requisitos.
  const reqText = sections.required.trim() ? sections.required : sections.implicit;
  const req = findSkills(reqText);
  const des = findSkills(sections.desirable).filter((s) => !req.includes(s));
  const all = findSkills(`${title}\n${descriptionText}`);
  const mentioned = all.filter((s) => !req.includes(s) && !des.includes(s));

  const family = familyOf(title, input.department, descriptionText);

  const years = (sections.required ? yearsRequired(sections.required) : null) ?? yearsRequired(descriptionText);
  const sTitle = seniorityFromTitle(title);
  const sHint = input.seniorityHint ? (seniorityFromTitle(input.seniorityHint) ?? seniorityFromHint(input.seniorityHint)) : null;
  const sBody = sTitle || sHint ? null : seniorityFromBody(descriptionText);
  const seniority: Field<Seniority> | null = sTitle
    ? { value: sTitle, from: "titulo", evidence: title }
    : sHint
      ? { value: sHint, from: "fuente", evidence: input.seniorityHint! }
      : sBody
      ? { value: sBody.value, from: "descripcion", evidence: sBody.evidence }
      : years !== null
      ? { value: seniorityFromYears(years), from: "descripcion", evidence: `${years}+ años de experiencia` }
      : isEntryLevel(descriptionText)
      ? { value: "junior", from: "descripcion", evidence: "No pide experiencia previa" }
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
