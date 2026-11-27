import { compareAndSetJson, deleteKeys, getManyJson, pipeline, pushRecent, readRecent, setIfAbsent, setJson, setMembers } from "../../db";
import type { Company, CompanySource, ImportRun, MatchesDoc, MonitoringRun, PilotJob, RadarSettings, SourceJobsDoc, TargetsDoc } from "../types";
import type { RadarRepos } from "./types";

/** Implementación sobre Upstash. Esquema en docs/radar/ADR-001-persistencia.md. */

export const NS = "maru:radar:v1";
export const keys = {
  company: (id: string) => `${NS}:company:${id}`,
  companies: () => `${NS}:companies`,
  sources: (companyId: string) => `${NS}:sources:${companyId}`,
  targets: (uid: string) => `${NS}:u:${uid}:targets`,
  settings: (uid: string) => `${NS}:u:${uid}:settings`,
  pilot: (uid: string) => `${NS}:u:${uid}:pilot`,
  imports: (uid: string) => `${NS}:u:${uid}:imports`,
  jobs: (sourceId: string) => `${NS}:jobs:${sourceId}`,
  jobDesc: (jobId: string) => `${NS}:jobdesc:${jobId}`,
  runs: () => `${NS}:runs`,
  sourceRuns: (sourceId: string) => `${NS}:source-runs:${sourceId}`,
  lease: (key: string) => `${NS}:lease:${key}`,
  followed: () => `${NS}:followed`,
  matches: (uid: string, companyId: string) => `${NS}:u:${uid}:matches:${companyId}`,
};

const CHUNK = 200;
async function mget<T>(ks: string[]): Promise<(T | null)[]> {
  const out: (T | null)[] = [];
  for (let i = 0; i < ks.length; i += CHUNK) out.push(...(await getManyJson<T>(ks.slice(i, i + CHUNK))));
  return out;
}

const emptyTargets = (): TargetsDoc => ({ items: {}, updatedAt: 0 });

export const redisRepos: RadarRepos = {
  matches: {
    readMany: (uid, companyIds) => mget<MatchesDoc>(companyIds.map((c) => keys.matches(uid, c))),
    write: (uid, doc) => setJson(keys.matches(uid, doc.companyId), doc),
  },
  jobs: {
    readIndexes: (ids) => mget<SourceJobsDoc>(ids.map(keys.jobs)),
    writeIndex: (doc) => setJson(keys.jobs(doc.sourceId), doc),
    async writeDescriptions(byJobId) {
      const entries = Object.entries(byJobId);
      // De a 50 (≤ 200 KB por pedido a Upstash).
      for (let i = 0; i < entries.length; i += 50) await pipeline(entries.slice(i, i + 50).map(([id, text]) => ["SET", keys.jobDesc(id), JSON.stringify(text)]));
    },
    readDescriptions: (ids) => mget<string>(ids.map(keys.jobDesc)),
    async readDescription(jobId) {
      const [d] = await getManyJson<string>([keys.jobDesc(jobId)]);
      return d;
    },
  },
  runs: {
    async add(run) {
      const slim = { ...run };
      await pushRecent(keys.runs(), slim, 200);
      for (const item of run.items) await pushRecent(keys.sourceRuns(item.sourceId), { ...run, items: [item] }, 20);
    },
    recent: (limit = 20) => readRecent<MonitoringRun>(keys.runs(), limit),
    forSource: (sourceId) => readRecent<MonitoringRun>(keys.sourceRuns(sourceId), 20),
  },
  leases: {
    acquire: (key, owner, ttlMs) => setIfAbsent(keys.lease(key), owner, ttlMs),
    release: (key) => deleteKeys([keys.lease(key)]),
  },
  followed: {
    async add(ids) {
      if (ids.length) await pipeline([["SADD", keys.followed(), ...ids]]);
    },
    all: () => setMembers(keys.followed()),
  },
  companies: {
    async all() {
      const ids = await setMembers(keys.companies());
      return (await mget<Company>(ids.map(keys.company))).filter((c): c is Company => !!c);
    },
    getMany: (ids) => mget<Company>(ids.map(keys.company)),
    async saveMany(companies) {
      for (let i = 0; i < companies.length; i += CHUNK) {
        const part = companies.slice(i, i + CHUNK);
        await pipeline([...part.map((c) => ["SET", keys.company(c.id), JSON.stringify(c)]), ["SADD", keys.companies(), ...part.map((c) => c.id)]]);
      }
    },
  },
  sources: {
    async forCompanies(ids) {
      const lists = await mget<CompanySource[]>(ids.map(keys.sources));
      return Object.fromEntries(ids.map((id, i) => [id, lists[i] ?? []]));
    },
    async saveMany(byCompany) {
      const entries = Object.entries(byCompany);
      for (let i = 0; i < entries.length; i += CHUNK) {
        await pipeline(entries.slice(i, i + CHUNK).map(([id, list]) => ["SET", keys.sources(id), JSON.stringify(list)]));
      }
    },
  },
  targets: {
    async read(uid) {
      const [doc] = await getManyJson<TargetsDoc>([keys.targets(uid)]);
      return doc ?? emptyTargets();
    },
    async update(uid, fn) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const current = await this.read(uid);
        const out = fn(structuredClone(current));
        if (!out) return null;
        const next = { ...out.doc, updatedAt: Math.max(Date.now(), current.updatedAt + 1) };
        const { ok } = await compareAndSetJson(keys.targets(uid), current.updatedAt, next);
        if (ok) return out.result;
      }
      throw new Error("No pudimos guardar: hubo cambios al mismo tiempo. Probá de nuevo.");
    },
  },
  settings: {
    async read(uid) {
      const [s] = await getManyJson<RadarSettings>([keys.settings(uid)]);
      return s;
    },
    write: (uid, s) => setJson(keys.settings(uid), s),
  },
  pilot: {
    async list(uid) {
      const [list] = await getManyJson<PilotJob[]>([keys.pilot(uid)]);
      return list ?? [];
    },
    replace: (uid, jobs) => setJson(keys.pilot(uid), jobs),
  },
  imports: {
    list: (uid) => readRecent<ImportRun>(keys.imports(uid), 20),
    add: (uid, run) => pushRecent(keys.imports(uid), run, 20),
  },
};
