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
  ...(["JSearch (RapidAPI)", "SerpApi Google Jobs", "TheirStack"] as const).map(
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
