# Planes y Mercado Pago

Implementación preparada en la rama `codex/cuentas-sync-y-planes`. El cobro queda apagado por defecto: `NEXT_PUBLIC_BILLING_ENABLED=false`. No activar sólo para probar en producción: el flujo crea suscripciones reales cuando se usan credenciales productivas.

## Qué hace

- `/precios` presenta el estado actual y las opciones. Durante el lanzamiento no permite pagar ni aplica cuotas mensuales.
- Al habilitar cobro, la cuenta autenticada (Google o magic link) crea una suscripción mensual de Mercado Pago desde `POST /api/billing/checkout`. Se vincula por una referencia aleatoria generada por el servidor, no por un email enviado desde el navegador.
- El precio sale de `src/lib/plans.ts`: propuesta de $10.000 ARS/mes. Cuotas propuestas: gratis 2 CV, 1 carta, 1 entrevista y 1 guion por mes; plan 200 pedidos principales combinados. Confirmar antes de habilitar. No se ofrece IA ilimitada.
- Las cuotas cuentan solicitudes principales admitidas, incluso si la IA luego falla. Se reinician por mes calendario UTC. Análisis, repreguntas y reescrituras no consumen ese contador mensual; sí tienen protección por IP compartida en Redis.
- La lectura inicial de perfil y el autocompletado de la extensión siguen públicos y gratuitos, protegidos por IP; el ranking y el buscador también son gratis. Las demás APIs de IA exigen sesión cuando se habilita el modo pago.
- `POST /api/billing/webhook` verifica HMAC de Mercado Pago (`x-signature`, `x-request-id`, `data.id`). Reconsulta la suscripción y el pago con credenciales propias. El cuerpo del webhook nunca concede acceso por sí mismo.
- Sólo un pago acreditado, en ARS y por el importe configurado, activa el período. Una suscripción autorizada todavía no acredita un pago. Un query como `?suscripcion=ok` y la antigua marca `maru:cliente` no activan nada.
- Una notificación repetida no suma períodos. Reembolsos/contracargos conocidos revocan el período relacionado cuando el proveedor informa que el pago ya no está aprobado. La cancelación de renovación conserva el tiempo ya pagado.
- `POST /api/billing/status` recupera comprobantes recientes (hasta 50 resultados; verifica los 3 últimos con pago) para conciliar una confirmación demorada. El estado se consulta en `/precios`.
- Redis: `maru:billing:<hash>`, referencias `maru:billing:ref:<uuid>`, pagos `maru:billing:payment:<id>` y contadores mensuales `maru:usage:<hash>:<mes>:<tipo>` con TTL. Nunca se guardan datos de tarjeta.

## Configuración del dueño

1. Confirmar precio y cuotas propuestas. Si cambia el precio, ajustar `src/lib/plans.ts` y los textos antes de crear suscripciones. Esta primera versión no migra automáticamente suscripciones antiguas con otro precio.
2. Crear una aplicación de Mercado Pago y cargar `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` del entorno correspondiente en Vercel. No reutilizar credenciales productivas para ensayos.
3. Configurar el receptor HTTPS `<dominio>/api/billing/webhook` para `subscription_preapproval`, `subscription_authorized_payment` y `payment`. Verificar en la cuenta de Mercado Pago el método disponible para notificaciones de Suscripciones: la documentación distingue configuraciones por integración. El receptor implementado exige notificaciones firmadas; las IPN/legacy sin firma se rechazan. Si la cuenta no puede emitir esos eventos firmados, mantener cobro apagado hasta adaptar y verificar ese circuito.
4. Definir `NEXT_PUBLIC_SITE_URL` con el dominio público canónico (sin barra final). Completar `NEXT_PUBLIC_CONTACT_EMAIL`, los datos del titular y revisar los términos, privacidad y el circuito de arrepentimiento/reembolso antes de vender. La cancelación automática está implementada; la solicitud legal de arrepentimiento/reembolso y su botón todavía deben definirse con el responsable del negocio.
5. En un entorno separado con credenciales de prueba y datos ficticios, habilitar `NEXT_PUBLIC_BILLING_ENABLED=true` y redeploy. Probar: ingreso Google y email, pago aprobado, pendiente y rechazado, webhook duplicado, recuperación con Actualizar estado, cancelación y reembolso.
6. Sólo después de las pruebas y revisión comercial/legal, habilitar la bandera en Production y hacer un nuevo deploy. La bandera pública se fija durante el build.

## Validación y límites

Pruebas automatizadas con proveedor simulado: autenticación, modo apagado, creación concurrente, reutilización del checkout pendiente, acreditación real frente a mera autorización, idempotencia, cancelación, reembolso, recuperación sin webhook, firmas y cuotas por cuenta. No se usaron credenciales de pago reales ni se ejecutaron cobros en esta tarea.

Las operaciones Redis usan compare-and-set con Lua para evitar que una actualización vieja pise la nueva. El circuito de cobro necesita una prueba real en el entorno de la cuenta antes de activarse. Si una creación remota falla de forma ambigua, se conserva la referencia para reintentar con la misma clave de idempotencia. Revisar la cuenta de Mercado Pago antes de forzar una nueva suscripción.

## Fuentes oficiales consultadas

- [Crear suscripción](https://www.mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/create-preapproval/post).
- [Notificaciones de Suscripciones](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/notifications/webhooks).
- [Buscar comprobantes](https://www.mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/authorized-payment-search/get).
