/* eslint-disable @next/next/no-html-link-for-pages -- Fixture HTTP local, sin router de Next. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import AuthProvider from "@/components/auth/AuthProvider";
import CvEditor from "@/components/cv/CvEditor";
import Flow from "@/components/Flow";
import { context, sampleCv } from "./sample";

function App() {
  const [doc, setDoc] = useState(sampleCv);
  return <AuthProvider><main style={{ maxWidth: 1250, margin: "32px auto", padding: 24 }}>
    <h1>QC de CV y postulación · datos ficticios</h1>
    <p>Servidor local de prueba. Exportación real; análisis y generación simulados, sin proveedor de IA.</p>
    <nav style={{ margin: "20px 0" }}><a href="/">Editor de CV</a> · <a href="/postulacion">Postulación a medida</a></nav>
    {location.pathname === "/postulacion" ? <Flow/> : <CvEditor doc={doc} setDoc={setDoc} context={context} cambios={[]}/>}
  </main></AuthProvider>;
}
createRoot(document.getElementById("root")!).render(<App/>);
