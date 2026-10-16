import { beforeEach, describe, expect, it } from "vitest";
import { LIMITS, WINDOW_MS, bucketFor, clientIp, resetRateLimit, take } from "@/lib/rateLimit";

beforeEach(() => resetRateLimit());

describe("límite de uso de la IA", () => {
  it("deja pasar hasta el límite y después pide esperar", () => {
    const t = 1_000_000;
    for (let i = 0; i < LIMITS.pesado; i++) expect(take("1.1.1.1", "pesado", t + i)).toBe(0);
    const wait = take("1.1.1.1", "pesado", t + 100);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(WINDOW_MS / 1000);
    // Otra IP no se ve afectada, ni el otro tipo de pedido.
    expect(take("2.2.2.2", "pesado", t)).toBe(0);
    expect(take("1.1.1.1", "liviano", t)).toBe(0);
  });

  it("libera al pasar la ventana", () => {
    for (let i = 0; i < LIMITS.pesado; i++) take("ip", "pesado", 0);
    expect(take("ip", "pesado", 10)).toBeGreaterThan(0);
    expect(take("ip", "pesado", WINDOW_MS + 1)).toBe(0);
  });

  it("clasifica rutas y lee la IP", () => {
    expect(bucketFor("/api/entrevista/turno")).toBe("liviano");
    expect(bucketFor("/api/generate")).toBe("pesado");
    expect(clientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers())).toBe("anon");
  });
});

describe("contador compartido", () => {
  it("comparte el límite entre consumidores y libera al vencer", async () => {
    const { takeCounter, resetMemoryCounters } = await import("@/lib/db");
    resetMemoryCounters();
    const requests = await Promise.all(Array.from({ length: 12 }, () => takeCounter("maru:test:contador", 5, 1000, 100)));
    expect(requests.filter((wait) => wait === 0)).toHaveLength(5);
    expect(requests.filter((wait) => wait > 0)).toHaveLength(7);
    expect(await takeCounter("maru:test:contador", 5, 1000, 1101)).toBe(0);
  });
});
