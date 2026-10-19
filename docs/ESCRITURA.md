# Escritura de Maru

**Estado al 17/10/2026, 17:49 ART:** PR #76 incluida en Production, Ready, commit `8d50661`, deployment `dpl_GzPce2gzoVKuqRfiTnzpnsWw9cxz`, con alias `www.marucoach.com`. El límite de deploy previo quedó superado. La prueba con cartas y guiones del proveedor real sigue pendiente; se verificaron publicación y pruebas automatizadas.

## Definición de producto

Los textos generados tienen que servir a su lector y sonar a la persona que aportó
la experiencia. Se priorizan hechos relevantes, motivos propios y frases que se
puedan decir en voz alta. No se ofrece pasar detectores ni se presenta el contenido
como prueba de autoría humana.

La base es [Slop Monstruo](https://github.com/axellaban/Slop-monstruo), versión
`d27c4f9e47da050cfc64942925de4b74e89b5bc8`, en español y con licencia MIT. Queda
instalada como skill local y versionada su adaptación dentro del proyecto.

## Aplicación para todos los usuarios

`askStructured`, en `src/lib/claude.ts`, incorpora `WRITING_POLICY` en cada
redacción. Se aplica en servidor, también para el plan gratuito, sin instalar nada
en el navegador ni elegir una opción.

| Salida | Qué se revisa |
| --- | --- |
| CV general y por vacante | Titular, resumen, logros, consejos y explicación de cambios. |
| Carta | Saludo, párrafos, cierre, asunto, mensaje breve y recomendaciones. También la reescritura de un párrafo. |
| Postulación | Redacción del CV y respuestas abiertas del formulario. |
| Teleprompter | Texto de los bloques, indicaciones y mensaje para compartir. Las duraciones se conservan. |
| Entrevista | Apertura, preguntas, repreguntas, cierre, informe y respuestas sugeridas. Los puntajes se conservan. |
| Chat | Respuesta de Maru. IDs de avisos y vínculos se conservan. |
| Extensión | Política común y revisión de textos largos redactados y notas. Opciones, valores copiados y otros campos quedan fuera. |
| Match (re-evaluación con IA) | Sólo la razón principal de cada aviso. Puntos, niveles, salario y razones por componente quedan fuera. Usa el modelo de la etapa (Haiku por defecto). |
| Extracción de perfil | Se copia la fuente sin reescritura editorial (`verbatim: true`). |

Las reglas de cada herramienta siguen mandando sobre idioma, registro, longitud,
formato y datos pendientes. El español al usuario es rioplatense; una carta
profesional, el inglés y el portugués respetan la opción elegida.

## Revisión acotada y costo

1. La llamada original redacta y revisa en silencio propósito, coherencia y estilo.
2. Un checker local busca vocabulario, construcciones, puntuación y ternas en los
   campos de prosa declarados por cada ruta. No revisa datos literales.
3. Cuando encuentra señales, se permite **una sola llamada adicional** al mismo
   proveedor y modelo que ya usa Maru. Recibe sólo los fragmentos marcados (hasta
   12 y 8.000 caracteres en total), sin reenviar PDF, perfil completo ni fotogramas.
4. El servidor acepta únicamente cambios sobre esos paths que reduzcan señales,
   con las mismas cifras, URLs, emails y siglas; preserva datos pendientes, limita
   cambios de longitud (-15% / +10% en palabras) y vuelve a validar el esquema.
5. Ante timeout (12 segundos), error, respuesta incompleta o edición inválida, entrega
   la generación original válida. No hay bucle ni se consume otro pedido del cupo.

El costo no es cero: la política agrega tokens al prompt y los textos marcados
pueden requerir otra llamada. Los textos sin señales usan una sola. No hay una
suscripción nueva ni claves adicionales. La aplicación usa la API ya configurada,
no las CLI o cuentas de los desarrolladores.

La doble familia sugerida por la skill **no está implementada en producción**. Se
adapta su criterio con el proveedor existente para no agregar infraestructura y
costos fijos. El intento local de segunda revisión del home con Claude falló por
OAuth vencido; no se consideró una revisión completada.

## Límites y mantenimiento

- Una regex no evalúa sentido ni exactitud. Las guardias reducen cambios de hechos,
  pero no prueban que toda frase sea correcta. El usuario revisa antes de enviar.
- Los patrones provienen del español. La política editorial cubre los otros idiomas;
  el checker español no se presenta como evaluación de ellos.
- Si una frase técnica necesaria sigue marcada o la corrección falla, puede quedar
  en el resultado original. No se bloquea un CV para obtener un puntaje perfecto.
- Los documentos ya guardados y las ediciones manuales no se reescriben solos.
  La política se aplica a nuevas generaciones y reescrituras solicitadas.
- Una nueva ruta de IA debe usar `askStructured` y declarar `editorialPaths` para la
  prosa que genera. No agregar a esos paths nombres, cargos copiados, fechas,
  selección de formularios, índices, puntajes ni identificadores.
- Para actualizar la fuente, conservar el commit y licencia; correr los tests de
  `tests/writing.test.ts`, el checker original y revisar cartas/guiones ficticios.

## Validación

Se prueban frases en español que escapaban al checker inglés, términos técnicos,
selección de campos, rechazo de cambios de cifras/siglas/links, esquema, duración,
extracción literal, campos de extensión, timeout y el límite de dos llamadas.
El smoke test de generación con el proveedor real queda pendiente del deploy. Las claves sensibles de Vercel no se exportaron a archivos locales; los tests actuales usan respuestas simuladas y verifican el recorrido de edición y las guardias. No se afirma una mejora medida en calidad de cartas o guiones todavía.
