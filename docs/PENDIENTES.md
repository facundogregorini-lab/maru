# Estado y próximos pasos de Maru

Actualizado el 16/10/2026 (noche: importación de avisos, ver "Avisos: qué falta"). Las PR #23 (cuentas, sincronización y planes), #24 (teleprompter, cámaras y perfil en texto), #26 (piloto Apify y calidad de avisos), #27 (panel privado de proveedores), #29 (muestras y fechas SerpAPI) y #30 (allowlist admin) ya están integradas en `main`. El login Google de la PR #22 está preservado. Los pilotos siguen separados del inventario público; no se activaron consumos recurrentes.

## Prioridad inmediata: próxima etapa de avisos

El dueño pidió un traspaso para que otra IA implemente por etapas y después se revisen los resultados. Público principal: **profesionales generalistas**; secundario: tecnología/remoto. **US$95/mes por Fantastic fue rechazado** para esta etapa. Se puede aprovechar inteligentemente todo el saldo gratuito del trial, sin contratar ni habilitar sobreconsumos.

1. Leer [ESTRATEGIA-AVISOS.md](ESTRATEGIA-AVISOS.md): decisiones, hipótesis, evidencia, costos y límites de lo que sabemos.
2. Seguir [PLAN-AVISOS.md](PLAN-AVISOS.md): E0 benchmark offline; E1 trial estratificado y temporal; E2 ampliar base gratuita; E3 descubrimiento selectivo; E4 decidir si aún hace falta una fuente adicional.
3. Reutilizar [muestras y métricas](research/avisos-2026-10-16/README.md). No repetir corridas para recuperar números ya guardados.
4. Priorizar la verificación de vigencia/cuota del trial: comenzó el 16/10; vencimiento esperado 23/10, confirmar hora real. Último saldo observado: 450 avisos. La propuesta reparte hasta 360 en cortes comparables, 60 en remoto/huecos y 30 de reserva; no obliga a consumir si no aporta aprendizaje.
5. Conservar el catálogo gratuito y el ranking actual; demostrar que la mejora funciona cuando Fantastic quede deshabilitado. No hay presupuesto recurrente aprobado para Apify ni otro proveedor.

**E0 hecho (16/10, costo cero):** ver [research/e0-2026-10-16](research/e0-2026-10-16/README.md). Con 8 perfiles sintéticos (2 de reserva) y revisión manual del top 5:
- De los 909 grupos elegibles desde Argentina, el 56% es de 8 empleadores, la mayoría agencias de staffing o proyectos de IA y lingüística.
- Por área, los elegibles son 13 de administración, 21 de finanzas, 38 de RR. HH. y 4 de logística, contra 254 de software. Hay 37 junior.
- El perfil de logística quedó 0 útiles de 5 (la familia "operaciones" mezcla IT y Revenue Ops).

Conclusión: **para generalistas el problema principal es de adquisición (H1)**. El ranking tiene fallas menores (modalidad y ciudad, seniority, variedad, antigüedad) y hay candidatos de mejora listados ahí, sin implementar todavía. Siguiente:
- **E1** si el trial de Fantastic sigue vigente: se corre desde el panel con sesión real. Desde los entornos de Claude en la nube no hay red ni claves de producción.
- **E2** en paralelo: sumar empleadores argentinos generalistas.

**Importación de proveedores (17/10):** el dueño pidió usar las APIs probadas para tener avisos a la altura del MVP y aprobó **US$5 para Apify**. Se agregó el workflow manual `match-providers` (Fantastic con saldo del trial, Google Jobs con búsquedas del plan gratuito, Apify con tope acumulado), con ledger de consumo, vencimiento automático de lo importado y logos de la fuente. Ver [IMPORTACIONES.md](IMPORTACIONES.md).

### Avisos: qué falta (actualizado 16/10 noche, para seguir con otra IA)

Hecho:
- E0 (línea de base).
- Ajustes de ranking.
- Importación de Fantastic, Google Jobs y Apify con topes (#32 a #34).
- Primera corrida real y sync con reglas nuevas.

Detalle operativo y saldos en [IMPORTACIONES.md](IMPORTACIONES.md). Pendiente, en orden de impacto:

1. ~~**Segundo corte de Fantastic**~~ (hecho 17/10). Se usaron las cohortes nuevas G3/G4 y `offset` para no pagar repetidos. El trial queda agotado: 448/450. Medición en [research/e1-corte2-2026-10-17](research/e1-corte2-2026-10-17/README.md). **Elegibles: 909 → 2.687 grupos; empleadores 90 → 1.039.**
2. **Conectores gratuitos nuevos para ATS que aparecieron en Fantastic.** **Teamtailor ya está hecho** (17/10): usa el RSS público documentado y suma 8 empleadores argentinos (Bidcom, BYMA, Día, Naranja X, PECOM, CDA, Talento Cumbre, David Kennedy). Teamtailor suma 13 empleadores en total (incluye Diagnóstico Maipú, IOL, CPA Ferrere, Umbral y Spyrosoft). **Decisión del dueño:** Workable (10), Workday (9), SuccessFactors (6) y SmartRecruiters (3) tienen endpoints JSON públicos que usan sus propias páginas de empleo, pero **sin documentación oficial** para terceros: sólo hay descripciones de scrapers. Por la regla del plan (fuentes primarias, sin scraping indiscriminado) no se implementaron. Si el dueño acepta ese riesgo, el de Workable (`apply.workable.com/api/v1/widget/accounts/{cuenta}`) es el más simple. Es la forma sostenible de cubrir empleadores argentinos generalistas (Natura, Quilmes/AB InBev, Swiss Medical, EY, Bidcom, BYMA…) sin pagar.
   - Workday tiene un endpoint JSON público por tenant (`/wday/cxs/{tenant}/{site}/jobs`). Teamtailor y Workable tienen páginas de empleo públicas.
   - Antes de implementarlos, revisar la documentación y las condiciones de cada endpoint (PLAN-AVISOS §5). No usar scraping indiscriminado.
3. **Modalidad desconocida:** ~1.000 elegibles no informan modalidad. Se infiere sólo de frases explícitas; ampliar patrones con casos reales, sin adivinar.
4. **Interior del país:** hay poca oferta en Tucumán, Mendoza y Neuquén en todas las fuentes. Sumar búsquedas de Google Jobs por ciudad cada mes (gratis) y palabras de Computrabajo por provincia si se usa el saldo de Apify.
5. ~~**Revisión manual**~~ (hecha 17/10): [research/e1-revision-2026-10-17](research/e1-revision-2026-10-17/README.md). Falsos positivos 9 → 0, útiles 19 → 20, dudosos 12 → 20. Los dudosos son por modalidad desconocida en otra ciudad y por **inglés implícito** (avisos en inglés de empresas de EE. UU.). Lo siguiente: detectar el idioma requerido (candidato 5 del E0). Sigue pendiente una revisión humana real abriendo los avisos.
6. ~~**Vigencia de importados**~~ (hecho 16/10): `scripts/match-liveness.ts` corre en `match-sync` después de la sincronización. Revisa hasta 150 importados por día, cada uno cada 3 días como mínimo. Cierra con 404/410 o con frases explícitas ("ya no está disponible", "No longer accepting applications"). Bloqueos y errores no cierran nada. Falta mirar en los logs qué fuentes responden con bloqueos (LinkedIn suele hacerlo) y sumar frases reales si aparecen avisos cerrados sin detectar.
8. **Tamaño de `data/match/inventory.json`:** desde el 16/10 no guarda las oportunidades, que se reconstruyen al cargar en 0,4 s: pasó de 50 a 36 MB. GitHub rechaza archivos de más de 100 MB. Si vuelve a crecer:
   - recortar descripciones guardadas (hoy hasta 6.000–12.000 caracteres);
   - acortar la retención de cerrados (30 días);
   - o mover el inventario a una base o a Vercel Blob.
7. **Probar en el producto con Computer Use** (PLAN-AVISOS §5.6): búsquedas generalistas, filtro Argentina, logos, "vista hace…", detalle y destino original, también en celular.

Seguridad: las claves se cargaron como secrets de GitHub Actions. Si las que se pegaron en el chat del 16/10 no se rotaron, rotarlas y actualizar los secrets y Vercel. El repo es público: nunca pasarlas como inputs ni en archivos.

Resultado de la primera importación (16/10, noche), con los secrets cargados:
- Google Jobs: +88.
- Fantastic: +272.
- Apify: +1.305, de los cuales Indeed aportó 213 después del arreglo de campos. Costó unos US$2,8 reales.
- La sync manual sumó 360 avisos de 6 empleadores descubiertos.

**Elegibles desde Argentina: 909 grupos (E0) → 2.722 oportunidades; empleadores con elegibles 90 → 847.** Medición en [research/e1-importacion-2026-10-16](research/e1-importacion-2026-10-16/README.md).

La PR #10 (borrador "Login: Continuar con Google + magic link") sigue abierta, pero `main` ya tiene esa funcionalidad por #22/#23. Es del dueño: cerrarla si ya no hace falta.

Las recomendaciones anteriores de tres portales con frecuencias fijas quedaron reemplazadas por este plan. Preparar PRs pequeñas y resultados por checkpoint para revisión; no empezar una migración a pgvector, una búsqueda API por CV o alertas automáticas.

## Implementado en esta tanda

- **Sincronización segura**: PUT con versión, compare-and-set atómico en Redis, conflictos con 409 y reintento con la base común. Altas simultáneas desde dos dispositivos no se pierden. Se respetan borrados, tanto de toda la cuenta como de tarjetas y guardados. Subidas y respuestas se vinculan a su sesión para no contaminar otra cuenta.
- **Interfaz al día**: Match y el selector de perfil reciben los cambios de la cuenta y de otras pestañas, sin recargar ni guardar automáticamente un estado vacío. El borrado de cuenta informa éxito sólo tras confirmación; sin conexión informa que falta confirmar.
- **Google preservado**: mismo email y cookie de sesión que magic link. El proveedor de autenticación escucha cambios entre ventanas y al recuperar el foco. Prueba de integración: una sesión Google recupera el perfil guardado con una sesión por email.
- **Protección de IA en Redis**: contadores atómicos compartidos entre instancias, TTL y hashes de IP; se agregan chat y acciones de facturación. Sin base hay alternativa local; con base caída se evita llamar a IA sin control.
- **Planes y cobro preparados**: `/precios`, estado por cuenta, checkout mensual de Mercado Pago, notificaciones firmadas, consulta del proveedor, acreditación idempotente, cancelación de renovación, recuperación de pagos y cuotas mensuales. El default es apagado (`NEXT_PUBLIC_BILLING_ENABLED=false`); comprobar la bandera efectiva de Production antes de afirmar su estado actual. No se verificaron cobros reales. Ver [COBROS.md](COBROS.md).
- **Chat con Maru**: panel de Búsquedas en escritorio y desplegable en celular. Referencias sólo a avisos abiertos proporcionados desde el inventario. Perfil opcional, historial de la página sin persistencia y limpieza al cambiar de cuenta.
- **Pulido**: resultados de Match en `AppShell`, guía del seguimiento en `/seguimiento/guia`, links de Planes y textos de privacidad corregidos.
- **Logos**: 15 marcas verificadas desde Simple Icons 16.35.0, servidas como SVG local. Correspondencia por nombre exacto; el resto conserva inicial y color. Fuentes y licencias en `public/companies/`.
- **Video de portada**: renderer usa la misma agrupación que la web. MP4, WebM y póster regenerados: 6.439 búsquedas, 425 empresas y 909 elegibles desde Argentina al renderizar.

## QC y correcciones del 16/10

- Teleprompter: se reprodujo “Completá los tres primeros pasos” con los tres campos completos; se quitó el mínimo oculto de motivación y se explican los requisitos de cada campo. “Aporto valor” ya genera un guion en el preview probado.
- Cámara: preview, grabación, revisión y repetir toma verificadas con Computer Use; selección de cámara/micrófono y apagado disponibles. Entrevista: cámara en sala y llamada, respuesta por texto e informe comprobados. No se enviaron fotogramas reales al feedback de IA durante este QC.
- Perfil: un resumen pegado sin empresas/fechas ya no se rechaza como PDF escaneado.
- CV, carta, match, filtros/detalle y seguimiento se probaron con un perfil ficticio en preview. Seguimiento retiene el cambio de estado tras recargar. El ZIP de extensión descarga bien; su instalación y autocompletado real en Chrome quedan pendientes porque la política del navegador de Computer Use bloqueó `chrome://extensions`.
- Apify: MCP autenticado, tres ejecuciones pagas aprobadas dentro de US$0,50 y datasets evaluados; 144 recibidos, 125 aceptados, 123 oportunidades canónicas. Sin cron ni publicación automática. Ver [APIFY.md](APIFY.md).
- Redacción con IA: se informa la fecha actual para experiencias vigentes; en formularios, disponibilidad, referidos, salarios y notas de idiomas sin confirmar deben quedar pendientes, sin valores supuestos.
- Calidad de avisos: se amplían títulos locales, se corrigen rangos de años y “Semi Senior”, y la extracción se recalcula al refrescar cada aviso.

## Lo que tiene que resolver el dueño

1. **Definición comercial.** Confirmar o ajustar la propuesta antes de habilitar cobro: semanal $4.500, mensual $10.000 y trimestral $22.500 (destacado); gratis 1 CV y 1 carta por día y 1 entrevista y 1 guion por semana; pago ilimitado con uso razonable (25 pedidos por día); STAR, feedback de cámara y Word sólo con plan. Detalle en [COBROS.md](COBROS.md). Comprobar el estado de la bandera de cobro de Production; no asumir que sigue igual al default. El diseño mantiene gratis el buscador, ranking, lectura de perfil y extensión.
2. **Mercado Pago.** El dueño informó que cargó las claves; falta comprobar configuración y circuito real con la cuenta, sin volver a solicitar secretos ya cargados. Revisar `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` y notificaciones firmadas a `<dominio>/api/billing/webhook` para suscripciones, comprobantes y pagos. No se hicieron cobros reales. No sirve pegar un link de pago genérico ni volver con `?suscripcion=ok`. Pasos y fuentes en [COBROS.md](COBROS.md).
3. **Datos del negocio y legales.** Titular/razón social, identificación fiscal, domicilio y contacto; revisión de términos y privacidad, política/procedimiento de arrepentimiento y reembolso, y su botón antes de vender. La cancelación de renovación ya existe; este circuito legal depende de la definición del negocio.
4. **Google y email.** El dueño informó que agregó `https://www.marucoach.com/api/auth/google/callback` y se observó sesión real en `www.marucoach.com`; el panel y sus claves ya funcionan después de PR 30. No volver a tratar `ADMIN_EMAILS` como bloqueo pendiente. Falta comprobar un ingreso Google fresco desde cero. Magic link falló por ausencia de `SMTP_URL`; configurar también `EMAIL_FROM`. Si cambia el dominio, revisar su URI específica. Los previews requieren su propia URI o magic link.
5. **Validación real.** Ingresar con la misma cuenta en compu y celular, guardar una búsqueda, editar desde ambos y comprobar el borrado. Los contadores Redis del panel de proveedores se verificaron en Production, pero eso no reemplaza una prueba real de perfil/match/seguimiento entre dos dispositivos. Evitar modificar el perfil real del dueño durante QC; usar un perfil de prueba autorizado.
6. **Chrome Web Store.** Crear/completar la cuenta de publicador, ficha, datos de privacidad y subir el ZIP generado por `/extension`. La instalación por ZIP sigue disponible hasta publicar. Usar únicamente testimonios de usuarios reales que autoricen publicarlos.
7. **Dominio y medición.** El dominio canónico productivo ya es `https://www.marucoach.com`. Revisar `NEXT_PUBLIC_CONTACT_EMAIL` y activar Vercel Analytics si se desea usarlo; no cambiar el dominio para las pruebas de proveedores.
8. **Habilitar venta al final.** Sólo tras aprobar precio, textos, legales y pruebas de pago: `NEXT_PUBLIC_BILLING_ENABLED=true` en Production y nuevo build/deploy. La bandera pública se fija al compilar. La rama se puede desplegar con cobro apagado mientras se resuelven esos puntos.

## Validación técnica

TypeScript, ESLint, suite de tests y build de Next. Nuevas regresiones de concurrencia, borrado, sesión Google/email, cobro simulado, firmas y chat. QA con Chromium en 1440 y 390 px sobre Planes, Búsquedas, guía de Seguimiento y Match; perfil remoto visible sin recarga. Los tests de extensión/PDF que dependen del Chromium Linux configurado se omiten en macOS; no se reportan como ejecutados.

La IA del chat y el circuito financiero se probaron con respuestas simuladas. Hubo además QC real con perfil ficticio en postulación, CV, carta, teleprompter y entrevista, y estado real de proveedores en Production. Eso no prueba entrega de email, sincronización entre dos dispositivos ni pagos reales; quedan las verificaciones indicadas arriba.

## Backlog de producto posterior al lanzamiento

- Ampliar logos verificados para las 425 empresas.
- Extensión: Workday, buscadores de ciudad y formularios de varios pasos.
- Alertas de búsquedas nuevas, etiquetas "nuevas desde tu visita", mejoras del razonamiento del Match, filtros de calidad y salarios normalizados.
- Comparación ATS antes/después y mejoras de viñetas más visibles.
- Medir latencia/costo de IA con uso real antes de cambiar modelos o precios.

## Cómo seguir

Mantener el idioma rioplatense, datos reales y los tokens existentes. No inventar testimonios, postulantes ni promesas de empleo. Flujo: rama → PR → chequeos y preview → integrar. Chequeos: `npx tsc --noEmit -p .`, `npx eslint src --quiet`, `npx vitest run`, `npx next build`.

## Próximo paso para avisos pagos

La conexión MCP de Codex funciona. Para correr Apify fuera del chat hace falta `APIFY_TOKEN` como secreto del runner y una selección de consultas/ventanas; ese secreto del runner no está confirmado. El permiso de US$0,50 fue sólo para el piloto ya realizado y no hay presupuesto recurrente aprobado. El comando `match:apify` por defecto es dry-run y produce candidatos separados. La nueva prioridad es [el plan sin abonos](PLAN-AVISOS.md), no habilitar un cron pago.

## Fantastic.jobs y SerpAPI

Variables `FANTASTIC_JOBS` y `SERP_API` cargadas y verificadas desde el panel de Production con sesión real. Límites actuales en [PROVEEDORES-AVISOS.md](PROVEEDORES-AVISOS.md). Se completaron 50 filas Fantastic y diez Google Jobs en los playgrounds; el paquete del research conserva 185 registros públicos de los seis pilotos. El último conteo `1m` fue 5.671 ATS y 15.394 job boards; al excluir duplicados con ATS quedaron 13.757 job boards, 19.428 sumados. No equivale a avisos abiertos hoy ni justifica un abono rechazado. No se importaron estas muestras ni se crearon recurrencias. La autorización actual es para aprovechar sólo el saldo gratuito de Fantastic según E1, revalidando antes vigencia y cuotas.
