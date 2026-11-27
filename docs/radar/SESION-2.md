# Sesión 2 — Fuentes reales: adaptadores ATS e ingestión de vacantes

Actuá como senior product engineer de Maru. Antes de empezar, leé `docs/radar/_REGLAS_COMUNES.md`, `docs/radar/ESTADO.md`, `docs/radar/ADR-001-persistencia.md` y `docs/radar/AUDITORIA.md`. Cubrís la **etapa 3** de `docs/radar/PROMPT_MAESTRO.md` (§4, "Adaptadores de fuentes" e "Ingestión idempotente").

Si ESTADO.md dice que la sesión 1 quedó con el PR sin mergear o con bloqueos, primero resolvé eso o frená y avisame.

## Objetivo
Llegar al primer tramo del flujo completo con datos reales: **seguir empresa → resolver su fuente → traer sus vacantes reales → verlas como "detectadas"**. Todavía sin score.

## Alcance
1. **Resolución de la fuente al agregar o importar una empresa:**
   - Detectar el ATS (Greenhouse, Lever o Ashby) y el board token o ID a partir de la Careers URL, siguiendo redirects con validación.
   - Validar el token contra la API pública.
   - Si no se reconoce: probar JSON-LD `JobPosting` en la página de Careers, siempre que robots y ToS lo permitan, y si no, estado `manual`.
   - Estados posibles: `pending`, `success`, `verified_empty`, `partial`, `error`, `manual`.
   - Botón para reintentar la verificación desde la ficha.
2. **Adaptadores con una interfaz común:**
   - Greenhouse Job Board API: https://developers.greenhouse.io/job-board.html
   - Lever Postings API: https://github.com/lever/postings-api (región EU y paginación)
   - Ashby: https://developers.ashbyhq.com/docs/public-job-posting-api
   - JSON-LD genérico, reutilizando `cheerio`, que ya está en el repo.
   - Nada de LinkedIn. No se eluden CAPTCHA, login, rate limits ni robots.
3. **Cliente HTTP seguro, compartido por todos los adaptadores:**
   - Protección SSRF: bloquear localhost, rangos privados, link-local y endpoints de metadata, y revalidar en cada redirect.
   - Solo `https`, con timeout, límite de tamaño de respuesta y User-Agent identificable.
   - Sanitizar HTML y validar el JSON contra un esquema Zod.
4. **Ingestión idempotente** de `job_openings`:
   - Normalizar campos y calcular `content_hash`.
   - Unicidad por (source, external_job_id); como segunda estrategia, URL o huella para duplicados entre fuentes, sin fusionar roles distintos solo por el título.
   - Detectar vacantes nuevas, modificadas y cerradas, y mantener `first_seen_at` y `last_seen_at`.
   - Cerrar una vacante solo si la fuente oficial lo informa o tras **dos snapshots completos y exitosos** sin ella. Nunca por fallo, timeout, 429, paginación incompleta o respuesta sospechosa (por ejemplo, una caída abrupta mayor al 80 % sin confirmación).
   - Una reapertura conserva el historial.
   - La extracción es **global por fuente, no por usuario**.
5. **`monitoring_runs` y `monitoring_run_items`:** inicio y fin, fuente, intentos, estado, cobertura, nuevas, modificadas y cerradas, y errores sanitizados.
6. **Worker** invocable desde una ruta de servidor protegida con un secreto, o desde un script:
   - lock o lease por fuente;
   - retry exponencial con jitter;
   - límites de concurrencia por proveedor;
   - presupuesto máximo por corrida.
   - **Todavía sin scheduler en producción.** "Revisar ahora" desde la ficha encola o ejecuta una revisión de esa empresa, con cooldown.
7. **UI:**
   - En la ficha: estado real de la fuente, última revisión exitosa, historial de corridas y vacantes detectadas (activas y cerradas).
   - En la tabla: vacantes activas por empresa.
   - En Oportunidades: lista de vacantes detectadas de las empresas seguidas, con fecha de publicación si existe (separada de la primera detección), frescura y "Ver aviso original". Con un aviso "sin evaluar".
   - Las vacantes históricas del piloto (de la sesión 1) se muestran solo como fixture, con la etiqueta "Piloto 25/11/2026 · vigencia no verificada", y nunca mezcladas como reales.
8. **Validar las URLs de Careers del Sheet** para un conjunto chico: las P1 de la fixture, unas 20 empresas. Reportá en ESTADO.md cuáles resolvieron a qué ATS y cuáles quedaron en manual.

## Tests (§7)
- Paginación, cierre y reapertura, timeout y 429, snapshot parcial, reintentos e idempotencia en cada adaptador, usando respuestas grabadas como fixtures en los tests y sin red en CI.
- Una falla de la fuente no cierra vacantes.
- Dos usuarios que siguen la misma empresa generan una sola extracción.
- SSRF: casos con localhost, IP privada, redirect a una IP privada y un esquema no permitido.

## Ejecución real
Hacé al menos una corrida real contra 3 a 5 empresas con ATS público, en local o en Preview, respetando la regla de la base compartida. Reportá los números exactos.

## Fuera de alcance en esta sesión
Scoring y match, scheduler recurrente y notificaciones.

## Cierre
Seguí la regla de merge y "Al terminar" de las reglas comunes. Actualizá `ESTADO.md`.
