# Radar laboral — estado

Traspaso entre sesiones. Lo actualiza cada sesión al terminar.

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
