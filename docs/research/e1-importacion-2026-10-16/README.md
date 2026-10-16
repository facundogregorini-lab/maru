# Primera importación de proveedores, medida contra E0 (16/10/2026, noche)

Mismos perfiles que [E0](../e0-2026-10-16/README.md): `perfiles.json` es una copia sin editar. El catálogo es `main` después de las tres importaciones, re-analizado con las reglas de esta PR (modalidad declarada en el texto, `EXTRACTION_VERSION` 3, ajustes de ranking de [e1-ranking](../e1-ranking-2026-10-17/README.md)). Reproducir con `MATCH_INVENTORY_PATH=<inventario re-analizado> npx --yes tsx@4 scripts/e0-baseline.ts docs/research/e1-importacion-2026-10-16`.

## Qué se importó (ledger: `data/match/providers-ledger.json`)

| Fuente | Configuración | Recibidos → aceptados → nuevos | Consumo |
| --- | --- | --- | --- |
| Google Jobs (SerpApi) | 12 búsquedas generalistas por ciudad, `gl=ar`, primera página | 115 → 89 → 88 | 12 de 248 búsquedas del plan gratuito |
| Fantastic ATS + LinkedIn | Cohortes G1/G2/T1, Argentina, 7 días, hasta 60 por pedido | 273 → 272 (97 ATS, 175 LinkedIn) | 273 de 450 créditos del trial; 7 requests |
| Apify Computrabajo | 10 palabras generalistas × 100 | 1.000 → 575 | Gasto real total de Apify: US$2,73 (la cuenta pasó de US$0,18 a US$2,91) |
| Apify LinkedIn | 6 palabras × 100 | 599 → 517 | (incluido arriba) |
| Apify Indeed | 10 palabras × hasta 100 | 314 → 0 | Error de campos anidados, corregido en esta PR |

Rechazos de Apify: 320 vencidos o con más de 30 días, 314 sin campos obligatorios (Indeed), 19 con descripción corta. De Google Jobs se descartaron 24 filas que sólo ofrecían agregadores secundarios.

## Catálogo

| | E0 | Ahora |
| --- | ---: | ---: |
| Grupos visuales abiertos | 6.439 | 7.759 |
| Grupos elegibles desde Argentina | 909 | **2.229** |
| Empleadores con algún grupo elegible | 90 | **847** |
| Elegibles junior | 37 | 215 |
| Elegibles publicados en los últimos 7 días | 66 | 1.048 |

## Perfiles

| Perfil | Oferta del área (empleadores) | Top 10: seniority / ubicación | Empresas en el top 20 |
| --- | --- | --- | --- |
| G1-adm-contable-jr | 34 (16) → **349 (239)** | 5/10 → 6/8 | 10 → 17 |
| G1-finanzas-ssr | 34 (16) → **349 (239)** | 4/4 → 8/6 | 14 → 19 |
| G1-rrhh-ssr | 38 (17) → **155 (101)** | 4/6 → 7/6 | 12 → 18 |
| G2-ventas-jr | 74 (23) → **348 (216)** | 8/9 → 9/10 | 11 → 19 |
| G2-logistica-ssr | 4 logística + 61 operaciones → **168 logística + 95 operaciones (160)** | 7/5 → 6/2 | 10 → 19 |
| T1-dev-ssr | 254 (54) → 346 (124) | 8/10 → 7/10 | 6 → 14 |
| G1-atencion-jr (reserva) | 26 (14) → 83 (59) | 2/10 → 2/6 | 13 → 18 |
| T1-datos-jr (reserva) | 42 (17) → 71 (44) | 3/7 → 6/4 | 10 → 19 |

En la lectura del top 5:
- Administración contable en Córdoba pasó de remotos internacionales y un proyecto de IA a **avisos locales de Córdoba** (In.Corporate, Nexo Group) y analistas contables en Argentina.
- Finanzas en Rosario muestra Milicic, Grupo FYO y Afa en Rosario.
- Logística pasó de 0 útiles de 5 a analistas de logística reales (Louis Dreyfus, Danone, ITT, Newsan).

"Ubicación posible" baja en logística, atención y datos porque ahora hay muchos avisos presenciales en Buenos Aires y otras ciudades. Antes casi todo era remoto. Esos avisos no se ocultan: si no informan modalidad, pesan menos (×0,88; ×0,75 si la ubicación es indispensable) y muestran "Se publica en X y no aclara si es remoto". La oferta local del interior sigue siendo el hueco principal: Tucumán y Mendoza tienen pocos avisos en todas las fuentes.

## Límites y próximos pasos

- La mitad de los avisos de Computrabajo y LinkedIn no declara modalidad. Se infiere sólo de frases explícitas ("Modalidad: presencial", "100% home office"); un "home office los viernes" como beneficio no cuenta.
- El header de saldo de Fantastic llegó cacheado (decía 390 cuando quedaban ~177): esta PR descuenta lo consumido. Quedan ~177 créditos para un segundo corte antes del vencimiento del trial (~23/10).
- Indeed se puede reintentar con el arreglo de campos: es el más barato (~US$0,01 por cada 100 filas).
- Los avisos importados vencen solos (30 días; 21 en Google Jobs). Google Jobs se puede repetir cada mes con el plan gratuito.
