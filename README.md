# maru

**Tu coach profesional.** La home (`/`) reúne las secciones de Maru:

- **Coach de postulación** (`/postulacion`): CV a medida y respuestas para el formulario de una vacante concreta (detalle abajo).
- **Creá tu CV perfecto** (`/cv`): sin vacante. Subís tu experiencia, contás a qué rol, nivel, industria y país apuntás y qué querés destacar (texto o audio), respondés 3-5 preguntas y recibís un CV general optimizado para ATS y recruiters.
- **Carta de presentación** (`/carta`): link o job description (o carta espontánea a una empresa), lo que querés contar por texto o audio, tu experiencia y ajustes de tono, largo, idioma y destinatario. Devuelve una carta editable con reescritura por párrafo, otra versión con otro tono o largo, asunto de email, mensaje corto para LinkedIn y descarga en PDF o Word.
- Video de presentación, simulación de entrevista, match con búsquedas y aplicación automática: próximamente.

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

Para **descargar o copiar el CV** hay que ingresar con el email: Maru manda un link (sin contraseña) y el navegador queda recordado por 180 días.

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
src/lib/job.ts                Scraping de la vacante y de LinkedIn
src/lib/prompts.ts            Instrucciones para Claude
src/lib/schemas.ts            Esquemas Zod de entrada/salida
```

## Limitaciones conocidas

- Algunos portales (p. ej. LinkedIn Jobs con login, o sitios 100% JavaScript) no se pueden leer desde el servidor; en ese caso la app pide pegar el texto.
- Los perfiles de LinkedIn casi nunca son públicos para un servidor: lo más confiable es *Más → Guardar en PDF* y subir ese archivo.
- El dictado por voz depende del navegador; Firefox no lo soporta.
