import type { Metadata } from "next";
import Link from "next/link";
import CompanyTile from "@/components/busquedas/CompanyTile";
import JobSearchBar from "@/components/busquedas/JobSearchBar";
import TimeAgo from "@/components/landing/TimeAgo";
import SiteShell from "@/components/SiteShell";
import { PAGE_SIZE, searchJobs } from "@/lib/busquedas";
import { parseJobQuery } from "@/lib/jobFilters";
import { POPULAR } from "@/lib/popular";

export const metadata: Metadata = {
  title: "Búsquedas · Maru",
  description: "Búsquedas laborales reales y abiertas, con las que podés tomar desde Argentina. Filtrá por área, modalidad y seniority.",
};

const fmt = (n: number) => n.toLocaleString("es-AR");

export default async function BusquedasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseJobQuery(await searchParams);
  const { total, results } = await searchJobs(query);
  const pages = Math.ceil(total / PAGE_SIZE);
  const pageHref = (n: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "pagina" && !(k === "donde" && v === "ar")) sp.set(k, String(v));
    if (n > 1) sp.set("pagina", String(n));
    const s = sp.toString();
    return s ? `/busquedas?${s}` : "/busquedas";
  };

  return (
    <SiteShell>
      <section className="full-bleed -mt-8 bg-sand px-5 pb-10 pt-12 sm:pt-16">
        <div className="mx-auto max-w-[1200px]">
          <h1 className="font-display text-[2.2rem] font-light uppercase leading-[1.05] sm:text-6xl">
            Encontrá tu trabajo <strong className="font-bold">en un clic</strong>
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink/70">Búsquedas reales y abiertas, actualizadas todos los días. Para ver cuáles encajan con tu CV, usá el Match.</p>
          <div className="mt-8">
            <JobSearchBar value={query} />
          </div>
        </div>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <p className="text-sm text-muted" aria-live="polite">
            <strong className="font-semibold text-ink">{fmt(total)}</strong> {total === 1 ? "búsqueda" : "búsquedas"}
            {query.donde === "ar" ? " que podés tomar desde Argentina" : " en todo el mundo"}
            {pages > 1 && ` · página ${query.pagina} de ${fmt(pages)}`}
          </p>

          {results.length === 0 ? (
            <div className="mt-6 rounded-3xl bg-sand p-8 text-center">
              <p className="font-display text-2xl font-semibold">No encontramos búsquedas con esos filtros</p>
              <p className="mt-2 text-ink/70">Probá con menos filtros o con otra palabra.</p>
              <Link href="/busquedas" className="press mt-6 inline-flex rounded-full bg-ink px-6 py-3 font-medium text-white">
                Ver todas
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {results.map((j) => (
                <li key={j.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <CompanyTile name={j.company} />
                    <div className="min-w-0">
                      <p className="text-sm text-muted">
                        <span className="font-semibold text-ink">{j.company}</span> · <TimeAgo iso={j.postedAt} />
                      </p>
                      <h2 className="mt-0.5 font-display text-xl font-semibold leading-snug">{j.title}</h2>
                      <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {j.modalidad && <span className="rounded-md bg-black/[0.05] px-2 py-1">{j.modalidad}</span>}
                        {j.where && <span className="max-w-[260px] truncate rounded-md bg-black/[0.05] px-2 py-1">{j.where}</span>}
                        {j.eligible && <span className="rounded-md bg-brand-soft px-2 py-1 font-semibold text-brand-dark">✓ Desde Argentina</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" className="press rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-black">
                      Ver y postularme ↗
                    </a>
                    {j.attribution && <span className="text-[11px] text-muted">{j.attribution}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <nav aria-label="Páginas" className="mt-8 flex items-center justify-between gap-4">
              {query.pagina > 1 ? (
                <Link href={pageHref(query.pagina - 1)} className="press rounded-full bg-black/[0.05] px-5 py-2.5 text-sm font-medium hover:bg-black/[0.08]">
                  ← Anteriores
                </Link>
              ) : (
                <span />
              )}
              {query.pagina < Math.min(pages, 50) && (
                <Link href={pageHref(query.pagina + 1)} className="press rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-black">
                  Más búsquedas →
                </Link>
              )}
            </nav>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-ink p-6 text-white">
            <p className="font-display text-2xl font-semibold leading-tight">¿Cuáles encajan con vos?</p>
            <p className="mt-2 text-sm text-white/70">Subí tu CV y Maru te ordena estas búsquedas por compatibilidad, con el porqué de cada una.</p>
            <Link href="/match" className="press mt-5 inline-flex rounded-full bg-neon px-5 py-2.5 text-sm font-bold uppercase text-ink">
              Ver mi match
            </Link>
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Búsquedas populares</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {POPULAR.map((p) => (
                <Link key={p.href} href={p.href} className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-white hover:bg-black">
                  {p.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </SiteShell>
  );
}
