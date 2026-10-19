/**
 * Pedido de ingreso desde cualquier llamada a la IA (navegador). Si el servidor responde
 * AUTH_REQUIRED, `post()` pide el ingreso acá: LoginHost abre el diálogo de Google y, al ingresar,
 * la llamada se repite sola con lo que la persona ya había cargado.
 */

type Handler = (reason: string) => Promise<boolean>;

let handler: Handler | null = null;
let pending: Promise<boolean> | null = null;

/** Lo registra LoginHost al montarse; devuelve cómo darlo de baja. */
export function setLoginHandler(h: Handler): () => void {
  handler = h;
  return () => {
    if (handler === h) handler = null;
  };
}

/**
 * true si la persona ingresó; false si cerró el diálogo o no hay quién lo muestre.
 * Pedidos simultáneos (p. ej. leer el CV y analizarlo a la vez) comparten un solo diálogo.
 */
export function requestLogin(reason: string): Promise<boolean> {
  if (!handler) return Promise.resolve(false);
  pending ??= handler(reason).finally(() => {
    pending = null;
  });
  return pending;
}

/** Qué está por hacer la persona, para el diálogo ("Ingresá a Maru para …"). */
const MOTIVOS: Record<string, string> = {
  "/api/profile": "leer tu CV",
  "/api/cv/analyze": "analizar tu CV",
  "/api/cv/generate": "armar tu CV",
  "/api/analyze": "preparar tu postulación",
  "/api/generate": "preparar tu postulación",
  "/api/carta": "escribir tu carta",
  "/api/video/guion": "armar tu guion de video",
  "/api/entrevista/preparar": "practicar tu entrevista",
};
export const motivoDe = (url: string) => MOTIVOS[url] ?? "seguir";
