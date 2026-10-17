import { displayCompany, isConsultora } from "@/lib/match/labels";

/** Nombre de la empresa como se muestra: genéricos como "Empresa confidencial" y etiqueta de consultora. */
export default function CompanyName({ name, className = "" }: { name: string; className?: string }) {
  return (
    <>
      <span className={className}>{displayCompany(name)}</span>
      {isConsultora(name) && (
        <span className="ml-1.5 rounded bg-[#f2f4f5] px-1.5 py-0.5 align-middle text-[11px] font-medium text-ink/70" title="Publica una consultora de selección para una empresa cliente">
          Consultora
        </span>
      )}
    </>
  );
}
