# Evidencia del research de avisos — 16/10/2026

Paquete persistido para continuar sin depender del historial del chat, pestañas, variables del REPL ni archivos fuera del repo. Leer [la estrategia](../../ESTRATEGIA-AVISOS.md) y [el plan de ejecución](../../PLAN-AVISOS.md) antes de consumir cuotas o cambiar la adquisición.

## Qué contiene

| Archivo | Uso |
| --- | --- |
| [manifest.json](manifest.json) | Fecha/base, consultas conocidas, IDs de ejecuciones y datasets, cuotas históricas, permisos y limitaciones. |
| [samples.json](samples.json) | 185 registros públicos seleccionados de seis muestras. ID, título, empresa, enlaces, ubicaciones, fechas originales, longitud y hash de descripción; sin texto completo. |
| [APIFY-AVISOS-PILOTO.csv](APIFY-AVISOS-PILOTO.csv) | 125 aceptados de LinkedIn, Indeed y Computrabajo; lectura manual en planilla. |
| [FANTASTIC-Y-SERP-AVISOS.csv](FANTASTIC-Y-SERP-AVISOS.csv) | 50 filas Fantastic y diez Google Jobs, fuente, fecha/antigüedad relativa, longitud y enlace. |
| [apify-metrics.json](apify-metrics.json) | Foto del inventario base y métricas agregadas del piloto Apify. |
| [overlap.json](overlap.json) | Cruce offline de las seis muestras con las reglas del repo en ese corte; candidatos a duplicados, grupos y combinaciones. |
| [fantastic-counts.json](fantastic-counts.json) | Tres conteos del trial: ATS, job boards y job boards excluyendo duplicados con ATS. Sin créditos de avisos consumidos por esos conteos. |

No contiene API keys, env de Vercel, cookies, CVs reales, fotos o datos seleccionados de reclutadores. No es inventario productivo y no debe cargarse como fixture de producción. Los enlaces son públicos pero pueden vencer; los identificadores no garantizan retención permanente de un dataset por parte del proveedor.

## Lectura correcta de los números

- Apify: 144 recibidos → 125 aceptados → 123 oportunidades canónicas → 122 grupos visuales. Son niveles diferentes del pipeline, no cuatro conteos intercambiables.
- Las seis muestras: 125 Apify + 25 Fantastic ATS + 25 Fantastic LinkedIn + diez SerpAPI = 185 registros. El agrupador actual deja 167 grupos visuales; es una heurística, no ground truth de 167 requisiciones distintas.
- Las filas `newVsBase`/`allSourceGroupsAdded` de `overlap.json` comparan contra el catálogo gratuito del corte original; no significan novedades de una segunda corrida ni incremento sobre el catálogo actual de quien continúe.
- En `overlap.json`, `exactUrl` compara URLs canónicas de fuente/postulación. `exactCompanyTitle` es el nombre histórico del campo: **no es coincidencia literal**; se normalizaron mayúsculas/acentos y se quitaron algunos términos, incluidos seniorities. Usarlo sólo para investigar candidatos, nunca para fusionar automáticamente requisiciones.
- `mergedByExistingRules` ejecutó `buildOpportunities` y `groupOpportunities` sobre las publicaciones normalizadas. No sumar las coincidencias de todas las parejas: una vacante puede aparecer en tres fuentes.
- El cruce original se hizo con textos completos seleccionados y la base de ese momento. Este paquete conserva métricas, campos públicos y hashes, pero **no permite reproducir toda la extracción/agrupación sólo desde `samples.json`**, porque no incluye las descripciones completas. No simular que sí.
- Los hashes se calcularon por texto exportado de cada muestra; diferencias de formato/recorte entre proveedores impiden tratarlos como detector universal de duplicados.
- Las fechas ISO sin zona se conservan como llegaron. No agregar `Z` silenciosamente ni reinterpretar labels relativos de SerpAPI como timestamps exactos.
- `indexedAt` representa `date_created` de Fantastic, no la primera vez que Maru vio un aviso. Los otros proveedores no aportaron un equivalente en este paquete.
- El conteo Fantastic `1m` incluye indexados durante 31 días que luego vencieron. Los 19.428 registros tras el filtro del proveedor no representan vacantes abiertas ni un volumen futuro garantizado. La diferencia 1.637 / 15.394 = 10,63% corresponde sólo al filtro de duplicados del proveedor sobre ese conjunto de portales.

## Procedencia y recuperación

Las tres ejecuciones Apify terminaron en `SUCCEEDED`. Los IDs y topes están en `manifest.json` y [APIFY.md](../../APIFY.md). Antes de recuperar, verificar que el dataset sigue disponible y que la ejecución corresponde al Actor esperado. Recuperar una ejecución existente no significa lanzar otra.

`npm run match:apify -- --source=linkedin` es dry-run. `--run-id=...` recupera una ejecución existente y requiere `APIFY_TOKEN` en entorno; no pasar secretos por argumentos. **No usar `--run` para reconstruir una prueba histórica**. La autorización de hasta US$0,50 no se renueva.

Las muestras Fantastic y SerpAPI se obtuvieron de los playgrounds autenticados, seleccionando sólo campos públicos. Las cuotas/claves de Production se comprobaron después desde el panel privado de Maru. Los requests de estado de Fantastic consumen requests del trial aunque no descuenten créditos de avisos.

Últimas fotos conocidas: Fantastic 450 créditos de avisos; requests a revalidar por consultas posteriores. SerpAPI Free, precio 0, 248/250 búsquedas disponibles. El trial Fantastic se inició el 16/10 y su vencimiento esperado es 23/10; la hora y el acceso a endpoints deben comprobarse. No asumir que este saldo sigue disponible.

## Experimentos todavía no ejecutados

La matriz estratificada y los cortes T0/T1/T2 de [E1](../../PLAN-AVISOS.md#4-e1--aprovechar-el-trial-de-fantastic) son **un plan**, no resultados. Tampoco hay benchmark por perfiles sintéticos, comparación longitudinal completa, prueba directa de Bumeran/ZonaJobs ni evaluación de embeddings.

Cada experimento nuevo debe guardar su propia fecha, configuración exacta, cuota/consumo, datos seleccionados y conclusiones en otra carpeta. No sobrescribir esta foto histórica ni reemplazar sus cuotas por saldos actuales.
