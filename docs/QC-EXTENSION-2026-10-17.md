# QC de desplegables de la extensión · 17/10/2026

## Caso y causa

[Formulario reportado de HiringRoom](https://hiringroom.com/jobs/get_vacancy/6a3c31e350e65e218ce7bdc2/candidates/new?source=linkedinjobs#step2), vacante AI Business Partner de Newsan.

En Chrome se inspeccionó el paso 2 y se abrió el paso 3 desde su pestaña visible. En ese paso se expandieron Educación, Idiomas y Experiencia laboral. Se abrió el menú de documento y el de idioma para leer estructura y opciones. No se cargó un perfil, no se aceptó la política y no se envió una postulación.

El código anterior sólo reconocía inputs con `role=combobox` y descartaba readonly o controles de un píxel. HiringRoom usa React Select antiguo: `aria-autocomplete=list`, inputs de uno/dos píxeles, contenedores `custom-hr-select__control` y opciones `custom-hr-select__option`, sin roles ni `aria-controls`. Por eso nunca llegaban como selección al servidor. No era un problema del prompt.

## Cambio

Versión **0.3.1**, construida sobre `8d50661` (PR #78). Mantiene los filtros de frames, restricciones de datos sensibles, exclusión de pedidos simultáneos y número de lectura de esa versión.

- Reconocer controles ARIA sobre botón, div e input y React Select antiguo dentro de su estructura específica; no tratar cualquier autocomplete como selección.
- Usar la visibilidad del contenedor, sin descartar su input de un píxel.
- Leer el menú del mismo control, ignorar listas ocultas y opciones deshabilitadas. No mezclar país e idioma.
- Abrir por teclado y, si hace falta, por mouse/puntero. Esperar hasta 1,2 segundos por opciones; confirmar que el control recibió un valor después de elegir.
- Cerrar el menú después de leer y aplicar, preservar selecciones previas y evitar coincidencias ambiguas.
- En select nativo, reconocer el placeholder fuera de la primera posición y conservar una opción real en la primera posición.
- Durante scan/apply impedir submit disparado accidentalmente por un botón de menú sin `type=button`. La protección se libera al terminar.
- Reemplazar una inyección de versión anterior al actualizar la extensión. No cambian permisos ni hay llamadas nuevas al proveedor.

## Pruebas reproducibles

```sh
npx vitest run tests/extension-dropdowns.test.ts
npx --yes tsx@4 scripts/extension-qc.ts 8d50661
```

El servidor de QC queda en `http://127.0.0.1:3018`: `/` usa el content script actual, `/?before` el del commit base, `/react` React Select 5 real. Sus botones visibles Detectar campos y Completar prueba llaman al código real con respuestas ficticias. No llama a Maru ni a proveedores y no guarda datos reales. No es una instalación de la extensión; ejercita el content script en el mundo de la página.

Las pruebas de DOM virtual comparten HTML y handlers con el servidor; sólo se simula geometría porque JSDOM no calcula layout. La fixture de HiringRoom reproduce la estructura observada y sus eventos, no ejecuta el frontend remoto de HiringRoom. El navegador real cubre geometría/eventos y React Select real.

| Caso en Chrome | Resultado |
| --- | --- |
| Botón ARIA con menú en portal | Argentina; no submit |
| Input readonly que abre por clic | Argentina |
| Div que escucha pointerdown/pointerup | Tiempo completo |
| Opciones con demora de 750 ms | Argentina |
| Control con buscador interno | Argentina; un solo campo |
| Select nativo con placeholder segundo | Argentina |
| Estructura HiringRoom sin buscador, input de 1 px | Argentina |
| Estructura HiringRoom con buscador, input de 2 px | Inglés |
| Tres selecciones previas | Uruguay / Uruguay / Argentina conservadas |
| Control que ignora la selección | Sigue vacío y pendiente |
| Argentina Norte / Argentina Sur, respuesta Argentina | No elige ninguna y queda pendiente |
| React Select 5 real | Country Argentina, autorización Yes, sin buscador Argentina; prefilled Uruguay conservado, Gender pendiente |

La fixture completa devuelve **8 completados, 2 pendientes y 0 envíos**. React Select real devuelve **3 completados y 1 pendiente**. Contra `3a11a9e`, los 11 primeros casos automatizados fallaban; los casos nuevos reproducen específicamente la estructura de HiringRoom. La entrega incorpora además las protecciones publicadas después en `8d50661`. Se agregó además una regresión para que una respuesta de una lectura anterior no se aplique después de volver a leer el formulario.

Validación local final: **358 tests aprobados, 7 omitidos**, TypeScript y ESLint sin errores (3 warnings preexistentes). Los 6 tests de extensión instalada se omiten porque el Chrome configurado para ese harness no está disponible; el séptimo omitido pertenece a PDF. No se informa una prueba de punta a punta instalada como aprobada.

Evidencias locales de esta sesión: `outputs/maru-extension-desplegables-qc.png`, `outputs/maru-extension-react-select-qc.png` y `outputs/hiringroom-inspeccion-step3.png`, en el directorio raíz de la tarea, fuera del repositorio.

## Uso y límites

Para actualizar: reemplazar los archivos en la misma carpeta `maru-extension` que Chrome ya tiene cargada y tocar Recargar en su tarjeta de `chrome://extensions`. Conservar la instalación para mantener el CV y ajustes locales. Luego volver a tocar Completar en el formulario. El sitio debe servir un ZIP cuyo manifest indique 0.3.1; comprobarlo después del deploy del merge.

En HiringRoom la persona abre primero los bloques de educación, idioma o experiencia y vuelve a tocar Completar en cada paso. Provincia/localidad y otras listas dependientes sólo se pueden leer después de que elegir su campo anterior las habilite: volver a completar cuando aparezcan las opciones. No hay reintentos de IA automáticos ni creación automática de bloques repetidos. Las instituciones/ciudades que sólo devuelven resultados al escribir siguen fuera de este cambio. Datos no presentes en el CV y campos sensibles o legales conservan las restricciones del servidor.

Queda la validación del ZIP actualizado con un perfil real autorizado en la instalación del dueño. Esta sesión comprobó la estructura de ambos pasos y el content script en pruebas controladas; no completó ni envió esa candidatura.
