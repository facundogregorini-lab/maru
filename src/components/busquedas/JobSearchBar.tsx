import { AREAS, MODALIDADES, NIVELES, type JobQuery } from "@/lib/jobFilters";

/** Buscador al estilo jobright ("Find your perfect job in a click"): puesto + filtros + GO. Es un GET a /busquedas. */
export default function JobSearchBar({ value }: { value?: Partial<JobQuery> }) {
  const field = "h-12 w-full rounded-xl bg-brand-soft px-3 text-base text-ink outline-none placeholder:text-ink/80 focus:ring-2 focus:ring-ink";
  const select = `${field} cursor-pointer appearance-none pr-8`;
  return (
    <form action="/busquedas" method="get" role="search" aria-label="Buscar búsquedas" className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_80px]">
      <label className="col-span-2 lg:col-span-1">
        <span className="sr-only">Puesto o palabra clave</span>
        <input name="q" defaultValue={value?.q} placeholder="Puesto o empresa" className={field} />
      </label>
      <Select name="modalidad" label="Modalidad" value={value?.modalidad} options={MODALIDADES} className={select} />
      <Select name="donde" label="Dónde" value={value?.donde} options={{ ar: "Desde Argentina", todo: "Todo el mundo" }} className={select} noEmpty />
      <Select name="area" label="Área" value={value?.area} options={AREAS} className={select} />
      <Select name="nivel" label="Seniority" value={value?.nivel} options={NIVELES} className={select} />
      <button type="submit" className="press col-span-2 h-12 rounded-xl bg-ink font-semibold uppercase text-white hover:bg-black lg:col-span-1">
        Buscar
      </button>
    </form>
  );
}

function Select({ name, label, value, options, className, noEmpty = false }: { name: string; label: string; value?: string; options: Record<string, string | undefined>; className: string; noEmpty?: boolean }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={className}>
        {!noEmpty && <option value="">{label}</option>}
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
        <path d="M1 3h8L5 8z" fill="currentColor" />
      </svg>
    </label>
  );
}
