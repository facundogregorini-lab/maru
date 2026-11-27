import { COMPANY_ID, json, radarRoute } from "@/lib/radar/http";
import { RadarError, jobForHandoff } from "@/lib/radar/service";

/** Vacante con su descripción, para llevarla a Postular (CV), Carta o Entrevista: GET ?companyId=&jobId= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ req, uid }) => {
  const sp = new URL(req.url).searchParams;
  const companyId = sp.get("companyId") ?? "";
  const jobId = sp.get("jobId") ?? "";
  if (!COMPANY_ID.test(companyId) || !/^job_[a-f0-9]{20}$/.test(jobId)) throw new RadarError("Pedido inválido.", "BAD_REQUEST");
  const { job, description, company } = await jobForHandoff(uid, companyId, jobId);
  return json({ id: job.id, title: job.title, company, url: job.url, text: description });
});
