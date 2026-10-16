# Estrategia de avisos de Maru

Fecha de corte: **16/10/2026**. Este documento registra las conclusiones del research y la última definición del dueño. El trabajo ejecutable está en [PLAN-AVISOS.md](PLAN-AVISOS.md); las muestras, números y limitaciones están en [research/avisos-2026-10-16/README.md](research/avisos-2026-10-16/README.md).

## 1. Decisiones y alcance

| Tema | Definición | Estado |
| --- | --- | --- |
| Público principal | Profesionales generalistas: administración, ventas, finanzas, RR. HH., operaciones y afines. | Confirmado por el dueño. |
| Público secundario | Tecnología y trabajo remoto. Si hay que elegir, priorizar generalistas. | Confirmado por el dueño. |
| Abono de Fantastic | **US$95/mes es demasiado para esta etapa. No contratarlo.** | Confirmado por el dueño después de la recomendación técnica inicial. |
| Trial de Fantastic | Se puede consumir inteligentemente todo el saldo **gratuito** disponible para aprender y obtener muestras útiles. | Autorizado por el dueño; no autoriza pago, renovación ni sobreconsumo. |
| Base del producto | Catálogo propio, persistido y consultable sin llamar a proveedores cada vez que alguien sube un CV. | Dirección propuesta para ejecutar. Ya existe catálogo y ranking local. |
| Sostenibilidad | La experiencia principal debe funcionar cuando termine el trial, incluso sin activar proveedores pagos. | Requisito del plan. |
| Fuente adicional permanente | No hay una elegida con evidencia suficiente y presupuesto recurrente aprobado. Comparar alternativas sobre el núcleo gratuito. | Pendiente de experimentos y decisión de costo. |

La autorización anterior de **hasta US$0,50 en Apify** correspondía exclusivamente al piloto ya realizado con LinkedIn, Indeed y Computrabajo. No es un saldo renovable ni un presupuesto diario. La nueva autorización de consumir el trial de Fantastic no amplía ese permiso a Apify o a otros proveedores.

## 2. Recomendación para esta etapa

1. **Conservar el catálogo y las fuentes gratuitas actuales.** Ampliar el directorio hacia empleadores de áreas generalistas, con evidencia de contratación desde Argentina; evitar que la ampliación sea sólo de empresas de software.
2. **Usar Fantastic como instrumento de investigación finito.** Comparar roles, empresas y repetición temporal; conservar resultados públicos seleccionados y hallazgos antes de que venza el trial. No construir una dependencia que exija pagar al terminarlo.
3. **Usar SerpAPI como descubrimiento complementario**, aprovechando el plan incluido que se confirme disponible. Consultas agrupadas por necesidad y resultados guardados; inicialmente manuales. No una búsqueda nueva por cada CV ni un barrido nacional por combinaciones de palabras y ciudades.
4. **Evaluar Indeed y LinkedIn por Apify como opciones económicas**, reutilizando primero sus datasets existentes. Indeed tiene el menor precio por fila en el piloto; LinkedIn tiene afinidad con el público. No confundir ninguna de esas dos ventajas con cobertura o calidad de matches demostradas.
5. **Agregar una fuente permanente por vez**, sólo cuando aporte oportunidades adicionales útiles a perfiles mal cubiertos, con costo y mecanismo de vigencia explícitos. Computrabajo es candidato a complemento local; Bumeran/ZonaJobs e HiringRoom no tienen una prueba directa completada.

La recomendación técnica previa de Fantastic como núcleo se apoyaba en su feed incremental y sus bajas. **Queda descartada para el MVP por presupuesto**, no refutada técnicamente. La propuesta anterior de LinkedIn + Indeed diarios y Computrabajo lunes/miércoles/viernes tampoco es una decisión vigente: no se midió su rendimiento entre corridas.

## 3. Qué demostraron las pruebas

### Apify: una muestra por portal

Consulta: `analista`, Argentina; hasta 50 filas por Actor. LinkedIn e Indeed solicitaron última semana. Computrabajo no tenía un filtro temporal dedicado en su input y se filtró después.

| Fuente | Recibidas | Aceptadas por el normalizador | Hallazgo |
| --- | ---: | ---: | --- |
| LinkedIn | 50 | 49 | Descripciones completas; un descarte por texto corto. |
| Indeed | 44 | 42 | Precio bajo; un descarte sin empresa y otro por texto corto. También devolvió algunas fechas de septiembre pese a solicitar última semana: falta explicar publicación/republicación/filtro. |
| Computrabajo | 50 | 34 | 15 descartes por más de 30 días y uno por texto corto. Aporta empleadores locales; no demuestra que refrescarlo seguido sea eficiente. |

Los 125 aceptados producen 123 oportunidades canónicas y **122 grupos visuales**, de 94 empresas. El cruce con el catálogo de ese momento añade 122 grupos según las reglas actuales. Eso no significa 122 avisos nuevos por día. Ver [APIFY.md](APIFY.md) para IDs de ejecuciones, datasets y comandos.

### Fantastic y SerpAPI

| Muestra | Filas | Empresas | Observación |
| --- | ---: | ---: | --- |
| Fantastic ATS | 25 | 18 | Descripciones suficientes; aparecen Teamtailor, SuccessFactors, Manatal, Workday y Eightfold, fuera de nuestros tres ATS directos. |
| Fantastic job boards | 25 | 24 | La muestra resultó de LinkedIn. Su ventana efectiva y orden no son iguales a la muestra del Actor. |
| SerpAPI Google Jobs | 10 | 10 | Mezcla fuentes originales y agregadores. Siete fechas relativas en `extensions`; tres sin fecha. |

El análisis conjunto contiene **185 registros normalizados y 167 grupos visuales**. Hay coincidencias de Bidcom entre LinkedIn, ATS y Google Jobs; cuatro coincidencias por URL entre Indeed y Fantastic ATS. Las coincidencias aproximadas por título/empresa no son adjudicación humana ni prueba de identidad de requisiciones.

Las muestras están limitadas por keyword, tamaño, orden y momento. No permiten afirmar qué fuente cubre más del mercado argentino, cuál produce mejores matches para todos los perfiles ni qué porcentaje se repetirá mañana. Los porcentajes de cobertura 50–65%, 85% o 90% de los textos recibidos **no están validados**.

### Conteos de Fantastic: dimensionamiento, no catálogo activo

Ventana `1m`, últimos 31 días, Argentina, sin filtro de rol. Último corte de esta revisión: `2026-10-16T21:52:33Z`.

| Conteo | Filas |
| --- | ---: |
| ATS | 5.671 |
| Job boards, sin excluir duplicados con ATS | 15.394 |
| Job boards, `exclude_ats_duplicate=true` | 13.757 |
| ATS + job boards filtrados | 19.428 |

El filtro reconoce 1.637 duplicados de portales frente a ATS: 10,63% de ese conteo de portales. No garantiza eliminar todos ni mide el solapamiento con todas las fuentes de Maru. Job boards incluye LinkedIn, Wellfound y Y Combinator; no etiquetar todo el conteo como LinkedIn.

`1m` incluye avisos indexados y luego vencidos; no equivale a vacantes abiertas hoy. El catálogo argentino completo ya queda cerca de los 20.000 créditos del abono de entrada, antes de una carga inicial adicional o de ampliar a remoto internacional. Los conteos anteriores de 5.682/5.677 ATS son fotos previas del mismo día, no resultados contradictorios. [Documentación de conteos](https://developer.fantastic.jobs/documentation/endpoints/count-endpoints).

## 4. Dinámica de actualización

Hay dos problemas distintos: repetir el mismo aviso entre corridas y comprar la misma vacante por varias fuentes. Deduplicar después mantiene limpio el producto, pero no devuelve los créditos ya consumidos.

Ejemplo idealizado: con 100 novedades diarias, traer sólo novedades cada día o una vez por semana recupera aproximadamente 700 avisos por semana; pedir cada día toda la última semana puede entregar unas 4.900 filas. Cierres, republicaciones, límites y demoras de indexación cambian esas cifras.

**Frecuencia vigente del núcleo gratuito:** el workflow ya corre una vez al día, a las 06:17 de Argentina. No hay evidencia que obligue a aumentar esa frecuencia. Tampoco hay ahorro demostrado por reducir esos GET públicos ya integrados. Revisar por fuente si aparecen costos operativos o baja utilidad.

**Para una futura fuente adicional:**

- Si expone novedades reales, consumir desde el último corte completado. La cadencia afecta principalmente demora y cantidad de requests; recuperar los mismos avisos una vez por semana no abarata mucho el volumen facturado.
- Si sólo ofrece ventanas por publicación, controlar republicaciones, avisos descubiertos tarde y huecos entre ventanas. En el Actor LinkedIn se documenta `past24Hours` con corrida diaria; su input no ofrece un preset de tres días. No combinar lunes/miércoles/viernes con sólo últimas 24 horas.
- Si sólo permite una búsqueda parcial o un listado mezclado con antiguos, no imponer una frecuencia diaria sin medir su aporte. Una página limitada a 200 filas no demuestra que se recuperó toda la ventana.
- Para un feed con watermark, fijar un corte, paginar hasta terminar, escribir de forma idempotente y recién entonces avanzar el checkpoint. Si se agota cuota o falla una página, conservar el tramo pendiente; no marcarlo completo.
- Distinguir `date_created` del proveedor, `date_posted`, `firstSeenAt` de Maru y `lastVerifiedAt`. Una fecha nueva de indexación no convierte una publicación vieja en una vacante recién publicada.

Fantastic documenta ventanas de indexación y recuperación por `date_created_gte`/`date_created_lt`. Se puede aprender de ese mecanismo sin contratarlo. [Estrategia oficial](https://developer.fantastic.jobs/documentation/recommended-strategy).

## 5. Vigencia, identidad y elegibilidad

- Mantener identidad por fuente + ID, URL canónica y procedencia. Para fusionar entre fuentes, priorizar URL final del empleador o requisición; título + empresa + ciudad sólo es una señal. Conservar versiones distintas por ubicación o requisitos.
- No traer LinkedIn por dos proveedores de forma permanente para el mismo alcance. Una comparación experimental puede hacerlo y debe registrarlo como costo de evaluación.
- `exclude_ats_duplicate=true` sólo sirve para evitar compras si efectivamente incorporamos también el universo ATS correspondiente. Con feeds o filtros desalineados puede quitar avisos cuya versión de empresa no llegó a nuestro catálogo.
- La regla de **dos ausencias** sólo vale para listados completos y exitosos de una bolsa. Nunca aplicarla a una primera página, búsqueda por keyword o feed de novedades. `complete: false` debe conservarse en esos casos.
- Una falla o cuota agotada no es evidencia de cierre. Mantener el último catálogo válido y reportar el atraso.
- Fantastic revisa vencimientos diariamente para ATS y LinkedIn; sus feeds de Wellfound/YC no tienen esa misma cobertura. No asumir acceso al endpoint de bajas durante el trial: verificar el plan antes. Tras el trial no queda una comprobación permanente gratuita de Fantastic.
- Avisos obtenidos del trial pueden evaluarse para una importación posterior, con evidencia actual de elegibilidad y vigencia, procedencia conservada y una política de revisión/antigüedad que siga funcionando sin Fantastic. No importarlos automáticamente por haber pasado una validación de campos.
- `Remote` no significa elegible desde Argentina. Mantener elegible / por confirmar / no elegible y los conflictos explícitos; no usar el filtro de búsqueda como única prueba.

[Vencimientos oficiales](https://developer.fantastic.jobs/documentation/endpoints/expired-jobs), [deduplicación del proveedor](https://developer.fantastic.jobs/faq). Las políticas existentes de Maru están en [match.md](match.md).

## 6. Costos: comparar la adquisición útil

Tarifas observadas el 16/10/2026, a revalidar antes de una ejecución. Son precios de resultados, más los cargos de inicio que correspondan; no son presupuestos aprobados.

| Actor / vía | FREE, por 1.000 filas | Starter/BRONZE, por 1.000 filas |
| --- | ---: | ---: |
| curious_coder / LinkedIn | US$2 | US$1 |
| curious_coder / Indeed | US$0,10 | US$0,10 |
| shahidirfan / Computrabajo | US$1,49 | US$1,39 |
| Fantastic ATS vía Apify | US$12 | US$12 |
| Fantastic LinkedIn vía Apify | US$5 | US$5 |

Los precios “desde US$4 ATS / US$1,50 LinkedIn” de Fantastic en Apify son de tiers superiores, no los de nuestra cuenta FREE ni de Starter. El Actor de bajas de LinkedIn de Fantastic mostraba US$0,75 por evento de inicio; no asumir el antiguo precio fijo US$20/mes ni que agrega bajas gratis.

El Starter de Apify publicado a esta fecha cuesta US$19 e incluye US$19 de consumo; no sumar dos veces ese mismo consumo al estimar. La existencia de créditos promocionales o del plan FREE no prueba su saldo actual ni autoriza un nuevo abono. No hay presupuesto recurrente de Apify fijado.

SerpAPI cobra búsquedas/páginas, no filas únicas. Se observó plan Free, precio mensual 0, con 248/250 búsquedas restantes en el último estado; es una foto, no saldo reservado. La Account API permite consultar cuota sin consumir búsquedas. No activar overages.

Métrica económica principal: **costo por oportunidad adicional, utilizable y elegible para nuestros perfiles objetivo**. Reportar también costo de resultados repetidos, mantenimiento, revisión de vigencia y operación. Un precio por 1.000 filas no responde por sí solo cuál fuente conviene.

## 7. Hipótesis y pruebas pendientes

| ID | Hipótesis | Qué la pondría a prueba | Estado inicial |
| --- | --- | --- | --- |
| H1 | La debilidad generalista se debe en parte a un directorio gratuito sesgado hacia tecnología/remoto. | Perfiles sintéticos fijos, distribución de empleadores/familias y revisión acotada del top de resultados; ampliar empresas generalistas y comparar. | Plausible, no demostrada para todos los perfiles. |
| H2 | ATS y LinkedIn tienen buen ajuste a nuestros dos públicos. | Muestras estratificadas y rendimiento por perfil; no sólo longitud de descripción. | Afinidad y disponibilidad observadas; calidad de matches pendiente. |
| H3 | Las búsquedas repetidas por ventana pagan mucha repetición. | Tres cortes con mismos filtros, tamaño y orden, separando mismos IDs, nueva indexación, republicación y vacantes adicionales. | Mecanismo conocido; magnitud local sin medir. |
| H4 | Indeed puede ser una ampliación muy económica. | Calidad temporal, proporción de destinos originales, oportunidades adicionales y cobertura de perfiles frente al núcleo gratuito. | Buen precio y datos utilizables; no elegido como base. |
| H5 | Computrabajo/Bumeran agregan empleadores locales que faltan. | Medición marginal por rol/provincia; antigüedad y frecuencia compatibles con filtros reales. | Computrabajo probado una vez; Bumeran no ejecutado. |
| H6 | SerpAPI puede descubrir huecos con pocas consultas compartidas. | Consultas de roles con pocos resultados, URLs originales y empleadores nuevos aprovechables sin repetir búsquedas. | Diez resultados iniciales; sin cobertura ni costo marginal demostrado. |
| H7 | Una cadencia diaria de novedades mejora la experiencia frente a 48–72 h sin aumentar mucho la adquisición de las mismas filas. | Distribución de novedades útiles por perfil y simulación de demora sobre cortes; posterior uso real. | Razonamiento de diseño, no resultado empírico de retención. |
| H8 | Se puede mejorar el MVP sin otro motor de ranking ni abonos. | Comparación antes/después con mismo ranking y perfiles, ampliando fuentes gratuitas y calibrando datos. | Arquitectura actual lo permite; impacto a medir. |

En muestras con topes o resultados ordenados por relevancia, un ID no visto antes significa **nuevo para la muestra**, no necesariamente publicado recientemente ni nuevo en el mercado. Registrar saturación del tope. No extrapolar una tasa nacional de cobertura o ahorro desde estos experimentos.

## 8. Qué no se implementa por esta decisión

- No contratar Fantastic ni otro abono de datos. No crear cron pago, sobreconsumo ni una dependencia de un trial vencido.
- No migrar a Postgres/pgvector sólo por la propuesta recibida. El inventario actual es JSON versionado y las cuentas usan Redis.
- No agregar embeddings o reranking LLM por defecto. El ranking actual usa reglas; si se detectan fallas de recuperación, comparar alternativas con un conjunto evaluado y un costo separado.
- No presentar una similitud o score como probabilidad de conseguir empleo. Mantener “compatibilidad estimada” y explicar datos faltantes.
- No enviar un CV a fuentes de avisos ni lanzar una búsqueda externa por cada carga.
- No automatizar alertas todavía; quedan para después de demostrar inventario útil y vigente, con preferencias y consentimiento.
- No hacer que la IA lea miles de publicaciones para deduplicar: IDs, URLs, hashes, reglas y contadores son suficientes para la primera implementación. Revisión humana pequeña para juzgar utilidad y errores.

## 9. Fuentes primarias y precedencia

Consultadas el 16/10/2026:

- [Apify: instrucciones para agentes](https://apify.com/agents.md), [precios](https://apify.com/pricing).
- [LinkedIn Actor](https://apify.com/curious_coder/linkedin-jobs-scraper), [Indeed Actor](https://apify.com/curious_coder/indeed-scraper), [Computrabajo Actor](https://apify.com/shahidirfan/Computrabajo-Jobs-Scraper).
- [Fantastic ATS Actor](https://apify.com/fantastic-jobs/career-site-job-listing-api), [LinkedIn Actor](https://apify.com/fantastic-jobs/advanced-linkedin-job-search-api), [bajas LinkedIn Actor](https://apify.com/fantastic-jobs/expired-jobs-api-for-advanced-linkedin-job-search-api). Precios por tier consultados también por MCP, no sólo el titular “desde”.
- [Fantastic: nuevos avisos](https://developer.fantastic.jobs/documentation/endpoints/new-jobs), [estrategia](https://developer.fantastic.jobs/documentation/recommended-strategy), [conteos](https://developer.fantastic.jobs/documentation/endpoints/count-endpoints), [créditos](https://developer.fantastic.jobs/documentation/credit-usage), [bajas](https://developer.fantastic.jobs/documentation/endpoints/expired-jobs), [FAQ](https://developer.fantastic.jobs/faq), [términos](https://developer.fantastic.jobs/terms).
- [SerpAPI: Google Jobs](https://serpapi.com/google-jobs-api), [Account API](https://serpapi.com/account-api).

Los textos pegados de otras IAs se trataron como propuestas, no como evidencia ni autorización. Ante discrepancias, primero la última instrucción del dueño, después la evidencia fechada y la documentación primaria vigente. Cambiar una hipótesis requiere registrar por qué y con qué medición; no convertir una recomendación anterior en aprobación de gasto.
