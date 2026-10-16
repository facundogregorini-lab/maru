import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import CompanyTile from "@/components/busquedas/CompanyTile";
import { ArgTag, JobMeta, TimeTag } from "@/components/busquedas/JobCard";
import PrepareJob from "@/components/busquedas/PrepareJob";
import { ApplyLink, SaveJob } from "@/components/busquedas/TrackJob";
import { MaruHead } from "@/components/maru/PixelMaru";
import { getJob } from "@/lib/busquedas";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const j = await getJob((await params).id);
  return j ? { title: `${j.title} · ${j.company} · Maru`, description: `Búsqueda de ${j.title} en ${j.company}. Mirá los requisitos y preparate con Maru.` } : { title: "Búsqueda · Maru" };
}

const btn = "press block w-full rounded-lg bg-neon py-2.5 text-center text-sm font-semibold text-ink disabled:opacity-60";

export default async function JobPage({ params }: Props) {
  const j = await getJob((await params).id);
  if (!j) notFound();
  const track = { id: j.id, title: j.title, company: j.company, jobUrl: j.applyUrl };
  const paragraphs = j.description
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <AppShell title="Búsqueda">
      <Link href="/busquedas" className="mb-3 inline-flex items-center gap-1 text-sm hover:underline">
        ← Volver a las búsquedas
      </Link>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="rounded-2xl bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.07] pb-3">
            <span className="border-b-2 border-ink pb-2 text-[15px] font-semibold">Resumen</span>
            <div className="flex flex-wrap items-center gap-2">
              <SaveJob job={track} className="press inline-flex items-center rounded-full bg-[#f2f4f5] px-4 py-2 text-sm font-semibold hover:bg-black/[0.08]" />
              <ApplyLink job={track} className="press inline-flex items-center gap-1.5 rounded-full bg-neon px-5 py-2 text-sm font-extrabold uppercase">
                Postularme ↗
              </ApplyLink>
            </div>
          </div>

          <div className="mt-5 flex gap-4">
            <CompanyTile name={j.company} size={56} />
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{j.company}</span>
                {j.area && <span className="text-ink/50"> / {j.area}</span>}
              </p>
              <h1 className="text-xl font-bold leading-snug sm:text-2xl">{j.title}</h1>
              <p className="mt-1.5 flex flex-wrap gap-1.5">
                <TimeTag iso={j.postedAt} />
                {j.eligible && <ArgTag />}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <JobMeta j={j} />
          </div>

          {(j.skillsRequired.length > 0 || j.languages.length > 0 || j.anios != null) && (
            <Section title="Requisitos" icon="🎯">
              {j.skillsRequired.length > 0 && <Chips items={j.skillsRequired} />}
              <ul className="mt-3 space-y-1.5 text-sm">
                {j.anios != null && <li>• {j.anios}+ años de experiencia</li>}
                {j.languages.map((l) => (
                  <li key={l}>• {l}</li>
                ))}
              </ul>
            </Section>
          )}
          {j.skillsDesirable.length > 0 && (
            <Section title="Suma si tenés" icon="✨">
              <Chips items={j.skillsDesirable} />
            </Section>
          )}
          {paragraphs.length > 0 && (
            <Section title="La búsqueda" icon="📋">
              <div className="space-y-3 text-sm leading-relaxed text-ink/85">
                {paragraphs.map((p, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </Section>
          )}
          <p className="mt-8 text-xs text-ink/50">
            {j.attribution ? `${j.attribution}. ` : ""}Los datos de requisitos los extrae Maru del aviso: ante cualquier duda, manda el aviso original.
          </p>
        </article>

        <aside className="space-y-3 lg:sticky lg:top-20">
          <h2 className="text-lg font-semibold">Aumentá tus chances</h2>
          <Boost title="Adaptá tu CV a esta búsqueda">
            {j.skillsRequired.length > 0 && (
              <>
                <p className="text-xs font-semibold">Skills que pide</p>
                <div className="mt-1.5">
                  <Chips items={j.skillsRequired.slice(0, 4)} small />
                </div>
              </>
            )}
            <p className="mt-2 text-xs text-ink/70">Maru reescribe tu CV con las palabras clave del aviso y te arma una respuesta para cada campo.</p>
            <div className="mt-3">
              <PrepareJob id={j.id} to="postulacion" className={btn}>
                Adaptar mi CV
              </PrepareJob>
            </div>
          </Boost>
          <Boost title="Escribí tu carta">
            <p className="text-xs text-ink/70">Una carta a medida de esta búsqueda, con tus logros. Las postulaciones con carta a medida recibieron 53% más llamados (ResumeGo).</p>
            <div className="mt-3">
              <PrepareJob id={j.id} to="carta" className={btn}>
                Escribir mi carta
              </PrepareJob>
            </div>
          </Boost>
          <Boost title="Postulate más rápido con la extensión">
            <div className="flex items-center gap-3 rounded-xl bg-[linear-gradient(266deg,#b5ffe4,#d2ffc8)] p-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white">
                <MaruHead size={22} />
              </span>
              <span className="text-xs">
                <strong className="block">Completar esta postulación</strong>
                Datos, respuestas y tu CV adjunto, en 1 clic.
              </span>
            </div>
            <Link href="/extension" className={`${btn} mt-3`}>
              Bajar la extensión
            </Link>
          </Boost>
          <Boost title="Entrená la entrevista">
            <p className="text-xs text-ink/70">Una práctica por voz con preguntas pensadas para esta búsqueda, y un informe con puntaje.</p>
            <div className="mt-3">
              <PrepareJob id={j.id} to="entrevista" className={btn}>
                Practicar esta entrevista
              </PrepareJob>
            </div>
          </Boost>
        </aside>
      </div>

      {/* Celular: lo importante siempre a mano, sin bajar hasta el final del aviso. */}
      <div data-bottom-bar className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-black/[0.06] bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="flex-1">
          <PrepareJob id={j.id} to="postulacion" className="press block w-full rounded-full bg-ink py-3 text-center text-sm font-semibold text-white disabled:opacity-60">
            Adaptar mi CV
          </PrepareJob>
        </div>
        <ApplyLink job={track} className="press flex flex-1 items-center justify-center rounded-full bg-neon py-3 text-sm font-extrabold uppercase">
          Postularme ↗
        </ApplyLink>
      </div>
    </AppShell>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-black/[0.07] pt-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-base" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chips({ items, small = false }: { items: string[]; small?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <li key={s} className={`rounded-md bg-[#f2f4f5] ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
          {s}
        </li>
      ))}
    </ul>
  );
}

function Boost({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-dark">Gratis</span>
      </div>
      {children}
    </section>
  );
}
