# Ficha de la Chrome Web Store

Material para publicar Maru Coach en la Chrome Web Store. El paquete se arma con `npm run ext:pack`, que deja el zip en `dist/`. Las capturas salen de `npm run ext:screenshots`, que las guarda en `extension/store/`. Ni este archivo ni `store/` viajan dentro de la extensión.

## Datos básicos

- **Nombre:** Maru Coach: completá postulaciones con tu CV
- **Resumen (132 caracteres máx.):** Completá formularios de postulación con tu CV en un clic. Verde: copiado de tu CV. Amarillo: redactado por Maru. Vos enviás.
- **Categoría:** Productividad (alternativa: Herramientas)
- **Idioma principal:** Español (Latinoamérica)
- **Sitio:** https://www.marucoach.com/extension
- **Política de privacidad:** https://www.marucoach.com/privacidad
- **Soporte:** el email de contacto de `NEXT_PUBLIC_CONTACT_EMAIL`

## Descripción

> Cargá tu CV una vez y Maru completa los formularios de postulación por vos: Greenhouse, Lever, Ashby, HiringRoom y muchos otros.
>
> - **Verde** es lo que copiamos de tu CV, tal cual. **Amarillo** es lo que Maru redactó o dedujo: revisalo antes de enviar.
> - Si preparaste la postulación en Maru, usamos tu CV personalizado para esa vacante y tu motivación, con tus palabras.
> - Nunca enviamos el formulario: lo revisás y lo enviás vos.
> - No completamos datos demográficos, consentimientos ni declaraciones juradas.
> - No inventamos datos. Si algo no está en tu CV, lo dejamos vacío.
> - Cuando enviás, te ofrecemos guardar la postulación en tu seguimiento de Maru.
>
> Plan gratis: 4 autocompletados por día.

## Justificación de permisos

| Permiso | Para qué |
|---|---|
| `activeTab` | Acceso sólo a la pestaña donde la persona abre Maru: clic en el ícono o Alt+Shift+M. Ahí se leen los campos del formulario y se completan. Se pierde al cambiar de página. |
| `scripting` | Inyectar el script que lee y completa el formulario, y que muestra los avisos de Maru, en esa pestaña y sólo cuando la persona lo pide. |
| `storage` | Guardar en la computadora el perfil, el CV para adjuntar, los datos extra, el cupo del día y las postulaciones preparadas en Maru. `storage.session` guarda, mientras dura la sesión del navegador, qué pestaña se completó, para ofrecer guardarla en el seguimiento. |
| `host_permissions`: `www.marucoach.com`, `marucoach.com` | La API de Maru (completar, leer el CV, imprimir el CV personalizado, seguimiento) y el puente que lee, en el mismo navegador, las postulaciones preparadas en marucoach.com. |
| `optional_host_permissions`: 25 ATS (greenhouse.io, lever.co, ashbyhq.com, myworkdayjobs.com…) | Muchos formularios vienen en un iframe de un ATS dentro de la web de la empresa, y activeTab no alcanza para ese iframe. Si Maru detecta uno, pide permiso para ese dominio en el momento, con el clic de la persona en «Completar». Nunca se piden todos juntos ni al instalar. |

**¿Usa código remoto?** No. Todo el código va en el paquete: no hay `eval`, `new Function` ni scripts externos, y un test lo controla. Maru sólo devuelve datos (qué valor va en cada campo).

## Prácticas de datos (formulario de la Store)

| Tipo de dato | ¿Se recopila? | Detalle |
|---|---|---|
| Información de identificación personal | Sí | Nombre, email, teléfono y links del CV, para completar los campos. |
| Información de salud | No | — |
| Información financiera y de pago | No | La pretensión salarial sólo se usa si la persona la carga en «datos extra». |
| Información de autenticación | No | La extensión no guarda contraseñas. Usa la sesión de Maru, si existe, para contar el cupo. |
| Comunicaciones personales | No | — |
| Ubicación | No | Sólo la ciudad o el país que figuran en el CV. |
| Historial web | No | Sólo la dirección de la página que se completa, cuando la persona lo pide. |
| Actividad del usuario | No | No registra clics ni teclas. Después de completar, mira la página sólo para detectar si la postulación se envió. |
| Contenido del sitio web | Sí | El texto visible y los campos del formulario que se completa, para decidir qué va en cada uno. |

Certificaciones:

- No se venden ni se transfieren datos a terceros, salvo al proveedor de IA que procesa el pedido.
- No se usan para fines ajenos a la función principal.
- No se usan para evaluar solvencia ni para préstamos.

## Antes de subir

1. `npm run ext:screenshots` si cambió el popup, y después `npm run ext:pack`.
2. Subir `dist/maru-extension-<versión>-store.zip` en el panel de la Store y completar la ficha con este archivo.
3. Publicada el 22/10/2026 (0.4.1): https://chromewebstore.google.com/detail/aikhpbjdjeojlpdkhkonmionghpnmkei. El link está en `EXTENSION_STORE_URL` (`src/lib/extensionVersion.ts`) y lo usan la home y `/extension`. Link corto para compartir: https://www.marucoach.com/chrome. Para una versión nueva alcanza con subir el zip en el panel: el link no cambia.
4. Las instalaciones de la Store mandan `X-Maru-Source: store`, así que el aviso de versión vieja no les pide bajar el zip.
