import SiteShell from "@/components/SiteShell";
import { CONTACT_EMAIL } from "@/lib/site";

/** Página de texto legal: legible, con fecha y contacto. */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:pt-16 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="font-display text-4xl font-bold uppercase leading-none sm:text-5xl">{title}</h1>
        <p className="!mt-4 text-sm text-ink/60">Última actualización: {updated}</p>
        {children}
        <h2>Contacto</h2>
        <p>
          {CONTACT_EMAIL ? (
            <>
              Escribinos a{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-4">
                {CONTACT_EMAIL}
              </a>
              .
            </>
          ) : (
            "Respondé cualquier email que te hayamos enviado y te contestamos."
          )}
        </p>
      </article>
    </SiteShell>
  );
}
