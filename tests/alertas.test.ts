import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_ALERTS, addAlert, alertEmails, describeQuery, listAlerts, queryToSearch, removeAlert } from "@/lib/alerts";
import { createUnsubToken, verifyUnsubToken } from "@/lib/auth";
import { resetMemoryDb } from "@/lib/db";
import { GET as cron } from "@/app/api/cron/alertas/route";

const q = { q: "Product Manager", area: "" as const, nivel: "" as const, modalidad: "remoto" as const, donde: "ar" as const };

beforeEach(() => resetMemoryDb());
afterEach(() => vi.unstubAllEnvs());

describe("alertas", () => {
  it("guarda sin duplicar, respeta el máximo y mantiene el índice", async () => {
    await addAlert("ana@x.com", q);
    await addAlert("ana@x.com", { ...q, q: "product manager" });
    expect(await listAlerts("ana@x.com")).toHaveLength(1);
    expect(await alertEmails()).toEqual(["ana@x.com"]);
    for (let i = 0; i < MAX_ALERTS; i++) await addAlert("ana@x.com", { ...q, q: `rol ${i}` });
    expect(await addAlert("ana@x.com", { ...q, q: "otra" })).toBe("max");
    await removeAlert("ana@x.com", null);
    expect(await alertEmails()).toEqual([]);
  });

  it("describe y arma el link de la búsqueda", () => {
    expect(describeQuery(q)).toBe("“Product Manager” · Remoto · desde Argentina");
    expect(queryToSearch(q)).toBe("/busquedas?q=Product+Manager&modalidad=remoto");
  });

  it("el link de baja es firmado", () => {
    expect(verifyUnsubToken(createUnsubToken("ana@x.com"))).toBe("ana@x.com");
    expect(verifyUnsubToken("trucho")).toBeNull();
  });

  it("el cron exige el secreto de Vercel", async () => {
    vi.stubEnv("CRON_SECRET", "abc");
    expect((await cron(new Request("https://maru.app/api/cron/alertas"))).status).toBe(401);
    const ok = await cron(new Request("https://maru.app/api/cron/alertas", { headers: { authorization: "Bearer abc" } }));
    expect(await ok.json()).toEqual({ sent: 0, reason: "sin base de datos" });
  });
});
