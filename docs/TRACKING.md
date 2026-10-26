# Medición: PostHog y conversiones de Google Ads

## PostHog: funnels de producto (desde el 18/10/2026)

Organización **Growth Labs 2**, proyecto **670796** (US). Tableros:

- [Maru · Funnel general](https://us.posthog.com/project/670796/dashboard/2224638): visita → activación → ve el límite → click en pagar → pago (ventana 30 días), en pasos y por semana.
- [Maru · Funnels por herramienta](https://us.posthog.com/project/670796/dashboard/2224639): uno por sección, desde la visita a la web (ventana 14 días).

Código: `src/lib/tracking/posthog.ts` (inicio, `capture`, secciones) y `src/components/PostHogPageviews.tsx` (visitas y descarga de la extensión). Sólo con `NEXT_PUBLIC_POSTHOG_KEY` (clave pública `phc_…` del proyecto, en Vercel → Production) y en los dominios de `NEXT_PUBLIC_GOOGLE_ADS_HOSTS` (por defecto `www.marucoach.com`, `marucoach.com`). Sin autocaptura, sin grabación de sesiones, sin `identify`: el funnel une los pasos por navegador y nunca viaja el email.

| Evento | Cuándo | Propiedades |
|---|---|---|
| `$pageview` | Cada página (también al navegar sin recargar) | `seccion` si es una sección |
| `seccion_vista` | Justo después de la visita a una sección (`postulacion`, `cv`, `carta`, `video`, `entrevista`, `match`, `busquedas`, `seguimiento`, `extension`, `precios`) | `seccion` |
| `herramienta_resultado` | La IA devolvió el resultado principal (`post()` en `src/components/ui.tsx`): `/api/generate`, `/api/cv/generate`, `/api/carta`, `/api/video/guion`, `/api/entrevista/preparar`, `/api/match/ranking` | `herramienta`, `segundos` (espera de esa llamada, desde el 21/10/2026) |
| `activacion`, `limite_planes_visto`, `plan_click`, `checkout_creado`, `checkout_error`, `compra_confirmada` | Los mismos eventos de producto de abajo (`trackProduct`) | los mismos, más `seccion` |
| `match_*` | Eventos del match (`src/lib/match/events.ts`) | los mismos; `match_perfil_confirmado` y `match_preferencias_listas` llevan `personalizacion` (`abierta`/`cerrada`) cuando vienen del paso rápido |
| `personalizacion_abierta` | La persona abre «Personalización avanzada» en el paso de preguntas (desde el 21/10/2026) | `herramienta`: `cv` o `postulacion` |
| `busqueda_aviso_original`, `busqueda_preparar` | Abrir el aviso original o llevar la búsqueda a una herramienta | `destino` |
| `seguimiento_estado` | Cambiar el estado de una postulación en el tablero | `estado` |
| `extension_descarga` | Clic en el `.zip` de la extensión | — |
| `extension_store` | Clic en un link a la ficha de la Chrome Web Store | — |
| `herramienta_error` | Una llamada de `post()` volvió con error (desde el 19/10/2026) | `ruta` (p. ej. `/api/cv/analyze`), `codigo` (`AUTH_REQUIRED`, `PLAN_LIMIT`, `CV_UNREADABLE`… o el HTTP) |
| `login_pedido` | Se abre el diálogo de ingreso | `motivo` (texto fijo del código: "descargar tu CV", "entrar a Maru"…) |
| `login_google` | Toca "Continuar con Google" | `ventana`: `aparte` o `misma_pestana` (el navegador bloqueó la ventana) |
| `login_ok` / `login_error` | Ingresó / Google devolvió error | `via`: `ventana` o `redireccion` |
| `login_cerrado` | Cerró el diálogo sin ingresar | `motivo`, `con_google` (si había tocado el botón) |

Funnel general: `$pageview` → `activacion` → `limite_planes_visto` → `plan_click` ("click en pagar": elige un plan y va a Mercado Pago) → `compra_confirmada`. Por herramienta: `$pageview` → `seccion_vista` → resultado → activación de esa herramienta (en Postulación y CV la activación se separa por `seccion`, porque las dos usan el mismo editor). `seccion_vista` existe porque una misma visita no puede contar para dos pasos del funnel: así, quien entra directo a `/cv` desde un anuncio completa los dos primeros pasos.

Prueba local: `NEXT_PUBLIC_POSTHOG_KEY=phc_test NEXT_PUBLIC_GOOGLE_ADS_HOSTS=localhost npm run dev` y `localStorage.ph_debug = "true"` en la consola: cada evento se imprime como `send "…"`. PostHog descarta los navegadores automatizados (headless) como bots.

# Conversiones de Google Ads

Etiqueta de Google cargada **directamente en el código** (sin Google Tag Manager ni "Conversion Linker" de GTM). Cuenta de Google Ads: **Growth Labs (523-565-8460)**, la misma de Templo Ninja. Las campañas de Maru optimizan **sólo** por "Maru | Límite alcanzado".

## Estado

- Código en `main` desde la PR #77 (17/10/2026).
- `/privacidad` explica la etiqueta de Google Ads, sus cookies de medición y qué no se envía.
- Variables de abajo cargadas en Vercel (Production) el 17/10/2026. Se activa con el primer deploy de producción que incluya este código (las `NEXT_PUBLIC_*` se fijan al compilar). Sin `NEXT_PUBLIC_GOOGLE_ADS_ID` no se carga nada.

## Variables (Vercel → Settings → Environment Variables, sólo Production)

No son secretos: viajan al navegador. Las credenciales de backend (Mercado Pago, Redis) siguen sólo en el servidor.

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_GOOGLE_ADS_ID` | `AW-18500028132` |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_ACTIVATION` | `xDWcCOnckKAdEOSNwPVE` |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_PAYWALL` | `0QrpCObckKAdEOSNwPVE` |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_BEGIN_CHECKOUT` | `azVYCO_ckKAdEOSNwPVE` |
| `NEXT_PUBLIC_GOOGLE_ADS_LABEL_PURCHASE` | `pbctCOzckKAdEOSNwPVE` |
| `NEXT_PUBLIC_GOOGLE_ADS_HOSTS` (opcional) | `www.marucoach.com,marucoach.com` (valor por defecto) |

## Dónde está cada cosa

| Pieza | Archivo |
|---|---|
| Carga única de gtag.js (layout raíz, sólo `VERCEL_ENV=production` y dominios permitidos) | `src/lib/tracking/tag.ts`, `src/app/layout.tsx` |
| IDs, labels y dominios | `src/lib/tracking/config.ts` |
| Envío nativo `gtag('event','conversion',{send_to,…})`, modo de prueba | `src/lib/tracking/ads.ts` |
| Eventos de producto (Vercel Analytics) | `src/lib/tracking/analytics.ts` |
| Funciones tipadas y deduplicación | `src/lib/tracking/index.ts` |
| Hitos por cuenta en Redis (`maru:conv:<hash>:…`) | `src/lib/tracking/server.ts`, `POST /api/tracking/milestone` |
| Paywall: planes al chocar con el cupo gratis | `src/lib/tracking/paywall.ts`, `src/components/billing/PaywallHost.tsx`, `post()` en `src/components/ui.tsx` |

## Mapeo evento → función → acción de Google Ads

| Evento | Cuándo | Función | Acción de Ads (label) | Rol |
|---|---|---|---|---|
| `maru_core_activation` | Primera descarga de CV (PDF/Word), primera copia o descarga de una carta (o su mensaje corto), primera toma de video grabada y disponible, primera entrevista con informe | `trackActivation` (CvEditor, CartaFlow, Recorder, InterviewFlow) | Maru \| Activación (`xDWcCOnckKAdEOSNwPVE`) | Secundaria, Una, sin valor |
| `maru_paywall_viewed` | Una acción devuelve 429 `PLAN_LIMIT` (lógica real de cupo, `planGuard`), o la persona toca una función del plan pago que devuelve 402 `PLAN_FEATURE` (hoy «Cubrir palabras clave» del CV), y el modal ya muestra las tarjetas de planes. Los dos casos comparten el hito: una sola vez por cuenta entre ambos | `trackPaywallViewed` / `trackPlanFeatureViewed` (PaywallHost) | Maru \| Límite alcanzado (`0QrpCObckKAdEOSNwPVE`) | **Optimización** (objetivo personalizado), Una, sin valor |
| `maru_begin_checkout` | El servidor creó la suscripción en Mercado Pago (`/api/billing/checkout` OK) | `trackCheckoutCreated` (BillingPanel) | Maru \| Inicio de checkout (`azVYCO_ckKAdEOSNwPVE`) | Secundaria, Una, sin valor, `transaction_id=co_<checkoutId>` |
| `maru_purchase` | `/api/billing/status` devuelve `lastPayment` (pago aprobado por Mercado Pago, verificado en el servidor, real, en ARS, por el monto del plan) y es el primero de esa suscripción | `trackVerifiedPurchase` (BillingPanel, PaywallHost) | Maru \| Compra confirmada (`pbctCOzckKAdEOSNwPVE`) | Secundaria, Todas, valor dinámico ARS, `transaction_id=mp_<payment_id>` |

Eventos de producto (Vercel Analytics, pueden repetirse): `activacion`, `limite_planes_visto` (con `primera`), `funcion_plan_vista` (con `funcion` y `primera`), `plan_click`, `checkout_creado`, `checkout_error`, `compra_confirmada` (con `renovacion`), `ads_bloqueado`.

## Reglas de deduplicación

- **Activación y límite**: una conversión por cuenta. El servidor marca el hito con `SET NX` en Redis (clave con el hash del email, que nunca sale del servidor). Google no recibe la identidad. El recuento "Una" de Google Ads es otra cosa: deduplica por clic, no por persona.
- **Sin sesión** (hoy no pasa en producción: con el cobro activo, todas las herramientas de IA exigen ingresar): decide `localStorage`. Limitaciones: otro navegador, otro dispositivo, modo incógnito o borrar datos del sitio pueden contar de nuevo. Al ingresar, lo que este navegador ya envió se marca en la cuenta.
- **Checkout**: una por `checkoutId` (hash de la referencia interna; un reintento sobre la misma suscripción pendiente devuelve el mismo id). También va como `transaction_id`. Un clic con error no cuenta (`checkout_error` en analytics).
- **Compra**: una por id de pago de Mercado Pago (`transaction_id=mp_<id>`), siempre el mismo para la misma compra; recargas y reintentos no repiten. Pagos pendientes, rechazados, reembolsados, de prueba (`live_mode=false`) o con otro monto no aparecen en `lastPayment`. Las renovaciones se miden sólo en analytics.
- **Efectos repetidos, renderizados, prefetch o cambios de ruta** no disparan nada: las conversiones salen de acciones concretas o de una exposición nueva del paywall (cada 429 `PLAN_LIMIT` o 402 `PLAN_FEATURE` que abre el modal es una), con guardas en memoria contra efectos dobles.
- Si gtag.js no cargó (bloqueador), no se consume el hito y queda `ads_bloqueado` en analytics: no se da por entregada.

## Atribución

- Etiquetado automático: **activado** en la cuenta (verificado).
- `marucoach.com` redirige a `www.marucoach.com` conservando `gclid` y `utm_*` (verificado).
- gtag.js guarda el `gclid` en cookies propias (`_gcl_*`, dominio `.marucoach.com`) en la primera página; sobrevive al login con Google (misma pestaña o popup), y a la vuelta de Mercado Pago (`/precios?estado=pendiente`). No hay vinculación entre dominios con Templo Ninja ni con Mercado Pago.

## Compras desde el navegador: límites

No hay envío desde el servidor (eso exigiría la API de Google Ads con developer token y OAuth, o conversiones offline con gclid). La compra se envía desde el navegador cuando la persona vuelve a Maru y el servidor ya verificó el pago: en `/precios`, en el modal de planes, o en cualquier página una vez por sesión del navegador. **Se pierden** compras de quien no vuelve al sitio dentro de los 30 días del pago, o lo hace con bloqueadores. Un webhook por sí solo **no** envía conversiones a Google Ads.

## Modo de prueba

- Fuera de `www.marucoach.com`/`marucoach.com` (localhost, previews `*.vercel.app`) gtag.js no se carga y las conversiones no salen: se registran en `window.__maruAds` y en la consola (`[maru:ads]`).
- En producción, `?maru_ads_debug=1` activa el mismo modo en esa pestaña (gtag.js sigue cargando para ver la etiqueta en Tag Assistant, pero **no** se envían conversiones); `?maru_ads_debug=0` lo apaga. En modo de prueba el servidor sólo consulta los hitos: no los consume.
- "Evento ejecutado" (`window.__maruAds`, analytics), "solicitud enviada" (`result: "sent"` o la llamada a `googleadservices.com`/`google.com/pagead` en Red) y "atribución en Google Ads" (columna Conversiones, con demora de horas) son cosas distintas: que la llamada salga no garantiza la atribución.

## Configuración en Google Ads (hecha el 17/10/2026)

Acciones nativas de sitio web (evento manual), ventana post-clic 30 días, atribución basada en datos, conversiones mejoradas **sin activar**:

| Acción | ID | Categoría | Optimización | Recuento | Valor |
|---|---|---|---|---|---|
| Maru \| Límite alcanzado | 7852011110 | Envío de formulario para clientes potenciales | Secundaria | Una | Sin valor |
| Maru \| Activación | 7852011113 | Registro | Secundaria | Una | Sin valor |
| Maru \| Inicio de checkout | 7852011119 | Inicio de la tramitación de la compra | Secundaria | Una | Sin valor |
| Maru \| Compra confirmada | 7852011116 | Suscripción | Secundaria | Todas | Distinto por conversión (respaldo 1 ARS) |

"Límite alcanzado" quedó **secundaria**: Google agregó su categoría como objetivo predeterminado de la cuenta, que usan las 4 campañas de Templo Ninja; como principal habría entrado en su optimización. Se incluye sólo en el objetivo personalizado **"Maru | Optimización límite gratuito"**, que es el único objetivo de `MARU_AR_SEARCH_CV` (24357953172), `MARU_AR_SEARCH_REMOTO` (24357953175) y `MARU_AR_SEARCH_CARTA` (24357953217). Google usa para pujar las acciones de un objetivo personalizado aunque sean secundarias.

**Puja**: las tres campañas de Maru pasaron de *Maximizar clics* (con límites de CPC de 700, 350 y 300 ARS) a *Maximizar conversiones* sin CPA objetivo, optimizando por el objetivo personalizado. Siguen en pausa y con el mismo presupuesto. Cuando haya volumen (≈30 conversiones/mes) conviene evaluar un CPA objetivo.

## Verificación pendiente en producción (con la etiqueta activa)

1. Tag Assistant en `https://www.marucoach.com/?maru_ads_debug=1`: una sola carga de gtag.js con destino `AW-18500028132`, sin GTM.
2. Navegar entre secciones: sin conversiones ni configs repetidas.
3. Con una cuenta de prueba sin plan: agotar el cupo (p. ej. 2 CV en el día) → modal de planes → `[maru:ads] paywall dry_run` sólo la primera vez en la pestaña (en modo de prueba el servidor no marca el hito: en otra pestaña vuelve a aparecer). Entrar a `/precios` desde el menú no registra nada.
4. Elegir un plan con modo de prueba y cancelar en Mercado Pago (sin pagar) → `begin_checkout dry_run`; un error de checkout → sólo `checkout_error`.
5. Compras aprobada/pendiente/rechazada: en un entorno con credenciales de prueba de Mercado Pago (no en producción, no con pagos reales).
6. Revisar en la pestaña Red que ningún parámetro lleva email, nombre, CV ni texto de cartas.
7. Templo Ninja: sin cambios en su código; en Ads sus campañas siguen con los objetivos predeterminados (Compra = TN Purchase, Interacción = TN Práctica).

# Píxel de Meta (desde el 18/10/2026)

Píxel cargado **directamente en el código** (sin Google Tag Manager), en la cuenta publicitaria **Costa Reset (1356376906306947)**, la misma de Templo Ninja. Templo Ninja tiene su propio píxel ("Templo Ninja Web", 2167285730522630) en otro repositorio: no se tocó.

## Regla central: mismos hitos que Google Ads

Meta no tiene lógica propia. `sendAdsConversion` en `src/lib/tracking/index.ts` es el único punto de envío: después de la misma deduplicación (`claimFirst`), calcula `adsDecision` (la misma decisión que usa Google) y manda el hito a Meta **sólo si sale a Google en ese momento**. Así:

- Recargas, reintentos, reaperturas del modal, efectos dobles y cambios de ruta: no repiten en ninguna de las dos plataformas (mismas reglas de arriba).
- Modo de prueba (previews, localhost, `?maru_ads_debug=1`): tampoco sale a Meta; queda en `window.__maruMeta` y en la consola (`[maru:meta]`).
- Si gtag.js está bloqueado, el hito no se consume y no sale a ninguna. Si sólo fbevents.js está bloqueado, sale a Google y queda `meta_bloqueado` en analytics.

| Evento de origen | Evento en Meta | Parámetros | eventID | Rol en Meta |
|---|---|---|---|---|
| `maru_core_activation` | `maru_core_activation` (personalizado) | — | — | Medición del funnel |
| `maru_paywall_viewed` | `maru_paywall_viewed` (personalizado) | — | — | **Optimización** vía la conversión personalizada "Maru \| Límite gratuito alcanzado" |
| `maru_begin_checkout` | `InitiateCheckout` (estándar) | — | `co_<checkoutId>` | Medición del funnel |
| `maru_purchase` | `Purchase` (estándar) | `value` (ARS reales), `currency: "ARS"` | `mp_<payment_id>` | Medición del funnel |

Además, `PageView` en la carga (Meta sigue solo la navegación interna). Sin eventos automáticos (`autoConfig` apagado: el píxel no lee botones ni formularios) y sin coincidencias avanzadas: nunca viaja email, nombre, CV ni texto. El `eventID` deja lista la deduplicación si más adelante se agrega la API de conversiones (servidor).

## Variable (Vercel → Production)

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` (opcional) | Por defecto `1466577088716669` (conjunto de datos "Maru Coach", negocio Costa Reset), fijo en `config.ts`: no hace falta cargarla |
| `META_CAPI_ACCESS_TOKEN` | Token de la API de conversiones (secreto, tipo Sensitive): Administrador de eventos → Maru Coach → Configuración → API de conversiones → Generar token de acceso |
| `META_CAPI_TEST_EVENT_CODE` (opcional) | Código `TEST…` de "Probar eventos", sólo mientras se verifica; después borrarla |

Sin un ID válido no se carga nada; sin token, la API de conversiones queda apagada y el píxel sigue igual. Usa los mismos dominios que la etiqueta de Google (`NEXT_PUBLIC_GOOGLE_ADS_HOSTS`) y sólo en `VERCEL_ENV=production`. Al ser `NEXT_PUBLIC_*`, exige un nuevo deploy.

## Dónde está cada cosa

| Pieza | Archivo |
|---|---|
| Carga única de fbevents.js | `metaPixelSnippet` en `src/lib/tracking/tag.ts`, `src/app/layout.tsx` |
| ID del píxel | `metaPixelId` en `src/lib/tracking/config.ts` |
| Mapeo y envío `fbq('track' \| 'trackCustom', …)` | `src/lib/tracking/meta.ts` |
| Decisión compartida con Google | `adsDecision` en `src/lib/tracking/ads.ts`, `sendAdsConversion` en `src/lib/tracking/index.ts` |
| API de conversiones (servidor) | `src/lib/tracking/capi.ts`, enviada desde `POST /api/tracking/milestone` con `after()` |

## API de conversiones (servidor)

Sale desde el mismo punto que deduplica: cuando `/api/tracking/milestone` marca un hito por primera vez en modo `claim` (es decir, cuando la conversión sale a Google). La ruta devuelve el `eventId` y el navegador lo usa en el píxel, así Meta deduplica navegador y servidor por evento + `eventID`:

| Hito | eventID |
|---|---|
| Activación | `act_<aleatorio>` (lo genera el servidor al marcar el hito) |
| Límite con planes | `pw_<aleatorio>` |
| Checkout | `co_<checkoutId>` (igual al `transaction_id` de Google) |
| Compra | `mp_<payment_id>`; el servidor la confirma contra la suscripción (primer pago verificado) y usa su importe |

Datos: IP, navegador, `_fbp`/`_fbc` y la URL de la página (sin parámetros). Sin email, nombre ni hashes de ellos (coherente con `/privacidad`). Sin sesión (decisión del navegador) no hay evento de servidor. Sólo desde los dominios de producción; los errores de Meta quedan en los logs de Vercel como `[maru:capi]` y no afectan al usuario.

## Configuración en Meta (manual: el conector de Meta no crea píxeles ni conversiones personalizadas)

1. **Píxel**: creado el 18/10/2026, "Maru Coach" (1466577088716669), en el negocio Costa Reset. En su configuración: eventos automáticos y coincidencias avanzadas automáticas **apagados**. Cargar las variables de arriba en Vercel y redeployar.
2. **Dominio**: verificar `marucoach.com` en el Business Manager y priorizar `maru_paywall_viewed` primero en "Medición de eventos agregados" si Meta lo pide.
3. **Conversión personalizada** "Maru | Límite gratuito alcanzado": origen el píxel "Maru Coach", evento `maru_paywall_viewed` (aparece en la lista después del primer disparo), sin reglas extra, categoría "Cliente potencial", sin valor.
4. **Campañas de Maru**: optimizar los conjuntos de anuncios sólo por esa conversión personalizada. Los demás eventos quedan para analizar el funnel.

## Verificación en "Probar eventos"

Administrador de eventos → Maru Coach → Probar eventos → abrir `https://www.marucoach.com`: tiene que aparecer `PageView`. Con una cuenta de prueba sin plan, agotar el cupo (p. ej. 2 CV en el día) → `maru_paywall_viewed` una sola vez (repetir el intento o reabrir los planes no suma). Descargar un CV → `maru_core_activation`. Elegir un plan → `InitiateCheckout` (cancelar en Mercado Pago sin pagar). `Purchase` sólo con un pago real aprobado. Con `META_CAPI_TEST_EVENT_CODE` cargado, cada hito aparece dos veces en la pestaña (navegador y servidor) con el mismo eventID, marcado como deduplicado. Ojo: fuera del modo de prueba estos eventos son reales y consumen los hitos de esa cuenta.
