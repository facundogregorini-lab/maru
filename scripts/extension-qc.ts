/** QC manual: npx tsx scripts/extension-qc.ts [commit-base]. Sin IA ni browser automation. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { build } from "esbuild";

async function main() {
  const root = process.cwd();
  const fixture = path.join(root, "tests/fixtures/autofill");
  const before = execFileSync("git", ["show", `${process.argv[2] || "HEAD"}:extension/content.js`], { encoding: "utf8" });
  const react = await build({ entryPoints: [path.join(fixture, "combobox-form.tsx")], bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" });
  const panel = `<div class="controls"><button type="button" id="scan">Detectar campos</button><button type="button" id="fill">Completar prueba</button></div><pre id="scan-output" aria-label="Detección"></pre><pre id="result" aria-label="Resultado de Maru"></pre>
<script>
let scan;
const output = document.getElementById('scan-output');
async function readFields() { scan = await window.__maru.scan(); output.textContent = scan.fields.map(f => f.etiqueta + ': ' + (f.opciones || []).join(', ')).join('\\n') || 'No se detectaron campos'; }
document.getElementById('scan').onclick = readFields;
document.getElementById('fill').onclick = async () => {
  document.getElementById('result').textContent = 'Completando…';
  if (!scan) await readFields();
  const answers = scan.fields.flatMap(f => {
    if (/gender|genero/i.test(f.etiqueta)) return [];
    const wanted = f.opciones?.includes('Argentina') || f.opciones?.includes('Argentina Norte') ? 'Argentina' : f.opciones?.includes('Inglés') ? 'Inglés' : f.opciones?.includes('Yes') ? 'Yes' : f.opciones?.includes('Tiempo completo') ? 'Tiempo completo' : '';
    return wanted ? [{ id:f.id, valor:wanted }] : [];
  });
  document.getElementById('result').textContent = JSON.stringify(await window.__maru.apply(answers), null, 2);
};
</script>`;
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/content.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(url.searchParams.has("before") ? before : readFileSync(path.join(root, "extension/content.js")));
    }
    if (url.pathname === "/dropdowns.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(readFileSync(path.join(fixture, "dropdowns.js")));
    }
    if (url.pathname === "/combobox.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(react.outputFiles[0].text);
    }
    const legacy = url.searchParams.has("before") ? "?before" : "";
    const source = url.pathname === "/react" ? '<!doctype html><html lang="es"><meta charset="utf-8"><title>Maru · React Select</title><h1>React Select · prueba controlada</h1><div id="root"></div><script src="/combobox.js"></script></html>' : readFileSync(path.join(fixture, "dropdowns.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(source.replace("</html>", `<script src="/content.js${legacy}"></script>${panel}</html>`));
  });
  server.listen(3018, "127.0.0.1", () => console.log("QC local: http://127.0.0.1:3018 (actual), /?before (anterior), /react (React Select)"));
}
void main();
