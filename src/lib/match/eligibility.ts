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
];
// "Córdoba" también es una ciudad de España; "Santa Fe" de EE. UU. y "San Juan" de Puerto Rico.
const AR_FALSE_FRIENDS = /\b(spain|espana|andalu|new mexico|nm\b|puerto rico|mexico|colombia|filipinas|philippines|california|texas)\b/;

const POSITIVE_REGION = /\b(latam|latin america|latinoamerica|america latina|south america|sudamerica|southern cone|cono sur|worldwide|world wide|anywhere in the world|work from anywhere|global(ly)? remote|remote global|global|fully distributed)\b/;
const AMBIGUOUS_REGION = /\b(americas|the americas|western hemisphere|north and south america|nearshore)\b/;

const OTHER_COUNTRIES =
  /\b(us|u\.s\.?|usa|u\.s\.a\.?|united states|canada|mexico|brazil|brasil|colombia|chile|peru|uruguay|paraguay|bolivia|ecuador|venezuela|costa rica|guatemala|panama|dominican republic|puerto rico|uk|united kingdom|england|ireland|spain|espana|portugal|france|germany|italy|netherlands|poland|romania|europe|emea|eu|apac|asia|india|philippines|australia|new zealand|singapore|japan|israel|south africa|nigeria|kenya|egypt|turkey|ukraine)\b/;

// Ciudades frecuentes fuera de Argentina (presencial/híbrido): cuando aparecen, el puesto no es elegible.
const OTHER_CITIES =
  /\b(new york|nyc|san francisco|los angeles|seattle|austin|boston|chicago|denver|miami|atlanta|toronto|vancouver|montreal|london|dublin|madrid|barcelona|lisbon|lisboa|paris|berlin|amsterdam|warsaw|bangalore|bengaluru|manila|sydney|melbourne|tel aviv|sao paulo|rio de janeiro|ciudad de mexico|mexico city|cdmx|guadalajara|monterrey|bogota|medellin|santiago|lima|montevideo|asuncion|quito)\b/;

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
const DESC_ALLOWS = /\b(open to (candidates|applicants) (in|from)[^.\n]{0,40}(latam|latin america|argentina|south america|anywhere)|(hiring|hire) (in|from|across) (latam|latin america|argentina)|(remote|remoto)[^.\n]{0,15}(from|desde) (argentina|latam|latin america|anywhere)|we hire anywhere|work from anywhere in the world|candidates (based|located) in (latam|latin america|argentina))\b/;

function hasArPlace(t: string): boolean {
  if (AR_FALSE_FRIENDS.test(t) && !/\bargentina\b/.test(t)) return false;
  return AR_PLACES.some((p) => new RegExp(`\\b${p}\\b`).test(t));
}

/** Cada ubicación por separado: "Martinez, CA" o "San Juan, TX" nombran una ciudad argentina pero están en EE. UU. */
function arLocation(raw: string): boolean {
  const t = fold(raw);
  if (!hasArPlace(t)) return false;
  if (/\bargentina\b/.test(t)) return true;
  return !US_STATE.test(raw) && !OTHER_COUNTRIES.test(t);
}

export function classifyEligibility(p: Pick<NormalizedPosting, "locations" | "countries" | "regionText" | "workplace" | "remoteFlag" | "descriptionText">): EligibilityResult {
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
  if ([...p.locations, ...p.regionText].some((l) => l && arLocation(l))) {
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
  if (loc && (OTHER_COUNTRIES.test(loc) || OTHER_CITIES.test(loc) || US_STATE.test(locRaw))) {
    return result("no_elegible", [remote ? `Remoto limitado a: ${locRaw}` : `Presencial u híbrido en: ${locRaw}`]);
  }

  // 6. Remoto sin región: miramos la descripción.
  if (remote) {
    if (usOnly) return result("no_elegible", ["La descripción limita el puesto a EE. UU."]);
    if (WORK_AUTH_US.test(desc)) return result("no_elegible", ["La descripción pide permiso de trabajo en EE. UU."]);
    const allow = desc.match(DESC_ALLOWS);
    if (allow) return result("elegible", [`La descripción dice: “${allow[0]}”`]);
    return result("por_confirmar", ["Remoto sin región: no dice si contratan desde Argentina."]);
  }

  // 7. Sin datos de ubicación.
  if (!loc) {
    if (usOnly) return result("no_elegible", ["La descripción limita el puesto a EE. UU."]);
    return result("por_confirmar", ["El aviso no informa ubicación."]);
  }
  return result("por_confirmar", [`Ubicación no reconocida: ${locRaw}`]);
}
