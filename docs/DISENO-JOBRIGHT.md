# Diseño al estilo jobright.ai

**Relevamiento del 18/10/2026.** El objetivo es que Maru se vea y se sienta como jobright.ai en layout, paleta, tipografía, tamaños, espaciado, radios, sombras, tarjetas, puntaje de match, chips, botones, navegación y movimiento. No se copian su logo, su nombre, sus ilustraciones o fotos, sus textos ni sus archivos CSS o JS (ver el punto 8).

Los valores salen de los estilos computados con Chromium (1440 px y 390 px), del CSS público de `static.jobright.ai` y de mediciones en píxeles de capturas a 2x. Las capturas y los scripts quedaron fuera del repo, en el scratchpad de la sesión (`.../scratchpad/jobright/shots`).

## 0. Qué se pudo ver

| Página | Estado | Sirve para |
| --- | --- | --- |
| `/` (home) | Pública | Header, hero, features alternadas, tarjeta de match (imagen), testimonios, FAQ, CTA final, footer |
| `/ai-job-match` | Pública | La mejor referencia del match: tarjetas con anillo, "STRONG MATCH", "Why You Are A Good Fit", pasos, tarjeta de análisis, FAQ |
| `/h1b-jobs` | Pública | Tarjetas de aviso con meta e íconos, panel "Strong match" |
| `/job-autofill`, `/orion-copilot`, `/ai-resume-builder`, `/tools`, `/employers/pricing` | Públicas | Mismo sistema de landing |
| `/entry-level-jobs`, `/remote-jobs` | Públicas | Son minisitios con otro estilo (Poetsen, tablas embebidas). **No usar como referencia.** |
| `/jobs/recommend`, `/jobs/liked`, `/jobs/applied`, `/jobs/profile`, `/jobs/resume`, `/matching` | Requieren cuenta | El listado, el detalle y el match reales de la app no se pudieron ver. |
| `/jobs/info/*` (detalle público), `/jobs/<categoría>` | No relevadas | `robots.txt` excluye `/jobs/` para ClaudeBot y se respetó. |

Consecuencia: para el listado, el detalle y el match de la app se usan las tarjetas de las landings, que son maquetas del producto, más los tokens de color globales del CSS (los mismos que usa la app). Lo que no se pudo verificar está marcado como **(sin verificar)**.

## 1. Tokens

Maru usa Tailwind v4 con `@theme` en `src/app/globals.css`. El bloque de abajo reemplaza al actual. Se conservan los nombres viejos como alias para no romper clases existentes (`bg-sand`, `bg-brand`, `text-muted`, etc.) y se agregan los de jobright.

```css
@theme {
  /* Marca */
  --color-neon: #00f0a0;          /* --primary-color: CTA estrella, anillos, chips ✓, números de paso */
  --color-neon-60: #00f0a099;
  --color-neon-25: #00f0a040;
  --color-neon-10: #00f0a01a;     /* fondo de etiqueta de tiempo (sobre blanco ≈ #d9fdf2) */
  --color-neon-deep: #00d795;     /* puntos de lista y anillo de halo */
  --color-forest: #1c8d4d;        /* verde de las maquetas de home: círculo "Overall", botón Autofill, chip ✓ alternativo */
  --color-mint: #b5ffe4;          /* eyebrow, sección destacada, pestaña "Publicado hace…" */
  --color-pistachio: #d2ffc8;
  --color-lime: #c8ff6e;
  --color-aqua: #14c8f0;          /* azul de marca: extremo del degradé del anillo, etiqueta "Desde Argentina" al 10% */

  /* Fondos (claro) */
  --color-white: #ffffff;
  --color-hero: #ecffe0;          /* hero, FAQ y footer de la home */
  --color-panel: #effbe8;         /* paneles de maqueta de las features */
  --color-panel-back: #dbf2cc;    /* tarjeta "de atrás" inclinada de las maquetas */
  --color-banner: #e4f7d4;        /* barra de anuncio superior */
  --color-surface: #f2f4f5;       /* secciones grises, chip ✗, burbuja de chat, track del anillo, divisores */
  --color-surface-2: #f3f4f5;     /* --base-color-grey */
  --color-surface-3: #f5f6f7;     /* fondo de la app (listado, detalle) */
  --color-surface-4: #f7f8f9;     /* --base-color-lightgrey */
  --color-surface-5: #f8f9fa;     /* chips de acción rápida */

  /* Texto y líneas */
  --color-ink: #000000;           /* jobright usa negro puro en texto y botones */
  --color-ink-soft: #0a0a0a;      /* cinta de avisos en vivo */
  --color-ink-2: #121212;
  --color-muted: rgba(0, 0, 0, 0.56); /* subtítulos ("Job Fit Analysis") */
  --color-black-45: #00000073;
  --color-black-10: #0000001a;
  --color-black-4: #0000000a;
  --color-chip-line: rgba(0, 0, 0, 0.12);
  --color-line: #f2f4f5;

  /* Estados */
  --color-danger: #ff465a;
  --color-danger-soft: #ffdcd2;
  --color-warning: #fda700;
  --color-warning-soft: #fceeba;
  --color-success: #28c86e;
  --color-info: #3c96fa;
  --color-purple: #8c78ff;

  /* Alias para no romper clases existentes */
  --color-cream: var(--color-white);
  --color-paper: var(--color-white);
  --color-sand: var(--color-panel);
  --color-brand: var(--color-forest);
  --color-brand-dark: #136c39;
  --color-brand-soft: var(--color-banner);
  --color-brand-light: #a7e6c0;
  --color-sage: var(--color-forest);
  --color-sage-soft: var(--color-banner);
  --color-honey: var(--color-warning);
  --color-danger-dark: #c2253a;

  /* Tipografía */
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --font-display: var(--font-titillium), ui-sans-serif, system-ui, sans-serif;

  /* Radios */
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-3xl: 32px;
  --radius-btn: 28px;
  --radius-pill: 999px;

  /* Sombras */
  --shadow-nav: 0 0 2px 0.5px rgba(0, 10, 20, 0.04), 0 0 8px 0 rgba(0, 10, 20, 0.04);
  --shadow-card: 0 16px 48px 0 rgba(0, 10, 20, 0.08);
  --shadow-soft: 0 8px 32px 0 rgba(0, 37, 106, 0.04);
  --shadow-pop: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-modal: 0 32px 80px 0 rgba(0, 10, 20, 0.2);
  --shadow-neon: 0 6px 24px 0 rgba(0, 210, 140, 0.2);
  --shadow-hairline: inset 0 0 0 0.5px #000;
  --shadow-chip: inset 0 0 0 0.8px rgba(0, 0, 0, 0.04);
  --shadow-dot: 0 0 0 4px rgba(0, 215, 149, 0.12);

  /* Movimiento */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);       /* menús, indicadores, anchos */
  --ease-btn: cubic-bezier(0.645, 0.045, 0.355, 1); /* botones e inputs (0.2s) */
}
```

Degradés:

| Nombre | Valor | Uso |
| --- | --- | --- |
| `--bg-gradient` | `linear-gradient(266deg, #acffe1, #cfffc4)` | Fondo destacado (ya usado en el detalle de Maru) |
| Banda de métricas | `linear-gradient(266deg, #b5ffe4, #d2ffc8)` | Banda "3 Hrs / 2x / 8 Million" |
| Anillo de match | `#00f0a0` → `#2ef7e0` (aprox. 30% hacia `#14c8f0`) | Trazo de los anillos grandes y de lista |
| Hero H1B | `#f6f9fb` → `#92fef7` radial desde la derecha | Hero de landing secundaria (opcional) |

Modo oscuro: jobright lo tiene sólo en la app (`:root.dark:not(.unauth)`, fondos `#232424`, `#1f2020`, `#1a1b1b`). No hace falta ahora.

### Tipografía

- **Titillium Web** (Google Fonts, ya cargada en `layout.tsx` con pesos 300, 400, 600 y 700): titulares de la home y de las features. jobright usa la misma.
- **Inter** (variable, ya cargada): todo lo demás, incluidos los titulares de las landings SEO como `/ai-job-match`.
- Letter-spacing siempre `normal`. Jobright no usa itálicas. Usa mayúsculas en titulares grandes, botones del header y CTA final.

| Rol | Desktop | Mobile | Dónde |
| --- | --- | --- | --- |
| Display XL | Titillium 88/80, 600 | Titillium 60/56, 600 | "Do it with AI" (línea fuerte del hero) |
| Display lead | Titillium 46/48, 400 | Titillium ~36/1.1, 400, mayúsculas | Línea liviana arriba del display |
| H2 home (mayúsculas) | Titillium 64/64, 700 | Titillium ~40/1.05, 700 | "REAL RESULTS…", "NO.1 AI…", FAQ (48, 700) |
| H3 feature | Titillium 48/48, 600 | Titillium 32/36, 600 | Título de cada feature alternada |
| Número grande | Titillium 60/60, 700; 44/48, 600 | Titillium 40/44, 700 | Métricas del hero |
| H1 landing Inter | Inter 52/60, 800, mayúsculas + 38/46, 600 | Inter 32/38, 800 + 24/30 | `/ai-job-match` |
| H2 landing Inter | Inter 48/60, 700, mayúsculas | Inter 30/36, 700 | Secciones SEO |
| H3 landing Inter | Inter 40/48, 600, capitalizado | Inter 26/32, 600 | "Get A Match Score…" |
| Subtítulo | Inter 24/32, 600 | Inter 20/28, 600 | Encabezado de banda |
| Título de tarjeta | Inter 18/24, 600 (20/24, 500 en tarjetas de ventaja) | igual | Pasos, ventajas, avisos |
| Cuerpo grande | Inter 18/24, 400 (300 en testimonios) | Inter 16/24 | Bajada de hero y listas |
| Cuerpo | Inter 16/24, 400 | igual | Texto general, FAQ (pregunta 16/24, 500) |
| Chico | Inter 14/20, 400 | igual | Banner, chips, lista de análisis (título 14/20, 700) |
| Navegación | Inter 13/16, 400 | Inter 16/24, 400 (menú) | Links del header y del footer |
| Etiqueta | Inter 12/16, 400 a 700 | igual | Tiempo, "STRONG MATCH" (700, mayúsculas) |
| Botón grande | Inter 20/24, 500 | Inter 14/20, 600 | CTA negros de 56 px |
| Botón header | Inter 14/20, 700 (500 en "Ingresar"), mayúsculas | igual | "JOIN NOW", "SIGN IN" |
| Botón CTA final | Titillium 32/40, 700, mayúsculas | Titillium 24/32 | Botón neón de cierre |

### Espaciado, contenedores y breakpoints

- Escala en uso: 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64, 72, 80, 96 px.
- Header: contenido de 1280 px como máximo, con 80 px a los costados en 1440.
- Contenido de la home: 1200 px como máximo (120 px de margen en 1440). Features: texto de 384 a 512 px y panel de 768 × 576, con 48 px de separación y 900 px de alto por bloque.
- Paneles redondeados de landing: 1344 px como máximo (48 px de margen), con 72 px de padding interno y 24 px entre paneles.
- Mobile: margen lateral de 16 px, contenido de 375 px como máximo y todo apilado.
- Breakpoints: 640, 768 (cambio principal a mobile, `max-width: 767px`), 1024, 1280, 1536. Son los de Tailwind; no hay que tocar nada.

### Radios, bordes y sombras

| Elemento | Radio | Borde / sombra |
| --- | --- | --- |
| Etiqueta de tiempo, chips del mock | 6 px | sin borde |
| Chip de acción rápida, logo de empresa | 8 px | `1px solid rgba(0,0,0,.12)` / `1px solid #f2f4f5` |
| Input, select, ítem de FAQ de home, tarjetas de los mocks | 12 px | sin borde; fondo `rgba(0,0,0,.04)` |
| Marco del video del hero | 16 px | `1px solid #000`, barra superior blanca de 40 px con 3 puntos |
| Tarjeta de paso, de ventaja, ítem de FAQ de landing, panel de maqueta | 24 px | sin borde |
| Tarjeta de análisis (chat) | 32 px | `--shadow-card` |
| Botones de 56 px | 28 px | sin borde |
| Botones del header (36 px) | 22 px | sin borde |
| Pastilla de navegación | 60 px | `--shadow-nav` |
| Eyebrow, chips de preferencia | 999 px | `--shadow-chip` |
| Sección de landing | `0 80px 80px 80px` (esquina superior izquierda recta) | sin borde |
| Sección FAQ de la home | `120px 0 0 0` (mobile 64 px) | sin borde |
| Testimonio | `0 40px 40px 40px` | `--shadow-hairline` |
| Burbuja de chat | `4px 18px 18px 18px` | sin borde |

### Movimiento

| Qué | Valor |
| --- | --- |
| Color de links | `color 0.3s ease` |
| Botones e inputs | `all 0.2s var(--ease-btn)` |
| Revelado al hacer scroll | `opacity 0.8s ease-in-out, transform 0.8s ease`, desde `opacity: 0` (ya existe `[data-reveal]`) |
| Menús desplegables | `opacity 0.16s–0.18s ease` y `transform 0.24s var(--ease-out)` |
| Indicador del switcher | `transform 0.24s var(--ease-out)`, `width 0.24s var(--ease-out)` |
| Acordeón de FAQ | ícono `+` que rota 45° en 0.3s |
| Cintas (avisos en vivo, testimonios) | marquee lineal infinito, pausa al pasar el mouse (ya existe `.marquee`) |
| Anillos | se dibujan al entrar en pantalla (ya existe `.ring-fill`) |
| `prefers-reduced-motion` | jobright lo respeta; Maru también. Mantener |

Lo que Maru agrega y jobright no tiene (`.press` con `translateY(-1px)`, `.spotlight`, `.marker`, `.animate-float`): se puede dejar, pero para parecerse más conviene bajarlo a `transform: none` en hover y conservar sólo `scale(0.97)` al apretar.

### Íconos

Sprite propio de 169 íconos de línea, casi todos en grilla de 16 × 16, trazo de 1.16 a 1.5 y `fill="none"`. Algunos tienen relleno negro o `#00F0A0` (check en círculo). El estilo más parecido es **Lucide** (o Tabler outline) a 16 px con `stroke-width` 1.5. Maru dibuja SVG en línea con trazo 1.6–1.7 sobre 24, que da el mismo peso visual. No hace falta sumar dependencias: alcanza con unificar en 16 px, trazo 1.5, puntas redondeadas.

## 2. Componentes

### Barra de anuncio
40 px de alto, fondo `--color-banner`, Inter 14/16 negro, centrada, ícono de 16 px a la izquierda y link 14/16 500 subrayado con flecha. En mobile ocupa dos líneas (≈52 px). Es opcional en Maru; sirve para lanzamientos (ej.: la extensión).

### Header (desktop)
- 76 px de alto (116 con la barra), fondo blanco y sticky.
- Izquierda: logo de Maru (marca propia).
- Centro: **pastilla de navegación** blanca, radio 60, padding `4px 24px 4px 4px`, gap 24, `--shadow-nav`, altura 44. Adentro va primero el **switcher**: pastilla negra de 36 px, radio 36 y padding 2, con dos opciones de 120 × 32 y radio 32 en Inter 14/16 600. La activa va blanca con texto negro y la otra en texto blanco. Siguen los links en Inter 13/16 400 con "Herramientas ▾" (triángulo de 8 px).
- Derecha, con gap 12: **Ingresar** (120 × 36, radio 22, fondo `rgba(0,10,20,.04)`, Inter 14/20 500 en mayúsculas) y **Empezar** (120 × 36, radio 22, negro, Inter 14/20 700 en mayúsculas, blanco).
- Para Maru: el switcher puede alternar "Personas / Empresas" sólo si existe la segunda opción. Si no, se omite y la pastilla queda con "Herramientas ▾ · Búsquedas · Planes".

### Header (mobile)
60 px, padding `0 16px`. Hamburguesa de 20 px a la izquierda, logo e **Ingresar** como texto (14/20 700, mayúsculas). **Empezar** es negro, de 96 × 28, radio 16 y 14/20 700. El menú abierto ocupa toda la pantalla en blanco, con el switcher a todo el ancho (40 px), una lista de links de 16/24 400 cada 40 px, un divisor `#f2f4f5` y links secundarios. La X reemplaza a la hamburguesa.

### Botones

| Variante | Medidas | Estilo |
| --- | --- | --- |
| Primario grande | 56 px de alto, padding `16px 16px 16px 20px`, gap 16, radio 28 | Negro, Inter 20/24 500 blanco. A la derecha, círculo blanco de 24 px con chevron negro de 16 |
| Primario feature | 48 px, ancho mínimo 256, radio 28 | Negro, Inter 20/24 500 |
| CTA neón | 56 px, radio 28 | `#00f0a0`, texto negro Inter 20/24 500 |
| CTA final | 64 px, ancho mínimo 280, padding `12px 48px`, radio 36 | `#00f0a0`, `1px solid #000`, Titillium 32/40 700 en mayúsculas |
| Hero de la home | 56 px, ancho 280, radio 28 | Negro, Titillium 24 700 en mayúsculas ("PROBÁ GRATIS") |
| Secundario contorno (mobile) | 36 px, padding `8px 32px`, radio 28 | Blanco con `inset 0 0 0 1px #000`, Inter 14/20 600 |
| Primario mobile | 36 px, padding `8px 32px`, radio 28 | Negro, Inter 14/20 600 |
| Gris (header) | 36 px, radio 22 | `rgba(0,10,20,.04)`, texto negro |
| Verde de producto | 48 px (botón ancho de tarjeta) o 40 px, radio 6 a 8 | `--color-forest`, blanco, Inter 16–20 500. Para "CONECTAR" van 14/20 700 en mayúsculas |

Estados: hover `opacity: .85` o fondo `#000` → `#1a1a1a`, en 0.2s. Disabled con `opacity: .4`. Focus visible con `outline 2px #000`, offset 3 (ya está).

### Chips y etiquetas

| Chip | Estilo |
| --- | --- |
| Eyebrow de sección | Fondo `#b5ffe4`, radio 999, padding `6px 12px`, Inter 14/20 600 |
| Tiempo ("hace 1 h") | Fondo `--color-neon-10` sobre blanco (≈`#d9fdf2`), radio 6, padding `2px 6px`, Inter 12/16 400 (en mocks escalados se ve de 14) |
| Pestaña "Publicado hace…" | Pegada arriba a la izquierda de la tarjeta, fondo `#b5ffe4`, radio `8px 8px 0 0`, padding `4px 8px`, 12/16 |
| Atributo ("Contratando activamente") | Fondo `#f2f4f5`, radio 8, padding `4px 8px`, 12–14 px, arriba a la derecha de la tarjeta |
| Match ✓ ("Experiencia") | Fondo `#00f0a0`, texto negro, radio 6, 32–36 px de alto, padding `0 12px`, "✓ " delante. Variante home: `--color-forest` con texto blanco |
| Match ✗ ("Formación") | Fondo `#f2f4f5`, texto negro, "✕" delante. Variante home: blanco con `1px solid --color-forest` y texto verde |
| Preferencia | Blanco, radio 999, `--shadow-chip`, padding `6px 12px 6px 6px`, círculo de 20 px `#00f0a0` con check negro y texto Inter 14/20 |
| Acción rápida | `#f8f9fa`, `1px solid rgba(0,0,0,.12)`, radio 8, padding `8px 12px`, Inter 12/16 500 |
| Búsquedas populares | Negro, texto blanco, radio 999, padding `4px 12px`, Inter 12/16 500, centrados con gap 8 |
| Filtro (listado) **(sin verificar)** | Mismo patrón que el select: fondo `rgba(0,0,0,.04)`, radio 12, 48 px; activo en negro con texto blanco |

### Puntaje de match (anillo)

El anillo arranca abajo (a las 6), avanza en sentido horario, tiene puntas redondeadas y un track `#f2f4f5` (`rgba(255,255,255,.15)` sobre fondo oscuro). El número va en Inter bold y el `%` en un cuerpo más chico, pegado a la base.

| Tamaño | Diámetro | Trazo | Color | Número | Rótulo |
| --- | --- | --- | --- | --- | --- |
| Grande ("General") | 120 px | 5 px | Degradé `#00f0a0` → `#2ef7e0` | 44 px 700 + `%` 16 px | "General", Inter 16/20 400, debajo del número, dentro del anillo |
| Mediano (subpuntajes) | 72 px | 2.5–3 px | `#00f0a0` sólido | 22 px 700 + `%` 12 px | Inter 16/20 400 debajo del anillo ("Experiencia", "Skills", "Industria") |
| Chico (lista) | 48 px | 2 px | Degradé claro `#59fcca` → `#53f0ec` | 20 px 600 + `%` 11 px | A la izquierda: "MATCH FUERTE", Inter 12/16 700, mayúsculas, gap 16 |

- El anillo grande lleva un halo blanco de 6 px y sombra suave (`--shadow-card`), y se monta sobre la esquina superior derecha de la tarjeta (sale 24 px hacia afuera).
- Variante home: círculo **lleno** `--color-forest` de 112 px con "95%" en blanco Titillium 44 700 y "General" en 14 px. Los subanillos llevan trazo `--color-forest` y track `#c1dfce`.
- Variante oscura (panel de la app, la que ya usa Maru): fondo `linear-gradient(180deg,#000,#2c3a3a)`, anillo de 80 px y trazo 5 con el mismo degradé neón, número blanco. **(sin verificar contra la app)**.
- Niveles: las páginas públicas sólo muestran "STRONG MATCH" (92–98%). En el CV aparece "EXCELLENT" para 9.0. Maru mantiene sus umbrales actuales (`score >= 70` y `>= 45` en `Results.tsx`) y usa estos colores:

| Nivel | Rótulo | Trazo | Fondo de etiqueta |
| --- | --- | --- | --- |
| ≥ 70 | MATCH FUERTE | degradé neón → aqua | `--color-neon-10` |
| 45–69 | BUEN MATCH | `--color-warning` (#fda700) | `#fda7001a` |
| < 45 | MATCH POSIBLE | `#00000073` | `--color-surface` |

### "Por qué encajás"
- Título en Inter 20/24 500 ("Why You Are A Good Fit"), 24 px por debajo del divisor.
- Chips ✓/✗ apilados, uno por fila y alineados a la izquierda, con gap 8.
- Divisores de 1 px `#f2f4f5` entre cabecera, subpuntajes y esta sección, con 16 px arriba y abajo.

### Tarjeta de aviso (listado)
Según los mocks de `/ai-job-match` y `/h1b-jobs`:
- Blanca, radio 24 en las listas de landing (16 en la app, **sin verificar**), padding 20–24 y sin borde. Sobre fondo gris `#f2f4f5`/`#f5f6f7` las tarjetas se separan 8 px. Sobre blanco se usa `--shadow-card`.
- Fila 1: logo de 60 × 60 (radio 8, `1px solid #f2f4f5`, padding 8) y, al lado, etiqueta de tiempo, título 18/24 600 y empresa 14/20 400. Gap 12.
- Fila de meta: ícono de línea de 16 px + texto 14/20, en grilla de 2 columnas con gap `8px 40px` (ubicación, modalidad, etapa/salario).
- Puntaje: arriba a la derecha, rótulo "MATCH FUERTE" + anillo chico. En la app se reemplaza por el panel oscuro de la derecha (lo que tiene Maru).
- Hover: elevar con `--shadow-card` en 0.2s, sin desplazar.
- Variante "apilada" (decorativa, sólo hero): tres tarjetas superpuestas, cada una corrida 52 px a la izquierda y 140 px hacia abajo.

### Tarjeta de paso
Blanca, radio 24, padding 24, con 288 px de ancho en grilla de 4 columnas y gap 16. Número en círculo de 36 px `#00f0a0` (Inter 16 700). Título 18/24 600 con 8 px abajo y texto 14/20 en `--color-muted`.

### Tarjeta de análisis (chat de Maru)
- Blanca, radio 32, padding 28, `--shadow-card`, 568 px.
- Cabecera: avatar de 44 px, nombre 20/24 600 y subtítulo 13/18 `--color-muted`, con divisor y 20 px abajo.
- Burbuja: `#f2f4f5`, radio `4px 18px 18px 18px`, padding `14px 16px` y 15/22.
- Ítems: padding `14px 0`, gap 12, punto de 10 px `--color-neon-deep` con `--shadow-dot`, título 14/20 700, descripción 12/18 `--color-muted` y divisor `#f2f4f5`.
- Abajo, chips de acción rápida.

### Sección de landing
Panel de 1344 px como máximo, radio `0 80px 80px 80px` y padding 72. El fondo alterna `#f2f4f5`, `#b5ffe4` (destacada) y el degradé de la banda. Adentro van dos columnas con gap 64–80: texto (eyebrow, H2, párrafo de 18/24, viñetas con negrita y CTA) y visual. En mobile el radio baja a `0 40px 40px 40px` y el padding a 24.

### Banda de métricas
Usa el degradé `266deg #b5ffe4 → #d2ffc8`, radio `0 80px 80px 80px` y padding 72. Lleva tres columnas de 400 px con borde izquierdo `2px solid #000` y padding `4px 40px`. Valor en Inter 52/60 700 y rótulo en Inter 20/24 500. En mobile se apila con el borde arriba.

### Métricas del hero (home)
Valor en Titillium 44/48 600, rótulo en Inter 16/20 300 y línea guía `1px dashed #000` hasta un ícono de 40 px a la derecha. Gap vertical de 8 (ya existe `.leader`; hay que pasar a guiones de 1 px).

### Cinta de avisos en vivo
Fondo `#0a0a0a`, 144 px de alto, a todo el ancho. Cada ítem lleva logo de 48 px (radio 10, `0 0 0 .5px rgba(255,255,255,.15)`), "Empresa" 13/16 600 · "hace 18 min" 13/16 400 en `rgba(255,255,255,.9)` y título 18/24 500 blanco. Gap 64 y marquee infinito.

### Testimonios
Cinta horizontal con tarjetas de 348 × 328, radio `0 40px 40px 40px`, `--shadow-hairline` y padding 24. Las comillas van en negro de 24 px, la cita en Inter 18/24 300 y el autor abajo (avatar de 48 + nombre 14/20 600 + rol 14/20 300). Gap 16. Destacada: tarjeta negra `#121212`, radio 48 y texto blanco.

### FAQ
- Home: sección `#ecffe0` con radio `120px 0 0 0` y título Titillium 48/48 700 en mayúsculas, centrado. Ítems de 800 px como máximo, 64 px de alto, fondo `rgba(0,0,0,.04)`, radio 12, padding `0 20px` y gap 8. Pregunta en 16/24 500 e ícono "+" en círculo de 24 (trazo 1.2) que rota 45° al abrirse.
- Landing: ítems blancos de 720 px, radio 24, padding 32 y gap 12, con pregunta en 16/24 600.

### Footer
Fondo `#ecffe0`, logo arriba a la izquierda y redes (24 px, cuadrados negros) a la derecha. Cuatro columnas de igual ancho, con título 14/20 600 y links 13/16 400 cada 20 px. Padding superior de 96 a 160 px después del CTA final. En mobile, una columna con títulos 16/24 600.

### Inputs y selects
Fondo `rgba(0,0,0,.04)`, sin borde, radio 12, 48 px de alto, padding `0 12px` y texto Inter 14/22 (placeholder 14/24 500 negro). En el buscador del cierre van en fila con el botón "IR" negro de 48 × 48 y radio 12.

## 3. Layouts

### Home (`/`)
- **Desktop:**
  1. Header.
  2. Hero `#ecffe0` a todo el ancho: video a la izquierda (640 × 400, marco de 16 px con barra de 3 puntos) y texto a la derecha (512 px: display lead, display XL, bajada de 18/24 y botón de 56 px).
  3. Sellos y métricas con líneas guía.
  4. "ACCEDÉ A…" con números grandes y la cinta negra de avisos en vivo.
  5. Cinco features alternadas de 900 px de alto: texto a la izquierda (384 px) y panel `#effbe8` de 768 × 576 a la derecha, con radio 24 y la maqueta adentro. El texto queda fijo (sticky) mientras pasa la maqueta.
  6. Testimonios en cinta.
  7. FAQ.
  8. CTA final con botón neón.
  9. Buscador en fila.
  10. Footer.
- **Mobile:** hero centrado con display de 60 px, bajada de 16/24 y dos botones de 36 px uno al lado del otro. Debajo, el video a todo el ancho y los sellos en fila. Cada feature apila título, texto, botón negro centrado y panel a todo el ancho. FAQ a todo el ancho; footer en una columna.

### Listado (`/busquedas`)
- **Desktop:** `AppShell` sobre fondo `#f5f6f7` con barra lateral de 72 px (degradé `90deg #e4e5e8 → #f8fafe`), cabecera blanca de 64 px y título Inter 22 800 en mayúsculas. Al centro, filtros tipo select y la lista de tarjetas con gap 8. A la derecha, panel blanco de 348 px con el chat de Maru. **(sin verificar contra la app)**: estructura tomada de la versión actual de Maru y de los tokens.
- **Mobile:** sin barra lateral; la cabecera tiene hamburguesa, logo y CTA. El buscador queda arriba de la lista, los filtros en fila con scroll horizontal, las tarjetas a todo el ancho con margen de 12 y el puntaje como anillo chico arriba a la derecha (en lugar del panel oscuro).

### Detalle (`/busquedas/[id]`)
- **Desktop:** dos columnas, `minmax(0,1fr) 340px` con gap 16.
  - Izquierda: tarjeta blanca de radio 16 y padding 24. Arriba, pestañas ("Resumen") con subrayado negro de 2 px. Siguen el logo de 56, la empresa, el título 24/32 700, las etiquetas y la meta. Después vienen la tarjeta de match (anillo grande, tres subanillos y "Por qué encajás") y las secciones de requisitos, que separan divisores `#f2f4f5` y presentan las skills en chips de acción rápida.
  - Derecha, sticky: tarjetas "Aumentá tus chances", blancas de radio 16 y padding 16, cada una con botón neón de 40 px.
- **Mobile:** una columna con barra fija abajo (botón neón de 48 px y link al aviso original). Ya existe.

### Match (`/match`)
- **Desktop:**
  - Cabecera tipo landing `/ai-job-match`: H1 Inter 52/60 800 en mayúsculas + 38/46 600, bajada de 18/24 y CTA neón de 56. A la derecha, las tres tarjetas apiladas con anillos chicos.
  - Banda de métricas con datos reales de Maru (`stats` de `MatchFlow`).
  - Pasos: tarjetas de paso sobre panel `#f2f4f5`.
  - Resultados: lista de tarjetas como en el listado, pestañas tipo switcher (pastilla blanca con opción activa negra) y filtros en panel blanco de radio 24.
- **Mobile:** H1 de 32 px, CTA a todo el ancho, una sola tarjeta de ejemplo en lugar de tres, banda apilada, pasos en una columna y resultados con anillo chico.

## 4. Mapeo de componentes

| jobright | Maru (archivo) | Cambio |
| --- | --- | --- |
| Tokens `:root` (`--primary-color`, `--base-color-*`) | `src/app/globals.css` | Reemplazar `@theme` por el bloque del punto 1. Agregar `--shadow-*`, `--radius-*` y `--ease-btn` |
| Barra de anuncio | `src/components/SiteShell.tsx` (nuevo bloque arriba del header) | Opcional, 40 px `--color-banner` |
| Header con pastilla de navegación | `src/components/SiteShell.tsx`, `src/components/NavPills.tsx` | Alto 76, contenedor de 1280, pastilla con radio 60 y `--shadow-nav` en vez de `ring-1`, links 13/16, botones de 36 px y radio 22 ("Ingresar" gris + "Empezar" negro) |
| Menú mobile a pantalla completa | `src/components/NavPills.tsx` (`NavMenu`) | Hoy es un desplegable de 240 px; pasar a panel a pantalla completa con links de 16/24 cada 40 px |
| Botones | `src/components/ui.tsx` (`PrimaryButton`) + clases sueltas en páginas | Crear variantes (`primary`, `neon`, `outline`, `ghost`, `forest`, tamaños 36/48/56) en `ui.tsx` y reemplazar las clases repetidas |
| Chips ✓/✗, tiempo, eyebrow, preferencia, acción rápida | `ui.tsx` (`Chips`), `busquedas/JobCard.tsx` (`TimeTag`, `ArgTag`), `app/busquedas/[id]/page.tsx` (`Chips`) | Unificar en `ui.tsx` con las medidas del punto 2 |
| Anillo de match (3 tamaños + oscuro) | `match/Results.tsx` (`ScoreRing`), `landing/Mocks.tsx` (`Ring`), `globals.css` (`.ring-draw`, `.ring-fill`) | Un solo `ScoreRing` en `ui.tsx` con `size="lg"|"md"|"sm"`, `tone="light"|"dark"|"forest"`, degradé SVG neón → aqua e inicio a las 6 |
| Tarjeta de aviso | `busquedas/JobCard.tsx`, `match/Results.tsx` (`JobCard` interno) | Logo de 60 con radio 8, título 18/24 600, meta en grilla `8px 40px`, hover con `--shadow-card`, anillo chico en mobile. Reunir las dos tarjetas en una base común |
| "Por qué encajás" + subpuntajes | `match/Results.tsx` | Chips ✓/✗ apilados, subanillos de 72, divisores `#f2f4f5` |
| Tarjeta de paso | `ui.tsx` (`StepCard`), `app/page.tsx` (`#como-funciona`) | `StepCard` ya usa `#f2f4f5` y círculo neón; ajustar radio 24, padding 24 y número de 36. La sección "cómo funciona" pasa de fondo negro a panel `#f2f4f5` con tarjetas blancas |
| Hero de home | `src/app/page.tsx`, `landing/HeroVideoPlayer.tsx` | Display Titillium 88/80 y lead 46/48 400. Marco del video con borde de 1 px y radio 16. Botón de 56 |
| Features alternadas con panel de maqueta | `src/app/page.tsx` (`Feature`), `landing/Mocks.tsx` (`MockPanel`) | Hoy hay tarjetas en grilla de 2. Pasar a filas alternadas texto/panel de 768 × 576, con panel `#effbe8` de radio 24 y tarjeta trasera `#dbf2cc` inclinada |
| Sellos con laureles | `landing/Laurels.tsx` | Ya respeta la regla de datos verdaderos. Sólo ajustar tipografía (10–14 px, 700) |
| Cinta de avisos en vivo | `src/app/page.tsx` ("Incorporadas recientemente"), `.marquee` | Pasar la grilla de recientes a cinta negra `#0a0a0a` con marquee |
| Testimonios | `landing/EvidenceWall.tsx`, `landing/Evidence.tsx` | Tarjetas de 348 × 328 con radio `0 40 40 40` y borde fino, en cinta. Sin inventar testimonios |
| FAQ | `landing/Faq.tsx` | Ítems: fondo `rgba(0,0,0,.04)` en vez de `bg-brand-soft`, 64 px, radio 12, ícono de círculo con "+". Sección con radio `120px 0 0 0` |
| CTA final | `landing/CtaScene.tsx` | Botón neón Titillium 32/40 700 con borde negro de 1 px y radio 36 |
| Buscador | `busquedas/JobSearchBar.tsx` | Campos con fondo `rgba(0,0,0,.04)`, sin `ring`, radio 12, 48 px; botón negro de 48 × 48 |
| Footer | `src/components/SiteShell.tsx` | Fondo `#ecffe0` (hoy `bg-sand`), cuatro columnas, links 13/16, redes arriba a la derecha si existen |
| App: barra lateral y cabecera | `src/components/app/AppShell.tsx`, `app/SideNav.tsx` | Ya siguen el patrón. Revisar sólo tokens (`#f5f6f7`, `#f2f4f5`) e íconos de 16/1.5 |
| Listado | `src/app/busquedas/page.tsx` | Gap 8 entre tarjetas, filtros como select gris, panel derecho con la tarjeta de análisis |
| Detalle | `src/app/busquedas/[id]/page.tsx` | Sumar la tarjeta de match (si hay CV) y pasar los emojis de las secciones a íconos de línea |
| Match | `src/app/match/page.tsx`, `match/MatchFlow.tsx`, `match/PrefsForm.tsx`, `match/ProfileConfirm.tsx` | Cabecera tipo `/ai-job-match`, banda de métricas, pasos, inputs grises y chips de preferencia con check neón |
| Burbuja y chat | `src/components/chat/*`, `landing/Mocks.tsx` (`ChatMock`) | Burbuja `#f2f4f5` con radio `4 18 18 18`. La del usuario queda en `#d2ffaa`/`#c8ff6e` (verde lima de jobright), no en `bg-brand` |

## 5. Plan de implementación (PRs chicas)

Cada PR corre `npx vitest run`, `npx tsc --noEmit -p .` y `npx eslint src scripts tests`, se mergea con CI verde y se anota en `docs/PENDIENTES.md`.

1. **Tokens.** Reemplazar el `@theme` de `globals.css` con alias y ajustar `.leader` (guiones de 1 px) y `.press` (sin elevación). Sin cambios de estructura. Revisar a ojo la home, `/busquedas` y `/match` en 1440 y 390.
2. **Primitivas en `ui.tsx`.** `Button` con variantes y tamaños, `Tag`/`Chip` (tiempo, eyebrow, ✓/✗, preferencia, acción rápida) y `ScoreRing` único con tests de render (tamaños, tono y nivel por umbral). Todavía no se reemplazan usos.
3. **Header, menú mobile y footer.** `SiteShell.tsx` y `NavPills.tsx`, con barra de anuncio opcional.
4. **Hero y métricas de la home.** `page.tsx`, `HeroVideoPlayer.tsx` y `Laurels.tsx`.
5. **Features alternadas y maquetas.** `page.tsx` (`Feature`) y `Mocks.tsx` (`MockPanel`, `MatchMock` con el anillo nuevo).
6. **Cinta de avisos, testimonios, FAQ y CTA final.** `page.tsx`, `EvidenceWall.tsx`, `Faq.tsx` y `CtaScene.tsx`.
7. **Tarjeta de aviso común.** `busquedas/JobCard.tsx` y la tarjeta interna de `match/Results.tsx` sobre una base compartida, con `ScoreRing` (`sm` en mobile y oscuro en desktop).
8. **Listado.** `busquedas/page.tsx` y `JobSearchBar.tsx` (filtros y buscador).
9. **Detalle.** `busquedas/[id]/page.tsx`: tarjeta de match, íconos de línea y chips.
10. **Match.** `MatchFlow.tsx`, `PrefsForm.tsx`, `ProfileConfirm.tsx` y `Results.tsx` (cabecera, banda, pasos, pestañas y "Por qué encajás").
11. **App y QC visual.** `AppShell.tsx` y `SideNav.tsx` con íconos de 16/1.5. Capturas comparativas en 1440 y 390 (fuera del repo) y revisión de `prefers-reduced-motion`.

## 6. Qué no se copia

- El logo (pájaro sobre globo verde), el nombre "Jobright" y el de su asistente ("Orion"), y cualquier variante de esas marcas.
- Las ilustraciones, fotos y avatares (escena del CTA final, personaje, mapa de EE. UU., fotos de testimonios), los logos de empresas de sus maquetas y su video.
- Los textos: titulares, bajadas, FAQ y testimonios. En Maru se escriben en rioplatense y siguen `docs/ESCRITURA.md`. No se muestran premios, ratings ni cifras que Maru no tenga (lo de `Laurels.tsx` sigue esa regla).
- Sus archivos: CSS de `static.jobright.ai`, sprite de íconos, fuentes servidas por ellos y JS. Las fuentes se toman de Google Fonts, que ya están en `layout.tsx`. Los íconos los dibuja Maru.
- Las capturas de pantalla no entran al repo.
