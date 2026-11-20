# Costo de la IA (Anthropic)

Fecha: 20/11/2026. Pedido del dueño: la clave de Anthropic se venció después de gastar ~US$40 por semana durante 4 semanas (~US$160), y la clave nueva tiene que gastar mucho menos.

## Diagnóstico (20/11)

- Hasta el 19/11, las 15 herramientas de usuario corrían con **Opus 5.5** (US$4 / US$20 por millón de tokens de entrada / salida). Sólo Match usaba Haiku.
- Cada pedido con prosa hacía **dos llamadas**: el borrador y la revisión editorial (Slop Monstruo), las dos con Opus.
- CV para una búsqueda, CV nuevo y carta usaban esfuerzo `high`. En Opus 5.5 el razonamiento no se apaga y se cobra como salida.
- Las herramientas que reciben el CV reenvían el PDF entero en cada pedido (análisis, carta, guion, entrevista): cada página se cobra como imagen más texto.
- No hay caché de prompts ni tope de gasto. La misma clave se usa en producción y en los previews.
- Estimación con Opus: ~US$0,50–0,80 por flujo completo de «Preparar mi postulación». Para cifras reales, mirar el uso por modelo en la consola de Anthropic.
- El 19/11 el dueño cargó en Vercel `ANTHROPIC_MODEL` con Haiku para todo. Desde el 20/11 el código ya no lee esa variable (ver abajo): se puede borrar.

## Modelo por tarea (desde el 20/11)

Precios por millón de tokens (entrada / salida): Haiku 5.5 US$0,10 / 0,50; Sonnet 5.5 US$2 / 10; Opus 5.5 US$4 / 20.

| Nivel | Modelo | Variable de Vercel | Tareas |
|---|---|---|---|
| `rapido` (por defecto) | `claude-haiku-5-5` | `ANTHROPIC_MODEL_RAPIDO` | Leer el CV, análisis de postulación y de CV, preparar e informe de entrevista, turno de entrevista, guion y feedback de video, copiloto, autofill, bullet, párrafo de carta, keywords y la **revisión editorial de todas las herramientas** |
| `redaccion` | `claude-sonnet-5-5` | `ANTHROPIC_MODEL_REDACCION` | CV para una búsqueda (`/api/generate`), CV nuevo (`/api/cv/generate`) y carta (`/api/carta`), con esfuerzo `medium` |
| Match | `claude-haiku-5-5` | `MATCH_MODEL` | Re-evaluación del ranking (sin cambios) |

Las variables son opcionales: sin ellas rigen los modelos de la tabla. Si la calidad del CV y la carta con Haiku resulta buena, alcanza con cargar `ANTHROPIC_MODEL_REDACCION=claude-haiku-5-5` en Vercel.

Haiku no tiene respaldo del lado del servidor ante un rechazo: la respuesta se maneja en `askStructured`. Sonnet usa `fallbacks: "default"`.

## CV en PDF (desde el 20/11)

`cvBlocks` (`src/lib/claude.ts`) extrae el texto del PDF en el servidor con `unpdf` y manda sólo el texto. Un PDF mandado como archivo se cobra página por página como imagen más texto (~1.500–3.000 tokens por página); como texto cuesta una fracción. Si el PDF tiene menos de 80 caracteres legibles (escaneo, Canva exportado como imagen) o no se puede leer, se manda el PDF como antes, así la IA lo puede leer igual.

## Barandas para la clave nueva

- Cargar un **límite de gasto mensual** en la consola de Anthropic. Sugerido: US$20 por mes; con el reparto de arriba y el uso de octubre y noviembre debería sobrar.
- Usar claves separadas para producción, previews de Vercel y GitHub Actions (`match-eval`), para ver qué consume cada una.
- La clave va sólo en las variables de Vercel y en los secrets de GitHub Actions, nunca en el repo.
