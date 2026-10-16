/** Mini instructivo visual: cómo descargar el perfil de LinkedIn en PDF. */
export default function LinkedinGuide() {
  const steps = [
    {
      title: "Abrí tu perfil",
      hint: "En linkedin.com, desde la computadora.",
      art: (
        <>
          <rect x="8" y="8" width="104" height="64" rx="6" className="fill-paper stroke-line" />
          <rect x="8" y="8" width="104" height="18" rx="6" className="fill-sand" />
          <circle cx="28" cy="32" r="10" className="fill-brand-soft stroke-paper" strokeWidth="3" />
          <rect x="20" y="48" width="44" height="5" rx="2.5" className="fill-ink/70" />
          <rect x="20" y="57" width="64" height="4" rx="2" className="fill-muted/40" />
        </>
      ),
    },
    {
      title: "Tocá «Más»",
      hint: "Es el botón al lado de «Abierto a».",
      art: (
        <>
          <rect x="8" y="8" width="104" height="64" rx="6" className="fill-paper stroke-line" />
          <rect x="16" y="22" width="30" height="12" rx="6" className="fill-brand/25" />
          <rect x="50" y="22" width="26" height="12" rx="6" className="fill-paper stroke-brand" strokeWidth="1.5" />
          <text x="63" y="31" textAnchor="middle" className="fill-brand-dark" fontSize="7" fontWeight="600">
            Más
          </text>
          <rect x="50" y="38" width="56" height="28" rx="4" className="fill-paper stroke-line" />
          <rect x="55" y="44" width="40" height="4" rx="2" className="fill-muted/40" />
          <rect x="55" y="53" width="46" height="5" rx="2.5" className="fill-brand" />
        </>
      ),
    },
    {
      title: "«Guardar en PDF»",
      hint: "Se descarga un archivo Profile.pdf. Subilo acá.",
      art: (
        <>
          <rect x="34" y="6" width="52" height="66" rx="4" className="fill-paper stroke-line" />
          <path d="M72 6 v14 h14" className="fill-sand stroke-line" />
          <rect x="42" y="28" width="36" height="4" rx="2" className="fill-muted/40" />
          <rect x="42" y="36" width="28" height="4" rx="2" className="fill-muted/40" />
          <rect x="40" y="52" width="40" height="13" rx="3" className="fill-brand" />
          <text x="60" y="61" textAnchor="middle" className="fill-paper" fontSize="7" fontWeight="700">
            PDF
          </text>
        </>
      ),
    },
  ];
  return (
    <ol className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
      {steps.map((s, i) => (
        <li key={s.title} className="rounded-2xl bg-sand/70 p-2.5 sm:p-3">
          <svg viewBox="0 0 120 80" className="w-full" aria-hidden>
            {s.art}
          </svg>
          <p className="mt-1.5 text-xs font-semibold leading-tight sm:text-sm">
            <span className="mr-1 font-display text-brand">{i + 1}.</span>
            {s.title}
          </p>
          <p className="mt-0.5 hidden text-xs leading-snug text-muted sm:block">{s.hint}</p>
        </li>
      ))}
    </ol>
  );
}
