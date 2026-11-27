# Sesión 4 — Automatización, alertas, descubrimiento, analytics y QA

Actuá como senior product engineer de Maru. Antes de empezar, leé `docs/radar/_REGLAS_COMUNES.md`, `docs/radar/ESTADO.md`, `docs/radar/AUDITORIA.md` y los ADR. Cubrís la **etapa 5** de `docs/radar/PROMPT_MAESTRO.md` (§2 Pantallas C y D, §4 scheduler y reporte, §6 y §7).

Si ESTADO.md dice que el flujo de la sesión 3 no está completo, frená y avisame.

## Alcance
1. **Scheduler:**
   - Usá Vercel Cron (`vercel.json`) o GitHub Actions, el que ya use el repo. El cron **solo despacha** fuentes vencidas (`next_due_at`), con el worker de la sesión 2.
   - La frecuencia global de una fuente es el mínimo intervalo pedido entre los usuarios activos que la siguen. Las alertas y revisiones visibles respetan la configuración de cada usuario.
   - Crawling, matching y delivery van separados.
   - **El cron no hace nada si `RADAR_ENABLED` está apagado.** Así puede llegar a producción sin efectos. Para el cron de Vercel, la ruta debe verificar `CRON_SECRET`.
2. **Notificaciones:**
   - `notification_outbox` con claves idempotentes por (user, job, event).
   - Primero in-app: badge o lista en Radar.
   - Alerta inmediata opcional para P1 con match ≥ umbral y sin bloqueo.
   - Digest semanal (día, hora y timezone IANA del usuario) con el top 5, cambios, errores y cobertura.
   - Si la vacante ya se avisó como alerta, el digest no la repite como nueva.
   - **Email:** reutilizá la integración con Resend que existe (sección recruiters), solo con consentimiento explícito del usuario en Automatización.
   - Nada de WhatsApp.
   - Pausar cancela las entregas pendientes cuando sea posible.
3. **Automatización completa (§2 Pantalla D):**
   - `Revisar ahora` y `Ver historial` con datos reales: última ejecución, fuentes verificadas sobre esperadas, errores y próximo ciclo.
4. **Descubrimiento (§2 Pantalla C):**
   - 5 a 10 empresas por semana, sacadas del catálogo (incluidas las importadas que el usuario no sigue) más afinidad por sector y rol más el feedback.
   - No sugerir empresas ya seguidas ni rechazadas.
   - Cada card lleva el motivo concreto. Señales con fuente y fecha solo si están verificadas; si no, "pendiente de verificación".
   - Nada de rondas de inversión ni contrataciones inventadas.
   - `+P1`, `+P2` y `No me interesa`, idempotentes y guardados como feedback.
5. **Analytics (§6):**
   - Revisá si el repo tiene una capa de tracking. Si existe, usá los eventos del maestro sin PII.
   - **Si no hay ninguna, no sumes PostHog ni otro proveedor:** dejá un módulo `track()` no-op con los eventos definidos y anotalo en ESTADO.md para que yo decida.
6. **QA:**
   - Responsive desktop y mobile, focus y teclado, estados empty, loading, error y stale en las cuatro pantallas.
   - Capturas finales en `docs/radar/capturas/s4-*.png`.

## Tests (§7)
- Guardar configuración, cambiar timezone y frecuencia, pausar.
- Disparar el cron manualmente en local o Preview, y comprobar que no hay envíos duplicados al reintentar.
- Una alerta inmediata no aparece en el digest como nueva.
- Error visible cuando falla una fuente.
- Con el flag apagado, el cron es no-op.

## Entrega final (además del cierre común)
Escribí `docs/radar/ROLLOUT.md` con:
- lo que funciona con fuente real y lo que sigue en fixture;
- las env vars y la configuración de cron necesarias para Preview y Production;
- el costo estimado por fuente y por usuario activo (con los datos medidos en la sesión 3);
- los riesgos;
- los pasos de **rollout**: prender el flag en Production, primero solo para mi usuario si el flag lo permite, y después para todos;
- los pasos de **rollback**.

**No prendas el flag en Production.** Eso lo hago yo después de leer ROLLOUT.md.

## Cierre
Seguí la regla de merge y "Al terminar" de las reglas comunes. Actualizá `ESTADO.md`.
