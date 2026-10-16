# Apify: conexión y piloto de avisos argentinos

Revisado el 16/10/2026. Se siguió https://apify.com/agents.md. MCP de Codex registrado en `https://mcp.apify.com` con OAuth y verificado con búsquedas y ejecuciones reales. La app usa el cliente oficial `apify-client`; el token para CLI se configura aparte en `APIFY_TOKEN`, nunca en el navegador ni en argumentos.

**Continuación vigente:** [estrategia](ESTRATEGIA-AVISOS.md) y [plan](PLAN-AVISOS.md). Este documento describe el piloto histórico, no aprueba nuevas corridas ni una frecuencia permanente. El dueño descartó el abono de Fantastic de US$95 y autorizó aprovechar sólo su trial gratuito; eso no amplía el permiso anterior de Apify. Las [muestras y métricas](research/avisos-2026-10-16/README.md) ya están en el repo para reutilizarlas.

## Prueba realizada

Se autorizaron hasta US$0,50 para una prueba sin recurrencias. Consulta común: **analista, Argentina**, hasta 50 resultados por fuente. LinkedIn e Indeed limitaron publicación a la última semana; el Actor de Computrabajo se evaluó con su búsqueda por palabra y se filtraron avisos antiguos al normalizar.

| Fuente / Actor | Precio por 1.000 resultados en cuenta FREE | Recibidos | Aceptados | Descartes |
| --- | ---: | ---: | ---: | --- |
| [LinkedIn, curious_coder](https://apify.com/curious_coder/linkedin-jobs-scraper) | US$2 + inicio | 50 | 49 | 1 descripción de menos de 300 caracteres |
| [Indeed, curious_coder](https://apify.com/curious_coder/indeed-scraper) | US$0,10 + inicio | 44 | 42 | 1 sin empresa, 1 descripción corta |
| [Computrabajo, shahidirfan](https://apify.com/shahidirfan/Computrabajo-Jobs-Scraper) | US$1,49 + inicio | 50 | 34 | 15 de más de 30 días, 1 descripción corta |

Los 125 avisos aceptados se agrupan en **123 oportunidades y 94 empresas**. Al aplicar también la agrupación visual que usa la web, quedan **122 grupos**; el cruce con el inventario identifica 122 grupos adicionales. Es una muestra acotada a “analista”; no mide cobertura nacional ni prueba qué porcentaje de todo el mercado se obtiene.

Ejecuciones terminadas en SUCCEEDED y datasets descargados y evaluados:

| Fuente | Run | Dataset | Tope configurado |
| --- | --- | --- | ---: |
| LinkedIn | NZCsRQZKTa1Xpmhgu | xWsvDMVBRjitYVzXi | US$0,20 |
| Indeed | ddcdykwxgz4ea5dmS | Yfqsr0hzihvcdbOuW | US$0,05 |
| Computrabajo | 8SEpu5TIfxkzbgPS0 | 15hDI5SrOKyZ2EgBc | US$0,20 |

Estimación según resultados y tarifas: aproximadamente **US$0,18**, más los cargos de inicio según memoria. Los topes suman US$0,45, dentro del permiso de US$0,50. El total facturado debe verificarse en Apify; la respuesta compacta del MCP no incluye ese importe.

## Qué mejora y qué falta

LinkedIn e Indeed ofrecen descripciones largas (medianas 3.383 y 2.838 caracteres), empresas y fechas. Computrabajo amplía empleadores locales y ubicaciones del interior; su mediana de descripción es 1.722 caracteres, pero exige filtrar antigüedad. Los salarios crudos pueden ser “A convenir” o números de prueba: no se convierten en rangos confiables. LinkedIn tiene applyUrl vacío en parte de la muestra; el aviso original funciona como destino.

Las reglas de clasificación mejoraron con títulos locales explícitos: “Otros” pasa de 66 a 15 oportunidades de esta misma muestra. No se fuerza una familia para títulos ambiguos. También se corrige “10–15 años” para tomar 10 como mínimo y “Semi Senior” para conservar su nivel. La versión de extracción forma parte del hash: el inventario existente se recalcula al recibir nuevamente cada aviso.

La recomendación inicial de sumar LinkedIn + Indeed a un piloto mayor quedó pendiente de presupuesto y medición marginal; no constituye una elección de fuentes diarias. El plan vigente reutiliza estos datasets, amplía primero la base gratuita y compara utilidad para perfiles concretos. Bumeran, ZonaJobs y HiringRoom requieren una evaluación específica antes de afirmar cobertura generalista. Deduplicar después de la extracción mejora el producto, pero no evita pagar resultados repetidos: la frecuencia y la ventana temporal deben presupuestarse.

## Uso del comando

Por defecto no hace llamadas ni consume créditos:

```sh
npm run match:apify -- --source=linkedin
```

Evaluar un archivo ya descargado (array JSON o `{ "items": [...] }`):

```sh
npm run match:apify -- --source=indeed --file=work/indeed.json --out=work/indeed-candidate.json
```

Recuperar resultados de una ejecución existente sin iniciar otra:

```sh
npm run match:apify -- --source=linkedin --run-id=NZCsRQZKTa1Xpmhgu --out=work/linkedin-candidate.json
```

Sólo con el presupuesto correspondiente autorizado, token en el entorno y revisión vigente del Actor:

```sh
npm run match:apify -- --source=linkedin --keyword=analista --max-items=50 --budget-usd=0.20 --run --out=work/linkedin-candidate.json
```

El piloto admite 1–50 resultados y un tope de hasta US$0,50 por ejecución. El monto total de varias ejecuciones sigue siendo responsabilidad de quien las autoriza; no representa un presupuesto diario. Los topes son opciones de ejecución del Actor, no campos del input. El comando valida SUCCEEDED y la identidad del Actor antes de leer el dataset; una falla no publica datos incompletos. Conserva las URLs identificadas por `jk` en Indeed y `oi` en Computrabajo. Rechaza enlaces con protocolos inseguros o credenciales, avisos vencidos, sin empresa, sin país confirmado o con descripción corta. No conserva atributos personales de reclutadores, fotos ni edades.

La salida es un **inventario candidato separado**. No reemplaza `data/match/inventory.json`, no enciende cron y no modifica el registro de fuentes gratuitas. Para activar ingestión productiva hay que fijar presupuesto y consultas, configurar el secreto en el runner, revisar el uso permitido de cada portal y conectar importación, vencimientos y monitoreo con la sincronización existente. Comprar acceso al scraper no equivale a una licencia de republicación del portal.
