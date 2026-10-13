"use client";

import { TEMPLATE_IDS, type CvDoc, type TemplateId } from "@/lib/schemas";
import CvPaper, { PAPER_WIDTH } from "./CvPaper";
import { THEMES } from "./themes";

const THUMB_W = 132;
const SCALE = THUMB_W / PAPER_WIDTH;

/** Miniaturas en vivo de los 4 templates con el CV real de la persona. */
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
  return (
    <div>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {TEMPLATE_IDS.map((id) => {
          const active = doc.template === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPick(id)}
              aria-pressed={active}
              className={`group shrink-0 snap-start rounded-2xl p-2 text-left transition ${
                active ? "bg-clay-soft ring-2 ring-clay" : "bg-paper ring-1 ring-line hover:ring-clay/60"
              }`}
            >
              <div className="relative overflow-hidden rounded-md bg-white" style={{ width: THUMB_W, height: THUMB_W * 1.3 }} aria-hidden>
                <div className="pointer-events-none origin-top-left" style={{ width: PAPER_WIDTH, transform: `scale(${SCALE})` }}>
                  <CvPaper doc={{ ...doc, template: id, hidden: { ...doc.hidden, logrosClave: id !== "ejecutivo" } }} mode="export" />
                </div>
                {id === recommended && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-sage px-2 py-0.5 text-[10px] font-semibold text-paper shadow">Recomendado</span>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold">{THEMES[id].nombre}</p>
              <p className="w-[132px] text-[11px] leading-snug text-muted">{THEMES[id].ideal}</p>
            </button>
          );
        })}
      </div>
      <p className="mt-2 rounded-2xl bg-sage-soft px-4 py-2.5 text-sm text-ink">
        <span className="font-semibold text-sage">Recomendado para esta búsqueda: {THEMES[recommended].nombre}.</span> {reason}
      </p>
    </div>
  );
}
