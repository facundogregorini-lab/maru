"use client";

import { useEffect, useRef, useState } from "react";

const VIEW = 240;
const OUT = 360;

type Shape = "circle" | "square";

/** Recorte simple en el navegador: arrastrar para encuadrar, zoom y forma. Devuelve un data URL liviano. */
export default function PhotoCropper({
  file,
  initialShape = "circle",
  onDone,
  onCancel,
}: {
  file: File;
  initialShape?: Shape;
  onDone: (dataUrl: string, shape: Shape) => void;
  onCancel: () => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [shape, setShape] = useState<Shape>(initialShape);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const b = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
      setPos({ x: (VIEW - image.naturalWidth * b) / 2, y: (VIEW - image.naturalHeight * b) / 2 });
      setImg(image);
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Escala base: la imagen cubre el cuadro.
  const base = img ? VIEW / Math.min(img.naturalWidth, img.naturalHeight) : 1;
  const w = img ? img.naturalWidth * base * zoom : 0;
  const h = img ? img.naturalHeight * base * zoom : 0;
  const clamp = (p: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(VIEW - w, p.x)),
    y: Math.min(0, Math.max(VIEW - h, p.y)),
  });
  const view = clamp(pos);

  function finish() {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    const k = OUT / VIEW;
    ctx.drawImage(img, view.x * k, view.y * k, w * k, h * k);
    // Círculo en PNG (esquinas transparentes también en Word); cuadrado en JPEG, más liviano.
    onDone(shape === "circle" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88), shape);
  }

  return (
    <div className="rounded-3xl border border-line bg-paper p-4">
      <div
        className="relative mx-auto touch-none select-none overflow-hidden bg-sand"
        style={{ width: VIEW, height: VIEW, borderRadius: shape === "circle" ? "50%" : 12, cursor: "grab" }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, px: view.x, py: view.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.src} alt="" draggable={false} className="absolute max-w-none" style={{ left: view.x, top: view.y, width: w, height: h }} />
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">Arrastrá para encuadrar</p>
      <label className="mt-3 flex items-center gap-3 text-xs text-muted">
        Zoom
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => {
            const z = Number(e.target.value);
            // Mantenemos el centro al hacer zoom.
            const cx = (VIEW / 2 - view.x) / zoom;
            const cy = (VIEW / 2 - view.y) / zoom;
            setZoom(z);
            setPos({ x: VIEW / 2 - cx * z, y: VIEW / 2 - cy * z });
          }}
          className="flex-1 accent-brand"
        />
      </label>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-full bg-sand p-1 text-xs">
          {(["circle", "square"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShape(s)}
              className={`rounded-full px-3 py-1 ${shape === s ? "bg-paper font-medium shadow-sm" : "text-muted"}`}
            >
              {s === "circle" ? "Círculo" : "Cuadrado"}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-muted hover:text-ink">
            Cancelar
          </button>
          <button type="button" onClick={finish} disabled={!img} className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-paper hover:bg-brand-dark">
            Usar foto
          </button>
        </div>
      </div>
    </div>
  );
}
