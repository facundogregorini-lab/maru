import { describe, expect, it } from "vitest";
import { extract, familyFromTitle, familyOf, findSkills, seniorityFromTitle, yearsRequired } from "@/lib/match/extract";

describe("calidad de los avisos locales", () => {
  it.each([
    ["Analista de finanzas", "finanzas"], ["Analista de Contabilidad", "finanzas"],
    ["Analista de cuentas a pagar", "finanzas"], ["Analista de Presupuesto", "finanzas"],
    ["Analista Junior de Costos", "finanzas"], ["Senior Pricing Analyst", "finanzas"],
    ["Analista de comercio exterior sr", "logistica"], ["Analista de Calidad", "operaciones"],
    ["Data Reporting Analyst", "datos"], ["Crossborder Product Analyst", "producto"],
    ["Analista IT Networking", "software"], ["Analista de Redes y Telecomunicaciones", "software"],
    ["ADMINISTRADOR DE DOCUMENTOS", "administracion"], ["Analista Técnico Ssr", "otros"],
  ])("clasifica %s por el título explícito", (title, family) => expect(familyFromTitle(title)).toBe(family));
  it.each([
    ["Senior Full-Stack .Net", "software"], ["Technical Lead - Java", "software"], ["Senior Database Administrator", "software"],
    ["Account Manager", "ventas"], ["Preventista Zona Rosario", "ventas"], ["Promovendedor/a (Mar del Plata)", "ventas"],
    ["Operario/a de producción", "produccion"], ["Técnico de Mantenimiento Industrial", "produccion"], ["Oficial Electricista", "produccion"],
    ["Mechanical Engineer", "produccion"], ["Ingeniero de Procesos de Operaciones", "operaciones"],
    ["Ayudante de cocina", "gastronomia"], ["Mozo/a de salón", "gastronomia"], ["Mucama Hotel 5 Estrellas", "gastronomia"],
    ["Cajero/a", "comercio"], ["Repositor Externo Full Time", "comercio"], ["Vendedor de salón", "comercio"],
    ["Vigilador General CABA", "seguridad"], ["Chofer de reparto", "logistica"], ["Enfermero/a - Chofer", "salud"],
    ["AI Trainers Network - Spanish", "entrenamiento_ia"], ["Software Engineer (AI Training)", "entrenamiento_ia"], ["Ingeniero de Software (Entrenamiento de IA)", "entrenamiento_ia"], ["Driver / Data Collector in Cordoba, Spain", "entrenamiento_ia"],
    ["Analista de Liquidación de Sueldos", "rrhh"], ["Jefe de Personas & Cultura", "rrhh"],
    ["Representante de Envíos | Búsqueda para personas con discapacidad", "otros"],
    ["Analista de Financiamiento Inmobiliario", "finanzas"], ["Asesor Inmobiliario", "ventas"],
    ["Docente Desarrollo Full-Stack", "educacion"], ["Video Editor", "marketing"], ["Client Service Representative", "atencion_cliente"],
  ])("clasifica oficios y títulos que antes caían en Otros: %s", (title, family) => expect(familyFromTitle(title)).toBe(family));
  it.each([
    ["Ayudante de cocina", "junior"], ["Encargado/a de turno", "manager"], ["Practicante de Bienestar", "pasantia"],
  ])("deduce el seniority de %s", (title, seniority) => expect(seniorityFromTitle(title)).toBe(seniority));
  it("respeta el seniority semi senior explícito antes de buscar senior", () => {
    expect(seniorityFromTitle("Data Scientist Semi Senior")).toBe("semi_senior");
    expect(seniorityFromTitle("Data Scientist Senior")).toBe("senior");
  });
  it.each([
    ["10–15 years of professional graphic design experience", 10],
    ["3 to 5 years of experience", 3], ["Entre 2 y 4 años de experiencia", 2],
    ["1,5 años de experiencia", 1.5], ["2.5 years of experience", 2.5],
    ["100 years of experience", null], ["5+ years of experience", 5],
  ])("extrae el mínimo de %s sin tomar el último número del rango", (text, years) => expect(yearsRequired(text)).toBe(years));
});

describe("inglés implícito (aviso escrito en inglés)", async () => {
  const { extract, writtenInEnglish, ENGLISH_IMPLICIT } = await import("@/lib/match/extract");
  const en = "We are looking for a Customer Service Representative to join our team. You will handle calls with our clients and work with the collections team. This is a full-time role and you will report to the operations manager. Experience with CRM tools is a plus and we offer great benefits for the team.";
  const es = "Buscamos un representante de atención al cliente para sumarse a nuestro equipo. Vas a atender llamados de los clientes y trabajar con el equipo de cobranzas. Es un puesto full time con experiencia en CRM y la posibilidad de crecer en la empresa.";
  it("lo detecta y lo marca como requisito avanzado cuando el aviso no dice el nivel", () => {
    expect(writtenInEnglish(en)).toBe(true);
    expect(writtenInEnglish(es)).toBe(false);
    expect(extract({ title: "Customer Service Representative", descriptionText: en }).languages).toEqual([{ language: "inglés", level: ENGLISH_IMPLICIT, required: true }]);
    expect(extract({ title: "Representante de atención al cliente", descriptionText: es }).languages).toEqual([]);
  });
  it("detecta idiomas pedidos en el título", () => {
    expect(extract({ title: "Recruiter con CHINO", descriptionText: es }).languages.map((l) => l.language)).toContain("chino");
  });
  it("respeta el nivel cuando el aviso lo declara", () => {
    const langs = extract({ title: "Support", descriptionText: `${en} Intermediate English is required.` }).languages;
    expect(langs).toEqual([{ language: "inglés", level: "intermediate", required: true }]);
  });
});

describe("años pedidos y primer empleo", () => {
  it("lee los años en sus formas habituales", () => {
    expect(yearsRequired("Experiencia mínima de dos años en roles SEO")).toBe(2);
    expect(yearsRequired("must haves minimum 8 years of enterprise sales")).toBe(8);
    expect(yearsRequired("5 years of progressive experience in executive search")).toBe(5);
    expect(yearsRequired("3+ years designing and shipping websites")).toBe(3);
    expect(yearsRequired("Licenciatura en Administración de Empresas - mínimo 4 años de experiencia en contabilidad")).toBe(4);
    expect(yearsRequired("Experiencia mínima de 6 meses en atención al público")).toBe(0.5);
  });

  it("lee rangos en viñetas y frases de requisito, sin tomar la historia de la empresa", () => {
    expect(yearsRequired("What You Will Bring\n• 3 to 5 years hands-on in cybersecurity: SOC")).toBe(3);
    expect(yearsRequired("Requisitos\n• 4 a 5 años operando infraestructura de nube")).toBe(4);
    expect(yearsRequired("Experiencia: Mínimo de 8 años de trayectoria progresiva en posiciones directivas")).toBe(8);
    expect(yearsRequired("Requires 5 years clinical research/monitoring experience")).toBe(5);
    expect(yearsRequired("experiencia previa de 2 o 3 años como coordinador")).toBe(2);
    expect(yearsRequired("Experiencia Laboral\n\n• De 6 a 9 años con licenciatura")).toBe(6);
    expect(yearsRequired("We've been leading the way in technology projects for over 15 years.")).toBeNull();
    expect(yearsRequired("• No es necesario poseer experiencia previa\n\n4 meses de duración")).toBeNull();
  });

  it("no confunde edades ni la historia de la empresa", () => {
    expect(yearsRequired("Aceptamos primer empleo de 18 a 24 años")).toBeNull();
    expect(yearsRequired("Somos una empresa con más de 30 años de experiencia en el rubro")).toBeNull();
    expect(yearsRequired("con más de 20 años de trayectoria en el mercado")).toBeNull();
    expect(yearsRequired("Somos Redbee, una empresa argentina de tecnología con más de 14 años de experiencia.\nRequisitos\n• +6 años de experiencia como full stack")).toBe(6);
    expect(yearsRequired("Working with a financial company led by a management team with over 12 years of experience.")).toBeNull();
    expect(yearsRequired("Buscamos un profesional con más de 3 años de experiencia para una empresa líder.")).toBe(3);
  });

  it("un aviso sin experiencia previa es junior", () => {
    const e = extract({ title: "Vendedor/a de salón", descriptionText: "Buscamos personas para atención al público. No se requiere experiencia, te capacitamos." });
    expect(e.seniority).toMatchObject({ value: "junior", from: "descripcion" });
  });
});

describe("habilidades de áreas no técnicas", () => {
  it("reconoce herramientas y tareas de administración, RR. HH., logística y comercio", () => {
    const s = findSkills("Experiencia en facturación, conciliaciones bancarias y Tango Gestión. Manejo de WMS y control de stock. Licencia de conducir profesional. Liquidación de IVA e Ingresos Brutos. Clima laboral y onboarding.");
    for (const k of ["facturación", "conciliaciones bancarias", "tango gestión", "wms", "gestión de inventario", "licencia de conducir", "impuestos argentinos", "clima laboral", "onboarding"]) expect(s).toContain(k);
  });

  it("no toma beneficios ni etapas del proceso como habilidades", () => {
    const s = findSkills("Te brindamos capacitación constante. El proceso incluye 2 entrevistas. Ganancias por comisiones. Stock options.");
    expect(s).not.toContain("capacitación");
    expect(s).not.toContain("entrevistas por competencias");
    expect(s).not.toContain("impuestos argentinos");
    expect(s).not.toContain("gestión de inventario");
  });
});

describe("herramientas frecuentes en requisitos", () => {
  it("reconoce Office, Adobe, APIs REST, Git, Linux, redes y el stack de datos", () => {
    const s = findSkills("Manejo de paquete Office. Dominio de la Suite Adobe (Photoshop, Illustrator, InDesign). Experiencia con APIs REST, Git y Linux. Cableado estructurado. Spark, Databricks y dbt.");
    for (const k of ["microsoft office", "photoshop", "illustrator", "indesign", "apis rest", "git", "linux", "redes informáticas", "spark", "databricks", "dbt"]) expect(s).toContain(k);
  });
  it("no confunde home office, escalas ni macros de otro rubro", () => {
    const s = findSkills("Modalidad home office. Trabajo a gran escala. IP layout macros.");
    for (const k of ["microsoft office", "scala", "vba"]) expect(s).not.toContain(k);
  });
});

describe("habilidades de banca y marketing", () => {
  it("reconoce riesgo crediticio, prevención de lavado, mercado de capitales y trade marketing", () => {
    const s = findSkills("Análisis de crédito y scoring de cartera. Normativa de prevención de lavado (PLD/KYC). Renta fija. Trade marketing en punto de venta.");
    for (const k of ["riesgo crediticio", "prevención de lavado", "mercado de capitales", "trade marketing"]) expect(s).toContain(k);
  });
});

describe("área cuando el título no alcanza", () => {
  it("usa reglas extra del título, el área de la fuente y, por último, el texto", () => {
    expect(familyOf("Due Diligence Analyst - APAC").value).toBe("finanzas");
    expect(familyOf("Global Head of Go To Markets").value).toBe("marketing");
    expect(familyOf("Brazilian Subject Matter Expert in Sports").value).toBe("entrenamiento_ia");
    expect(familyOf("AI Workflow Automation Manager", "Clients").value).toBe("software");
    expect(familyOf("Comprador/a Senior - Victoria", "Contratos de Fabricación").value).toBe("logistica");
    expect(familyOf("Product Specialist", "Product")).toMatchObject({ value: "producto", from: "fuente" });
    expect(familyOf("Team Lead Monitoreo", "RISK")).toMatchObject({ value: "finanzas", from: "fuente" });
    expect(familyOf("Session Director", undefined, "Help us improve AI models by recording sessions for AI training projects.")).toMatchObject({ value: "entrenamiento_ia", from: "descripcion" });
  });

  it.each([
    ["Analista Sr FP&A", "finanzas"],
    ["Analista de Control de Gestión", "finanzas"],
    ["IT External Audit - Manager", "finanzas"],
    ["Lider de Medios de Pago", "finanzas"],
    ["Analista de RH (Caba)", "rrhh"],
    ["Compensation Analyst II", "rrhh"],
    ["Especialista Cloud", "software"],
    ["Analista de Seguridad Informática", "software"],
    ["Ingeniero/a de Redes SR", "software"],
    ["Analista Funcional SSR/SR", "software"],
    ["Analista de Medios Digitales", "marketing"],
    ["Generación de demanda / Lead Generator", "marketing"],
    ["Gerente de Sucursal / Tucumán.", "ventas"],
    ["Contract Negotiation Specialist", "legal"],
    ["Analista Ssr de Importaciones", "logistica"],
    ["Gerente de Excelencia Operativa", "operaciones"],
    ["Data Governance Lead", "datos"],
    ["Analista e-Commerce", "marketing"],
    ["Equity Capital Markets Support Team - Analyst", "finanzas"],
    ["Analista de siniestros RC", "finanzas"],
    ["Systems Analyst", "software"],
    ["Public Policy Manager, Economic Policy", "legal"],
    ["Vendor Management Specialist - Advanced", "logistica"],
    ["Especialista en Diseño CX", "diseno"],
    ["Analista de laboratorio", "otros"],
  ])("títulos que en la auditoría del 22/10 caían en otros: %s", (title, family) => expect(familyOf(title).value).toBe(family));

  it("lo que el título ya clasifica no cambia, y lo que no se sabe queda en otros", () => {
    expect(familyOf("Analista contable", "Product").value).toBe("finanzas");
    expect(familyOf("Professional Services Associate").value).toBe("otros");
    expect(familyOf("Specialist", "Todos los departamentos").value).toBe("otros");
  });
});

describe("asistente = junior", () => {
  it("un puesto de asistente sin nivel explícito cuenta como junior", () => {
    expect(seniorityFromTitle("Asistente contable")).toBe("junior");
    expect(seniorityFromTitle("Executive Assistant")).toBe("junior");
    expect(seniorityFromTitle("Asistente contable senior")).toBe("senior");
  });
});

describe("secciones de requisitos con otros nombres", () => {
  it("reconoce «About You», «Requerimientos» y «Competencias»", () => {
    const e = (descriptionText: string) => extract({ title: "Analista", descriptionText });
    expect(e("Sobre el puesto\nGestionar reportes.\nAbout You\n• Experiencia con SQL y Excel").skillsRequired).toContain("sql");
    expect(e("Tareas\nArmar tableros.\nRequerimientos:\n• Manejo de Power BI").skillsRequired.length).toBeGreaterThan(0);
    expect(e("Tareas\nArmar tableros.\nCompetencias clave\n• Excel avanzado").skillsRequired.length).toBeGreaterThan(0);
    // YPF pone todos sus requisitos bajo «¿Qué valoramos como diferencial?»: no se toma como sección de deseables.
    expect(e("¿Qué valoramos como diferencial?\n• Idioma: Inglés Intermedio\n• Conocimientos: Power BI").languages[0]).toMatchObject({ language: "inglés", required: true });
  });
  const e = (descriptionText: string) => extract({ title: "Analista", descriptionText });
  it("«plus» abre deseables sólo como título", () => {
    expect(e("Requirements\n• Golang\nStrong proficiency in Golang, plus working proficiency in Python.\n• SQL").skillsRequired).toContain("sql");
    expect(e("Requisitos\n• Excel\n¡Vení a vivir la experiencia Pluspetrol!\n• SQL").skillsRequired).toContain("sql");
    expect(e("Requisitos\n• Excel\nSerá un plus si contás con:\n• SQL").skillsRequired).not.toContain("sql");
  });
});

describe("inglés opcional dentro de los requisitos", () => {
  const en = (descriptionText: string) => extract({ title: "Analista", descriptionText }).languages.find((l) => l.language === "inglés");
  it("lo marca opcional si la misma línea lo dice", () => {
    expect(en("Requisitos\n• Excel avanzado\n• Inglés intermedio deseable")?.required).toBe(false);
    expect(en("Requisitos\n• Inglés básico (no excluyente)")?.required).toBe(false);
    expect(en("Requisitos\n• Idioma: Inglés preferentemente")?.required).toBe(false);
  });
  it("no se confunde con otra línea ni con otro idioma", () => {
    expect(en("Requirements\n• English advanced (C1)\nNice to have\n• Looker")?.required).toBe(true);
  });
});

describe("requisitos sin título de sección", () => {
  it("toma las viñetas que piden algo, pero no las de beneficios ni las tareas", () => {
    const e = extract({ title: "Data Analyst", descriptionText: "Buscamos un analista para el equipo.\n• 3+ años de experiencia con SQL y Python\n• Armar tableros semanales en Excel\nBeneficios\n• Experiencia de trabajo internacional con Tableau" });
    expect(e.skillsRequired).toEqual(expect.arrayContaining(["sql", "python"]));
    expect(e.skillsRequired).not.toContain("tableau");
  });
  it("si hay título de requisitos, manda ese", () => {
    const e = extract({ title: "Data Analyst", descriptionText: "• Experiencia con Excel\nRequisitos\n• SQL" });
    expect(e.skillsRequired).toContain("sql");
    expect(e.skillsRequired).not.toContain("excel");
  });
});

describe("seniority desde el nivel de la fuente y el texto", () => {
  const s = (title: string, descriptionText: string, seniorityHint?: string) => extract({ title, descriptionText, seniorityHint })?.seniority?.value ?? null;
  it("entiende los niveles de los portales", () => {
    expect(s("Vendedor", "Atención de clientes.", "Sin experiencia")).toBe("junior");
    expect(s("Analista", "Tareas varias.", "Intermedio")).toBe("semi_senior");
    expect(s("Gerente comercial", "Liderar el área.", "Gerencia / Alta Gerencia / Dirección")).toBe("manager");
    // Computrabajo: «Semi Sr» se leía como senior.
    expect(s("Analista Contable", "Tareas varias.", "Semi Sr")).toBe("semi_senior");
    expect(s("Ejecutivo de cuentas", "Tareas varias.", "Senior / Semi-Senior")).toBe("semi_senior");
    expect(s("Semi-Senior Designer", "Tareas varias.")).toBe("semi_senior");
    expect(s("Analista Pleno Gestión Comercial", "Tareas varias.")).toBe("semi_senior");
  });
  it("toma el nivel sólo de frases de búsqueda", () => {
    expect(s("Account Executive", "Buscamos sumar un/a senior account executive a nuestro equipo.")).toBe("senior");
    expect(s("Analista Contable", "Buscamos a una persona con perfil junior para el área.")).toBe("junior");
    expect(s("Risk Analyst", "Present findings to senior management.")).toBeNull();
    expect(s("Administrativo", "Empresa minera se encuentra en la búsqueda de un/a Administrativo/a Junior.")).toBe("junior");
    expect(s("Full Stack Engineer", "We are seeking a Senior engineer to join us.")).toBe("senior");
    expect(s("Desarrollador Mobile", "Estamos buscando un desarrollador mobile semi sr.")).toBe("semi_senior");
  });
});
