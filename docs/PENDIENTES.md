# Estado y próximos pasos de Maru

## Después de la primera venta (plan en curso, desde 24/10/2026)

La primera compradora chocó con el límite en la postulación, pagó, volvió a /precios y no retomó la postulación. Plan, en PRs chicas:

1. [x] Volver a la herramienta tras pagar: `PaywallHost` guarda la ruta (`src/lib/billing/returnTo.ts`) y, con el plan activo, `/precios` muestra «Continuar tu postulación» (o la herramienta que corresponda). Cada herramienta ya restaura lo cargado desde el navegador.
2. [x] Cobrar el cupo gratis sólo si la generación sale bien: `usageGuard` (en `src/lib/billing/http.ts`) toma el uso y las cinco rutas de IA lo devuelven con `release()` si `askStructured` falla. Límite: si Vercel corta la función por tiempo (maxDuration), no llega a devolverse.
3. [ ] PostHog: `identify` con el ID interno hasheado (sin email) y eventos de baja y devolución con el número de solicitud.

## Garantía por mail y arrepentimiento menos expuesto (24/10/2026)

Tras la primera venta, devuelta al instante con la garantía, se agrega fricción sin tocar lo que exige la ley:

- La garantía de 14 días se pide por mail a `hola@marucoach.com` y se procesa a mano (procedimiento en `docs/COBROS.md`). Sale de «Mi suscripción».
- El Botón de arrepentimiento (Res. 424/2020) queda en el pie de página y sigue siendo automático por 10 días, sólo desde `/arrepentimiento`. Se sacó del bloque «Cómo cancelar», de las preguntas de `/precios` y de `/baja`.
- DNS: MX `mx1/mx2.improvmx.com` y SPF `include:spf.improvmx.com` cargados en Vercel. Falta que el dueño cree el alias `hola@` en ImprovMX.
- Pendiente: avisos por mail de cada solicitud (por ejemplo, con Resend) para poder pasar el arrepentimiento a revisión manual sin perder plazos; y revisar con un abogado si conviene que `/arrepentimiento` no pida login.

## Arreglo: el botón del plan mensual «no hacía nada» (23/10/2026)

Axel tocaba «Elegir plan» en el mensual y no veía ninguna respuesta. En producción (errores de Vercel) se vio la cadena completa:

1. 00:08:55: Mercado Pago respondió **400 al crear la suscripción** (`/preapproval`). Ya había pasado 4 veces entre el 16 y el 17/10.
2. La reserva quedaba en «creando». Los 20 clics siguientes devolvieron «Tu pago se está preparando» y, pasados 2 minutos, se reintentaba con la misma clave de idempotencia, con lo que Mercado Pago repetía el rechazo.
3. El error se mostraba al final del panel, debajo de «Otros planes»: desde el botón no se veía.
4. En el celular, el saludo de Maru tapaba el botón del mensual.

Arreglos:
- `mp()` guarda el **motivo** que da Mercado Pago (`MpError`, sin emails), en el log y en el panel (`/match/admin`, «Cobros»).
- Un rechazo definitivo (4xx) libera la reserva (`status: "failed"`), así que el próximo clic usa una referencia nueva. La ruta responde `CHECKOUT_REJECTED` con un mensaje claro.
- El error aparece **debajo del botón** que se tocó. Un pago iniciado del mismo plan se puede **retomar**, y si hay uno de otro plan, se explica por qué el botón está deshabilitado.
- El saludo de Maru no aparece solo en `/precios`, `/baja` ni `/arrepentimiento`.

**Motivo encontrado (23/10, 00:28):** Mercado Pago responde «Payer is associated with a different site»: no acepta el email de Axel como pagador del cobro en Argentina. Axel dice que su cuenta no es de otro país. Lo más común es que ese email esté asociado a una cuenta de Mercado Pago o Mercado Libre de otro país; si no es eso, hay que mirar en el panel si la cuenta que cobra es de Argentina (`site` MLA) y productiva. Arreglo: en ese caso se puede pagar con el email de otra cuenta de Mercado Pago Argentina (`payerEmail`). La suscripción sigue vinculada a la cuenta de Maru por la referencia.

**Pendiente (anterior):** mirar el motivo del 400 en el panel la próxima vez que pase. Que haya ocurrido antes de la promo, con los otros montos, sugiere que no es por los $990. Las causas posibles son pagar con la misma cuenta que cobra, el email del pagador o el `back_url`.

## Extensión 0.4.2: la postulación de Maru aunque el aviso esté en otro sitio (23/10/2026)

Pedido del dueño. Antes, si la postulación se armó con un aviso de LinkedIn (u otra bolsa) y el formulario estaba en el ATS o el sitio de la empresa, las claves (`jobKey`) no coincidían y se adjuntaba el CV general.

- **Ahora:** si no hay coincidencia por link, `maruMatchByCompany` (`extension/jobkey.js`) busca una postulación de los últimos 30 días cuya empresa aparezca en las URLs de la pestaña o de los frames (host o path), en el título de la página o, si también aparece alguna palabra del puesto, en el texto. Si dos postulaciones empatan, no elige ninguna.
- **Aviso:** el resumen dice cuál usó («… para Head of Growth · Rebill.com: lo reconocimos por la empresa. Si es otro puesto, revisá el CV adjunto y las respuestas»).
- **Tests:** `tests/extension-company-match.test.ts`. El e2e con Chrome real (`tests/extension.test.ts`) no corre en los contenedores con Chromium 1243 (falla igual en `main`, al iniciar el service worker): queda probarlo a mano.
- **Pendiente (dueño):** subir `dist/maru-extension-0.4.2-store.zip` en el panel (Paquete → Subir nuevo paquete → Enviar para revisión). Los permisos no cambiaron.

## Extensión en la Chrome Web Store (23/10/2026)

La Store aprobó la 0.4.1 y está pública: https://chromewebstore.google.com/detail/aikhpbjdjeojlpdkhkonmionghpnmkei

- El link quedó fijo en el código (`EXTENSION_STORE_URL`, `src/lib/extensionVersion.ts`) en lugar de `NEXT_PUBLIC_EXTENSION_URL`: es público y así no depende de una variable de Vercel ni de recompilar.
- **Home y `/extension`:** los botones dicen «Agregar a Chrome» y van a la Store. `/extension` explica la instalación en 3 pasos y, en un desplegable, cómo pasar de la versión del zip a la de la Store (quitar la cargada a mano y volver a subir el CV, porque cada instalación guarda sus datos aparte). El zip sigue disponible ahí.
- **PostHog:** evento nuevo `extension_store` al tocar un link a la ficha.
- Sin cambios: `/api/extension/version` sigue mandando a `/extension` a quien instaló el zip; las de la Store se actualizan solas.
- **Resultado de la postulación → extensión (pedido del dueño, 23/10):** el resultado no decía cómo seguir. Ahora, arriba de las pestañas, la tarjeta «Siguiente paso: completá el formulario con la extensión» explica los dos pasos, abre el aviso en otra pestaña y ofrece agregar la extensión. Si la postulación se armó sólo con texto (sin link), explica que la extensión no la va a reconocer.
- **Link corto:** `marucoach.com/chrome` redirige (307) a la ficha de la Store (`src/app/chrome/route.ts`). Es el link para compartir; la URL de la Store no se puede personalizar.
- **Brecha conocida:** la extensión busca la postulación por `jobKey` del aviso. Si el aviso es de LinkedIn u otra bolsa y el formulario está en el ATS de la empresa, las claves no coinciden y adjunta el CV general. Propuesta: en la extensión, si no hay coincidencia exacta, ofrecer la postulación reciente cuya empresa aparezca en la página (requiere versión nueva y revisión de la Store).
- **Pendiente (dueño):** instalar desde la Store y probar un Greenhouse embebido (`?gh_jid=`), el PDF del CV personalizado y «Guardala en tu seguimiento» con la sesión de marucoach.com.

## Extensión 0.4.1: activeTab en lugar de acceso a todos los sitios (22/10/2026)

Pedido del dueño: la Chrome Web Store avisa que `<all_urls>` retrasa la revisión.

- **Permisos:** `permissions` queda en `activeTab`, `scripting` y `storage`. `host_permissions` sólo lleva marucoach.com (más localhost, que `ext:pack` saca del paquete de la Store).
- **ATS embebidos:** `optional_host_permissions` lista los 25 ATS de `extension/ats.js`. Al abrirse, el popup detecta los iframes de ATS sin permiso y los pide con el clic en «Completar» (`chrome.permissions.request`). Con Alt+Shift+M no se puede pedir: el aviso explica cómo hacerlo desde el ícono.
- **Inyección bajo demanda:** al tocar el ícono o el atajo. Si un iframe no es accesible, se completa la página principal sin fallar.
- **Seguimiento:** se sacó la reinyección después de navegar (`tabs.onUpdated`), que con activeTab ya no es posible. La confirmación se detecta si aparece en la misma página; si no, queda el botón del popup. El dueño aceptó esta pérdida.
- **Tests:** el e2e con Chrome real corre de dos maneras. Con el iframe autorizado, se completan la página y el iframe. Sin permiso, sólo la página y el iframe queda intacto. También hay tests de manifest (sin permisos amplios, opcionales = ats.js, Store sin localhost) y uno que controla que no haya código remoto.
- **Pendiente:** probar a mano en Chrome con un Greenhouse embebido real (`?gh_jid=`) que aparezca el pedido de permiso. El e2e no puede simular el clic en el ícono que otorga activeTab.

## Extensión: cerrar la brecha con Jobright Autofill (plan en curso, desde 22/10/2026)

Pedido del dueño, en tres fases con una PR por fase. Lo que no se negocia: nunca enviar el formulario, nunca completar demografía, consentimientos ni declaraciones juradas, nunca inventar datos, verde = copiado del CV y amarillo = redactado o deducido, y el CV queda en el navegador.

**Fase 1 (extensión 0.4.0): hecha, en PR.**

1. **Usar lo que la persona ya armó en Maru.** El dueño eligió un puente en el navegador, no un endpoint con datos en el servidor.
   - Al terminar una postulación, la web la guarda en `maru:postulaciones:v1` (sólo en el navegador, hasta 10, por `jobKey`). Guarda el HTML del CV personalizado, la motivación y las respuestas sugeridas.
   - `extension/bridge.js` corre sólo en marucoach.com y pasa esas postulaciones a `chrome.storage.local`.
   - Al completar, `background.js` busca por `maruJobKey`: Greenhouse, Lever y Ashby por id del puesto; el resto, por host + path. Busca en la pestaña y en los frames.
   - Si encuentra la postulación, pide el PDF a `/api/export/pdf` con la sesión. Maru lo imprime sin guardarlo y queda en caché. Lo adjunta como `CV - <Nombre> - <Empresa>.pdf`.
   - Manda `postulacion` a `/api/autofill` (campo opcional), y `AUTOFILL_SYSTEM` prioriza esas respuestas en `texto_largo`.
   - Si no hay postulación, el aviso ofrece «Personalizá tu CV para esta vacante» (`/postulacion?url=`).
2. **Cupo y feedback.**
   - `/api/autofill` devuelve `remaining` y `limit` (opcionales). El popup y el aviso muestran «Te quedan N usos hoy».
   - Al agotarse, el link a planes aparece una sola vez por día.
   - El ícono muestra «…», después la cantidad completada, y «!» en rojo si hay error.
3. **Seguimiento al enviar.**
   - Después de completar, `content.js` (`watch`, `confirmationShown`) mira, sin tocar nada, si la página confirma el envío. También se revisa al navegar, con `tabs.onUpdated`.
   - Si lo confirma, el aviso dice «¿La enviaste? Guardala en tu seguimiento». Al tocarlo, `POST /api/tracking/application` la guarda con la sesión como «Postulada» en el documento de seguimiento que ya se sincroniza. Sin sesión, se abre `/seguimiento?add=`, como antes.
4. **Chrome Web Store.**
   - `npm run ext:pack` arma `dist/maru-extension-<v>-store.zip`: manifest en la raíz, sin localhost y sin la ficha. También controla íconos y capturas.
   - `npm run ext:screenshots` regenera las capturas de 1280×800 en `extension/store/`.
   - Desde la Store (con `update_url`), el popup oculta el campo servidor y no pide bajar el zip. Además manda `X-Maru-Source: store`, y el 426 adapta el texto.
   - Los textos de la ficha, permisos y prácticas de datos están en `extension/STORE_LISTING.md`. `/privacidad` está actualizada.

**Pendiente de la Fase 1:**
- Probar en Chrome real que la cookie de sesión llega a `/api/export/pdf` y a `/api/tracking/application` desde la extensión, con el servidor igual al dominio donde se ingresa (marucoach.com).
- `DEFAULT_SERVER` pasó a `https://www.marucoach.com`: es donde se ingresa, y la cookie de sesión tiene que ser de ese dominio. Quien cambió el servidor a mano en «Avanzado» sigue usando el suyo.
- ~~Publicar en la Store~~: aprobada y pública el 22/10/2026 (ver abajo).

**Fase 2 (cobertura) y Fase 3 (más valor en el navegador): sin empezar.** El dueño pidió parar después de cada fase para revisar.

## Baja sencilla, garantía de 14 días y promo del primer mes (22/10/2026)

Pedido del dueño. Decisiones: los $990 son **sólo el primer mes** (después $10.000), la devolución es **automática** y las confirmaciones son **sólo en pantalla** (sin proveedor de email por ahora). Detalle en `docs/COBROS.md`.

1. **Promo:** el mensual se crea por $990 y pasa a $10.000 en Mercado Pago al acreditarse el primer pago (`applyRenewalPrice`). Cada tarjeta dice «Hoy pagás… Desde el segundo período se renueva…».
2. **/precios:** el mensual va solo y destacado. Trimestral y semanal quedan en «Otros planes». Bajo el botón: «Sin permanencia…», la garantía y «Cómo cancelar» (sección con el recorrido). El aviso de límite usa el mismo panel.
3. **Mi suscripción** (`SubscriptionManager`): «Cancelar suscripción» y «Pedir devolución» con una sola confirmación, motivo opcional y número de solicitud (`BAJA-…`, `DEV-…`). Link «Mi suscripción» en el menú de la cuenta.
4. **Accesos públicos:** `/baja` y `/arrepentimiento` en el pie. Términos actualizados.
5. **Pendiente antes de cobrar:**
   - Probar en el entorno de prueba de Mercado Pago: el `PUT` que pasa la suscripción a $10.000 y el reembolso total (`/v1/payments/{id}/refunds`).
   - Si se quiere confirmación por email, sumar un proveedor (por ejemplo, Resend) y la clave en Vercel.
   - Revisión legal de los textos de baja, garantía y arrepentimiento.

## Ajustes de home, CV, match y precios (22/10/2026)

Pedido del dueño, todo en una PR:

1. **Match:** se sacó la leyenda «No es todo el mercado…» y la fila «Fuente» de cada aviso (Apify, Fantastic y demás no le sirven al usuario). El aviso original sigue en «Ver aviso original ↗».
2. **Dictado por voz:** `DictateField` (match) usa el mismo botón que la personalización del CV («Contalo en un audio»; versión chica «Dictar» en campos de una línea), debajo del campo en lugar del micrófono adentro.
3. **Home:** fuera «Practicá tu entrevista», «Grabá tu presentación» y «Explorá las búsquedas». Nueva fila «Aplicá en 1 click» (tercera), con maqueta al estilo jobright (`AutofillMock`) y botón que baja el zip de la extensión (o va a la tienda si se define `NEXT_PUBLIC_EXTENSION_URL`).
4. **/cv:** sólo la herramienta, de «Empezá ahora» a «Armar mi CV» (sin hero ni bloques comerciales).
5. **Extensión, plan gratis:** 4 autocompletados por día (`FREE_LIMITS.autofill`). Corre sólo con el cobro activo (`billingReady`). Sin sesión cuenta por instalación (`X-Maru-Install`, versión 0.3.2) y aparte por IP (tope 12/día); con la sesión de Maru en Chrome cuenta por cuenta y un plan pago usa su límite.
   - La extensión todavía no se vincula con la cuenta de forma explícita. Si la cookie no llega (por ejemplo, servidor `maru-grego7.vercel.app` y sesión en `marucoach.com`), un pago queda con el cupo gratis en la extensión. El dueño lo aceptó así.
   - **Aviso de versión (0.3.3, pedido del dueño):** la extensión manda `X-Maru-Version`. Las anteriores a la 0.3.2 (sin cupo por instalación) reciben un error 426 con el link para actualizar, que la extensión vieja muestra en el aviso de la página. Desde la 0.3.3 el popup consulta `/api/extension/version` y muestra un cartel si hay una versión nueva; el resumen del autocompletado también lo avisa. Al publicar una versión nueva: subir `EXTENSION_VERSION` en `src/lib/extensionVersion.ts` junto con el manifest (un test controla que coincidan) y, si hace falta cortar las viejas, `MIN_EXTENSION_VERSION`.
6. **Promo de lanzamiento:** mensual a $990 (antes $10.000, -90%), destacado en /precios. Los pagos de suscripciones viejas a $10.000 se siguen acreditando (`acceptedAmounts`).
   - El trimestral ($7.500/mes) y el semanal ($4.500) quedan como estaban; el dueño pidió sólo quitar «El más conveniente». El trimestral conserva «Ahorrá 25%», ahora contra el precio regular del mensual.

## Más avisos de Apify sin repetir errores (plan en curso, desde 22/10/2026)

Pedido del dueño: sumar avisos de calidad con hasta US$20 en Apify, en la línea de jobright: remoto desde Argentina para afuera (en USD), tecnología y marketing, más ventas en inglés, customer success, recruiting y finanzas para EE. UU. Aprobó el paso 1 (código, sin gastar) y el paso 2 (prueba de ~US$0,50). Falta definir si los US$20 incluyen lo que quede del Starter de octubre.

1. **Hecho (paso 1, sin gastar):**
   - **Que no se pierdan:** los 5.063 avisos de LinkedIn de la compra del 19/10 iban a vencer juntos cerca del 18/11 (30 días sin volver a verse), aunque siguieran publicados. Ahora, si la revisión diaria de vigencia (`liveness.ts`) ve la página publicada, el aviso sigue abierto 30 días más desde esa revisión, hasta 60 días desde que se publicó (`lastKnownAlive` en `inventory.ts`).
   - **Que entren en GitHub:** los importados se guardan en partes de hasta 40 MB (`inventory-imported.json`, `-2`, `-3`…; `inventory-file.ts`). Antes era un archivo de 39,7 MB y 10.000 avisos más lo habrían llevado cerca de 90 MB. Los workflows commitean todas las partes (`git add -A -- "data/match/inventory*.json"`).
   - **No pagar repetidos:** con `--actor=valig`, la búsqueda le pasa al Actor los ids de LinkedIn que ya tenemos (`skipJobId`, 5.322 al 22/10) y no los devuelve. Cada línea del ledger de Apify anota `created` (avisos nuevos) y la ubicación. Una búsqueda igual (Actor, palabra, ubicación y filtro remoto) no se repite si se corrió hace menos de 7 días o si en los últimos 30 trajo menos del 30% de nuevos (`apifyRepeatReason`).
   - **Remoto:** `--remote=1` (sólo valig) agrega el filtro «Remoto» de LinkedIn (`f_WT=2`). Se confirmó en el esquema del Actor que acepta `urlParam` y `skipJobId` (consulta con `match-probe`).
2. **Hecho (paso 2, prueba del 22/10, 11:35–12:00 UTC):** `--actor=valig --remote=1 --rows=100 --date-posted=month`, tope US$0,48 sobre el gasto del mes. Corrieron 5 de las 8 búsquedas: el ledger estima de más (uso real + precio de las filas pedidas), y por eso frenó antes de customer success, recruiter y accountant.

   | Búsqueda | Filas | Nuevos |
   | --- | ---: | ---: |
   | software engineer | 100 | 86 |
   | data analyst | 100 | 67 |
   | marketing manager | 100 | 58 |
   | sales development representative | 100 | 83 |
   | account executive | 100 | 79 |
   | **Total** | **500** | **373** |

   - **Saltear los ids funciona:** 0 repetidos. Todo lo que pasó los filtros era nuevo, y los 373 se pueden pedir desde Argentina. Las 127 filas que no entraron se rechazaron: 106 fuera de las áreas, 12 de otro país y otras 9 por otros motivos. «Marketing manager» y «data analyst» perdieron más filas por el filtro de áreas: conviene revisar qué títulos descarta.
   - **El filtro remoto NO funcionó:** sólo 49 quedaron remotos. El resto es presencial, híbrido o no lo dice, y 166 descripciones no mencionan remoto en ningún lado. valig parece ignorar `urlParam` `f_WT`. Para remoto hace falta otro camino: probar con `cheap_scraper`, que tiene `workType` (sin `skipJobId`), o con palabras como «remote».
   - **Costo real:** US$0,185 según la cuenta (US$9,762 → US$9,947), unos US$0,0005 por aviso nuevo. Quedan ~US$9,05 del Starter hasta ~19/11.
   - **USD:** 29 de 373 (8%) mencionan dólares.
   - **Velocidad:** unos 5 minutos cada 100 filas con 5.300 ids para saltear.
   - **Empresas:** Mercado Libre, PedidosYa, Globant, Webflow, ESPN, Kraken, Accenture, intive, entre otras.
3. **Tanda 1 generalista (22/10, 12:10–13:34 UTC):** 20 búsquedas en español, en las áreas con menos oferta para el público principal. Trajeron 1.437 filas y 649 avisos nuevos, por unos US$1,4.
   - El filtro de áreas descartó 719 filas. Buena parte eran puestos profesionales mal filtrados: compras, supply chain, comercio exterior, planificación de demanda, trainee y jóvenes profesionales.
   - **Arreglado (`import-filter.ts`):** esos puestos entran de analista para arriba. Depósito, choferes y jefaturas de logística siguen afuera.
   - Las filas ya pagadas se recuperan gratis con `mode=refetch --since=2026-10-22`.
   - **Tanda 2 (marketing remoto, 13:34–13:44):** las búsquedas con «remote» traen pocas filas, 30 a 74 por búsqueda. Sumaron 46 avisos nuevos por US$0,12; 247 de 337 filas eran de otras áreas.
   - Se frenó por un corte de red en «marketing remoto», sin llegar a las 20 de tecnología. Ahora un error suelto no frena la tanda: se registra y sigue.
4. **Pedido del dueño (22/10):** gastar US$10 más con pago por uso, con más peso en marketing, tecnología, remotos y USD. La cuenta tiene un tope mensual de US$19. Para pasarlo, el dueño tiene que subir el límite de uso en Apify (Settings → Usage & billing) a unos US$29: el Starter más US$10. Hecho en código: búsquedas en paralelo (`--parallel`), costo real por búsqueda y tiempo máximo según las filas. Remoto: palabras con «remote» o «remoto», porque el filtro no anda.
- **Fuentes gratis a la par (pedido del dueño 22/10, «de calidad, no llenar por llenar»):** `match-discover` busca la bolsa pública (Greenhouse, Lever, Ashby) de las empresas de los avisos comprados. Suma las que tienen al menos 3 avisos que se pueden pedir desde la Argentina y son de las áreas que importamos, sin consultoras ni portales. Se descartaron por ahora RemoteOK, We Work Remotely y Working Nomads: casi todo es de EE. UU. y sumaría peso sin avisos que se puedan pedir desde la Argentina. Himalayas sigue bloqueado por sus términos.
- **Tanda 3 de tecnología, marketing y remoto (22/10, 14:17–15:40 UTC):** 38 búsquedas y +548 avisos nuevos (144 + 404).
  - Rindieron «analista qa», «administrador de sistemas», «ejecutivo de cuentas», «remote backend/full stack developer» y «remote devops».
  - Las de «remote …» de marketing y las de nicho («analista programador», «media planner») traen menos de 20 filas.
  - La relectura gratis de las corridas del día con el filtro nuevo sumó +178.
- **Resultado del 22/10:**

  | | Antes (21/10) | Después |
  | --- | ---: | ---: |
  | Elegibles desde Argentina | 9.010 | 10.807 |
  | Remotos elegibles | 2.014 | 2.242 |
  | Abiertos | 19.128 | 21.194 |

  - Por área: tecnología +371, ventas +332, operaciones +163, logística profesional +129, finanzas +113, marketing +112, administración +73.
  - Apify gastó en el mes US$11,3 reales de un tope de US$35. Lo de hoy costó unos US$1,8.
  - El inventario pesa ~90 MB (+7 MB). A eso se suman los empleadores nuevos del directorio cuando corra la sync:
    - 27 por `match-discover`;
    - YPF, Swiss Medical, Sancor y Mirgor (SuccessFactors en mosaico, #147).
  - Conclusión: la oferta de LinkedIn Argentina se agota rápido. Con la plata no alcanza: rinden más las palabras nuevas, la relectura y el directorio gratis.
- **HiringRoom (22/10, gratis):** conector `hiringroom` (`fetchHiringroom` en `connectors.ts`, tests en `tests/match-hiringroom.test.ts`). Lee el portal público `https://<cuenta>.hiringroom.com/portal`. El portal nuevo trae los avisos en JSON-LD `JobPosting` y alcanza con un pedido. El viejo arma tarjetas en el servidor y la descripción sale de la página de cada aviso (hasta 40, en serie). El viejo pagina de a 20 con JavaScript: sólo se lee la primera página y, si hay más, la sincronización queda incompleta y no cierra avisos. Si la página no tiene ninguno de los dos formatos, falla en vez de vaciar la bolsa. Sumadas como candidatas 11 empresas con avisos en la Argentina, sin consultoras de RR. HH. (cantidad vista con `match-probe` el 22/10): Newsan (40), Cencosud (16), Scienza (10), Sanatorio Allende (9), DESA (8), Grupo CENOA (6), Motus (5), ID Logistics (3), BDO Argentina (3), Profertil (1) y X-28 Alarmas (1). Afuera: Talent Solutions, Grow UP, Innova RRHH (consultoras de selección) y Securion (26, casi todo vigilancia). Falta: la paginación del portal viejo (Newsan muestra 20 de 40) y sumar más cuentas a medida que aparezcan en los avisos comprados.
- **Bumeran vía Apify (22/10, código, sin gastar):** fuente `apify-bumeran` con el Actor `blackfalcondata/bumeran-scraper` (US$1 cada 1.000 avisos, sólo bumeran.com.ar, descripción completa). No tiene filtro de fecha ni lista de ids para saltear. Usa su modo incremental con una clave por palabra: al repetir una búsqueda sólo cobra lo nuevo. Hay 42 búsquedas generalistas en español (ver IMPORTACIONES, «Bumeran vía Apify»). Falta un piloto de ~300 filas (`--sources=bumeran --rows=100 --keywords=analista_contable,analista_de_datos,ejecutivo_de_cuentas --parallel=3 --budget-source=account`). Después hay que mirar cuántos avisos nuevos trae, cuántos pasan el filtro de áreas y si la modalidad y el salario vienen completos.
- **Bumeran: piloto y tanda (22/10, noche):** las dos búsquedas que fallaron en el primer piloto eran algo pasajero: el Actor anda bien (843 de 872 corridas públicas OK en 30 días) y el piloto en serie trajo 124 nuevos. La tanda con las 42 búsquedas trajo 1.133 filas, 542 aceptadas y **+470 nuevos** por ~US$2,2. La mitad del rechazo son avisos de más de 30 días. Los pozos de Bumeran son chicos (5 a 150 avisos por búsqueda). Una segunda tanda de 48 búsquedas (marketing, tecnología, negocio) corre en Bumeran y Computrabajo. Un job cancelado a mitad de camino perdió ~13 corridas pagadas: se recuperan con `mode=refetch --since=2026-10-22T22:00 --orphans=1` (nuevo). El guardado ahora usa `git pull --rebase --autostash`.
- **Cierre de la noche del 22/10 (Apify):**
  - Bumeran y Computrabajo con 48 búsquedas de marketing, tecnología y negocio: 5.080 filas, **+1.083 nuevos**.
  - Recuperación de las corridas perdidas (`--orphans=1`): 14 corridas, +41 nuevos.
  - Computrabajo con las 36 búsquedas generalistas de Bumeran: 3.627 filas, **+355 nuevos** por US$3,8.
  - LinkedIn con ubicación «Latin America» (30 búsquedas remotas en inglés): **no rinde**. De 4.500 filas, 4.429 eran avisos en otros países de la región, no remotos regionales; quedaron 57 nuevos por US$1,5. No repetir.
  - Elegibles para Argentina: 11.826 antes de Bumeran → 13.982 (ayer: 9.010). Remotos elegibles: 2.673.
  - Gasto de Apify del mes: ~US$27 de US$35. Inventario: 105 MB.
  - **Siguiente:** la reserva de ~US$8 rinde más como refresco en 10 a 14 días que hoy. Bumeran en modo incremental sólo cobra lo nuevo, y lo de hoy vence a los 30 días. Repetir las búsquedas de Bumeran y Computrabajo de hoy (el ledger evita repetirlas antes de 7 días).
- **Auditoría del catálogo (22/10, noche):** duplicados bien resueltos (12.808 oportunidades elegibles → 11.123 tarjetas; sólo 22 tarjetas repetidas, avisos confidenciales distintos). Plan de mejoras, en orden:
  1. **Áreas (hecho en este PR):** 1.379 elegibles caían en «otros» (FP&A, control de gestión, RH, cloud, seguridad informática, medios, sucursal, contratos…). Con reglas nuevas del título quedan 750. `EXTRACTION_VERSION` 17 re-analiza lo guardado en la próxima sync. Sin reglas de salud ni producción, para que el filtro de importación no cierre los 58 avisos profesionales de esas áreas (ensayos clínicos, laboratorio).
  2. **Moneda del salario:** 628 de 1.184 salarios sin moneda, casi todos en dólares (Get on Board, rangos «$35k–$52k», «$50/hour»). Inferirla duplica los avisos que muestran pago en USD (513 hoy). **Hecho:** `cleanSalary` deduce moneda, período y montos del texto de la fuente y descarta 119 sueldos de relleno de Computrabajo («$ 11.111», «$ 1.111.111»). Get on Board se informa en US$ por mes. Salarios en USD: 513 → 775 (remotos con USD: 417 → 615). Sin moneda: 628 → 6.
  3. **Vigencia:** 8.515 de 10.951 importados elegibles nunca se revisaron (400 por día). Subir a ~1.500 por día y comprobar que se detectan los avisos cerrados de LinkedIn. **Hecho:** LinkedIn en español dice «Ya no se aceptan solicitudes» y esa frase no estaba: no se cerraba ningún aviso de LinkedIn (en una muestra de 24, 2 ya estaban cerrados; de los 6 más viejos, 3). Se agregó. La revisión corre una cola por fuente a la vez (cada sitio sigue con un pedido por vez y pausa) y sube a 1.500 por día en 15 minutos. El job de la sync pasa de 40 a 50 minutos de tope.
  4. **SuccessFactors:** 39% sin fecha, 31% con descripción corta y 82% sin modalidad. Leer la página de cada aviso.
  5. **Menores:** 2.233 cerrados guardados (7,7 MB) y 2.170 ubicaciones ambiguas («Buenos Aires, Argentina»).
  6. **Elegibilidad «por confirmar» (910 abiertos):** Get on Board 210 (remotos «remote_local» sin país), Tether en Recruitee 217 (remotos sin región), Workster en Teamtailor 231 (sin ubicación o Malta). **Get on Board, hecho:** los países salen de la página pública del aviso (`applicantLocationRequirements`), 80 por sync y conservados después. Los ids `location_tenants` de la API no sirven: en 7 de 24 avisos la página aceptaba Argentina sin el id de Argentina. Se suman Malta y otros países que faltaban a `OTHER_COUNTRIES`.
  7. **Bolsas sin avisos para la Argentina (hecho):** se excluyen TSMG (Lever: 2.010 abiertos, 0 elegibles, 4,3 MB) y Workster Jobs (Teamtailor, consultora: 578 abiertos, 2 elegibles; iGaming en Malta). La sync deja de pedirlas y purga sus avisos. Se mantienen Pinterest, Wellhub, OLIVER y House Buyers of America (pocos avisos o remotos para LatAm).
  8. **Resultado de la sync manual (22/10, 23:33 UTC):** la vigencia revisó 1.471 avisos en 15 minutos y cerró 61 de LinkedIn que ya no aceptaban postulaciones (8,5% de los revisados). Las áreas nuevas quedaron aplicadas: «otros» elegibles 1.297 → 767. Computrabajo responde 403 al bot y queda sin revisar (no se fuerza; vencen a los 30 días). El descubrimiento de empleadores sobre 400 empresas no encontró bolsas nuevas con avisos para la Argentina.
  9. **Filtro «Sólo con salario en dólares» (hecho):** en el listado del Match, junto a «Sólo con salario publicado». Hoy hay 775 avisos elegibles con salario en USD.
  10. **Logos (hecho):** 55% de los elegibles tenía logo. Get on Board no tenía ninguno (0 de 226) aunque la API lo trae: ahora se lee. La lista de dominios conocidos no encontraba nombres con «&» o acentos («Helmerich & Payne»): sus claves se normalizan igual que los nombres. Se suman 40 empleadores frecuentes (FullStack, Bluelight, Swiss Medical, Anyone AI, Thermo Fisher…), sólo con su dominio oficial. Con logo: 7.668 → 8.505, y unos 226 más de Get on Board en la próxima sync.
  11. **Títulos para mostrar (hecho):** `displayTitle` saca los emojis de adorno (38 elegibles: «🚀», «📍») y los códigos internos de consultoras al principio (32: «1353 CC | …», «876SI …»). La búsqueda y la agrupación siguen usando el título original.
  12. **Filtro de ubicación (hecho):** buscaba el texto tal cual. «CABA» encontraba 304 oportunidades elegibles y se perdía «Capital Federal», los barrios, «Cdad. Autónoma de Buenos Aires» y la forma de LinkedIn («Buenos Aires, Buenos Aires Province»). Con equivalencias: CABA 304 → 3.309; GBA 360 → 1.489 («Greater Buenos Aires», «Buenos Aires-GBA», «AMBA»).
  13. **Modalidad desde el título (hecho):** 3.024 elegibles sin modalidad; 227 la dicen en el título («Senior Data Engineer (Remote)», «Analista Contable - Híbrido»). `withWorkplace` la toma del título antes que de la descripción. Se aplica sola: la sync recalcula los avisos de las bolsas y `refreshImported` los importados.
  14. **Áreas, segunda pasada (hecho):** «otros» elegibles 749 → 720 («e-Commerce» con guión, capital markets, siniestros, activos fijos, systems analyst, public policy, vendor management, comercio internacional, diseño CX). Ninguno de los importados se cierra. `EXTRACTION_VERSION` 19. Lo que queda en «otros» es ambiguo de verdad (manager, specialist, pasantías y programas de jóvenes profesionales de cualquier área).
  15. **SuccessFactors (hecho):** el detalle (fecha y descripción) se lee para 80 avisos por bolsa y por día, en vez de 40. EY (250 avisos) se completa en unos 3 días. La sync usa 12 de sus 20 minutos.
  16. **Secciones de requisitos (hecho):** encabezados frecuentes que no se reconocían: «About You» (260), «Who You Are» (170), «Requerimientos» (103), «Competencias», «Conocimientos técnicos», «Perfil buscado»; y «¿Qué valoramos como diferencial?» como deseable. Avisos con requisitos detectados: 9.595 → 10.308. `EXTRACTION_VERSION` 20.
  17. **Años de experiencia (hecho):** se leen rangos en viñetas («• 3 to 5 years hands-on…», «• 4 a 5 años operando…»), «2 o 3 años» y frases de requisito explícitas («Mínimo de 8 años de trayectoria», «Requires 5 years…», «idealmente entre 2 y 3 años»). Se corrige un falso positivo («No es necesaria experiencia previa / 4 meses de duración»). 77 avisos elegibles suman años y 67 los corrigen. Pendiente conocido: «una empresa … con más de 14 años de experiencia» sigue leyéndose como requisito; ampliar el filtro de historia de la empresa rompería casos reales. `EXTRACTION_VERSION` 21.
  18. **Inglés opcional (hecho):** de 307 avisos que dicen «inglés deseable / no excluyente / preferentemente», 63 lo marcaban como requisito y no salían con «Sin requisito de inglés». Ahora se mira la misma línea (sin cruzar a otra línea ni a otro idioma): quedan 15, con dos menciones. Se revierte «como diferencial» como sección de deseables (PR #173): YPF pone ahí todos sus requisitos. Pendiente conocido: una línea corta con «plus» se toma como título de deseables («Fluent Spanish and Portuguese, plus business-level English.»). Probé que un título no pueda terminar en punto y movía cientos de líneas; queda para revisar con más cuidado. `EXTRACTION_VERSION` 22.
- **Nota de la base (23/10):** tablero de calidad sobre los 11.121 grupos elegibles, recalculado con el código actual: área 94,7% · modalidad 83% (firme 52,6%) · seniority 79,7% · requisitos 72,6% · logo 55,1% · salario 7,9% · fecha 95,1% · ≤60 días 92% · descripción completa 91,6% · por confirmar 5,6% · importados revisados en 7 días 36,9%. Se trabaja dimensión por dimensión, de la más baja a la más alta.
  19. **Requisitos sin título de sección (hecho):** 2.703 avisos sin requisitos no tenían título de sección: los listan como viñetas («• 3+ years of experience…», «• Manejo de Excel avanzado»). Sin título, las viñetas que piden algo (experiencia, conocimientos, manejo de, years, proven, degree…) hacen de requisitos, salvo las de beneficios o «sobre nosotros». Avisos con requisitos: 10.317 → 11.415. `EXTRACTION_VERSION` 23.
  20. **Seniority (hecho):** niveles que los portales informan con otras palabras («Sin experiencia», «Intermedio», «Executive», «Gerencia / Alta Gerencia / Dirección») y el nivel dicho en frases de búsqueda («buscamos sumar un/a senior…», «perfil junior»). No se toma de menciones sueltas («senior management»). Avisos elegibles sin seniority: 2.656 → 2.539. `EXTRACTION_VERSION` 24.
  21. **Modalidad desde la descripción (hecho):** frases que faltaban: «full time remote opportunity», «remote contractor role», «Location: Remote», «remote from LATAM / Latin America», «completely remote», «hybrid opportunity / model», «puesto full time híbrido». No cuentan «hybrid cloud» ni «hybrid search». Elegibles sin modalidad: 2.768 → 2.589. Se aplica en la sync sin cambiar la versión: la modalidad se recalcula siempre.
  22. **Por confirmar (hecho):** países que faltaban (Nepal, Sri Lanka, Rusia, buena parte de África, Asia y el Caribe) y regiones de Nueva Zelanda (Halter publica pueblos rurales). 25 avisos dejan de quedar «por confirmar». `EXTRACTION_VERSION` 25. Lo que queda: Tether (217, decisión pendiente del dueño), Get on Board (se resuelve con la lectura de páginas) y «Home Based - Americas» (ambiguo de verdad).
  23. **Releídas seguras (hecho) y área de LinkedIn (revertida):** releer un dataset viejo de Apify ya no reabre un aviso que la vigencia cerró después ni atrasa su «visto por última vez»: el refetch del 23/10 dejó los 166 cerrados de LinkedIn cerrados. **Error corregido:** el `workType` de LinkedIn resultó ser el rubro de la empresa («Financial Services», «Retail»), no la función del puesto, y daba área equivocada a 126 avisos que antes quedaban en «otros» («Operational Support Analyst» → finanzas). Se deja de leer y la sync borra lo guardado y los re-analiza (`refreshImported`).
  24. **Años de la empresa y «plus» (hecho, cierra los dos pendientes conocidos):** si la frase habla de la empresa («somos una consultora con más de 10 años de experiencia», «led by a management team with over 12 years») y no de la persona, sus años no cuentan como requisito: 21 avisos se corrigen (Redbee, BigCheese, Adecco…) y la mitad pasa a leer los años reales del puesto. «Plus» abre la sección de deseables sólo como título («Será un plus si contás con:», «Strong Pluses»), no dentro de una frase ni en marcas («Pluspetrol», «Farmaplus»): 57 avisos dejan de mandar requisitos a deseables. `EXTRACTION_VERSION` 27.
  25. **Seniority «Semi Sr» (hecho):** Computrabajo informa el nivel «Semi Sr» y «Senior / Semi-Senior», y se leían como senior: 338 avisos elegibles pasan a semi senior (y títulos como «Semi-Senior Designer», «Analista Semi Sr.»). Se suma «Pleno» (semi senior) y frases de búsqueda que faltaban («en la búsqueda de un/a analista sr», «seeking a senior», «estamos buscando…»): 35 avisos más con seniority. `EXTRACTION_VERSION` 28.
  26. **Modalidad, segunda pasada (hecho):** frases que faltaban en avisos de LinkedIn: «Location: Rosario, Argentina - Remote», «Work modality / Work type: Hybrid», «jornada laboral híbrida», «this job is hybrid», «work from anywhere». 98 avisos elegibles pasan a tener modalidad firme. No se toma «nuestras posiciones son remotas» de Accenture: aclara que es para quien vive en provincias sin oficina. Se aplica en la próxima sync sin cambiar la versión.
  27. **Logos, tercera pasada (hecho):** 61 empleadores frecuentes que seguían sin logo (Flux IT, Redbee, Jampp, BYMA, SLB, EBANX, Payoneer, Mural, CBRE, McKinsey, Nestlé…), sólo con dominios oficiales seguros. Avisos elegibles sin logo: 4.801 → 4.329. Los nombres ambiguos («Kiwi», «Beyond», «Perform», «Aleph») quedan sin logo. El resto es una cola larga: 2.283 empresas, la mayoría con menos de 5 avisos.
  28. **Habilidades, herramientas que faltaban (hecho):** 966 avisos elegibles tenían sección de requisitos y ninguna habilidad reconocida («Dominio de la Suite Adobe», «paquete Office», «cableado estructurado»). Se suman 42 herramientas (Office, Photoshop/Illustrator/InDesign, edición de video, Canva, AutoCAD/Revit, APIs REST, Git, Linux, redes, ITIL, C++, Rust, Spark, Databricks, Snowflake, dbt, Airflow, MongoDB, Kafka…). El CV se lee con el mismo diccionario, así que el match compara lo mismo de los dos lados. El perfil guarda hasta 60 habilidades (antes 40). Avisos elegibles con requisitos: 11.739 → 11.923. `EXTRACTION_VERSION` 29.
  29. **Títulos de requisitos, tercera pasada (hecho):** «¿Qué esperamos de vos?», «¿Qué valoramos?», «What we look for», «What we are looking for in you», «What you'll bring», «What you need», «Se requiere», «Conocimientos excluyentes», «¿Qué se necesita para aplicar?», «What will help you succeed». Y si la sección de requisitos sólo pide actitudes («Orientación a resultados»), cuentan las viñetas que piden herramientas. Avisos elegibles con requisitos: 11.923 → 12.262 (ninguno pierde los suyos); en 633 los requisitos salen de la sección correcta. `EXTRACTION_VERSION` 30.
  30. **Salario «Monthly base» (hecho):** se leen «Monthly base of US$800-US$1,000» y «Base: $1,000 USD/month». Suma pocos (6): el salario depende de que la fuente lo publique, y de 522 avisos con montos en el texto casi todos son financiamiento, presupuestos o beneficios.
- **Nota de la base, segunda medición (23/10, después de la sync de las 05:37 UTC, con el código de #188):** 11.306 grupos elegibles. Área 94,7 → 94,9% · modalidad 83 → 85,2% (firme 52,6 → 54,6%) · seniority 79,7 → 80,9% · requisitos 72,6 → 84,3% · **logo 55,1 → 66,8%** · salario 7,9 → 8% · fecha 95,1 → 95,7% · descripción completa 91,6 → 92,1% · por confirmar 5,6 → 2,9% · importados revisados en 7 días 36,9 → 43,8%. La sync cerró 133 avisos más de LinkedIn (299 cerrados en total) y el refetch no reabrió ninguno.
  31. **Descripciones cortadas (hecho):** las bolsas guardaban hasta 6.000 caracteres y 589 avisos elegibles quedaban cortados (Greenhouse 471 abiertos, Recruitee 161, Workday 43), muchas veces antes de los requisitos: el 26% de ellos no tenía requisitos, contra el 15% general. El tope pasa a 12.000 (unos 3 MB más de inventario). Se completan en la próxima sync, porque el texto nuevo cambia el hash del aviso.
  32. **Mercado Libre, Softtek y Haleon vuelven (hecho):** Eightfold dejó de responder la API vieja (`/api/apply/v2/jobs`, 403 desde el 18/10), pero su API nueva `/api/pcsx/search` y `/api/pcsx/position_details` responde sin autenticación, también desde GitHub Actions (`match-probe` del 23/10). El conector pasa a esa API (de a 10 por página, sólo Argentina, 80 detalles por día) y las tres empresas vuelven a `candidata`. Prueba en vivo: Mercado Libre 143 avisos elegibles, Softtek 12, Haleon 1. Las descripciones de Mercado Libre se completan en dos syncs.
  33. **Mercado Libre en el catálogo (hecho):** la sync manual de las tres bolsas (23/10, 06:35 UTC) sumó Mercado Libre 143 avisos elegibles (51 de tecnología, 26 de finanzas, 11 de logística), Softtek 12 y Haleon 1. «Shipping» (Mercado Envíos) pasa a logística: 10 avisos dejan «otros». Logos de Softtek y Haleon. `EXTRACTION_VERSION` 31.
  34. **Años, otras formas (hecho):** «6 o más años», «three or more years», «minimum 5-year experience» y «experiencia de 0 a 1 año» (primer empleo, sin mostrar «0+ años»). «4-year university degree» no cuenta como experiencia. 73 avisos elegibles leen sus años (la mayoría no tenía ninguno). `EXTRACTION_VERSION` 32.
  35. **«Leader» es líder (hecho):** «Software Technical Leader» (Mercado Libre), «Team Leader», «Project Leader» no tenían nivel o quedaban como senior: 44 avisos elegibles. `EXTRACTION_VERSION` 33.
- **Nota de la base, tercera medición (23/10, después de la sync diaria de las 09:51 UTC, con el código de #193):** 11.222 grupos elegibles. Área 94,9% · modalidad 85,9% (firme 55,8%) · seniority 80,5% (bajó por los avisos de Mercado Libre sin nivel en el título; #35 recupera parte) · requisitos 84,3% · logo 67,1% · salario 8% · fecha 95,7% · ≤60 días 91,9% · descripción completa 92,1 → 93,6% · por confirmar 2,9% · importados revisados en 7 días 43,8 → 55,7%. Greenhouse con descripción cortada: 471 → 12. LinkedIn: ningún aviso abierto con el rubro de la empresa y 434 cerrados por la vigencia. Inventario: 109 MB.
  36. **Himalayas, Tether y saldo de Apify (decisiones del dueño, 23/10):**
     - **Himalayas (hecho):** sus términos cambiaron. Permiten mostrar los avisos en un sitio propio, también comercial, sin pedir permiso y sin clave. Las condiciones son postular por su `applicationLink`, crédito visible con enlace, no pasarlos a terceros (tampoco como datos estructurados `JobPosting`, que Maru no publica) y sacar los vencidos. Conector `himalayas`: búsqueda `country=AR` (los que aceptan Argentina y los de cualquier país), del más reciente, 120 páginas de 20 con pausa de 1,1 s (sin clave son 60 pedidos por minuto). El listado no se da por completo y cada aviso se cierra en su `expiryDate`. Prueba en vivo con 200 avisos: 195 elegibles, con nivel, área, logo (84%) y salario (31%). Unos 2.400 avisos, unos 14 MB.
     - **Tether (hecho):** el dueño decidió que sus remotos sin región sean elegibles. Marca `remoteGlobal` en el directorio (`companies.json`): la sync marca los remotos sin país ni región de esa bolsa y la elegibilidad los toma como «sin restricción de país», salvo que la descripción pida vivir en otro lugar. Unos 216 avisos dejan de estar «por confirmar». `remoteGlobal` entra en el hash del aviso: la próxima sync re-analiza todo una vez.
     - **Apify:** el dueño aprobó gastar hoy el saldo hasta el límite de la cuenta (US$35; tope de la corrida US$34,50). Dos tandas de LinkedIn (valig): tecnología y remotos, después marketing y otras áreas, con palabras nuevas (las del 22/10 no se repiten hasta el 29/10).
     - **Resultado (23/10, tarde):** Apify en cuatro tandas: LinkedIn tecnología y remotos +269, Bumeran +74 (11 de 25 búsquedas; el resto ya se había corrido el 22/10), Computrabajo interior +116 (608 filas vencidas: el Actor trae avisos viejos) y LinkedIn + Indeed marketing y otras áreas +369. Total: **+828 avisos nuevos**. Uso real de la cuenta: US$30,12 antes de la última tanda, unos US$31 al final. LinkedIn y Bumeran están casi agotados para las búsquedas de este mes: el saldo restante (~US$4) rinde más en el refresco del 29/10, cuando se pueden repetir las búsquedas. La sync de Himalayas y Tether (14:25 UTC) sumó **Himalayas 2.366 avisos elegibles** (de 2.381) y **Tether 241 elegibles** (antes 25).
- **Nota de la base, cuarta medición (23/10, 14:45 UTC):** **13.840 grupos elegibles** (antes 11.222). Área 94,4% · modalidad 85,9 → 88,6% (firme 55,8 → 62,8%) · seniority 80,5 → 83,4% · requisitos 84,2% · logo 67,1 → 70,8% · salario 8 → 9,6% · fecha 96,7% · ≤60 días 93,3% · descripción completa 94,6% · por confirmar 2,9 → 2% · importados revisados en 7 días 57,9%. Inventario: 127 MB (inventory.json 61 MB).
- **Nota de la base, quinta medición (24/10, después de la sync diaria de las 09:47 UTC):** **14.030 grupos elegibles**. Área 94,4% · modalidad 88,9% (firme 63,5%) · seniority 83,6% · requisitos 84,5% · logo 71,4% · salario 10% · fecha 96,8% · ≤60 días 93,2% · descripción completa 95% · por confirmar 1,7% · importados revisados en 7 días 65,3%. Mercado Libre: 127 de 148 con descripción. Himalayas recibió 2.400 avisos y Tether 243, sin errores. La versión 33 está aplicada («Technical Leader» → líder). Inventario: 130 MB (inventory.json 64 MB). Lo que queda es de techo por la fuente (salario, nivel, modalidad y logos de empresas chicas) o se completa solo con las syncs (vigencia). **Siguiente:** refresco de Apify con el saldo (~US$4) desde el 29/10, cuando se pueden repetir las búsquedas.
  37. **LinkedIn por ciudad y saldo de Apify (24/10, pedido del dueño):** cada búsqueda de LinkedIn trae como mucho 100 avisos del país, y las palabras amplias se cortaban ahí. `--location=<ciudad>` (CABA, Córdoba, Rosario, Mendoza, La Plata, Mar del Plata, Tucumán, Neuquén, Santa Fe, Salta) busca la misma palabra en una ciudad: encuentra otros avisos y no la frena la regla de 7 días. Se usa para gastar hoy el saldo (~US$4) en vez de esperar al 29/10. Logos de Syneos Health India, Disney (TWDC), Monster Energy y MRM.
  38. **Vigencia de Himalayas (hecho):** sus términos piden sacar los avisos que se cierran antes de vencer. Como leemos sólo los 2.400 más recientes, los que no volvieron en la última lectura (más de un día) entran en la revisión diaria de vigencia por su API de verificación (`/jobs/api/companies/…/jobs/…`: 200 publicado, 410 o 404 cerrado), con 1,1 s de pausa (sin clave, 60 pedidos por minuto).
  39. **Saldo de Apify por ciudad (24/10, resultado):** CABA, 25 búsquedas amplias: **+225 nuevos** por US$0,33 («analista» 67, «desarrollador» 41, «ventas» 29). Córdoba, mismas 25: +19 por US$0,22 (LinkedIn tiene pocos avisos del interior). CABA, 93 búsquedas específicas: +20 de 864 filas (US$0,37): ya tenemos casi todo lo que LinkedIn publica hoy para la Argentina. Total del día: +264 por ~US$0,92. Gasto de la cuenta: unos US$32 de 35. **Se frena acá:** con lo publicado hoy, el saldo restante (~US$2,5) no trae avisos nuevos. Rinde cuando haya avisos nuevos publicados: repetir «analista», «desarrollador», «ventas» y «marketing» en CABA desde el 31/10 (pasan los 7 días), y las búsquedas del 22 y 23/10 desde el 29 y 30/10.
5. **Siguiente:** escalar sólo las búsquedas que rindan, en tandas de «última semana» separadas por 10–15 días, dentro del tope que defina el dueño. Ojo con el tamaño: unos 5 KB por aviso. Con más de ~15.000 avisos importados nuevos, revisar memoria y tamaño de las funciones de Vercel (hoy leen todo el inventario en cada instancia).

## Caída en CV, Postulación y Match (plan en curso, desde 21/10/2026)

Datos del dueño: en Crear tu CV entran 47 y descargan 5; en Postulación a medida entran 14 y reciben el resultado 4; en Match 14 de 65 llegan a ver las búsquedas. Propuesta de mejoras en la conversación del 21/10. El dueño aprobó estas tres:

1. **Hecho (preguntas plegadas, CV y Postulación):** en el paso de preguntas (`src/components/Questions.tsx`) quedan arriba el resumen y el botón «Armar mi CV» / «Armar mi postulación». Los datos que faltan y las preguntas para destacar van plegados en «Personalización avanzada (opcional)». Se abren solos si ya había respuestas o al volver desde el resultado con «Ajustar respuestas». Evento `personalizacion_abierta` (`herramienta`) cuando la persona lo abre.
2. **Hecho (espera con avance):** `MaruWorking` muestra una barra y «Paso N de M» que sigue a la barra (`src/lib/progress.ts`: ~80% a la duración esperada, nunca más de 95%; es una estimación, la IA no informa avance). Si tarda 1,3 veces lo esperado: «Está tardando un poco más de lo normal…». Duraciones supuestas: CV 30 s + 45 s, Postulación 35 s + 60 s, lectura del CV en Match 15 s, el resto 40 s. `herramienta_resultado` ahora manda `segundos` para calibrarlas con datos reales.
3. **Hecho (Match en un paso):** después del CV, `QuickStart` (`src/components/match/QuickStart.tsx`) muestra lo que entendimos y «Ver mis búsquedas». Corregir el perfil y lo que busca (roles, modalidad, seniority, salario, indispensables) va plegado en «Personalización avanzada»; sin cargos ni habilidades se abre solo. Ya no hace falta escribir un objetivo o un rol para seguir: el ranking usa los cargos del CV. Al seguir se disparan `match_perfil_confirmado` y `match_preferencias_listas` (el funnel no se corta) con `personalizacion`: `abierta` o `cerrada`. «Mi perfil» y «Lo que busco» en los resultados siguen abriendo los pasos completos.
4. **Hecho (dictado en Match, pedido del dueño 21/10):** todos los campos de texto de «Personalización avanzada» (y de «Mi perfil» / «Lo que busco») tienen un micrófono adentro (`DictateField` en `src/components/VoiceButton.tsx`, mismo dictado del navegador que el resto de Maru). Cómo entra lo dictado (`src/lib/voice.ts`): titular, ciudad, país e idioma se reemplazan; el objetivo se suma; las listas suman ítems («SQL, Python y Excel» → tres); años y salario entienden cifras y palabras («5.000», «dos mil quinientos», «un millón y medio»). Sin dictado en el navegador (Firefox) no aparece el micrófono.
- **No se hizo:** reutilizar el CV entre herramientas ya existía (`useCvInput` ofrece el perfil guardado). El aviso que no se puede leer ya abre el campo para pegar el texto (`JOB_FETCH_FAILED`); el dueño no vio fallas, así que no se tocó.
- **Pendiente de decisión del dueño:** mostrar el resultado antes de pedir el ingreso (pedirlo al descargar), Google One Tap, mail para retomar y eventos por paso en /cv y /postulacion.
- **Siguiente:** en una o dos semanas, comparar en PostHog el funnel de cada herramienta antes y después del 21/10, cuánto se abre la personalización y los `segundos` reales de cada espera.

## Ingreso desde las herramientas y eventos de login (19/10/2026)

- **Problema:** en PostHog, el 18 y el 19/10, 19 personas de Google Search abrieron /cv y una sola llegó al CV. Analizar, generar o preparar exige ingresar (`planGuard` → 401 `AUTH_REQUIRED`), pero la pantalla sólo mostraba «Ingresá con tu email desde el menú para continuar.», sin abrir el ingreso.
- **Arreglo (aprobado por el dueño):** `post()` (src/components/ui.tsx), ante `AUTH_REQUIRED`, pide el ingreso (`src/lib/loginRequest.ts`); `LoginHost` (en el layout) abre el diálogo de Google y, al ingresar, la misma llamada se repite sola. Si cierra el diálogo: «Ingresá con Google para seguir. Lo que cargaste sigue acá.». Pedidos simultáneos comparten un diálogo. El texto del servidor pasa a «Ingresá con Google para continuar.».
- **Medición:** `login_pedido`, `login_google`, `login_ok`, `login_error`, `login_cerrado` y `herramienta_error` (ruta y código). Detalle en [TRACKING.md](TRACKING.md).
- **Falta:** probarlo en producción con una cuenta sin sesión (en local el cobro está apagado y no se pide ingreso) y, en unos días, comparar en PostHog `seccion_vista` → `login_pedido` → `login_ok` → `herramienta_resultado` en /cv por origen. Las herramientas que llaman a `fetch` directo (turnos de entrevista, feedback de video) siguen con el mensaje.

## Match: nivel, salario y función, con re-evaluación por IA (plan en curso, desde 19/10/2026)

Pedido del dueño: /match mostraba Video Editors, analistas y avisos de USD 1.500–5.500 a un líder de growth que filtró Manager/Director/VP y USD 7.000. Decisiones del dueño (19/10): sumar una segunda etapa con IA (Haiku) sólo sobre los avisos que pasan los filtros; la IA normaliza moneda y período, define la moneda cuando falta e infiere el salario no publicado con menos peso; se pueden cambiar los textos de salario e indispensables del formulario.

1. **Hecho (PR #127, mergeada): etapa por reglas.** `src/lib/match/fit.ts` (nivel del aviso por título y descripción, nivel del CV con equipo a cargo, filtros de nivel/salario/función) y puntaje 40 rol / 25 seniority / 20 requisitos / 15 preferencias con tope de 40 % si el rol no encaja. Razones con rol y nivel primero, `breakdown` por componente. `leadership` nuevo en el perfil (equipo más grande y evidencia, sale de `profileToMatch`). Set de evaluación en `tests/match-eval.test.ts` y top 20 antes/después en [research/match-seniority-2026-10-19](research/match-seniority-2026-10-19/README.md).
2. **Hecho (PR 2): re-evaluación con IA.** `src/lib/match/rerank.ts`, llamada desde `/api/match/ranking`: las 200 primeras de "Para vos" y 20 de "Por confirmar" (el dueño pidió 200 el 19/10) van a Haiku (`MATCH_MODEL`) en tandas de 10, todas en paralelo, con `askStructured` (ahora acepta `model` y `timeoutMs`; Haiku va sin fallback del servidor), JSON por componente, descartes aplicados en el servidor, caché en memoria de una hora y caída a las reglas ante error. `/api/match/ranking` pasa a tener límite de uso (bucket liviano, 200 cada 10 min). Texto de salario del formulario actualizado. Costo estimado: ~US$0,06 por ranking nuevo (≈22 llamadas de ~9 k tokens de entrada y ~3,5 k de salida, a US$0,10 y 0,50 por millón); recargas, guardados y "Ver más" usan la caché, pero cada cambio de perfil o preferencias vuelve a evaluar las 220.
3. **Hecho (19/10): top 20 con IA** en [despues-ia.md](research/match-seniority-2026-10-19/despues-ia.md) (workflow `match-eval`; el log imprime la tabla desde la PR 131). El caso reportado queda con Yuno, Cocos y Halter arriba y sin Video Editors, analistas ni salarios bajos. `ANTHROPIC_API_KEY` ya está en Vercel (Production) y en los secrets de GitHub.
4. **Falta: latencia.** La re-evaluación tarda 30–40 s por ranking nuevo y alguna tanda de 10 pasa el límite de 40 s. Opciones: tandas de 5 (misma cantidad de avisos, ~mitad de demora, algo más de costo por repetir el perfil), bajar `RERANK_ELIGIBLE` o mostrar primero las reglas y completar con la IA. Decisión pendiente del dueño.

## Match más rápido, Maru trabajando y herramientas sin landing repetida (19/10/2026)

- **Bug reportado por el dueño («Mi match no carga nada»):** el ranking respondía, pero la primera vez tardaba **45 s** (el afinado con IA de las 200 mejores), y la espera era tres tarjetas grises. Ahora se pide primero el orden por reglas (`ia: false`, unos segundos) y después el afinado con IA, con el aviso «Maru está afinando el orden con IA…». Si sólo cambia guardar, descartar o «Ver más», se pide directo con IA, que usa su caché, así el orden no salta. La respuesta informa `ia: { disponible, aplicada }`.
- **Espera con Maru (`MaruWorking`):** Maru en el centro, tecleando en la compu, con puntos «. .. …» y lo que está haciendo. El Maru del rincón se esconde mientras tanto. Se usa en Match y en la espera de todas las herramientas (`Loading`). Con «reducir movimiento» queda quieta.
- **Sin landing repetida:** si se llega a una herramienta desde otra pantalla de Maru (búsqueda cargada desde Match, Búsquedas o Seguimiento, o un link interno a `#empezar`), no se muestran la presentación comercial ni los bloques de venta (`useInAppEntry`). Va directo al formulario, con el título «Tu postulación para {puesto}» y la empresa. Aplica a postulación, carta, entrevista, video, CV y Match. Los links internos de la home, el header, Búsquedas, Seguimiento, Precios y los cruces entre herramientas apuntan a `#empezar`. Quien entra desde afuera (o Google) sigue viendo la landing completa.
- **Orden preliminar (pedido del dueño, para no perder calidad):** mientras la IA afina, las tarjetas se ven atenuadas, con «Calculando» en lugar del porcentaje y el botón de postular desactivado («Esperá el afinado de Maru»). El resultado final es el mismo de antes (mismas 200 re-evaluadas, mismo código); sólo cambia lo que se ve mientras tanto.
- Match: se quitó el texto repetido del paso «Tu CV» y una fuente que aparecía dos veces cuando el mismo aviso de LinkedIn llegaba por Fantastic y por Apify.

## Compra única de avisos profesionales (19/10/2026)

- Pedido del dueño: unos 10.000 avisos más con un tope de US$20–30, compra única (sin repetir cada mes). Sólo áreas como las de jobright: tecnología, datos, producto, diseño, marketing, finanzas, consultoría, legal, RRHH, operaciones, ventas B2B y administración. No quiere oficios, logística, comercio, gastronomía ni similares.
- Diagnóstico con lo ya importado (avisos para Argentina): de Computrabajo sólo el 17% era de esas áreas y el 37% eran oficios o similares («Chofer de reparto», «Operarios eventuales», «Atención en mostrador»). De LinkedIn, el 34% era de esas áreas y el 43% de áreas intermedias, aun con palabras genéricas. Indeed trae como mucho 58 avisos por búsqueda.
- **Hecho (paso 1, sin gastar):** filtro `src/lib/match/import-filter.ts` para Apify, Google Jobs y Fantastic. Entran sólo esas áreas. Atención al cliente y «Otras áreas» entran sólo con puestos de analista para arriba. Se rechazan títulos de chofer, operario, mostrador, cajero, repositor, mozo, vigilador, contact center, vendedor de salón o viajante y similares. La importación los cuenta como `fuera_de_area` o `puesto_no_buscado`. La sync diaria cierra los que ya estaban, con el motivo «Fuera de las áreas que importamos». Simulado sobre el inventario del 19/10: cierra 1.070 importados y los elegibles bajan de 5.200 a 4.130. Las bolsas de empleadores (ATS) no se filtran.
- Palabras de LinkedIn reemplazadas por 56 búsquedas de esas áreas (`APIFY_KEYWORDS.linkedin`). La fuente por defecto de Apify pasa a ser sólo LinkedIn. En la home, «áreas, de tecnología a gastronomía» pasa a «de tecnología a finanzas».
- **Hecho (paso 2, código):** `--actor=valig` o `--actor=cheap` cambia el Actor de LinkedIn por uno más barato: valig/linkedin-jobs-scraper (US$0,40 cada 1.000 en el plan gratis) o cheap_scraper/linkedin-job-scraper (US$0,70; mínimo 150 filas). El actual cuesta US$2. El id sale del enlace de LinkedIn, así que un mismo aviso no se duplica entre Actors. Los dos descartan chofer, operario, mostrador y similares antes de cobrar la fila. Se piden sólo campos del aviso, nunca los de quien lo publica. Hasta 500 filas por corrida.
- Saldo de Apify al 19/10 (consulta gratis): plan gratis, US$4,56 usados de US$5 en octubre. Se renueva el 1/11.
- **Prueba hecha (19/10, crédito gratis de octubre):** valig trae descripción completa en el 100% de los avisos y el 92% pasa el filtro. Costo real: US$0,41 cada 1.000 filas. Detalle en IMPORTACIONES. No hizo falta probar cheap_scraper.
- **Compra aprobada por el dueño (19/10):** 10.000 avisos, tope US$29, compra única. El dueño tiene que pasar la cuenta de Apify a Starter y cancelar la renovación. El código ya acepta el tope y `--date-posted=month`.
- Guardado por tanda: cada búsqueda paga se guarda en disco apenas termina, y el paso de importar corta a los 135 min para que siempre quede tiempo de commitear (ver IMPORTACIONES).
- Plan Starter activado por el dueño el 19/10. Saldo: US$0,08 usados de US$19 de tope mensual. Tanda 1 lanzada (14 búsquedas de tecnología y datos × 500, tope US$3,20).
- **Tanda 1 hecha (19/10, 03:51–04:23 UTC):** 11 de las 14 búsquedas de tecnología (frenó por el tope de US$3,20 estimado). 3.823 filas, 3.623 pasaron los filtros, pero sólo +914 avisos nuevos (+45 actualizados, 97 repetidos). Las búsquedas de tecnología se pisan mucho entre sí en una semana de LinkedIn. Gasto estimado conservador US$3,08 (real ≈ US$1,6). Guardado bien en `main`. Elegibles: 5.722.
- El inventario quedó en 52,6 MB, cerca del límite de GitHub. Se partió en `inventory.json` + `inventory-imported.json` antes de seguir (ver IMPORTACIONES).
- **Siguiente:** tandas 2 a 4 con `--date-posted=month` y menos filas por búsqueda (300), para traer más avisos distintos: marketing, producto y diseño; finanzas; ventas B2B, RRHH, legal y operaciones. Faltan 3 de tecnología (data engineer, data analyst, data scientist, business intelligence, machine learning).
- **Integración de lo comprado (pedido del dueño, 19/10):** descripciones de valig desde el HTML (requisitos detectados 0% → 76%), modo `refetch` para corregir lo ya pagado sin volver a pagar, dominios conocidos para logos (grupos elegibles con logo 45% → 62%) y tareas de entrenamiento de IA fuera del filtro. Detalle en IMPORTACIONES. **Pendiente:** correr `refetch --since=2026-10-19` cuando termine la tanda 2.
- **Tanda 2 hecha (04:31–05:21 UTC):** 19 búsquedas de datos, producto, diseño y marketing, de hasta un mes. 5.227 filas, **+1.388 nuevos**. Elegibles 7.010. Después, `refetch --since=2026-10-19` actualizó 2.520 avisos de LinkedIn con descripciones con formato, sin costo.
- **Tanda 3 lanzada (05:25 UTC):** 26 búsquedas de finanzas, ventas B2B, RRHH, legal y operaciones. Para acercarse a 10.000 hace falta pool nuevo: tecnología del último mes (la tanda 1 fue de una semana) y `--location=latam` (puestos remotos para Latinoamérica).
- **Tanda 3 hecha (05:25–06:34 UTC):** 26 búsquedas de finanzas, ventas B2B, RRHH, legal y operaciones. **+1.574 nuevos.**
- **Tanda 4a hecha (06:35–07:14 UTC):** 15 búsquedas de tecnología en Argentina, de hasta un mes. **+652 nuevos.**
- **Tanda 4b (06:36–08:24 UTC), error:** 20 búsquedas con `--location=latam` trajeron 5.948 filas, pero 5.459 eran puestos ubicados en Brasil, México, Colombia y otros países: LinkedIn interpreta «Latin America» como cualquier país de la región, no como remoto regional. Se rechazaron bien (`pais_no_confirmado`) y sólo sumaron **+57**, pero las filas se pagaron (≈ US$2,1). No repetir sin probar antes una sola búsqueda.
- **Cierre de la compra (19/10):** 4.651 avisos nuevos de LinkedIn, todos abiertos, 4.649 elegibles y 3.464 con requisitos detectados. Gasto real US$9,76 del plan Starter (tope de la cuenta US$19, aprobado US$29). Catálogo como lo cuenta la web, con el filtro de áreas aplicado en ambos: elegibles 3.483 → 6.898 y empresas con elegibles 1.176 → 2.181. **Pendiente del dueño:** cancelar la renovación de Starter en Apify. No se llegó a 10.000 porque las búsquedas de LinkedIn Argentina se agotan: cada tanda repitió entre el 55% y el 85% de lo ya importado.
- (Histórico) prueba de hasta US$1 (pendiente de OK del dueño) con 2 o 3 actores de LinkedIn más baratos que el actual (US$2 cada 1.000). Hay que medir cuántos traen descripción completa, cuántos son nuevos y cuántos pasan el filtro. Ojo: la cuenta de Apify usó US$4,56 de US$5 en octubre. Si está en el plan gratis, para gastar más hay que pasar a Starter (US$29 por mes, que vuelven como saldo; cancelarlo después de la compra) o esperar al 1/11.
- **Paso 3:** compra en tandas de US$5 con tope total aprobado, frenando si bajan los avisos nuevos que pasan el filtro.

## Home mobile igual a jobright: hero, laureles y cifras (18/10/2026)

- Pedido del dueño con capturas de iPhone: el hero y las cifras de la home tenían que copiar las medidas de jobright. Se midieron sus estilos computados a 390 y 1440 px y se aplicaron en `src/app/page.tsx`.
- Mobile: línea liviana Titillium 36/32 en mayúsculas, titular de 60 px (baja hasta 48 en pantallas de 360), bajada de 13/16, dos botones de 36 px uno al lado del otro, marco del video a 16 px del borde con barra de 41 px y 44 px entre bloques. Cifras en Titillium 24 700 con línea guía de guiones de 1 px hasta un ícono de 24 y rótulo de 13/16; titular de la sección centrado en 32 px.
- Volvieron los laureles (`Laurels.tsx`, 108 × 30 en mobile y 144 × 40 en escritorio), con datos de Maru y no premios: «Del CV a la entrevista», «Extensión para Chrome» y «Plan gratis sin tarjeta». Cada sello es un link a la página que lo respalda (entrevista, extensión y planes). El QC del 17/10 los había sacado por parecer premios; los volvió a pedir el dueño.
- Escritorio: sellos arriba del titular de 52 px, conector punteado hacia las cifras y cifras de 44/48 como en jobright.
- Textos traducidos de jobright, pedido explícito del dueño: el titular pasa a «Basta de buscar trabajo sin ayuda / Hacelo con IA» (las dos líneas dentro del `h1`, como en jobright) y la sección de cifras a «Resultados reales, no solo promesas». Ojo: el QC del 17/10 había sacado «Resultados reales» porque Maru no tiene resultados de contratación medidos; debajo siguen sólo cifras del catálogo. Si se quiere otra vez el criterio anterior, cambiar a «Cifras reales».
- Laureles cambiados a la opción A que eligió el dueño: «Autocompleta en Greenhouse y Lever», «Extensión para Chrome» y «8 herramientas en una cuenta». Los dos primeros llevan a la extensión y el tercero a las herramientas de la home. `Laurels.tsx` acepta un segundo renglón (`second`) para textos que no entran en 108 px. Los ítems de «Resultados reales» pasaron a cuatro, aprobados por el dueño y contados sólo sobre avisos que se pueden pedir desde Argentina: avisos abiertos, empresas, remotos y áreas (sin "otros"). Las tres primeras cifras van redondeadas hacia abajo con `atLeast` («4.100+»). Se descartó «avisos nuevos esta semana» porque hoy coincide con todo el catálogo. **Siguiente propuesto:** un contador de postulaciones preparadas para sumar un resultado de uso real en lugar de las áreas.
- Bajada del hero traducida de jobright, pedido del dueño: «Conseguí avisos que encajan con tu perfil, autocompletá postulaciones y adaptá tu CV en menos de 1 minuto». Falta medir con el proveedor real que el CV adaptado salga en menos de un minuto; si no, ajustar el tiempo de la frase.
- Cinta negra de la home con logos de empresa: antes mostraba sólo la inicial porque `landingData` no pasaba el logo (los de PR #85/#86 ya se veían en Búsquedas, Match y detalle). Ahora elige primero avisos recientes con logo y completa con los demás; hoy los 16 tienen logo.
- Se quitó la leyenda «Demo ilustrativa…» debajo del video, a pedido del dueño. Los laureles quedan a 44 px del marco, como en jobright.
- QC: sin desborde horizontal a 360, 390, 768 y 1440 px. Capturas comparativas fuera del repo.

## Login sólo con Google y funnels en PostHog (18/10/2026)

- **Login:** se sacó el link por email. Quedan `/api/auth/google` y su callback; se borraron `/api/auth/request`, `/api/auth/verify`, `src/lib/mailer.ts` y `nodemailer`. `SMTP_URL` y `EMAIL_FROM` ya no se usan (se pueden borrar de Vercel). Sin `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` el diálogo avisa que el ingreso no está disponible. Las sesiones viejas creadas con el link siguen valiendo (misma cookie).
- **PostHog:** `posthog-js` con eventos propios y dos tableros (funnel general y uno por herramienta) en el proyecto 670796 de Growth Labs 2. Detalle en [TRACKING.md](TRACKING.md#posthog-funnels-de-producto-desde-el-18102026). Falta: `NEXT_PUBLIC_POSTHOG_KEY` en Vercel (Production) y un deploy; después, revisar en PostHog → Activity que lleguen `$pageview` y `seccion_vista` desde www.marucoach.com.

## Foto del CV en PDF y preguntas opcionales (17/10/2026)

**Publicación a comprobar:** Vercel rechazó la preview de PR #83 con `Deployment rate limited — retry in 24 hours`. No afirmar que estos cambios ya están activos hasta confirmar un deployment Ready de main que los incluya. Si también rechaza Production, reintentar el último main cuando se libere la cuota; no cambiar el plan ni crear otro proyecto para eludirla.

- Reporte del dueño: falta la foto en PDF; Word no probado; no recuerda si estaba en la hoja o sólo en el panel. Reproducido un caso concreto: subir foto y descargar antes de aplicar el recorte producía un PDF sin imágenes. Con la foto aplicada, el exportador anterior sí la incluía; no atribuir todos los casos a una pérdida del servidor.
- El editor ahora muestra «Foto pendiente» y deshabilita PDF/Word hasta tocar «Usar foto» o cancelar el recorte. Después exporta la foto elegida. El PDF espera la decodificación de imágenes embebidas y falla si no puede cargarlas, evitando archivos incompletos. Conserva CSP, JavaScript deshabilitado y bloqueo de recursos externos de PR #81.
- «¿Por qué esta vacante? (opcional)»: ayuda breve «Para personalizar tu presentación y tus respuestas». Se quitó la exigencia en frontend, análisis y generación; sin motivación, los prompts usan la experiencia sin inventar interés personal.
- «Para destacar»: se recomienda responder para adaptar el CV a la vacante y se explicita que es opcional. El CV general recibe la ayuda equivalente para el puesto buscado.
- QC con Computer Use: recorte pendiente bloquea descarga; foto circular y cuadrada presentes en PDFs reales; flujo completo sin motivación ni respuestas opcionales; foto conservada tras recargar. Proveedor de IA simulado, exportador real, sin modificar el perfil del dueño ni consumir créditos.
- Validación: 372 tests aprobados, 8 omitidos; TypeScript y ESLint sin errores. Registro y reproducción en [QC de foto y postulación](QC-CV-FOTO-2026-10-17.md). Si el problema vuelve con la foto visible en la hoja y el recorte aplicado, revisar ese archivo concreto: ese caso no se reprodujo en esta sesión.
- CI encontró una prueba de autenticación no determinista que reemplazaba el primer carácter de una firma por «x», incluso cuando ya era «x». Ahora garantiza una firma diferente; la validación del login no se modificó.

## Desplegables de la extensión (17/10/2026, versión 0.3.1)

- Caso reportado: HiringRoom, vacante AI Business Partner de Newsan, pasos 2 y 3. Inspeccionados documento, país y los formularios desplegables de educación, idiomas y experiencia, sin datos personales ni envío de postulación.
- Causa: React Select antiguo sin `role=combobox` ni roles de opciones; inputs de uno o dos píxeles y algunos readonly. Ahora se reconoce su contenedor visible y se leen sus opciones por clase dentro de ese mismo control. También cubre botones/divs con ARIA y React Select actual sin buscador.
- Selección con eventos de mouse/puntero y teclado, espera acotada, cierre del menú y verificación del valor. No contar un clic rechazado como éxito ni elegir la primera de varias coincidencias. Preservar selecciones previas, opciones deshabilitadas y cambios de la persona mientras espera. Bloquear el submit sólo durante lectura/aplicación; el envío manual posterior sigue funcionando.
- Integrada sobre PR #78: conserva exclusión de frames ajenos, una ejecución por pestaña, número de lectura y restricciones de datos sensibles. Versionado del content script para reemplazar una inyección anterior al actualizar.
- QC en Chrome: 8 campos completados en la fixture compartida (incluidas las dos variantes de HiringRoom), 2 casos deliberadamente pendientes, 3 selecciones previas conservadas y cero envíos; React Select real completa 3 y conserva Uruguay. 358 tests aprobados (16 regresiones nuevas), 7 omitidos; TypeScript y ESLint sin errores. La extensión instalada no se controló de punta a punta: no confundir inspección de HiringRoom con una postulación real. Registro: [QC de extensión](QC-EXTENSION-2026-10-17.md).
- Para el dueño: actualizar los archivos de la misma carpeta instalada, recargar Maru en `chrome://extensions` y volver a tocar Completar. No desinstalar para actualizar. En HiringRoom abrir primero los bloques del paso 3; si elegir país habilita provincia/localidad, volver a completar para leer las nuevas opciones. No hay consultas extra automáticas ni cambios de permisos.

## Escritura con Slop Monstruo (17/10/2026)

**Publicación confirmada:** el 17/10 a las 17:49 ART se verificó `www.marucoach.com` en Production, Ready, deployment `dpl_GzPce2gzoVKuqRfiTnzpnsWw9cxz`, commit `8d50661` (incluye PR #76 y #78). El rechazo anterior por `build-rate-limit` quedó superado.

Queda la prueba con proveedor real de una carta y un guion ficticios para verificar idioma, hechos, longitud y checker. El código ya está publicado; esa validación no se realizó en esta pasada de desplegables.

- Fuente en español fijada y licenciada, skill instalada y adaptación de servidor para todos los planes. Política común en las 14 rutas de redacción; extracción literal excluida.
- Checker de prosa y una revisión condicional por pedido, con guardias de cifras, siglas, links, campos permitidos, longitud y esquema. Timeout o error conserva la generación válida; no usa cuotas extra del usuario ni sesiones CLI. La segunda familia de modelos de la skill no está implementada online. Detalles y límites: `docs/ESCRITURA.md`.
- Ajuste final del CTA de Match: lleva directamente a `#empezar` con el aviso precargado, igual que las tarjetas de Búsquedas, para evitar otra pantalla de presentación. Este ajuste está incluido en el deployment confirmado arriba.
- Corregidos los laureles “100% gratis” en las landings de herramientas y la FAQ de entrevista que decía un pedido por mes en vez de por semana. Se muestran los límites de los planes.
- Validación: 340 tests aprobados (14 de escritura), 7 omitidos; TypeScript y ESLint sin errores. El smoke test con cartas y guiones del proveedor real queda pendiente del deploy. No se reescriben documentos ya guardados.

## Home y recorrido hacia las herramientas (17/10/2026)

- Quitados el selector Web/Extensión y la franja repetida de descarga. La extensión queda en Herramientas; se agregó también la entrevista al menú.
- Home revisado por bloques: presentación y dos entradas claras (Match y catálogo), cifras con alcance geográfico, buscador sin CV, muestra estática de avisos, recorrido y ocho herramientas, preguntas frecuentes y cierre. Se quitaron laureles, estadísticas ajenas presentadas como resultados y carruseles que repetían información. Los ejemplos siguen rotulados.
- Las cifras ahora excluyen avisos de más de 120 días y sin enlace, como el catálogo visible; se agregó regresión. Las modalidades inferidas se identifican.
- CTA principal de Match, tarjetas del catálogo y detalle: **Postulación personalizada**, verde, con el aviso precargado. La fuente queda como enlace secundario **Ver aviso original**. Abrir una fuente ya no marca una postulación como enviada: ese estado lo confirma la persona en Seguimiento.
- Se explicitan límites del plan gratis y condiciones del feedback de cámara; las FAQ reflejan sincronización, Google y frecuencia por fuente. No se cambiaron planes, cuotas ni pagos.
- Revisión editorial con Slop Monstruo en español: copia visible del home 5/5, sin tomar ese puntaje como validación factual. La revisión adicional con la CLI de Claude no estuvo disponible: su sesión OAuth local venció; no se aceptó ninguna salida como texto editado.
- QC: menú de herramientas y Escape, lectura móvil, FAQ del plan gratuito y ausencia de desborde horizontal. Evidencias y validación final en `docs/QC-HOME-2026-10-17.md`.


## QC y porcentaje de Match (17/10/2026, PR #71)

- **Seguimiento de objetivos en texto libre:** se detectó que “inteligencia artificial” no reconocía AI y que un objetivo corto se diluía contra toda la lista de requisitos. Corregido con equivalencias de frases y cobertura del objetivo por evidencia: título > requisito > deseable > mención de contexto. Director/Head/Founder son genéricos y ya no justifican experiencia directa en otra especialidad. Cuatro regresiones adicionales; no se modificaron preferencias reales de la cuenta.
- Calibración pedida por el dueño: quitar la doble penalización de intención y los topes 95/98; datos ausentes afectan confianza, sin asignarles 50%. Roles contenidos en títulos largos, equivalencias locales y deseables con peso limitado. La antigüedad de una persona no implica Lead.
- Afinidad separada del orden: guardados, descartes y frescura mantienen el ranking sin alterar el porcentaje. Se preservan las mejoras hasta PR #70, incluidos ubicación, elegibilidad, variedad de empresas, idioma y ocultamiento a 120 días. Las búsquedas agregadas por la persona no desaparecen por el umbral de coincidencia mínima.
- Regresión reproducible con cinco perfiles ficticios sobre el mismo catálogo: [decisiones, muestra y resultados](QC-MATCH-2026-10-17.md). Máximos administración 82→100, ventas 95→100, datos 91→92, marketing junior 74→85, operaciones 93→88 (baja al corregir ciudad/provincia). Son pruebas de coherencia, no validación de contrataciones.
- QC visual detectó que Mar del Plata, Provincia de Buenos Aires se presentaba como la ciudad de Buenos Aires. Corregida esa comparación, con regresiones de formatos y alias CABA/Capital Federal. Guardar, preparar postulación y cambiar estado en seguimiento comprobados en preview, con datos ficticios.
- Bug del editor CV/carta corregido: guardar mientras escribe, conservando el cursor y Escape. Antes se perdía la última edición si recargaba sin salir del campo.
- Idioma sin nivel corregido: queda por confirmar, sin dar por cumplido inglés avanzado ni excluir por un nivel desconocido. La confianza refleja años de experiencia desconocidos y salario no comparable.
- QC completo de postulación (CV y ocho campos, sin inventar disponibilidad/salario), entrevista (4 preguntas + 3 repreguntas, informe 70 conservado al recargar) y Match móvil a 390 px sin desborde. Límites y mejoras menores documentados en el registro.
- Ver el registro de QC en ese documento para distinguir esta pasada de la anterior y sus limitaciones. No repetir importaciones de proveedores para validar el ranking: `scripts/match-calibration.ts` usa el inventario local.

Actualizado el 16/10/2026 (noche: importación de avisos, ver "Avisos: qué falta"). Las PR #23 (cuentas, sincronización y planes), #24 (teleprompter, cámaras y perfil en texto), #26 (piloto Apify y calidad de avisos), #27 (panel privado de proveedores), #29 (muestras y fechas SerpAPI) y #30 (allowlist admin) ya están integradas en `main`. El login Google de la PR #22 está preservado. Los pilotos siguen separados del inventario público; no se activaron consumos recurrentes.

## Conversiones de Google Ads (17/10/2026)

Mergeado a `main` en la PR #77. Detalle completo en `docs/TRACKING.md`.

- **Hecho en código:** etiqueta de Google directa (sin GTM), capa central `src/lib/tracking`, deduplicación por cuenta en Redis, los cuatro eventos (activación, límite con planes visibles, inicio de checkout, compra verificada) y el modal de planes al chocar con el cupo gratis (`PaywallHost`).
- **Hecho en Google Ads:** 4 acciones "Maru | …" (todas secundarias), objetivo personalizado "Maru | Optimización límite gratuito" (sólo "Límite alcanzado") asignado como único objetivo a las 3 campañas MARU_AR_SEARCH_*.
- **Hecho:** `/privacidad` actualizada con la etiqueta de Google Ads. Puja de las 3 campañas de Maru: Maximizar conversiones (objetivo personalizado).
- **Hecho:** variables `NEXT_PUBLIC_GOOGLE_ADS_*` cargadas en Vercel (Production, tipo Config).
- **Hecho:** merge a `main` (PR #77, commit `6d4fd34`).
- **Falta:** el deploy de producción. Vercel lo rechazó el 17/10 a las 22:27 UTC por la cuota diaria del plan gratis (`api-deployments-free-per-day`); producción sigue en el `main` de la PR #91, sin la etiqueta. Al liberarse la cuota, redeployar el último `main` y confirmar un deployment Ready que incluya `6d4fd34` (ver la nota de publicación al principio). Después, la verificación en producción (lista en `docs/TRACKING.md`).

## Píxel de Meta (18/10/2026)

Detalle en `docs/TRACKING.md` → "Píxel de Meta".

- **Hecho en código:** píxel de Meta directo (sin GTM), mismos cuatro hitos y misma deduplicación que Google Ads desde un único punto de envío (`maru_core_activation`, `maru_paywall_viewed`, `InitiateCheckout`, `Purchase` con importe ARS). `/privacidad` actualizada.
- **Hecho:** píxel creado por el dueño ("Maru Coach", 1466577088716669). Página de Facebook "Maru Coach" (1382450011616535) en el negocio Costa Reset. API de conversiones en código (`capi.ts`), con el mismo eventID que el píxel.
- **Falta (manual, la integración de Vercel da 403 en el equipo grego7):** cargar en Vercel → Production `META_CAPI_ACCESS_TOKEN` (secreto; el ID del píxel ya va en el código) y redeployar cuando haya cuota; crear la conversión personalizada "Maru | Límite gratuito alcanzado" sobre `maru_paywall_viewed`; verificar en "Probar eventos".
- **Hecho:** merge a `main` (PR #98). Creativos estáticos (5 piezas × feed y stories) y plan de campaña en `marketing/meta-ads/`.
- **Hecho (borrador, sin publicar):** campaña `MARU | Límite gratuito | AR | Test01` (120248861665880157), conjunto `MARU | Estáticos | AR | Límite gratuito` (optimiza directo por el evento `maru_paywall_viewed` del píxel, sin conversión personalizada) y 4 anuncios (Match, CV, Carta, Video). Revisión del 18/10: campaña pasada a **en pausa** en el borrador; las 10 imágenes ya están subidas a la cuenta (hash por archivo en el historial de esta sesión: p. ej. `maru-01-match-feed` = 444417a1…).
- **Hecho (18/10, borrador en pausa):** 5 anuncios nuevos con creativo feed (1080×1350) + story (1080×1920) por ubicación: Match, CV, Carta, Video y Todo en uno (botón Registrarte). Sin cuenta de Instagram propia: Meta usa la página de Facebook (identidad 17841412257155092); no se usa templo.ninja. Los 4 anuncios anteriores, sin imagen, quedaron borrados en el borrador.
- **Píxel:** el código ya estaba en `main` (PR #98 y #100), pero esos deploys fallaron por el tope del plan gratis de Vercel ("Deployment rate limited"). El merge de la PR #101 (`fa11887`, que lo incluye) deployó bien el 18/10 a las 02:54 UTC. **Falta:** confirmar en Administrador de eventos → Maru Coach → Probar eventos que llega `PageView` desde `www.marucoach.com`, y después publicar la campaña (ver arriba los dos anuncios de Templo Ninja con error en el mismo borrador).
- **Falta:** reel de uso de la plataforma (conjunto 2).
- **Propuesta de creativos (19/10):** `marketing/meta-ads/PROPUESTA-CREATIVOS.md`. Datos al 19/10: 2.373 ARS, 879 impresiones, 26 clics, 0 límites alcanzados; Meta puso el 82% en Match y Carta/Video no salieron; Reels 0 clics. Propone 6 ángulos × 4 formatos × 3 personas, tanda 1 de 4 piezas, optimizar por activación, sacar Audience Network y guardar `utm_content` en la activación. **Falta:** que el dueño apruebe los cambios de campaña y producir las piezas.
- **Tanda 1 (19/10, borrador sin publicar):** el dueño decidió no tocar la configuración de la campaña (sigue optimizando por límite alcanzado, con Audience Network) ni grabar la pieza a cámara. Conjunto nuevo `MARU | Tanda 1 | AR | Límite gratuito` (120248878723550157) en la misma campaña, con el presupuesto de la campaña, que ahora se reparte entre los dos conjuntos. Tiene 7 anuncios con identidad @marucoach.ai (17841416018999457); piezas, textos y URL en `marketing/meta-ads/tanda1/`. Los 6 de una imagen no tienen errores. **Falta:** el carrusel (120248878768460157) tiene el error `ObjectStorySpecRedundant` (imagen por URL y por hash): hay que crear un creativo nuevo con los `image_hash` de las tarjetas, armar otro anuncio y borrar el que tiene error. Después, publicar desde Administrador de anuncios.

## Calidad de avisos: plan en curso (desde 17/10/2026)

Regla de trabajo pedida por el dueño: **cada avance se mergea a `main` y se anota acá**, para que otra sesión pueda seguir si se cortan los tokens. Diagnóstico de partida (17/10, sobre 3.966 oportunidades elegibles):
- 22% en "Otros";
- 46% sin seniority;
- 39% sin modalidad;
- 14,5% con más de 60 días (todas de ATS gratuitos);
- 2.854 importados nunca revisados por liveness;
- "Córdoba, España" figuraba como elegible.

| # | Paso | Estado |
| --- | --- | --- |
| A | Clasificación: familias nuevas (Industria y oficios, Gastronomía y hotelería, Comercio y retail, Seguridad, IA e idiomas por proyecto), reglas corregidas y seniority de oficios | **Hecho** (ver abajo) |
| B | Elegibilidad: el país antes que la ciudad (Córdoba, España), provincias del interior y ciudades del exterior | **Hecho** (ver abajo) |
| C | Frescura: ranking por antigüedad (bajar >60 días, ocultar >120) y liveness rotativa de todos los importados | **Hecho** (ver abajo) |
| D | Modalidad: "presencial (inferido)" en portales locales con ciudad y sin mención de remoto | **Hecho** (ver abajo) |
| E | Métricas de calidad en `match:report` y presentación (empresa confidencial, consultoras, sufijos de ciudad en el título) | **Hecho** (ver abajo) |
| F | Google Jobs mensual automático (gratis) | **Siguiente**: lo decide el dueño |
| M | Match preciso: tipo de puesto además del área (no más "Vigilador" para ventas ni "Operario" para analistas) | **Hecho**: [research](research/match-precision-2026-10-17/README.md). Siguiente: habilidades de generalistas en `findSkills` |
| L | Logos de empresa | **Hecho (1ª parte)**: el logo de una empresa se reusa en todos sus avisos (`src/lib/match/logos.ts`, en `loadInventory`): elegibles visibles con logo 21% → 41,5% (724 → 1.426 de 3.438). Apify pide y guarda el logo en las próximas importaciones (LinkedIn `companyLogo`; Computrabajo/Indeed con nombres de campo a confirmar en la primera corrida). **2ª parte (hecha):** si la empresa no tiene logo, se busca su sitio en el texto de sus avisos (sólo si el dominio coincide con el nombre: "Caylent" → caylent.com) y se muestra su ícono con el servicio público de Google (`withCompanyLogos`): 96 empresas, cobertura 41,5% → 47,1%. Sin red en las sesiones de Claude no se puede verificar más; un dominio curado en `companies.json` sumaría el resto |
| S | Salario publicado en el texto del aviso | **Hecho** (`src/lib/match/salary.ts`): si ninguna fuente lo trae estructurado, se lee del texto sólo cuando lo anuncia una palabra de salario (nunca "salario estimado", rondas de inversión, CCT ni 401k). Moneda por símbolo o formato (1.300.000 = pesos; $5,000 = dólares), período y rango plausible. En los elegibles abiertos suma 188 avisos con salario a los 415 que ya tenían (+45%). Se aplica al reconstruir oportunidades en la próxima sync |
| N | Seniority y años pedidos | **Hecho** (`EXTRACTION_VERSION` 8): años en más formas ("experiencia mínima de dos años", "minimum 8 years", "3+ years", meses), sin edades ni historia de la empresa (tope 15 años), y "sin experiencia / primer empleo / entry level" = junior. Elegibles abiertos con seniority: 2.467 → 2.789 (57,5% → 65%). La sync re-analiza todo con la versión nueva |
| H | Habilidades de áreas no técnicas | **Hecho** (`EXTRACTION_VERSION` 9): facturación, conciliaciones, tesorería, cobranzas, impuestos (IVA, IIBB, AFIP/ARCA), Tango, Bejerman, onboarding, clima y relaciones laborales, WMS, inventario, comercio exterior, planificación de demanda, última milla, autoelevador, licencia de conducir, atención al público, caja, televentas, merchandising, manipulación de alimentos, seguridad e higiene, mantenimiento. Logística con requisitos: 186 → 216; comercio 48 → 61. El puntaje cambia poco (±3); mejora sobre todo la explicación de brechas ("Pide WMS: no aparece en tu CV") |
| P | Presentación: tope 99% y fecha | **Hecho**: el % visible nunca es 100 (`MAX_SCORE` = 99, es una estimación) y la tarjeta del Match dice "Vista por primera vez: fecha" cuando la fuente no informa la publicación (25% de los elegibles) |
| V | Búsquedas para verticales flojas | **Corrida 1 hecha (17/10, 22:02 UTC)**: 15 búsquedas de Google Jobs (plan gratuito, quedan 20 de reserva) → 103 filas, 66 aceptadas (36 descartadas por ofrecer sólo agregadores), +53 avisos nuevos. Por vertical: Educación 7, Construcción e inmobiliario 24, Arte y medios 19, Banca y seguros 8, Salud 8. Sin resultados: maestro mayor de obras Córdoba, oficial de cuentas banco, farmacéutico Córdoba. Quedó afuera v-edu-capac. **Antes**: 16 búsquedas de Google Jobs `v-…` en `SERP_QUERIES` (Educación, Construcción e inmobiliario, Arte y medios, Banca y seguros, Salud). No corren por defecto: `--queries=v-edu-caba,v-cons-arq,…` en el workflow de importación, dentro del plan gratuito y la reserva de 20. Apify está casi en el tope de US$5: para usarlo en estas verticales hace falta aprobación nueva |
| T | Tecnología, marketing y finanzas fuertes (prioridad del dueño, 17/10) | **Hecho (1 y 2)**. Diagnóstico: tecnología 529 elegibles de 217 empresas (60% llega solo de ATS); marketing 131, la mitad de 2 agencias offshore; finanzas 439 pero el 91% importado y vence a los 30 días. (1) Conectores nuevos gratis **SmartRecruiters** (sólo avisos de Argentina) y **Recruitee**, y 19 empresas al directorio con evidencia de sus propios avisos: COMAFI, Pearster, Suessa, Abacum, Cocos Capital, Tether, Louis Dreyfus, Walmart, Accor, Sika, Lesaffre, Talan, Ruby Labs y otras. La sync diaria las confirma o las marca fallidas. (2) Google Jobs automático los días 2 y 17 (10:07 UTC) con 30 búsquedas de marketing (`mk-…`) y finanzas (`fz-…`) del plan gratuito, reserva 20 (`--queries=mensual`). **Siguiente:** bancos y fintech grandes en Workday/SuccessFactors; perfiles de benchmark de marketing y banca; Apify para estas áreas si el dueño aprueba tope |
| T2 | Tecnología, marketing y finanzas: resto | **Hecho**: conector **Workday** (búsqueda "Argentina" en el sitio de empleo, uso mínimo; no es API documentada) y 22 multinacionales al directorio (PwC, Fiserv, Marsh McLennan, Thomson Reuters, dentsu, Essity, Natura, Accenture, Pfizer…). Perfiles de prueba de marketing, banca y desarrollo junior ([research](research/match-areas-2026-10-17/README.md)): "con …" en el título ya no cuenta como puesto, el Gran Buenos Aires pesa ×0,95 para quien busca en CABA, y habilidades de banca y trade marketing (`EXTRACTION_VERSION` 10). **Pendiente:** Apify para marketing y finanzas (falta que el dueño apruebe un tope); oferta junior de tecnología; SuccessFactors (Grupo Sancor Seguros, YPF, Techint, Swiss Medical) |
| T3 | Grandes empleadores sin gastar (Apify en pausa por pedido del dueño, 17/10) | **Hecho**: conectores **Eightfold** (Mercado Libre, Softtek, Haleon) y **SuccessFactors** (página de búsqueda pública: YPF, Techint, EY, Swiss Medical, Grupo Sancor Seguros, Claro, Bunge, Mirgor, BCD, COFCO, Arauco, DRiV, AngloGold); 16 empresas al directorio con evidencia. Ninguno de los dos es API documentada: uso mínimo (sólo Argentina, en serie) y SuccessFactors falla en vez de vaciar la bolsa si cambia el formato. Tecnología junior: 6 búsquedas `tj-…` sumadas a la tanda automática de Google Jobs (36 por corrida). **A verificar en la sync del 18/10:** cómo respondieron SmartRecruiters, Recruitee, Workday, Eightfold y SuccessFactors (no se pudieron probar en vivo desde las sesiones de Claude, sin red) |
| Q | Sin área y comprobación ciega (pedido del dueño, 17/10) | **Hecho.** (5) Área cuando el título no alcanza (`familyOf`): reglas extra de título, área que informa la fuente y proyectos de IA en el texto. Clasifica 300 de los 809 abiertos en "otros" (57 de 218 elegibles); `EXTRACTION_VERSION` 11. (8) [Comprobación ciega](research/match-ciego-2026-10-17/README.md) con 6 perfiles nuevos: 18 de 30 útiles, 7 dudosos, 5 falsos, y el #1 útil con 80% o más en 5 de 6. Se corrigió "asistente" = junior. Los cuatro pendientes que dejó se resolvieron en la fila T |
| R | Remotos "por confirmar" que el texto resuelve (18/10) | **Hecho.** Sobre 13.424 avisos guardados, "por confirmar" baja de 619 a 481. 44 pasan a elegibles porque el aviso ata la residencia a LATAM, Argentina o cualquier lugar ("based in Latin America", "100% remoto desde cualquier país de Latam", "we hire globally"); la frase queda como evidencia. 94 pasan a no elegibles: remotos atados a un estado o región de otro país (Texas, New South Wales, Saskatchewan, "North America") o que piden vivir en otro país ("candidates located in Colombia"). "Clientes de LATAM" o "LATAM Airlines" no cuentan. `EXTRACTION_VERSION` 12 re-analiza todo en la próxima sync. Quedan ~400 de Get on Board con "Remote" y nada más en el texto |
| S | Deploys de Vercel (18/10) | **Hecho.** `vercel.json` con `ignoreCommand` (`scripts/vercel-ignore-build.sh`): no se despliega si el cambio sólo toca docs, tests, scripts, marketing, video, tools, `.github` o `.md`. Compara contra el último deploy exitoso de la rama (`VERCEL_GIT_PREVIOUS_SHA`); ante cualquier duda, construye. Los cambios de `data/` (sync diaria) siguen desplegando |
| T | Pendientes de la comprobación ciega (18/10) | **Hecho.** (1) En datos e IA el cargo técnico dice la disciplina (`parseRole`): Data Scientist ya no coincide con Data Engineer; Data Architect sí, como paso siguiente. (2) Cargos de apoyo sin nivel ("Administrativo contable", "Recepcionista", "Asistente") se estiman junior en el ranking, con la brecha "parece un puesto de apoyo"; el aviso no cambia. (3) Sin modalidad informada en otra ciudad: ×0,8 (antes ×0,88); con la ubicación indispensable, ×0,7; híbrido en otra ciudad, ×0,75 (antes ×0,8). Antes/después en el [seguimiento del 17/10](research/match-ciego-2026-10-17/README.md#seguimiento-1810). (4) [Comprobación ciega nueva](research/match-ciego-2026-10-18/README.md) con 6 perfiles de tecnología, marketing y finanzas: 21 de 30 útiles, 9 dudosos, 0 falsos, y el #1 útil con 80% o más en 5 de 6. Después, títulos de finanzas: "…para la Industria Financiera / para empresa X / en el sector X" dicen el rubro, no el área (se quitan al comparar cargos), y "Auxiliary" / "Clerk" son cargos de apoyo. Queda "Customer Finance Coordinator" (cobranza o financiación a clientes) |
| U | Hacia el 10/10 sin gastar (18/10) | **En curso.** Hecho: (1) [`match-probe.yml`](../.github/workflows/match-probe.yml), una consulta GET a URLs públicas desde Actions con un input `find`, para investigar fuentes sin red en la sesión. (2) Eventos de Match con el tramo del % (`tramo`, `familia`, `confianza`, `lista`) en guardar, descartar, ver aviso y preparar postulación. En PostHog: tasa de `match_guardar` y `match_preparar_postulacion` por `tramo` contra `match_ranking_visto`. (3) Conectores Breezy (`/json` + página del aviso) y BambooHR (`/careers/list` + `/detail`), con Rockcruit, Flux IT y Satellogic. Get on Board bloquea los pedidos por aviso desde Actions (403). (4) Primera sync con los conectores nuevos (18/10, 9:46 UTC): elegibles 3.746 → 4.451 (+705). Por área: tecnología 647 → 869, marketing 117 → 148, finanzas 79 → 97, administración y finanzas corporativas 577 → 670. Respondieron bien SmartRecruiters (6/6, 67 elegibles), Workday (21/22, unos 280; Essity sin avisos en AR), SuccessFactors (EY 230, Techint 52 y otras 6), Recruitee (Cocos 15), Breezy (55) y BambooHR (9). Se excluyen Eightfold (Mercado Libre, Softtek, Haleon: su API nueva "PCSX" responde 403 "Not authorized") y cuatro SuccessFactors con otro formato de búsqueda (YPF, Swiss Medical, Sancor Seguros, Mirgor). (5) Tether (Recruitee): 233 remotos sin país; los que dicen "Remote, Worldwide" en el título pasan a elegibles (`TITLE_WORLDWIDE`, `EXTRACTION_VERSION` 13). (6) Detalle de a tandas: SmartRecruiters, Workday, Eightfold, SuccessFactors, Breezy y BambooHR leen 40 detalles por sync en una ventana que rota cada día (`inDetailWindow`), y `applyBoard` conserva la descripción ya leída si el aviso vuelve sin detalle (EY tenía 41 de 230 con descripción). Ubicación de SuccessFactors sin código postal ni letra de provincia ("CABA, B, AR, 1001" → "CABA, Argentina"). **Siguiente:** formato alternativo de SuccessFactors para esas cuatro y HiringRoom (portal viejo sin JSON-LD; el nuevo `/portal` sí trae `JobPosting`) |
| V | Diseño igual a jobright.ai (pedido del dueño, 18/10) | **Hecho.** Relevamiento y plan en [DISENO-JOBRIGHT.md](DISENO-JOBRIGHT.md) (tokens, componentes, layouts, mapeo a archivos de Maru y qué no se copia: logo, nombre, ilustraciones, textos y archivos). Las capturas quedaron fuera del repo. Paso 1 hecho: tokens (`@theme`), header con pastilla y sombra, menú del celular a pantalla completa, footer `#ecffe0` y botones sin elevación. Paso 2 hecho: `ScoreRing` único (`src/components/ScoreRing.tsx`, tamaños sm/md/dark/lg, arranca a las 6, degradé neón → aqua en match fuerte, ámbar en buen match) en Match, celular y maquetas de producto; tarjetas con sombra al pasar el mouse, logo de 60 y etiquetas de radio 6. Paso 3 hecho: home con hero `#ecffe0` (video a la izquierda, titular Titillium 88/80 y botón de 56), métricas reales del catálogo con línea guía e ícono, cinta negra de avisos recientes, pasos en tarjetas blancas sobre panel gris de esquina recta, herramientas en filas texto + panel menta, maqueta del match con círculo general y chips ✓/✕, FAQ con ítems grises y botón final neón con borde fino. Paso 4 hecho: listado con campos y filtros grises de radio 12 (filtro activo en negro), detalle con íconos de línea de 16 en vez de emojis y skills en chips de acción rápida, y panel de filtros de Match blanco de radio 24. Los campos de los formularios de herramientas siguen blancos porque van sobre tarjetas grises. Paso 5 hecho: Match ya tenía la cabecera tipo `/ai-job-match` (titular en mayúsculas, tarjetas apiladas con anillo y banda de métricas reales); se cambiaron los últimos emojis de las maquetas por íconos de línea. QC visual de 11 páginas en 1440 y 390 sin desborde horizontal. **Queda para otra iteración:** barra de anuncio superior (opcional), cinta de testimonios (sólo con testimonios reales) y menú de usuario con avatar |
| W | Más oferta gratis (18/10, tarde) | **En curso.** (1) Get on Board: los "fully_remote" sin países (175 por confirmar, muchos de marketing y diseño) pasan a elegibles con `remoteGlobal`, salvo que la descripción pida vivir en otro país (Get on Board distingue `fully_remote` de `remote_local`). `EXTRACTION_VERSION` 14. (2) SuccessFactors con mosaico (22/10): YPF, Swiss Medical, Sancor y Mirgor usan la plantilla nueva del sitio (`li.job-tile`, total en `#tile-search-results-label`), no la tabla `tr.data-row`. `parseSuccessFactorsSearch` la lee si no hay tabla: la ubicación sale del campo `location` o del que la empresa etiqueta "Ubicación" (YPF usa `customfield3`; Swiss Medical y Mirgor no la muestran, y como la búsqueda ya filtra Argentina, sin ubicación se toma AR). Pagina con `data-per-page` (Mirgor va de a 5) y corta sin dar la lectura por completa si el sitio repite la página. Consultas con `match-probe` del 22/10, buscando Argentina: YPF 51, Swiss Medical 52, Sancor 5 (el sitio tiene 15, todos de Argentina, pero el filtro de ubicación sólo encuentra 5) y Mirgor 8 (de 57; el resto es de otros países). Las cuatro vuelven a `candidata`. **Siguiente:** ver en la próxima sync que las cuatro respondan, HiringRoom `/portal`, Mercado Libre sin la API PCSX y comprobación ciega nueva |

**A (hecho):** `EXTRACTION_VERSION` 6. Por título, "Otros" baja de 4.404 a 1.327 publicaciones abiertas, y en elegibles de 956 a 242. La sync diaria re-analiza todo con las reglas nuevas.
- Las familias nuevas suman 2.290 publicaciones abiertas: 1.769 de IA e idiomas, 261 de industria y oficios, 126 de comercio, 94 de gastronomía y 20 de seguridad.
- Lo que queda en "Otros" son títulos sin área clara ("Manager", "Specialist", "Principal").
- Se revisaron a mano los 319 títulos que cambiaron de área y se corrigieron los errores (inmobiliario, personas, ingenieros de procesos).

**B (hecho):** `EXTRACTION_VERSION` 7. Sobre las 13.372 publicaciones abiertas, la elegibilidad queda así:

| Estado | Antes | Después |
| --- | ---: | ---: |
| Elegibles | 4.202 | 4.290 |
| Por confirmar | 1.027 | 619 |
| No elegibles | 8.143 | 8.463 |

- Pasan a elegibles 90 publicaciones del interior que no decían "Argentina" (Resistencia, San Luis, Corrientes, Comodoro Rivadavia, Santiago del Estero…).
- Pasan a no elegibles 327 de ciudades o países del exterior que no se reconocían (Auckland, Atenas, Budapest, Dubái…).
- Una ciudad de nombre repetido (Córdoba, Rosario, San Juan…) ya no cuenta como Argentina si la fuente informa otro país donde existe o el título lo nombra.
- Los 619 "por confirmar" que quedan son casi todos "remoto sin región" (679 antes). Su antigüedad se trata en el paso C.

### Cómo seguir (para la próxima sesión)

**C (hecho, 17/10):**
- `src/lib/match/ranking.ts` exporta `HIDE_AFTER_DAYS` (120), `STALE_AFTER_DAYS` (60) y `ageDays(o, now)`. El Match no ofrece avisos de más de 120 días, salvo los guardados, y baja ×0,85 los de más de 60. Reemplaza el castigo anterior (>180 ×0,85, >90 ×0,93).
- `searchJobs` (`/busquedas`) tampoco los lista. La página de detalle sigue andando para quien tenga el link.
- Revisión de vigencia (`src/lib/match/liveness.ts`):
  - turna entre fuentes con `roundRobin`;
  - tiene un tope de tiempo (`budgetMs`);
  - el workflow corre `--max=400 --budget-min=8` con `timeout-minutes: 40`.
- Los tests usan fechas fijas (`NOW` y `vi.useFakeTimers` en `match-api`), así no se rompen cuando los avisos de prueba envejezcan.
- Medición con el inventario commiteado al 17/10, antes de la sync con reglas nuevas:
  - de 3.683 elegibles, 489 tienen más de 60 días;
  - 306 tienen más de 120 y quedan ocultas, todas de ATS gratuitos que las siguen publicando (Lever 162, Greenhouse 74, Ashby 46, Teamtailor 22, Get on Board 2).
  - Si el dueño prefiere mostrar esas búsquedas "siempre abiertas", alcanza con subir `HIDE_AFTER_DAYS`.
- Queda abierto: Computrabajo sigue salteada por `blockedSources`. Desde la nube de Claude no hay red para investigar por qué.

**D (hecho, 17/10):**
- `withWorkplace` (`src/lib/match/inventory.ts`) marca `presencial` con evidencia "inferido: <ciudad> sin mención de remoto". Lo hace en `serpapi`, `apify-computrabajo`, `apify-indeed` y `apify-linkedin`, cuando el aviso:
  - tiene una ciudad concreta, es decir, no sólo "Argentina", "Remoto" o "Desde casa";
  - y ni el título, ni la ubicación, ni el texto mencionan remoto, híbrido, home office, teletrabajo, mixto o virtual.
- `isInferred()` vive en `labels.ts` y se puede usar en el navegador.
- Cómo se usa lo inferido:
  - Se muestra como "Presencial (inferido)" en `/busquedas` y en el Match.
  - En el Match cuenta para ordenar, pero no para excluir con el indispensable de modalidad: queda como "no informa la modalidad".
  - Al agrupar, una modalidad que declara el aviso le gana a una inferida.
- Medición, simulando la sync con las reglas nuevas sobre el inventario commiteado:
  - en elegibles, "sin modalidad" baja de 1.552 a 199 y 1.415 pasan a inferidas;
  - por fuente, son 652 de Google Jobs, 530 de Computrabajo, 249 de LinkedIn y 79 de Indeed.
- Los importados se re-analizan solos en la próxima sync (`refreshImported`), porque la modalidad entra en el hash.

**E (hecho, 17/10):**
- **Métricas:** `npm run match:report` imprime una línea "Calidad" y guarda `quality` en el JSON.
  - Mide sobre los grupos elegibles: % en "Otros", sin modalidad (y cuántas inferidas), sin seniority, con más de 60 días, ocultas por más de 120, empresa confidencial y consultora.
  - También cuenta los grupos "por confirmar".
  - Con el inventario commiteado da: "Otros" 5,6%, sin modalidad 41,4% (sin re-analizar todavía con D), sin seniority 45,1%, más de 60 días 12,3%, ocultas 7,4%, confidencial 4,9% y consultora 12,8%.
- **Empresa confidencial:** `isGenericCompany` y `displayCompany` en `labels.ts`.
  - Muestra "Empresa confidencial" para "Importante empresa del sector…", "Confidencial" y similares.
  - No marca empresas reales como "La Anónima" o "Sociedad Anónima".
  - Esos avisos no se agrupan entre sí.
- **Consultora:** `isConsultora` cubre Adecco, Manpower, Randstad, Bayton, Grupo Gestión, ADN, Consultores de Empresas, Michael Page, servicios eventuales, etc.
  - Se ve como la etiqueta "Consultora" (`src/components/busquedas/CompanyName.tsx`) en las tarjetas de búsquedas, en el detalle y en el Match.
- **Sufijos de lugar:** `baseTitle` en `group.ts` saca del título el lugar pegado al final, como " - Rosario", "(Argentina)" o " – Zona Norte". Toma los lugares de una lista o de las ubicaciones del aviso.
  - La modalidad no se recorta, porque "(Remoto)" y "(Híbrido)" son búsquedas distintas.
  - Los grupos visibles pasan de 9.752 a 9.527 (225 casi-duplicados menos). Los ids viejos siguen andando como alias.

**Pulido de títulos (hecho, 17/10):** `displayTitle` (`labels.ts`) muestra los títulos:
- sin códigos internos ("Ref. 21518:", "(req208687)", "ID89121");
- con la primera letra en mayúscula;
- y sin gritar si vinieron todos en mayúsculas, conservando siglas como CABA o B2B.

Se usa en `/busquedas`, el detalle, el Match y la home. Para buscar y agrupar se sigue usando el título original. Al 17/10 había unos 300 títulos abiertos con ese ruido.

**Seniority:** el 45% de los grupos elegibles no la tiene, y casi todos son avisos que no la dicen ("Vendedor", "Asesor comercial"). No se infiere, para no adivinar.

**Auditoría del Match (17/10):** corrí los 8 perfiles de E0 (`docs/research/e0-2026-10-16/perfiles.json`) contra el inventario sincronizado y corregí lo que salía mal:
- "Para vos" contaba todos los avisos elegibles (3.443), aunque fueran de otra área con 5% de coincidencia. Ahora sólo lista los que llegan a `MIN_SCORE` (25%) y quedan entre 85 y 678 por perfil. El resto se cuenta en `counts.lowMatch` y la pantalla explica cómo verlos: filtrando por área se muestran igual.
- La ciudad se compara por partes (`placeSegments` y `samePlace`): "Rosario de Lerma" (Salta) ya no cuenta como Rosario. La ciudad de la persona es lo que va antes de la coma.
- Avisos de "Confidencial" duplicados: con el mismo nombre genérico, el mismo título y el mismo lugar, se juntan.
- El % nunca es 100: el tope es 98, o 95 si falta información.
- Ubicaciones (`displayLocations`):
  - sin repetir el mismo lugar escrito distinto;
  - sin "Argentina" suelto si hay una ciudad;
  - "Remoto desde Argentina" cuando es elegible y remoto pero las ubicaciones no lo dicen.
- "Desde casa" o "Remote" como ubicación ahora cuenta como modalidad remota.
- Nuevo motivo: "Es en <ciudad>, donde buscás".
- `/busquedas`: la búsqueda por texto incluye el lugar ("vendedor córdoba").
- Sin cambiar: la seniority que falta no se infiere. Logística y datos junior siguen con poca oferta, y ahí el problema es de adquisición, no de ranking.

**Auditoría de la extensión (17/10, hecha):**
- **Completar dos veces:** "Completar" no corre dos veces a la vez en la misma pestaña (candado por pestaña). Además, `apply` descarta las respuestas de una lectura vieja del formulario: antes podía escribir el email en el teléfono.
- **No pisa lo de la persona:** si completó un campo mientras Maru pensaba, no lo toca. Un select con una primera opción real ("Básico") ya cuenta como elegido.
- **Iframes de terceros:** no recibe tus datos un iframe de otro sitio salvo que sea un ATS conocido o pida datos de postulación (CV, portfolio, LinkedIn, experiencia…). Un widget de newsletter o de chat queda afuera.
- **Datos sensibles** (`src/lib/autofill.ts`): también bloquea consentimientos (Ley 25.326), bases y condiciones, declaraciones juradas, novedades por email, origen étnico, edad y estado civil. Los bordes de palabra ahora reconocen tildes.
- **Números:** "3.000" se completa como 3000.
- **Popup:**
  - datos extra con tope de 4.000 caracteres (antes fallaba con un mensaje engañoso);
  - el CV se elige con el teclado;
  - `popup.js` estaba pegado tres veces y quedó arreglado.
- **Textos** (popup, FAQ, privacidad): dicen que el CV y la página se envían a Maru y a su proveedor de IA.
- **Instalación:** cómo elegir la carpeta en Windows, el interruptor en Edge, no mover la carpeta y cómo actualizar. La versión pasa a 0.3.0.
- **Pendiente:**
  - cambiar `<all_urls>` por permisos al momento (antes de publicarla en la Chrome Web Store);
  - avisar de los campos que no puede leer (Shadow DOM, editores enriquecidos);
  - sumar `extension/` a eslint.

**Auditoría de Búsquedas, Seguimiento y Chat (17/10, hecha):**
- **Seguimiento:** una nota ya no se borra cuando la tarjeta cambió en otra pestaña o dispositivo; se guarda sólo si la persona la cambió.
- **Sincronización:** el primer ingreso en un navegador nuevo ya no borra lo que se armó sin sesión, aunque la cuenta tenga una marca de borrado. Hay un test que reproduce el caso.
- **Chat:** recomienda avisos por palabras con contenido (sin "para" o "como"), de hasta 120 días y con títulos y empresas limpios.
- **Búsquedas:**
  - ordena por la fecha de la fuente, usando el "hace 25 días" de Google Jobs;
  - se pueden recorrer todas las páginas (antes cortaba en 50);
  - una página fuera de rango redirige a la última.
- **Chat en `/busquedas`:** cada uno de los dos chats tiene su id, así que el label enfoca el suyo.
- **"Adaptar mi CV" desde una tarjeta:** lleva el texto del aviso y el id, y no duplica tarjetas sin link.
- **Pendiente:**
  - cupo diario del chat cuando se active el cobro (decisión comercial);
  - "Salir" deja los datos en el navegador (ofrecer "Salir y borrar");
  - `/seguimiento?add=` sin confirmación;
  - página propia para avisos cerrados;
  - canonical de ids alias;
  - fechas en el HTML inicial.

**Seguridad (17/10, hecha; hallazgos de las auditorías de Postulación, CV, Carta y cuenta):**
- **PDF:** Chromium renderiza el CV sin JavaScript y con CSP. Antes un `<script>` que esquivaba el filtro corría en el servidor y abría WebSockets a la red interna. Hay un test con ese caso.
- **Leer el aviso por link** (`src/lib/job.ts`): usa `safeFetch` (sólo IPs públicas, también después de cada redirección) y lee como mucho 3 MB. Antes leía 127.0.0.1 o 169.254.169.254.
- **Rate limit:** `/api/export/*` y `/api/auth/request` pasan por el middleware, por IP.
- **Magic link:**
  - abrir el link muestra "Vas a entrar como X" y la sesión se crea con el botón (POST del mismo origen); antes un link ajeno te dejaba en la cuenta de otro y tus datos se subían ahí;
  - el link sirve una sola vez (`takeCounter` en Redis);
  - el freno por casilla es compartido y junta "ana+1@" con "ana@".
- **/precios:** "El más elegido" pasa a "El más conveniente". No había datos que respaldaran el primero.

**Cobros encendidos en producción** (`/api/billing/status` → enabled, 17/10). Para el dueño:
- definir `NEXT_PUBLIC_CONTACT_EMAIL`;
- los términos hablan de "suscripción mensual" y hay tres planes;
- falta el botón de arrepentimiento (Res. 424/2020).

**Productos (17/10, hechos los más graves):**
- **Entrevista:**
  - "Terminar" ya no deja el micrófono abierto ni hace hablar otra pregunta: `endedRef` en `Call` y `aliveRef` en `useDictation`;
  - el informe se pide una sola vez;
  - "Repetir pregunta" no borra lo ya respondido.
- **Entrevista y Video:** al llegar desde una búsqueda ya no se restaura la sesión anterior encima (`job.fromHandoff`).
- **Carta y CV:** "Mejorar", "Más corto" y similares ahora actualizan un párrafo con foco (`EditableText`). Antes se descartaban, y en el celular pasaba siempre.
- **Carta:**
  - el perfil se lee y se guarda antes de pedir la carta (antes se podía perder una carta ya generada);
  - el seguimiento usa el título de la búsqueda y no el que redacta la IA.
- **Postulación:**
  - al recargar, el aviso pegado se sigue enviando;
  - "Adaptar mi CV" desde el seguimiento retoma la postulación de esa misma búsqueda en vez de borrarla;
  - "Postularme a otra vacante" limpia el aviso y la motivación anteriores.

**Pendiente de las auditorías (para otra tanda):**
- **Postulación:** cupo que se descuenta si la IA falla; errores de red en inglés; el aviso se lee dos veces; caracteres de control en el Word.
- **CV:**
  - regenerar borra ediciones;
  - "Ocultar experiencia" en el editor;
  - secciones vacías;
  - ATS con punto final;
  - foto HEIC;
  - saltos de línea en PDF y Word.
- **Carta:** volver sin regenerar; reescribir aplica el tono aunque falle; Word pago como salida del PDF; topes de largo.
- **Entrevista y Video:** cupo y "retomar plan"; aviso de privacidad del dictado; WebM sin duración; teleprompter sin pausa y chico en el celular; topes de largo en `/turno`; puntajes fuera de rango.
- **Cuenta:**
  - cambiar de cuenta borra el CV, la carta, la entrevista y el video sin avisar;
  - "Borrar mis datos" deja `maru:sync:v1`;
  - "Salir" no revoca la cookie;
  - OG por página;
  - `<h1>` en AppShell.

**F.** Google Jobs mensual: lo decide el dueño (ver "Próximos pasos", punto 1).

**Después de cada merge:** correr el workflow `match-sync` a mano (Actions → match-sync → Run workflow) para re-analizar el inventario con `EXTRACTION_VERSION` 7. Si no, se hace solo en la sync diaria de las 9:17 UTC.

**Verticales (17/10):** reparto del catálogo en la taxonomía de 15 verticales del dueño en [research/verticales-2026-10-17](research/verticales-2026-10-17/README.md). Para recalcularlo: `npm run match:verticals`. Elegibles desde AR: Ventas 19,7%, IT 17,5%, Administración/Legal 15,6%, Logística 8,1%, Ingeniería y Operaciones 7,6%. Las más flojas: Educación 0,7%, Arte y Medios 1,0%, Construcción 1,0%, Finanzas y Banca 1,9%, Salud 2,0%.

## Próximos pasos (17/10/2026, cierre de la base de avisos)

Estado: **13.128 oportunidades abiertas, 3.683 elegibles desde Argentina, 1.505 empleadores con elegibles** (E0: 909 grupos y 90 empleadores).
- Gasto total en APIs: **US$4,56**, todo en Apify. Fantastic usó el trial y Google Jobs el plan gratuito.
- ~70% de las publicaciones elegibles vienen de las APIs.
- Gasto, avisos por fuente, verticales y duplicación en [research/proveedores-2026-10-17](research/proveedores-2026-10-17/README.md). Para recalcularlo: `npm run match:report -- --apify-real-usd=<uso real>`.

En orden de impacto:

1. **Google Jobs todos los meses** (gratis). Sus avisos vencen a los 21 días sin volver a verse: sin esta corrida se pierden ~860 avisos elegibles. Correr `match-providers` con `provider=serpapi`, `--max-searches=80 --reserve=20` y las búsquedas que más rindieron (ver IMPORTACIONES, "Próximas corridas"). **Decisión del dueño:** si se agenda un cron mensual (no cuesta plata; usa sólo el plan gratuito y deja la reserva).
2. ~~**Clasificar "Otros"**~~ (hecho en el paso A de "Calidad de avisos"). Era: 3.645 publicaciones abiertas, 27%. En las APIs son oficios (chofer, mozo, operario, vigilador, electricista); en los ATS son puestos que el clasificador no reconoce. Sumar familias "gastronomía y hotelería", "seguridad", "oficios y producción" y revisar una muestra de los ATS. Mejora filtros por área y la medición por perfil.
3. **Apify: decidir presupuesto** (quedan ~US$0,44 del tope aprobado de US$5). Si se aprueba más, conviene Computrabajo:
   - es lo que más avisos elegibles nuevos trae (900, 6,6% duplicado), a ≈ US$0,003 por aviso;
   - Indeed es más barato (≈ US$0,0007) pero descarta 2 de cada 3 filas;
   - LinkedIn por Apify tiene 20% duplicado con otras fuentes.

   Sin presupuesto nuevo, los avisos de Apify vencen solos a los 30 días.
4. **No renovar Fantastic.** Su feed ATS se superpone 37% con otras fuentes (20% ya estaba gratis). Lo valioso fue descubrir empleadores para la sync gratuita (`providers-discoveries.json`), y eso ya se aprovechó.
5. **Modalidad desconocida** en 1.497 publicaciones elegibles (sobre todo Google Jobs, que casi nunca la informa). No se adivina; cada tarjeta lo avisa. Sólo mejora leyendo el aviso original o con una fuente que lo informe.
6. **Conectores Workable / Workday / SuccessFactors** (decisión del dueño, punto 2 de "Avisos: qué falta"). Es la forma de sumar empleadores argentinos generalistas sin pagar.
7. **QA en el producto** con navegador: búsquedas generalistas, logos, "vista hace…", detalle y destino original, en escritorio y celular.
8. **Tamaño del inventario:** 43 MB de 100 MB permitidos por GitHub. Si pasa de ~70 MB, recortar descripciones guardadas o mover a Vercel Blob.
9. **Seguridad:** rotar las claves pegadas en el chat del 16/10 y actualizar los secrets de GitHub y Vercel.

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
3. **Modalidad desconocida** (avance 17/10): ~1.100 publicaciones elegibles siguen sin modalidad. Ya se toman frases explícitas en español e inglés: reparto de días, "de forma presencial", "#LI-Remote", "in-office presence N days", etc. Lo que queda casi siempre dice sólo el lugar ("lugar de trabajo: Saavedra"), y eso no prueba que sea presencial: no se adivina. Para avanzar más hace falta que la fuente lo informe o leer el aviso original.
4. **Interior del país y oficios** (cierre 17/10, tarde): 216 búsquedas de Google Jobs este mes (tandas 1 a 5, con oficios y servicios en las ciudades grandes) y Computrabajo con 11 palabras del interior. Google Jobs pasó a 961 publicaciones abiertas y Computrabajo a 900. Apify quedó en US$4,56 reales de US$5: no se usa más sin aprobación nueva. **Elegibles: 3.683 de 1.505 empleadores** ([research/e1-final-2026-10-17](research/e1-final-2026-10-17/README.md)).
   - Queda repetir Google Jobs cada mes con el plan gratuito: los avisos vencen a los 21 días. Ver IMPORTACIONES, "Próximas corridas".
   - Logística en Tucumán sigue con poca oferta local.
   - Los oficios caen en la familia "otros": falta una familia propia (gastronomía, seguridad, oficios) si se quiere filtrarlos por área.
5. ~~**Revisión manual**~~ (hecha 17/10): [research/e1-revision-2026-10-17](research/e1-revision-2026-10-17/README.md). Falsos positivos 9 → 0, útiles 19 → 20, dudosos 12 → 20. Los dudosos son por modalidad desconocida en otra ciudad y por **inglés implícito** (avisos en inglés de empresas de EE. UU.). El idioma requerido ya se detecta: inglés implícito en avisos escritos en inglés, fluidez en puestos de cara al cliente y más idiomas ([research/e1-idioma-2026-10-17](research/e1-idioma-2026-10-17/README.md)). Sigue pendiente una revisión humana real abriendo los avisos.
6. ~~**Vigencia de importados**~~ (hecho 16/10): `scripts/match-liveness.ts` corre en `match-sync` después de la sincronización. Revisa hasta 150 importados por día, cada uno cada 3 días como mínimo. Cierra con 404/410 o con frases explícitas ("ya no está disponible", "No longer accepting applications"). Bloqueos y errores no cierran nada. El 17/10 la corrida dio 150/150 "sin dato", casi seguro Computrabajo bloqueando al bot. Ahora cada revisión guarda su resultado y las fuentes con ≥90% "sin dato" (mínimo 20 revisiones) se saltean, para gastar los pedidos en las que responden (Fantastic y Google Jobs responden bien). El log muestra el desglose por fuente. Los avisos de Computrabajo igual vencen solos a los 30 días.
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
- **Video de portada**: el renderer usa la misma agrupación que la web y reconstruye las oportunidades desde las publicaciones. Regenerado el 17/10 con el catálogo importado: 9.005 búsquedas, 1.606 empresas y 2.967 elegibles desde Argentina al renderizar (antes 6.439 / 425 / 909). Volver a correr `node scripts/render-intro-video.mjs` cuando cambien mucho los números.

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
   - Primer cobro real (semanal, 17/10): Mercado Pago aprobó el pago pero la cuenta quedó "pago iniciado sin terminar" y "Actualizar estado" daba 503. "Actualizar estado" ahora busca también otras suscripciones con la misma referencia (sólo reemplazan a la guardada si están autorizadas), tolera pasos fallidos y registra el error en los logs (`[billing refresh]`, `[billing status]`, con la ruta de Mercado Pago que falló). Si vuelve a fallar, revisar esos logs en Vercel y la configuración del webhook.
   - Segunda vuelta: la suscripción ya pasó a "authorized" pero el pago no se acreditaba y seguía el 503. Las búsquedas auxiliares ya no cortan la recuperación; si no hay comprobante con pago, se busca el pago por la referencia (`/v1/payments/search`), con la misma validación. Si un pago aprobado no se acredita (importe, moneda o fecha), el motivo se muestra en `/precios` como "Detalle: …", igual que el código de Mercado Pago que falló.
   - Tercera vuelta (21/10): el cobro está habilitado en Production (`/api/billing/status` responde `enabled: true`). Desde las sesiones de Claude no se pueden leer los logs de Vercel (403), así que se sumó al panel `/match/admin` la sección "Cobros con Mercado Pago": tipo de credencial, conexión con Mercado Pago y registro de las últimas 30 notificaciones y "Actualizar estado" con el motivo de cada resultado. **Siguiente:** que el dueño abra el panel y diga qué muestra; con eso se sabe si los webhooks llegan firmados y por qué no se acreditó el pago. Después, botón de arrepentimiento (obligatorio con la venta habilitada).
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
