# Radar laboral: auditoría del repo (27/11/2026)

Qué hay en Maru que Radar puede reutilizar, y qué falta. Sale de leer el código en `main` (`4dbb1d9`).

## Lo que ya existe y Radar reutiliza

| Pieza | Dónde | Cómo la usa Radar |
| --- | --- | --- |
| Navegación lateral de la app | `src/components/app/SideNav.tsx`, `AppShell.tsx` | Suma «Radar laboral» debajo de Match, visible sólo con el flag. |
| Login | `src/lib/auth.ts` (Google + cookie HMAC, sin base) | `sessionEmail(req)` en las rutas y la cookie en las páginas para el flag con allowlist. |
| Datos personales por cuenta | `src/lib/sync/*`: cada documento vive en `localStorage` y, con sesión, se copia a Redis (`maru:u:<hash>:<doc>`) con compare-and-set | Radar es un documento más (`radar` → `maru:radar:v1`). Hereda aislamiento por cuenta, versión y borrado. |
| Directorio de empleadores | `data/match/companies.json` (194 entradas: Greenhouse, Lever, Ashby, Teamtailor y otros) | Catálogo para «Agregar empresa» y para saber qué empresas ya se monitorean. |
| Inventario compartido de avisos | `data/match/inventory*.json`, generado por `scripts/match-sync.ts` en GitHub Actions todos los días | Es el «crawler» de Radar: una extracción global por fuente, no por usuario, con lotes, lock, reintentos, política de cierre y SSRF ya resueltos (`docs/match.md`). |
| Conectores ATS | `src/lib/match/connectors.ts` (`parseBoardUrl`, `FETCHERS`), `http.ts` (`safeFetch`) | Resolver la Careers URL de una empresa nueva y validarla. |
| Ranking explicable | `src/lib/match/ranking.ts` + `rerank.ts`, `POST /api/match/ranking` | Oportunidades de Radar = ese ranking acotado a las empresas seguidas. Ya tiene puntaje con desglose, confianza, elegibilidad desde Argentina y descartes. |
| Seguimiento | `src/lib/tracker.ts` (`upsertTracked`, idempotente por id) | «Guardar» crea o actualiza una sola tarjeta. |
| Handoff a CV, carta, entrevista | `src/lib/match/clientStore.ts` (`handoffJob`) | «Adaptar CV» y los demás abren los flujos actuales con el aviso cargado. |
| Alertas por email | `src/lib/alerts.ts`, `/api/cron/alertas`, Resend | Base para el digest de Radar (sesión 4). |
| Analytics | `src/lib/tracking/posthog.ts` (`capture`) | Eventos `radar_*` sin datos personales. |
| UI | `src/components/ui.tsx`, tokens en `globals.css` (`neon`, `ink`, `line`, `surface-3`) | Mismo look: fondo gris claro, tarjetas blancas, CTA neón, botones negros. |
| Tests | Vitest en entorno node, `tests/*.test.ts` | La lógica de Radar va en `src/lib/radar/*`, pura y testeable. |
| CI | `.github/workflows/ci.yml`: lint, tests y build en cada PR | Verificación de cada PR. |

## Diferencias con lo que suponía el prompt maestro

- **No hay Postgres ni RLS.** El catálogo y el inventario son archivos versionados; los datos de cada persona, documentos en el navegador sincronizados a Redis. Ver `ADR-001-persistencia.md`.
- **El crawling ya existe** y es global. Radar no necesita un worker propio para Greenhouse, Lever y Ashby: necesita que las empresas que la gente sigue entren al directorio.
- **El match ya existe** con pesos 40/25/20/15 (rol, seniority, requisitos, preferencias) y elegibilidad desde Argentina. Radar lo reutiliza en lugar de crear un segundo puntaje (ver ADR-002 en la sesión 3).
- **Cron**: Vercel Cron (`vercel.json`) para alertas y GitHub Actions para la sincronización.

## Lo que falta (y queda para cada sesión)

1. Sesión 1: flag, documento `radar`, pantallas, importación XLSX/CSV, estado de cada empresa contra el directorio y el inventario.
2. Sesión 2: pedido de incorporación de una empresa nueva al directorio (validación con la API pública) y su paso a la sincronización diaria.
3. Sesión 3: Oportunidades con el ranking acotado a las empresas seguidas, guardar en Seguimiento, descartar.
4. Sesión 4: alertas y digest de Radar, descubrimiento, eventos, rollout.
