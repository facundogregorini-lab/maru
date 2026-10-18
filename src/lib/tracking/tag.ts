import { adsConfig, metaPixelId, type AdsConfig } from "./config";

/**
 * Script en línea del <head> que inicializa window.dataLayer/gtag y carga gtag.js UNA vez, sólo en los
 * dominios de producción (nunca localhost ni previews de Vercel). Destino: el ID de Google Ads de la cuenta
 * (AW-…). Sin GTM ni "Conversion Linker": la etiqueta de Google guarda sola el gclid del etiquetado automático
 * en cookies propias del dominio (_gcl_*), así la atribución sobrevive a redirecciones, registro y navegación.
 *
 * window.__maruAdsLoaded queda true al cargar y false si el navegador lo bloquea (ver ads.ts).
 * Devuelve null si no hay ID válido: la etiqueta queda apagada.
 */
export function googleTagSnippet(config: AdsConfig = adsConfig()): string | null {
  if (!config.id) return null;
  const id = JSON.stringify(config.id);
  const hosts = JSON.stringify(config.hosts);
  return [
    "window.dataLayer=window.dataLayer||[];",
    "window.gtag=window.gtag||function(){window.dataLayer.push(arguments)};",
    "(function(){",
    `var hosts=${hosts};`,
    "if(hosts.indexOf(location.hostname.toLowerCase())<0||window.__maruAdsInit)return;",
    "window.__maruAdsInit=true;",
    "gtag('js',new Date());",
    `gtag('config',${id});`,
    "var s=document.createElement('script');s.async=true;",
    `s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(${id});`,
    "s.onload=function(){window.__maruAdsLoaded=true};",
    "s.onerror=function(){window.__maruAdsLoaded=false};",
    "document.head.appendChild(s);",
    "})();",
  ].join("");
}

/**
 * Píxel de Meta de Maru, directo y una sola vez, en los mismos dominios de producción. Sin "eventos automáticos"
 * (autoConfig apagado: no lee botones ni formularios) y sin coincidencias avanzadas: sólo PageView (Meta sigue
 * solo los cambios de ruta del sitio) y los hitos de meta.ts.
 *
 * window.__maruMetaLoaded queda true al cargar y false si el navegador lo bloquea. null si no hay ID válido.
 */
export function metaPixelSnippet(pixelId: string | null = metaPixelId(), config: AdsConfig = adsConfig()): string | null {
  if (!pixelId) return null;
  const id = JSON.stringify(pixelId);
  const hosts = JSON.stringify(config.hosts);
  return [
    "(function(w,d){",
    `var hosts=${hosts};`,
    "if(hosts.indexOf(location.hostname.toLowerCase())<0||w.fbq)return;",
    "var n=w.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};",
    "if(!w._fbq)w._fbq=n;n.push=n;n.loaded=true;n.version='2.0';n.queue=[];",
    "var s=d.createElement('script');s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';",
    "s.onload=function(){w.__maruMetaLoaded=true};",
    "s.onerror=function(){w.__maruMetaLoaded=false};",
    "d.head.appendChild(s);",
    `n('set','autoConfig',false,${id});`,
    `n('init',${id});`,
    "n('track','PageView');",
    "})(window,document);",
  ].join("");
}
