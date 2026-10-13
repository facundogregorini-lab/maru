import type { CV } from "@/lib/schemas";

/** Resalta los marcadores [completar…] para que no se envíen por error. */
function Marked({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]*\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\[.*\]$/.test(p) ? (
          <mark key={i} className="rounded bg-honey/30 px-1 text-ink print:bg-transparent">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid-page">
      <h2 className="border-b border-neutral-300 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-800">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** CV de una columna, tipografía sans y títulos estándar: lo que mejor parsean los ATS. */
export default function CvDocument({ cv }: { cv: CV }) {
  const t = cv.titulos_secciones;
  const contact = [cv.contacto.email, cv.contacto.telefono, cv.contacto.ubicacion, cv.contacto.linkedin, ...cv.contacto.otros].filter(Boolean);

  return (
    <article
      id="cv-print"
      className="mx-auto w-full max-w-[794px] rounded-sm border border-line bg-white px-6 py-8 font-sans text-[13px] leading-relaxed text-neutral-900 shadow-[0_20px_60px_-30px_rgba(43,36,32,0.35)] sm:px-12 sm:py-12"
    >
      <header>
        <h1 className="text-[26px] font-semibold tracking-tight text-neutral-950">{cv.nombre}</h1>
        <p className="mt-0.5 text-[15px] font-medium text-neutral-700">
          <Marked text={cv.titular} />
        </p>
        {contact.length > 0 && <p className="mt-2 text-[12px] text-neutral-600">{contact.join("  |  ")}</p>}
      </header>

      <Section title={t.resumen}>
        <p>
          <Marked text={cv.resumen} />
        </p>
      </Section>

      {cv.competencias.length > 0 && (
        <Section title={t.competencias}>
          <p>{cv.competencias.join("  •  ")}</p>
        </Section>
      )}

      {cv.experiencia.length > 0 && (
        <Section title={t.experiencia}>
          <div className="space-y-4">
            {cv.experiencia.map((e, i) => (
              <div key={i} className="break-inside-avoid">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <h3 className="font-semibold text-neutral-950">
                    {e.cargo} <span className="font-normal text-neutral-700">· {e.empresa}</span>
                  </h3>
                  <span className="text-[12px] text-neutral-600">{e.periodo}</span>
                </div>
                {e.ubicacion && <p className="text-[12px] text-neutral-500">{e.ubicacion}</p>}
                <ul className="mt-1.5 list-disc space-y-1 pl-5 marker:text-neutral-400">
                  {e.logros.map((l, j) => (
                    <li key={j}>
                      <Marked text={l} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.educacion.length > 0 && (
        <Section title={t.educacion}>
          <div className="space-y-2">
            {cv.educacion.map((e, i) => (
              <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p>
                  <span className="font-semibold">{e.titulo}</span> · {e.institucion}
                  {e.detalle && <span className="text-neutral-600"> — {e.detalle}</span>}
                </p>
                <span className="text-[12px] text-neutral-600">{e.periodo}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {cv.certificaciones.length > 0 && (
        <Section title={t.certificaciones}>
          <ul className="list-disc space-y-0.5 pl-5">
            {cv.certificaciones.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {cv.idiomas.length > 0 && (
        <Section title={t.idiomas}>
          <p>{cv.idiomas.join("  •  ")}</p>
        </Section>
      )}

      {cv.secciones_extra.map((s, i) => (
        <Section key={i} title={s.titulo}>
          <ul className="list-disc space-y-0.5 pl-5">
            {s.items.map((it, j) => (
              <li key={j}>
                <Marked text={it} />
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </article>
  );
}
