# Tanda 1 de creativos (19/10/2026)

Conjunto nuevo `MARU | Tanda 1 | AR | Límite gratuito`, dentro de la campaña `MARU | Límite gratuito | AR | Test01`. Copia la configuración del conjunto de estáticos: mismo evento (`maru_paywall_viewed`), Argentina, 18-65, público y ubicaciones Advantage+. El presupuesto es el de la campaña (5.000 ARS/día), así que este conjunto no suma gasto: lo reparte con el anterior. Criterio de cada pieza: `../PROPUESTA-CREATIVOS.md`.

Cada anuncio usa la versión `feed` (1080×1350) en feed y la `story` (1080×1920) en Stories y Reels. El carrusel usa 5 tarjetas de 1080×1080. Identidad: página Maru Coach e Instagram @marucoach.ai.

URL: `https://www.marucoach.com/<sección>?utm_source=meta&utm_medium=paid_social&utm_campaign=maru_limite_test01&utm_content=<anuncio>`

| Anuncio | Archivos | Destino | Texto principal | Título | Botón |
|---|---|---|---|---|---|
| `MARU \| T1 \| A silencio \| estatico` | `t1-silencio-*` | `/cv` | Si mandás el mismo CV a todos los avisos, los filtros automáticos lo descartan antes de que lo lea una persona. Maru lo adapta a cada búsqueda con lo que ya hiciste y te pregunta lo que falta. Empezá gratis. | Tu CV, adaptado a cada aviso | Más información |
| `MARU \| T1 \| B no inventa \| estatico` | `t1-noinventa-*` | `/postulacion` | Pegás el link del aviso, contás por qué te interesa y respondés unas preguntas. Maru arma el CV para esa búsqueda y las respuestas del formulario. Lo que no sabe, no lo inventa: lo deja marcado para que lo completes. | Un CV con datos tuyos, no inventados | Más información |
| `MARU \| T1 \| C busquedas \| estatico` | `t1-busquedas-*` | `/match` | Maru revisa todos los días búsquedas reales de empresas y portales, y te muestra las que encajan con tu CV, tu seniority y lo que querés hacer, con el motivo de cada una. Empezá gratis. | Búsquedas reales, ordenadas para vos | Más información |
| `MARU \| T1 \| D entrevista \| estatico` | `t1-entrevista-*` | `/entrevista` | Elegís el tipo de entrevista y la dificultad. Maru pregunta en voz alta, repregunta si te quedás corto y al final te da un informe con qué mejorar y una respuesta más fuerte para cada pregunta. | Practicá la entrevista antes de la real | Más información |
| `MARU \| T1 \| F primer empleo \| nativo` | `t1-primerempleo-*` | `/cv` | Contale a Maru qué estudiaste, qué hiciste y a qué rol apuntás. Te hace unas preguntas y arma un CV claro, listo para los filtros automáticos, con lo que de verdad hiciste. Gratis para empezar. | Tu primer CV, con lo que ya hiciste | Más información |
| `MARU \| T1 \| Match v2 \| control` | `t1-match-v2-*` | `/match` | Maru revisa búsquedas reales todos los días y te muestra las que encajan con tu CV, tu seniority y lo que querés hacer. Empezá gratis. | Encontrá tu trabajo perfecto | Más información |
| `MARU \| T1 \| A carrusel` | `t1-carrusel-1..5` | `/cv` | El mismo CV para todos los avisos da el mismo resultado. Mirá cómo Maru lo adapta a una búsqueda con datos tuyos, sin inventar nada. | Tarjetas: "El mismo CV no sirve para todo" · "Lo que pide el aviso" · "Lo que te pregunta Maru" · "Tu CV para ese aviso" · "Empezá gratis" | Más información |

El número "+3.000" sale del inventario del 19/10 (5.266 búsquedas abiertas y elegibles desde Argentina en `data/match/inventory.json`, unas 3.400 visibles después de los filtros). Si baja de 3.000, hay que cambiar la pieza C.

Las piezas son ejemplos ilustrativos con datos ficticios. Se regeneran con `node build.mjs`, que necesita las fuentes Inter y Titillium Web descargadas en `fonts/` y la lista `fonts-local.css`; no están en el repo.
