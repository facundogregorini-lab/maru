import { readFileSync } from "node:fs";
import type { Board } from "@/lib/match/connectors";
import type { Interactions, MatchPrefs, MatchProfile } from "@/lib/match/types";

/** Fixtures de prueba: SIEMPRE separadas del inventario real (data/match). */
export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/match/${name}`, import.meta.url), "utf8")) as T;
}

export const BOARDS = {
  gh: { sourceId: "greenhouse", boardId: "greenhouse:acmepagos", slug: "acmepagos", company: "Acme Pagos" } satisfies Board,
  lever: { sourceId: "lever", boardId: "lever:acmelever", slug: "acmelever", company: "Acme Lever" } satisfies Board,
  ashby: { sourceId: "ashby", boardId: "ashby:acmeashby", slug: "acmeashby", company: "Acme Ashby" } satisfies Board,
  remotive: { sourceId: "remotive", boardId: "remotive" } satisfies Board,
  jobicy: { sourceId: "jobicy", boardId: "jobicy" } satisfies Board,
  getonbrd: { sourceId: "getonbrd", boardId: "getonbrd" } satisfies Board,
};

/** fetch falso: responde según el comienzo de la URL. */
export function fakeFetch(routes: Record<string, unknown | (() => Response)>) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) return new Response("not found", { status: 404 });
    const r = routes[key];
    return typeof r === "function" ? (r as () => Response)() : new Response(JSON.stringify(r), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

export const noSleep = async () => {};

export const dataProfile: MatchProfile = {
  headline: "Data Analyst",
  titles: ["Data Analyst", "Business Analyst"],
  skills: ["SQL", "Python", "Tableau", "Excel"],
  languages: [
    { language: "Español", level: "Nativo" },
    { language: "Inglés", level: "Avanzado" },
  ],
  yearsExperience: 5,
  location: "Buenos Aires, Argentina",
  summary: "",
};

export const basePrefs: MatchPrefs = {
  objetivo: "",
  rolesDeseados: [],
  evitar: [],
  ciudad: "Buenos Aires",
  pais: "Argentina",
  otrosLugares: [],
  autorizacion: [],
  modalidades: [],
  seniorities: [],
  contratos: [],
  salario: null,
  indispensables: [],
  carrera: "continuidad",
};

export const noInteractions: Interactions = { saved: [], discarded: [] };
