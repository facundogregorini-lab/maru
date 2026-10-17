import type { Browser } from "puppeteer-core";
import { authRequired, sessionEmail } from "@/lib/auth";
import { fontFaceCss } from "@/lib/fonts";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_HTML = 3 * 1024 * 1024;
// Chromium local para desarrollo (en Vercel se usa @sparticuz/chromium).
const LOCAL_CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const withSparticuz = () => !!process.env.VERCEL || process.env.USE_SPARTICUZ === "1";

type Stage = "launch" | "render" | "pdf";

class ExportError extends Error {
  constructor(
    public stage: Stage,
    public cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause));
  }
}

async function launch(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  if (withSparticuz()) {
    // Requiere que node_modules/@sparticuz/chromium/bin viaje con la función (ver outputFileTracingIncludes en next.config.ts).
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return puppeteer.launch({ executablePath: LOCAL_CHROME, headless: true, args: ["--no-sandbox"] });
}

async function step<T>(stage: Stage, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    throw new ExportError(stage, err);
  }
}

/** Saca scripts y atributos on* del HTML recibido: sólo queremos marcado y estilos. */
function sanitize(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function failure(err: unknown, started: number): Response {
  const stage = err instanceof ExportError ? err.stage : "render";
  const cause = err instanceof ExportError ? err.cause : err;
  // El detalle completo va a los logs de Vercel; al usuario, un mensaje útil y la salida por Word.
  console.error(`[export/pdf] falló en la etapa "${stage}" a los ${Date.now() - started} ms:`, cause instanceof Error ? cause.message : cause);
  if (cause instanceof Error && cause.stack) console.error(cause.stack);
  return Response.json(
    {
      error:
        stage === "launch"
          ? "El generador de PDF no está disponible en este momento. Descargá el Word: tiene el mismo contenido y lo podés guardar como PDF."
          : "No pudimos generar el PDF de este CV. Descargá el Word: tiene el mismo contenido y lo podés guardar como PDF.",
      code: "PDF_FAILED",
      stage,
      detail: (cause instanceof Error ? cause.message : String(cause)).slice(0, 300),
    },
    { status: 500 },
  );
}

/** Recibe el HTML del CV (el mismo componente de la vista previa) y lo imprime a un PDF A4 con texto real. */
export async function POST(req: Request) {
  // Descargar el CV exige haber ingresado con el magic link.
  if (!sessionEmail(req)) return authRequired();
  const started = Date.now();
  const { html, padY } = (await req.json().catch(() => ({}))) as { html?: string; padY?: number };
  if (!html || html.length > MAX_HTML) {
    return Response.json({ error: "El CV no es válido.", code: "BAD_HTML" }, { status: 400 });
  }
  const marginMm = Math.max(10, Math.min(24, Math.round(((padY ?? 48) / 96) * 25.4)));
  // Las fuentes van embebidas en base64: no dependen de URLs relativas (/_next/static/...) que el servidor no resuelve.
  // CSP: aunque algo se escape del filtro, el documento no puede cargar ni ejecutar nada de afuera.
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'"><style>
${await fontFaceCss()}
@page { size: A4; margin: ${marginMm}mm 0; }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${sanitize(html)}</body></html>`;

  let browser: Browser | null = null;
  try {
    browser = await step("launch", launch);
    const b = browser;
    const page = await step("render", async () => {
      const p = await b.newPage();
      // El CV es marcado y estilos: sin JavaScript (el filtro de <script> se puede esquivar y la intercepción no cubre WebSockets).
      await p.setJavaScriptEnabled(false);
      // Sólo recursos embebidos: bloqueamos cualquier pedido de red.
      await p.setRequestInterception(true);
      p.on("request", (r) => (r.url().startsWith("data:") ? r.continue() : r.abort()));
      await p.setContent(doc, { waitUntil: "load", timeout: 20_000 });
      await p.evaluate(async () => {
        await document.fonts.ready;
        // El evento load no garantiza que la foto ya esté decodificada para imprimir.
        // Si una imagen falla, no entregar silenciosamente un CV sin ella.
        const embedded = Array.from(document.images).filter((image) => /^data:image\//i.test(image.src));
        await Promise.all(embedded.map((image) => image.decode()));
      });
      return p;
    });
    const pdf = await step("pdf", () => page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, timeout: 30_000 }));
    return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
  } catch (err) {
    return failure(err, started);
  } finally {
    await browser?.close().catch(() => null);
  }
}

/** Chequeo de salud: ¿arranca Chromium en este entorno? Útil para diagnosticar sin acceso a los logs. */
export async function GET() {
  const started = Date.now();
  let browser: Browser | null = null;
  try {
    browser = await step("launch", launch);
    return Response.json({ ok: true, chromium: await browser.version(), ms: Date.now() - started });
  } catch (err) {
    return failure(err, started);
  } finally {
    await browser?.close().catch(() => null);
  }
}
