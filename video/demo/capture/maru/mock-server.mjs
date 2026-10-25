// Servidor local que reemplaza a Maru para la extensión: sirve el formulario de ejemplo y
// responde /api/autofill con respuestas fijas (como haría la IA siguiendo las reglas del prompt).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { profile } from "./fixtures.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WHY =
  "Me entusiasma que en Andes Data los datos guíen las decisiones. En Fintech del Sur armé el tablero de riesgo que usa el comité de créditos y automaticé 12 reportes semanales con Python y SQL.";

function answer(f) {
  const l = f.etiqueta.toLowerCase();
  if (/^nombre/.test(l)) return { valor: "Lucía" };
  if (/apellido/.test(l)) return { valor: "Fernández" };
  if (/email/.test(l)) return { valor: profile.email };
  if (/linkedin/.test(l)) return { valor: "linkedin.com/in/luciafernandez" };
  if (/ubicaci/.test(l)) return { valor: profile.ubicacion };
  if (/^cv/.test(l)) return { valor: "cv" };
  if (/años/.test(l)) return { valor: "5", revisar: true, nota: "Calculado desde tu CV" };
  if (/inglés/.test(l)) return { valor: "Avanzado" };
  if (/por qué/.test(l)) return { valor: WHY, revisar: true, nota: "Redactado por Maru" };
  return null;
}

export function start(port = 0) {
  const server = http.createServer((req, res) => {
    const cors = { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type, x-maru-install, x-maru-version, x-maru-source" };
    if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
    if (req.url.startsWith("/form")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(fs.readFileSync(path.join(here, "form.html")));
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const json = (o) => {
        res.writeHead(200, { "content-type": "application/json", ...cors });
        res.end(JSON.stringify(o));
      };
      if (req.url.startsWith("/api/autofill")) {
        const { fields } = JSON.parse(body);
        const answers = [];
        for (const f of fields) {
          const a = answer(f);
          if (a) answers.push({ id: f.id, valor: a.valor, revisar: !!a.revisar, nota: a.nota || "" });
        }
        // Como la IA real, tarda un poco: así se ve el aviso «Maru está completando…».
        return setTimeout(() => json({ answers, remaining: 9, limit: 10 }), 1500);
      }
      if (req.url.startsWith("/api/tracking")) return json({ ok: true });
      json({});
    });
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}
