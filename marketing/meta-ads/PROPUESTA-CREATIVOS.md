# Propuesta de creativos para Meta · Maru

Fecha: 19/10/2026. Campaña `MARU | Límite gratuito | AR | Test01` (120248861665880157), conjunto `MARU | Estáticos | AR | Límite gratuito`, activo desde el 18/10 a las 10:43 ART.

## 1. Qué muestran los datos (18 y 19/10)

| Anuncio | Gasto (ARS) | Impresiones | Clics | CTR | Resultados (`maru_paywall_viewed`) |
|---|---:|---:|---:|---:|---:|
| Match | 1.945 | 738 | 21 | 2,85% | 0 |
| Todo en uno | 395 | 119 | 5 | 4,20% | 0 |
| CV | 34 | 22 | 0 | 0% | 0 |
| Carta | 0 | 0 | 0 | — | 0 |
| Video | 0 | 0 | 0 | — | 0 |
| **Total** | **2.373** | **879** | **26** | **2,96%** | **0** |

Por ubicación:

- **Reels (Instagram y Facebook): 110 impresiones y 0 clics.** Una placa estática con mucho texto no funciona en Reels.
- **Stories de Instagram:** el mejor lugar hasta ahora (Match 3,0% y Todo en uno 8,1% de CTR, con 5 y 1 visitas a la página).
- **Audience Network:** 8 clics y 3 visitas a la página. Son clics de baja calidad.
- **Feed de Instagram:** 43% del gasto de Match, con 2% de CTR.

En PostHog, unas 80 personas llegaron con `utm_source=meta`. Casi ninguna pasó de ver la página: hay una sola activación y un solo límite alcanzado, y no traen el `utm_content`, así que no se pueden atribuir a un anuncio. Carta y Video muestran visitas aunque en Meta no tienen impresiones, así que buena parte de ese tráfico son pruebas internas o vistas previas.

**Lectura:** con 2.373 ARS la muestra todavía no alcanza para elegir un ganador. Sí alcanza para ver tres problemas de estructura que ningún creativo nuevo va a resolver solo:

1. **Meta no está probando los cinco anuncios.** Puso el 82% del gasto en Match, y Carta y Video no salieron nunca. Con cinco piezas casi iguales en un conjunto de 5.000 ARS/día, el sistema elige una en pocas horas y no explora las demás.
2. **El evento de optimización está demasiado lejos del clic.** `maru_paywall_viewed` exige registrarse, usar la herramienta y agotar el cupo. Con este presupuesto no se llega a las ~50 conversiones semanales que necesita el aprendizaje, así que el anuncio queda optimizando "a ciegas".
3. **Se cae casi todo entre el clic y la activación.** El anuncio promete "Encontrá tu trabajo perfecto" y la página pide subir un CV. Hay un salto de esfuerzo que el creativo no anticipa.

## 2. Qué les falta a las piezas actuales

Lo bueno: la marca es clara, el producto se ve y el botón es concreto. Lo que limita el rendimiento:

- **Las cinco piezas son un solo creativo para Meta.** Mismo fondo blanco, misma grilla, mismo titular en mayúsculas y mismo mockup. El sistema de entrega actual (Andromeda) agrupa los anuncios por parecido y los trata como uno: lo que suma es variar el concepto, no cambiar el texto.
- **El titular es aspiracional y no frena el scroll.** "Encontrá tu trabajo perfecto" lo dice cualquier portal de empleo. No nombra una situación que la persona reconozca como propia.
- **No aparece nadie.** Sin cara, sin voz, sin manos ni pantalla real, en un feed lleno de personas.
- **El ejemplo no se parece al público.** Match muestra Product Manager, Product Designer y Data Analyst Sr. El inventario real y la audiencia amplia de Argentina son mayoría de comercial, administración, atención al cliente y logística (eso es lo que aparece en el "muro" de Todo en uno).
- **Hay texto que en el celular no se lee.** El muro de búsquedas de Todo en uno es ilegible en 1080 px y en el CV uno de los chips queda cortado ("A/B te").
- **Los porcentajes de 92 a 96% pueden leerse como una promesa.** El producto ya los marca como estimación (tope 99%). En el anuncio conviene mostrar el porqué del match, no el número.
- **No hay piezas pensadas para el formato vertical.** Las stories son las placas del feed estiradas, sin video y sin un gancho en el primer segundo.

## 3. La propuesta: conceptos distintos, no variantes

Hay que pasar de "5 placas de funcionalidades" a **una matriz de ángulo × formato × persona**, con cada pieza tan distinta de las otras que Meta la lea como un concepto nuevo.

### 3.1 Seis ángulos

Cada ángulo parte de una situación que el público vive, no de una funcionalidad del producto.

| # | Ángulo | Gancho (primer segundo o titular) | Lo que muestra el producto | Destino |
|---|---|---|---|---|
| A | **El silencio después de postularse** | "Mandaste 40 CV y no te respondió nadie." | El mismo CV antes y después de adaptarlo a un aviso: palabras clave que faltaban, logros con números | `/cv` |
| B | **ChatGPT inventa, Maru no** | "Le pediste el CV a ChatGPT y te agregó cosas que no hiciste." | El marcador `[completar]` en lugar de un dato inventado; las 3-5 preguntas que hace Maru | `/postulacion` |
| C | **Hay búsquedas que no estás viendo** | "Hoy hay [N] búsquedas abiertas que podés tomar desde Argentina." (N real del inventario el día que se publica) | El ranking con el motivo de cada match y lo que falta confirmar | `/match` |
| D | **La entrevista que se practica antes** | "La pregunta que te traba en la entrevista, practicala hoy." | La entrevistadora que repregunta y el informe con la respuesta STAR | `/entrevista` |
| E | **Una postulación en minutos** | "Pegás el link del aviso. Lo demás lo arma Maru." | Pantalla real, de corrido: link → preguntas → CV + respuestas del formulario + extensión completando | `/postulacion` |
| F | **Primer empleo** | "No tenés experiencia: tenés cosas para contar." | El CV general a partir de estudios, proyectos y trabajos informales | `/cv` |

A y E son los que más se apoyan en lo que hace distinta a Maru (CV por aviso, no inventa, completa el formulario). C usa un dato real y cambiante, que ningún competidor puede copiar.

### 3.2 Cuatro formatos

1. **Grabación de pantalla con voz (9:16, 15-25 s).** El formato que más rinde en herramientas digitales. El primer segundo es el gancho en texto grande y la pantalla ya está en movimiento. Se produce con la misma técnica que el video de la home (`video/intro.html`, escena animada con tiempo exacto), en vertical y con subtítulos quemados. Para Reels y Stories.
2. **Persona hablando a cámara (9:16, 20-30 s).** El fundador o una persona real del equipo cuenta el problema en primera persona y muestra el celular. Sin guion leído: una toma con el teleprompter de Maru sirve, y de paso demuestra el producto. **No se usan testimonios inventados ni actores presentados como usuarios.**
3. **Carrusel "antes / después" (feed, 1080×1350, 4-5 tarjetas).** Tarjeta 1: el gancho. Tarjetas 2-4: un CV ficticio que mejora paso a paso (palabra clave del aviso, logro con número, titular alineado). Última: el botón. Marcado "ejemplo ilustrativo", como hoy.
4. **Estático "nativo" (feed y stories).** Piezas que no parecen anuncios: una nota del celular con "Lo que aprendí después de 40 postulaciones", una conversación tipo chat entre la persona y Maru, o una sola frase grande en tipografía de marca sobre color. Poco texto, legible a un brazo de distancia. Nada que imite una marca, una persona o una red real.

### 3.3 Tres personas en el ejemplo

Cada concepto se hace con el ejemplo de una persona distinta, para que el público se reconozca:

- **Comercial o administración** (vendedor, administrativa, atención al cliente). Es la mayor parte del inventario y de la audiencia amplia.
- **Profesional con experiencia** (analista, contador, PM).
- **Primer empleo o junior.**

## 4. Primera tanda: 8 piezas

Ocho conceptos bien distintos rinden más que veinte variantes. Prioridad de producción:

| # | Nombre del anuncio | Ángulo | Formato | Persona | Ubicación principal |
|---|---|---|---|---|---|
| 1 | `MARU \| A \| pantalla \| comercial \| v1` | Silencio | Grabación de pantalla | Comercial | Reels / Stories |
| 2 | `MARU \| E \| pantalla \| profesional \| v1` | Minutos | Grabación de pantalla | Profesional | Reels / Stories |
| 3 | `MARU \| B \| camara \| general \| v1` | ChatGPT inventa | Persona a cámara | General | Reels / Stories |
| 4 | `MARU \| A \| carrusel \| comercial \| v1` | Silencio | Carrusel antes/después | Comercial | Feed |
| 5 | `MARU \| C \| estatico \| general \| v1` | Búsquedas que no ves | Estático con el número real | General | Feed / Stories |
| 6 | `MARU \| D \| pantalla \| general \| v1` | Entrevista | Grabación de pantalla | General | Reels / Stories |
| 7 | `MARU \| F \| nativo \| junior \| v1` | Primer empleo | Estático nativo (nota) | Junior | Feed / Stories |
| 8 | `MARU \| Match \| estatico \| v2` | Control | La pieza Match actual, con el chip y el ejemplo corregidos | Comercial | Feed |

La 8 es el control: sirve para saber si lo nuevo le gana a lo que ya hay.

### Guion de ejemplo: pieza 1 (15 s)

| Tiempo | Pantalla | Texto en pantalla |
|---|---|---|
| 0-1,5 s | Bandeja de entrada vacía, el contador de "postulaciones enviadas: 40" | "40 CV enviados. 0 respuestas." |
| 1,5-5 s | Un aviso real de vendedor (con atribución) y el CV actual al lado: se resaltan en rojo las palabras del aviso que el CV no tiene | "Los filtros automáticos buscan las palabras del aviso." |
| 5-11 s | Maru hace dos preguntas cortas; el CV se reescribe: aparecen "cartera de clientes", "objetivos mensuales" y un logro con número | "Maru adapta tu CV a cada aviso. Con tu experiencia, sin inventar." |
| 11-15 s | El CV listo para descargar y el logo | "Probalo gratis en marucoach.com" |

Texto principal: *"Si mandás el mismo CV a todos los avisos, los filtros automáticos lo descartan antes de que lo lea una persona. Maru lo adapta a cada búsqueda con lo que ya hiciste. Gratis para empezar."* Título: *"Tu CV, adaptado a cada aviso"*. Botón: *Más información*.

Todos los textos finales se escriben según `docs/ESCRITURA.md`: datos reales, nada de "potenciá" ni ternas de adjetivos, y nunca la promesa de conseguir trabajo.

## 5. Cambios de campaña para que la prueba funcione

Sin estos cambios, los creativos nuevos van a tener el mismo problema que los actuales: Meta elige uno en horas y el resto no se mide.

1. **Optimizar por activación (`maru_core_activation`)** en lugar de por límite alcanzado mientras no haya ~50 eventos por semana. El límite alcanzado se sigue midiendo como resultado de negocio. Es el mismo evento que ya envían el píxel y la API de conversiones.
2. **Sacar Audience Network** de las ubicaciones.
3. **Probar por tandas de 3-4 conceptos**, no 8 a la vez, mientras el presupuesto sea de 5.000 ARS/día. Cada concepto nuevo se sube con su propio anuncio (no como variante de texto), y a los 3-4 días se apaga lo que no llegó a los umbrales de abajo.
4. **Que la página continúe lo que dice el anuncio.** Cada concepto va a la herramienta que muestra (`/cv`, `/postulacion`, `/match`, `/entrevista`), con el `utm_content` del nombre del anuncio. Si hace falta, un titular en la página que repita el gancho ("Tu CV, adaptado a este aviso").
5. **Guardar el `utm_content` en la activación** (hoy la activación y el límite llegan sin él a PostHog). Es un cambio chico en `src/lib/tracking/`: persistir los UTM de la primera visita y adjuntarlos a `activacion` y `limite_planes_visto`. Sin esto no se puede decir qué creativo trae gente que usa Maru.

El presupuesto no cambia. Subirlo necesita la aprobación del dueño.

## 6. Cómo se elige un ganador

| Métrica | Para qué sirve | Umbral para seguir |
|---|---|---|
| Retención a 3 s (vistas de 3 s / impresiones), solo video | Si el gancho frena el scroll | > 25% |
| CTR del enlace | Si el mensaje genera interés | > 1,5% en feed, > 1% en Reels |
| Costo por visita a la página | Calidad del clic | < 150 ARS |
| Costo por activación | El resultado que optimiza la campaña | El más bajo de la tanda, con al menos 5 activaciones |
| Activación → límite alcanzado | Si trae gente que vuelve a usar Maru | Comparar contra el control |

Regla para apagar: un anuncio que gastó **3 veces el costo por activación del mejor** sin activaciones se apaga. Un ganador pasa a tener variantes (otro gancho, otra persona, otra duración) en la tanda siguiente; uno que perdió se cambia de ángulo, no de color.

## 7. Orden de trabajo

1. Cambios de campaña 1 y 2 (activación como objetivo, sin Audience Network) y el cambio de medición 5. Lo puede hacer una sesión con acceso a Meta y al repo.
2. Corregir la pieza 8 (control) y producir las piezas 1, 2 y 5. Las de pantalla salen de escenas animadas, como el video de la home.
3. Publicar la tanda 1 (piezas 1, 2, 5 y 8) durante 4 días.
4. Tanda 2 con las piezas 3, 4, 6 y 7 contra el ganador de la tanda 1.
5. Cada semana: apagar, variar el ganador y anotar el resultado en `docs/PENDIENTES.md`.

La pieza 3 (persona a cámara) necesita que alguien del equipo grabe. Es la única que no se puede hacer sólo desde el repo.
