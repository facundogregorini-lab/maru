# Publicar la extensión en la Chrome Web Store

Hoy la extensión se instala en modo desarrollador desde un .zip (`/extension`), y ahí abandona la mayoría. Publicarla es lo que más sube la conversión de ese producto.

## Lo que hace falta (dueño)

1. Cuenta de desarrollador: https://chrome.google.com/webstore/devconsole (pago único de US$5).
2. Subir el .zip que arma `/extension/maru-extension.zip` (o comprimir la carpeta `extension/`).
3. Completar la ficha con lo de abajo y enviar a revisión (suele tardar de 1 a 7 días).
4. Cuando esté aprobada: cambiar en `src/app/extension/page.tsx` y en la home (`EXTENSION_URL`) el link de descarga por el de la Web Store, y sacar los pasos de instalación manual.

## Ficha

**Nombre:** Maru Coach: completá postulaciones con tu CV

**Resumen (132 caracteres máx.):** Cargá tu CV una vez y completá formularios de postulación con un clic. Vos revisás y enviás.

**Descripción:**

Maru completa por vos los formularios de postulación con los datos de tu CV: nombre, contacto, LinkedIn, experiencia, respuestas abiertas y tu CV adjunto.

- Funciona en Greenhouse, Lever y formularios web estándar, también dentro de la web de una empresa.
- Verde: lo que copió de tu CV. Amarillo: lo que redactó o dedujo, para que lo revises.
- Nunca envía la postulación: el botón final lo tocás vos.
- No completa datos demográficos ni aceptaciones legales.
- Atajo: Alt + Shift + M.

Es parte de Maru Coach, tu coach de carrera con IA: búsquedas reales que podés tomar desde Argentina, CV y carta a medida de cada aviso, entrevistas de práctica y seguimiento de postulaciones.

**Categoría:** Productividad · **Idioma:** Español (Latinoamérica)

**Política de privacidad:** https://TU-DOMINIO/privacidad

## Justificación de permisos (la pide la revisión)

- `storage`: guarda en tu computadora el perfil leído de tu CV, el archivo del CV y los datos extra que cargás.
- `scripting`: lee los campos del formulario de la pestaña activa y los completa, sólo cuando tocás "Completar" o usás el atajo.
- `host_permissions <all_urls>`: los formularios de postulación están en miles de dominios distintos (portales y webs de empresas). La extensión no actúa en ninguna página hasta que la persona lo pide.

**Uso de datos (formulario de la Web Store):** recolecta "información de identificación personal" y "contenido del usuario" (el CV) sólo para la función principal; no se vende ni se usa para publicidad; se envía cifrado (https) al servidor de Maru para decidir qué va en cada campo.

## Capturas sugeridas (1280 × 800)

1. Un formulario de Greenhouse completo en verde y amarillo con el popup abierto ("Completitud 92%").
2. El popup con el CV cargado y "Completar esta postulación".
3. El toast "Listo: completamos 18 campos".
