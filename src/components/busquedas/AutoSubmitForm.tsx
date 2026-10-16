"use client";

/** Formulario que se envía solo al cambiar un filtro (sin JavaScript, queda el botón). */
export default function AutoSubmitForm(props: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} onChange={(e) => e.currentTarget.requestSubmit()} />;
}
