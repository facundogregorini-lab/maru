import type { Metadata } from "next";
import Link from "next/link";
import AlertButton from "@/components/alertas/AlertButton";
import AppShell from "@/components/app/AppShell";
import ChatPanel from "@/components/busquedas/ChatPanel";
import JobCard from "@/components/busquedas/JobCard";
import { JobFilterChips, JobSearchPill } from "@/components/busquedas/JobSearchBar";
import { PAGE_SIZE, searchJobs } from "@/lib/busquedas";
import { AREAS, parseJobQuery, type JobQuery } from "@/lib/jobFilters";

export const metadata: Metadata = {
  title: "Búsquedas · Maru",
  description: "Búsquedas laborales reales y abiertas, con las que podés tomar desde Argentina. Filtrá por área, modalidad y seniority.",
};

const fmt = (n: number) => n.toLocaleString("es-AR");

function hrefFor(query: JobQuery, pagina: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v && k !== "pagina" && !(k === "donde" && v === "ar")) sp.set(k, String(v));
  if (pagina > 1) sp.set("pagina", String(pagina));
  const s = sp.toString();
  return s ? `/busquedas?${s}` : "/busquedas";
}

export default async function BusquedasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseJobQuery(await searchParams);
  const { total, results } = await searchJobs(query);
  const pages = Math.min(50, Math.ceil(total / PAGE_SIZE));
  const label = query.q || (query.area ? AREAS[query.area] : "");

  return (
    <AppShell title="Búsquedas" search={<JobSearchPill value={query} />} side={<ChatPanel label={label} total={total} />}>
      <div className="flex items-center gap-3 py-1">
        {label && (
          <Link href="/busquedas" aria-label="Limpiar la búsqueda" className="grid h-8 w-8 place-items-center rounded-lg bg-white text-lg leading-none hover:bg-black/[0.05]">
            ×
          </Link>
        )}
        <p className="text-[13px]" aria-live="polite">
          {fmt(total)} {total === 1 ? "búsqueda" : "búsquedas"}
          {label && (
            <>
              {" "}
              para <strong>“{label}”</strong>
            </>
          )}
          {query.donde === "ar" ? " que podés tomar desde Argentina" : " en todo el mundo"}
        </p>
        <span className="ml-auto flex items-center gap-2">
          <AlertButton query={query} />
          <span className="hidden rounded-lg bg-white px-3 py-1.5 text-[13px] sm:inline">Más nuevas primero</span>
        </span>
      </div>
      <div className="mt-3">
        <JobFilterChips value={query} />
      </div>

      {results.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white p-10 text-center">
          <p className="text-xl font-semibold">No encontramos búsquedas con esos filtros</p>
          <p className="mt-2 text-ink/70">Probá con menos filtros o con otra palabra.</p>
          <Link href="/busquedas" className="press mt-6 inline-flex rounded-full bg-ink px-6 py-3 font-medium text-white">
            Ver todas
          </Link>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {results.map((j) => (
            <JobCard key={j.id} j={j} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="mt-6 flex items-center justify-between gap-4">
          {query.pagina > 1 ? (
            <Link href={hrefFor(query, query.pagina - 1)} className="press rounded-full bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.05]">
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-ink/60">
            Página {query.pagina} de {fmt(pages)}
          </span>
          {query.pagina < pages ? (
            <Link href={hrefFor(query, query.pagina + 1)} className="press rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-black">
              Más búsquedas →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </AppShell>
  );
}
