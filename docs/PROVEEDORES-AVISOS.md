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

## Estado real antes del despliegue

Las variables están en Production. Google del dominio nuevo respondió `redirect_uri_mismatch` para `https://www.marucoach.com/api/auth/google/callback`; el dueño está agregando esa URI. Magic link falla porque falta `SMTP_URL` en Production. Las pruebas unitarias no sustituyen las mediciones reales de ambos proveedores: registrar aquí resultados después de ejecutarlas desde el panel autenticado.
