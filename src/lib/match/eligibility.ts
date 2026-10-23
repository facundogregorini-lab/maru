import { timezoneNote } from "./extract";
import { fold } from "./text";
import type { EligibilityResult, NormalizedPosting } from "./types";

/**
 * ¿Se puede trabajar en este puesto viviendo en Argentina?
 *
 * Reglas (del brief):
 * - "Remote" a secas NO equivale a Argentina → por confirmar.
 * - US only / restricciones a otro país → no elegible.
 * - LATAM, South America, Worldwide → elegible salvo restricción explícita en contra.
 * - Una zona horaria no es permiso de contratación: se informa aparte.
 * - Países vacíos = desconocido (salvo que la fuente lo defina como worldwide de forma explícita).
 */

const AR_PLACES = [
  "argentina",
  "buenos aires",
  "caba",
  "capital federal",
  "ciudad autonoma de buenos aires",
  "gba",
  "cordoba",
  "rosario",
  "mendoza",
  "la plata",
  "mar del plata",
  "tucuman",
  "neuquen",
  "salta",
  "santa fe",
  "bahia blanca",
  "parana",
  "san juan",
  "bariloche",
  "vicente lopez",
  "san isidro",
  "pilar",
  "tigre",
  "olivos",
  "martinez",
  // Provincias y ciudades del interior que no nombran "Argentina" en el aviso.
  "chaco",
  "resistencia",
  "corrientes",
  "misiones",
  "posadas",
  "entre rios",
  "concordia",
  "gualeguaychu",
  "santiago del estero",
  "jujuy",
  "catamarca",
  "la rioja",
  "san luis",
  "villa mercedes",
  "chubut",
  "comodoro rivadavia",
  "trelew",
  "puerto madryn",
  "rio negro",
  "cipolletti",
  "general roca",
  "viedma",
  "la pampa",
  "tierra del fuego",
  "ushuaia",
  "formosa",
  "rio cuarto",
  "villa maria",
  "villa carlos paz",
  "san rafael",
  "godoy cruz",
  "guaymallen",
  "lujan de cuyo",
  "rafaela",
  "reconquista",
  "venado tuerto",
  "san nicolas",
  "tandil",
  "olavarria",
  "necochea",
  "pergamino",
  "junin",
  "zarate",
  "campana",
  "escobar",
  "nordelta",
  "general pacheco",
  "quilmes",
  "lanus",
  "avellaneda",
  "lomas de zamora",
  "la matanza",
  "moron",
  "amba",
];
// "Córdoba" también es una ciudad de España; "Santa Fe" de EE. UU. y "San Juan" de Puerto Rico.
const AR_FALSE_FRIENDS = /\b(spain|espana|andalu|new mexico|nm\b|puerto rico|mexico|colombia|filipinas|philippines|california|texas|potosi)\b/;

const POSITIVE_REGION = /\b(latam|latin america|latinoamerica|america latina|south america|sudamerica|southern cone|cono sur|worldwide|world wide|anywhere in the world|work from anywhere|global(ly)? remote|remote global|global|fully distributed)\b/;
const AMBIGUOUS_REGION = /\b(americas|the americas|western hemisphere|north and south america|nearshore)\b/;

const OTHER_COUNTRIES =
  /\b(us|u\.s\.?|usa|u\.s\.a\.?|united states|canada|mexico|brazil|brasil|colombia|chile|peru|uruguay|paraguay|bolivia|ecuador|venezuela|costa rica|guatemala|panama|dominican republic|puerto rico|uk|united kingdom|england|ireland|spain|espana|portugal|france|germany|italy|netherlands|poland|romania|europe|emea|eu|apac|asia|india|philippines|australia|new zealand|singapore|japan|israel|south africa|nigeria|kenya|egypt|turkey|ukraine|greece|cyprus|hungary|czech republic|czechia|austria|switzerland|belgium|sweden|norway|denmark|finland|luxembourg|scotland|croatia|serbia|bulgaria|lithuania|latvia|estonia|slovakia|slovenia|united arab emirates|uae|saudi arabia|qatar|china|hong kong|south korea|korea|taiwan|vietnam|thailand|malaysia|indonesia|pakistan|bangladesh|morocco|ghana|el salvador|honduras|nicaragua|jamaica|malta|iceland|montenegro|albania|bosnia|north macedonia|moldova|georgia|armenia|azerbaijan|kazakhstan|nepal|sri lanka|cambodia|myanmar|laos|mongolia|uzbekistan|russia|belarus|iran|iraq|jordan|lebanon|kuwait|oman|bahrain|ethiopia|tanzania|uganda|rwanda|zimbabwe|zambia|angola|mozambique|senegal|cameroon|tunisia|algeria|cote d.ivoire|ivory coast|haiti|cuba|trinidad|barbados|belize|guyana|suriname|bermuda|fiji)\b/;

// Ciudades frecuentes fuera de Argentina (presencial/híbrido): cuando aparecen, el puesto no es elegible.
const OTHER_CITIES =
  /\b(new york|nyc|san francisco|los angeles|seattle|austin|boston|chicago|denver|miami|atlanta|toronto|vancouver|montreal|london|dublin|madrid|barcelona|lisbon|lisboa|paris|berlin|amsterdam|warsaw|bangalore|bengaluru|manila|sydney|melbourne|tel aviv|sao paulo|rio de janeiro|ciudad de mexico|mexico city|cdmx|guadalajara|monterrey|bogota|medellin|santiago|lima|montevideo|asuncion|quito|auckland|wellington|brisbane|perth|athens|budapest|limassol|prague|vienna|zurich|geneva|munich|hamburg|frankfurt|stockholm|copenhagen|oslo|helsinki|milan|rome|brussels|edinburgh|manchester|krakow|bucharest|sofia|belgrade|kyiv|istanbul|cairo|lagos|nairobi|johannesburg|cape town|dubai|abu dhabi|riyadh|doha|hyderabad|pune|chennai|mumbai|delhi|gurgaon|gurugram|noida|tokyo|seoul|shanghai|beijing|shenzhen|taipei|jakarta|kuala lumpur|bangkok|hanoi|ho chi minh|curitiba|porto alegre|belo horizonte|florianopolis|recife|fortaleza|brasilia|campinas|cali|barranquilla|valparaiso|guayaquil|houston|dallas|phoenix|philadelphia|washington|san diego|nashville|raleigh|charlotte|minneapolis|detroit|pittsburgh|calgary|ottawa)\b/;

// Estados, provincias y regiones de otros países que algunas fuentes ponen solas como ubicación de un remoto
// ("Remote" + "New South Wales", "Saskatchewan", "Texas"): el remoto queda atado a esa zona.
const FOREIGN_REGION =
  /\b(north america|norteamerica|new south wales|queensland|south australia|western australia|tasmania|northern territory|australian capital territory|ontario|quebec|british columbia|alberta|saskatchewan|manitoba|nova scotia|new brunswick|newfoundland|prince edward island|canterbury|waikato|north island|south island|morrinsville|matamata|taupo|taranaki|manawatu|otago|southland|bay of plenty|hawke s bay|northland|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|west virginia|wisconsin|wyoming|guangdong|bavaria|catalonia|cataluna|andalucia|lombardy|ile-de-france|sao paulo)\b/;
// Victoria (Australia) sola: hay una Victoria en Entre Ríos, pero esa ya la reconoce la ubicación argentina.
const VICTORIA_ALONE = /^victoria$/;

const US_STATE = /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;

const US_ONLY_DESC = [
  /\b(us|u\.s\.|usa|united states)[- ]?(only|based only)\b/,
  /\bmust (be|reside|live|be located|be based)[^.\n]{0,40}\b(in|within) the (us|u\.s\.|usa|united states)\b/,
  /\bonly (accepting|considering|open to|hiring)[^.\n]{0,30}\b(us|u\.s\.|usa|united states)\b/,
  /\b(us|u\.s\.)[- ]based (candidates|applicants|employees) only\b/,
  /\bwithin the (continental )?(us|u\.s\.|united states)\b/,
];
const WORK_AUTH_US = /\b(authorized|authorised|eligible|legally able) to work in the (us|u\.s\.|usa|united states)\b|\bus work authorization\b|\bus citizen(s|ship)? (only|required)\b/;
const EXCLUDES_AR = /\b(excluding|except|not (available|open) (in|to)|no candidates from)\b[^.\n]{0,40}\bargentina\b/;
// La región sólo cuenta cuando el aviso la ata a dónde vive o trabaja la persona: "clientes de LATAM",
// "experiencia en LATAM" o "LATAM Airlines" no dicen nada de desde dónde contratan.
const AR_REGION = String.raw`(latam|latin america|latinoamerica|america latina|south america|sudamerica|argentina)`;
const TITLE_WORLDWIDE = /\b(remote,? worldwide|worldwide remote|remote \(?worldwide\)?|remote[ -]+anywhere|work from anywhere|anywhere in the world|remoto desde cualquier pais)\b/;

const DESC_ALLOWS = new RegExp(
  [
    String.raw`open to ((candidates|applicants|contractors|talent|professionals|people)\b[^.\n]{0,40}\b)?${AR_REGION}`,
    String.raw`(hiring|hire) (in|from|across) ${AR_REGION}`,
    String.raw`(remote|remoto|remota|remotely)( work| position| role| opportunity| work opportunity)?( for| within| from| desde| en| para| in| across| -| /)? (the |todo |toda )?(cualquier (lugar|pais|parte) de |anywhere in )?${AR_REGION}`,
    String.raw`(based|located|living|live|lives|reside|residing|residir|residis|residas|resida|vivir|vivas|viva) (actualmente )?(in|en|within)\b[^.\n]{0,40}\b${AR_REGION}`,
    String.raw`(work|trabajar|trabajo) (from|desde) (cualquier (lugar|pais|parte) de |anywhere in )${AR_REGION}`,
    String.raw`(abierta?|abierto) (a|para) (todo |toda |candidatos de |postulantes de |personas de )?${AR_REGION}`,
    String.raw`(contratacion|location|ubicacion|modalidad remota?) ?:? ?(remote ?/? ?|remoto ?/? ?)?${AR_REGION}`,
    String.raw`we hire (anywhere|globally)|we re hiring globally|work from anywhere in the world|anywhere in the world|any location worldwide|desde cualquier (lugar|parte|pais) del mundo`,
    String.raw`(work|working|trabajar) from anywhere(?! (in|within|across|en)\b)`,
  ].join("|"),
);
// Residencia exigida en otro país o ciudad ("candidates located in Colombia", "residencia en Ciudad de México
// requerida"). Se mira después de DESC_ALLOWS: "residir en Chile, Argentina o Perú" habilita.
const ELSEWHERE = `(the )?(${OTHER_COUNTRIES.source.slice(3, -3)}|${OTHER_CITIES.source.slice(3, -3)})\\b`;
const DESC_ELSEWHERE = new RegExp(
  [
    String.raw`\b(candidates|applicants) (must be )?(currently )?(located|based|residing|living) in ${ELSEWHERE}`,
    String.raw`\bmust (currently )?(be )?(currently )?(located|based|reside|live|living)( and authorized to work)? in ${ELSEWHERE}`,
    String.raw`\bresidencia en ${ELSEWHERE} (requerida|excluyente|obligatoria)`,
    String.raw`\b(debes|debe|deberas|deber) (residir|vivir|estar radicad[oa]) en ${ELSEWHERE}`,
  ].join("|"),
);

// Ciudades argentinas cuyo nombre se repite en otros países (Córdoba en España, Colombia y México; Rosario en Uruguay;
// San Juan en Puerto Rico; Santa Fe y Martinez en EE. UU.; San Isidro en Perú).
const AR_AMBIGUOUS = /\b(cordoba|rosario|santa fe|san juan|parana|pilar|tigre|olivos|martinez|san isidro|mendoza|salta)\b/g;
const AMBIGUOUS_HOST_COUNTRIES = new Set(["ES", "US", "MX", "CO", "PR", "PH", "PE", "UY", "VE", "CR", "CL", "PY", "BO", "EC"]);

function hasArPlace(t: string): boolean {
  if (AR_FALSE_FRIENDS.test(t) && !/\bargentina\b/.test(t)) return false;
  return AR_PLACES.some((p) => new RegExp(`\\b${p}\\b`).test(t));
}

/**
 * Cada ubicación por separado: "Martinez, CA" o "San Juan, TX" nombran una ciudad argentina pero están en EE. UU.
 * Si la ubicación es sólo una ciudad de nombre repetido ("Cordoba") y la fuente informa otro país donde existe
 * (o el título lo nombra: "… en Córdoba, España"), no alcanza para decir Argentina.
 */
function arLocation(raw: string, otherHost: boolean): boolean {
  const t = fold(raw);
  if (!hasArPlace(t)) return false;
  if (/\bargentina\b/.test(t)) return true;
  if (otherHost && !hasArPlace(t.replace(AR_AMBIGUOUS, " "))) return false;
  return !US_STATE.test(raw) && !OTHER_COUNTRIES.test(t);
}

export function classifyEligibility(
  p: Pick<NormalizedPosting, "locations" | "countries" | "regionText" | "workplace" | "remoteFlag" | "descriptionText" | "remoteGlobal"> & { title?: string },
): EligibilityResult {
  const locRaw = [...p.locations, ...p.regionText].filter(Boolean).join(" | ");
  const loc = fold(locRaw);
  const descRaw = p.descriptionText.slice(0, 8000);
  const desc = fold(descRaw);
  const timezone = timezoneNote(descRaw);
  const remote = p.workplace.value === "remoto" || p.remoteFlag === true || /\b(remote|remoto|teletrabajo|home office|work from home)\b/.test(loc);
  const usOnly = US_ONLY_DESC.some((re) => re.test(desc));
  const result = (status: EligibilityResult["status"], evidence: string[]): EligibilityResult => ({ status, evidence, ...(timezone ? { timezone } : {}) });

  if (EXCLUDES_AR.test(desc)) return result("no_elegible", ["El aviso excluye explícitamente a Argentina."]);

  // 1. Países estructurados informados por la fuente.
  const countries = p.countries.map((c) => c.toUpperCase());
  if (countries.includes("AR")) return result("elegible", ["La fuente informa Argentina entre los países del puesto."]);

  // 2. Ubicación en Argentina.
  const title = fold(p.title ?? "");
  const otherHost = countries.some((c) => AMBIGUOUS_HOST_COUNTRIES.has(c)) || (AR_FALSE_FRIENDS.test(title) && !/\bargentina\b/.test(title));
  if ([...p.locations, ...p.regionText].some((l) => l && arLocation(l, otherHost))) {
    return result("elegible", [`Ubicación: ${locRaw}`]);
  }

  // 3. Región amplia que incluye Argentina.
  if (POSITIVE_REGION.test(loc)) {
    if (!remote && (OTHER_CITIES.test(loc) || US_STATE.test(locRaw))) {
      return result("por_confirmar", [`Ubicación: ${locRaw} (menciona una región amplia, pero con sede fuera de Argentina)`]);
    }
    if (usOnly || WORK_AUTH_US.test(desc)) {
      return result("por_confirmar", [`Ubicación: ${locRaw}`, "Pero la descripción pide residencia o permiso de trabajo en EE. UU."]);
    }
    return result("elegible", [`Ubicación: ${locRaw}`]);
  }
  if (AMBIGUOUS_REGION.test(loc)) {
    return result("por_confirmar", [`Ubicación: ${locRaw} (no aclara si incluye Argentina)`]);
  }

  // 4. Países informados sin Argentina.
  if (countries.length) return result("no_elegible", [`Países del puesto: ${countries.join(", ")}`]);

  // 5. Otro país o ciudad explícitos.
  const foreignRegion = FOREIGN_REGION.test(loc) || p.locations.some((l) => VICTORIA_ALONE.test(fold(l)));
  if (loc && (OTHER_COUNTRIES.test(loc) || OTHER_CITIES.test(loc) || US_STATE.test(locRaw) || foreignRegion)) {
    return result("no_elegible", [remote ? `Remoto limitado a: ${locRaw}` : `Presencial u híbrido en: ${locRaw}`]);
  }

  // 6. Remoto sin región: miramos la descripción.
  if (remote) {
    if (usOnly) return result("no_elegible", ["La descripción limita el puesto a EE. UU."]);
    if (WORK_AUTH_US.test(desc)) return result("no_elegible", ["La descripción pide permiso de trabajo en EE. UU."]);
    const allow = desc.match(DESC_ALLOWS);
    if (allow) return result("elegible", [`La descripción dice: “${allow[0]}”`]);
    // "Senior Engineer (100% Remote, Worldwide)": el título ya dice que es desde cualquier país.
    const worldwide = title.match(TITLE_WORLDWIDE);
    if (worldwide) return result("elegible", [`El título dice: “${worldwide[0]}”`]);
    const elsewhere = desc.match(DESC_ELSEWHERE);
    // "Santiago" también es Santiago del Estero: si lo que sigue nombra un lugar argentino, no descarta.
    if (elsewhere && !hasArPlace(desc.slice(elsewhere.index, (elsewhere.index ?? 0) + elsewhere[0].length + 20))) return result("no_elegible", [`La descripción pide vivir en otro lugar: “${elsewhere[0]}”`]);
    if (p.remoteGlobal) return result("elegible", ["100% remoto, sin restricción de país (según la fuente o la empresa)."]);
    return result("por_confirmar", ["Remoto sin región: no dice si contratan desde Argentina."]);
  }

  // 7. Sin datos de ubicación.
  if (!loc) {
    if (usOnly) return result("no_elegible", ["La descripción limita el puesto a EE. UU."]);
    return result("por_confirmar", ["El aviso no informa ubicación."]);
  }
  return result("por_confirmar", [`Ubicación no reconocida: ${locRaw}`]);
}
