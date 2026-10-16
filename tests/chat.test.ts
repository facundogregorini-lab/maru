import { afterEach, describe, expect, it, vi } from "vitest";
const { ask } = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock("@/lib/claude", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/claude")>(), askStructured: ask }));
vi.mock("@/lib/match/load", () => ({ loadInventory: async () => ({ inv: { opportunities: [
  { id: "abcdef1234", title: "React Developer", company: "Acme", status: "abierta", eligibility: { status: "elegible", evidence: [] }, locations: ["Argentina"], extracted: { family: { value: "software" }, skillsRequired: ["React"] } },
  { id: "cerrada123", title: "React Developer", company: "Cerrada", status: "cerrada", eligibility: { status: "elegible", evidence: [] }, locations: [], extracted: { family: { value: "software" }, skillsRequired: ["React"] } },
] } }) }));
import { POST } from "@/app/api/chat/route";
afterEach(() => vi.clearAllMocks());
const req = (body: unknown) => new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) });
describe("chat con Maru", () => {
  it("rechaza consultas vacías sin gastar IA", async () => {
    expect((await POST(req({ message: "" }))).status).toBe(400); expect(ask).not.toHaveBeenCalled();
  });
  it("sólo enlaza búsquedas abiertas proporcionadas al modelo", async () => {
    ask.mockResolvedValueOnce({ answer: "Podés revisar esta búsqueda.", opportunityIds: ["abcdef1234", "inventada", "cerrada123"] });
    const res = await POST(req({ message: "Busco React" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.jobs).toEqual([{ id: "abcdef1234", title: "React Developer", company: "Acme" }]);
    expect(ask.mock.calls[0][0].content[0].text).not.toContain('"company":"Cerrada"');
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("no agrega un perfil sin que el navegador lo envíe expresamente", async () => {
    ask.mockResolvedValueOnce({ answer: "Contame el rol que buscás.", opportunityIds: [] });
    await POST(req({ message: "Ayudame con mi CV" }));
    expect(JSON.parse(ask.mock.calls[0][0].content[0].text).perfil_consentido).toBeNull();
  });
});
