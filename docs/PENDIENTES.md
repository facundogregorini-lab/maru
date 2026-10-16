# Pendientes y traspaso (para seguir con otra IA o con el equipo)

Estado al 16/10/2026. Auditoría con puntajes por producto: [docs/AUDITORIA.md](AUDITORIA.md). Publicación de la extensión: [docs/chrome-web-store.md](chrome-web-store.md). Variables de entorno: [.env.example](../.env.example).

## Objetivo del producto

Maru tiene que ser **igual a jobright.ai de punta a punta, adaptado** (español rioplatense, Argentina, y sólo lo que Maru hace de verdad), y una suite irresistible que se compre sin pensarlo: plan Maru a **$10.000 por mes**.

**Regla de oro:** nunca mostrar algo que Maru no hace (sin testimonios inventados, sin premios, sin "el más elegido"). Los números salen del inventario real (`data/match/inventory.json`) o de estudios con fuente (`src/lib/evidence.ts`).

---

## 1. Lo que depende del dueño (en este orden)

Todo el código ya está. Mientras no se configure cada cosa, Maru sigue andando como hoy (gratis y sin límites); cada pieza se activa sola al cargar sus variables en Vercel (Settings → Environment Variables) y volver a publicar.

| # | Qué | Cómo | Activa |
|---|---|---|---|
| 1 | **Base de datos** | Vercel → proyecto → **Storage** → Create Database → **Upstash for Redis** (Marketplace, plan gratis) → conectarla al proyecto en todos los entornos. Vercel carga `KV_REST_API_URL` y `KV_REST_API_TOKEN` solas. | Cuentas con plan, límites del plan gratis, seguimiento sincronizado, alertas |
| 2 | **Login con Gmail** | Google Cloud Console → APIs y servicios → Pantalla de consentimiento (externa, nombre "Maru Coach") → Credenciales → ID de cliente OAuth "Aplicación web" → URI de redireccionamiento `https://<dominio>/api/auth/google/callback` (una por dominio: producción y, si querés, la de Vercel). Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. | Botón "Continuar con Google" en el ingreso |
| 3 | **Emails** | Cuenta SMTP (Brevo, Resend o SendGrid) con tu dominio verificado: `SMTP_URL` y `EMAIL_FROM`. **Sin esto nadie puede entrar con email ni descargar su CV** (con Google sí). | Magic link y alertas |
| 4 | **Cobro** | Mercado Pago → Tus integraciones → crear aplicación → credenciales de producción: `MP_ACCESS_TOKEN`. Webhooks → URL `https://<dominio>/api/pagos/webhook`, evento "Planes y suscripciones" → copiar la clave secreta a `MP_WEBHOOK_SECRET`. **Probar primero con credenciales de prueba** (usuarios de prueba de Mercado Pago): crear la suscripción, pagar, ver que "Mi cuenta" diga "Plan Maru", dar de baja. | Plan pago y límites del plan gratis (3 creaciones/mes) |
| 5 | **Cron de alertas** | `CRON_SECRET` (cualquier texto largo al azar). El cron ya está en `vercel.json` (todos los días 9:00 de Argentina). | Alertas diarias por email |
| 6 | **Analytics** | Vercel → proyecto → Analytics → Enable. | Visitas y eventos del match |
| 7 | **Dominio** | Cuando esté marucoach.com: `NEXT_PUBLIC_SITE_URL=https://marucoach.com` (sitemap, Open Graph, links de los emails) y actualizar `DEFAULT_SERVER` en `extension/background.js` y `extension/popup.js`. | |
| 8 | **Legales** | Revisión de un abogado de `/terminos`, `/privacidad` y `/arrepentimiento` (razón social, CUIT, domicilio). Email de contacto en `NEXT_PUBLIC_CONTACT_EMAIL`. | |
| 9 | **Reintegros** | El botón de arrepentimiento da de baja la suscripción y deja el pedido guardado (`arrepentimiento:<email>` en la base y un aviso en los logs de Vercel). **La devolución del dinero se hace a mano** desde Mercado Pago (Actividad → el pago → Devolver). | Cumplir la Ley 24.240 |
| 10 | **Chrome Web Store** | Cuenta de desarrollador (US$5) y seguir [docs/chrome-web-store.md](chrome-web-store.md). | Instalación en 1 clic |
| 11 | **Fuente de búsquedas con logos** | Elegir proveedor (ver sección 4) y pasar la API key para sumar el conector. | Más búsquedas argentinas y logos |

Opcional: `ANTHROPIC_FAST_MODEL` para elegir el modelo rápido de la entrevista y el chat (por defecto `claude-sonnet-5-5`; si la cuenta no lo tiene, usa el principal solo).

---

## 2. Lo que ya está hecho

**Plataforma**
- **Cuenta**: magic link (`src/lib/auth.ts`) y Google (`src/lib/google.ts`, `src/app/api/auth/google/*`), misma cookie de sesión. "Mi cuenta" en `/cuenta` (plan, uso del mes, alertas, baja, borrar datos).
- **Base de datos** (`src/lib/db.ts`): Upstash Redis por REST, sin dependencias; sin variables usa memoria (desarrollo y tests).
- **Plan y cobro**: `src/lib/account.ts` (cuenta, plan, cupo), `src/lib/pricing.ts` (precio y límite en un solo lugar), `src/lib/mercadopago.ts` (suscripción preapproval, firma del webhook), rutas `src/app/api/pagos/*`, `/precios`, `/arrepentimiento`. El límite (`src/lib/plan.ts`) se aplica en las 5 rutas de creación (CV a medida, CV, carta, entrevista, video) **sólo si hay base y cobro configurados**; descuenta recién cuando la creación salió bien. Al agotarse, la API responde 402 y **Maru abre la oferta sola** (`PLAN_EVENT` en `src/components/ui.tsx`). La baja normal conserva el plan hasta el fin del mes pagado; el arrepentimiento lo corta en el acto.
- **Límite de uso por IP** en todas las rutas de IA (`src/middleware.ts`, `src/lib/rateLimit.ts`).
- **Legales, SEO y métricas**: `/terminos`, `/privacidad`, `/arrepentimiento`, sitemap con cada búsqueda, robots, Open Graph, Vercel Analytics.

**Productos**
- **Home** con video (regenerado con números sin repetidas), laureles, evidencia con fuentes, FAQ con precio.
- **Búsquedas** (`/busquedas`, `/busquedas/[id]`): agrupadas por puesto + empresa (`src/lib/match/group.ts`, 9.792 → 6.439), avisos masivos de baja calidad al final (`src/lib/match/quality.ts`), logos cuando la fuente los publica, **alertas por email** ("Avisame de nuevas", `src/lib/alerts.ts`, cron `src/app/api/cron/alertas`), **chat con Maru** en el panel derecho (`src/components/busquedas/ChatPanel.tsx`, `src/app/api/chat`: la IA decide qué buscar y los avisos salen del inventario real), barra fija en celular.
- **Match**: "Ver más búsquedas", marca "Nueva" desde tu última visita, motivos sin repetir.
- **Postulación a medida**: la motivación ahora es opcional; puntaje ATS de antes y después (`atsBefore` en `src/lib/ats.ts`).
- **CV con IA**: mismo antes y después del ATS.
- **Carta**, **Video** (cámara robusta: sin micrófono graba igual, errores claros, duración de la toma, Maru no tapa los controles) y **Entrevista** (turnos con modelo rápido).
- **Extensión**: "Guardar en mi seguimiento" al completar un formulario.
- **Seguimiento**: kanban, se llena solo desde todas las herramientas, **sincronizado con la cuenta** (`src/components/tracker/TrackerSync.tsx`, `src/app/api/seguimiento`).
- **Maru**: sentada en su escritorio, recorrido en modo checklist, oferta al final y cuando se termina el plan gratis.

---

## 3. Lo que falta mejorar en cada producto

| Producto | Puntaje | Qué falta |
|---|---|---|
| Home | 8 | Testimonios y empresas reales cuando haya usuarios. |
| Búsquedas | 8 | Más búsquedas argentinas y logos para el 90% que viene de Greenhouse, Lever y Ashby (sección 4). Salarios en un formato único. |
| Match | 8 | Encabezado en formato app (`AppShell`): es estético y cambia la estructura de `/match`, quedó afuera a propósito. |
| Postulación a medida | 8 | Medir el tiempo real con la IA en producción (análisis + generación). Si pasa de ~60 s, usar el modelo rápido para el análisis. |
| CV con IA | 8 | — |
| Carta | 8 | — |
| Entrevista | 7,5 | Voces del navegador (suenan robóticas según el dispositivo): una voz natural pagaría (ElevenLabs u OpenAI TTS). Avatar de la entrevistadora. Tiempo por respuesta. |
| Video | 7,5 | Venderlo como extra del plan. Probar en Safari de iPhone. |
| Extensión | 6 | Publicarla en la Web Store (dueño). Workday y formularios de varios pasos (no se pudieron probar: la red de este entorno no llega a esos sitios). |
| Seguimiento | 8 | Landing propia con la plantilla (opcional, como `/tools/job-tracker`). |
| Maru (guía y venta) | 8 | Que el cobro esté configurado (dueño). |
| Flujo de compra | 7 | Listo en código; falta configurarlo y probarlo con Mercado Pago de prueba (dueño). |
| Plataforma | 8 | Límite de uso por IP firme entre instancias usando la base (hoy es por instancia). Borrar los datos de la cuenta desde "Mi cuenta" (hoy, a pedido). |

---

## 4. Respuestas a las preguntas del dueño

### ¿De dónde vienen las búsquedas? ¿Apify u otra API?

**Hoy:** 6 fuentes públicas y gratuitas (`src/lib/match/sources.ts`), sincronizadas todos los días por GitHub Actions: las páginas de empleo de 425 empresas en **Lever** (4.691 avisos), **Greenhouse** (2.502) y **Ashby** (1.329), más los portales **Get on Board** (989), **Jobicy** (268) y **Remotive** (14). Son avisos de primera mano y con link directo para postularse, pero (1) casi no hay empresas argentinas medianas que publican en Bumeran, ZonaJobs, Computrabajo o LinkedIn, y (2) Lever, Greenhouse y Ashby no publican logos.

**Opciones, de mejor a peor para Maru:**

1. **Google for Jobs vía API** (JSearch en RapidAPI, con plan gratis para probar, o SerpApi): junta lo que publican LinkedIn, Indeed, Bumeran, Computrabajo y las webs de empresas, **con logo, web de la empresa y link para postularse**. Es la forma más rápida de sumar volumen argentino. Costo por consulta; un sync diario por área y ciudad entra en un plan chico.
2. **Datasets con licencia** (TheirStack, Coresignal): avisos con dominio y logo de la empresa, más caros, pero sin riesgo de términos de uso.
3. **Más páginas de empleo directas** (gratis y de la mejor calidad): sumar empresas argentinas a `data/match/companies.json` y agregar conectores de Workable y Teamtailor (APIs públicas).
4. **Apify** (actores que scrapean LinkedIn, Indeed o Bumeran): sirve para probar, pero scrapear va contra los términos de esos sitios (LinkedIn bloquea y demanda), se rompe seguido y los datos no se pueden republicar tranquilos. No lo recomiendo para producción.

**Logos para lo que ya hay:** con el dominio de cada empresa (se puede sumar al directorio) y un servicio de logos como logo.dev o Brandfetch (plan gratis con atribución). Las tarjetas ya muestran el logo si existe (`CompanyTile`, campo `companyLogo`), y Jobicy, Remotive y Get on Board ya lo traen desde el próximo sync.

**Para avanzar:** elegir la opción 1 o 2 y pasar la API key. El conector entra en el registro de fuentes apagado, se prueba una semana midiendo cuántas búsquedas nuevas desde Argentina suma, y se prende. (Ojo: hay un test que exige que sólo se usen fuentes gratuitas, `tests/match-api.test.ts` → "sin dependencias facturables"; es una decisión del dueño cambiarlo.)

### ¿Cómo anda hoy el simulador de entrevistas?

1. **Preparación** (`/entrevista`): elegís la búsqueda (link, texto o un rol en general), tu CV y cómo practicar: tipo (RR. HH., con tu futuro líder, técnica), dificultad (amable, estándar, exigente), cantidad (4, 6 u 8 preguntas, ~10 a 20 min) e idioma.
2. **Plan** (`/api/entrevista/preparar`): la IA arma las preguntas pensadas para esa búsqueda y tu experiencia.
3. **Llamada** (`src/components/entrevista/Call.tsx`): pantalla tipo videollamada. La entrevistadora **habla en voz alta** (voz del navegador o del sistema) y vos respondés **por voz** (dictado del navegador: Chrome, Edge y Safari; en Firefox, por escrito) o escribiendo.
4. **Turnos** (`/api/entrevista/turno`, ahora con modelo rápido): después de cada respuesta reacciona en una frase y, si quedó vaga o sin resultado, **repregunta** una vez, como una entrevista real.
5. **Informe** (`/api/entrevista/informe`): puntaje general de 0 a 100, puntaje de 1 a 5 por pregunta, qué funcionó, qué mejorar y una **respuesta sugerida en formato STAR** con tus datos (sin inventar).
6. Nada se guarda en el servidor; el informe queda en tu navegador y la búsqueda se suma al seguimiento.

Límites: la voz depende del dispositivo (puede sonar robótica), no hay avatar ni análisis del tono de voz, y no se graba el audio.

### ¿La base de datos se puede configurar desde Vercel?

Sí, en 2 minutos: proyecto en Vercel → pestaña **Storage** → **Create Database** → **Upstash for Redis** → plan gratis → **Connect** al proyecto (Production, Preview y Development). Vercel carga solas `KV_REST_API_URL` y `KV_REST_API_TOKEN`; con el próximo deploy Maru empieza a usarla. Elegí Redis porque alcanza para todo lo que hace falta (cuentas, plan, cupos, seguimiento, alertas), no suma dependencias y tiene plan gratis; si más adelante hace falta SQL (reportes, muchas tablas), se puede pasar a Postgres (Neon, también desde Storage) reemplazando sólo `src/lib/db.ts`.

---

## Cómo trabajar en el repo

- Instalar: `npm install`. Correr: `npm run dev`. Chequeos antes de subir: `npx tsc --noEmit -p .`, `npx eslint src --quiet`, `npx vitest run`, `npx next build`.
- Si `vitest` falla en `tests/extension.test.ts` por timeout, suele ser Chromium compitiendo con otro test que también lo abre: correr `npx vitest run --no-file-parallelism` o matar los procesos colgados y repetir.
- Diseño: tokens en `src/app/globals.css` (menta `bg-sand`, `brand`, `neon` #00f0a0, gris de bloques `#f2f4f5`, fondo app `#f5f6f7`). Botones: negro redondo o neón; tarjetas `rounded-[24px]`.
- Textos en español rioplatense (vos), claros y verdaderos.
- Deploy: Vercel publica cada rama (preview) y `main` (producción). Flujo: rama → PR → checks de GitHub y Vercel en verde → merge.
- Para comparar con jobright: capturas con Chromium (`/opt/pw-browsers/...`) en 1440×900 y 390×844. La red de los entornos de Claude en la nube no llega a jobright.ai ni a la web publicada salvo que se habiliten esos dominios.
