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

## PENDIENTE 1 (prioridad alta): Seguimiento de postulaciones (`/seguimiento`)

Es el "Job Tracker" de jobright y lo que cierra la suite. Hacerlo simple (ley de Gall): **todo en el navegador (localStorage)**, como el perfil; sin base de datos.

### Modelo (crear `src/lib/tracker.ts`)
```ts
type TrackStatus = "guardada" | "postulada" | "entrevista" | "oferta" | "descartada";
type TrackItem = {
  id: string;            // id del inventario si existe; si no, hash del jobUrl o de puesto+empresa
  title: string; company: string;
  jobUrl: string;        // link del aviso
  jobText?: string;      // texto del aviso (sirve para mandar a entrevista/carta con handoffJob)
  status: TrackStatus;
  artifacts: { kind: "cv" | "respuestas" | "carta" | "entrevista" | "video" | "extension"; at: number }[];
  notes: string;
  createdAt: number; updatedAt: number;
};
```
- Guardar con `load`/`save` de `src/lib/storage.ts` bajo una clave tipo `maru:tracker:v1`.
- Funciones: `listTracked()`, `upsertTracked(partial & {artifact?})` (deduplica por id o jobUrl; no baja de estado salvo que se pida), `setStatus(id, status)`, `setNotes`, `removeTracked`.
- Disparar `window.dispatchEvent(new Event("maru:tracker"))` al cambiar, para refrescar la vista.
- Agregar tests en `tests/tracker.test.ts` (stub de `window.localStorage` con un Map).

### Dónde se crean las tarjetas solas (puntos exactos encontrados)
- **Postulación** — `src/components/Flow.tsx`, en `generate()` después de `setGeneration(g)` (~línea 172): `upsertTracked({ title: analysis.puesto, company: analysis.empresa, jobUrl, jobText, status: "guardada", artifact: "cv" })` y también artifact `"respuestas"`.
- **Carta** — `src/components/carta/CartaFlow.tsx`, en `write()` después de `setCarta(c.carta)` (~línea 137): `upsertTracked({ title: c.carta.puesto, company: c.carta.empresa, jobUrl, artifact: "carta" })` (sólo en modo "busqueda"; en espontánea usar empresa).
- **Match** — `src/components/match/Results.tsx`: en `save(item)` (~línea 80) al guardar → `upsertTracked({ id: item.id, ..., status: "guardada" })`; en `prepare()` del card → igual.
- **Detalle de búsqueda** — `src/app/busquedas/[id]/page.tsx`: agregar un botón cliente "Guardar en mi seguimiento" (y que "Postularme ↗" marque `postulada`, con un componente cliente que haga `upsertTracked` en el `onClick` antes de abrir el link).
- **Entrevista / Video**: al terminar, artifact `"entrevista"` / `"video"` si vinieron con una búsqueda (handoff).
- **Extensión**: corre en otros dominios, no puede escribir el localStorage de Maru. Opción futura: que la extensión guarde en `chrome.storage` y la web lo lea con un content script en el dominio de Maru, o abrir `/seguimiento?add=<url>`. Dejar para después.

### Página `/seguimiento`
- `src/app/seguimiento/page.tsx` usando `AppShell` (título "SEGUIMIENTO") y un componente cliente `src/components/tracker/TrackerBoard.tsx`.
- Tablero tipo kanban como el de jobright: columnas Guardadas · Postuladas · Entrevista · Oferta · Descartadas, con contador; en celular, pestañas.
- Tarjeta: `CompanyTile`, puesto, empresa, fecha, chips de lo que armó (CV a medida, carta…), selector de estado, notas, link al aviso, borrar.
- Acciones por estado: en "Entrevista" → botón "Practicar la entrevista" (`handoffJob("entrevista", …)` y `router.push("/entrevista#empezar")`); en "Guardada" → "Adaptar mi CV" (`handoffJob("postulacion", …)`).
- Estado vacío con CTA a `/busquedas` y `/match`.
- Sumar al menú: `src/components/nav.ts` (`NAV` y `TOOLS`), `src/components/app/SideNav.tsx` (ícono "Seguimiento"), footer en `src/components/SiteShell.tsx`.
- Opcional: landing con la plantilla (agregar `"seguimiento"` a `src/lib/products.ts`, copiar el patrón de las otras páginas: `ProductHero` + tablero en `#empezar` + `ProductMore`). Jobright: `/tools/job-tracker` ("STAY ON TOP OF YOUR APPLICATIONS WITH JOB TRACKER", tarjetas con estado Applied / Rejected / Offer Received).
- Actualizar la home (`src/app/page.tsx`) y el README con el producto nuevo. En el FAQ aclarar que el seguimiento vive en el navegador.

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
