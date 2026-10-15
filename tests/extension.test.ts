import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "esbuild";
import puppeteer, { type Browser, type CDPSession, type Page } from "puppeteer-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { AutofillField, Profile } from "@/lib/schemas";

/**
 * De punta a punta: Chromium real con la extensión cargada, páginas de prueba (HTML común, un iframe
 * de otro origen y un formulario React controlado) y las rutas reales /api/profile y /api/autofill.
 * Lo único simulado es la respuesta de la IA.
 */

const CHROME = process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ROOT = path.resolve(__dirname, "..");
const FIXTURES = path.join(ROOT, "tests/fixtures/autofill");

const profile: Profile = {
  nombre: "Ana Pérez",
  titulo: "Frontend Engineer",
  ubicacion: "Buenos Aires, Argentina",
  email: "ana@mail.com",
  telefono: "+54 11 5555 5555",
  linkedin_url: "https://linkedin.com/in/anaperez",
  otros_links: ["https://github.com/anaperez"],
  resumen: "",
  aptitudes: ["React", "TypeScript"],
  experiencia: [
    { empresa: "Tucán", cargo: "Frontend Engineer", inicio: "05/2019", fin: "actual", ubicacion: "", descripcion: "", logros: ["x"], fragmentos_incompletos: [] },
  ],
  educacion: [],
  idiomas: [],
  certificaciones: [],
};

const WHY = "Me entusiasma construir el checkout de Tucán: hace 7 años que trabajo con React y TypeScript.";

/** Hace de modelo: decide por la etiqueta, como lo haría la IA siguiendo las reglas del prompt. */
function fakeModel(f: AutofillField, extras: string): { valor: string; revisar?: boolean; nota?: string } | null {
  const l = f.etiqueta.toLowerCase();
  if (/first name/.test(l)) return { valor: "Ana" };
  if (/last name/.test(l)) return { valor: "Pérez" };
  if (/full name/.test(l)) return { valor: "Ana Pérez" };
  if (/email/.test(l)) return { valor: profile.email };
  if (/phone/.test(l)) return { valor: profile.telefono };
  if (/linkedin/.test(l)) return { valor: profile.linkedin_url };
  if (/portfolio|github/.test(l)) return { valor: profile.otros_links[0] };
  if (/years/.test(l)) return { valor: "7", revisar: true, nota: "Calculado desde tu CV" };
  if (/start date/.test(l)) return { valor: "2026-11-01" };
  if (/country/.test(l)) return { valor: "Argentina" };
  if (/authorized|remote/.test(l)) return { valor: "Sí" };
  if (/daily/.test(l)) return { valor: "TypeScript\nReact" };
  if (/why|about yourself/.test(l)) return { valor: WHY, revisar: true, nota: "Redactado por Maru" };
  if (/salary/.test(l) && extras.includes("USD 3.000")) return { valor: "USD 3.000 netos" };
  if (/resume/.test(l)) return { valor: "cv" };
  return null;
}

const autofillRequests: { fields: AutofillField[]; text: string }[] = [];

vi.mock("@/lib/claude", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/claude")>();
  const { AUTOFILL_SYSTEM } = await import("@/lib/prompts");
  return {
    ...actual,
    askStructured: async (opts: { system: string; content: { type: string; text?: string }[] }) => {
      if (opts.system !== AUTOFILL_SYSTEM) return profile;
      const text = opts.content.map((b) => b.text ?? "").join("\n");
      const fields = (text.match(/<campos>\n([\s\S]*?)\n<\/campos>/)?.[1] ?? "").split("\n").map((l) => JSON.parse(l) as AutofillField);
      const extras = text.match(/<datos_extra>\n([\s\S]*?)\n<\/datos_extra>/)?.[1] ?? "";
      autofillRequests.push({ fields, text });
      const campos = fields.flatMap((f) => {
        const a = fakeModel(f, extras);
        return a ? [{ id: f.id, valor: a.valor, revisar: a.revisar ?? false, nota: a.nota ?? "" }] : [];
      });
      return { campos };
    },
  };
});

const { POST: profilePOST } = await import("@/app/api/profile/route");
const { POST: autofillPOST } = await import("@/app/api/autofill/route");

let server: Server;
let port = 0;
let chrome: ChildProcess;
let userDataDir = "";
let browser: Browser;
let sw: CDPSession;
let extensionId = "";

async function bundle(file: string): Promise<string> {
  const result = await build({
    entryPoints: [path.join(FIXTURES, file)],
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}

async function startServer() {
  const scripts: Record<string, string> = {
    "/react.js": await bundle("react-form.tsx"),
    "/combobox.js": await bundle("combobox-form.tsx"),
  };
  const handlers: Record<string, (req: Request) => Promise<Response>> = { "/api/profile": profilePOST, "/api/autofill": autofillPOST };

  server = createServer(async (req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://x");
    const handler = handlers[pathname];
    if (req.method === "POST" && handler) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const response = await handler(new Request(`http://x${pathname}`, { method: "POST", body: Buffer.concat(chunks) }));
      res.writeHead(response.status, { "content-type": "application/json" });
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    const html = (body: string) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    };
    // El iframe se sirve desde 127.0.0.1 y la página desde localhost: orígenes distintos, como un Greenhouse embebido.
    if (pathname === "/form") return html(readFileSync(path.join(FIXTURES, "form.html"), "utf8").replace("__FRAME_URL__", `http://127.0.0.1:${port}/frame`));
    if (pathname === "/frame") return html(readFileSync(path.join(FIXTURES, "frame.html"), "utf8"));
    if (pathname === "/react" || pathname === "/combobox") {
      return html(`<!doctype html><title>React</title><div id="root"></div><script src="${pathname}.js"></script>`);
    }
    if (scripts[pathname]) {
      res.writeHead(200, { "content-type": "text/javascript" });
      return res.end(scripts[pathname]);
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
}

async function startChrome() {
  userDataDir = mkdtempSync(path.join(tmpdir(), "maru-ext-"));
  const ext = path.join(ROOT, "extension");
  chrome = spawn(CHROME, [
    "--headless=new",
    "--no-sandbox",
    "--no-first-run",
    "--no-proxy-server",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    `--disable-extensions-except=${ext}`,
    `--load-extension=${ext}`,
    "about:blank",
  ]);
  const wsEndpoint = await new Promise<string>((resolve, reject) => {
    let log = "";
    const timer = setTimeout(() => reject(new Error(`Chromium no arrancó:\n${log}`)), 20_000);
    chrome.stderr!.on("data", (d: Buffer) => {
      log += d.toString();
      const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
  });
  browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint, defaultViewport: { width: 1200, height: 900 } });
  const target = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().startsWith("chrome-extension://"));
  // worker.evaluate de Puppeteer no responde con un service worker que ya estaba corriendo: vamos por CDP.
  sw = await target.createCDPSession();
  extensionId = new URL(target.url()).host;
  await inWorker(`chrome.storage.local.set({ server: "http://localhost:${port}" })`);
}

/** Evalúa código en el service worker de la extensión. */
async function inWorker<T = unknown>(expression: string): Promise<T> {
  const { result, exceptionDetails } = await sw.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value as T;
}

/** Abre una página y completa con la extensión, como si la persona tocara el botón. */
async function fill(url: string): Promise<{ page: Page; result: Record<string, unknown> }> {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "load" });
  await page.bringToFront();
  const result = await inWorker<Record<string, unknown>>("self.fillActiveTab()");
  return { page, result };
}

const run = existsSync(CHROME);

describe.skipIf(!run)("extensión de Chrome", () => {
  beforeAll(async () => {
    await startServer();
    await startChrome();
  }, 60_000);

  afterAll(async () => {
    await browser?.disconnect();
    if (chrome && chrome.exitCode === null) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve));
      chrome.kill("SIGKILL");
      await exited;
    }
    server?.close();
    if (userDataDir) rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3 });
  });

  it("sin CV cargado, avisa que primero hay que cargarlo", async () => {
    const { page, result } = await fill(`http://localhost:${port}/form`);
    expect(result.error).toMatch(/cargá tu CV/);
    await page.close();
  });

  it("el popup lee el CV con Maru y lo guarda junto con los datos extra", async () => {
    const popup = await browser.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForSelector("#setup:not([hidden])");
    const input = await popup.$("input#file");
    await input!.uploadFile(path.join(ROOT, "tests/fixtures/cv.pdf") as `${string}.pdf`);
    await popup.waitForSelector("#read:not([disabled])");
    await popup.click("#read");
    await popup.waitForSelector("#ready:not([hidden])");
    expect(await popup.$eval("#name", (n) => n.textContent)).toBe("Ana Pérez");
    expect(await popup.$eval("#cv-file", (n) => n.textContent)).toContain("cv.pdf");

    await popup.type("#extras", "Pretensión salarial: USD 3.000 netos");
    await popup.waitForFunction(() => document.getElementById("saved")?.textContent === "Guardado");
    const stored = await inWorker<Record<string, { [k: string]: string }>>("chrome.storage.local.get(null)");
    expect(stored.profile.nombre).toBe("Ana Pérez");
    expect(stored.cv).toMatchObject({ name: "cv.pdf", mime: "application/pdf" });
    expect(stored.cv.base64.startsWith("JVBERi")).toBe(true);
    expect(stored.extras).toContain("USD 3.000");
    await popup.close();
  }, 30_000);

  it("completa un formulario común y el iframe de otro origen, sin enviarlo", async () => {
    autofillRequests.length = 0;
    const { page, result } = await fill(`http://localhost:${port}/form`);
    expect(result.error).toBeUndefined();

    // Lo que se le mandó a la IA: etiquetas legibles, sin el honeypot ni lo que ya estaba completo.
    const [{ fields, text }] = autofillRequests;
    const labels = fields.map((f) => f.etiqueta);
    expect(labels).toEqual(
      expect.arrayContaining(["First name *", "Email *", "Phone", "Are you legally authorized to work in Argentina? *", "Portfolio or GitHub URL"]),
    );
    expect(labels).not.toContain("Current location");
    expect(fields.some((f) => /website_hp/.test(f.etiqueta))).toBe(false);
    expect(fields.find((f) => f.etiqueta === "Country")).toMatchObject({ tipo: "seleccion", opciones: ["Select…", "Argentina", "Brazil", "Mexico"] });
    expect(fields.find((f) => f.etiqueta.startsWith("Which of these"))).toMatchObject({ tipo: "multiple", opciones: ["TypeScript", "React", "PHP"] });
    expect(fields.find((f) => f.etiqueta === "I agree to the privacy policy")).toMatchObject({ tipo: "casilla", obligatorio: true });
    expect(fields.find((f) => f.etiqueta.startsWith("Why do you want"))).toMatchObject({ tipo: "texto_largo", max_caracteres: 600 });
    expect(fields.find((f) => f.etiqueta.startsWith("Resume"))).toMatchObject({ tipo: "archivo" });
    expect(fields.find((f) => f.etiqueta === "Portfolio or GitHub URL")!.id).not.toMatch(/^0:/);
    expect(text).toContain("Tucán is hiring a Senior Frontend Engineer");

    const values = await page.evaluate(() => {
      const v = (sel: string) => (document.querySelector(sel) as HTMLInputElement).value;
      const resume = document.querySelector("#resume") as HTMLInputElement;
      return {
        first: v("#first"),
        last: v("#last"),
        email: v("[name=email]"),
        phone: v("[name=phone]"),
        linkedin: v("#li"),
        city: v("#city"),
        years: v("#years"),
        start: v("#start"),
        country: v("#country"),
        gender: v("#gender"),
        auth: (document.querySelector("[name=auth]:checked") as HTMLInputElement | null)?.value,
        skills: [...document.querySelectorAll<HTMLInputElement>("[name=skills]:checked")].map((c) => c.value),
        why: v("#why"),
        salary: v("#salary"),
        resume: resume.files?.[0]?.name,
        terms: (document.querySelector("[name=terms]") as HTMLInputElement).checked,
        honeypot: v("[name=website_hp]"),
        submitted: (window as unknown as { submitted?: number }).submitted ?? 0,
        firstOutline: getComputedStyle(document.querySelector("#first")!).outlineColor,
        whyOutline: getComputedStyle(document.querySelector("#why")!).outlineColor,
        whyTitle: (document.querySelector("#why") as HTMLElement).title,
      };
    });
    expect(values).toEqual({
      first: "Ana",
      last: "Pérez",
      email: "ana@mail.com",
      phone: "+54 11 5555 5555",
      linkedin: "https://linkedin.com/in/anaperez",
      city: "Rosario",
      years: "7",
      start: "2026-11-01",
      country: "ar",
      gender: "",
      auth: "1",
      skills: ["ts", "react"],
      why: WHY,
      salary: "USD 3.000 netos",
      resume: "cv.pdf",
      terms: false,
      honeypot: "",
      submitted: 0,
      firstOutline: "rgb(111, 132, 102)",
      whyOutline: "rgb(217, 164, 65)",
      whyTitle: "Maru: Redactado por Maru",
    });

    // El iframe (Greenhouse embebido) también se completa; el obligatorio sin dato queda marcado.
    const frame = page.frames().find((f) => f.url().includes("/frame"))!;
    expect(await frame.$eval("#gh_portfolio", (n) => (n as HTMLInputElement).value)).toBe("https://github.com/anaperez");
    expect(await frame.$eval("#gh_notice", (n) => getComputedStyle(n).outlineColor)).toBe("rgb(217, 164, 65)");

    expect(result).toMatchObject({ completados: 14, revisar: 2, pendientes: 2 });
    expect(result.summary).toMatch(/completamos 14 campos/);
    const toast = await page.evaluate(() => [...document.querySelectorAll("div")].find((d) => d.shadowRoot)?.shadowRoot?.textContent ?? "");
    expect(toast).toContain("Revisá todo y enviá cuando quieras");
    await page.close();
  }, 30_000);

  it("en un formulario React controlado, el estado de React recibe cada valor", async () => {
    const { page, result } = await fill(`http://localhost:${port}/react`);
    expect(result.error).toBeUndefined();
    const state = JSON.parse(await page.$eval("#state", (n) => n.textContent ?? "{}"));
    expect(state).toEqual({ name: "Ana Pérez", email: "ana@mail.com", country: "AR", remote: "yes", cover: WHY });
    await page.close();
  }, 30_000);

  it("elige en listas con buscador (react-select, como Greenhouse) sin tocar las ya elegidas", async () => {
    autofillRequests.length = 0;
    const { page, result } = await fill(`http://localhost:${port}/combobox`);
    expect(result.error).toBeUndefined();

    const [{ fields }] = autofillRequests;
    expect(fields.map((f) => [f.tipo, f.etiqueta, f.opciones])).toEqual([
      ["seleccion", "Country", ["Argentina", "Brazil", "Chile", "Uruguay"]],
      ["seleccion", "Are you legally authorized to work in Argentina?", ["Yes", "No"]],
      ["seleccion", "Gender", ["Female", "Male", "Decline to self-identify"]],
    ]);

    const state = JSON.parse(await page.$eval("#state", (n) => n.textContent ?? "{}"));
    expect(state).toEqual({ prefilled: "uy", country: "argentina", authorized: "yes" });
    // Las listas quedan cerradas y el género (no lo completamos nunca) queda marcado como pendiente.
    expect(await page.$$("[role=listbox]")).toHaveLength(0);
    expect(result).toMatchObject({ completados: 2, revisar: 0, pendientes: 1 });
    await page.close();
  }, 30_000);

  it("si la página no tiene campos vacíos, lo dice en lugar de llamar a la IA", async () => {
    autofillRequests.length = 0;
    const { page, result } = await fill(`http://localhost:${port}/frame`.replace("/frame", "/react.js"));
    expect(result.error).toMatch(/No encontramos campos/);
    expect(autofillRequests).toHaveLength(0);
    await page.close();
  });
});
