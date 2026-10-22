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
| `scripting` | Leer los campos del formulario de postulación abierto y completarlos cuando la persona toca «Completar» o usa Alt+Shift+M. También mostrar los avisos de Maru en la página. |
| `storage` | Guardar en la computadora el perfil, el CV para adjuntar, los datos extra, el cupo del día y las postulaciones preparadas en Maru. `storage.session` guarda, mientras dura la sesión del navegador, qué pestaña se completó, para ofrecer guardarla en el seguimiento. |
| `host_permissions: <all_urls>` | Los formularios de postulación están en miles de dominios: sitios propios de cada empresa y ATS como Greenhouse, Lever, Workday o HiringRoom, muchas veces dentro de un iframe. Sin acceso a cualquier sitio no se puede completar el formulario que la persona tiene abierto. La extensión sólo actúa cuando la persona lo pide, o justo después, para detectar el envío. |
| Content script en marucoach.com | Leer, en el mismo navegador, las postulaciones que la persona preparó en Maru (CV personalizado y motivación). No corre en ningún otro sitio. |

**¿Usa código remoto?** No. Todo el código va en el paquete. Maru sólo devuelve datos (qué valor va en cada campo).

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
3. Cuando la Store la publique, cargar `NEXT_PUBLIC_EXTENSION_URL` en Vercel con el link de la ficha: los botones de la home van ahí en lugar de bajar el zip.
4. Las instalaciones de la Store mandan `X-Maru-Source: store`, así que el aviso de versión vieja no les pide bajar el zip.
