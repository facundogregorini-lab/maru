import type { VideoFeedback } from "@/lib/schemas";

export default function FeedbackCard({ feedback: f }: { feedback: VideoFeedback }) {
  const imagen = Object.entries(f.imagen).filter(([, v]) => v.trim());
  return (
    <section className="animate-rise space-y-4 rounded-3xl border border-line bg-paper p-6" aria-label="Feedback de Maru">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sage-soft font-serif text-3xl text-sage">{Math.round(f.puntaje)}</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">Feedback de Maru · {Math.round(f.puntaje)}/10</p>
          <p className="mt-1 leading-relaxed">{f.resumen}</p>
        </div>
      </div>
      {f.fortalezas.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-sage">Lo que funcionó</h3>
          <ul className="mt-1.5 space-y-1 text-sm leading-relaxed">
            {f.fortalezas.map((x) => (
              <li key={x}>● {x}</li>
            ))}
          </ul>
        </div>
      )}
      {f.mejoras.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-celeste-dark">Para la próxima toma</h3>
          <ul className="mt-2 space-y-2">
            {f.mejoras.map((m) => (
              <li key={m.aspecto} className="rounded-2xl bg-cream px-4 py-3 text-sm leading-relaxed">
                <b>{m.aspecto}:</b> {m.detalle} <span className="text-sage">→ {m.como}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        {f.ritmo && (
          <p className="rounded-2xl bg-sand/70 px-4 py-3">
            <b>Ritmo:</b> {f.ritmo}
          </p>
        )}
        {f.guion && (
          <p className="rounded-2xl bg-sand/70 px-4 py-3">
            <b>Guion:</b> {f.guion}
          </p>
        )}
        {imagen.map(([k, v]) => (
          <p key={k} className="rounded-2xl bg-sand/70 px-4 py-3">
            <b className="capitalize">{k}:</b> {v}
          </p>
        ))}
      </div>
    </section>
  );
}
