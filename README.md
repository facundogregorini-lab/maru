# maru

**Tu coach profesional.** La home (`/`) reúne las secciones de Maru:

- **Coach de postulación** (`/postulacion`): CV a medida y respuestas para el formulario de una vacante concreta (detalle abajo).
- **Creá tu CV perfecto** (`/cv`): sin vacante. Subís tu experiencia, contás a qué rol, nivel, industria y país apuntás y qué querés destacar (texto o audio), respondés 3-5 preguntas y recibís un CV general optimizado para ATS y recruiters.
- **Carta de presentación** (`/carta`): link o job description (o carta espontánea a una empresa), lo que querés contar por texto o audio, tu experiencia y ajustes de tono, largo, idioma y destinatario. Devuelve una carta editable con reescritura por párrafo, otra versión con otro tono o largo, asunto de email, mensaje corto para LinkedIn y descarga en PDF o Word.
- **Video de presentación** (`/video`): para una búsqueda o una presentación general. Maru escribe el guion (30, 60 o 90 s) en bloques editables con tiempos y tips; lo leés en un **teleprompter** mientras grabás con la cámara del navegador y recibís **feedback de cada toma**: ritmo (palabras por minuto, muletillas), fidelidad al guion y encuadre, luz, fondo y mirada a partir de 3 fotogramas. El video no sale del navegador.
- **Entrená para tu entrevista** (`/entrevista`): simulación con formato de videollamada. Elegís tipo (RR. HH., con tu futuro líder, técnica), dificultad, cantidad de preguntas e idioma; la entrevistadora habla en voz alta, respondés por voz o por escrito y, si tu respuesta queda corta, repregunta. Al final, un **informe** con puntaje, fortalezas, qué mejorar y una respuesta más fuerte (STAR) para cada pregunta.
- Match con búsquedas y aplicación automática: próximamente.

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

Cualquier persona puede **ingresar** desde el header de todas las páginas. Para **descargar o copiar el CV y la carta, o descargar el video**, es obligatorio: Maru manda un link (sin contraseña) y el navegador queda recordado por 180 días. Después de abrir el link, la persona vuelve a la página donde estaba.

- Sin base de datos: el link lleva un token firmado (HMAC) que vence en 15 minutos; al abrirlo se crea una sesión firmada en una cookie `httpOnly`.
- Las descargas se validan en el servidor (`/api/export/pdf` y `/api/export/docx` devuelven 401 sin sesión).
- Si la persona abre el link en otra pestaña del mismo navegador, la pestaña original lo detecta y sigue con la descarga sola.

Variables: `AUTH_SECRET` (32+ caracteres, `openssl rand -base64 48`), `SMTP_URL` y `EMAIL_FROM`. Cualquier SMTP sirve (Resend, Brevo, Mailjet, Gmail con contraseña de aplicación).

### Continuar con Google

El diálogo de ingreso muestra **Continuar con Google** cuando están configuradas `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`; si no, sólo aparece el magic link. Crea la misma sesión que el link (cookie firmada de 180 días), sin base de datos. Se abre en una ventana emergente para no perder lo que la persona está armando (si el navegador la bloquea, sigue en la misma pestaña). Sólo pide `openid email`, usa PKCE, `state` firmado + cookie (anti-CSRF) y `nonce`, y exige email verificado.

1. En [Google Cloud Console](https://console.cloud.google.com/) creá un proyecto (o usá uno), y en *Google Auth Platform → Branding* completá nombre de la app, email de soporte y dominio.
2. *Audience*: tipo **External** y pasala a *In production* para que entre cualquier persona. Con sólo `openid` y `email` no hace falta la verificación de app de Google; si querés que la pantalla de Google muestre el nombre y el logo de Maru, hay una verificación de marca más liviana.
3. *Clients → Create client → Web application*. En **Authorized redirect URIs** agregá cada dominio desde el que se va a entrar, por ejemplo:
   - `https://TU-DOMINIO/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
4. Copiá el Client ID y el Client secret a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en Vercel y redeployá.

Las URLs de preview de Vercel cambian en cada deploy: Google sólo acepta las URIs registradas, así que en previews conviene probar con el magic link (o registrar la URL fija de la rama).

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
src/lib/job.ts                Scraping de la vacante y de LinkedIn
src/lib/prompts.ts            Instrucciones para Claude
src/lib/schemas.ts            Esquemas Zod de entrada/salida
```

## Limitaciones conocidas

- Algunos portales (p. ej. LinkedIn Jobs con login, o sitios 100% JavaScript) no se pueden leer desde el servidor; en ese caso la app pide pegar el texto.
- Los perfiles de LinkedIn casi nunca son públicos para un servidor: lo más confiable es *Más → Guardar en PDF* y subir ese archivo.
- El dictado por voz depende del navegador; Firefox no lo soporta. En la entrevista se puede responder por escrito, y en el video el feedback funciona igual con los fotogramas.
- La voz de la entrevistadora es la del navegador o del sistema: cambia según el dispositivo.
- El video se graba en WebM (Chrome, Edge, Firefox) o MP4 (Safari).
