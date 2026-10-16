# Maru Coach (marucoach.com)

**Tu coach profesional.** La home (`/`) reúne las secciones de Maru:

- **Coach de postulación** (`/postulacion`): CV a medida y respuestas para el formulario de una vacante concreta (detalle abajo).
- **Creá tu CV perfecto** (`/cv`): sin vacante. Subís tu experiencia, contás a qué rol, nivel, industria y país apuntás y qué querés destacar (texto o audio), respondés 3-5 preguntas y recibís un CV general optimizado para ATS y recruiters.
- **Carta de presentación** (`/carta`): link o job description (o carta espontánea a una empresa), lo que querés contar por texto o audio, tu experiencia y ajustes de tono, largo, idioma y destinatario. Devuelve una carta editable con reescritura por párrafo, otra versión con otro tono o largo, asunto de email, mensaje corto para LinkedIn y descarga en PDF o Word.
- **Video de presentación** (`/video`): para una búsqueda o una presentación general. Maru escribe el guion (30, 60 o 90 s) en bloques editables con tiempos y tips; lo leés en un **teleprompter** mientras grabás con la cámara del navegador y recibís **feedback de cada toma**: ritmo (palabras por minuto, muletillas), fidelidad al guion y encuadre, luz, fondo y mirada a partir de 3 fotogramas. El video no sale del navegador.
- **Entrená para tu entrevista** (`/entrevista`): simulación con formato de videollamada. Elegís tipo (RR. HH., con tu futuro líder, técnica), dificultad, cantidad de preguntas e idioma; la entrevistadora habla en voz alta, respondés por voz o por escrito y, si tu respuesta queda corta, repregunta. Al final, un **informe** con puntaje, fortalezas, qué mejorar y una respuesta más fuerte (STAR) para cada pregunta.
- **Encontrá tu trabajo perfecto** (`/match`): cargás o reutilizás tu CV, confirmás lo que Maru entendió, contás qué querés hacer y en qué condiciones, y recibís un ranking de búsquedas reales donde podés trabajar desde Argentina, con motivos, brechas y lo que falta confirmar. Desde cada búsqueda podés guardarla, descartarla o preparar la postulación con el coach. Detalle técnico, fuentes y políticas en [docs/match.md](docs/match.md).
- **Extensión de Chrome** (`extension/`): cargás tu CV una vez y, en cualquier formulario de postulación, un clic (o <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd>) completa los campos. Vos revisás y enviás (detalle abajo).

**Diseño del CV:** 24 templates en 5 estilos (clásicos, modernos, ejecutivos, minimalistas y creativos), todos de una columna y ATS-friendly, con color, tipografía, espaciado, tamaño de letra y orden de secciones personalizables. La carta usa los mismos templates para armar un set con el CV. El perfil que Maru lee queda guardado sólo en el navegador para reutilizarlo en las otras secciones.

## Coach de postulación

Para quienes encontraron una vacante que les encanta:

1. Pegan el **link de la vacante** (o el texto, si el portal no deja leerla).
2. Cuentan **por qué les entusiasma** (por qué es una buena vacante, por qué son buen fit, qué les encanta del desafío y la empresa), escribiendo o **dictando por voz**.
3. Suben su **CV en PDF**, su **LinkedIn** (PDF exportado o link público) o pegan su experiencia.
4. Responden **3–5 preguntas cortas** que la IA arma para cubrir lo que falta.
5. Reciben:
   - un **CV personalizado y optimizado** para esa búsqueda, pensado para ATS (una columna, títulos estándar, palabras clave exactas) y para recruiters y hiring managers (titular alineado, logros con impacto), listo para descargar en PDF o copiar como texto;
   - una **recomendación lista para copiar en cada campo del formulario** de postulación, con el porqué y un tip.

Maru nunca inventa experiencia: si un dato ayudaría pero falta, deja un marcador `[completar]` resaltado.

## Extensión de Chrome: completar postulaciones

1. En el popup, la persona sube su CV (PDF o Word, o pega el texto). Maru lo lee con `/api/profile` y lo guarda **sólo en ese navegador** (`chrome.storage.local`), junto con el archivo para adjuntarlo.
2. Opcional: carga "datos que suelen pedir y no están en el CV" (pretensión salarial, disponibilidad, permiso de trabajo, cómo se enteró). Sin eso, Maru no los completa.
3. En el formulario, toca **Completar esta postulación**. La extensión lee los campos de la página **y de sus iframes** (Greenhouse embebido en la web de la empresa), los manda a `/api/autofill` y completa cada uno.
4. Verde: copiado del CV. Amarillo: Maru lo redactó o dedujo (respuestas abiertas, años de experiencia) u obligatorio que falta completar. **Nunca envía el formulario.**

Qué completa: textos, email, teléfono, links, números, fechas, `<select>`, radios, casillas, listas con buscador (`role="combobox"`, como las de react-select en el Greenhouse nuevo) y adjunta el CV en el campo de archivo. Funciona con formularios hechos en React (setter nativo + eventos, teclas completas keydown + keyup) y salta campos ya completos y honeypots anti-bots. Por diseño **no** completa datos demográficos (género, etnia, discapacidad, veterano…) ni aceptaciones legales (arbitraje, términos, privacidad, consentimientos): lo pide el prompt y además lo bloquea el servidor (`isSensitive` en `src/lib/autofill.ts`), aunque la IA conteste igual.

Probado contra formularios reales (sin enviar nada): Lever (Palantir, Spotify) y Greenhouse (Anthropic, 23 campos incluidas 11 listas con buscador).

Todavía no: buscadores que cargan opciones recién al tipear (ciudades), las listas de Workday (son botones, no inputs), formularios de varios pasos que cambian de página y editores de texto enriquecido. Quedan sin tocar y, si son obligatorios, marcados en amarillo.

**Descargarla:** la página `/extension` de Maru tiene el botón de descarga y los 4 pasos; el `.zip` se arma al compilar desde `extension/` (`src/lib/extensionZip.ts`), así que siempre coincide con main.

**Instalarla desde el repo:** abrí `chrome://extensions`, activá *Modo de desarrollador* → *Cargar descomprimida* → elegí la carpeta `extension/`. Por defecto usa la Maru publicada (`https://maru-grego7.vercel.app`); para desarrollo local, poné `http://localhost:3000` en *Avanzado* dentro del popup.

**Cómo está hecha:** JavaScript plano con Manifest V3, sin build. `background.js` coordina (inyecta `content.js` en todos los frames, llama a la API y reparte las respuestas por frame), `content.js` lee y completa los campos, `popup.*` es la interfaz. El servidor valida todo lo que devuelve la IA (`src/lib/autofill.ts`): sólo opciones que existen en la página, fechas y números con formato válido, largo máximo y nada de campos inventados.

**Tests:** `tests/extension.test.ts` levanta Chromium con la extensión cargada contra páginas de prueba (HTML común, iframe de otro origen, un formulario React controlado y listas de react-select como las de Greenhouse) y las rutas reales; sólo simula la respuesta de la IA.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- Claude API (`@anthropic-ai/sdk`) con salidas estructuradas validadas por Zod. Modelo por defecto: `claude-opus-5-5`, con fallback automático del servidor si el modelo declina un pedido
- `cheerio` para leer la vacante: datos `schema.org/JobPosting` + campos de formulario (Greenhouse, Lever, Workable…)
- Dictado con la Web Speech API del navegador (Chrome, Edge, Safari)

## Cómo correrlo

```bash
cp .env.example .env.local   # y poné tu ANTHROPIC_API_KEY
npm install
npm run dev
```

Abrí http://localhost:3000.

## Login con magic link

Cualquier persona puede **ingresar** desde el header de todas las páginas. Para **descargar o copiar el CV y la carta, o descargar el video**, es obligatorio: Maru manda un link (sin contraseña) y el navegador queda recordado por 180 días. Después de abrir el link, la persona vuelve a la página donde estaba.

- Sin base de datos: el link lleva un token firmado (HMAC) que vence en 15 minutos; al abrirlo se crea una sesión firmada en una cookie `httpOnly`.
- Las descargas se validan en el servidor (`/api/export/pdf` y `/api/export/docx` devuelven 401 sin sesión).
- Si la persona abre el link en otra pestaña del mismo navegador, la pestaña original lo detecta y sigue con la descarga sola.

Variables: `AUTH_SECRET` (32+ caracteres, `openssl rand -base64 48`), `SMTP_URL` y `EMAIL_FROM`. Cualquier SMTP sirve (Brevo, Resend, SendGrid, Gmail con contraseña de aplicación).

## Deploy

Funciona en Vercel tal cual: importá el repo y configurá `ANTHROPIC_API_KEY` en las variables de entorno. Las rutas `/api/analyze` y `/api/generate` declaran `maxDuration = 300` porque la generación del CV puede tardar alrededor de un minuto.

## Estructura

```
src/app/page.tsx              Home con las secciones
src/app/postulacion, cv, carta  Páginas de cada sección
src/components/Flow.tsx       Postulación: vacante → motivación → CV → preguntas → resultado
src/components/CvBuilderFlow.tsx  Creá tu CV: experiencia → objetivo → preguntas → CV
src/components/carta/         Carta: flujo, papel editable
src/components/cv/themes.ts   Los 24 templates y la personalización (color, tipografía, densidad, tamaño, orden)
src/components/CvSourceField.tsx, Questions.tsx, ui.tsx  Piezas compartidas
src/components/CvDocument.tsx CV ATS-friendly (también es lo que se imprime a PDF)
src/app/api/analyze           Lee vacante + CV + feedback → análisis y preguntas
src/app/api/generate          + respuestas → CV optimizado y respuestas del formulario
src/app/api/cv/*              Análisis y redacción del CV sin vacante
src/app/api/carta, carta/parrafo  Carta completa y reescritura de un párrafo
src/components/video/, src/app/api/video/*   Video: guion, estudio (cámara + teleprompter) y feedback
src/components/entrevista/, src/app/api/entrevista/*  Entrevista: plan, llamada (voz), turnos y informe
src/components/speech.ts      Dictado continuo, voz de la entrevistadora y métricas de ritmo
src/components/auth/, src/lib/auth.ts, src/app/api/auth/*  Login con magic link
src/app/api/export/pdf, docx  Descargas (exigen sesión)
src/app/api/autofill, src/lib/autofill.ts  Autocompletar formularios desde la extensión
extension/                    Extensión de Chrome (Manifest V3, sin build)
src/lib/job.ts                Scraping de la vacante y de LinkedIn
src/lib/prompts.ts            Instrucciones para Claude
src/lib/match/, src/components/match/, src/app/match/, src/app/api/match/*  Match con búsquedas (ver docs/match.md)
scripts/match-sync.ts, data/match/  Sincronización e inventario compartido de vacantes
src/lib/schemas.ts            Esquemas Zod de entrada/salida
```

## Limitaciones conocidas

- Algunos portales (p. ej. LinkedIn Jobs con login, o sitios 100% JavaScript) no se pueden leer desde el servidor; en ese caso la app pide pegar el texto.
- Los perfiles de LinkedIn casi nunca son públicos para un servidor: lo más confiable es *Más → Guardar en PDF* y subir ese archivo.
- El dictado por voz depende del navegador; Firefox no lo soporta. En la entrevista se puede responder por escrito, y en el video el feedback funciona igual con los fotogramas.
- La voz de la entrevistadora es la del navegador o del sistema: cambia según el dispositivo.
- El video se graba en WebM (Chrome, Edge, Firefox) o MP4 (Safari).
