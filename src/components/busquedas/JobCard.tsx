import Link from "next/link";
import TimeAgo from "@/components/landing/TimeAgo";
import type { JobResult } from "@/lib/busquedas";
import CompanyTile from "./CompanyTile";
import PrepareJob from "./PrepareJob";
import { ApplyLink } from "./TrackJob";
import { displayCompany } from "@/lib/match/labels";
import CompanyName from "./CompanyName";

/** Íconos de línea de las tarjetas (ubicación, modalidad, contrato, seniority, salario, experiencia). */
export const META_ICONS = {
  where: <path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
  modalidad: <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />,
  contrato: <path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />,
  nivel: <path d="M4 9h16v10H4zM9 9V6h6v3M4 13l8 3 8-3" />,
  salario: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.6-3-1.5M12 6.5v11" />,
  anios: <path d="M5 6h14v14H5zM5 10h14M9 4v4M15 4v4" />,
} as const;

export function MetaItem({ icon, children }: { icon: keyof typeof META_ICONS; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
        {META_ICONS[icon]}
      </svg>
      <span className="truncate">{children}</span>
    </li>
  );
}

export function JobMeta({ j }: { j: JobResult }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
      <MetaItem icon="where">{j.where || "Ubicación no informada"}</MetaItem>
      {j.contrato && <MetaItem icon="contrato">{j.contrato}</MetaItem>}
      {j.salario && <MetaItem icon="salario">{j.salario}</MetaItem>}
      <MetaItem icon="modalidad">{j.modalidad || "Modalidad no informada"}</MetaItem>
      {j.nivel && <MetaItem icon="nivel">{j.nivel}</MetaItem>}
      {j.anios != null && <MetaItem icon="anios">{j.anios}+ años de experiencia</MetaItem>}
    </ul>
  );
}

export function TimeTag({ iso, known = true }: { iso: string; known?: boolean }) {
  return (
    <span className="rounded-md bg-neon/10 px-1.5 py-1 text-[11px] font-medium" title={known ? "Fecha de publicación según la fuente" : "La fuente no da fecha exacta: es cuando la vimos por primera vez"}>
      {!known && "vista "}
      <TimeAgo iso={iso} />
    </span>
  );
}

export function ArgTag() {
  return <span className="rounded-md bg-[rgba(20,200,240,0.1)] px-1.5 py-1 text-[11px] font-medium">Desde Argentina</span>;
}

/** Tarjeta de búsqueda como la de jobright: datos a la izquierda y el panel negro de compatibilidad. */
export default function JobCard({ j }: { j: JobResult }) {
  return (
    <article className="flex overflow-hidden rounded-2xl bg-white transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(0,0,0,0.35)]">
      <div className="min-w-0 flex-1 p-4">
        <div className="flex gap-4">
          <span className="hidden sm:block">
            <CompanyTile name={displayCompany(j.company)} logo={j.logo} size={72} />
          </span>
          <span className="sm:hidden">
            <CompanyTile name={displayCompany(j.company)} logo={j.logo} size={44} />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap gap-1.5">
              <TimeTag iso={j.postedAt} known={j.postedKnown} />
              {j.eligible && <ArgTag />}
            </p>
            <h2 className="mt-1.5 text-lg font-semibold leading-snug sm:text-xl">
              <Link href={`/busquedas/${j.id}`} className="hover:underline">
                {j.title}
              </Link>
            </h2>
            <p className="truncate text-[15px]">
              <CompanyName name={j.company} />
              {j.area && <span className="text-ink/50"> / {j.area}</span>}
            </p>
          </div>
        </div>
        <hr className="my-3 border-black/[0.07]" />
        <JobMeta j={j} />
        <hr className="my-3 border-black/[0.07]" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="truncate text-[11px] text-ink/50">{j.attribution}</span>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Link href={`/busquedas/${j.id}`} className="hidden rounded-full px-3 py-2 text-[13px] font-semibold hover:bg-black/[0.05] sm:inline-flex">
              Ver detalle
            </Link>
            <ApplyLink job={{ id: j.id, title: j.title, company: j.company, jobUrl: j.applyUrl }} className="inline-flex min-h-11 items-center px-2 text-sm text-ink/70 underline underline-offset-4 hover:text-ink">
              Ver aviso original ↗
            </ApplyLink>
            <PrepareJob id={j.id} to="postulacion" className="press min-h-11 w-full rounded-full bg-neon px-5 py-2.5 text-sm font-bold text-ink hover:bg-neon/80 disabled:opacity-60 sm:w-auto">
              Postulación personalizada
            </PrepareJob>
          </div>
        </div>
      </div>
      <Link
        href="/match"
        className="m-1 hidden w-[164px] shrink-0 flex-col items-center justify-center rounded-xl bg-[linear-gradient(180deg,#000_0%,#2c3a3a_100%)] px-3 text-white sm:flex"
        aria-label="Ver tu compatibilidad con esta búsqueda: subí tu CV"
      >
        <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-ink">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden>
            <path d="M7 10V8a5 5 0 0 1 10 0v2h1v11H6V10zm2 0h6V8a3 3 0 0 0-6 0zm3 4a1.5 1.5 0 0 0-.75 2.8V18h1.5v-1.2A1.5 1.5 0 0 0 12 14z" />
          </svg>
        </span>
        <span className="mt-3 text-sm font-semibold">TU MATCH</span>
        <span className="mt-3 w-full border-t border-white/20 pt-3 text-[11px] leading-relaxed">
          {j.eligible && <span className="block">✓ Desde Argentina</span>}
          {j.modalidad && <span className="block">✓ {j.modalidad}</span>}
          <span className="block text-white/70">Subí tu CV para verlo</span>
        </span>
      </Link>
    </article>
  );
}
