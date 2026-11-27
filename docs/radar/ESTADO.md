# Radar laboral — estado

Traspaso entre sesiones. Lo actualiza cada sesión al terminar.

## Sesión 2 (27/11/2026): fuentes reales e ingestión de vacantes

Misma rama (`claude/youthful-tesla-lw34fr`, reiniciada desde `main` tras el merge de la sesión 1). Primer tramo del flujo con datos reales: **seguir empresa → resolver su fuente → traer sus vacantes reales → verlas como detectadas**. Sin score.

### Qué funciona con datos reales

- **Cliente HTTP seguro** (`src/lib/radar/sources/net.ts`): sólo https, sin credenciales ni puertos raros, SSRF (resuelve DNS y bloquea localhost, redes privadas, link-local y metadata; revalida cada redirect), timeout, tope de bytes, User-Agent `MaruRadarBot/1.0`, reintentos con backoff exponencial y jitter en red, 429 y 5xx (respeta Retry-After hasta 30 s).
- **Adaptadores** (`sources/adapters.ts`), todos validados con Zod: Greenhouse Job Board API (completo según `meta.total`), Lever (US y EU, paginado de a 100; incompleto si se corta), Ashby (oculta `isListed=false`), JSON-LD `JobPosting` con `cheerio` (respeta robots.txt; nunca cuenta como snapshot completo). Reutilizan los normalizadores de Match.
- **Resolución** (`sources/resolve.ts`): link directo del ATS → redirects → ATS enlazado o embebido en la página → board deducido del nombre **sólo si la API lo confirma** (Greenhouse: el nombre del board coincide; Lever/Ashby: el slug coincide con nombre y dominio) → JSON-LD → `manual`. robots.txt se consulta antes de leer la página. Si la página usa un ATS que Radar no lee (Teamtailor, BambooHR, Workday, Rippling…), la nota lo dice.
- **Ingestión idempotente** (`sources/ingest.ts`): unicidad por (fuente, id externo); `content_hash`; nuevas, modificadas, sin cambios; `first_seen_at`/`last_seen_at`; cierre sólo si la fuente lo informa o tras **2 lecturas completas seguidas** sin la vacante; nunca por error, 429, timeout ni snapshot parcial; una caída mayor al 80 % (con 5+ abiertas) queda `partial` hasta repetirse; la reapertura conserva historial. Duplicados entre fuentes de la misma empresa por URL canónica, sin unir roles por título.
- **Estados de fuente:** `pending`, `success`, `verified_empty`, `partial`, `error`, `manual` (reemplazan a los de la sesión 1; no había datos en producción).
- **Corridas** (`monitoring_runs` con sus items): inicio y fin, fuente, intentos, estado, completo o no, leídas, nuevas, modificadas, cerradas, reabiertas y error sanitizado. Lista global (200) y por fuente (20).
- **Worker** (`sources/worker.ts`): lease por fuente (5 min), concurrencia por proveedor (Greenhouse 3, Lever 2, Ashby 2, JSON-LD 1), presupuesto de tiempo por corrida, una sola lectura por fuente aunque la sigan varias personas. Se invoca con «Revisar ahora» (cooldown de 10 min por empresa), con `scripts/radar-monitor.ts` o con `POST /api/radar/worker` (Bearer `RADAR_WORKER_SECRET`). **No hay cron.**
- **UI:** tabla con vacantes activas y última revisión; ficha con estado real de cada fuente, nota, última lectura buena, «Revisar ahora», «Reintentar verificación», agregar otra página de Careers, historial de revisiones y vacantes activas y cerradas; Oportunidades con las vacantes detectadas (fecha de publicación separada de la detección, frescura, «Nueva» desde la última visita, «Ver aviso original», aviso «Sin evaluar») y, aparte y plegado, el piloto con la etiqueta «Piloto 25/11/2026 · vigencia no verificada». Al agregar una empresa con Careers se resuelve y se lee en el momento.

### Validación de Careers (20 empresas, 27/11/2026)

El Sheet real sigue sin estar en el repo: la lista son las P1 del prompt maestro y del prototipo (`SAMPLE` en `scripts/radar-monitor.ts`). Resultado de `npx --yes tsx@4 scripts/radar-monitor.ts`:

| Empresa | Fuente | Board | Estado | Vacantes abiertas | Cómo se resolvió |
|---|---|---|---|---|---|
| Anthropic | Greenhouse | anthropic | success | 634 | Deducido del nombre, confirmado por la API |
| OpenAI | — | — | manual | — | Página sin ATS público ni JobPosting |
| ElevenLabs | Ashby | elevenlabs | success | 109 | Deducido del nombre y dominio, confirmado |
| Supabase | Ashby | supabase | success | 82 | ATS en la página |
| Humand | — | — | manual | — | Usa Teamtailor (sin lector en Radar) |
| The Exploration Company | Ashby | the-exploration-company | success | 125 | ATS en la página |
| Vercel | Greenhouse | vercel | success | 86 | Deducido del nombre, confirmado |
| PostHog | Ashby | posthog | success | 9 | Deducido del nombre y dominio, confirmado |
| Mistral AI | Ashby | mistral.ai | success | 268 | ATS en la página |
| PLD Space | — | — | manual | — | robots.txt no permite leer la página |
| ICEYE | — | — | manual | — | Página sin ATS público ni JobPosting |
| Linear | Ashby | linear | success | 30 | ATS en la página |
| Lovable | Greenhouse | lovable | success | 60 | Deducido del nombre, confirmado |
| Clay | — | — | manual | — | Página sin ATS público ni JobPosting (usaría Rippling) |
| n8n | Ashby | n8n | success | 77 | ATS en la página |
| Stripe | Greenhouse | stripe | success | 768 | Deducido del nombre, confirmado |
| NotCo | — | — | error | — | La URL de ejemplo da 404 (hay que corregir el link) |
| Satellogic | — | — | manual | — | Usa BambooHR (sin lector en Radar) |
| Mercado Libre | — | — | manual | — | Página sin ATS público ni JobPosting |
| Ualá | — | — | error | — | La URL de ejemplo da 404 |

**Corrida real** (local, base en memoria, sin escribir en Upstash): 20 fuentes en 19 s; 11 con vacantes, 7 manual, 2 error; **2.248 vacantes nuevas**. Segunda corrida sobre las mismas 13 fuentes no manuales: 0 nuevas, 0 modificadas, 0 cerradas (idempotente). En la prueba de la UI (Supabase, Vercel, Linear, Humand, PLD Space) aparecieron 198 vacantes en Oportunidades.

### Decisiones

- Las fuentes, las vacantes y las corridas son **globales** (`maru:radar:v1:sources:*`, `jobs:<sourceId>`, `jobdesc:<jobId>`, `runs`, `source-runs:*`); lo privado sigue por `uid`. El worker recorre `maru:radar:v1:followed` (empresas que alguien siguió; no guarda quién).
- Índice de vacantes por fuente sin descripciones (las descripciones, hasta 4.000 caracteres de texto plano, van en una key por vacante y sólo se escriben si cambió el hash).
- Board deducido del nombre: se acepta sólo con confirmación de la API (ver arriba). Es lo que más sumó cobertura (6 de 11), pero puede equivocarse con empresas homónimas: la ficha muestra la nota «Board deducido del nombre…».
- JSON-LD nunca cierra vacantes (una página puede mostrar sólo una parte).
- «Revisar ahora» corre la lectura en el pedido (hasta 25 s, `maxDuration` 60). Para muchas empresas a la vez está el worker.

### Configuración nueva

| Variable | Dónde | Para qué |
|---|---|---|
| `RADAR_WORKER_SECRET` | Opcional (24+ caracteres) | Habilita `POST /api/radar/worker`. Sin ella, la ruta responde 401. |

### Riesgos y bloqueos

- Siguen los de la sesión 1: falta `research-laboral.xlsx` (la validación usó 20 empresas de ejemplo) y Preview no tiene `AUTH_SECRET`.
- **Volumen en Upstash:** la primera lectura de Stripe o Anthropic escribe 600-800 descripciones (comandos y espacio). Con muchas empresas grandes conviene medir el consumo del plan antes de prender un cron.
- Oportunidades lee los índices de todas las fuentes seguidas en cada visita (≈1 MB con Stripe + Anthropic). Bien para el rollout; después, paginar o precalcular.
- Teamtailor, BambooHR, Workday y Rippling no tienen lector en Radar (Match sí tiene conectores de Teamtailor y BambooHR: se pueden sumar).
- `tests/extension.test.ts` sigue fallando en este contenedor (también en `main`).

### Para la sesión 3

- El contrato de vacante es `JobOpening` (`src/lib/radar/types.ts`); la descripción está en `JobRepo.readDescription(jobId)`; el `contentHash` sirve como `job_hash` para no re-evaluar lo que no cambió.
- Oportunidades ya separa detectadas (reales) y piloto (histórico): el score se suma a las detectadas.

## Sesión 1 (27/11/2026): auditoría, persistencia y MVP visual

Rama `claude/youthful-tesla-lw34fr` (la convención del entorno manda sobre `feat/radar-laboral-s1`). Documentos: `AUDITORIA.md`, `ADR-001-persistencia.md`.

### Qué funciona

Todo detrás de `RADAR_ENABLED`. Con persistencia real en Upstash (keys `maru:radar:v1:*`), probado con la base en memoria en local y en tests:

- **Navegación:** «Radar laboral» debajo de Match en la barra lateral y en el menú de celular. Rutas `/radar/empresas`, `/radar/oportunidades`, `/radar/descubrimiento`, `/radar/automatizacion` con subnav desplazable (`/radar` redirige a empresas).
- **Mis empresas:** resumen (P1, P2, por clasificar con P3, fuentes con error y pendientes), filtros combinables (sector, prioridad, región, texto, estado de la fuente, archivadas), tabla en desktop y cards en celular, prioridad editable en la fila, orden manual con ↑/↓ dentro de cada prioridad, ficha en panel lateral (datos del catálogo, identidad, fuentes, notas, prioridad, archivar/reactivar, dejar de seguir), estados vacío, cargando, error y sin sesión.
- **Agregar empresa:** búsqueda en el catálogo global o alta con nombre, dominio, Careers y sector. El link se valida (sólo http/https, sin IP ni localhost) y queda «pendiente de verificar». No se hace ningún pedido a la página.
- **Importar empresas (XLSX/CSV):** parseo en el servidor con `jszip` + `cheerio` (ya estaban en el repo; sin dependencias nuevas). Vista previa con secciones por pestaña, mapeo de columnas editable, sector por pestaña, fusiones, conflictos, errores por fila y lista de empresas; confirmación. Dedup por dominio (o nombre exacto si no hay dominio), conserva todas las etiquetas de sector, completa campos vacíos y nunca pisa prioridad, notas, orden ni archivo. `JOB OPENINGS · PILOTO` se guarda como vacantes históricas por persona (`maru:radar:v1:u:<uid>:pilot`); `COBERTURA DEL PILOTO` se ignora. Idempotente.
- **Automatización:** guarda y lee `user_radar_settings` (radar activo, frecuencia por prioridad, zona horaria IANA, día y hora del resumen, alertas P1 con umbral, canales, pesos que suman 100). No ejecuta nada y lo dice.
- **Oportunidades y Descubrimiento:** layout y estados vacíos honestos.

### Qué sigue en fixture

- **No hay datos reales del Sheet.** Faltan `research-laboral.xlsx` y las capturas del prototipo (bloqueo abajo). La fixture está en `tests/fixtures/radar/research-laboral.ts`: los encabezados del prompt maestro, tres pestañas, LatAm/Global, empresas repetidas entre sectores, vacantes del piloto y cobertura. Sólo la usan los tests y las capturas locales; nunca se cargó en Upstash.
- Las capturas `docs/radar/capturas/s1-*.png` son de local con esa fixture.

### Decisiones

- **Persistencia:** sólo Upstash (ADR-001). Las pantallas y rutas usan `src/lib/radar/repo` (`CompanyRepo`, `CompanySourceRepo`, `TargetCompanyRepo`, `RadarSettingsRepo`, `PilotJobRepo`, `ImportRunRepo`).
- **Keys:** `maru:radar:v1:*` y no `radar:v1:*` a secas, porque la base se comparte con otras apps y todo lo de Maru va bajo `maru:`.
- **Identidad:** `d:<dominio registrable>` sacado de la web o del Careers (salvo hosts de ATS y portales: Greenhouse, Lever, Ashby, etc.), o `s:<slug>` como identidad provisoria. Una empresa sin dominio se une a otra sólo si el nombre es exactamente igual y hay una sola con ese nombre; si una provisoria recibe dominio después, se le suma. Nunca por parecido de nombre.
- **Aislamiento:** el `uid` es `userId(email)` de `src/lib/sync/server.ts`, sacado de la cookie firmada en `radarRoute` (`src/lib/radar/http.ts`). Ninguna ruta acepta un id de usuario.
- **Prioridad:** una sola por persona y empresa, independiente del sector. Las importadas entran «por clasificar»; las notas del Sheet pasan a la nota personal sólo si la empresa es nueva en la lista.
- **Dejar de seguir** borra prioridad y notas de esa empresa; **archivar** las conserva. Ninguno toca Seguimiento.
- **Flag en el cliente:** `next.config.ts` copia `RADAR_ENABLED` a `NEXT_PUBLIC_RADAR_ENABLED` en el build. Apagado, la navegación no hace ningún pedido; prendido, consulta `/api/radar/estado` (allowlist).

### Configuración

| Variable | Dónde | Para qué |
|---|---|---|
| `RADAR_ENABLED=true` | Local (y Preview si hace falta) | Prende Radar. **No cargar en Production.** Hace falta un build nuevo para que aparezca en la navegación. |
| `RADAR_ALLOWLIST` | Opcional | Emails separados por coma. Con el flag prendido, sólo esas cuentas ven Radar; el resto recibe 404. |

Probar en local: `RADAR_ENABLED=true npm run dev` (sin variables de Upstash usa la memoria). Ojo: esa memoria se pierde cuando `next dev` recompila una ruta; para probar persistencia, abrir antes todas las pantallas una vez.

### Riesgos y bloqueos

- **Bloqueo: faltan `research-laboral.xlsx` y `capturas/` del prototipo.** El dueño tiene que exportar el Sheet (Archivo → Descargar → .xlsx) y subirlo a `docs/radar/`, o importarlo desde la pantalla. Hasta entonces, el importador está probado sólo con la fixture: los encabezados reales pueden diferir (el mapeo es editable en la vista previa).
- **Preview sin login:** `AUTH_SECRET` sólo existe en Production en Vercel, así que en Preview no se puede ingresar y Radar no se puede probar con sesión ahí. Para probar en Preview hay que cargar `AUTH_SECRET` (y `GOOGLE_CLIENT_*` si se usa Google) también en Preview.
- **Preview y Production comparten Upstash.** Prender el flag en Preview escribe `maru:radar:v1:*` reales en la base de producción (sólo aditivo, con cuentas reales).
- **Catálogo global escrito por usuarios** y merge sin CAS por empresa (ver ADR). Aceptado para el rollout con allowlist.
- La búsqueda en el catálogo y la importación cargan el catálogo entero: bien hasta unas miles de empresas.
- Los tests de `tests/extension.test.ts` (Chromium real) fallan en este contenedor también en `main`; no tienen que ver con Radar.

### Para la sesión 2

- Leer este archivo, `AUDITORIA.md` y `ADR-001-persistencia.md`.
- Si el dueño subió `research-laboral.xlsx`, importarlo **en local** y revisar el mapeo automático contra los encabezados reales; ajustar `COMPANY_SYNONYMS` / `JOB_SYNONYMS` en `src/lib/radar/importer.ts` si hace falta.
- Las fuentes quedan registradas en `maru:radar:v1:sources:<companyId>` con `provider` y `externalBoardId` detectados del link (sin red). Para el crawling reutilizar `src/lib/match/connectors.ts` y `assertPublicUrl`/`safeFetch` de `src/lib/match/http.ts`.
- Las vacantes del piloto están en `PilotJobRepo` con `companyId` resuelto cuando el nombre coincide con una sola empresa.
- «Revisar ahora», «Ver historial», las columnas de vacantes y última revisión están en la UI como placeholders deshabilitados.
