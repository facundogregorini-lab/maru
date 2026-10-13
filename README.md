# maru

**Tu postulación, a medida.** Una web para quienes encontraron una vacante que les encanta:

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

## Deploy

Funciona en Vercel tal cual: importá el repo y configurá `ANTHROPIC_API_KEY` en las variables de entorno. Las rutas `/api/analyze` y `/api/generate` declaran `maxDuration = 300` porque la generación del CV puede tardar alrededor de un minuto.

## Estructura

```
src/app/page.tsx              Landing + flujo
src/components/Flow.tsx       Pasos: vacante → motivación → CV → preguntas → resultado
src/components/CvDocument.tsx CV ATS-friendly (también es lo que se imprime a PDF)
src/app/api/analyze           Lee vacante + CV + feedback → análisis y preguntas
src/app/api/generate          + respuestas → CV optimizado y respuestas del formulario
src/lib/job.ts                Scraping de la vacante y de LinkedIn
src/lib/prompts.ts            Instrucciones para Claude
src/lib/schemas.ts            Esquemas Zod de entrada/salida
```

## Limitaciones conocidas

- Algunos portales (p. ej. LinkedIn Jobs con login, o sitios 100% JavaScript) no se pueden leer desde el servidor; en ese caso la app pide pegar el texto.
- Los perfiles de LinkedIn casi nunca son públicos para un servidor: lo más confiable es *Más → Guardar en PDF* y subir ese archivo.
- El dictado por voz depende del navegador; Firefox no lo soporta.
