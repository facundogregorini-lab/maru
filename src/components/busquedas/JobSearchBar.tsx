import { AREAS, MODALIDADES, NIVELES, type JobQuery } from "@/lib/jobFilters";
import AutoSubmitForm from "./AutoSubmitForm";

/** Buscador al estilo jobright ("Find your perfect job in a click"): puesto + filtros + GO. Es un GET a /busquedas. */
export default function JobSearchBar({ value }: { value?: Partial<JobQuery> }) {
  const field = "h-12 w-full rounded-xl bg-brand-soft px-3 text-base text-ink outline-none placeholder:text-ink/80 focus:ring-2 focus:ring-ink";
  const select = `${field} cursor-pointer appearance-none pr-8`;
  return (
    <form action="/busquedas" method="get" role="search" aria-label="Buscar empleos" className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_80px]">
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

function Select({ name, label, value, options, className, noEmpty = false, small = false }: { name: string; label: string; value?: string; options: Record<string, string | undefined>; className: string; noEmpty?: boolean; small?: boolean }) {
  return (
    <label className={small ? "relative inline-block" : "relative block"}>
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} className={className}>
        {!noEmpty && <option value="">{label}</option>}
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 10 10" width={small ? 8 : 10} height={small ? 8 : 10} aria-hidden className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${small ? "right-2.5" : "right-3.5"}`}>
        <path d="M1 3h8L5 8z" fill="currentColor" />
      </svg>
    </label>
  );
}

/** Filtros en chips, como la fila de jobright (United States ▾, Experience Level ▾, … y "All Filters"). */
export function JobFilterChips({ value }: { value: JobQuery }) {
  const chip = "h-8 cursor-pointer appearance-none rounded-lg bg-white pl-2.5 pr-7 text-[13px] text-ink outline-none ring-1 ring-black/[0.06] hover:ring-black/20 focus:ring-2 focus:ring-ink";
  return (
    <AutoSubmitForm action="/busquedas" method="get" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
      {value.q && <input type="hidden" name="q" value={value.q} />}
      <Select name="donde" label="Dónde" value={value.donde} options={{ ar: "Desde Argentina", todo: "Todo el mundo" }} className={`${chip} ${value.donde === "ar" ? "!bg-brand-soft" : ""}`} noEmpty small />
      <Select name="area" label="Área" value={value.area} options={AREAS} className={`${chip} ${value.area ? "!bg-brand-soft" : ""}`} small />
      <Select name="nivel" label="Seniority" value={value.nivel} options={NIVELES} className={`${chip} ${value.nivel ? "!bg-brand-soft" : ""}`} small />
      <Select name="modalidad" label="Modalidad" value={value.modalidad} options={MODALIDADES} className={`${chip} ${value.modalidad ? "!bg-brand-soft" : ""}`} small />
      <button type="submit" className="press flex h-8 items-center gap-1.5 rounded-lg bg-neon px-3 text-[13px] font-medium">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M2 4h12M4 8h8M6 12h4" />
        </svg>
        Filtrar
      </button>
    </AutoSubmitForm>
  );
}

/** Buscador de la barra superior: el texto, conservando los filtros elegidos. */
export function JobSearchPill({ value }: { value: JobQuery }) {
  return (
    <form action="/busquedas" method="get" role="search" className="relative w-full max-w-[420px]">
      {value.area && <input type="hidden" name="area" value={value.area} />}
      {value.nivel && <input type="hidden" name="nivel" value={value.nivel} />}
      {value.modalidad && <input type="hidden" name="modalidad" value={value.modalidad} />}
      {value.donde === "todo" && <input type="hidden" name="donde" value="todo" />}
      <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/50">
        <circle cx="7" cy="7" r="4.8" />
        <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
      </svg>
      <label className="sr-only" htmlFor="q-top">
        Buscar por puesto o empresa
      </label>
      <input id="q-top" name="q" defaultValue={value.q} placeholder="Buscar por puesto o empresa" className="h-9 w-full rounded-full bg-[#f5f6f7] pl-9 pr-4 text-sm outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-ink" />
    </form>
  );
}
