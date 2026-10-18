# Meta Ads · primera campaña de Maru

Cuenta publicitaria **Costa Reset (1356376906306947)**, la misma de Templo Ninja, en una campaña aparte. Medición: `docs/TRACKING.md` → "Píxel de Meta".

## Estructura propuesta

| Nivel | Configuración |
|---|---|
| Campaña | `MARU \| Límite gratuito \| AR \| Test01` · objetivo Clientes potenciales · presupuesto **5.000 ARS/día** · empieza en pausa |
| Conjunto 1 · Estáticos | Ubicación de la conversión: sitio web · píxel "Maru Web" · evento de optimización: conversión personalizada **"Maru \| Límite gratuito alcanzado"** (`maru_paywall_viewed`) · Argentina · 22–50 años · público Advantage+ · ubicaciones Advantage+ |
| Conjunto 2 · Reel (próximo paso) | Igual al 1, con el reel de uso de la plataforma cuando esté grabado |

URL: `https://www.marucoach.com/<sección>?utm_source=meta&utm_medium=paid_social&utm_campaign=maru_limite_test01&utm_content=<anuncio>`

Única señal de optimización: "límite gratuito alcanzado y planes mostrados". Activación, InitiateCheckout y Purchase se miden para el funnel, no para optimizar.

## Anuncios estáticos (conjunto 1)

Cada anuncio usa la versión `feed` (1080×1350) para feed y la `story` (1080×1920) para Stories y Reels (personalización de recursos por ubicación).

| Anuncio | Archivos | Destino | Texto principal | Título | Botón |
|---|---|---|---|---|---|
| Match | `maru-01-match-*.png` | `/match` | Maru revisa búsquedas reales todos los días y te muestra las que encajan con tu CV, tu seniority y lo que querés hacer. Empezá gratis. | Encontrá tu trabajo perfecto | Más información |
| CV | `maru-02-cv-*.png` | `/cv` | Contale a Maru a qué rol apuntás y adapta tu CV a cada aviso con tu experiencia real, para que pase los filtros automáticos. | Un CV distinto para cada búsqueda | Más información |
| Carta | `maru-03-carta-*.png` | `/carta` | Traé la búsqueda, contá qué querés transmitir y Maru escribe una carta concreta, con tus mejores logros. En PDF o Word. | Una carta a medida de cada aviso | Más información |
| Video | `maru-04-video-*.png` | `/video` | Maru te escribe el guion, lo leés en un teleprompter mientras grabás y recibís feedback de cada toma. | Tu video de presentación en un minuto | Más información |
| Todo en uno | `maru-05-todo-*.png` | `/` | Matches, CV, carta, video y entrevista: preparás cada postulación con tu experiencia real. Empezá gratis, sin tarjeta. | Buscá trabajo con Maru | Registrarte |

Las piezas usan las ilustraciones de producto del sitio ("ejemplo ilustrativo"): datos ficticios, sin promesas de resultados.
