import Flow from "@/components/Flow";

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 print:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-clay font-serif text-lg text-paper">m</span>
          <span className="font-serif text-2xl tracking-tight">maru</span>
        </div>
        <span className="hidden text-sm text-muted sm:block">Tu postulación, a medida</span>
      </header>
      <main className="mx-auto max-w-5xl px-5 pb-24">
        <Flow />
      </main>
      <footer className="border-t border-line py-8 text-center text-xs text-muted print:hidden">
        Maru nunca inventa experiencia: reordena, reescribe y prioriza lo que ya hiciste. Revisá todo antes de enviar.
      </footer>
    </div>
  );
}
