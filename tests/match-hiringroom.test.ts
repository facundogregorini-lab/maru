import { describe, expect, it } from "vitest";
import { fetchHiringroom, hiringroomDescription, hiringroomIdDate, normalizeHiringroom, parseHiringroomCards, parseHiringroomJsonLd, type Board } from "@/lib/match/connectors";
import { boardsFrom } from "@/lib/match/directory";
import { applyBoard, emptyInventory } from "@/lib/match/inventory";
import { SOURCES } from "@/lib/match/sources";

const html = (body: string) => new Response(body, { headers: { "content-type": "text/html" } });
const desc = "<p>Buscamos analista de liquidación de sueldos para el área de BSO &amp; Payroll, con experiencia en cargas sociales y Excel.</p>".repeat(3);

/** Portal nuevo (Next.js): el listado viene en un JSON-LD ItemList de JobPosting, como en bdoargentina y profertil. */
function newPortal(items: object[], numberOfItems = items.length) {
  const list = { "@context": "https://schema.org", "@type": "ItemList", name: "Empleos en BDO Argentina", numberOfItems, itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, item })) };
  return `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"BDO Argentina"}</script><script type="application/ld+json">${JSON.stringify(list).replace(/</g, "\\u003c")}</script></head><body><div class="min-h-screen"></div></body></html>`;
}
const payroll = {
  "@type": "JobPosting",
  title: "Analista de Payroll Junior/ Semi Senior - Zona Norte",
  hiringOrganization: { "@type": "Organization", name: "BDO Argentina" },
  jobLocation: { "@type": "Place", address: "Martínez, Buenos Aires, Argentina" },
  description: `${desc}<ul><li>Modalidad híbrida, 3 días en oficina.</li></ul>`,
  datePosted: "2026-10-09",
  url: "http://bdoargentina.hiringroom.com/jobs/get_vacancy/6ac8f4d0ba4b2f6cb1fc6fde",
};

/** Portal viejo: tarjetas armadas en el servidor (marcado de cencosudarg, recortado). */
function card(id: string, title: string, location: string, modality: string) {
  return `<a href="/jobs/get_vacancy/${id}" class="text-decoration-none hrc-black">
    <div class="card p-3 mb-2 hoverable rounded border-0"><div class="card-body p-0 d-flex flex-column">
      <h4 class="font-black m-0 mb-2 fs-20 name__vacancy">
          ${title}
      </h4>
      <p class="card-text text-truncate m-0 mb-1 fs-14 text-color"><span class="font-weight-light">
          <i class="hr-Location-pin hrc-black"></i>
          ${location}                        </span></p>
      <p class="card-text text-truncate m-0 fs-14 text-color mb-2"><span class="font-weight-light">
          <i class="hr-Work-area hrc-black"></i>
          Comercial, Ventas y Negocios / Comercial                        </span></p>
      <div class="d-flex vacancy-tags">
        <p class="m-0 mr-2"><span class="tag-vacancy fs-12"><i class="hr-Clock mr-1 hrc-black"></i>
          Full-time                                </span></p>
        <p class="m-0 mr-2"><span class="tag-vacancy fs-12"><i class="hrc-black hr-Company mr-1"></i>
          ${modality}                                </span></p>
        <p class="m-0"><span class="tag-vacancy fs-12"><i class="hr-Campus mr-1 hrc-black"></i>
          Junior                                </span></p>
      </div>
      <p class="vacancy-time">Hace 2 horas</p>
    </div></div>
</a>`;
}
function oldPortal(cards: string[], shown: number, total: number) {
  return `<html><body>
    <a href="https://hiringroom.com/jobs/get_vacancy/644bc81e4f292409ea737788/candidates/new">Subir CV a base general</a>
    <div class="col-12 p-0 vacancyDataContainer">${cards.join("")}</div>
    <p class="noVacancyRequesttxt" id="noVacancy">No hay vacantes publicadas</p>
    <div class="col-12 mt-n4 paginationLabel p-0"><p class="paginationtxt fw-bold float-right">${total ? 1 : 0}-${shown} de ${total} vacantes </p></div>
  </body></html>`;
}
const detail = `<html><body><h2 class="commonstxt">Asistente Comercial Perecederos</h2>
  <div class="hrc-fs-14 m-0 hrc-black job-description-content">${desc}</div> <!-- La descripción es obligatoria -->
  <h6>Requisitos</h6><div class="hrc-fs-14 m-0 hrc-black job-description-content"><ul><li>Manejo avanzado de Excel.</li></ul></div>
  <div class="main__details bg-white p-4"><h6>Preguntas</h6><button>Postularse</button></div></body></html>`;

describe("HiringRoom", () => {
  const bdo: Board = { sourceId: "hiringroom", boardId: "hiringroom:bdoargentina", slug: "bdoargentina", company: "BDO Argentina" };
  const cencosud: Board = { sourceId: "hiringroom", boardId: "hiringroom:cencosudarg", slug: "cencosudarg", company: "Cencosud" };

  it("el id del aviso (ObjectId) trae la fecha de alta", () => {
    expect(hiringroomIdDate("6ad9f257a459c52b237998f8")).toBe("2026-10-22T11:24:07.000Z");
    expect(hiringroomIdDate("000000000000000000000000")).toBeNull();
    expect(hiringroomIdDate("no-es-un-id")).toBeNull();
  });

  it("portal nuevo: lee el JSON-LD con título, lugar, descripción, fecha y enlace https", async () => {
    const page = newPortal([payroll]);
    expect(parseHiringroomJsonLd(page)).toMatchObject({ total: 1, items: [{ title: payroll.title }] });
    const calls: string[] = [];
    const res = await fetchHiringroom(bdo, { fetchImpl: (async (url: RequestInfo | URL) => (calls.push(String(url)), html(page))) as typeof fetch, retries: 0 });
    expect(calls).toEqual(["https://bdoargentina.hiringroom.com/portal"]);
    expect(res).toMatchObject({ complete: true, received: 1 });
    const p = res.postings[0];
    expect(p).toMatchObject({
      sourceId: "hiringroom",
      externalId: "6ac8f4d0ba4b2f6cb1fc6fde",
      company: "BDO Argentina",
      sourceUrl: "https://bdoargentina.hiringroom.com/jobs/get_vacancy/6ac8f4d0ba4b2f6cb1fc6fde",
      locations: ["Martínez, Buenos Aires, Argentina"],
      countries: ["AR"],
      publishedAt: "2026-10-09T00:00:00.000Z",
    });
    expect(p.descriptionText).toContain("BSO & Payroll");
    expect(p.descriptionComplete).toBe(true);
  });

  it("portal nuevo: si dice más avisos de los que lista, la sincronización queda incompleta", async () => {
    const res = await fetchHiringroom(bdo, { fetchImpl: (async () => html(newPortal([payroll], 30))) as typeof fetch, retries: 0 });
    expect(res.complete).toBe(false);
  });

  it("portal viejo: tarjetas con modalidad, jornada y seniority, y la descripción de la página del aviso", async () => {
    const page = oldPortal([card("6ad9f257a459c52b237998f8", "Asistente Comercial Perecederos", "Munro, Buenos Aires, Argentina", "Híbrido"), card("6ad8a136bb7ed53c23a82d84", "Analista de Datos", "Rosario, Santa Fe, Argentina", "Remoto")], 2, 2);
    const parsed = parseHiringroomCards(page);
    expect(parsed?.total).toBe(2);
    expect(parsed?.cards[0]).toEqual({ id: "6ad9f257a459c52b237998f8", title: "Asistente Comercial Perecederos", location: "Munro, Buenos Aires, Argentina", area: "Comercial, Ventas y Negocios / Comercial", employment: "Full-time", modality: "Híbrido", seniority: "Junior" });
    const text = hiringroomDescription(detail);
    expect(text).toContain("BSO & Payroll");
    expect(text).toContain("Manejo avanzado de Excel");
    expect(text).not.toMatch(/Preguntas|Postularse/);

    const calls: string[] = [];
    const fetchImpl = (async (url: RequestInfo | URL) => (calls.push(String(url)), html(String(url).endsWith("/portal") ? page : detail))) as typeof fetch;
    const res = await fetchHiringroom(cencosud, { fetchImpl, retries: 0 });
    expect(calls).toEqual(["https://cencosudarg.hiringroom.com/portal", "https://cencosudarg.hiringroom.com/jobs/get_vacancy/6ad9f257a459c52b237998f8", "https://cencosudarg.hiringroom.com/jobs/get_vacancy/6ad8a136bb7ed53c23a82d84"]);
    expect(res).toMatchObject({ complete: true, received: 2 });
    const [hybrid, remote] = res.postings;
    expect(hybrid).toMatchObject({ company: "Cencosud", countries: ["AR"], employmentHint: "Full-time", seniorityHint: "Junior", department: "Comercial, Ventas y Negocios / Comercial", publishedAt: "2026-10-22T11:24:07.000Z" });
    expect(hybrid.workplace).toMatchObject({ value: "hibrido", from: "fuente" });
    // Remoto: el país es una condición de residencia, no una oficina.
    expect(remote).toMatchObject({ countries: [], regionText: ["Argentina"] });
    expect(remote.workplace.value).toBe("remoto");

    const inv = emptyInventory("fixture");
    applyBoard(inv, cencosud.boardId, "hiringroom", { postings: res.postings, complete: res.complete }, "2026-10-22T00:00:00.000Z");
    expect(inv.postings.map((p) => p.eligibility.status)).toEqual(["elegible", "elegible"]);
  });

  it("portal viejo con más de una página: lee la primera y no da la bolsa por completa", async () => {
    const page = oldPortal([card("6ad9f257a459c52b237998f8", "Asistente Comercial", "Munro, Buenos Aires, Argentina", "Presencial")], 1, 40);
    const res = await fetchHiringroom(cencosud, { fetchImpl: (async (url: RequestInfo | URL) => html(String(url).endsWith("/portal") ? page : detail)) as typeof fetch, retries: 0 });
    expect(res).toMatchObject({ complete: false, received: 1 });
  });

  it("sin avisos publicados es una bolsa vacía; una página con otro formato falla en vez de vaciarla", async () => {
    const empty = await fetchHiringroom(cencosud, { fetchImpl: (async () => html(oldPortal([], 0, 0))) as typeof fetch, retries: 0 });
    expect(empty).toMatchObject({ postings: [], complete: true, received: 0 });
    await expect(fetchHiringroom(cencosud, { fetchImpl: (async () => html("<html><body>Página no encontrada</body></html>")) as typeof fetch, retries: 0 })).rejects.toThrow(/formato/);
    const broken = newPortal([{ "@type": "JobPosting", title: "Sin enlace" }]);
    await expect(fetchHiringroom(bdo, { fetchImpl: (async () => html(broken)) as typeof fetch, retries: 0 })).rejects.toThrow(/formato/);
    await expect(fetchHiringroom({ ...cencosud, slug: "a.b/c" }, { retries: 0 })).rejects.toThrow(/inválida/);
  });

  it("normaliza sin modalidad declarada ni país reconocible", () => {
    const p = normalizeHiringroom({ id: "6ad9f257a459c52b237998f8", title: "Cajero/a", location: "", description: "" }, cencosud);
    expect(p).toMatchObject({ locations: [], countries: [], regionText: [], descriptionComplete: false });
  });

  it("está registrada y las empresas del directorio se sincronizan", () => {
    expect(SOURCES.find((s) => s.id === "hiringroom")).toMatchObject({ enabled: true, cost: "gratis" });
    const boards = boardsFrom({ reviewedAt: "", companies: [{ name: "Cencosud", sourceId: "hiringroom", slug: "cencosudarg", evidence: "x", addedAt: "", status: "candidata" }] }, {});
    expect(boards.map((b) => b.boardId)).toContain("hiringroom:cencosudarg");
  });
});
