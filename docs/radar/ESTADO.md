# Radar laboral — estado

Traspaso entre sesiones. Lo actualiza cada sesión al terminar.

## 28/11/2026: rollout para el dueño y alta por nombre

- **Production:** `RADAR_ENABLED=true` y `RADAR_ALLOWLIST` (sólo la cuenta del dueño). Cualquier otra visita recibe 404.
- **Agregar empresa por nombre:** desplegable con catálogo + sugerencias de Haiku (`GET /api/radar/empresas/sugerir`, caché por texto, 120 por día y persona). Elegir una sugerencia crea la empresa con su dominio y la completa (`enrichCompany`): dominio verificado en el sitio (el título u `og:site_name` tienen que nombrar a la empresa), descripción tomada del sitio, ATS por link propuesto o por nombre (confirmado por la API), sede/etapa/tamaño de la IA marcados «estimado por IA, sin verificar», nunca pisa datos. Botón «Completar ficha» en la ficha (una vez por hora por empresa). Sin clave de IA sigue funcionando la búsqueda del ATS por nombre.

## Sesión 4 (27/11/2026): automatización, alertas, descubrimiento, analytics y QA

Pasos de rollout, rollback, variables y costos en **`ROLLOUT.md`**. **El flag sigue apagado en Production.**

### Qué funciona

- **Scheduler:** cron de Vercel `/api/cron/radar` (diario, 10:23 UTC; `CRON_SECRET`). Tres fases separadas e idempotentes: **crawl** (sólo fuentes vencidas por `nextDueAt`, con la frecuencia mínima entre las personas activas que siguen la empresa), **match** (lo nuevo o cambiado de cada persona con Radar activo, perfil leído de su cuenta) y **entrega**. Con `RADAR_ENABLED` apagado responde `{ skipped: "flag" }` sin tocar nada. Lock de 15 min contra corridas simultáneas. `?phase=` corre una sola.
- **Notificaciones** (`src/lib/radar/notify.ts`): outbox con claves idempotentes `(persona, vacante, alerta)` y `(persona, resumen, semana ISO)`; avisos in-app (panel en Oportunidades y badge en el subnav); alerta inmediata para P1 con match ≥ umbral, elegible, que encaja y al día; resumen semanal (día, hora y zona IANA; si el cron llega tarde, hasta 48 h después) con top 5, nuevas, cerradas, fuentes con error y cobertura. Lo que ya llegó como alerta aparece «(ya te avisamos)» y no cuenta como nuevo. Email por Resend sólo con consentimiento (el email se guarda aparte sólo si lo acepta y se borra al desactivarlo), con baja en un clic (`/api/radar/baja`, token firmado; el GET no cambia nada). Reintentos de email sin duplicar el aviso in-app (hasta 3). Pausar cancela lo pendiente. Nada de WhatsApp.
- **Automatización:** estado real (última ejecución, fuentes al día sobre esperadas, con error, próximo ciclo), «Revisar ahora» para todas las empresas (cada 30 min) e historial de corridas. Consentimiento explícito para email.
- **Descubrimiento:** hasta 10 empresas por semana (fijas durante la semana ISO) del catálogo que la persona no sigue ni rechazó, por afinidad de sector (pesada por prioridad, menos lo rechazado) y vacantes de su área en fuentes ya leídas. Motivo concreto; señales sólo con fuente y fecha, si no «pendiente de verificación». `+P1`, `+P2` y «No me interesa», idempotentes y guardados.
- **Analytics:** había capa de tracking (PostHog en el navegador). `src/lib/radar/analytics.ts` manda los eventos de §6 con propiedades en lista blanca (ids internos, sector, prioridad, proveedor, cantidades, banda de score, `source=radar`). `radar_digest_delivered` y el detalle de las corridas del cron quedan sólo en el log del servidor (no hay PostHog del lado del servidor).
- **Arreglo de identidad:** agregar a mano una empresa con un link de ATS (sin dominio) ahora usa la del catálogo si hay una sola con el mismo nombre exacto (antes duplicaba Linear).

### QA

- Navegador (local, flag prendido): las cuatro pantallas en 1360 px y 380 px sin scroll horizontal, sin errores de consola; foco visible con teclado en el subnav; estados vacío, cargando, error y desactualizado. Cron disparado a mano dos veces: la segunda no leyó fuentes ni evaluó de nuevo ni duplicó avisos.
- Capturas finales: `docs/radar/capturas/s4-*.png`.

### Configuración nueva

Ver `ROLLOUT.md`. Nuevas: entrada en `vercel.json` (`/api/cron/radar`), `RADAR_FROM` opcional.

### Riesgos y bloqueos abiertos

- **Secret `ANTHROPIC_API_KEY` de GitHub inválido** (401): la evaluación real con IA y su costo quedan pendientes (`radar-eval`).
- **Falta el export del Sheet** (`research-laboral.xlsx`) y las capturas del prototipo.
- **Preview sin `AUTH_SECRET`**: no se puede ingresar en Preview.
- **Plan de Vercel desconocido:** el cron quedó diario; con Pro conviene pasarlo a horario (`ROLLOUT.md`).
- Los de las sesiones anteriores (volumen en Upstash, board deducido, detección de país por texto).

### Para quien siga

El kit de 4 sesiones está completo. Lo que queda es del dueño (ver «Rollout» en `ROLLOUT.md`) y mejoras posibles: lectores de Teamtailor y BambooHR (Match ya tiene conectores), cron horario si el plan lo permite, PostHog del lado del servidor para los eventos del cron.

## Sesión 3 (27/11/2026): match de rol, Oportunidades y Seguimiento

Cierra el flujo **seguir empresa → vacante real → evaluación → guardar en Seguimiento**. Decisión de diseño en `ADR-002-match.md`: scorer propio `radar-match@1` que reutiliza las reglas de Match (`extract`, `fit.ts`, `salaryFromText`) y `askStructured`; `/match` no cambia.

### Qué funciona

- **Perfil:** el CV y las preferencias que la persona ya cargó en Match (documento `match` sincronizado con su cuenta). Sin perfil, «Evaluar» pide cargarlo en Match. Ningún perfil hardcodeado (el de prueba está sólo en `scripts/radar-eval.ts` y en los tests).
- **Elegibilidad declarada** en Automatización: países donde puede trabajar (o «Unión Europea»), relocalización, modalidad y mínimo mensual en USD. Nada se infiere: si no lo declaró, la vacante queda «por verificar».
- **Gates por reglas** (`src/lib/radar/match/eligibility.ts`): `blocked` (presencial en un país no declarado y sin relocalización, ciudadanía o clearance, pedido explícito de permiso de un país no declarado, presencial cuando pidió sólo remoto) y `needs_verification` (país o región sin declarar, ubicación desconocida, remoto restringido). Un bloqueo nunca se compensa.
- **Preclasificación sin IA:** función distinta, nivel fuera de rango o bloqueo → evaluada por reglas, marcada «No encaja» (tope 30/100), sin prioridad de acción y fuera de «Para considerar». No gasta IA.
- **Score** con cinco criterios, evidencia y `known/unknown`, renormalizado sobre lo conocido, con cobertura y confianza; pesos de Automatización.
- **IA** (Haiku, de a 5 vacantes, 3 en paralelo, tope de 30 por pedido y cupo de 150 por día y persona con `RADAR_DAILY_EVALS`): competencias, nivel si era dudoso, salario publicado, excluyentes, fortalezas, brechas, desconocidos, razón, barrera y siguiente paso. Aviso como contenido no confiable; perfil sin nombre, contacto, ciudad ni permisos.
- **No recalcula** si no cambian `scoring_version`, `profile_hash` ni `job_hash`. Si la IA falla queda el resultado anterior «desactualizado»; si no había, «sin evaluar».
- **Prioridad de acción** al leer, con tope 69 si falta verificar y 59 con confianza baja; muestra el porqué. Se aclara que no es una probabilidad.
- **Oportunidades:** resumen (nuevas, prioridad alta, empresas revisadas, última actualización), filtros (estado: para considerar, por verificar, bloqueadas, no encajan, sin evaluar, guardadas, descartadas; sector; prioridad de empresa; match mínimo; nuevas; remoto; texto), orden por prioridad de acción, match o novedad, cards con score, razón, barrera, elegibilidad y frescura. **Detalle** con desglose y evidencia, fortalezas, brechas, excluyentes, desconocidos y siguiente paso.
- **Seguimiento:** «Guardar» usa `upsertTracked` del modelo existente: una sola tarjeta por URL, en «Guardada», nunca retrocede ni postula. El estado se lee de Seguimiento (si la persona la mueve a «Postulada», Radar lo muestra). Si una vacante guardada cierra, Oportunidades avisa y la tarjeta no cambia.
- **Descartar** es personal (no toca la vacante global) y se conserva al re-evaluar.
- **Adaptar CV, Carta y Entrevista** abren las herramientas existentes con la vacante y su descripción precargadas (`handoffJob`).

### Ejecución real

- **Bloqueo: el secret `ANTHROPIC_API_KEY` de GitHub es inválido.** El workflow `radar-eval` corrió dos veces el 27/11 (en `main` y en la rama) y todas las llamadas a la IA respondieron **401 `invalid x-api-key`** (0 tokens, US$0). Afecta también a `match-eval`. Hay que cargar una clave válida en GitHub → Settings → Secrets and variables → Actions → `ANTHROPIC_API_KEY` (la de Vercel se actualizó el 19/11) y volver a correr `radar-eval` desde Actions. En este contenedor no hay clave (por regla, sólo como secret o variable de Vercel).
- **Parte determinística con datos reales** (corrida en GitHub Actions, 7 empresas P1 de ejemplo, perfil de prueba Growth/GTM, Argentina declarada, mínimo USD 6.000): 7 fuentes leídas sin errores, **452 vacantes abiertas**; **285 no encajan por reglas** (función o nivel; 63 %, sin gastar IA); **5 bloqueadas** (por ejemplo, presencial en un país no declarado sin relocalización, o ciudadanía exigida); **220 por verificar** entre las evaluadas (sobre todo remotos restringidos a EMEA, EE. UU. o AMER y ubicaciones sin país); 167 quedan para la IA. El top 5 con desglose queda pendiente de la clave.
- En la UI local con Supabase + Linear: 112 vacantes, 100 «no encajan», 12 para evaluar con IA.

### Costo (estimado; se confirma con la corrida real)

Haiku 5.5 (US$0,10 por millón de entrada y US$0,50 de salida, según `PRICES` de `claude.ts`). Cada vacante va con ~3.000 caracteres de aviso más el perfil (≈ 1.200 tokens de entrada por vacante en tandas de 5) y devuelve ≈ 350 tokens: **≈ US$0,0003 por vacante**. Con 7 empresas P1, ~15 % de vacantes nuevas o modificadas por semana y ~37 % que pasa las reglas: ~25 evaluaciones, **≈ US$0,01 por usuario activo por semana**. La revisión editorial puede sumar una llamada corta por tanda.

### Decisiones

- `radar-match` propio (ADR-002). `scoring_version` = `radar-match@1/p1`.
- La prioridad de acción no se guarda: depende de la prioridad de la empresa y de la novedad, que cambian sin re-evaluar.
- La fuente de verdad de «guardada» es Seguimiento; Radar sólo guarda «descartada».
- Matches por persona y empresa: `maru:radar:v1:u:<uid>:matches:<companyId>`.

### Configuración nueva

| Variable | Dónde | Para qué |
|---|---|---|
| `RADAR_DAILY_EVALS` | Opcional (por defecto 150) | Evaluaciones con IA por persona y día. |
| `RADAR_IA=off` | Opcional | Apaga la IA de Radar (sólo reglas). |

### Riesgos

- Las reglas de función usan `familyFromTitle` sobre los cargos del CV: un perfil con cargos de varias áreas deja pasar más vacantes a la IA (más costo, no peores resultados).
- La detección de país es por texto («Remote, EMEA», ciudades conocidas): lo que no reconoce queda «por verificar», nunca bloqueado.
- Seguimiento vive en el navegador (y en la cuenta si hay sesión): la marca «En Seguimiento» se ve en el navegador donde se guardó hasta que sincroniza.

### Para la sesión 4

- Scheduler: `runMonitoring` (sesión 2) + `evaluateForUser` (sesión 3); los dos son idempotentes. Las alertas pueden partir de `actionPriority(...).band === "alta"` y `eligibility === "eligible"`.
- Analytics: no hay eventos de Radar todavía.

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
