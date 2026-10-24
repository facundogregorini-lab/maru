"use client";

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { contactLine, item, newId, visible } from "@/lib/cv";
import type { CvDoc, CvExperience, Item, SectionKey } from "@/lib/schemas";
import EditableText from "./EditableText";
import { resolveTheme, type Theme } from "./themes";

type Update = (fn: (d: CvDoc) => CvDoc) => void;

export type PaperProps = {
  doc: CvDoc;
  /** Sin `onChange` el CV se renderiza estático (miniaturas y exportación). */
  onChange?: Update;
  onRegenerate?: (expId: string, bulletId: string) => void;
  regenerating?: string | null;
  /** Frases propuestas para palabras clave de ATS: se ven resaltadas en su experiencia y no se exportan. */
  proposals?: PaperProposal[];
  onProposal?: (action: ProposalAction, palabra: string, texto?: string) => void;
  /** export: sin padding vertical (lo pone @page) y sin sombra. */
  mode?: "preview" | "export";
};

export type PaperProposal = { palabra: string; expId: string; texto: string; estado: "propuesta" | "escribiendo" | "cargando" };
export type ProposalAction = "aceptar" | "otra" | "escribir" | "descartar";

export const PAPER_WIDTH = 794; // A4 a 96 dpi

/**
 * Propuesta de Maru para cubrir una palabra clave: resaltada en amarillo (redactado por Maru), editable,
 * con aceptar, pedir otra, escribirla vos o descartarla. Nunca se exporta.
 */
function ProposalRow({ p, onAction }: { p: PaperProposal; onAction: (action: ProposalAction, texto?: string) => void }) {
  const [text, setText] = useState(p.texto);
  useEffect(() => setText(p.texto), [p.texto]);
  const writing = p.estado === "escribiendo";
  const loading = p.estado === "cargando";
  return (
    <li className="cv-proposal font-sans" style={{ listStyle: "none", margin: "6px 0 6px 18px", padding: "8px 10px", borderRadius: 8, background: "#fdf3d7", borderLeft: "3px solid #d9a441" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#7a5a12", margin: 0 }}>
        {writing ? `Escribí una frase con «${p.palabra}»` : `Propuesta de Maru para «${p.palabra}» · revisá que sea verdad`}
      </p>
      <textarea
        value={loading ? "Maru está escribiendo otra frase…" : text}
        disabled={loading}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder={`Un logro tuyo que incluya «${p.palabra}»`}
        aria-label={`Frase para ${p.palabra}`}
        style={{ width: "100%", marginTop: 4, padding: "4px 6px", fontSize: 12.5, lineHeight: 1.45, border: "1px solid #ecd9a6", borderRadius: 6, background: "#fffaf0", resize: "vertical" }}
      />
      <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        <button type="button" disabled={loading || !text.trim()} onClick={() => onAction("aceptar", text.trim())} className="rounded-full bg-ink px-3 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50">
          Aceptar
        </button>
        <button type="button" disabled={loading} onClick={() => onAction("otra")} className="rounded-full border border-line bg-white px-3 py-1 text-[11.5px] font-medium disabled:opacity-50">
          {loading ? "Escribiendo…" : "Otra frase"}
        </button>
        {!writing && (
          <button type="button" disabled={loading} onClick={() => onAction("escribir")} className="rounded-full border border-line bg-white px-3 py-1 text-[11.5px] font-medium disabled:opacity-50">
            La escribo yo
          </button>
        )}
        <button type="button" disabled={loading} onClick={() => onAction("descartar")} className="px-2 py-1 text-[11.5px] text-muted underline underline-offset-2 disabled:opacity-50">
          Descartar
        </button>
      </span>
    </li>
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

/* ---------- controles del editor (nunca se exportan) ---------- */

export function Ctl({ children, onClick, label, busy }: { children: ReactNode; onClick: () => void; label: string; busy?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={busy}
      className="grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[13px] text-muted transition hover:bg-brand-soft hover:text-brand-dark disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <span className="cv-toolbar pointer-events-none absolute -top-8 right-0 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-paper px-1 py-0.5 opacity-0 shadow-sm transition group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100 group-hover/row:pointer-events-auto group-hover/row:opacity-100">
      {children}
    </span>
  );
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-1.5 rounded-full border border-dashed [@media(hover:none)]:hidden [@media(hover:none)]:group-focus-within/section:inline-block border-line px-3 py-1 text-[11.5px] font-sans text-muted transition hover:border-brand hover:text-brand"
    >
      {children}
    </button>
  );
}

/* ---------- texto: editable en el editor, plano en miniaturas y exportación ---------- */

const EditableCtx = createContext(false);

function Text({
  value,
  onSet,
  style,
  as,
  multiline,
  placeholder,
}: {
  value: string;
  onSet: (v: string) => void;
  style?: CSSProperties;
  as?: "span" | "p" | "h1" | "h2" | "div";
  multiline?: boolean;
  placeholder?: string;
}) {
  const editable = useContext(EditableCtx);
  if (editable) return <EditableText value={value} onChange={onSet} style={style} as={as} multiline={multiline} placeholder={placeholder} />;
  const Tag = as ?? "span";
  return <Tag style={style}>{value}</Tag>;
}

/* ---------- papel ---------- */

export default function CvPaper({ doc, onChange, onRegenerate, regenerating, proposals = [], onProposal, mode = "preview" }: PaperProps) {
  const t: Theme = resolveTheme(doc);
  const editable = !!onChange;
  const set: Update = onChange ?? (() => {});

  const page: CSSProperties = {
    width: "100%",
    maxWidth: mode === "export" ? undefined : PAPER_WIDTH,
    margin: "0 auto",
    boxSizing: "border-box",
    padding: mode === "export" ? `0 ${t.padX}px` : `${t.padY}px ${t.padX}px`,
    background: "#fff",
    color: t.text,
    fontFamily: t.font,
    ...t.body,
  };

  const section = (key: SectionKey, children: ReactNode) => {
    if (!visible(doc, key) && !(editable && key === "experiencia")) return null;
    return (
      <section key={key} style={{ marginTop: t.sectionGap, breakInside: key === "experiencia" ? "auto" : "avoid" }} className="group/section relative">
        <div className="relative flex items-center">
          <Text
            as="h2"
            value={doc.titulos[key]}
            onSet={(v) => set((d) => ({ ...d, titulos: { ...d.titulos, [key]: v } }))}
            style={{ ...t.sectionTitle, fontFamily: t.sectionTitle.fontFamily ?? t.headFont, margin: 0, marginBottom: t.sectionTitle.marginBottom, flex: t.titleInline ? "none" : 1 }}
          />
          {editable && (
            <span className="absolute -top-1 right-0 opacity-0 transition group-focus-within/section:opacity-100 group-hover/section:opacity-100">
              <Ctl label="Ocultar sección" onClick={() => set((d) => ({ ...d, hidden: { ...d.hidden, [key]: true } }))}>
                Ocultar
              </Ctl>
            </span>
          )}
        </div>
        {children}
      </section>
    );
  };

  const bulletList = (items: Item[], onItems: (fn: (items: Item[]) => Item[]) => void, exp?: CvExperience) => (
    <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0" }}>
      {items.map((b, i) => (
        <li key={b.id} className="group/row relative" style={{ display: "flex", gap: 8, marginTop: 3, breakInside: "avoid" }}>
          <span aria-hidden style={{ color: t.accent, flex: "none", width: 10 }}>
            {t.bulletMarker}
          </span>
          <Text
            value={b.text}
            multiline
            placeholder="Escribí un logro…"
            onSet={(v) => onItems((list) => list.map((x) => (x.id === b.id ? { ...x, text: v } : x)))}
            style={{ flex: 1 }}
          />
          {editable && (
            <Toolbar>
              {exp && onRegenerate && (
                <Ctl label="Regenerar este bullet con IA" busy={regenerating === b.id} onClick={() => onRegenerate(exp.id, b.id)}>
                  {regenerating === b.id ? <span className="animate-spin">◌</span> : "✨ IA"}
                </Ctl>
              )}
              <Ctl label="Subir" onClick={() => onItems((list) => move(list, i, i - 1))}>
                ↑
              </Ctl>
              <Ctl label="Bajar" onClick={() => onItems((list) => move(list, i, i + 1))}>
                ↓
              </Ctl>
              <Ctl label="Borrar" onClick={() => onItems((list) => list.filter((x) => x.id !== b.id))}>
                ✕
              </Ctl>
            </Toolbar>
          )}
        </li>
      ))}
      {editable && exp && onProposal && proposals.filter((p) => p.expId === exp.id).map((p) => <ProposalRow key={p.palabra} p={p} onAction={(a, texto) => onProposal(a, p.palabra, texto)} />)}
      {editable && (
        <li>
          <AddButton onClick={() => onItems((list) => [...list, item("")])}>+ Agregar logro</AddButton>
        </li>
      )}
    </ul>
  );

  const setExp = (id: string, fn: (e: CvExperience) => CvExperience) =>
    set((d) => ({ ...d, experiencia: d.experiencia.map((e) => (e.id === id ? fn(e) : e)) }));

  const photo = doc.showPhoto && doc.photo && (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={doc.photo.dataUrl}
      alt=""
      width={88}
      height={88}
      style={{ width: 88, height: 88, objectFit: "cover", borderRadius: doc.photo.shape === "circle" ? "50%" : 4, flex: "none" }}
    />
  );

  const centered = t.header.textAlign === "center";
  const contact = contactLine(doc);

  const blocks: Record<SectionKey, () => ReactNode> = {
    resumen: () =>
      section(
        "resumen",
        <div style={t.summaryBox}>
          <Text as="p" value={doc.resumen} multiline onSet={(v) => set((d) => ({ ...d, resumen: v }))} style={{ margin: 0 }} />
        </div>,
      ),
    logrosClave: () =>
      section(
        "logrosClave",
        bulletList(doc.logrosClave, (fn) => set((d) => ({ ...d, logrosClave: fn(d.logrosClave) }))),
      ),
    experiencia: () =>
      section(
        "experiencia",
        <div>
          {doc.experiencia.map((e, i) => (
            <div key={e.id} className="group/exp relative" style={{ marginTop: i === 0 ? 2 : 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", columnGap: 16, breakAfter: "avoid" }}>
                <div style={{ minWidth: 0 }}>
                  <Text value={e.cargo} placeholder="Cargo" onSet={(v) => setExp(e.id, (x) => ({ ...x, cargo: v }))} style={t.role} />
                  <span style={{ color: t.muted }}>{" · "}</span>
                  <Text value={e.empresa} placeholder="Empresa" onSet={(v) => setExp(e.id, (x) => ({ ...x, empresa: v }))} style={t.company} />
                </div>
                <Text value={e.periodo} placeholder="MM/AAAA – MM/AAAA" onSet={(v) => setExp(e.id, (x) => ({ ...x, periodo: v }))} style={t.date} />
              </div>
              {(e.ubicacion || editable) && (
                <Text
                  as="div"
                  value={e.ubicacion}
                  placeholder="Ubicación"
                  onSet={(v) => setExp(e.id, (x) => ({ ...x, ubicacion: v }))}
                  style={{ ...t.date, marginTop: 1 }}
                />
              )}
              {bulletList(e.bullets, (fn) => setExp(e.id, (x) => ({ ...x, bullets: fn(x.bullets) })), e)}
              {editable && (
                <span className="absolute -top-1 -right-1 flex gap-0.5 rounded-lg border border-line bg-paper opacity-0 shadow-sm transition group-focus-within/exp:opacity-100 group-hover/exp:opacity-100">
                  <Ctl label="Subir experiencia" onClick={() => set((d) => ({ ...d, experiencia: move(d.experiencia, i, i - 1) }))}>
                    ↑
                  </Ctl>
                  <Ctl label="Bajar experiencia" onClick={() => set((d) => ({ ...d, experiencia: move(d.experiencia, i, i + 1) }))}>
                    ↓
                  </Ctl>
                  <Ctl label="Borrar experiencia" onClick={() => set((d) => ({ ...d, experiencia: d.experiencia.filter((x) => x.id !== e.id) }))}>
                    ✕
                  </Ctl>
                </span>
              )}
            </div>
          ))}
          {editable && (
            <AddButton
              onClick={() =>
                set((d) => ({
                  ...d,
                  experiencia: [...d.experiencia, { id: newId("x"), cargo: "", empresa: "", ubicacion: "", periodo: "", bullets: [item("")] }],
                }))
              }
            >
              + Agregar experiencia
            </AddButton>
          )}
        </div>,
      ),
    educacion: () =>
      section(
        "educacion",
        <div>
          {doc.educacion.map((ed) => (
            <div
              key={ed.id}
              className="group/row relative"
              style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", columnGap: 16, marginTop: 3 }}
            >
              <div style={{ minWidth: 0 }}>
                <Text
                  value={ed.titulo}
                  placeholder="Título"
                  onSet={(v) => set((d) => ({ ...d, educacion: d.educacion.map((x) => (x.id === ed.id ? { ...x, titulo: v } : x)) }))}
                  style={t.role}
                />
                <span style={{ color: t.muted }}>{" · "}</span>
                <Text
                  value={ed.institucion}
                  placeholder="Institución"
                  onSet={(v) => set((d) => ({ ...d, educacion: d.educacion.map((x) => (x.id === ed.id ? { ...x, institucion: v } : x)) }))}
                />
              </div>
              <Text
                value={ed.periodo}
                placeholder="AAAA – AAAA"
                onSet={(v) => set((d) => ({ ...d, educacion: d.educacion.map((x) => (x.id === ed.id ? { ...x, periodo: v } : x)) }))}
                style={t.date}
              />
              {editable && (
                <Toolbar>
                  <Ctl label="Borrar" onClick={() => set((d) => ({ ...d, educacion: d.educacion.filter((x) => x.id !== ed.id) }))}>
                    ✕
                  </Ctl>
                </Toolbar>
              )}
            </div>
          ))}
          {editable && (
            <AddButton onClick={() => set((d) => ({ ...d, educacion: [...d.educacion, { id: newId("e"), titulo: "", institucion: "", periodo: "" }] }))}>
              + Agregar estudio
            </AddButton>
          )}
        </div>,
      ),
    habilidades: () =>
      section(
        "habilidades",
        <Text as="p" value={doc.habilidades} multiline onSet={(v) => set((d) => ({ ...d, habilidades: v }))} style={{ margin: 0 }} />,
      ),
    idiomas: () =>
      section("idiomas", <Text as="p" value={doc.idiomas} onSet={(v) => set((d) => ({ ...d, idiomas: v }))} style={{ margin: 0 }} />),
    certificaciones: () =>
      section(
        "certificaciones",
        bulletList(doc.certificaciones, (fn) => set((d) => ({ ...d, certificaciones: fn(d.certificaciones) }))),
      ),
  };

  return (
    <EditableCtx.Provider value={editable}>
    <article
      className={mode === "preview" ? "rounded-[2px] shadow-[0_20px_60px_-30px_rgba(43,36,32,0.35)] ring-1 ring-line" : undefined}
      style={page}
      lang={doc.lang}
    >
      <header
        style={{
          ...t.header,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexDirection: centered ? "column" : "row",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, width: centered ? "100%" : undefined }}>
          <Text as="h1" value={doc.nombre} placeholder="Tu nombre" onSet={(v) => set((d) => ({ ...d, nombre: v }))} style={{ ...t.name, fontFamily: t.name.fontFamily ?? t.headFont, margin: 0 }} />
          <Text as="p" value={doc.titular} placeholder="Título profesional" onSet={(v) => set((d) => ({ ...d, titular: v }))} style={{ ...t.titular, margin: `${t.titular.marginTop}px 0 0` }} />
          {editable ? (
            <p style={{ ...t.contact, margin: `${t.contact.marginTop}px 0 0` }}>
              {(["email", "telefono", "ubicacion", "linkedin"] as const).map((k, i) => (
                <span key={k}>
                  {i > 0 && <span style={{ color: t.contactSep ?? t.muted }}>{"  |  "}</span>}
                  <EditableText
                    value={doc.contacto[k]}
                    placeholder={{ email: "email", telefono: "teléfono", ubicacion: "ciudad", linkedin: "linkedin" }[k]}
                    onChange={(v) => set((d) => ({ ...d, contacto: { ...d.contacto, [k]: v } }))}
                  />
                </span>
              ))}
            </p>
          ) : (
            contact.length > 0 && <p style={{ ...t.contact, margin: `${t.contact.marginTop}px 0 0` }}>{contact.join("  |  ")}</p>
          )}
        </div>
        {photo && <div style={{ order: centered ? -1 : 1 }}>{photo}</div>}
      </header>

      {t.order.map((k) => blocks[k]())}
    </article>
    </EditableCtx.Provider>
  );
}
