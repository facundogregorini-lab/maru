# Sesión 1 — Auditoría, persistencia y MVP visual del Radar laboral

Actuá como senior product engineer y product designer de Maru. Antes de empezar, leé `docs/radar/_REGLAS_COMUNES.md` y cumplilo durante toda la sesión. Cubrís las **etapas 0, 1 y 2** de `docs/radar/PROMPT_MAESTRO.md`.

Material de referencia, todo en `docs/radar/`:
- `prototipo-radar.html` y `capturas/` para navegación, jerarquía y estados;
- `research-laboral.xlsx`, el export real del Sheet. Si no está, usá una fixture con los encabezados del maestro y anotalo como bloqueo en ESTADO.md.

Si los archivos de `docs/radar/` no están commiteados en `main`, incluilos en el PR de esta sesión.

## Paso 1 — Auditoría (corta, por escrito)
Escribí `docs/radar/AUDITORIA.md` con lo siguiente:
- Rutas y layout actuales: cómo está hecha la navegación lateral (Búsquedas, Match, CV, Postular, Carta, Entrevista, Video, Seguimiento, Extensión) y dónde iría "Radar laboral".
- Sistema de diseño: tokens reales (el verde Maru, radios, tipografía) y componentes reutilizables (cards, tabs, drawer, inputs, toasts).
- Auth: cómo obtener el `userId` en el servidor.
- Persistencia actual en Upstash: patrones de keys, helpers, si Preview y Production comparten base.
- Módulo **Match**: `scripts/match-sync.ts`, `data/match`, el workflow que lo sincroniza y el contrato de una vacante y de un score.
- Módulo **Seguimiento**: modelo de "postulación", sus estados y cómo se crea una tarjeta.
- Flujo de CV, servicios de IA (cliente, modelo, validación Zod), scripts de `package.json`, tests existentes, `vercel.json` y workflows.
- Qué se reutiliza y qué falta.

## Paso 2 — ADR de persistencia
Escribí `docs/radar/ADR-001-persistencia.md`. Debe comparar:
- **(a) Solo Upstash Redis**, con keys `radar:v1:*`, índices con sorted sets o sets, y una capa de repositorio con interfaces para poder migrar después.
- **(b) Sumar Postgres** (Supabase, Neon u otro) para el catálogo, las vacantes y los matches, dejando el resto en Redis.

Para cada opción evaluá: deduplicación del catálogo (273 registros entre sectores), filtros combinables (sector, prioridad, región, texto), unicidad (user, company) y (source, external_job_id), historial de corridas, aislamiento por usuario, costo y complejidad operativa.

- **Si recomendás (a):** seguí con la implementación.
- **Si recomendás (b):** **frená acá**, mostrame el ADR y esperá mi respuesta. Sumar un proveedor nuevo de infraestructura lo decido yo.

En cualquier caso, toda la sesión accede a los datos a través de una capa `src/.../radar/repo` con interfaces (`CompanyRepo`, `TargetCompanyRepo`, `JobRepo`, etc.). Las pantallas no hablan directo con Redis.

## Paso 3 — Modelo de datos y feature flag
- Adaptá las entidades del maestro (§4) a la persistencia elegida. En esta sesión alcanzan: `companies`, `company_industries`, `company_sources` (solo el registro, sin crawling), `user_target_companies`, `user_radar_settings`, más la estructura de import.
- La identidad de una empresa es el dominio canónico verificado. Si no hay dominio, un slug normalizado, marcado como "identidad provisoria". No fusiones subsidiarias solo por el nombre.
- Implementá el feature flag según las reglas comunes.

## Paso 4 — Pantallas (MVP con persistencia real)
- Agregá "Radar laboral" debajo de Match en la navegación, con un ícono de la librería existente. Solo se ve con el flag prendido.
- Las rutas son `/radar/empresas`, `/radar/oportunidades`, `/radar/descubrimiento` y `/radar/automatizacion`, con un subnav compartido.
- **Mis empresas** completa, según §2 Pantalla A: resumen P1/P2/por clasificar/fuentes con error, filtros combinables, tabla responsive (cards en mobile), prioridad editable, orden manual, ficha en drawer con notas, prioridad, archivar o dejar de seguir, `Agregar empresa` con búsqueda en el catálogo o creación manual, empty, loading y error.
- **Importar empresas** (XLSX/CSV):
  - vista previa con mapeo de columnas, separación de las 3 pestañas y de las secciones;
  - las filas de `JOB OPENINGS · PILOTO` se guardan como vacantes históricas de fixture para la sesión 3, sin mezclarlas con empresas;
  - `COBERTURA DEL PILOTO` se ignora;
  - dedup entre sectores conservando todas las etiquetas, con conflictos y errores visibles;
  - confirmación;
  - import idempotente, que no pisa prioridades ni notas existentes.
- El parseo de XLSX va del lado del servidor. Usá una librería que ya esté en el repo o una conocida y mantenida.
- **Oportunidades, Descubrimiento y Automatización:** en esta sesión van solo el layout y los estados vacíos honestos ("Todavía no hay fuentes verificadas", etc.). Automatización ya puede **guardar y leer** `user_radar_settings` (frecuencias, timezone IANA, hora y día del digest, toggles, pesos que sumen 100), pero sin ejecutar nada.
- Cuidá la accesibilidad: focus visible, labels, estados que no dependan solo del color, navegación por teclado y tabs desplazables en mobile.

## Paso 5 — Tests (§7, la parte que aplica)
- Import de una fixture con encabezados reales, tres secciones, una empresa repetida entre industrias y filas de cobertura. Resultado esperado: una sola empresa con todas sus etiquetas, sin vacantes mezcladas con empresas. Una segunda importación no duplica ni pisa preferencias.
- Alta y edición de P1/P2/P3, filtro por sector, búsqueda, archivar y persistencia tras recargar.
- Aislamiento entre dos usuarios.
- Con el flag apagado, `/radar/*` da 404 y la navegación no cambia.

## Fuera de alcance en esta sesión
Crawling y adaptadores de ATS, scoring, scheduler, notificaciones y descubrimiento real.

## Cierre
Seguí la regla de merge y la sección "Al terminar" de las reglas comunes. Creá `docs/radar/ESTADO.md`.
