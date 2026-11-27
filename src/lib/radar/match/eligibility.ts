import { fold } from "../identity";
import type { EligibilityStatus, JobOpening, RadarEligibilityPrefs } from "../types";

/**
 * Elegibilidad por reglas, sólo con lo que la persona declaró (países donde puede trabajar, relocalización,
 * modalidad) y lo que dice el aviso. Nunca se infiere nacionalidad ni permiso. Sin atributos protegidos.
 * - blocked: un excluyente confirmado (no se compensa con score).
 * - needs_verification: falta un dato para saberlo.
 */

export const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];

const PLACES: [RegExp, string][] = [
  [/\b(united states|usa|u\.s\.a?\.?|estados unidos|san francisco|new york|nyc|seattle|boston|austin|chicago|los angeles|denver|atlanta|miami|washington,? d\.?c|palo alto|mountain view|menlo park|sunnyvale|san jose|san mateo|redwood city|cupertino|oakland|brooklyn)\b/, "US"],
  [/,\s*(ca|ny|wa|tx|ma|il|co|ga|fl|or|nc|va|nj|pa|az|ut|mn)\b/, "US"],
  [/\b(canada|canadá|toronto|vancouver|montreal|ottawa)\b/, "CA"],
  [/\b(united kingdom|uk|england|london|londres|manchester|edinburgh|scotland)\b/, "GB"],
  [/\b(ireland|irlanda|dublin)\b/, "IE"],
  [/\b(france|francia|paris|parís|lyon)\b/, "FR"],
  [/\b(germany|alemania|deutschland|berlin|munich|münchen|munchen|hamburg|frankfurt|bremen|cologne|köln)\b/, "DE"],
  [/\b(spain|españa|espana|madrid|barcelona|valencia|elche|sevilla)\b/, "ES"],
  [/\b(portugal|lisbon|lisboa|porto)\b/, "PT"],
  [/\b(netherlands|países bajos|paises bajos|amsterdam|rotterdam)\b/, "NL"],
  [/\b(italy|italia|milan|milano|rome|roma)\b/, "IT"],
  [/\b(switzerland|suiza|zurich|zürich|geneva)\b/, "CH"],
  [/\b(sweden|suecia|stockholm)\b/, "SE"],
  [/\b(poland|polonia|warsaw|krakow)\b/, "PL"],
  [/\b(finland|finlandia|helsinki|espoo)\b/, "FI"],
  [/\b(denmark|copenhagen)\b/, "DK"],
  [/\b(argentina|buenos aires|caba|córdoba|cordoba|rosario|mendoza)\b/, "AR"],
  [/\b(brazil|brasil|são paulo|sao paulo|rio de janeiro|belo horizonte)\b/, "BR"],
  [/\b(chile|santiago de chile)\b/, "CL"],
  [/\b(uruguay|montevideo)\b/, "UY"],
  [/\b(colombia|bogotá|bogota|medellín|medellin)\b/, "CO"],
  [/\b(mexico|méxico|ciudad de méxico|cdmx|guadalajara|monterrey)\b/, "MX"],
  [/\b(peru|perú|lima)\b/, "PE"],
  [/\b(india|bangalore|bengaluru|hyderabad|mumbai|delhi)\b/, "IN"],
  [/\b(singapore|singapur)\b/, "SG"],
  [/\b(japan|japón|tokyo|tokio)\b/, "JP"],
  [/\b(australia|sydney|melbourne)\b/, "AU"],
  [/\b(korea|seoul)\b/, "KR"],
  [/\b(israel|tel aviv)\b/, "IL"],
  [/\b(uae|dubai|abu dhabi)\b/, "AE"],
];

const REGIONS: [RegExp, Region][] = [
  [/\b(worldwide|anywhere|global|globally|remote first|any location|cualquier lugar|todo el mundo)\b/, "GLOBAL"],
  [/\b(emea)\b/, "EMEA"],
  [/\b(europe|europa|eu)\b/, "EU"],
  [/\b(latam|latin america|latinoamerica|latinoamérica|south america|southern cone|cono sur)\b/, "LATAM"],
  [/\b(americas|amer)\b/, "AMERICAS"],
  [/\b(apac|asia|asean|sea|southeast asia)\b/, "APAC"],
  [/\b(north america|norteamerica)\b/, "NA"],
];
type Region = "GLOBAL" | "EMEA" | "EU" | "LATAM" | "AMERICAS" | "APAC" | "NA";
const LATAM = ["AR", "BR", "CL", "UY", "CO", "MX", "PE", "PY", "BO", "EC", "VE", "CR", "PA", "GT"];
const REGION_COUNTRIES: Record<Exclude<Region, "GLOBAL">, string[]> = {
  EMEA: [...EU, "GB", "CH", "NO", "IL", "AE"],
  EU,
  LATAM,
  AMERICAS: [...LATAM, "US", "CA"],
  APAC: ["IN", "SG", "JP", "AU", "KR"],
  NA: ["US", "CA", "MX"],
};

export function placesIn(text: string): { countries: string[]; regions: Region[] } {
  const t = ` ${fold(text)} `;
  const countries = [...new Set(PLACES.filter(([re]) => re.test(t)).map(([, c]) => c))];
  const regions = [...new Set(REGIONS.filter(([re]) => re.test(t)).map(([, r]) => r))];
  return { countries, regions };
}

const AUTH_COUNTRY: [RegExp, string][] = [
  [/(authori[sz]ed|eligible|legally (able|permitted)|right) to work in (the )?(u\.?s\.?a?|united states)/, "US"],
  [/(authori[sz]ed|eligible|right) to work in (the )?(uk|united kingdom)/, "GB"],
  [/(authori[sz]ed|eligible|right) to work in canada/, "CA"],
  [/(authori[sz]ed|eligible|right) to work in (the )?(eu|european union|europe)/, "EU"],
];
const CITIZEN = /\b(u\.?s\.? citizen(s|ship)?( only| required| is required)|must be a (u\.?s\.? )?citizen|security clearance|secret clearance|ts\/sci|itar)\b/;
const NO_SPONSOR = /\b((not|unable to|cannot|can't|won't|will not|do not|does not) (provide|offer|sponsor)( visa)? (visa |work )?sponsorship|sponsorship is not available|no (visa )?sponsorship)\b/;

const covers = (authorized: string[], country: string) => authorized.includes(country) || (authorized.includes("EU") && EU.includes(country));

export type EligibilityResult = { status: EligibilityStatus; evidence: string[]; location: { known: boolean; score: number | null; evidence: string[] } };

export function eligibilityFor(job: Pick<JobOpening, "location" | "remoteType" | "title">, description: string, prefs: RadarEligibilityPrefs): EligibilityResult {
  const desc = fold(description.slice(0, 10_000));
  const where = placesIn(`${job.location} ${job.title}`);
  const remote = job.remoteType === "remoto" || /\bremote|remoto\b/.test(fold(job.location));
  const hybrid = job.remoteType === "hibrido" || /\bhybrid|hibrido\b/.test(fold(job.location));
  const onsite = !remote && !hybrid && job.remoteType === "presencial";
  const declared = prefs.authorizedCountries;
  const ev: string[] = [];
  const out = (status: EligibilityStatus, score: number | null, extra: string[] = []): EligibilityResult => ({ status, evidence: [...ev, ...extra], location: { known: score !== null, score, evidence: [...ev, ...extra] } });

  // Exigencias legales que dice el aviso.
  const citizen = CITIZEN.test(desc);
  const authReq = AUTH_COUNTRY.filter(([re]) => re.test(desc)).map(([, c]) => c);
  const noSponsor = NO_SPONSOR.test(desc);

  if (prefs.remote === "solo_remoto" && onsite) {
    ev.push(`El aviso es presencial (${job.location || "sin ciudad"}) y elegiste sólo remoto.`);
    return out("blocked", 0);
  }

  // País o región donde hay que estar (o tener permiso).
  let required: string[] = where.countries;
  const global = remote && where.regions.includes("GLOBAL") && !where.countries.length;
  if (remote && !where.countries.length) {
    const regionCountries = where.regions.filter((r) => r !== "GLOBAL").flatMap((r) => REGION_COUNTRIES[r as Exclude<Region, "GLOBAL">]);
    required = regionCountries;
  }
  if (authReq.length) required = [...new Set(authReq.flatMap((c) => (c === "EU" ? EU : [c])))];

  if (citizen) {
    ev.push("El aviso exige ciudadanía o una habilitación de seguridad.");
    return out("blocked", 0);
  }

  if (global && !authReq.length) {
    ev.push("Remoto sin restricción de país según la fuente.");
    return out("eligible", 100);
  }
  if (!required.length) {
    ev.push(job.location ? `No pudimos saber de qué país es «${job.location}».` : "El aviso no dice la ubicación.");
    return out("needs_verification", null);
  }
  if (!declared.length) {
    ev.push(`Pide estar en ${listCountries(required)} y no declaraste dónde podés trabajar (Automatización).`);
    return out("needs_verification", null);
  }
  if (required.some((c) => covers(declared, c))) {
    const modeScore = remote ? 100 : hybrid ? (prefs.remote === "solo_remoto" ? 50 : 90) : prefs.remote === "cualquiera" ? 85 : 60;
    ev.push(`${remote ? "Remoto" : hybrid ? "Híbrido" : "Presencial"} en ${listCountries(required.filter((c) => covers(declared, c)))}, donde declaraste que podés trabajar.`);
    return out("eligible", modeScore);
  }
  // El país no está entre los declarados.
  if (authReq.length) {
    ev.push(`Pide permiso de trabajo en ${listCountries(authReq)}, que no está entre los países que declaraste.`);
    return out("blocked", 0);
  }
  if (!remote && prefs.relocation === "no") {
    ev.push(`${hybrid ? "Híbrido" : "Presencial"} en ${listCountries(required)}: no declaraste permiso para trabajar ahí y no querés relocalizarte.`);
    return out("blocked", 0);
  }
  ev.push(
    remote
      ? `Remoto restringido a ${listCountries(required)}: hay que confirmar si contratan desde donde podés trabajar.`
      : `${hybrid ? "Híbrido" : "Presencial"} en ${listCountries(required)}: hay que confirmar permiso de trabajo${noSponsor ? " (el aviso dice que no patrocinan visas)" : ""}.`,
  );
  return out("needs_verification", remote ? 40 : 30);
}

const NAMES: Record<string, string> = { US: "Estados Unidos", CA: "Canadá", GB: "Reino Unido", IE: "Irlanda", FR: "Francia", DE: "Alemania", ES: "España", PT: "Portugal", NL: "Países Bajos", IT: "Italia", CH: "Suiza", SE: "Suecia", PL: "Polonia", FI: "Finlandia", DK: "Dinamarca", AR: "Argentina", BR: "Brasil", CL: "Chile", UY: "Uruguay", CO: "Colombia", MX: "México", PE: "Perú", IN: "India", SG: "Singapur", JP: "Japón", AU: "Australia", KR: "Corea", IL: "Israel", AE: "Emiratos Árabes", EU: "la Unión Europea" };
function listCountries(cs: string[]): string {
  const uniq = [...new Set(cs)];
  if (uniq.length > 4) return uniq.every((c) => EU.includes(c)) ? "la Unión Europea" : `${uniq.slice(0, 3).map((c) => NAMES[c] ?? c).join(", ")} y otros`;
  return uniq.map((c) => NAMES[c] ?? c).join(", ");
}
