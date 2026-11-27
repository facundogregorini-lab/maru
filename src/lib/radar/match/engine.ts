import { createHash } from "node:crypto";
import { incrementWithTtl } from "../../db";
import { extract, familyFromTitle } from "../../match/extract";
import { functionMismatch, levelScore, levelVerdict, monthlyMax, postingLevel, profileLevel, targetRange } from "../../match/fit";
import { FAMILY_LABEL, SENIORITY_LABEL } from "../../match/labels";
import { salaryFromText } from "../../match/salary";
import type { MatchPrefs, MatchProfile, RoleFamily } from "../../match/types";
import type { UsageReport } from "../../claude";
import { fold } from "../identity";
import { radarRepos } from "../repo";
import type { JobOpening, MatchesDoc, Priority, RadarMatch, RadarSettings } from "../types";
import { eligibilityFor } from "./eligibility";
import { BATCH, PROMPT_VERSION, defaultEvaluator, llmEnabled, profileBlock, type Evaluator, type JobEval } from "./llm";
import { PRIORITY_INTEREST, SCORING_VERSION, compose, type CriterionInput } from "./score";

/**
 * Motor de radar-match: preclasifica por reglas (función, nivel, elegibilidad), evalúa con IA sólo lo que pasa,
 * guarda por persona con scoring_version, profile_hash y job_hash, y no vuelve a evaluar si nada cambió.
 */

export const EMPTY_PREFS: MatchPrefs = { objetivo: "", rolesDeseados: [], evitar: [], ciudad: "", pais: "", otrosLugares: [], autorizacion: [], modalidades: [], seniorities: [], contratos: [], salario: null, indispensables: [], carrera: "continuidad" };

export const VERSION = `${SCORING_VERSION}/p${PROMPT_VERSION}`;
export const REJECTED_CAP = 30;

export function profileHash(profile: MatchProfile, prefs: MatchPrefs | null, settings: RadarSettings): string {
  const p = prefs ?? EMPTY_PREFS;
  const relevant = { profile, prefs: { roles: p.rolesDeseados, seniorities: p.seniorities, carrera: p.carrera, evitar: p.evitar }, eligibility: settings.eligibility, weights: settings.weights };
  return createHash("sha256").update(JSON.stringify(relevant)).digest("hex").slice(0, 24);
}

export type Precheck = {
  eligibility: ReturnType<typeof eligibilityFor>;
  inputs: CriterionInput;
  /** Motivo para no llamar a la IA (función distinta, nivel fuera de rango, bloqueo). */
  reject: string | null;
};

function profileFamilies(profile: MatchProfile, prefs: MatchPrefs): Set<RoleFamily> {
  return new Set([profile.headline, ...profile.titles.slice(0, 4), ...prefs.rolesDeseados].filter((t) => t.trim()).map(familyFromTitle).filter((f) => f !== "otros"));
}

/** Preclasificación determinística (sin red ni IA). */
export function precheck(job: JobOpening, description: string, profile: MatchProfile, prefsIn: MatchPrefs | null, settings: RadarSettings, priority: Priority | null): Precheck {
  const prefs = prefsIn ?? EMPTY_PREFS;
  const extracted = extract({ title: job.title, descriptionText: description, department: job.department });
  const inputs: CriterionInput = {};
  let reject: string | null = null;

  // Interés por la empresa (prioridad personal).
  inputs.interes = { score: PRIORITY_INTEREST[String(priority)], evidence: [priority ? `La empresa está en tu ${priority}` : "Empresa todavía sin clasificar"] };

  // Elegibilidad y ubicación.
  const eligibility = eligibilityFor(job, description, settings.eligibility);
  inputs.ubicacion = { score: eligibility.location.score, evidence: eligibility.location.evidence };
  if (eligibility.status === "blocked") reject = eligibility.evidence[0] ?? "Requisito excluyente confirmado";

  // Función.
  const fams = profileFamilies(profile, prefs);
  const fam = extracted.family.value;
  if (!reject && prefs.carrera !== "cambio" && (functionMismatch(job.title, profile, prefs) || (fams.size > 0 && fam !== "otros" && !fams.has(fam)))) {
    reject = `Función distinta: ${FAMILY_LABEL[fam] ?? fam}`;
    inputs.experiencia = { score: 5, evidence: [`El puesto es de ${FAMILY_LABEL[fam] ?? fam} y tu trayectoria es de ${[...fams].map((f) => FAMILY_LABEL[f] ?? f).join(", ") || "otra área"}.`] };
  }

  // Nivel.
  const pl = postingLevel(job.title, extracted, description);
  const range = targetRange(prefs, profile);
  const ls = levelScore(pl, range);
  const pLevel = profileLevel(profile);
  inputs.seniority = {
    score: ls === null || !pl.level ? null : ls * 100,
    evidence: [pl.level ? `Nivel del aviso: ${SENIORITY_LABEL[pl.level]}${pl.certain ? "" : " (dudoso)"}` : "El aviso no deja claro el nivel", pLevel ? `Tu nivel demostrado: ${SENIORITY_LABEL[pLevel]}` : "Sin nivel claro en el CV"],
  };
  if (!reject && levelVerdict(pl, range).action === "excluir") reject = `Nivel fuera de tu rango (${pl.level ? SENIORITY_LABEL[pl.level] : "?"})`;

  // Compensación: sólo publicada, en USD, contra el mínimo declarado.
  const sal = salaryFromText(description);
  const min = settings.eligibility.minMonthlyUsd;
  const usd = sal?.value && /usd|us\$|\$/i.test(sal.value.currency) ? monthlyMax(sal.value) : null;
  inputs.compensacion = min && usd ? { score: Math.min(100, (usd / min) * 100), evidence: [`Publica hasta USD ${Math.round(usd)} por mes; tu mínimo es USD ${min}.`] } : { score: null, evidence: [sal?.value ? "Publica salario, pero no se pudo comparar con tu mínimo" : "El aviso no publica salario"] };

  // Competencias por reglas (si no hay IA): habilidades requeridas que muestra el CV.
  if (!inputs.experiencia && extracted.skillsRequired.length) {
    const mine = new Set(profile.skills.map(fold));
    const hit = extracted.skillsRequired.filter((s) => mine.has(fold(s)));
    inputs.experiencia = { score: (hit.length / extracted.skillsRequired.length) * 100, evidence: [`Muestra ${hit.length} de ${extracted.skillsRequired.length} habilidades requeridas`] };
  }
  return { eligibility, inputs, reject };
}

function build(job: JobOpening, pre: Precheck, settings: RadarSettings, hashes: { profileHash: string }, ev: JobEval | null, now: string, prev?: RadarMatch): RadarMatch {
  const inputs: CriterionInput = { ...pre.inputs };
  if (ev) {
    inputs.experiencia = { score: ev.competencias.puntaje, evidence: ev.competencias.evidencia };
    const levelUncertain = inputs.seniority?.score === null || inputs.seniority?.evidence[0]?.includes("dudoso");
    if (ev.nivel.puntaje !== null && levelUncertain) inputs.seniority = { score: ev.nivel.puntaje, evidence: [...ev.nivel.evidencia, ...(inputs.seniority?.evidence ?? [])].slice(0, 3) };
    const min = settings.eligibility.minMonthlyUsd;
    if (inputs.compensacion?.score === null && ev.salarioPublicado?.maxUsdMes && min) inputs.compensacion = { score: Math.min(100, (ev.salarioPublicado.maxUsdMes / min) * 100), evidence: [`Publica ${ev.salarioPublicado.texto}`] };
  }
  const method: RadarMatch["method"] = ev ? "ia" : "reglas";
  const c = compose(inputs, settings.weights, method);
  // No encaja por función o nivel: el puntaje no puede quedar alto aunque el resto cumpla.
  const rejected = pre.reject && pre.eligibility.status !== "blocked" ? pre.reject : null;
  return {
    jobId: job.id,
    score: rejected && c.score !== null ? Math.min(c.score, REJECTED_CAP) : c.score,
    rejected,
    coverage: c.coverage,
    confidence: c.confidence,
    eligibility: pre.eligibility.status,
    eligibilityEvidence: pre.eligibility.evidence,
    breakdown: c.breakdown,
    method,
    mainReason: ev?.razonPrincipal ?? pre.reject ?? "",
    mainBarrier: pre.eligibility.status !== "eligible" ? (pre.eligibility.evidence[0] ?? "") : (ev?.barreraPrincipal ?? pre.reject ?? ""),
    strengths: ev?.fortalezas ?? [],
    gaps: ev?.brechas ?? [],
    mustHaves: (ev?.excluyentes ?? []).map((x) => ({ text: x.requisito, status: x.estado })),
    unknowns: [...(ev?.desconocidos ?? []), ...c.breakdown.filter((b) => !b.known).map((b) => `Sin dato para «${b.id}»`)].slice(0, 6),
    nextStep: ev?.siguientePaso ?? (pre.reject ? "Seguir con otras vacantes." : ""),
    scoringVersion: VERSION,
    profileHash: hashes.profileHash,
    jobHash: job.contentHash,
    evaluatedAt: now,
    stale: false,
    disposition: prev?.disposition ?? null,
    dispositionAt: prev?.dispositionAt ?? null,
  };
}

export type ProfileSource = { profile: MatchProfile | null; prefs: MatchPrefs | null };

export type EvaluateOptions = {
  evaluator?: Evaluator;
  maxLlm?: number;
  dailyLimit?: number;
  now?: () => Date;
  onUsage?: (u: UsageReport) => void;
  /** Sólo estas empresas (por defecto, todas las activas). */
  companyIds?: string[];
};

export type EvaluateResult = { total: number; unchanged: number; rules: number; ia: number; failed: number; pendingIa: number; staleKept: number; quotaLeft: number | null };

export class NoProfileError extends Error {
  code = "NO_PROFILE";
}

export async function evaluateForUser(uid: string, source: ProfileSource, settings: RadarSettings, opts: EvaluateOptions = {}): Promise<EvaluateResult> {
  if (!source.profile) throw new NoProfileError("Cargá tu CV en Match para que Maru pueda evaluar las vacantes.");
  const profile = source.profile;
  const repos = radarRepos();
  const now = (opts.now ?? (() => new Date()))().toISOString();
  const evaluator = opts.evaluator ?? (llmEnabled() ? defaultEvaluator : null);

  const targets = (await repos.targets.read(uid)).items;
  const active = Object.values(targets).filter((t) => t.status === "activa" && (!opts.companyIds || opts.companyIds.includes(t.companyId)));
  const ids = active.map((t) => t.companyId);
  const prio = new Map(active.map((t) => [t.companyId, t.priority]));
  const byCompany = await repos.sources.forCompanies(ids);
  const sources = Object.values(byCompany).flat();
  const indexes = await repos.jobs.readIndexes(sources.map((s) => s.id));
  const jobs = indexes.flatMap((d) => (d ? Object.values(d.jobs) : [])).filter((j) => j.status === "open");
  const names = new Map((await repos.companies.getMany(ids)).filter(Boolean).map((c) => [c!.id, c!.name]));
  const docs = new Map<string, MatchesDoc>();
  (await repos.matches.readMany(uid, ids)).forEach((d, i) => docs.set(ids[i], d ?? { companyId: ids[i], items: {}, updatedAt: 0 }));
  const ph = profileHash(profile, source.prefs, settings);

  const todo = jobs.filter((j) => {
    const m = docs.get(j.companyId)?.items[j.id];
    return !(m && !m.stale && m.scoringVersion === VERSION && m.profileHash === ph && m.jobHash === j.contentHash);
  });
  const res: EvaluateResult = { total: jobs.length, unchanged: jobs.length - todo.length, rules: 0, ia: 0, failed: 0, pendingIa: 0, staleKept: 0, quotaLeft: null };
  const descs = await repos.jobs.readDescriptions(todo.map((j) => j.id));
  const llmQueue: { job: JobOpening; pre: Precheck; desc: string }[] = [];
  todo.forEach((job, i) => {
    const desc = descs[i] ?? "";
    const pre = precheck(job, desc, profile, source.prefs, settings, prio.get(job.companyId) ?? null);
    const doc = docs.get(job.companyId)!;
    if (pre.reject) {
      doc.items[job.id] = build(job, pre, settings, { profileHash: ph }, null, now, doc.items[job.id]);
      res.rules++;
    } else llmQueue.push({ job, pre, desc });
  });

  // IA: primero lo más prioritario y lo más nuevo, con tope por llamada y cupo diario.
  llmQueue.sort((a, b) => (PRIORITY_INTEREST[String(prio.get(b.job.companyId) ?? null)] - PRIORITY_INTEREST[String(prio.get(a.job.companyId) ?? null)]) || (b.job.publishedAt ?? b.job.firstSeenAt).localeCompare(a.job.publishedAt ?? a.job.firstSeenAt));
  let allowed = Math.min(llmQueue.length, opts.maxLlm ?? 30);
  if (evaluator && allowed > 0) {
    const limit = opts.dailyLimit ?? Number(process.env.RADAR_DAILY_EVALS ?? 150);
    const used = await incrementWithTtl(`maru:radar:v1:u:${uid}:ia:${now.slice(0, 10)}`, allowed, 2 * 86_400);
    const over = Math.max(0, used - limit);
    allowed = Math.max(0, allowed - over);
    res.quotaLeft = Math.max(0, limit - Math.min(used, limit));
  } else if (!evaluator) allowed = 0;

  const batch = llmQueue.slice(0, allowed);
  const pb = profileBlock(profile, source.prefs);
  const groups: (typeof batch)[] = [];
  for (let i = 0; i < batch.length; i += BATCH) groups.push(batch.slice(i, i + BATCH));
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, groups.length) }, async () => {
      while (next < groups.length) {
        const g = groups[next++];
        let evals: JobEval[] = [];
        try {
          evals = await evaluator!(pb, g.map(({ job, desc }) => ({ id: job.id, title: job.title, company: names.get(job.companyId) ?? "", location: job.location, remoteType: job.remoteType, description: desc })), opts.onUsage);
        } catch {
          console.warn("MARU_RADAR_MATCH_UNAVAILABLE");
        }
        for (const it of g) {
          const doc = docs.get(it.job.companyId)!;
          const ev = evals.find((e) => e.id === it.job.id) ?? null;
          if (ev) {
            doc.items[it.job.id] = build(it.job, it.pre, settings, { profileHash: ph }, ev, now, doc.items[it.job.id]);
            res.ia++;
          } else {
            res.failed++;
            const prev = doc.items[it.job.id];
            if (prev) {
              doc.items[it.job.id] = { ...prev, stale: true };
              res.staleKept++;
            }
          }
        }
      }
    }),
  );
  // Lo que quedó sin IA (tope o cupo): si tenía un resultado viejo, se marca desactualizado.
  for (const it of llmQueue.slice(allowed)) {
    res.pendingIa++;
    const doc = docs.get(it.job.companyId)!;
    const prev = doc.items[it.job.id];
    if (prev && !prev.stale) {
      doc.items[it.job.id] = { ...prev, stale: true };
      res.staleKept++;
    }
  }
  const at = Date.parse(now);
  for (const doc of docs.values()) if (Object.keys(doc.items).length) await repos.matches.write(uid, { ...doc, updatedAt: at });
  return res;
}

/** Descartar / volver a mostrar: preferencia personal. No toca la vacante global ni Seguimiento. */
export async function setDisposition(uid: string, companyId: string, jobId: string, disposition: RadarMatch["disposition"], now = new Date()): Promise<boolean> {
  const repos = radarRepos();
  const [doc] = await repos.matches.readMany(uid, [companyId]);
  const d: MatchesDoc = doc ?? { companyId, items: {}, updatedAt: 0 };
  const prev = d.items[jobId];
  d.items[jobId] = prev
    ? { ...prev, disposition, dispositionAt: now.toISOString() }
    : {
        jobId, score: null, coverage: 0, confidence: "baja", eligibility: "needs_verification", eligibilityEvidence: [], rejected: null, breakdown: [], method: "reglas", mainReason: "", mainBarrier: "", strengths: [], gaps: [], mustHaves: [], unknowns: [], nextStep: "",
        scoringVersion: "", profileHash: "", jobHash: "", evaluatedAt: now.toISOString(), stale: true, disposition, dispositionAt: now.toISOString(),
      };
  await repos.matches.write(uid, { ...d, updatedAt: now.getTime() });
  return true;
}
