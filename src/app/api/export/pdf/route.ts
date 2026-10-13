import { fontFaceCss } from "@/lib/fonts";

export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_HTML = 3 * 1024 * 1024;
// Chromium local para desarrollo (en Vercel se usa @sparticuz/chromium).
const LOCAL_CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

async function launch() {
  const puppeteer = (await import("puppeteer-core")).default;
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  return puppeteer.launch({ executablePath: LOCAL_CHROME, headless: true, args: ["--no-sandbox"] });
}

/** Recibe el HTML del CV (el mismo componente de la vista previa) y lo imprime a un PDF A4 con texto real. */
export async function POST(req: Request) {
  const { html, padY } = (await req.json()) as { html?: string; padY?: number };
  if (!html || html.length > MAX_HTML) {
    return Response.json({ error: "El CV no es válido.", code: "BAD_HTML" }, { status: 400 });
  }
  const marginMm = Math.max(10, Math.min(24, Math.round(((padY ?? 48) / 96) * 25.4)));
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
${await fontFaceCss()}
@page { size: A4; margin: ${marginMm}mm 0; }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${html}</body></html>`;

  let browser: Awaited<ReturnType<typeof launch>> | null = null;
  try {
    browser = await launch();
    const page = await browser.newPage();
    // El HTML sólo puede usar recursos embebidos: bloqueamos cualquier pedido de red.
    await page.setRequestInterception(true);
    page.on("request", (r) => (r.url().startsWith("data:") ? r.continue() : r.abort()));
    await page.setJavaScriptEnabled(false);
    await page.setContent(doc, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("PDF export failed", err);
    return Response.json({ error: "No pudimos generar el PDF. Probá de nuevo.", code: "PDF" }, { status: 500 });
  } finally {
    await browser?.close().catch(() => null);
  }
}
