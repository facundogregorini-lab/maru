# Radar laboral — rollout y rollback

**Estado al 28/11/2026: prendido en Production sólo para la cuenta del dueño** (`RADAR_ENABLED=true` y `RADAR_ALLOWLIST` con su email; pasos 1 y 2 del rollout hechos, salvo la clave de GitHub). Para cualquier otra visita, `/radar/*` y `/api/radar/*` siguen dando 404 y la navegación no cambia. El cron diario ya corre para las empresas que siga esa cuenta.

## Qué funciona con fuente real y qué sigue en fixture

| Parte | Estado |
|---|---|
| Mis empresas, ficha, agregar empresa, prioridades, orden, archivar | Real (Upstash, `maru:radar:v1:*`). |
| Importar el Sheet (XLSX/CSV) | Real, probado sólo con una fixture: **falta el export de Research Laboral**. El mapeo de columnas es editable en la vista previa. |
| Fuentes: Greenhouse, Lever (US/EU), Ashby, JSON-LD | Real. Validado con 20 empresas: 11 con ATS (2.248 vacantes), 7 manuales, 2 links rotos. |
| Vacantes detectadas, cierres y reaperturas | Real, idempotente. |
| Match (`radar-match@1`) | Reglas: real. **IA: sin probar en real** porque el secret `ANTHROPIC_API_KEY` de GitHub da 401. En Vercel la clave es otra (actualizada el 19/11) y debería andar. |
| Oportunidades, Guardar en Seguimiento, Descartar, atajos a CV/Carta/Entrevista | Real. |
| Cron (crawl → match → entrega), avisos in-app, alertas P1, resumen semanal | Real, probado en local con el cron disparado a mano dos veces (sin duplicados). |
| Email (Resend) | Real si hay `RESEND_API_KEY`, sólo con consentimiento. Sin probar contra Resend. |
| Descubrimiento | Real, a partir del catálogo; las señales sólo aparecen si vienen de una fuente leída. |
| Vacantes del piloto | Fixture histórica: «Piloto 25/11/2026 · vigencia no verificada». Nunca se muestran como abiertas. |
| Analytics | Eventos de §6 sobre PostHog en el navegador (`trackRadar`), con propiedades en lista blanca. `radar_digest_delivered` y los de la corrida del cron sólo quedan en el log de Vercel (`[cron/radar]`): no hay PostHog del lado del servidor. |

## Variables de entorno

| Variable | Production | Preview | Para qué |
|---|---|---|---|
| `RADAR_ENABLED` | **No cargar hasta el rollout.** Después `true`. | `true` si querés probar | Prende todo Radar (pantallas, API y cron). Hace falta un deploy nuevo para que aparezca en la navegación. |
| `RADAR_ALLOWLIST` | Tu email durante el paso 1 | Opcional | Con el flag prendido, sólo esas cuentas ven Radar (el resto recibe 404). |
| `CRON_SECRET` | Ya existe | — | El cron de Vercel lo manda solo. Sin él, la ruta responde 503. |
| `ANTHROPIC_API_KEY` | Ya existe | Ya existe | IA del match. |
| `RESEND_API_KEY` | Ya existe | — | Email opcional. Remitente: `RADAR_FROM` o `ALERTS_FROM` o `alertas@marucoach.com`. |
| `RADAR_DAILY_EVALS` | Opcional (150) | Opcional | Tope de evaluaciones con IA por persona y día. |
| `RADAR_IA` | `off` para apagar la IA | — | Deja sólo las reglas. |
| `RADAR_WORKER_SECRET` | Opcional (24+ caracteres) | Opcional | Habilita `POST /api/radar/worker` para corridas a mano. |
| `AUTH_SECRET` (y `GOOGLE_CLIENT_*`) | Ya existen | **Faltan** | Sin ellas no se puede ingresar en Preview, así que Radar no se puede probar ahí con sesión. |

GitHub: cargar una clave válida en el secret `ANTHROPIC_API_KEY` para el workflow manual `radar-eval` (y `match-eval`).

## Cron

`vercel.json` suma `/api/cron/radar` a las 10:23 UTC (07:23 de Argentina), **una vez por día**, porque no pude confirmar el plan de Vercel y en Hobby un cron más frecuente rompe el deploy. Consecuencias:

- Cada fuente se lee como mucho una vez por día (P1 diaria), aunque alguien pida más.
- El resumen sale en la primera corrida posterior al día y la hora elegidos (hasta 48 h después). Con un cron diario, un resumen «lunes 09:00» de Argentina llega el martes a las 07:23.
- Si el plan es Pro, conviene cambiar el cron a horario (`"0 * * * *"`): la frecuencia de fuentes no cambia (el código respeta `nextDueAt`) y el resumen llega a su hora.

La ruta corre las tres fases. Se pueden lanzar por separado: `/api/cron/radar?phase=crawl|match|deliver` con `Authorization: Bearer $CRON_SECRET`.

## Costo estimado

- **Lectura de fuentes:** gratis (APIs públicas). En Upstash, la primera lectura de una empresa grande escribe una descripción por vacante (Stripe 768, Anthropic 634); después sólo lo que cambia. Una corrida diaria con 20 empresas son unos cientos de comandos más las descripciones nuevas.
- **IA del match (Haiku 5.5):** ≈ US$0,0003 por vacante evaluada (estimado: ~1.200 tokens de entrada y ~350 de salida). Las reglas descartan ~63 % sin IA. Con 7 empresas P1: ≈ 25 evaluaciones por semana, **≈ US$0,01 por usuario activo por semana**; con 20 P1 y 100 P2, del orden de **US$0,05 a 0,10 por semana**. El tope diario (150 por persona) acota el peor caso a ≈ US$0,05 por persona y día. **A confirmar con `radar-eval`.**
- **Email:** dentro del plan de Resend que ya usan las alertas.

## Riesgos

- Preview y Production comparten Upstash: prender el flag en Preview escribe datos reales.
- Board deducido del nombre: confirmado por la API, pero una empresa homónima podría colarse (la ficha lo indica).
- Detección de país por texto: lo que no reconoce queda «por verificar», nunca bloqueado.
- Catálogo global escrito por las importaciones (sólo agrega datos).
- La primera lectura de muchas empresas grandes a la vez puede tardar; el cron tiene presupuesto (3 min de crawl) y sigue al día siguiente.
- Seguimiento vive en el navegador y se sincroniza con la cuenta: la marca «En Seguimiento» depende de esa sincronización.

## Rollout

1. **Antes:** cargar una clave válida en el secret de GitHub `ANTHROPIC_API_KEY`, correr Actions → `radar-eval` y revisar el top 5 y el costo (queda en el resumen del job). Si querés probar en Preview, cargar `AUTH_SECRET` en Preview.
2. **Sólo tu cuenta:** en Vercel → Settings → Environment Variables → Production, agregar `RADAR_ENABLED=true` y `RADAR_ALLOWLIST=<tu email>`. Redeploy de producción (el flag de la navegación se lee en el build).
3. Probar con tu cuenta: importar el Sheet, clasificar P1/P2, «Revisar ahora», cargar el CV en Match, «Evaluar con mi perfil», Guardar una vacante y verla en Seguimiento, Automatización (países, alertas, email opcional).
4. Al día siguiente, revisar el log de `/api/cron/radar` en Vercel (`[cron/radar] {...}`) y los avisos in-app.
5. **Para todos:** borrar `RADAR_ALLOWLIST` (o agregar más emails separados por coma) y redeploy.

## Rollback

- **Inmediato:** borrar `RADAR_ENABLED` en Production y redeploy. Radar vuelve a dar 404, desaparece de la navegación y el cron queda sin efecto. Los datos de `maru:radar:v1:*` quedan guardados y no afectan al resto de Maru.
- **Sólo cortar el cron:** sacar la entrada `/api/cron/radar` de `vercel.json` (o borrar `CRON_SECRET`, que también apaga los otros crons: no recomendado).
- **Sólo cortar la IA:** `RADAR_IA=off` (quedan las reglas).
- **Sólo cortar emails:** salen únicamente a quien los aceptó. Para cortarlos para todos sin apagar Radar no hay un interruptor propio (quitar `RESEND_API_KEY` también corta las alertas de Match); lo más simple es apagar el flag.
- **Borrar datos de Radar** (si se decide abandonar): todas las keys empiezan con `maru:radar:v1:`; no comparten nada con otras secciones.
