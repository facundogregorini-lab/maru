# Pruebas de Fantastic.jobs y SerpAPI

16/10/2026. Complementa el [piloto de Apify](APIFY.md). El panel privado `/match/admin` permite medir fuentes con `FANTASTIC_JOBS` y `SERP_API` sólo en servidor. Requiere sesión y email autorizado por `ADMIN_EMAILS`, origen del mismo sitio y contador compartido en Redis. Las claves de Production no se descargan al equipo ni se envían al navegador.

## Alcance y límites

- Fantastic Estado: cuatro requests de conteo para Argentina, ATS y job boards en 24h y 1m. No consume créditos de avisos. `1m` incluye indexados en 31 días que ya vencieron; no representa avisos abiertos hoy.
- Fantastic Muestra: consulta saldo primero, exige 50 créditos de avisos y dos requests disponibles, luego hasta 25 ATS y 25 job boards, `analista`, Argentina, últimos siete días. Descripción explícita en texto, sin datos de reclutadores del feed de job boards. Si faltan headers de saldo, no descarga. Sin reintentos.
- SerpAPI Estado: Account API gratuita; se filtran API key, email e identificadores privados de su respuesta.
- SerpAPI Muestra: exige al menos una búsqueda incluida en el plan. Consulta Google Jobs para `analista Argentina`, ubicación Buenos Aires, `gl=ar`, `hl=es`; hasta diez resultados de la primera página. No usa extras, paginación ni parámetros `chips`, `start` o `ltype` obsoletos.
- Tope global por proveedor en 24h: dos intentos de muestra y tres de estado, incluso entre varios administradores/deployments que comparten Redis. Los fallos cuentan. La cuota externa puede cambiar por usos simultáneos de la cuenta: evitar otras descargas durante la prueba.
- Nada se importa al inventario, no se programan ejecuciones, no se contratan planes ni se habilitan sobreconsumos. Cuotas verificadas justo antes de la muestra; no equivalen a una reserva atómica del saldo del proveedor.

Los resultados muestran sólo campos públicos seleccionados del aviso, longitud de descripción, extracto, fecha, procedencia, enlace y observaciones. Se exige empresa, título, enlace seguro, descripción de 300 caracteres y evidencia de Argentina; se excluyen vencidos y publicados hace más de 30 días. Ser remoto o aparecer en una búsqueda argentina no confirma por sí solo elegibilidad. El conteo “nuevo por URL” compara con inventario y copias de la misma muestra; no sustituye la deduplicación semántica entre portales.

## Qué confirma y qué falta de la investigación recibida

Fantastic ofrece ATS y LinkedIn en una API, ubicación normalizada, texto completo y atributos derivados: es un candidato serio para ampliar el inventario. La documentación actual lista 58 ATS y más de 200.000 empresas rastreadas. Esa cifra mundial no permite afirmar 85%, 90% ni otra cobertura de Argentina.

El plan de entrada publicado cuesta US$95/mes por 20.000 avisos y 10.000 requests; la prueba ofrece 500 avisos y 50 requests durante siete días. Los cambios de avisos requieren Pro desde US$175; vencimientos están en planes desde US$95 y se revisan diariamente. En job boards el seguimiento de vencimientos es sólo para LinkedIn. No asumir que todos estos atributos están disponibles en el trial o en cada fuente.

SerpAPI cobra búsquedas, no filas: Google Jobs devuelve hasta diez avisos por página y puede repetir enlaces de otros portales. Debe evaluarse por costo de aviso nuevo, utilizable y elegible. El plan gratuito publicado ofrece 250 búsquedas mensuales. Sirve para probar descubrimiento local; la muestra debe medir calidad, destinos y duplicados antes de usarlo como fuente principal.

Bumeran/ZonaJobs puede complementar empleo local: se encontró el Actor `blackfalcondata/bumeran-scraper`, pero no se ejecutó ni se aprobó otro gasto para él. HiringRoom requiere validar un conector/fuente concreta. No prometer cobertura de ambos por extrapolación.

## Fuentes oficiales consultadas

- [Fantastic: nuevos avisos y esquema](https://developer.fantastic.jobs/api/new-jobs)
- [Fantastic: conteos](https://developer.fantastic.jobs/api/beta)
- [Fantastic: créditos y headers de saldo](https://developer.fantastic.jobs/documentation/credit-usage)
- [Fantastic: precios y trial](https://fantastic.jobs/api)
- [Fantastic: funcionamiento](https://developer.fantastic.jobs/documentation/how-fantastic-jobs-api-works)
- [Fantastic: vencimientos](https://developer.fantastic.jobs/documentation/endpoints/expired-jobs)
- [SerpAPI: Google Jobs](https://serpapi.com/google-jobs-api)
- [SerpAPI: cuota de cuenta](https://serpapi.com/account-api)
- [SerpAPI: planes](https://serpapi.com/)

## Medición real del 16/10/2026

Las muestras se ejecutaron en los playgrounds autenticados de los proveedores, sin descargar los secretos de Vercel. El panel de Maru ya está en main (PR 27); la verificación de sus claves en Production espera habilitar la cuenta del dueño en `ADMIN_EMAILS`.

| Muestra | Filas | Con datos suficientes | Nuevas por URL frente al inventario | Empresas | Descripción mínima / mediana |
| --- | ---: | ---: | ---: | ---: | --- |
| Fantastic ATS | 25 | 25 | 25 | 18 | 1.843 / 2.976 caracteres |
| Fantastic LinkedIn | 25 | 25 | 25 | 24 | 918 / 2.323 caracteres |
| SerpAPI Google Jobs | 10 | 10 | 10 | 10 | 914 / 1.898 caracteres |

“Nuevas por URL” no es deduplicación semántica entre los pilotos ni prueba de cobertura nacional. En Google Jobs siete avisos traen antigüedad relativa dentro de `extensions` (entre uno y siete días) y tres no traen fecha. El panel conserva ese texto sin inventar timestamps y rechaza antigüedades relativas mayores a 30 días; falta validar vigencia en el sitio original antes de importarlos. Los destinos incluyen ZonaJobs, Bumeran, Computrabajo, Halaxia, Verisure, LinkedIn, Michael Page, Talent.com y Universia, junto a agregadores secundarios en opciones alternativas. Fantastic ATS aportó Teamtailor, SuccessFactors, Manatal, Workday y Eightfold, conectores que amplían los ATS directos actuales.

Consumo Fantastic confirmado en headers después de las dos muestras: 50 avisos y dos requests; saldo 450 avisos y 48 requests. Luego se realizaron cuatro conteos sin créditos de avisos: saldo esperado 44 requests. SerpAPI: una búsqueda del plan gratuito; sin paginación. Sin contratación, sobreconsumo habilitado ni recurrencias.

| Conteo Fantastic para Argentina, sin filtro de rol | ATS | Job boards |
| --- | ---: | ---: |
| Indexados en 31 días, incluidos luego vencidos (`1m`) | 5.682 | 15.394 |
| Activos de la ventana de 24h | 223 | 550 |

La suma mensual bruta es 21.076 entregas antes de deduplicar entre feeds, ligeramente superior a los 20.000 créditos del plan de entrada. Esto no obliga a contratar el siguiente plan: se puede empezar con roles/segmentos y un tope menor; medir demanda antes de cubrir todo. Es una foto del día, no una proyección garantizada del mes siguiente.

## Arquitectura para el MVP tras evaluar la propuesta de Grok

- Conservar ingesta batch y catálogo propio: ya existe un workflow diario a las 06:17 de Argentina, y subir el CV no consulta proveedores de avisos pagos.
- Mantener los ATS gratuitos existentes. Postergar fuentes útiles ya integradas encarece el MVP y reduce inventario sin beneficio demostrado.
- No sumar Postgres/pgvector todavía sólo por la recomendación. El catálogo actual es JSON versionado; Redis guarda cuentas y seguimiento. El ranking actual es explicable, con equivalencias español/inglés, habilidades, intención, seniority y preferencias, sin llamada LLM por aviso.
- Si aparecen errores de recuperación semántica, comparar embeddings contra un conjunto de perfiles/vacantes evaluado por personas. Incrustar una vez por versión de contenido y por perfil, con filtros de país/modalidad/requisitos antes de reranking. Una similitud vectorial o salida de LLM no es por sí misma un porcentaje calibrado ni probabilidad de contratación.
- Cierre por dos ausencias sólo en sincronizaciones completas y exitosas de una bolsa. El pipeline actual ya distingue completo/parcial. No aplicar esa regla a primeras páginas, consultas de keyword ni ventanas incrementales: cerrarían avisos válidos. Para feeds pagos usar vencimientos del proveedor y validación periódica del original.
- Alertas por consentimiento y preferencias, con deduplicación e inventario vigente; no se implementaron envíos ni se activaron notificaciones.
- El Starter de Apify cuesta US$19 e incluye US$19 de consumo; no vuelve ilimitados los Actors. En las fuentes probadas LinkedIn fue US$2/1.000 filas, Computrabajo US$1,49/1.000 e Indeed US$0,10/1.000, más inicios. El costo por aviso utilizable es mayor si hay antiguos, incompletos o copias.
- El volumen de 25–35 mil avisos nuevos/mes, US$30–100 de presupuesto y 50–65% de cobertura del texto recibido siguen siendo supuestos; los conteos y muestras anteriores no validan esos tres números.

Fuente adicional de precios: [Apify](https://apify.com/pricing).

Google del dominio nuevo respondió `redirect_uri_mismatch` para `https://www.marucoach.com/api/auth/google/callback`; el dueño está agregando esa URI. Después se observó sesión iniciada de `axellaban@gmail.com`, pero el panel la rechaza por `ADMIN_EMAILS`: falta incorporar esa cuenta al allowlist conservando las demás. Magic link falló por ausencia de `SMTP_URL` en Production.
