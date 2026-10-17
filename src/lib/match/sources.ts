import type { SourceKind, SourceStatus } from "./types";

/**
 * Registro de fuentes de vacantes: qué se usa, cómo y bajo qué condiciones.
 * Revisado el 2026-10-15 contra la documentación pública de cada fuente (links en `docs`).
 *
 * Regla: sólo `enabled: true` cuando la fuente es gratuita sin prueba ni tarjeta, no exige credenciales
 * que no tengamos y sus condiciones publicadas son compatibles con mostrar avisos en Maru
 * (ranking sin registro, con atribución y enlace a la fuente). Nada se contrata ni se consume pago.
 */
export type SourceInfo = {
  id: string;
  name: string;
  kind: SourceKind;
  docs: string[];
  access: string;
  /** Lo que las condiciones permiten/exigen para guardar, mostrar y atribuir. */
  terms: string;
  limits: string;
  reviewedAt: string;
  status: SourceStatus;
  enabled: boolean;
  cost: "gratis" | "pago" | "cuota_finita";
  /** El feed trae sólo los últimos N avisos: una ausencia no prueba cierre. */
  partialFeed: boolean;
  /** Hay que usar la URL de la fuente como enlace de postulación/visualización. */
  linkRequired: boolean;
  attribution?: string;
  notes?: string;
  /**
   * Importación manual con cuota (workflow match-providers): la sync diaria no la consulta, pero
   * conserva sus avisos y los vence por fecha de la fuente o por `staleDays` sin volver a verlos.
   */
  imported?: boolean;
  staleDays?: number;
};

const REVIEWED = "2026-10-15";

export const SOURCES: SourceInfo[] = [
  {
    id: "greenhouse",
    name: "Greenhouse Job Board API",
    kind: "ats",
    docs: ["https://developers.greenhouse.io/job-board.html", "https://docs.greenhouse.io/job-board.html"],
    access: "GET https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true (sin autenticación). Boards EU: boards-api.eu.greenhouse.io.",
    terms:
      "La documentación declara que los GET son públicos y no requieren autenticación, pero no publica términos de reutilización. Uso conservador: indexamos para hacer match, mostramos sólo cargo, empresa, ubicación y un extracto, y enviamos a la persona a la URL del empleador (absolute_url) para leer y postularse.",
    limits: "Sin límite documentado. Hacemos 1 request por empresa por sincronización, en serie, con backoff.",
    reviewedAt: REVIEWED,
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: false,
    notes: "Acceso público ≠ licencia de republicación: antes de un lanzamiento comercial amplio conviene revisión legal.",
  },
  {
    id: "lever",
    name: "Lever Postings API",
    kind: "ats",
    docs: ["https://github.com/lever/postings-api"],
    access: "GET https://api.lever.co/v0/postings/{site}?mode=json&skip=&limit= (EU: api.eu.lever.co). Sin autenticación.",
    terms:
      "Pensada para que las empresas armen su sitio de empleos; sólo expone avisos publicados y advierte que pueden ser leídos por terceros. Sin términos de redistribución explícitos: mismo uso conservador que Greenhouse (extracto + enlace al aviso hostedUrl/applyUrl).",
    limits: "Límite documentado sólo para POST de postulaciones (2/s). Paginamos de a 100 con pausa entre páginas.",
    reviewedAt: REVIEWED,
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: false,
  },
  {
    id: "ashby",
    name: "Ashby Public Job Posting API",
    kind: "ats",
    docs: ["https://developers.ashbyhq.com/docs/public-job-posting-api"],
    access: "GET https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true. Sin autenticación.",
    terms:
      "Documentación sin términos de uso, caché ni redistribución. Respetamos isListed=false (no se muestran) y enviamos al jobUrl/applyUrl del empleador.",
    limits: "Sin límite documentado. 1 request por empresa por sincronización.",
    reviewedAt: REVIEWED,
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: false,
  },
  {
    id: "teamtailor",
    name: "Teamtailor (RSS del sitio de empleo)",
    kind: "ats",
    docs: ["https://support.teamtailor.com/en/articles/11171756-rss-feed-how-to-guide"],
    access: "GET https://<sitio>/jobs.rss?per_page=100&offset=N (sin autenticación).",
    terms:
      "La guía de Teamtailor documenta el feed RSS de cada sitio de empleo y aclara que sus datos son públicos (se usa, por ejemplo, para Job Wrapping de LinkedIn). Mismo uso conservador que Greenhouse: extracto y enlace al aviso del empleador.",
    limits: "100 avisos por página; 1 sitio por empresa y por sincronización, en serie.",
    reviewedAt: "2026-10-16",
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: false,
    notes: "Las etiquetas propias (remoteStatus, tt:location, tt:department) salen de implementaciones de terceros: el parser las lee si están y si no deja el dato como desconocido.",
  },
  {
    id: "smartrecruiters",
    name: "SmartRecruiters (Posting API pública)",
    kind: "ats",
    docs: ["https://developers.smartrecruiters.com/docs/posting-api"],
    access: "GET https://api.smartrecruiters.com/v1/companies/<empresa>/postings?country=ar y /postings/<id> (sin autenticación).",
    terms:
      "La Posting API es pública y está pensada para mostrar los avisos de la empresa fuera de su sitio. Mismo uso conservador que Greenhouse: extracto y enlace al aviso del empleador.",
    limits: "100 por página; sólo avisos de Argentina; hasta 40 detalles por empresa y sincronización, en serie.",
    reviewedAt: "2026-10-17",
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: false,
  },
  {
    id: "recruitee",
    name: "Recruitee (API del sitio de empleo)",
    kind: "ats",
    docs: ["https://docs.recruitee.com/reference/offers"],
    access: "GET https://<cuenta>.recruitee.com/api/offers/ (sin autenticación).",
    terms: "Es la API pública con la que cada empresa arma su sitio de empleo. Extracto y enlace al aviso del empleador.",
    limits: "1 pedido por empresa y sincronización.",
    reviewedAt: "2026-10-17",
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: false,
  },
  {
    id: "workday",
    name: "Workday (búsqueda del sitio de empleo de cada empresa)",
    kind: "ats",
    docs: ["https://pwc.wd3.myworkdayjobs.com/Global_Experienced_Careers"],
    access: "POST https://<empresa>.<wdN>.myworkdayjobs.com/wday/cxs/<empresa>/<sitio>/jobs con searchText=Argentina y GET del detalle (sin autenticación).",
    terms:
      "No es una API documentada: es la búsqueda JSON que usa el propio sitio de empleo público de la empresa. Uso mínimo y conservador: sólo avisos de Argentina, en serie, extracto y enlace al aviso del empleador. Si una empresa lo bloquea o pide que no se use, se la excluye del directorio.",
    limits: "20 por página, hasta 5 páginas y 40 detalles por empresa y sincronización.",
    reviewedAt: "2026-10-17",
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: false,
    notes: "El sitio se identifica como <empresa>.<wdN>.<sitio>, tomado de avisos reales de esa empresa.",
  },
  {
    id: "getonbrd",
    name: "Get on Board (API pública)",
    kind: "portal",
    docs: ["https://www.getonbrd.com/help/what-can-i-do-with-get-on-board-s-api", "https://www.getonbrd.com/api-doc.html"],
    access: "GET https://www.getonbrd.com/api/v0/categories/{categoria}/jobs?per_page=100&page=N&expand=[\"company\"]. La API pública no requiere configuración.",
    terms:
      "Su centro de ayuda permite explícitamente mostrar avisos publicados en otro sitio y armar un buscador o bolsa de empleo con los listados públicos. Mostramos atribución y el enlace público del aviso.",
    limits: "Sin límite publicado. Paginamos con pausa de 1 s y tope de páginas por categoría.",
    reviewedAt: REVIEWED,
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: true,
    attribution: "Publicado en Get on Board",
    notes: "No pudimos leer la referencia técnica desde este entorno: el formato de respuesta se valida en la primera sincronización; si no coincide, la fuente queda 'fallida' sin afectar a las demás.",
  },
  {
    id: "jobicy",
    name: "Jobicy Remote Jobs API",
    kind: "portal",
    docs: ["https://github.com/Jobicy/remote-jobs-api"],
    access: "GET https://jobicy.com/api/v2/remote-jobs?count=200 (sin autenticación).",
    terms:
      "Uso permitido en productos sin pedir permiso individual. Exige mantener a Jobicy como fuente y conservar la URL canónica del aviso; prohíbe presentarlos como propios. Mostramos atribución y enlazamos a jobicy.com.",
    limits: "No consultar automáticamente más de una vez por hora. Sincronizamos como máximo 1 vez por día.",
    reviewedAt: REVIEWED,
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: true,
    linkRequired: true,
    attribution: "Publicado en Jobicy",
    notes: "jobGeo='Anywhere' es el valor por defecto cuando el aviso no informa región: lo tratamos como 'por confirmar', no como worldwide.",
  },
  {
    id: "remotive",
    name: "Remotive Public API",
    kind: "portal",
    docs: ["https://remotive.com/remote-jobs/api", "https://github.com/remotive-com/remote-jobs-api"],
    access: "GET https://remotive.com/api/remote-jobs (sin autenticación).",
    terms:
      "Permite compartir sus avisos con enlace al aviso en Remotive y mención como fuente. Prohíbe enviarlos a otros sitios de terceros y mostrarlos para captar registros o emails. En Maru el ranking se ve sin registro ni email, y cada aviso muestra 'Publicado en Remotive' con su enlace. Los avisos llegan con 24 h de demora.",
    limits: "No más de 4 consultas por día; más de 2 por minuto se bloquean. Sincronizamos 1 vez por día.",
    reviewedAt: REVIEWED,
    status: "habilitada",
    enabled: true,
    cost: "gratis",
    partialFeed: false,
    linkRequired: true,
    attribution: "Publicado en Remotive",
    notes: "Si alguna vez el ranking pasa a exigir login o email, hay que deshabilitar esta fuente.",
  },
  {
    id: "himalayas",
    name: "Himalayas Remote Jobs API",
    kind: "portal",
    docs: ["https://himalayas.app/docs/remote-jobs-api", "https://himalayas.app/terms"],
    access: "Requiere API key (jobs:read).",
    terms:
      "Prohíbe redistribuir avisos a otros portales o agregadores; exige crédito visible a Himalayas y usar su applicationLink. Maru agrega avisos de varias fuentes: sin autorización escrita, no se activa.",
    limits: "120 req/min y 25.000/día por cuenta.",
    reviewedAt: REVIEWED,
    status: "necesita_autorizacion",
    enabled: false,
    cost: "gratis",
    partialFeed: false,
    linkRequired: true,
    attribution: "Publicado en Himalayas",
  },
  {
    id: "jooble",
    name: "Jooble API",
    kind: "portal",
    docs: ["https://jooble.org/api/about"],
    access: "Requiere API key.",
    terms: "Cuota gratuita finita: no sirve como base permanente del producto (restricción del brief).",
    limits: "Cuota por clave.",
    reviewedAt: REVIEWED,
    status: "necesita_credencial",
    enabled: false,
    cost: "cuota_finita",
    partialFeed: true,
    linkRequired: true,
  },
  {
    id: "fantastic_ats",
    name: "Fantastic.jobs · sitios de empleo de empresas",
    kind: "portal",
    docs: ["https://developer.fantastic.jobs/api/new-jobs", "https://developer.fantastic.jobs/documentation/credit-usage"],
    access: "GET https://data.fantastic.jobs/v1/active-ats con Bearer FANTASTIC_JOBS (sólo servidor/Actions).",
    terms:
      "Índice de avisos publicados en ATS de empleadores (Workday, SuccessFactors, Teamtailor…). Enlazamos al aviso original del empleador y aclaramos el índice en la atribución.",
    limits: "Créditos del trial (sin plan pago). Cada importación lee el saldo antes de descargar y frena sin el dato.",
    reviewedAt: "2026-10-16",
    status: "habilitada",
    enabled: false,
    cost: "cuota_finita",
    partialFeed: true,
    linkRequired: false,
    imported: true,
    staleDays: 30,
    notes: "Los avisos importados siguen visibles hasta su vencimiento o 30 días sin volver a verse, aunque termine el trial.",
  },
  {
    id: "fantastic_jb",
    name: "Fantastic.jobs · LinkedIn",
    kind: "portal",
    docs: ["https://developer.fantastic.jobs/api/new-jobs"],
    access: "GET https://data.fantastic.jobs/v1/active-jb?source=linkedin&exclude_recruiter_fields=true (sólo servidor/Actions).",
    terms: "Avisos públicos de LinkedIn sin datos de reclutadores. Enlazamos al aviso en LinkedIn.",
    limits: "Créditos del trial (sin plan pago).",
    reviewedAt: "2026-10-16",
    status: "habilitada",
    enabled: false,
    cost: "cuota_finita",
    partialFeed: true,
    linkRequired: true,
    imported: true,
    staleDays: 30,
  },
  {
    id: "serpapi",
    name: "Google Jobs (SerpApi)",
    kind: "portal",
    docs: ["https://serpapi.com/google-jobs-api", "https://serpapi.com/account-api"],
    access: "GET https://serpapi.com/search.json?engine=google_jobs con SERP_API (sólo servidor/Actions).",
    terms: "Resultados de Google Jobs; enlazamos al sitio donde se publicó el aviso (preferimos el del empleador y descartamos agregadores secundarios).",
    limits: "Sólo búsquedas del plan gratuito (plan_searches_left), primera página, sin extras.",
    reviewedAt: "2026-10-16",
    status: "habilitada",
    enabled: false,
    cost: "cuota_finita",
    partialFeed: true,
    linkRequired: true,
    imported: true,
    staleDays: 21,
    notes: "Google da antigüedad relativa: se muestra como texto y nunca se convierte en fecha exacta.",
  },
  ...(["linkedin", "indeed", "computrabajo"] as const).map(
    (id): SourceInfo => ({
      id: `apify-${id}`,
      name: `${{ linkedin: "LinkedIn", indeed: "Indeed", computrabajo: "Computrabajo" }[id]} (vía Apify)`,
      kind: "portal",
      docs: ["https://docs.apify.com/platform/actors/running/usage-and-resources"],
      access: "Actors de Apify con APIFY_TOKEN (sólo Actions), con tope de gasto por corrida y acumulado.",
      terms: "Avisos públicos sin datos de reclutadores; enlazamos al aviso en el portal de origen.",
      limits: "Presupuesto aprobado por el dueño: US$5 en total para importaciones (ledger en data/match/providers-ledger.json).",
      reviewedAt: "2026-10-16",
      status: "habilitada",
      enabled: false,
      cost: "pago",
      partialFeed: true,
      linkRequired: true,
      imported: true,
      staleDays: 30,
    }),
  ),
  ...(["JSearch (RapidAPI)", "TheirStack"] as const).map(
    (name): SourceInfo => ({
      id: name.split(" ")[0].toLowerCase(),
      name,
      kind: "portal",
      docs: [],
      access: "Servicio pago o con créditos.",
      terms: "Fuera del MVP: no se contrata ni se consume ningún servicio pago.",
      limits: "—",
      reviewedAt: REVIEWED,
      status: "incompatible",
      enabled: false,
      cost: "pago",
      partialFeed: true,
      linkRequired: true,
    }),
  ),
  ...(["LinkedIn", "Indeed", "Bumeran", "ZonaJobs", "Computrabajo"] as const).map(
    (name): SourceInfo => ({
      id: name.toLowerCase(),
      name,
      kind: "portal",
      docs: [],
      access: "Sin API pública gratuita para leer su inventario.",
      terms:
        "No hay acceso gratuito autorizado a su inventario: no se usan cuentas personales, cookies, scraping ni endpoints privados. Las personas pueden pegar un aviso de estos portales a mano (queda privado).",
      limits: "—",
      reviewedAt: REVIEWED,
      status: "necesita_autorizacion",
      enabled: false,
      cost: "gratis",
      partialFeed: true,
      linkRequired: true,
    }),
  ),
];

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);

/** Fuentes habilitadas, con override por variable de entorno: MATCH_DISABLED_SOURCES=remotive,jobicy */
export function enabledSources(env: Record<string, string | undefined> = process.env): SourceInfo[] {
  const off = new Set((env.MATCH_DISABLED_SOURCES ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return SOURCES.filter((s) => s.enabled && s.cost === "gratis" && !off.has(s.id));
}
