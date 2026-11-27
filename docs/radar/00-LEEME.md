# Radar laboral — kit para Claude Code

Esta carpeta va en el repo `facundogregorini-lab/maru`, en `docs/radar/`.

## Contenido

| Archivo | Qué es |
|---|---|
| `PROMPT_MAESTRO.md` | Spec completa del producto. Es la referencia de fondo de todas las sesiones. |
| `SESION-1.md` … `SESION-4.md` | Prompt de cada sesión de Claude Code, en orden. |
| `prototipo-radar.html` | Prototipo navegable. Sirve como guía visual, no es código de producción. |
| `capturas/` | Capturas del prototipo, en desktop y mobile. |
| `research-laboral.xlsx` | Lo agregás vos: el export del Google Sheet Research Laboral (Archivo → Descargar → .xlsx), con las tres pestañas. |
| `ESTADO.md` | Lo crea y lo actualiza Claude Code al terminar cada sesión. Es el traspaso entre una sesión y la siguiente. |

## Cómo usarlo

1. Copiá esta carpeta en `docs/radar/` dentro del repo y agregá `research-laboral.xlsx`.
2. Commiteá esos archivos en `main` (es solo documentación). Tené en cuenta que el push a `main` dispara un deploy a producción en Vercel, aunque sin cambios funcionales.
   Otra opción: no commitees nada y en la sesión 1 pedile a Claude Code que lo commitee él en la rama de la feature.
3. Abrí una sesión nueva de Claude Code sobre el repo y pegá esto:

   > Leé docs/radar/SESION-1.md y ejecutalo.

4. Cuando termine y el PR quede mergeado (o abierto, si no pasó los controles), abrí otra sesión nueva y pedile `SESION-2.md`. Hacé lo mismo con la 3 y la 4.

Usá siempre una sesión nueva por etapa. Cada una arranca leyendo `ESTADO.md`, así que no hace falta que le expliques lo que pasó antes.

## Cosas del entorno real que el prompt maestro no sabía

- **Persistencia.** El prompt maestro supone Supabase/Postgres con RLS. Maru hoy usa Upstash Redis (REST), y el login es Google con cookie de sesión firmada con HMAC, sin base de datos. Las sesiones ya están adaptadas a eso. La sesión 1 decide la persistencia en un ADR y se frena para preguntarte si propone sumar un proveedor nuevo.
- **Deploy.** Vercel despliega `main` a producción (marucoach.com) automáticamente, y cada rama tiene su preview. Mergear es deployar. Por eso cada sesión trae una regla de merge con condiciones (feature flag apagado en producción, build y tests en verde, preview en READY).
- **Lo que ya existe y se reutiliza.** Hay un sync de Match (`scripts/match-sync.ts`, `data/match`), cheerio para leer avisos, Claude API con validación Zod, Resend para email (sección recruiters), Vitest y GitHub Actions.
- **Analytics.** El README no menciona PostHog. La sesión 4 revisa si hay una capa de tracking y no suma una nueva sin tu OK.
