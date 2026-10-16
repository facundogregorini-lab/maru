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

export default function AtsPanel({ report }: { report: AtsReport }) {
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
