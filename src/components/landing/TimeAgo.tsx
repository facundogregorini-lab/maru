"use client";

import { useEffect, useState } from "react";

/** "hace 3 h": se calcula en el navegador para que no quede congelado en la versión publicada. */
export default function TimeAgo({ iso }: { iso: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    setText(mins < 60 ? `hace ${mins} min` : mins < 60 * 24 ? `hace ${Math.round(mins / 60)} h` : `hace ${Math.round(mins / 1440)} d`);
  }, [iso]);
  return <>{text || "nueva"}</>;
}
