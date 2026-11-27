import { companyIdFrom, json, radarRoute, readJson } from "@/lib/radar/http";
import { RadarError, follow, listTargets, unfollow, updateTarget, type CreateCompanyInput, type TargetPatch } from "@/lib/radar/service";
import type { Priority } from "@/lib/radar/types";

/**
 * Mis empresas. GET: la lista con resumen. POST {companyId | create, priority}: seguir.
 * PATCH {companyId, priority?, notes?, status?}: editar. DELETE {companyId}: dejar de seguir.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = radarRoute(async ({ uid }) => json(await listTargets(uid)));

const priorityOf = (x: unknown): Priority | null | undefined => (x === undefined ? undefined : x === null || x === "" ? null : (x as Priority));

export const POST = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  const priority = priorityOf(body.priority);
  if (body.companyId !== undefined) return json(await follow(uid, { companyId: companyIdFrom(body), priority }), 201);
  const c = body.create as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") throw new RadarError("Falta la empresa.", "BAD_REQUEST");
  const create: CreateCompanyInput = {
    name: String(c.name ?? ""),
    domain: typeof c.domain === "string" ? c.domain : undefined,
    careersUrl: typeof c.careersUrl === "string" ? c.careersUrl : undefined,
    industry: typeof c.industry === "string" ? c.industry : undefined,
  };
  return json(await follow(uid, { create, priority }), 201);
});

export const PATCH = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  const patch: TargetPatch = {};
  if ("priority" in body) patch.priority = priorityOf(body.priority) ?? null;
  if ("notes" in body) patch.notes = body.notes as string;
  if ("status" in body) patch.status = body.status as TargetPatch["status"];
  return json({ target: await updateTarget(uid, companyIdFrom(body), patch) });
});

export const DELETE = radarRoute(async ({ req, uid }) => {
  const body = await readJson(req);
  const ok = await unfollow(uid, companyIdFrom(body));
  return ok ? json({ ok }) : json({ error: "No seguís esa empresa.", code: "NOT_FOUND" }, 404);
});
