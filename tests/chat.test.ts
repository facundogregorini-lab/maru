import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/claude", async (orig) => {
  const real = await orig<typeof import("@/lib/claude")>();
  return { ...real, askStructured: vi.fn(async () => ({ respuesta: "Te muestro algunas.", buscar: "product manager", herramienta: "match" })) };
});

describe("chat con Maru", () => {
  it("las búsquedas vienen del inventario, no de la IA", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const { searchJobs } = await import("@/lib/busquedas");
    const res = await POST(new Request("https://maru.app/api/chat", { method: "POST", body: JSON.stringify({ messages: [{ role: "user", text: "Busco trabajo de PM" }] }) }));
    const data = (await res.json()) as { respuesta: string; jobs: { id: string }[]; verMas: string; herramienta: { href: string } };
    expect(data.respuesta).toBe("Te muestro algunas.");
    expect(data.herramienta.href).toBe("/match");
    expect(data.verMas).toBe("/busquedas?q=product%20manager");
    const real = (await searchJobs({ q: "product manager", area: "", nivel: "", modalidad: "", donde: "ar", pagina: 1 })).results.slice(0, 4).map((j) => j.id);
    expect(data.jobs.map((j) => j.id)).toEqual(real);
  });

  it("pide un mensaje de la persona", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(new Request("https://maru.app/api/chat", { method: "POST", body: JSON.stringify({ messages: [] }) }));
    expect(res.status).toBe(400);
  });
});
