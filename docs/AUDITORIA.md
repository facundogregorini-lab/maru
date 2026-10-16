# Auditoría de punta a punta (16/10/2026)

> Este documento conserva la auditoría inicial. Actualización posterior en la rama `codex/cuentas-sync-y-planes`: base y sincronización con control de versiones, Redis para límites por IP, login Google de main incorporado, planes/cobro preparado y apagado, chat, logos y pulido implementados. Los puntajes y bloqueantes de abajo corresponden a la versión previa; estado actual y tareas del dueño en [PENDIENTES.md](PENDIENTES.md) y [COBROS.md](COBROS.md).

Referente: jobright.ai (job match, autofill, resume tailor, cover letter, job tracker, mock interview, Orion, planes pagos).
Objetivo: una suite irresistible para el candidato argentino, lista para cobrar $10.000/mes.

## Cómo se auditó

- La app corriendo en producción local (`next build` + `next start`), con capturas de página completa de todas las rutas en 1440×900 y 390×844. No hubo errores de consola en ninguna página.
- Las APIs probadas con entradas válidas, vacías y erróneas; el ranking del match con 3 perfiles de ejemplo; el inventario completo analizado.
- El código de cada flujo, la extensión, los exportes, el login y el video del hero (cuadro a cuadro).
- **No se pudo verificar** (el entorno no tiene clave de IA ni acceso a `maru-grego7.vercel.app` ni a `jobright.ai`): la calidad de lo que genera la IA, los tiempos reales de respuesta, el envío de emails del login y la configuración de Vercel. Esos puntos quedan como "verificar en producción". El repo REA es una herramienta de ingeniería inversa y no trae datos de jobright; para usarla haría falta habilitar ese dominio en la red del entorno.

## Resumen

**Preparación para vender: 5,5 / 10.** Los productos funcionan y se ven como jobright, pero todavía no hay forma de cobrar, todo es gratis e ilimitado y faltan las piezas que hacen "comprable" a un SaaS (precio, pago, cuenta con plan, legales, métricas).

### Bloqueantes para salir a vender

| # | Bloqueante | Depende de |
|---|---|---|
| 1 | No hay checkout ni plan: la oferta de Maru no puede cobrar. No hay nada reservado a clientes (todo es gratis e ilimitado), así que no hay motivo para pagar. | Dueño (Mercado Pago) + desarrollo (cuenta con plan y límites) |
| 2 | Los textos dicen "100% gratis, sin tarjeta" en todas las landings. | Dueño (definir qué es gratis) |
| 3 | La extensión se instala en modo desarrollador desde un .zip: la mayoría abandona ahí. | Dueño (cuenta de Chrome Web Store, US$5) |
| 4 | No había términos ni política de privacidad (los pide Mercado Pago y la Chrome Web Store). | Resuelto en esta tanda (borrador a revisar) |
| 5 | El login por email depende de `SMTP_URL`/`EMAIL_FROM` en Vercel; sin eso nadie puede descargar su CV. | Verificar en producción |
| 6 | Las APIs de IA no tenían límite de uso: cualquiera podía gastar la cuenta de Anthropic. | Resuelto en esta tanda (límite por IP) |

## Puntaje por producto

Escala 1-10 contra la experiencia equivalente de jobright, adaptada a lo que Maru hace.

### Home · 7,5
Muy cerca de jobright: hero con video, laureles, "Resultados reales", búsquedas reales, funciones, evidencia con fuentes, FAQ y cierre.
- El video del hero mostraba los controles del reproductor (jobright no). → *resuelto*: sin controles, con botón propio de pausa.
- "¡En menos de 1 minuto!": una postulación a medida tarda más (dos llamadas a la IA). → *resuelto*: "en minutos".
- "9.792+ búsquedas" estaba inflado: ~3.300 eran el mismo aviso repetido por ciudad. → *resuelto* (ver Búsquedas).
- La descripción del sitio (la que muestran Google y WhatsApp) decía "aplicamos por vos", y Maru nunca envía postulaciones. → *resuelto*, con imagen y textos para compartir.
- Falta prueba social real (testimonios, logos de empresas donde entró gente). Pendiente: cuando haya usuarios.
- Footer sin legales ni contacto. → *resuelto*: términos y privacidad.

### Búsquedas · 6 → 7,5
Listado y detalle como la app de jobright, con filtros y "Aumentá tus chances".
- El mismo puesto aparecía hasta 219 veces (una por ciudad o país); buscando "react", 8 tarjetas iguales en la primera página. → *resuelto*: se agrupan por puesto + empresa y se muestran las ubicaciones juntas.
- En celular, "Aumentá tus chances" quedaba después de una descripción larguísima. → *resuelto*: barra fija abajo con "Adaptar mi CV" y "Postularme".
- Mejoras pendientes: alertas por email de búsquedas nuevas (lo que más retiene en jobright; requiere base de datos), filtrar avisos de baja calidad (proyectos de "AI trainer" freelance), salario normalizado, logos reales.

### Match con IA · 7 → 8
Rápido (0,3-0,5 s), con puntaje, motivos, brechas y "por confirmar". Mejor explicado que jobright en elegibilidad desde Argentina.
- Mostraba "Para vos (1.110)" pero sólo listaba 40, sin forma de ver más. → *resuelto*: "Ver más búsquedas".
- Repetía la misma búsqueda por país. → *resuelto* (agrupadas).
- Pendiente: motivos menos genéricos (hoy dos de tres suelen ser "coincide con lo que buscás" y "tu experiencia como X se relaciona"); "nuevas desde tu última visita"; pasar el encabezado al formato app (`AppShell`).

### Postulación a medida (CV + respuestas) · 7,5
El producto estrella y el más diferencial: CV reescrito para el aviso, panel ATS, respuestas por campo, editor y 24 diseños.
- Fricción: pide motivación obligatoria (mínimo 20 caracteres) antes de ver valor; jobright adapta con un clic desde el aviso. Sugerencia: hacer la motivación opcional y preguntarla dentro de las 3-5 preguntas.
- Tiempo: análisis (esfuerzo medio) + generación (esfuerzo alto) con el modelo más grande. Verificar en producción que quede por debajo de ~60 s; si no, usar un modelo más rápido para el análisis.
- "Como si se lo contaras a una amiga" → *resuelto*: lenguaje neutro.

### CV con IA · 7,5
Completo (rol, nivel, industria, país, idioma, 24 diseños, ATS).
- Pendiente: puntaje ATS antes/después bien visible al terminar (es el "momento wow" de jobright) y un "mejorá esta viñeta" por línea más visible.

### Carta de presentación · 8
Lo más pulido: búsqueda o espontánea, tono, largo, idioma, destinatario, reescritura por párrafo, asunto de email y mensaje de LinkedIn, PDF y Word.
- Selector "Tengo la búsqueda / Carta espontánea" en menta mientras el resto es blanco/negro. → *resuelto*.

### Entrevista con IA · 7
Por voz, con repregunta e informe con puntaje y respuestas STAR. Supera a la mayoría de los "mock interviews".
- Cada turno usa el modelo grande: puede haber silencios largos entre preguntas. Sugerencia: modelo rápido sólo para los turnos (dejar el grande para el plan y el informe). Requiere probar con la clave real.
- El dictado depende del navegador (Firefox no). Se puede responder por escrito: está bien resuelto.

### Video de presentación · 7
Único frente a jobright (guion, teleprompter, feedback por toma, el video no sale del navegador).
- Pendiente: es un producto de nicho; conviene mostrarlo como "extra" del plan y no como producto principal.

### Extensión de Chrome · 5
Funciona en Greenhouse, Lever y formularios web (tiene pruebas automáticas con Chromium), con colores para lo copiado vs. lo redactado.
- Instalación en modo desarrollador: el mayor freno de conversión. Publicar en la Chrome Web Store (requiere la política de privacidad, ya creada).
- No suma la postulación al seguimiento. → *resuelto*: al completar un formulario, la extensión ofrece "Guardar en mi seguimiento" (abre `/seguimiento?add=…`).
- Pendiente: Workday y formularios de varios pasos (los más comunes en empresas grandes).

### Seguimiento · 6,5 → 7
Tablero completo, se llena solo desde todas las herramientas. Sólo vive en el navegador (sin sincronización entre dispositivos).

### Maru (guía y venta) · 6 → 7
Encantadora y clara; guía por los 9 productos en modo checklist y oferta al final.
- En celular tapaba contenido al scrollear. → *resuelto*: se corre mientras scrolleás y vuelve al frenar.
- "Ya lo viste todo" aunque se haya salteado pasos. → *resuelto*: el texto depende de lo recorrido.
- La oferta no puede cobrar hasta que exista el link de pago y choca con "100% gratis".

### Flujo de compra · 2
No hay página de precios, checkout, cuenta con plan, límites del plan gratis, comprobante, ni forma de cancelar. Es lo que más falta para vender. Propuesta (ley de Gall, lo más simple que funcione):
1. Plan gratis con límites claros (por ejemplo: match y búsquedas ilimitados; 2 CV a medida, 1 carta y 1 entrevista por mes).
2. Plan Maru a $10.000/mes: todo ilimitado + descargas.
3. Suscripción de Mercado Pago (preapproval) con link fijo; webhook que guarde el email como cliente en una base mínima (Vercel KV/Upstash o Postgres); la sesión del magic link lee ese estado.
4. Página `/precios` con la comparación gratis vs. plan, FAQ de cobro y cancelación.

### Plataforma · 4 → 6
- Límite de uso en las APIs de IA. → *resuelto*: 40 pedidos pesados y 200 livianos cada 10 minutos por IP, en memoria de cada instancia (`src/middleware.ts`). Para algo más firme, Upstash/KV.
- «Borrar mis datos» no borraba el seguimiento ni lo armado en cada herramienta. → *resuelto*, y el botón también está en `/privacidad`.
- SEO: no había sitemap, robots ni imagen para compartir. → *resuelto*: `sitemap.xml` (incluye cada búsqueda), `robots.txt`, `metadataBase` y Open Graph.
- Métricas: `track()` existía pero no había analytics. → *resuelto*: Vercel Analytics instalado (hay que activarlo en el panel de Vercel).
- Pendiente: base de datos para cuenta, plan, sincronización y alertas.

## Lo que depende del dueño

1. Link de suscripción de Mercado Pago → `NEXT_PUBLIC_CHECKOUT_URL`.
2. Qué es gratis y qué es del plan (para cambiar los textos "100% gratis").
3. Cuenta de Chrome Web Store para publicar la extensión.
4. Verificar en Vercel: `ANTHROPIC_API_KEY`, `AUTH_SECRET`, `SMTP_URL`, `EMAIL_FROM`; activar Vercel Analytics; definir `NEXT_PUBLIC_SITE_URL` cuando haya dominio propio (marucoach.com).
5. Revisión legal de `/terminos` y `/privacidad` (razón social, CUIT, domicilio y email de contacto en `NEXT_PUBLIC_CONTACT_EMAIL`). Para vender online en Argentina también hace falta el "botón de arrepentimiento" visible (Res. 424/2020) cuando exista el plan pago.
6. Volver a renderizar el video del hero (`scripts/render-intro-video.mjs`): muestra 9.792 / 8.307 búsquedas y ahora, sin repetidas, son ~6.400.
7. Elegir una base de datos (Vercel Postgres o Upstash) para cuentas con plan, alertas y sincronización.
