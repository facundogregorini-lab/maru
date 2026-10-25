# Video demo de Maru

Dos versiones del mismo video, listas para usar:

| Archivo | Formato | Para |
|---|---|---|
| [`out/maru-horizontal.mp4`](out/maru-horizontal.mp4) | 1920 × 1080, 41 s | web, YouTube, LinkedIn, presentaciones y llamadas de venta |
| [`out/maru-vertical.mp4`](out/maru-vertical.mp4) | 1080 × 1920, 41 s | Reels, TikTok, Shorts, estados de WhatsApp y anuncios |

H.264 + AAC a 30 cuadros, volumen normalizado a −14 LUFS (el estándar de las redes).

## Qué muestra

1. **Gancho:** «Basta de buscar trabajo sin ayuda. HACELO CON IA», con Maru pixelada tipeando.
2. **Match:** se arrastra el CV, Maru lo lee, muestra cómo entendió el perfil y el ranking de **búsquedas reales** del inventario con su % de compatibilidad.
3. **Postulación a medida:** desde una búsqueda, «Postulación personalizada»: la vacante ya cargada, se escribe la motivación, Maru analiza fortalezas y brechas y arma el CV adaptado (compatibilidad ATS y palabras clave) y las respuestas para el formulario.
4. **Extensión de Chrome:** un clic en el ícono de Maru completa el formulario campo por campo (verde: copiado del CV; amarillo: redactado por Maru).
5. **Cierre:** «Encontrá tu próximo trabajo con IA · Probá gratis en marucoach.com».

## Cómo está hecho

- **La interfaz es la real.** Playwright navega la web, guarda capturas a 2x y la posición de cada botón y campo (`capture/*.mjs` → `public/maru/shots.json`).
- **[Remotion](https://www.remotion.dev)** (video con React) anima encima: cursor con clics, cámara que acerca y sigue la acción, tipeo, menús, textos y transiciones. El motor está en `src/engine` y el guion del video en `src/maru/script.ts` (tiempos, cámara y cursor) y `src/maru/Video.tsx` (escenas y textos).
- **Horizontal y vertical salen de la misma composición:** en vertical la cámara se acerca más y los textos van arriba.
- **Sonido:** música de Mixkit («Talent in the Air», de Diego Nava, [licencia libre de Mixkit](https://mixkit.co/license/#musicFree), uso comercial permitido dentro del video). Como la licencia no permite redistribuir el archivo suelto, no se versiona: `npm run music` lo baja a `public/music/`. Los clics, teclas y destellos se generan con `scripts/make-sfx.py` (sin licencias de terceros).
- **Licencia de Remotion:** es gratis para personas y empresas de hasta 3 empleados; las más grandes necesitan una [licencia de empresa](https://www.remotion.dev/license).

## Datos y honestidad

- Se captura **producción**, pero la IA se reemplaza por datos ficticios (`capture/maru/fixtures.mjs`): la postulante «Lucía Fernández» no existe. Nada se escribe ni se gasta: el script contesta las rutas de IA y corta cualquier otro POST.
- **Las búsquedas son reales**: el ranking se pide a producción sin IA (`ia: false`, el orden por reglas) y se ocultan las tarjetas difuminadas de «ocultas» para que la lista se lea limpia.
- La extensión es la real (`../../extension`), cargada en Chromium, contra un formulario de ejemplo (`capture/maru/form.html`, empresa ficticia «Andes Data») y un servidor local que imita `/api/autofill` (`capture/maru/mock-server.mjs`).
- La nota al pie del cierre aclara qué es ficticio y qué es real.

## Comandos

Desde `video/demo` (Node 22 o más nuevo). Es un proyecto aparte: no se instala con la app ni entra en su build, lint o tests.

```bash
npm ci
npm run studio                 # vista previa interactiva en el navegador
npm run render                 # baja la música y renderiza out/maru-horizontal.mp4 y out/maru-vertical.mp4
npm run stills -- 90,300       # cuadros sueltos en out/stills para revisar
npx tsx scripts/marks.ts maru   # cuadros clave del guion
npm run typecheck
```

Para recapturar la web (si cambió la interfaz):

```bash
node capture/maru.mjs                 # producción, IA simulada
node capture/maru-extension.mjs       # extensión real contra el formulario de ejemplo
python3 capture/optimize.py public/maru
```

Si cambian los botones de lugar, el cursor los sigue solo (las cajas salen de la captura); si cambia el flujo, se ajusta `src/maru/script.ts`.
