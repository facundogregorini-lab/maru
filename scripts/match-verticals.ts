/**
 * Avisos por vertical, con la taxonomía de 15 verticales que pidió el dueño (17/10/2026). Costo externo: cero.
 *
 *   npm run match:verticals
 *
 * Parte del área que ya calcula la extracción (extract.ts) y la reparte con el título donde una
 * área nuestra cae en dos verticales (finanzas corporativas vs. banca y seguros; logística vs. choferes).
 * Cuenta publicaciones abiertas y oportunidades elegibles desde Argentina que se muestran (menos de 120 días).
 */
import { opportunitiesOf } from "../src/lib/match/inventory";
import { readInventoryFileSync } from "../src/lib/match/inventory-file";
import { HIDE_AFTER_DAYS, ageDays } from "../src/lib/match/ranking";
import { fold } from "../src/lib/match/text";

const inv = readInventoryFileSync("data/match/inventory.json");
const V = ["1. Tecnología y Desarrollo de Software (IT)","2. Salud y Asistencia Médica","3. Finanzas, Banca y Seguros","4. Ventas y Desarrollo de Negocio","5. Marketing, Comunicación y Publicidad","6. Recursos Humanos y Gestión del Talento","7. Ingeniería, Operaciones y Manufactura","8. Cadena de Suministro, Logística y Transporte","9. Administración, Legal y Finanzas Corporativas","10. Atención al Cliente y Soporte","11. Educación, Capacitación y E-Learning","12. Hotelería, Gastronomía y Turismo","13. Construcción, Arquitectura e Inmobiliario","14. Arte, Medios, Entretenimiento y Creatividad","15. Servicios Generales, Mantenimiento y Oficios","Fuera de la lista: tareas de IA e idiomas por proyecto","Sin clasificar"];
const has = (t: string, re: RegExp) => re.test(` ${t} `);
const ART = /\b(graphic|grafic|motion|video editor|editor de video|editor|copywriter|writer|redactor|multimedia|podcast|periodis|journalist|audiovisual|fotograf|photograph|creative director|art direction|art director|illustrat|ilustrador|animator|animador|ugc|content creator|creador de contenido)/;
const CONSTR = /\b(construction|construccion|obra(?! social)|obras|arquitect[oa]\b|architect(ure)?\b(?! (software|solutions|cloud|data|platform|enterprise|technical|security))|estimator|inmobiliari|real estate|tasaci|appraiser|home inspector|leasing|maestro mayor|capataz|topograf)/;
const BANK = /\b(bank|banca|banco|banking|credit|credito|risk|riesgo|underwrit|insurance|seguros|actuar|treasury|tesor|capital markets|mercado de capitales|fraud|fraude|compliance|aml|kyc|trading|trader|investment|inversion|wealth|lending|claims|siniestro|valuation|derivatives|lavado de activos|oficial de (empresas|negocios|cuentas))/;
const TRADES = /^(?!.*ingenier).*\b(chofer|conductor|driver|cadete|repartidor|reparto|mensajer|courier|delivery|vigilador|vigilancia|seguridad privada|security guard|limpieza|cleaning|mucama de limpieza|electricista|plomer|gasista|albanil|pintor|carpinter|cerrajer|jardiner|mantenimiento (general|edilicio|integral)|maestranza|portero|encargado de edificio)/;
const TRAVEL = /\b(viajes|travel|turismo|tourism)/;
function vertical(fam: string, title: string): number {
  const t = fold(title);
  if (fam === "entrenamiento_ia") return 15;
  if (has(t, ART) && !["software", "datos", "producto", "educacion", "ventas"].includes(fam)) return 13;
  if (has(t, CONSTR) && !["software", "datos"].includes(fam)) return 12;
  switch (fam) {
    case "software": case "datos": case "producto": return 0;
    case "diseno": return 0;
    case "salud": return 1;
    case "finanzas": return has(t, BANK) ? 2 : 8;
    case "legal": return has(t, BANK) ? 2 : 8;
    case "ventas": return 3;
    case "comercio": return has(t, /\b(repositor|reposicion)/) ? 7 : has(t, /\b(cajer|caja|atencion)/) ? 9 : 3;
    case "marketing": return 4;
    case "rrhh": return 5;
    case "produccion": return has(t, TRADES) ? 14 : 6;
    case "operaciones": return 6;
    case "logistica": return has(t, TRADES) ? 14 : 7;
    case "administracion": return 8;
    case "atencion_cliente": return has(t, /\b(customer success|exito del cliente|account manag)/) ? 3 : has(t, TRAVEL) ? 11 : 9;
    case "educacion": return 10;
    case "gastronomia": return 11;
    case "seguridad": return 14;
    case "consultoria": return has(t, /\b(sap|salesforce|oracle|erp|crm|cloud|data|datos|tech|it\b|software|servicenow|workday|digital|ciber|cyber|security|ai\b)/) ? 0 : has(t, BANK) || has(t, /\b(financ|tax|impuest|contab|audit)/) ? 2 : has(t, /\b(rrhh|hr|talent|people)/) ? 5 : 6;
    default: return has(t, BANK) ? 2 : has(t, TRADES) ? 14 : has(t, TRAVEL) ? 11 : 16;
  }
}
const now = new Date();
const posts = inv.postings.filter((p) => p.status === "abierta");
const opps = opportunitiesOf(inv).filter((o) => o.status === "abierta");
const count = (items: { fam: string; title: string }[]) => { const c = new Array(V.length).fill(0); for (const i of items) c[vertical(i.fam, i.title)]++; return c; };
const all = count(posts.map((p) => ({ fam: p.extracted.family.value, title: p.title })));
const elig = count(opps.filter((o) => o.eligibility.status === "elegible" && ageDays(o, now) <= HIDE_AFTER_DAYS).map((o) => ({ fam: o.extracted.family.value, title: o.title })));
const ta = all.reduce((a, b) => a + b, 0);
const te = elig.reduce((a, b) => a + b, 0);
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;
console.log(`Inventario: ${inv.generatedAt}\n`);
console.log("| Vertical | Publicaciones abiertas | % | Elegibles desde AR | % |");
console.log("| --- | ---: | ---: | ---: | ---: |");
V.forEach((v, i) => console.log(`| ${v} | ${all[i]} | ${pct(all[i], ta)} | ${elig[i]} | ${pct(elig[i], te)} |`));
console.log(`| **Total** | **${ta}** | 100% | **${te}** | 100% |`);
