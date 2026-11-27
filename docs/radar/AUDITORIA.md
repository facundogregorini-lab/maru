# Auditoría para Radar laboral (sesión 1, 27/11/2026)

Revisión del repo en `main` (`4dbb1d9`) antes de diseñar el módulo. Lo que sigue es lo que existe hoy, no lo que propone el prompt maestro.

## Rutas y layout

- App Router de Next.js 15. Cada herramienta tiene su carpeta en `src/app/<ruta>/page.tsx`: `busquedas`, `match`, `cv`, `postulacion`, `carta`, `entrevista`, `video`, `seguimiento`, `recruiters`, más las legales y la landing.
- Las pantallas "de app" usan `src/components/app/AppShell.tsx` (componente de servidor): barra lateral fija de 72 px con íconos (`lg:` en adelante), header blanco sticky de 64 px con el título en mayúsculas, fondo `#f5f6f7`, panel derecho opcional. Hoy lo usan Búsquedas, Match y Seguimiento.
- La barra lateral es `src/components/app/SideNav.tsx` (cliente): una lista fija `ITEMS` con `href`, `label` y un SVG de 24×24 a trazo (1,7). No hay librería de íconos: son paths propios. Orden actual: Búsquedas, Match, CV, Postular, Carta, Entrevista, Video, Seguimiento, Extensión.
- En celular la barra lateral se oculta y aparece la hamburguesa `NavMenu` (`src/components/NavPills.tsx`), que lista `NAV` de `src/components/nav.ts`.
- **Dónde va Radar:** un ítem más en `SideNav`, entre Match y CV, y una entrada en `NavMenu`, las dos sólo con el flag prendido. Las pantallas van en `src/app/radar/*` con un `layout.tsx` que usa `AppShell` y agrega el subnav.

## Sistema de diseño

- Tokens en `src/app/globals.css` (`@theme` de Tailwind v4): `neon #00f0a0` (CTA estrella; es el "verde Maru"), `neon-deep #00d795`, `forest #1c8d4d`, `ink #000`, `muted #5c6066`, `line #e8eaec`, `surface #f2f4f5`, `surface-3 #f5f6f7` (fondo de app), `danger`, `warning`, `honey`, sombras `shadow-card`, `shadow-pop`, `shadow-nav`, radio de botón `28px`.
- Tipografía: Inter (`font-sans`) y Titillium Web (`font-display`).
- Cards de app: `rounded-2xl bg-white` con `ring-1 ring-black/[0.06]` o borde `border-line`; radios de 12 a 24 px.
- Componentes reutilizables en `src/components/ui.tsx`: `PrimaryButton` (negro), `ErrorBanner`, `inputClass`, `Chips`, `post()` (que ya maneja `AUTH_REQUIRED` abriendo el ingreso con Google). `ScoreRing` para puntajes. **No hay** drawer, tabs ni toasts genéricos: Radar trae los suyos en `src/components/radar/` siguiendo esos tokens.
- Botones de acción: píldora negra (`bg-ink text-white`) para la acción principal; `bg-neon` para el CTA estrella.

## Auth

- Login con Google, sin base: `src/lib/auth.ts` firma una cookie `maru_session` (HMAC con `AUTH_SECRET`, 180 días).
- En una ruta de API: `sessionEmail(req)` devuelve el email o `null`. El identificador interno es `userId(email)` de `src/lib/sync/server.ts`: sha256 del email normalizado, 32 hex. Radar usa ese mismo `userId` para sus keys, así no aparece el email en la base.
- En un componente de servidor no hay helper: hay que leer la cookie con `cookies()` de `next/headers` y pasarla por `verifySessionToken`.
- `AUTH_SECRET` existe sólo en Production en Vercel. En Preview `secret()` tira error (porque `NODE_ENV=production`), así que **el login no funciona en los deploys de Preview**. Es un bloqueo para probar Radar con sesión en Preview.

## Persistencia (Upstash)

- `src/lib/db.ts`: cliente REST propio (`pipeline`), con un mapa en memoria cuando no hay variables y no es producción (desarrollo y tests). Helpers: `getManyJson`, `setJson`, `setIfAbsent`, `compareAndSetJson` (Lua, con `updatedAt` como versión), `setAdd/setMembers`, `pushRecent/readRecent`, `takeCounter`.
- La memoria soporta GET, SET, MGET, EXISTS, LPUSH, LTRIM, LRANGE, SADD, SREM, SMEMBERS, INCRBY, EXPIRE, DEL. **No soporta sorted sets ni hashes.**
- Convención de keys: todo empieza con `maru:` porque la base se comparte con otras apps (`maru:u:<userId>:<doc>`, `maru:talento:*`, `maru:recruiters:*`, etc.).
- **Preview y Production comparten la misma base.** En Vercel, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_URL` y `KV_REDIS_URL` tienen target `preview` y `production`, con el mismo store de la integración (`store_L0VfvywgvTbKvk5U`). Consecuencia: nada de fixtures ni tests contra Upstash; los tests corren con la memoria.

## Módulo Match

- Contrato en `src/lib/match/types.ts`: `NormalizedPosting` (lo que devuelve un conector), `StoredPosting` (con `contentHash`, `firstSeenAt`, `lastSeenAt`, `lastVerifiedAt`, `missedCompleteSyncs`, `status: abierta|cerrada`), `Opportunity` (canónica, agrupa publicaciones), `SyncRun`, `BoardState`.
- Conectores en `src/lib/match/connectors.ts` (Greenhouse, Lever, Ashby, Workable, Teamtailor, SmartRecruiters, Breezy, BambooHR, Recruitee, HiringRoom, Remotive, Jobicy, etc.); HTTP con reintentos y anti-SSRF en `src/lib/match/http.ts` (`assertPublicUrl`, `safeFetch`, `isPrivateAddress`).
- Directorio de empresas en `data/match/companies.json` (`name`, `sourceId`, `slug`, `sector`, `evidence`, `status`). El inventario vive en archivos JSON (`data/match/inventory*.json`) que commitea el workflow `match-sync` (diario, 06:17 ART) y `match-weekly` (lunes 07:00 vía cron de Vercel → `workflow_dispatch`). No está en Upstash.
- Score: `rankOpportunities` en `src/lib/match/ranking.ts` devuelve `RankedItem` con `score` 0–100 ("compatibilidad estimada"), `confidence` y elegibilidad (`elegible | por_confirmar | no_elegible`). Re-evaluación con IA en `rerank.ts`. El perfil y las preferencias del match viven en el navegador (y se sincronizan como doc `match`).
- Para Radar (sesiones 3 y 4): los conectores y `http.ts` se reutilizan tal cual; el ranking también, con un adaptador de vacante.

## Módulo Seguimiento

- `src/lib/tracker.ts`: `TrackItem { id, title, company, jobUrl, jobText?, status, artifacts, notes, createdAt, updatedAt }`, estados `guardada | postulada | entrevista | oferta | descartada`.
- Vive en `localStorage` (`maru:tracker:v1`) y con sesión se sincroniza a `maru:u:<userId>:tracker` por `/api/sync` (compare-and-set y merge por tarjeta).
- Una tarjeta se crea con `upsertTracked(input)` / `upsertInto(items, input)`: deduplica por id, URL normalizada o puesto+empresa, y nunca hace retroceder el estado. Eso es justo lo que necesita "Guardar" de Radar (sesión 4): una sola tarjeta aunque se guarde dos veces.

## CV, IA y resto

- CV: `src/lib/cv.ts`, `cvSource.ts` (PDF con `unpdf`, DOCX con `mammoth`), perfil en `profileStore.ts` (navegador).
- IA: `src/lib/claude.ts`, `@anthropic-ai/sdk` con salida Zod (`betaZodOutputFormat`), `askStructured` aplica la política de escritura (`docs/ESCRITURA.md`). Modelos por nivel: `rapido` (Haiku 5.5) y `redaccion` (Sonnet 5.5), configurables por env.
- Scripts de `package.json`: `dev`, `build`, `lint` (`eslint`), `test` (`vitest run`), y los `match:*`. CI (`.github/workflows/ci.yml`) corre lint, test y build en cada PR. No hay E2E.
- Tests: ~80 archivos en `tests/`, entorno node, alias `@` → `src`. Las rutas de API se prueban llamando a `GET/POST` con un `Request` y la cookie firmada (ver `tests/sync.test.ts`).
- `vercel.json`: `ignoreCommand` y tres crons (`/api/cron/semanal`, `/api/cron/alertas`, `/api/cron/secuencias`), protegidos con `CRON_SECRET`.
- Rate limit por IP en `src/middleware.ts` para las rutas de IA.
- Analytics: PostHog en el cliente (`src/lib/tracking/posthog.ts`, `capture`) y `NEXT_PUBLIC_POSTHOG_KEY` en Production. Radar lo suma en la sesión 4.
- Librerías ya instaladas útiles para Radar: `jszip` (leer el XLSX, que es un zip), `cheerio` (XML del XLSX y HTML de Careers), `zod`.

## Qué se reutiliza y qué falta

| Se reutiliza | Falta (lo agrega Radar) |
|---|---|
| `AppShell`, tokens, `inputClass`, `ErrorBanner`, `post()` | Subnav, drawer, toasts y tabla/cards de Radar |
| `sessionEmail`, `userId`, `verifySessionToken` | Gate de flag + allowlist (`RADAR_ENABLED`, `RADAR_ALLOWLIST`) |
| `db.ts` (pipeline, CAS, sets, memoria para tests) | Repositorio `radar` con interfaces y keys `maru:radar:v1:*` |
| `jszip` + `cheerio` | Parser XLSX/CSV del Sheet con secciones y mapeo |
| Conectores y `http.ts` de Match (sesión 3) | Registro de fuentes por empresa (`company_sources`) |
| `rankOpportunities` (sesión 4) | Ajustes de Radar (`user_radar_settings`) |
| `upsertInto` de Seguimiento (sesión 4) | Catálogo global de empresas con identidad por dominio |
