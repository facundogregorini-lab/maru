"use client";

import type { CSSProperties } from "react";
import { item } from "@/lib/cv";
import { remitenteLine } from "@/lib/carta";
import type { CartaDoc, Item } from "@/lib/schemas";
import { AddButton, Ctl, PAPER_WIDTH, Toolbar } from "../cv/CvPaper";
import EditableText from "../cv/EditableText";
import { resolveTheme } from "../cv/themes";

type Update = (fn: (d: CartaDoc) => CartaDoc) => void;
export type Rewrite = "mejorar" | "corto" | "concreto" | "calido";

const REWRITES: [Rewrite, string, string][] = [
  ["mejorar", "✨ Mejorar", "Mejorar este párrafo con IA"],
  ["corto", "Más corto", "Acortar con IA"],
  ["concreto", "Más concreto", "Hacerlo más concreto con IA"],
  ["calido", "Más cálido", "Hacerlo más cálido con IA"],
];

type TextProps = {
  editable: boolean;
  value: string;
  onSet: (v: string) => void;
  style?: CSSProperties;
  as?: "span" | "p" | "h1" | "div";
  multiline?: boolean;
  placeholder?: string;
};

/** Texto editable en el editor; plano en la exportación. */
function Text({ editable, value, onSet, style, as = "span", multiline, placeholder }: TextProps) {
  if (editable) return <EditableText value={value} onChange={onSet} style={style} as={as} multiline={multiline} placeholder={placeholder} />;
  const Tag = as;
  return <Tag style={style}>{value}</Tag>;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

/**
 * La carta en papel A4, con el mismo encabezado y tipografía que el template de CV elegido.
 * Sin `onChange` se renderiza estática (para el PDF).
 */
export default function LetterPaper({
  doc,
  onChange,
  onRewrite,
  rewriting,
  mode = "preview",
}: {
  doc: CartaDoc;
  onChange?: Update;
  onRewrite?: (id: string, how: Rewrite) => void;
  rewriting?: string | null;
  mode?: "preview" | "export";
}) {
  const t = resolveTheme(doc);
  const editable = !!onChange;
  const set: Update = onChange ?? (() => {});
  const bodySize = typeof t.body.fontSize === "number" ? t.body.fontSize + 0.75 : 13;

  const setParrafos = (fn: (p: Item[]) => Item[]) => set((d) => ({ ...d, parrafos: fn(d.parrafos) }));
  const r = doc.remitente;
  const centered = t.header.textAlign === "center";
  const contact = remitenteLine(doc);

  const page: CSSProperties = {
    width: "100%",
    maxWidth: mode === "export" ? undefined : PAPER_WIDTH,
    minHeight: mode === "export" ? undefined : PAPER_WIDTH * 1.414,
    margin: "0 auto",
    boxSizing: "border-box",
    padding: mode === "export" ? `0 ${t.padX + 8}px` : `${t.padY}px ${t.padX + 8}px`,
    background: "#fff",
    color: t.text,
    fontFamily: t.font,
    fontSize: bodySize,
    lineHeight: 1.6,
  };
  const para: CSSProperties = { margin: "0 0 12px" };

  return (
    <article
      className={mode === "preview" ? "rounded-[2px] shadow-[0_20px_60px_-30px_rgba(43,36,32,0.35)] ring-1 ring-line" : undefined}
      style={page}
      lang={doc.lang}
    >
      <header style={{ ...t.header }}>
        <Text
          editable={editable}
          as="h1"
          value={r.nombre}
          placeholder="Tu nombre"
          onSet={(v) => set((d) => ({ ...d, remitente: { ...d.remitente, nombre: v } }))}
          style={{ ...t.name, fontFamily: t.name.fontFamily ?? t.headFont, margin: 0 }}
        />
        {(r.titular || editable) && (
          <Text
            editable={editable}
            as="p"
            value={r.titular}
            placeholder="Título profesional"
            onSet={(v) => set((d) => ({ ...d, remitente: { ...d.remitente, titular: v } }))}
            style={{ ...t.titular, margin: `${t.titular.marginTop}px 0 0` }}
          />
        )}
        {editable ? (
          <p style={{ ...t.contact, margin: `${t.contact.marginTop}px 0 0`, textAlign: centered ? "center" : undefined }}>
            {(["email", "telefono", "ubicacion", "linkedin"] as const).map((k, i) => (
              <span key={k}>
                {i > 0 && <span style={{ color: t.contactSep ?? t.muted }}>{"  |  "}</span>}
                <EditableText
                  value={r[k]}
                  placeholder={{ email: "email", telefono: "teléfono", ubicacion: "ciudad", linkedin: "linkedin" }[k]}
                  onChange={(v) => set((d) => ({ ...d, remitente: { ...d.remitente, [k]: v } }))}
                />
              </span>
            ))}
          </p>
        ) : (
          contact.length > 0 && <p style={{ ...t.contact, margin: `${t.contact.marginTop}px 0 0` }}>{contact.join("  |  ")}</p>
        )}
      </header>

      <div style={{ marginTop: 34 }}>
        <Text editable={editable} as="p" value={doc.fecha} onSet={(v) => set((d) => ({ ...d, fecha: v }))} style={{ ...para, color: t.muted, marginBottom: 22 }} />
        <Text editable={editable} as="p" value={doc.saludo} placeholder="Saludo" onSet={(v) => set((d) => ({ ...d, saludo: v }))} style={{ ...para, marginBottom: 14 }} />

        {doc.parrafos.map((p, i) => (
          <div key={p.id} className="group/row relative" style={{ breakInside: "avoid" }}>
            <Text
              editable={editable}
              as="p"
              value={p.text}
              multiline
              placeholder="Escribí un párrafo…"
              onSet={(v) => setParrafos((list) => list.map((x) => (x.id === p.id ? { ...x, text: v } : x)))}
              style={para}
            />
            {editable && (
              <Toolbar>
                {onRewrite &&
                  REWRITES.map(([how, label, title]) => (
                    <Ctl key={how} label={title} busy={rewriting === p.id} onClick={() => onRewrite(p.id, how)}>
                      {rewriting === p.id && how === "mejorar" ? <span className="animate-spin">◌</span> : label}
                    </Ctl>
                  ))}
                <Ctl label="Subir" onClick={() => setParrafos((list) => move(list, i, i - 1))}>
                  ↑
                </Ctl>
                <Ctl label="Bajar" onClick={() => setParrafos((list) => move(list, i, i + 1))}>
                  ↓
                </Ctl>
                <Ctl label="Borrar" onClick={() => setParrafos((list) => list.filter((x) => x.id !== p.id))}>
                  ✕
                </Ctl>
              </Toolbar>
            )}
          </div>
        ))}
        {editable && (
          <div className="group/section">
            <AddButton onClick={() => setParrafos((list) => [...list, item("")])}>+ Agregar párrafo</AddButton>
          </div>
        )}

        <Text editable={editable} as="p" value={doc.cierre} placeholder="Despedida" onSet={(v) => set((d) => ({ ...d, cierre: v }))} style={{ ...para, marginTop: 18, marginBottom: 6 }} />
        <Text
          editable={editable}
          as="p"
          value={doc.firma}
          placeholder="Tu nombre"
          onSet={(v) => set((d) => ({ ...d, firma: v }))}
          style={{ margin: 0, fontFamily: t.headFont, fontWeight: 600, color: t.accent }}
        />
      </div>
    </article>
  );
}
