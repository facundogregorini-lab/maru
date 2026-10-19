# Encontrá tu trabajo perfecto (`/match`)

Actualización de continuidad, 16/10/2026: [estrategia de avisos](ESTRATEGIA-AVISOS.md), [plan de la próxima etapa](PLAN-AVISOS.md) y [evidencia](research/avisos-2026-10-16/README.md). El catálogo productivo sigue con fuentes gratuitas; hay pilotos privados de proveedores sin importación ni cron pago. El dueño descartó el abono de Fantastic y autorizó aprovechar su trial gratuito. Este documento describe el motor actual, no autoriza proveedores nuevos.

Primera versión del match de Maru: una persona que vive en Argentina carga (o reutiliza) su CV, confirma lo que Maru entendió, cuenta qué trabajo quiere y en qué condiciones, y recibe un ranking de búsquedas **reales** con el porqué de cada coincidencia, las brechas y lo que falta confirmar. Desde cada búsqueda puede guardar, descartar con motivo, abrir el aviso original o **preparar la postulación** con el coach existente.

No hay cobertura total del mercado: Maru muestra sólo lo que puede leer gratis y con permiso, y todas las cifras que aparecen son conteos reales del inventario.

## Arquitectura

```
GitHub Actions (1 vez por día)          Vercel (app)
scripts/match-sync.ts  ──escribe──►  data/match/inventory.json  ──lee──►  /api/match/*  ──►  /match
  conectores (GET públicos)              (inventario compartido,         ranking sin estado    UI (datos personales
  lotes · checkpoint · lock               sin datos de usuarios)                                locales + cuenta Redis)
```

- **Catálogo sin base adicional.** El inventario compartido es un archivo versionado en el repo que genera la sincronización programada. Las cuentas ya usan Redis para perfil, match y seguimiento; eso no convierte Redis en la base del catálogo. El código de inventario (`src/lib/match/inventory.ts`) es puro y recibe/devuelve objetos: una migración futura requiere adaptar carga y escritura, pero no está indicada para la próxima fase.
- **Datos personales**: sin sesión, perfil y preferencias viven en el navegador (`maru:match:v1`). Con sesión se sincronizan a la cuenta mediante Redis, con aislamiento y control de versiones. El ranking (`POST /api/match/ranking`) los recibe, ordena y responde sin registrarlos como parte del catálogo. "Borrar mis datos" también propaga el borrado a la cuenta. Detalle actual en el README, sección de base de datos.
- **Separación del modelo**: oportunidad canónica (`Opportunity`), publicaciones por fuente (`StoredPosting`), perfil y preferencias (`MatchProfile`, `MatchPrefs`), interacciones (`Interactions`) y ejecuciones (`SyncRun`). Ver `src/lib/match/types.ts`.

### Archivos

| Qué | Dónde |
| --- | --- |
| Registro de fuentes y condiciones | `src/lib/match/sources.ts` |
| Conectores (Greenhouse, Lever, Ashby, Get on Board, Jobicy, Remotive) | `src/lib/match/connectors.ts` |
| Reintentos, backoff, Retry-After y protección SSRF | `src/lib/match/http.ts` |
| Extracción por reglas (área, seniority, contrato, idiomas, habilidades) | `src/lib/match/extract.ts` |
| Elegibilidad desde Argentina | `src/lib/match/eligibility.ts` |
| Upserts, política de cierre y deduplicación | `src/lib/match/inventory.ts` |
| Orquestación de la sincronización | `src/lib/match/sync.ts`, `scripts/match-sync.ts` |
| Ranking explicable | `src/lib/match/ranking.ts` |
| Directorio de empleadores | `data/match/companies.json` |
| Inventario | `data/match/inventory.json` (+ `sync-state.json`) |
| UI | `src/components/match/*`, `src/app/match/*` |
| Panel administrativo | `/match/admin` (sólo emails de `ADMIN_EMAILS`) |

## Configuración

| Variable | Para qué |
| --- | --- |
| `ADMIN_EMAILS` | Emails separados por comas, espacios o saltos de línea con acceso a `/match/admin`. Sin esta variable nadie es admin. Requiere sesión del login existente, con Google. |
| `MATCH_WEIGHTS` | Opcional. Pesos del ranking `rol,seniority,requisitos,preferencias`. Default `40,25,20,15`. |
| `MATCH_DISABLED_SOURCES` | Opcional. Fuentes a apagar sin tocar código, ej. `remotive,jobicy`. |
| `MATCH_SYNC_BUDGET_MS` | Opcional (script). Tiempo máximo de una ejecución antes de guardar checkpoint. Default 20 min. |

No hace falta ninguna credencial nueva: todas las fuentes activas son públicas.

## Cómo correr la sincronización

```bash
npm run match:sync                                   # todas las bolsas activas
npm run match:sync -- --only=greenhouse:clara,remotive
npm run match:add-company -- https://jobs.lever.co/despegar "Despegar" "viajes"
```

En producción la corre `.github/workflows/match-sync.yml` todos los días a las 06:17 (Argentina) y también se puede lanzar a mano desde *Actions → match-sync → Run workflow*. Si el inventario cambió, el workflow commitea `data/match/*.json` y Vercel publica el nuevo inventario con el deploy.

Garantías:

- **Lotes y checkpoints**: guarda progreso cada 10 bolsas; si se agota el presupuesto de tiempo, la próxima ejecución sigue desde donde quedó.
- **Bloqueo**: `sync-state.json` tiene un lock (vence a las 2 h) y el workflow usa `concurrency`; nunca corren dos a la vez.
- **Reintentos**: hasta 3, con backoff exponencial y respeto de `Retry-After`; los 4xx no se reintentan.
- **Idempotencia**: clave `bolsa:id_original` y hash de contenido; un aviso sin cambios no se reprocesa.
- **Aislamiento**: si una fuente falla, sus avisos quedan intactos y las demás siguen.

### Política de cierre

1. Si una fuente falla, no se toca ninguno de sus avisos.
2. Una ausencia sólo cuenta si se recibió el listado **completo** de esa bolsa.
3. Un aviso se cierra tras **2 sincronizaciones completas seguidas** sin aparecer (si reaparece, se reabre).
4. En feeds parciales (Jobicy: sólo los últimos 200), la ausencia nunca cierra; se retira si pasan **30 días** sin verlo.
5. Un vencimiento explícito de la fuente cierra el aviso.
6. Los cerrados se conservan 30 días (para mostrar "Ya no figura en la fuente" a quien lo guardó) y después se purgan.

La UI nunca dice "vacante confirmada abierta": muestra "Revisado en el sitio del empleador" (ATS) o "Visto por última vez en la fuente" (portales), con fecha.

## Fuentes (revisadas el 2026-10-15)

| Fuente | Acceso | Condiciones relevantes | Límites | Estado |
| --- | --- | --- | --- | --- |
| Greenhouse Job Board API | GET público por empresa | Los GET son públicos sin autenticación; no publica términos de reutilización. Uso conservador: extracto + enlace al aviso del empleador. | Sin límite documentado | **Habilitada** |
| Lever Postings API | GET público por empresa | Pensada para sitios de empleo; sólo avisos publicados, que según Lever pueden ser leídos por terceros. Sin términos explícitos de redistribución. | Límite documentado sólo para POST | **Habilitada** |
| Ashby Public Job Posting API | GET público por empresa | Sin términos documentados; respetamos `isListed=false`. | Sin límite documentado | **Habilitada** |
| Get on Board (API pública) | GET público por categoría | Su ayuda permite mostrar avisos publicados en otro sitio y armar buscadores con los listados públicos. Atribución y enlace al aviso. | Sin límite publicado; pausa de 1 s | **Habilitada** (formato a validar en la 1.ª sync) |
| Jobicy Remote Jobs API | GET público | Uso en productos permitido; hay que mantener a Jobicy como fuente y conservar su URL canónica. | ≤ 1 consulta por hora (usamos 1 por día) | **Habilitada** |
| Remotive Public API | GET público | Permite compartir avisos con enlace y crédito a Remotive; prohíbe usarlos para captar registros/emails o enviarlos a terceros. En Maru el ranking se ve sin registro. 24 h de demora. | ≤ 4 consultas por día | **Habilitada** (deshabilitar si el ranking pasa a exigir login) |
| Himalayas | API key | Prohíbe redistribuir a otros portales o agregadores; exige crédito y su `applicationLink`. | 120/min, 25.000/día | **Necesita autorización** (y credencial) |
| Jooble | API key | Cuota gratuita finita: no sirve como base permanente. | Por clave | **Necesita credencial** — fuera del núcleo |
| JSearch, SerpApi, TheirStack | Pagos | Fuera del MVP. | — | **Incompatible** (pago) |
| LinkedIn, Indeed, Bumeran, ZonaJobs, Computrabajo | Sin API pública gratuita | No se usan cuentas, cookies, scraping ni endpoints privados. Las personas pueden pegar avisos de estos portales (quedan privados). | — | **Necesita autorización** |

> Acceso público a un endpoint no equivale a licencia de republicación comercial. Para Greenhouse, Lever y Ashby mostramos sólo extracto, datos básicos y enlace al empleador. Antes de un lanzamiento comercial amplio conviene una revisión legal.

Las fuentes con enlace obligatorio (Remotive, Jobicy, Get on Board) conservan su URL y su atribución aunque la misma vacante también llegue desde el ATS del empleador: el botón "Ver búsqueda" lleva a la fuente obligatoria y el empleador queda listado como fuente adicional.

## Directorio de empleadores

`data/match/companies.json` tiene 82 entradas, cada una con la URL pública que prueba que su bolsa existe (`evidence`):

- **77 candidatas** (34 Greenhouse, 19 Lever, 24 Ashby): tecnología, fintech, servicios profesionales, agencias, salud, educación, industria, logística, staffing, atención al cliente, ventas y operaciones. Incluye empleadores argentinos (Despegar, InvGate, Santex, Mutt Data, Coderio, Clara) y regionales que contratan en Argentina (dLocal, EBANX, Nubank, Yuno, Cabify, QuintoAndar).
- **5 no integrables**, con motivo: Jobgether (agregador), un board interno, un board no identificable, Mercado Libre y Globant (portales propios sin API compatible).

Una candidata pasa a **integrada**, **sin vacantes elegibles** o **fallida** según lo que devuelva la primera sincronización (lo muestra `/match/admin`). No se inventan empresas, slugs ni permisos: lo que no se pudo comprobar queda como candidata o no integrable.

Para sumar empresas: `/match/admin → Agregar una empresa` valida la URL contra la API y devuelve la entrada; o `npm run match:add-company -- <url>`.

## Elegibilidad desde Argentina

- **Elegible**: Argentina o una ciudad argentina en la ubicación/países; o LATAM, Latin America, South America o Worldwide sin restricción en contra; o una descripción que dice explícitamente que contratan desde Argentina/LATAM.
- **Por confirmar**: "Remote" sin región; Americas; datos de ubicación vacíos; fuentes que se contradicen; LATAM con pedido de permiso de trabajo en EE. UU. Se muestran aparte, en "Por confirmar".
- **No elegible**: US only, permiso de trabajo en EE. UU. en un remoto sin región, otro país/ciudad explícito, exclusión explícita de Argentina. No entran al ranking (salvo que la persona declare autorización o disposición a mudarse a ese lugar: entonces van a "Por confirmar" y nunca asumimos el permiso).
- Una zona horaria se informa como condición horaria, nunca como permiso de contratación.
- Jobicy usa "Anywhere" como valor por defecto cuando el aviso no informa región: se trata como desconocido.

## Ranking

1. **Filtros eliminatorios primero** (`src/lib/match/fit.ts`): no elegibles, roles a evitar, descartes, empresas bloqueadas y condiciones indispensables. Además, desde el 19/10/2026, aunque no estén marcados como indispensables:
   - **Nivel**: si la persona eligió niveles, se excluyen los avisos de nivel inferior y los que están más de dos niveles por encima. El nivel sale del título y de la descripción (personas a cargo, a quién reporta, P&L o presupuesto). Los cargos individuales (analista, especialista, editor, diseñador…) nunca cuentan como liderazgo. Un "Manager" sin equipo a cargo, o un aviso sin nivel cuando se busca liderazgo, va a "Por confirmar".
   - **Salario**: si el aviso publica un máximo menor al pedido en la misma moneda (por mes; año ÷ 12, hora × 160), se excluye.
   - **Función**: video, diseño, contenido, comunidad y SDR son otro trabajo aunque compartan área; se excluyen si no aparecen en los cargos, roles deseados u objetivo. No aplica en un cambio de carrera.
2. **Puntaje** ("Compatibilidad estimada", nunca probabilidad de contratación):
   - 40 % encaje de rol: el título contra los cargos del CV, los roles deseados y el objetivo (el objetivo cuenta por el título, no por palabras sueltas de la descripción). El área no suma puntos.
   - 25 % seniority: nivel del aviso contra el elegido o el que muestra el CV (cargo más alto, equipo a cargo); penaliza por debajo y por encima.
   - 20 % requisitos críticos: obligatorios 85/15 con deseables; "IA", "ecommerce", "marketing digital" y "comunicación" pesan un cuarto; años pedidos vs. años en el CV.
   - 15 % preferencias: modalidad, contrato, salario y idiomas.
   - Tope: si el encaje de rol es menor a 0,5, el total no pasa de 40 %.
   - Nivel o salario sin informar cuentan 50 %: un aviso sin el dato nunca supera a uno que cumple. Las demás dimensiones ausentes se omiten y se reponderan. Cada aviso devuelve `breakdown` con los puntos y la razón de cada componente.
3. **Confianza** ("Información amplia / parcial / escasa"): baja cuando faltan habilidades, seniority, preferencias relevantes o descripción completa. La información ausente del aviso no se convierte en un incumplimiento. Un requisito publicado que no aparece en el CV sigue siendo una brecha. Detalle, fórmulas y comparación controlada en [QC-MATCH-2026-10-17.md](QC-MATCH-2026-10-17.md).
4. **Explicaciones**: hasta 3 motivos con datos concretos del CV o del aviso. El primero es el encaje de rol y nivel (con el equipo a cargo, si el CV lo dice); modalidad, ciudad o país van como mucho una vez y nunca primero; "es del área que te interesa" ya no es un motivo; brechas que dicen "no aparece en tu CV" (nunca "no tenés"); pendientes como salario no informado, elegibilidad por confirmar u horario.
5. **Orden**: descartar con motivo saca la oportunidad y ajusta el orden (mismo rol → baja; "no quiero esta empresa" → excluye la empresa). Guardados, frescura, cambio de carrera y convocatorias abiertas también pueden cambiar el orden; no cambian el porcentaje de afinidad. Se conserva variedad de empresas y ocultamiento de avisos antiguos. El umbral mínimo no oculta búsquedas agregadas por la persona.
6. No se usan edad, foto, género ni otros atributos personales. El perfil del match sólo tiene cargos, habilidades, idiomas, años de experiencia y ubicación.

**Profundidad**: este ranking es básico (reglas + texto) y no usa IA ni credenciales nuevas. La evaluación detallada con IA de una búsqueda concreta ocurre al tocar "Preparar mi postulación", que reutiliza el coach existente (`/api/analyze` y `/api/generate`). La interpretación del CV reutiliza `/api/profile`.

## Privacidad y seguridad

- CV y preferencias: en el navegador y, con sesión, sincronizados a la cuenta en Redis; nunca dentro del inventario compartido ni en logs del ranking.
- Ningún dato personal se envía a las fuentes de vacantes (sólo hacemos GET públicos).
- Importación de URLs: sólo desde ATS admitidos y a hosts fijos de sus APIs; cualquier otro link pide pegar la descripción. `safeFetch`/`assertPublicUrl` bloquean protocolos no http(s), credenciales en la URL, puertos raros, redes privadas/loopback/link-local y redirecciones hacia ellas.
- Contenido de avisos: HTML convertido a texto plano; React escapa todo al mostrar.
- CVs y avisos se tratan como datos, nunca como instrucciones para el modelo (el coach de postulación ya los envuelve en etiquetas).
- Administración y sincronización protegidas: el panel exige sesión con un email de `ADMIN_EMAILS`; la sincronización no tiene endpoint público (corre en GitHub Actions).
- Eventos (`src/lib/match/events.ts`): Maru no tenía analytics; los eventos del flujo salen por `window.va` si en el futuro se instala Vercel Analytics, con una lista blanca de propiedades sin datos personales. No se tocaron píxeles ni conversiones.

## Pruebas

`npm test` incluye (con fixtures en `tests/fixtures/match`, separados del inventario real):

- conectores (Greenhouse, Lever, Ashby, Remotive, Jobicy, Get on Board) y reintentos con `Retry-After`;
- elegibilidad: US only excluido, LATAM elegible, remoto ambiguo por confirmar, zona horaria ≠ permiso, Córdoba (España) ≠ Córdoba;
- sincronización repetida sin duplicados, error de fuente sin cierre masivo, cierre tras 2 ausencias completas, feeds parciales, vencimientos, lock y checkpoints;
- deduplicación entre ATS y portal sin fusionar requisiciones distintas y conservando el enlace obligatorio;
- ranking con continuidad vs. cambio de carrera, indispensables, salario, confianza, descartes;
- privacidad: dos personas consultan y ninguna ve los datos de la otra; nada se escribe en el servidor;
- admin 401/403/200, SSRF y ausencia de proveedores pagos.

## Bloqueos y costos

- **Importación real**: el inventario gratuito ya fue poblado y sincronizado. La foto histórica del 16/10 tenía 6.439 grupos abiertos, 909 elegibles desde Argentina; recalcular si se necesitan números actuales. Las muestras pagas/trial siguen separadas y no se cargaron fixtures como avisos reales.
- **Get on Board**: no se pudo leer su referencia técnica; el conector valida el formato en la primera sincronización y, si no coincide, la fuente queda "fallida" sin afectar a las demás.
- **`ADMIN_EMAILS`** ya se configuró y se comprobó acceso al panel de Production después de PR #30; sólo revisar si cambia la cuenta o el entorno.
- **Persistencia entre dispositivos**: ya implementada por cuenta en Redis. Falta la comprobación real de edición/borrado entre dos dispositivos; no crear otra base por una nota histórica de este documento.
- **Costos que pueden subir**: la lectura de CV usa Claude (la misma llamada que ya usa Maru); el ranking no usa IA. Cada "Preparar mi postulación" dispara las llamadas existentes del coach. Hosting: un deploy diario por el commit del inventario y funciones de Vercel que leen un JSON de pocos MB. GitHub Actions: ~5 min por día de sincronización más el CI de los PRs.

## Próximas incorporaciones (por cobertura incremental esperada)

1. **Ampliar el directorio** con más empresas en Greenhouse/Lever/Ashby que contratan en Argentina (cada una suma decenas de avisos sin costo).
2. **SmartRecruiters Posting API** y **Workable** (API pública de avisos por empresa): muy usadas por corporaciones y empresas medianas de la región (comercio, consumo masivo, logística, servicios).
3. **Datos `schema.org/JobPosting`** de sitios corporativos argentinos que lo publiquen, sólo donde la reutilización sea compatible.
4. **Himalayas**, si autorizan por escrito el uso en Maru (aporta remoto global).
5. Enriquecimiento con IA de avisos nuevos o modificados (habilidades obligatorias/deseables) para mejorar la confianza, con tope por ejecución.
6. Alertas por email, después de validar inventario y consentimiento. El perfil por cuenta ya se guarda en Redis; no requiere crear otra base.
