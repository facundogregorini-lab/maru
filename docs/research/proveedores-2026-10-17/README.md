# Proveedores: gasto, avisos, verticales y duplicación (17/10/2026)

Generado con `npm run match:report -- --apify-real-usd=4.557 --out=docs/research/proveedores-2026-10-17/reporte.json`, sobre el inventario después de la sync del 17/10 (tarde). Datos completos en [reporte.json](reporte.json).

## Gasto y avisos por API

| API | Gasto | Consumo | Filas recibidas | Guardadas | Abiertas | Elegibles desde AR | Costo por aviso guardado |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| Fantastic (ATS + LinkedIn) | US$0 (trial) | 448/450 créditos | 448 | 413 | 413 | 412 | — |
| Google Jobs (SerpApi) | US$0 (plan gratuito) | 216/250 búsquedas del mes | 1.537 | 964 | 961 | 862 | — |
| Apify Computrabajo | ≈ US$2,61 | 24 corridas | 2.072 | 900 | 900 | 900 | ≈ US$0,0029 |
| Apify LinkedIn | ≈ US$1,81 | 6 corridas | 599 | 517 | 517 | 517 | ≈ US$0,0035 |
| Apify Indeed | ≈ US$0,14 | 20 corridas | 627 | 213 | 213 | 213 | ≈ US$0,0007 |
| **Total de pago** | **US$4,56** | | 5.283 | 3.007 | 3.004 | 2.904 | |
| ATS y portales gratuitos | US$0 | sync diaria | — | 10.673 | 10.368 | 1.302 | — |

- **Apify:** el total (US$4,56) es el uso real que informa la cuenta. El reparto entre Actors es un estimado: se distribuye en proporción al costo que registra el ledger por corrida, que en total estimó US$6,18.
- **Elegibles:** cuenta publicaciones cuya oportunidad se puede tomar desde Argentina. Las fuentes de pago traen casi sólo avisos elegibles porque se buscaron en Argentina. Los ATS gratuitos son en su mayoría de empresas extranjeras: de 10.368 abiertos, 1.302 son elegibles. **Hoy ~70% de las publicaciones elegibles desde Argentina (2.904 de 4.206) vienen de las APIs.**

## Por vertical (publicaciones abiertas)

| Vertical | Fantastic | Google Jobs | Apify | Gratis | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Tecnología (software, datos, producto, diseño) | 128 | 6 | 83 | 3.337 | 3.554 |
| Ventas | 74 | 202 | 388 | 1.064 | 1.728 |
| Logística y operaciones | 40 | 85 | 242 | 908 | 1.275 |
| Marketing | 5 | 2 | 19 | 630 | 656 |
| Finanzas y contabilidad | 48 | 139 | 257 | 201 | 645 |
| RR. HH. | 25 | 49 | 122 | 218 | 414 |
| Atención al cliente | 18 | 40 | 65 | 290 | 413 |
| Consultoría | 0 | 8 | 24 | 314 | 346 |
| Administración | 18 | 79 | 99 | 145 | 341 |
| Salud | 3 | 21 | 21 | 127 | 172 |
| Legal | 2 | 0 | 8 | 128 | 138 |
| Educación | 0 | 19 | 4 | 22 | 45 |
| Otros (oficios y sin clasificar) | 52 | 311 | 298 | 2.984 | 3.645 |
| **Total** | **413** | **961** | **1.630** | **10.368** | **13.372** |

Lectura:
- Tecnología y marketing vienen casi todos gratis, de los ATS.
- Finanzas, administración, RR. HH. y ventas locales vienen sobre todo de Computrabajo y Google Jobs.
- "Otros" es grande: en las APIs son los oficios (chofer, mozo, operario…) y en los ATS son puestos que el clasificador no reconoce. Ver próximos pasos.

## Duplicación

| Medida | Valor |
| --- | ---: |
| Mismo aviso en dos o más fuentes: publicaciones abiertas → oportunidades únicas | 13.372 → 13.128 (**1,8%** duplicado) |
| Mismo puesto de la misma empresa en varias ciudades: oportunidades → grupos visibles | 13.128 → 9.752 (**25,7%** agrupado) |

Por fuente: la duplicación es el porcentaje de sus avisos abiertos que también llegaron por otra fuente. "Ya estaba gratis" es la parte que ya teníamos de un ATS o portal gratuito.

| Fuente | Duplicado con otra fuente | Ya estaba gratis | Filas descartadas al importar |
| --- | ---: | ---: | ---: |
| Fantastic ATS | 37,4% | 19,6% | 7% |
| Fantastic LinkedIn | 30,8% | 2,0% | 8% |
| Apify LinkedIn | 20,1% | 2,5% | 14% |
| Apify Indeed | 19,2% | 2,3% | 66% |
| Google Jobs | 7,2% | 0,2% | 37% |
| Apify Computrabajo | 6,6% | 0% | 57% |
| ATS gratuitos (Lever, Greenhouse, Ashby) | 0,3–0,4% | — | — |

- **Filas descartadas:** filas que no quedaron guardadas. Pueden ser repetidos entre palabras clave o búsquedas, avisos fuera de Argentina, con descripción corta, viejos o (en Google Jobs) que sólo se pueden ver en agregadores. El ledger no guarda el motivo de cada fila. El log de la última tanda de Google Jobs dio 151 de 498 por "sólo agregadores".
- **Conclusión:** Computrabajo y Google Jobs traen casi sólo avisos nuevos (≤7% duplicado). Indeed es el más barato por aviso guardado, pero descarta 2 de cada 3 filas. Fantastic ATS es el que más se superpone con lo que ya teníamos gratis.
