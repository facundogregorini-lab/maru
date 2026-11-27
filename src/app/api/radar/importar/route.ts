import { json, radarRoute } from "@/lib/radar/http";
import type { MappingOverrides } from "@/lib/radar/importer";
import { RadarError, applyImport, previewImport } from "@/lib/radar/service";
import { MAX_FILE_BYTES, parseSpreadsheet } from "@/lib/radar/tabular";

/**
 * Importar empresas (XLSX o CSV), en dos pasos con el mismo archivo:
 * step=preview → qué se crearía, conflictos y errores, sin escribir nada.
 * step=confirm → aplica (idempotente: no duplica ni pisa prioridades o notas).
 * overrides: mapeo de columnas elegido en la vista previa. industries: sector de cada pestaña o del CSV.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseJsonField<T>(v: FormDataEntryValue | null, fallback: T): T {
  if (typeof v !== "string" || !v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    throw new RadarError("Pedido inválido.", "BAD_REQUEST");
  }
}

export const POST = radarRoute(async ({ req, uid }) => {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_FILE_BYTES + 100_000) throw new RadarError("El archivo pesa más de 5 MB.", "TOO_LARGE", 413);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new RadarError("Pedido inválido.", "BAD_REQUEST");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new RadarError("Elegí un archivo .xlsx o .csv.", "BAD_REQUEST");
  const step = form.get("step") === "confirm" ? "confirm" : "preview";
  const overrides = parseJsonField<MappingOverrides>(form.get("overrides"), {});
  const industryOverride = parseJsonField<Record<string, string>>(form.get("industries"), {});

  const sheets = await parseSpreadsheet(file.name, new Uint8Array(await file.arrayBuffer()));
  const { analysis, plan } = await previewImport(uid, sheets, { overrides, industryOverride });
  if (!analysis.companies.length && !analysis.jobs.length) {
    throw new RadarError("No encontramos empresas en el archivo. Revisá que tenga una fila de encabezados con la columna «Empresa».", "NO_ROWS", 422);
  }

  const summary = {
    tabs: analysis.tabs,
    companies: plan.companies.map((p) => ({ id: p.company.id, name: p.company.name, identity: p.company.identity, domain: p.company.canonicalDomain, industries: p.company.industries, rows: p.rows, isNew: p.isNew, changed: p.changed, following: p.following })),
    totals: {
      rows: analysis.companies.length,
      unique: plan.companies.length,
      newCompanies: plan.companies.filter((p) => p.isNew).length,
      updatedCompanies: plan.companies.filter((p) => !p.isNew && p.changed).length,
      targetsCreated: plan.targetsCreated,
      targetsKept: plan.targetsKept,
      pilotJobs: plan.pilotJobs.length,
      ignoredRows: plan.ignoredRows,
      errors: plan.errors.length,
    },
    pilotSample: plan.pilotJobs.slice(0, 8).map((j) => ({ company: j.company, title: j.title, editorialScore: j.editorialScore, date: j.date })),
    notices: plan.notices.slice(0, 100),
    errors: plan.errors.slice(0, 100),
  };
  if (step === "preview") return json({ step, ...summary });
  const run = await applyImport(uid, file.name, plan);
  return json({ step, run, ...summary });
});
