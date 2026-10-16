# Pendientes y traspaso (para seguir con otra IA)

Estado al 16/10/2026. Todo lo anterior está mergeado en `main` y publicado en https://maru-grego7.vercel.app.

## Objetivo del producto

Maru tiene que ser **igual a jobright.ai de punta a punta, adaptado** (español rioplatense, Argentina, y sólo lo que Maru hace de verdad). Referente de diseño y experiencia: jobright.ai (home, landings `/ai-job-match`, `/job-autofill`, `/ai-resume-builder`, `/tools/cover-letter-generator`, `/tools/job-tracker`, `/interview-landing`; app `/jobs/...`; detalle `/jobs/info/<id>`; registro `/onboarding-v3/signup`).

**Regla de oro:** nunca mostrar algo que Maru no hace (sin testimonios inventados, sin premios, sin "cantidad de postulantes", sin chat si no existe). Los números son del inventario real (`data/match/inventory.json`) o de estudios con fuente (`src/lib/evidence.ts`).

## Lo que ya está hecho

- **Home** (`src/app/page.tsx`): hero con video, laureles con datos reales, "Resultados reales", búsquedas reales + cinta, funciones, evidencia como testimonios (`src/components/landing/EvidenceWall.tsx`), FAQ + cierre + buscador en menta.
- **Landings de producto** con plantilla de jobright: contenido en `src/lib/products.ts`, componentes en `src/components/product/ProductLanding.tsx` (`ProductHero`, `ToolHeading` con `#empezar`, `ProductMore`) y maquetas en `src/components/product/Visuals.tsx`. Usadas por Match, Postulación, CV, Carta, Video, Entrevista y `/extension`.
- **App de búsquedas**: `src/components/app/AppShell.tsx` + `SideNav.tsx`; `/busquedas` (lista, filtros en chips, tarjetas `src/components/busquedas/JobCard.tsx`) y `/busquedas/[id]` (detalle + "Aumentá tus chances"). Lógica en `src/lib/busquedas.ts` y `src/lib/jobFilters.ts`.
- **Traspaso de una búsqueda entre herramientas**: `handoffJob(to, {...})` / `takeHandoff(to)` en `src/lib/match/clientStore.ts` (destinos: postulacion, carta, entrevista, video). Botón cliente: `src/components/busquedas/PrepareJob.tsx`.
- **Video del hero** (`video/intro.html`, render con `scripts/render-intro-video.mjs`, ver README): corregido para no mostrar lo que Maru no hace.
- **Ingreso** (`src/components/auth/LoginDialog.tsx`) y **popup de la extensión** (`extension/popup.*`) al estilo jobright.

- **Seguimiento** (`/seguimiento`): `src/lib/tracker.ts` (localStorage `maru:tracker:v1`, evento `maru:tracker`, tests en `tests/tracker.test.ts`) y tablero `src/components/tracker/TrackerBoard.tsx` (kanban en escritorio, pestañas en celular, notas, estado, carga manual, "Adaptar mi CV" / "Escribir mi carta" / "Practicar la entrevista"). Las tarjetas se crean solas desde Postulación (CV + respuestas), Carta, Match (guardar, preparar, postularme), detalle y lista de búsquedas ("Guardar en mi seguimiento" y "Postularme" → postulada, `src/components/busquedas/TrackJob.tsx`), Entrevista (al terminar el informe) y Video (si la búsqueda vino de Maru o ya estaba en el seguimiento). En menú, barra lateral, footer, home (feature + FAQ) y README.
- **Maru en su escritorio + recorrido** (`src/components/maru/MaruCompanion.tsx`, contenido en `src/components/maru/guide.ts`, frames `DESK_FRAMES` en `sprite.ts`): ya no sigue al mouse. Está sentada en un rincón tipeando con su mate; la primera vez saluda y ofrece un recorrido breve por los 9 productos en modo checklist (se tilda al avanzar o al visitar cada página; "Probarlo" la achica a "Seguimos el recorrido"). Al final, si no sos cliente, la oferta de $10.000/mes. Estado en localStorage `maru:guia:v1`; tocándola, el recorrido vuelve.

## PENDIENTE 0 (decisión del dueño): cobro del plan

- **Link de pago**: la oferta usa `NEXT_PUBLIC_CHECKOUT_URL` (p. ej. una suscripción de Mercado Pago). Sin esa variable, el botón dice "Empezar ahora" (va a `/match`) y aclara que la suscripción se habilita pronto. Configurarla en Vercel y que el pago vuelva a `/?suscripcion=ok`: eso marca "cliente" en el navegador (`maru:cliente`) y la oferta deja de mostrarse. Es una marca local, no un control de acceso: si se quiere limitar funciones a quien paga, hace falta guardar la suscripción del lado del servidor.
- **Coherencia del mensaje**: las landings dicen "Gratis, sin tarjeta" (`FREE` en `src/lib/products.ts`) y el FAQ "Podés usar todo sin cuenta". Con el precio, definir qué es gratis y qué es del plan y ajustar esos textos.

## PENDIENTE 1: Seguimiento, lo que quedó afuera

- **Extensión → seguimiento**: corre en otros dominios y no puede escribir el localStorage de Maru. Opciones: guardar en `chrome.storage` y leerlo con un content script en el dominio de Maru, o abrir `/seguimiento?add=<url>`.
- **Landing con la plantilla** (opcional): agregar `"seguimiento"` a `src/lib/products.ts` y usar `ProductHero` + tablero en `#empezar` + `ProductMore`, como jobright `/tools/job-tracker`.

## PENDIENTE 2: lo que jobright tiene y Maru todavía no

1. **Chat con Maru** (su "Orion"): hoy el panel derecho de `/busquedas` es una guía sin chat (`SidePanel` en `src/app/busquedas/page.tsx`). Si se hace, usar `askStructured`/Claude como el resto de las APIs y reemplazar ese panel.
2. **Testimonios reales**: cuando haya usuarios. Hasta entonces, seguir usando estudios con fuente.
3. **Sincronizar entre dispositivos** (perfil y seguimiento) con la cuenta de magic link: requiere base de datos (hoy no hay).
4. **Extensión en la Chrome Web Store** (hoy se instala desde el .zip de `/extension`).
5. **Logos reales de empresas** en tarjetas (hoy `CompanyTile` con inicial y color).

## PENDIENTE 3: pulido

- Resultados del Match: el encabezado ("Oportunidades para vos" + pestañas) todavía no usa `AppShell`; podría pasar al formato app.
- "¡en menos de 1 minuto!" del hero: armar un CV puede tardar ~1 minuto; evaluar "¡en minutos!".
- Selector "Tengo la búsqueda / Carta espontánea" de los flujos sigue en menta; pasar a blanco/negro como el resto.

## Cómo trabajar en el repo

- Instalar: `npm install`. Correr: `npm run dev`. Chequeos antes de subir: `npx tsc --noEmit -p .`, `npx eslint src --quiet`, `npx vitest run`, `npx next build`.
- Si `vitest` falla en `tests/extension.test.ts` por timeout, suele ser por procesos de Chromium colgados: matarlos y repetir.
- Diseño: tokens en `src/app/globals.css` (menta `bg-sand`, `brand`, `neon` #00f0a0, gris de bloques `#f2f4f5`, fondo app `#f5f6f7`). Botones: negro redondo o neón; tarjetas `rounded-[24px]`; bloques `rounded-[0_80px_80px_80px]`.
- Textos en español rioplatense (vos), claros y verdaderos.
- Deploy: Vercel publica cada rama (preview) y `main` (producción). Flujo usado: rama → PR → esperar el check de Vercel en verde → merge.
- Para comparar con jobright: capturas con Chromium (`/opt/pw-browsers/...` o Playwright) en 1440×900 y 390×844.
