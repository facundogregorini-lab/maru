import type { AtsReport } from "@/lib/ats";

function Ring({ score }: { score: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--color-sage)" : score >= 60 ? "var(--color-honey)" : "var(--color-danger)";
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0" role="img" aria-label={`Compatibilidad ATS ${score} de 100`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-sand)" strokeWidth="7" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--color-ink)">
        {score}
      </text>
    </svg>
  );
}

/** Cubrir las palabras que faltan: el botón, cuántas propuestas hay para revisar y las que ninguna experiencia respalda. */
export type CoverProps = {
  pending: number;
  busy: boolean;
  disabled: boolean;
  proposals: number;
  unsupported: { palabra: string; motivo: string }[];
  onCover: () => void;
  onSkill: (palabra: string) => void;
  onDismiss: (palabra: string) => void;
};

export default function AtsPanel({ report, cover }: { report: AtsReport; cover?: CoverProps }) {
  const verdict = report.score >= 80 ? "Muy buena" : report.score >= 60 ? "Buena, con margen" : "Mejorable";
  return (
    <div className="rounded-3xl bg-paper p-5">
      <div className="flex items-center gap-4">
        <Ring score={report.score} />
        <div>
          <h3 className="text-sm font-semibold">Compatibilidad ATS</h3>
          <p className="text-sm text-muted">{verdict} · se actualiza mientras editás</p>
        </div>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">
        Palabras clave · {report.covered.length}/{report.covered.length + report.missing.length}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {report.covered.map((k) => (
          <span key={k} className="rounded-full bg-sage-soft px-2.5 py-1 text-xs text-sage">
            ✓ {k}
          </span>
        ))}
        {report.missing.map((k) => (
          <span key={k} className="rounded-full border border-dashed border-brand/40 px-2.5 py-1 text-xs text-brand-dark">
            {k}
          </span>
        ))}
      </div>
      {report.missing.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-muted">Sumá las faltantes sólo si son verdad para vos: editá un logro o tus habilidades.</p>
      )}
      {cover && cover.pending > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={cover.onCover}
            disabled={cover.busy || cover.disabled}
            className="press w-full rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {cover.busy ? "Maru está escribiendo…" : `✨ Cubrir ${cover.pending === 1 ? "la palabra que falta" : `las ${cover.pending} palabras que faltan`}`}
            {!cover.busy && <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">Pro</span>}
          </button>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {cover.disabled ? "Sumá al menos una experiencia para que Maru proponga frases." : "Maru propone una frase en tu experiencia más relevante. Aceptá sólo lo que sea verdad."}
          </p>
        </div>
      )}
      {cover && cover.proposals > 0 && (
        <p className="mt-3 rounded-xl bg-[#fdf3d7] px-3 py-2 text-xs leading-relaxed text-[#7a5a12]">
          {cover.proposals === 1 ? "Hay 1 propuesta" : `Hay ${cover.proposals} propuestas`} resaltada{cover.proposals === 1 ? "" : "s"} en tu experiencia: aceptala, pedí otra o escribila vos.
        </p>
      )}
      {cover && cover.unsupported.length > 0 && (
        <ul className="mt-3 space-y-2">
          {cover.unsupported.map((u) => (
            <li key={u.palabra} className="rounded-xl border border-line px-3 py-2 text-xs leading-relaxed">
              <strong>«{u.palabra}»</strong>: no encontramos una experiencia que la respalde{u.motivo ? ` (${u.motivo.replace(/\.$/, "")})` : ""}. Si es verdad para vos, sumala a tus habilidades.
              <span className="mt-1.5 flex gap-2">
                <button type="button" onClick={() => cover.onSkill(u.palabra)} className="rounded-full bg-ink px-3 py-1 font-semibold text-white">
                  Agregar a habilidades
                </button>
                <button type="button" onClick={() => cover.onDismiss(u.palabra)} className="px-1 text-muted underline underline-offset-2">
                  Descartar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-4 space-y-1.5 text-sm">
        {report.checks.map((c) => (
          <li key={c.label} className={`flex gap-2 ${c.ok ? "" : "text-danger-dark"}`}>
            <span aria-hidden>{c.ok ? "✓" : "○"}</span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
