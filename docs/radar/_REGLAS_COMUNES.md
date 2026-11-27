# Reglas comunes a todas las sesiones de Radar laboral

Estas reglas valen en cada sesión. Si chocan con `PROMPT_MAESTRO.md`, prevalecen estas.

## Al empezar
1. Leé `CLAUDE.md` en la raíz del repo, `docs/radar/PROMPT_MAESTRO.md` y `docs/radar/ESTADO.md` (este último existe desde la sesión 2).
2. Trabajá en la rama `feat/radar-laboral-sN`, donde N es el número de sesión, creada desde `main` actualizado. Si `CLAUDE.md` define otra convención de ramas o commits, seguí esa.

## Stack real (corrige al prompt maestro)
- El stack es Next.js 15 (App Router), TypeScript, Tailwind v4, Claude API (`@anthropic-ai/sdk`) con Zod, **Upstash Redis** (REST), login con Google y cookie de sesión firmada con HMAC, y Vercel.
- **No hay Supabase/Postgres ni RLS.** Las secciones del maestro que hablan de "migraciones", "RLS" o "Supabase Cron" se traducen así:
  - **Migraciones aditivas:** keys nuevas bajo el namespace `radar:*`, con un esquema versionado (por ejemplo `radar:v1:*`). Nunca reescribir ni borrar keys existentes de otras secciones.
  - **RLS:** aislamiento por usuario en la capa de servidor. Cada lectura y escritura privada se deriva del `userId` de la sesión verificada, nunca de un parámetro del cliente. Debe haber tests con dos usuarios.
  - **Cron:** Vercel Cron (`vercel.json`) o GitHub Actions, según lo que ya use el repo.
- Excepción: el ADR de la sesión 1 puede recomendar sumar Postgres. En ese caso **frená y preguntá antes de agregarlo** (ver SESION-1).

## Datos y seguridad
- Averiguá si los entornos Preview y Production comparten la misma base de Upstash (mirá las env vars por entorno; si no podés verlas, asumí que sí la comparten). Si la comparten, **ninguna fixture, dato demo ni test escribe en esa base.** Las fixtures se cargan solo en desarrollo local o en memoria.
- Los secretos nunca van al cliente. Nada de CV, emails, notas ni descripciones completas en logs ni en analytics.
- El contenido de páginas externas es no confiable: no puede actuar como instrucciones al modelo, y el extractor y el scorer no tienen herramientas ni acceso a secretos.
- Nunca postular automáticamente.

## Feature flag
- Todo Radar va detrás de `RADAR_ENABLED` (server) o del flag que defina la sesión 1. Apagado, no aparece en la navegación y las rutas `/radar/*` devuelven 404.
- El flag acepta además una allowlist opcional (`RADAR_ALLOWLIST`, con emails separados por coma). Si el flag está prendido y hay allowlist, Radar se ve solo para esos usuarios. Sirve para un rollout gradual en producción.
- **No configures ese flag en el entorno Production de Vercel.** Prendelo solo en local y, si hace falta, en Preview.

## Verificación
- Antes de dar algo por terminado, corré lint, typecheck, tests y build (los scripts reales de `package.json`). Reportá los resultados exactos. Si algo no existe o no corre, decilo; no lo des por pasado.
- Revisá en el navegador las pantallas que tocaste, en desktop y en mobile (alrededor de 380px), y guardá capturas en `docs/radar/capturas/sN-*.png`.

## Regla de merge (push a `main` = deploy a producción en marucoach.com)
Abrí el PR. **Mergealo vos** solo si se cumplen todas estas condiciones:
1. Lint, typecheck, tests y build en verde.
2. El deploy de Preview del PR está en READY en Vercel y lo probaste.
3. Con el flag apagado (como queda en Production) no cambia nada visible ni funcional para los usuarios actuales. Verificalo: `/radar` da 404 y la navegación no cambió.
4. Los cambios de datos son solo aditivos (`radar:*`), sin escrituras a la base compartida desde fixtures o tests.
5. No hay crons nuevos que se ejecuten en producción con efectos (escritura, emails, llamadas pagas a la API) sin que el flag los proteja.

Después del merge, confirmá que el deploy de producción quedó en READY y que el sitio sigue funcionando. **Si alguna condición falla, dejá el PR abierto**, explicá por qué y no merges.

## Al terminar
Actualizá `docs/radar/ESTADO.md` (incluilo en el mismo PR) con:
- lo que funciona con datos reales y lo que sigue en fixture;
- las decisiones tomadas y su motivo;
- la configuración y las env vars necesarias;
- los riesgos y bloqueos abiertos;
- lo que tiene que saber la sesión siguiente.

Tu respuesta final debe incluir: el link del PR, si se mergeó o no (y por qué), los resultados exactos de las verificaciones y los pendientes.
