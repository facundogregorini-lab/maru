"use client";

import { useEffect, useRef, type CSSProperties, type ElementType } from "react";

/**
 * Texto editable en el lugar. Es "no controlado" mientras tiene foco (para no mover el cursor)
 * y confirma el cambio al salir. Si el valor cambia desde afuera (p. ej. regenerar con IA), se actualiza.
 */
export default function EditableText({
  value,
  onChange,
  as: Tag = "span",
  style,
  multiline = false,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  as?: ElementType;
  style?: CSSProperties;
  multiline?: boolean;
  placeholder?: string;
  label?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== value) el.innerText = value;
  }, [value]);

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label ?? placeholder}
      aria-multiline={multiline}
      spellCheck
      data-placeholder={placeholder}
      className="cv-editable"
      style={style}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const v = e.currentTarget.innerText.replace(/ /g, " ").trim();
        if (v !== value) onChange(v);
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" && !(multiline && e.shiftKey)) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.innerText = value;
          e.currentTarget.blur();
        }
      }}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        // Pegamos sólo texto plano: nada de estilos de Word o de la web dentro del CV.
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    >
      {value}
    </Tag>
  );
}
