"use client";

import { memo, useState } from "react";
import type { CvDoc, TemplateId } from "@/lib/schemas";
import CvPaper, { PAPER_WIDTH } from "./CvPaper";
import { CATEGORIES, TEMPLATES, templateDefaults, type Categoria } from "./themes";

const THUMB_W = 120;
const SCALE = THUMB_W / PAPER_WIDTH;
const COLLAPSED = 6;

/** Miniatura en vivo de un template con el CV real de la persona (con el color y la tipografía propios del template). */
const Thumb = memo(function Thumb({ doc, id }: { doc: CvDoc; id: TemplateId }) {
  const preview: CvDoc = {
    ...doc,
    template: id,
    style: { density: doc.style?.density, size: doc.style?.size, order: doc.style?.order },
    hidden: { ...doc.hidden, logrosClave: !templateDefaults(id).keyAchievements },
  };
  return (
    <div className="pointer-events-none origin-top-left" style={{ width: PAPER_WIDTH, transform: `scale(${SCALE})` }}>
      <CvPaper doc={preview} mode="export" />
    </div>
  );
});

/** Galería de templates, filtrable por estilo. */
export default function TemplatePicker({
  doc,
  recommended,
  reason,
  onPick,
}: {
  doc: CvDoc;
  recommended: TemplateId;
  reason: string;
  onPick: (t: TemplateId) => void;
}) {
  const [filter, setFilter] = useState<Categoria | "todos">("todos");
  const [expanded, setExpanded] = useState(false);

  const all = filter === "todos" ? TEMPLATES : TEMPLATES.filter((t) => t.categoria === filter);
  // Plegada, la galería muestra primero el diseño actual y el recomendado.
  const ordered = expanded ? all : [...all].sort((a, b) => rank(b.id) - rank(a.id));
  const shown = expanded ? ordered : ordered.slice(0, COLLAPSED);
  function rank(id: TemplateId) {
    return (id === doc.template ? 2 : 0) + (id === recommended ? 1 : 0);
  }

  const recommendedName = TEMPLATES.find((t) => t.id === recommended)?.nombre;

  return (
    <div>
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
        {([{ id: "todos", label: `Todos (${TEMPLATES.length})` }, ...CATEGORIES] as const).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 transition ${filter === c.id ? "bg-ink text-paper" : "bg-sand text-muted hover:text-ink"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${THUMB_W + 16}px, 1fr))` }}>
        {shown.map(({ id, nombre, ideal }) => {
          const active = doc.template === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              aria-pressed={active}
              className={`group rounded-2xl p-2 text-left transition ${active ? "bg-clay-soft ring-2 ring-clay" : "bg-paper ring-1 ring-line hover:ring-clay/60"}`}
            >
              <div className="relative mx-auto overflow-hidden rounded-md bg-white" style={{ width: THUMB_W, height: THUMB_W * 1.3 }} aria-hidden>
                <Thumb doc={doc} id={id} />
                {id === recommended && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-sage px-2 py-0.5 text-[10px] font-semibold text-paper shadow">Recomendado</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold">{nombre}</p>
              <p className="text-[11px] leading-snug text-muted">{ideal}</p>
            </button>
          );
        })}
      </div>

      {all.length > COLLAPSED && (
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="mt-3 rounded-full border border-line bg-paper px-4 py-2 text-sm font-medium transition hover:border-clay hover:text-clay"
        >
          {expanded ? "Ver menos" : `Ver los ${all.length} diseños`}
        </button>
      )}

      {recommendedName && reason && (
        <p className="mt-3 rounded-2xl bg-sage-soft px-4 py-2.5 text-sm text-ink">
          <span className="font-semibold text-sage">Te recomendamos {recommendedName}.</span> {reason}
        </p>
      )}
    </div>
  );
}
