/** QC manual local con datos ficticios: npx tsx scripts/cv-qc.ts. */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { createSessionToken, sessionCookie } from "../src/lib/auth";
import { POST as pdf } from "../src/app/api/export/pdf/route";
import { POST as docx } from "../src/app/api/export/docx/route";
import { analysis, generation, profile } from "../tests/fixtures/cv/sample";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("El QC corre sólo en desarrollo local.");
  const bundle = await build({ entryPoints: ["tests/fixtures/cv/qc.tsx"], bundle: true, write: false, format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" }, logLevel: "silent" });
  const css = await postcss([tailwind()]).process(readFileSync("src/app/globals.css", "utf8"), { from: "src/app/globals.css" });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1:3020");
      res.setHeader("cache-control", "no-store");
      if (url.pathname === "/qc.js") { res.setHeader("content-type", "text/javascript"); res.end(bundle.outputFiles[0].text); return; }
      if (url.pathname === "/qc.css") { res.setHeader("content-type", "text/css"); res.end(css.css); return; }
      if (url.pathname === "/api/auth/me") {
        res.setHeader("set-cookie", sessionCookie(createSessionToken("qc@example.test")));
        res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ email: "qc@example.test" })); return;
      }
      if (url.pathname === "/api/export/pdf" || url.pathname === "/api/export/docx") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const request = new Request(url, { method: "POST", body: Buffer.concat(chunks).toString(), headers: { cookie: req.headers.cookie || "" } });
        const response = await (url.pathname.endsWith("pdf") ? pdf : docx)(request);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (response.ok && url.pathname.endsWith("pdf")) await writeFile(path.join(tmpdir(), "maru-cv-qc-ultimo.pdf"), bytes);
        res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(bytes); return;
      }
      if (url.pathname.startsWith("/api/")) {
        const data = url.pathname === "/api/analyze" ? { analysis } : url.pathname === "/api/generate" ? { generation } : url.pathname === "/api/profile" ? { profile, gaps: [] } : { documents: {}, version: 0 };
        res.setHeader("content-type", "application/json"); res.end(JSON.stringify(data)); return;
      }
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>Maru · QC de CV</title><link rel="stylesheet" href="/qc.css"><div id="root"></div><script src="/qc.js"></script></html>');
    } catch (error) { console.error(error); res.writeHead(500); res.end("Error en el QC local"); }
  });
  server.listen(3020, "127.0.0.1", () => console.log("QC local: http://127.0.0.1:3020 · perfil ficticio; exportaciones reales"));
}
void main();
