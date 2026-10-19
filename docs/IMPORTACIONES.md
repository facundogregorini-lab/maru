# Importaciones de proveedores con cuota

Fecha: 17/10/2026. Complementa la sincronización diaria gratuita (`match-sync`). Suma al catálogo avisos de **Fantastic.jobs** (créditos del trial), **Google Jobs vía SerpApi** (búsquedas del plan gratuito) y **Apify** (LinkedIn, Indeed y Computrabajo, con el tope de **US$5** aprobado por el dueño el 16/10).

## Cómo se corre

Sólo a mano, desde **GitHub → Actions → match-providers → Run workflow** (también se puede lanzar por API). No tiene cron.

| Input | Valores |
| --- | --- |
| `provider` | `fantastic`, `serpapi` o `apify` |
| `mode` | `plan`: muestra qué haría, sin red (default). `status`: lee el saldo (Fantastic usa 1 request de conteo, que no gasta créditos de avisos). `run`: importa y commitea `data/match/`. |
| `args` | Opcional. Fantastic: `--cohorts=G1,G2,T1 --feeds=ats,jb --limit=50 --max-jobs=300 --time-frame=7d`. SerpApi: `--max-searches=12 --reserve=20 --queries=adm-cba,fin-ros`. Apify: `--budget-usd=5 --rows=100 --sources=computrabajo,indeed,linkedin --keywords-per-source=10` y opcional `--keywords=administrativo_tucuman,vendedor_salta` (`_` = espacio) y `--budget-source=account`, que parte del gasto real del mes que informa Apify en vez del ledger conservador (el tope `--budget-usd` sigue valiendo). |

Las claves se leen de los **secrets del repositorio** (Settings → Secrets and variables → Actions): `FANTASTIC_JOBS`, `SERP_API` y `APIFY_TOKEN`. Las variables de Vercel no llegan a GitHub Actions: hay que cargarlas también ahí. El repo es **público**: nunca pasar claves como inputs del workflow, en argumentos o en archivos. El primer paso del workflow sólo informa si cada secret está "cargado" o "falta".

Localmente: `npx --yes tsx@4 scripts/match-import.ts --provider=... --mode=...` con las mismas variables en el entorno.

## Topes

- **Fantastic:** antes de descargar hace un conteo y lee `x-api-jobs-remaining` / `x-api-requests-remaining`. Cada pedido usa `min(limit, saldo, max-jobs − gastado)`. Si el proveedor no informa saldo, no descarga. Sin reintentos: un error frena la corrida. Feed LinkedIn con `exclude_recruiter_fields=true`.
- **SerpApi:** consulta la cuenta (gratis) y usa sólo `plan_searches_left − reserva` (default reserva 20, para que el panel de admin siga funcionando). Nunca `total_searches_left`, que incluye extras pagos. Primera página, sin paginar.
- **Apify:** cada corrida se lanza con `maxItems` y `maxTotalChargeUsd`. Antes de cada una se suma el gasto del ledger y el peor caso de la corrida (inicio US$0,02 + filas × precio: LinkedIn 0,002, Computrabajo 0,0015, Indeed 0,0001); si se pasaría del presupuesto, frena. El gasto registrado es conservador (uso de plataforma + precio por fila). `--budget-usd` máximo 5.
- El plan por defecto de Apify (10 palabras × Computrabajo e Indeed, 6 × LinkedIn, 100 filas) cuesta como máximo ≈ US$3,3.

## Qué se guarda

- `data/match/inventory-imported.json` (desde el 19/10/2026; antes iban en `inventory.json`): avisos aceptados, en bolsas `fantastic:ats:ar`, `fantastic:linkedin:ar`, `serpapi:google_jobs:ar` y `apify:{fuente}:ar`. Atribución y enlace a la fuente original en cada uno.
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
- **Google Jobs:** 128 de 250 búsquedas usadas este mes: 12 generalistas, 16 del interior y 50 más del interior (atención, ventas y administrativo en 20 ciudades, +245 avisos). Otras 50 se perdieron por un conflicto al guardar, ya corregido en #51. Se renueva cada mes.
- **Apify:** registro conservador US$4,62 de US$5. Gasto real ≈ US$3 (la cuenta muestra el uso exacto). La última tanda fue Computrabajo para Tucumán, Mendoza y Salta (161 filas). No quedan corridas grandes posibles sin pasar el tope.
- **Teamtailor:** fuente gratuita diaria con 13 empleadores (RSS público).

## Cierre de la base (17/10/2026, tarde)

| Fuente | Consumo total | Saldo | Publicaciones abiertas |
| --- | --- | --- | ---: |
| Fantastic | 448/450 créditos | Trial agotado | 413 (ATS 163 + LinkedIn 250) |
| Google Jobs (SerpApi) | 216/250 búsquedas del mes | 34 (20 de reserva para el panel) | 961 |
| Apify | **US$4,56 reales** (cuenta) de US$5 | No se usa más: el uso de la cuenta puede informarse con atraso | Computrabajo 900 · LinkedIn 517 · Indeed 213 |

Catálogo después de la sync: **13.128 oportunidades abiertas, 3.683 elegibles desde Argentina, 1.505 empleadores con elegibles** (E0: 909 grupos y 90 empleadores). Medición en [research/e1-final-2026-10-17](research/e1-final-2026-10-17/README.md).

Desde #60, si Google Jobs no responde una búsqueda en 55 s, la búsqueda se saltea y la corrida sigue. Si fallan dos seguidas, frena. Las búsquedas "zona norte/oeste/sur" de la tanda 4 traen pocas filas y suelen tardar: no vale la pena repetirlas.

## Filtro de áreas (desde el 19/10/2026)

Decisión del dueño: de los proveedores con cuota entran sólo áreas profesionales, como en jobright (`src/lib/match/import-filter.ts`). Son tecnología, datos, producto, diseño, marketing, finanzas, consultoría, legal, RRHH, operaciones, ventas y administración. Atención al cliente y «Otras áreas» entran sólo con puestos de analista para arriba. Nunca entran chofer, operario, mostrador, cajero, repositor, mozo, vigilador, contact center, vendedor de salón o viajante ni similares. El resumen de cada corrida cuenta esos rechazos (`fuera_de_area`, `puesto_no_buscado`). La sync diaria cierra los importados que no pasan el filtro. Las búsquedas de Google Jobs de oficios (tanda 5) y las generalistas del interior (tanda 2) ahora casi no suman: no conviene gastar búsquedas en ellas.

## Actores de LinkedIn más baratos (desde el 19/10/2026)

`--actor=curious` (default, US$2 cada 1.000 filas), `--actor=valig` (US$0,40) o `--actor=cheap` (US$0,70, mínimo 150 filas por búsqueda). Precios del plan gratis de Apify, de su tienda (19/10/2026). Ejemplo: `provider=apify mode=run args=--actor=valig --rows=100 --keywords-per-source=2 --budget-usd=5 --budget-source=account`. Con `--rows` se piden hasta 500 filas por búsqueda.

## Compra única de avisos profesionales (aprobada el 19/10/2026)

El dueño aprobó una compra única de hasta **US$29** en Apify (plan Starter, un mes) para sumar unos 10.000 avisos de las áreas del filtro. El código acepta `--budget-usd` hasta 35: con `--budget-source=account` el tope se compara contra el gasto real del mes, así que se pasa gasto actual + lo que se quiere gastar. `--date-posted=month` amplía la búsqueda a avisos de hasta 30 días (default: una semana).

Prueba del 19/10 con `--actor=valig` (2 búsquedas × 100 filas, crédito gratis de octubre): 200 filas, todas con descripción completa y en Argentina. Pasaron el filtro 185; los otros 15 quedaron `fuera_de_area`. Hubo 66 avisos nuevos y 103 que ya estaban: «data analyst» y «analista financiero» ya se habían buscado antes. Gasto real: US$0,082, unos US$0,41 cada 1.000 filas.

## Guardado por tanda (desde el 19/10/2026)

Hubo una corrida de Google Jobs (17/10) cuyas búsquedas se perdieron por un conflicto al guardar (#51). Para la compra paga, Apify escribe `inventory.json` y el ledger en disco después de **cada** búsqueda, no sólo al final. El paso "Importar" tiene un tope de 135 minutos, menor que el del job (150). Así, si una búsqueda cuelga o el job se corta, el paso "Guardar inventario y consumo" (`always()`) commitea lo ya pagado. Probado con una Apify simulada que cuelga en la segunda búsqueda: la primera quedó guardada, sin duplicar avisos ni filas del ledger. Además, el workflow comparte el grupo de concurrencia con la sync diaria, así que nunca escriben el inventario a la vez. Los datasets de cada corrida quedan en Apify (el `runId` está en el ledger) por si hubiera que recuperarlos.

## Inventario en dos archivos (desde el 19/10/2026)

Después de la tanda 1, `inventory.json` llegó a 52,6 MB. GitHub avisa desde 50 MB y rechaza archivos de más de 100 MB. Con 9.000 avisos más se habría pasado el límite y el push se habría rechazado, sin guardar lo comprado. Ahora el inventario se guarda en dos archivos (`src/lib/match/inventory-file.ts`):
- `inventory.json`: bolsas de empleadores y metadatos, 37 MB al migrar.
- `inventory-imported.json`: avisos de Apify, Google Jobs y Fantastic, 18 MB al migrar.

Al leer se juntan, y un inventario viejo de un solo archivo se sigue leyendo. Los dos workflows commitean los dos archivos. Si `inventory-imported.json` se acerca a 90 MB, hay que partirlo por fuente.

## Calidad de los avisos de LinkedIn vía valig (19/10/2026)

- **Descripciones:** valig trae `description` en texto plano, sin saltos de línea («Job DescriptionWe have…»). Con ese texto no se separan requisitos de deseables, y los avisos de la tanda 1 quedaron con 0% de requisitos detectados. Ahora se usa `descriptionHtml`, que conserva párrafos y listas. Con los datos ya pagados de la tanda 1, los requisitos detectados pasan al 76% (las otras fuentes rondan el 70%), el seniority al 90% y la modalidad al 68%.
- **Releer sin pagar:** `mode=refetch args=--since=AAAA-MM-DD` vuelve a leer los datasets de las corridas de LinkedIn del ledger y los importa con la normalización actual. Leer un dataset no cobra filas. Cada corrida se aplica con su propia hora y en orden, así no cambia la última vez que se vio cada aviso.
- **Logos:** valig no trae logo. Se suman `KNOWN_DOMAINS` (`logos.ts`) con el sitio oficial de empleadores frecuentes (EY, JPMorganChase, Chevron, Despegar, dLocal, KPMG, Google…) para mostrar su ícono. Los grupos elegibles con logo pasan del 45% al 62%.
- **Tareas de IA:** «Software Engineer (AI Training)» o «Ingeniero de Software (Entrenamiento de IA)» (Alignerr) pasan a la familia de IA por proyecto, que el filtro de importación deja afuera (`EXTRACTION_VERSION` 16).
- **Duplicados:** 328 de las 1.335 oportunidades con LinkedIn ya se agrupan con el mismo puesto de otra fuente (Fantastic, Greenhouse, SuccessFactors, Workday, Lever, Ashby): no aparecen dos veces.
- **Vigencia:** la revisión diaria de importados reconoce el «No longer accepting applications» de LinkedIn.

## Próximas corridas recomendadas

1. **Fantastic:** no hay más corridas posibles sin plan pago, y el pago está descartado.
2. **Google Jobs, una vez por mes** (cuando se renueva el plan gratuito): `provider=serpapi mode=run args=--max-searches=80 --reserve=20 --queries=…`. Conviene elegir las tandas que más rindieron:
   - tanda 2 (`*2-*`, atención/ventas/administrativo en el interior);
   - tanda 5 (`*5-*`, oficios);
   - las de ciudades de la tanda 4.

   Los avisos de Google Jobs vencen a los 21 días sin volver a verse: sin la corrida mensual, el catálogo vuelve a achicarse.
3. **Apify:** el tope aprobado (US$5 reales) está casi usado. Para seguir hace falta una aprobación nueva del dueño. Después se corre con `--budget-source=account`. Si se aprueba, Computrabajo es lo que más rinde para el interior.
4. **Directorio gratuito:** revisar `data/match/providers-discoveries.json` después de cada corrida de Fantastic. Los empleadores con `supported` se suman a `companies.json` y quedan en la sync diaria para siempre. Los que usan Workday, Teamtailor, SuccessFactors o Workable (la mayoría) necesitan conectores nuevos: ver PENDIENTES.

## Corrida por verticales (17/10/2026, 22:02 UTC)

Google Jobs (SerpApi, plan gratuito): 15 búsquedas `v-…` de las 16 preparadas para las verticales con poca oferta. Antes de correr quedaban 35 búsquedas del plan; quedan 20 de reserva.

| Búsqueda | Filas | Aceptadas |
| --- | ---: | ---: |
| docente Buenos Aires | 10 | 4 |
| profesor de inglés Córdoba | 5 | 3 |
| arquitecto Buenos Aires | 10 | 8 |
| jefe de obra Argentina | 10 | 10 |
| maestro mayor de obras Córdoba | 0 | 0 |
| asesor inmobiliario Rosario | 10 | 6 |
| diseñador gráfico Buenos Aires | 10 | 7 |
| editor de video Argentina | 10 | 6 |
| community manager Córdoba | 10 | 6 |
| oficial de cuentas banco Argentina | 0 | 0 |
| productor asesor de seguros | 5 | 2 |
| analista de riesgo crediticio Buenos Aires | 10 | 6 |
| enfermero Buenos Aires | 10 | 6 |
| farmacéutico Córdoba | 0 | 0 |
| administrativo de salud Mendoza | 3 | 2 |
| **Total** | **103** | **66** (+53 nuevos, 12 actualizados) |

Rechazos: 36 sólo ofrecían agregadores secundarios y 1 tenía descripción corta. El plan gratuito se renueva a principio de mes: ahí se pueden repetir las búsquedas sin resultados con otra redacción ("maestro mayor de obras", "oficial de negocios banco", "farmacia Córdoba").

## Corrida automática de marketing y finanzas (desde 17/10/2026)

El workflow `match-providers` corre solo los días 2 y 17 de cada mes a las 10:07 UTC, después de la sync diaria: Google Jobs (plan gratuito de SerpApi) con la tanda `--queries=mensual`, que son las búsquedas `mk-…` (14 de marketing), `fz-…` (16 de finanzas) y `tj-…` (6 de tecnología junior), `--max-searches=36 --reserve=20`. Usa como máximo 72 de las 250 búsquedas del mes y nunca toca la reserva. Dos corridas por mes porque los avisos de Google Jobs vencen a los 21 días sin volver a verse. Se puede lanzar a mano igual que antes; a mano sigue empezando en modo "plan".

