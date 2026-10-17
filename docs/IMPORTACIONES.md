# Importaciones de proveedores con cuota

Fecha: 17/10/2026. Complementa la sincronización diaria gratuita (`match-sync`). Suma al catálogo avisos de **Fantastic.jobs** (créditos del trial), **Google Jobs vía SerpApi** (búsquedas del plan gratuito) y **Apify** (LinkedIn, Indeed y Computrabajo, con el tope de **US$5** aprobado por el dueño el 16/10).

## Cómo se corre

Sólo a mano, desde **GitHub → Actions → match-providers → Run workflow** (también se puede lanzar por API). No tiene cron.

| Input | Valores |
| --- | --- |
| `provider` | `fantastic`, `serpapi` o `apify` |
| `mode` | `plan`: muestra qué haría, sin red (default). `status`: lee el saldo (Fantastic usa 1 request de conteo, que no gasta créditos de avisos). `run`: importa y commitea `data/match/`. |
| `args` | Opcional. Fantastic: `--cohorts=G1,G2,T1 --feeds=ats,jb --limit=50 --max-jobs=300 --time-frame=7d`. SerpApi: `--max-searches=12 --reserve=20 --queries=adm-cba,fin-ros`. Apify: `--budget-usd=5 --rows=100 --sources=computrabajo,indeed,linkedin --keywords-per-source=10` y opcional `--keywords=administrativo_tucuman,vendedor_salta` (`_` = espacio). |

Las claves se leen de los **secrets del repositorio** (Settings → Secrets and variables → Actions): `FANTASTIC_JOBS`, `SERP_API` y `APIFY_TOKEN`. Las variables de Vercel no llegan a GitHub Actions: hay que cargarlas también ahí. El repo es **público**: nunca pasar claves como inputs del workflow, en argumentos o en archivos. El primer paso del workflow sólo informa si cada secret está "cargado" o "falta".

Localmente: `npx --yes tsx@4 scripts/match-import.ts --provider=... --mode=...` con las mismas variables en el entorno.

## Topes

- **Fantastic:** antes de descargar hace un conteo y lee `x-api-jobs-remaining` / `x-api-requests-remaining`. Cada pedido usa `min(limit, saldo, max-jobs − gastado)`. Si el proveedor no informa saldo, no descarga. Sin reintentos: un error frena la corrida. Feed LinkedIn con `exclude_recruiter_fields=true`.
- **SerpApi:** consulta la cuenta (gratis) y usa sólo `plan_searches_left − reserva` (default reserva 20, para que el panel de admin siga funcionando). Nunca `total_searches_left`, que incluye extras pagos. Primera página, sin paginar.
- **Apify:** cada corrida se lanza con `maxItems` y `maxTotalChargeUsd`. Antes de cada una se suma el gasto del ledger y el peor caso de la corrida (inicio US$0,02 + filas × precio: LinkedIn 0,002, Computrabajo 0,0015, Indeed 0,0001); si se pasaría del presupuesto, frena. El gasto registrado es conservador (uso de plataforma + precio por fila). `--budget-usd` máximo 5.
- El plan por defecto de Apify (10 palabras × Computrabajo e Indeed, 6 × LinkedIn, 100 filas) cuesta como máximo ≈ US$3,3.

## Qué se guarda

- `data/match/inventory.json`: avisos aceptados, en bolsas `fantastic:ats:ar`, `fantastic:linkedin:ar`, `serpapi:google_jobs:ar` y `apify:{fuente}:ar`. Atribución y enlace a la fuente original en cada uno.
- `data/match/providers-ledger.json`: cada llamada con hora, parámetros (sin claves), filas, consumo y saldo informado.
- `data/match/providers-discoveries.json`: empleadores vistos en el feed ATS de Fantastic y su ATS. Los que usan Greenhouse, Lever o Ashby (`supported`) se pueden sumar gratis al directorio con `npm run match:add-company` y quedan en la sync diaria aunque se termine el trial.

## Calidad y vigencia

- Se rechazan avisos sin título, empresa o enlace seguro, con descripción menor a 300 caracteres, vencidos, publicados hace más de 45 días (Fantastic) o 30 (Google Jobs, Apify), y los de Google Jobs que sólo ofrecen agregadores secundarios.
- Google Jobs da antigüedad relativa: se guarda como texto (`postedLabel`) y se muestra "según Google, al verla"; nunca se convierte en fecha. En Búsquedas esas tarjetas dicen "vista hace…".
- Son feeds parciales: una ausencia no cierra avisos. La sync diaria no los consulta ni los purga, pero los **vence** por la fecha de la fuente o si pasan 30 días (21 en Google Jobs) sin volver a verse. Así el catálogo no arrastra avisos viejos cuando se termina el trial o el presupuesto.
- Además, la sync diaria mira la página original de hasta 150 importados (`scripts/match-liveness.ts`) y cierra los que responden 404/410 o dicen explícitamente que el aviso terminó.
- Logos: se usan los que informa la fuente (https). Si no cargan, la tarjeta vuelve a la inicial.

## Estado al 16/10/2026 (noche)

Primera corrida real hecha con los secrets rotados. Se confirmaron los supuestos que no se podían probar sin red:
- el filtro `title` con `OR` y comillas de Fantastic;
- `source=linkedin` en `active-jb`;
- `location=Argentina` en SerpApi;
- más de 50 filas por Actor en Apify.

| Fuente | Aceptados | Consumo | Saldo que queda |
| --- | ---: | --- | --- |
| Google Jobs (SerpApi) | 88 | 12 búsquedas | 236 de 250 este mes (se renueva cada mes, gratis) |
| Fantastic ATS + LinkedIn | 272 | 273 créditos, 7 requests | ~177 créditos y ~28 requests hasta que vence el trial (~23/10) |
| Apify Computrabajo / LinkedIn / Indeed | 575 / 517 / 213 | Real ≈ US$2,8 (ledger conservador: US$4,35) | Del tope aprobado de US$5 quedan ~US$2,2 reales; el ledger frena en US$5 estimados |

Después de importar se corrió `match-sync` a mano: re-analizó todo con `EXTRACTION_VERSION` 3 y la modalidad desde el texto, y sumó 360 avisos de 6 empleadores descubiertos en Fantastic. Catálogo: **11.544 oportunidades abiertas, 2.722 elegibles desde Argentina** (E0: 909 grupos). Medición por perfil en [research/e1-importacion-2026-10-16](research/e1-importacion-2026-10-16/README.md).

## Estado al 17/10/2026

- **Fantastic:** trial agotado (448/450). Segundo corte con G3/G4 y `offset` (`--offset=N` pide la página siguiente de la misma consulta, sin pagar repetidos). No hay más corridas posibles sin plan pago, y el pago está descartado.
- **Google Jobs:** 28 de 250 búsquedas usadas este mes (12 generalistas + 16 del interior).
- **Apify:** ≈ US$2,8 reales gastados de US$5.
- **Teamtailor:** fuente gratuita diaria con 13 empleadores (RSS público).

## Próximas corridas recomendadas

1. **Fantastic, segundo corte (antes del 22/10):** `provider=fantastic mode=status` y después `mode=run args=--cohorts=G1,G2 --feeds=ats,jb --limit=40 --max-jobs=170 --time-frame=7d`. Prioriza generalistas; T1 ya está cubierto por los ATS gratuitos. Comparar repetidos contra el primer corte (ledger + `firstSeenAt`).
2. **Google Jobs, una vez por mes:** `provider=serpapi mode=run args=--max-searches=24 --reserve=20`. Conviene sumar búsquedas de ciudades sin oferta (Salta, Neuquén, Santa Fe, Mar del Plata, Bahía Blanca) en `SERP_QUERIES` de `src/lib/match/providers.ts`. Las de reserva del E0 se pueden usar una vez cerrada la comprobación.
3. **Apify:** queda ~US$2,2 real del tope. El ledger estima de más, así que para gastarlo hay que subir `--budget-usd` hasta 5 + lo ya registrado de más, o ajustar `APIFY_PRICE_PER_ROW`. Indeed es lo más barato (~US$0,01 por 100 filas). Computrabajo es lo mejor para el interior. Sin aprobación nueva, no superar US$5 reales en total; el límite mensual de la cuenta Apify también está en US$5.
4. **Directorio gratuito:** revisar `data/match/providers-discoveries.json` después de cada corrida de Fantastic. Los empleadores con `supported` se suman a `companies.json` y quedan en la sync diaria para siempre. Los que usan Workday, Teamtailor, SuccessFactors o Workable (la mayoría) necesitan conectores nuevos: ver PENDIENTES.
