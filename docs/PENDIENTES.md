# Estado y próximos pasos de Maru

Actualizado el 16/10/2026. Esta tanda está preparada en `codex/cuentas-sync-y-planes`, basada en `main` con el login Google de la PR #22. Hasta integrar y desplegar la rama, estos cambios no deben considerarse publicados.

## Implementado en esta tanda

- **Sincronización segura**: PUT con versión, compare-and-set atómico en Redis, conflictos con 409 y reintento con la base común. Altas simultáneas desde dos dispositivos no se pierden. Se respetan borrados, tanto de toda la cuenta como de tarjetas y guardados. Subidas y respuestas se vinculan a su sesión para no contaminar otra cuenta.
- **Interfaz al día**: Match y el selector de perfil reciben los cambios de la cuenta y de otras pestañas, sin recargar ni guardar automáticamente un estado vacío. El borrado de cuenta informa éxito sólo tras confirmación; sin conexión informa que falta confirmar.
- **Google preservado**: mismo email y cookie de sesión que magic link. El proveedor de autenticación escucha cambios entre ventanas y al recuperar el foco. Prueba de integración: una sesión Google recupera el perfil guardado con una sesión por email.
- **Protección de IA en Redis**: contadores atómicos compartidos entre instancias, TTL y hashes de IP; se agregan chat y acciones de facturación. Sin base hay alternativa local; con base caída se evita llamar a IA sin control.
- **Planes y cobro preparados**: `/precios`, estado por cuenta, checkout mensual de Mercado Pago, notificaciones firmadas, consulta del proveedor, acreditación idempotente, cancelación de renovación, recuperación de pagos y cuotas mensuales. Se mantiene **apagado** (`NEXT_PUBLIC_BILLING_ENABLED=false`) hasta decisiones y pruebas del dueño. Ver [COBROS.md](COBROS.md).
- **Chat con Maru**: panel de Búsquedas en escritorio y desplegable en celular. Referencias sólo a avisos abiertos proporcionados desde el inventario. Perfil opcional, historial de la página sin persistencia y limpieza al cambiar de cuenta.
- **Pulido**: resultados de Match en `AppShell`, guía del seguimiento en `/seguimiento/guia`, links de Planes y textos de privacidad corregidos.
- **Logos**: 15 marcas verificadas desde Simple Icons 16.35.0, servidas como SVG local. Correspondencia por nombre exacto; el resto conserva inicial y color. Fuentes y licencias en `public/companies/`.
- **Video de portada**: renderer usa la misma agrupación que la web. MP4, WebM y póster regenerados: 6.439 búsquedas, 425 empresas y 909 elegibles desde Argentina al renderizar.

## Lo que tiene que resolver el dueño

1. **Definición comercial.** Confirmar o ajustar la propuesta antes de habilitar cobro: semanal $4.500, mensual $10.000 y trimestral $22.500 (destacado); gratis 1 CV y 1 carta por día y 1 entrevista y 1 guion por semana; pago ilimitado con uso razonable (25 pedidos por día); STAR, feedback de cámara y Word sólo con plan. Detalle en [COBROS.md](COBROS.md). El modo actual sigue siendo gratis. El buscador, ranking, lectura de perfil y extensión siguen gratis.
2. **Mercado Pago.** Crear/configurar la aplicación y cargar `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` en Vercel. Configurar notificaciones firmadas a `<dominio>/api/billing/webhook` para suscripciones, comprobantes y pagos. El circuito exacto debe probarse con la cuenta: no se hicieron cobros reales. No sirve pegar un link de pago genérico ni volver con `?suscripcion=ok`. Pasos y fuentes en [COBROS.md](COBROS.md).
3. **Datos del negocio y legales.** Titular/razón social, identificación fiscal, domicilio y contacto; revisión de términos y privacidad, política/procedimiento de arrepentimiento y reembolso, y su botón antes de vender. La cancelación de renovación ya existe; este circuito legal depende de la definición del negocio.
4. **Google, si todavía falta configurar.** El código ya está en main. Revisar `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` y URI autorizada `<dominio>/api/auth/google/callback`. El README conserva los pasos. Probar una cuenta real en el dominio productivo; los previews requieren su propia URI o magic link.
5. **Validación real.** Ingresar con la misma cuenta en compu y celular, guardar una búsqueda, editar desde ambos y comprobar el borrado. Confirmar que están las variables de Redis, IA y envío de emails. No fue posible comprobar el Redis productivo con una sesión real desde este entorno.
6. **Chrome Web Store.** Crear/completar la cuenta de publicador, ficha, datos de privacidad y subir el ZIP generado por `/extension`. La instalación por ZIP sigue disponible hasta publicar. Usar únicamente testimonios de usuarios reales que autoricen publicarlos.
7. **Dominio y medición.** Confirmar dominio canónico en `NEXT_PUBLIC_SITE_URL`, email en `NEXT_PUBLIC_CONTACT_EMAIL` y activar Vercel Analytics si se desea usarlo.
8. **Habilitar venta al final.** Sólo tras aprobar precio, textos, legales y pruebas de pago: `NEXT_PUBLIC_BILLING_ENABLED=true` en Production y nuevo build/deploy. La bandera pública se fija al compilar. La rama se puede desplegar con cobro apagado mientras se resuelven esos puntos.

## Validación técnica

TypeScript, ESLint, suite de tests y build de Next. Nuevas regresiones de concurrencia, borrado, sesión Google/email, cobro simulado, firmas y chat. QA con Chromium en 1440 y 390 px sobre Planes, Búsquedas, guía de Seguimiento y Match; perfil remoto visible sin recarga. Los tests de extensión/PDF que dependen del Chromium Linux configurado se omiten en macOS; no se reportan como ejecutados.

La IA del chat y el circuito financiero se probaron con respuestas simuladas: calidad de las respuestas, entrega real de Google/email, persistencia productiva y pagos de la cuenta necesitan la prueba real indicada arriba.

## Backlog de producto posterior al lanzamiento

- Ampliar logos verificados para las 425 empresas.
- Extensión: Workday, buscadores de ciudad y formularios de varios pasos.
- Alertas de búsquedas nuevas, etiquetas "nuevas desde tu visita", mejoras del razonamiento del Match, filtros de calidad y salarios normalizados.
- Comparación ATS antes/después y mejoras de viñetas más visibles.
- Medir latencia/costo de IA con uso real antes de cambiar modelos o precios.

## Cómo seguir

Mantener el idioma rioplatense, datos reales y los tokens existentes. No inventar testimonios, postulantes ni promesas de empleo. Flujo: rama → PR → chequeos y preview → integrar. Chequeos: `npx tsc --noEmit -p .`, `npx eslint src --quiet`, `npx vitest run`, `npx next build`.
