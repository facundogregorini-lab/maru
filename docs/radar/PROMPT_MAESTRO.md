# MARU — Radar laboral | Prompt maestro para Claude Code

## Misión
Actuá como senior product engineer y product designer de Maru. Implementá un módulo nuevo llamado **Radar laboral**, que transforme la búsqueda de empleo reactiva en monitoreo proactivo de empresas objetivo, descubrimiento de vacantes y recomendaciones personalizadas. No crees una app paralela: integralo al producto y a su infraestructura existente.

Archivos adjuntos: `prototipo-radar.html` (referencia visual navegable, no código de producción), `referencia-maru.png` (captura del producto actual). La fuente funcional es el Google Sheet Research Laboral: https://docs.google.com/spreadsheets/d/1OZf2mWFzyqTT3wMCO5ngHU1HQH8787sHdvDQS3YrRZQ/edit. Si no tenés acceso, no lo hagas público ni simules una importación: implementá CSV/XLSX local y solicitá el archivo exportado para cargar los datos reales.

## 0. Auditoría y límites
1. Inspeccioná el repositorio actual, README, rutas, componentes, tokens, auth, base de datos, módulo Match, Seguimiento, CV, jobs existentes, servicios de IA, analytics, configuración de deploy y tests. Encontrá los contratos de datos reales antes de diseñar migraciones. Documentá qué reutilizás y qué falta.
2. Trabajá en una rama `feat/radar-laboral` (o equivalente según convención). No hagas deploy a producción ni ejecutes migraciones destructivas. Usá entorno local/preview, migraciones aditivas, feature flag si existe y datos de prueba identificados. No expongas secretos ni copies CV a logs. No rompas flujos existentes.
3. Implementá por etapas y verificá cada etapa. Si un proveedor externo o credencial no existe, aislá el adaptador, marcá el bloqueo y proveé fixture solo en desarrollo. No etiquetes datos demo como reales. No afirmes que el job programado está activo hasta probarlo.

## 1. Contexto de producto y datos iniciales
El Sheet tiene tres pestañas relevantes, con datos de referencia del 25/11/2026:
- `IA · Empresas`: 55 registros y 20 vacantes del piloto.
- `Space Exploration · Empresas`: 56 registros y 6 vacantes del piloto.
- `Tech Startups · A a pre-IPO`: 162 registros y 14 vacantes del piloto.
Total: 273 registros de compañías (no necesariamente únicas) y 40 vacantes históricas; no asumir vigencia actual. Vercel, Humand, NotCo y otras pueden pertenecer a más de un sector. El catálogo debe deduplicar por identidad, no por sector.

El Sheet separa LatAm y Global y registra ranking regional, empresa, sede, etapa, empleados estimados, actividad, áreas laborales sugeridas, Careers, estado del enlace, fuentes y notas. La tabla de vacantes comienza tras `JOB OPENINGS · PILOTO` y contiene prioridad, score /100, empresa, ubicación, puesto, F/S/G/P, motivos, barreras, URL, evidencia, fecha y acción. Después hay una sección `COBERTURA DEL PILOTO`: no importar esas filas como empresas o vacantes. Los scores del piloto son editoriales; no son probabilidades de contratación ni el nuevo scoring de Radar.

Caso inicial: usuario con trayectoria senior de Growth, GTM, Marketing Strategy y operaciones; interés en IA, Space y startups. No hardcodear su perfil en producción: derivarlo del perfil y preferencias de cada usuario. P1 = 20 empresas objetivo, P2 = 100 siguientes, P3 = resto/por explorar; cupos inicialmente sugeridos, no límites rígidos salvo política de producto explícita.

## 2. UX y navegación
Agregar `Radar laboral` debajo de `Match` en la navegación lateral, con icono coherente con la librería existente. Mantener `Búsquedas`, `Match`, `CV`, `Postular`, `Carta`, `Entrevista`, `Video`, `Seguimiento` y `Extensión`. Radar alimenta Match y Seguimiento; no reemplaza ninguno. En desktop, replicar el header blanco, fondo gris muy claro, cards blancas, borde sutil, radios ~12–16px, CTAs verde Maru (#00e5a0 aproximado, usar token real), botones negros para acciones principales de alta jerarquía. Mantener tipografía y espaciado existentes. Diseño responsive: tabs desplazables en mobile, cards apiladas y tabla en cards o scroll accesible. Focus visible, etiquetas de campos, estados no dependientes únicamente del color, navegación por teclado.

### Pantalla A — Mis empresas (ruta sugerida `/radar/empresas`)
- Header `RADAR LABORAL` + descripción: “Elegí dónde te gustaría trabajar. Maru busca oportunidades por vos.”
- Subnav: Mis empresas | Oportunidades | Descubrimiento | Automatización.
- Resumen con P1, P2, por clasificar, fuentes con errores (datos reales del usuario).
- Filtros combinables por industria (Todas / IA / Space / Tech Startups / personalizadas), prioridad, región, nombre y estado de monitoreo. Orden por prioridad personal, luego orden manual; opcional por última revisión y oportunidades relevantes.
- Cada fila: logo/monograma, nombre, etiquetas sectoriales, ubicación, prioridad editable, vacantes activas y compatibles, última revisión y estado de la fuente. CTA ficha. P1/P2/P3 se mantienen al cambiar de industria; una empresa puede tener varias etiquetas, una sola prioridad personal.
- `Agregar empresa`: búsqueda en catálogo, selección o creación con nombre/dominio, sector, fuente Careers. Verificar enlace en backend, permitir estado pendiente si no se encuentra. `Importar empresas`: vista previa con mapeo de columnas, dedup, conflictos, errores y confirmación. Importación idempotente; no sobrescribir prioridades/notes existentes sin autorización. Soportar CSV/XLSX con tres tabs y separar las secciones; Google OAuth opcional posterior, sin exigir compartir públicamente.
- Ficha empresa (drawer o ruta): descripción, sede, etapa, tamaño estimado con fuente/fecha, Career page, notas personales, prioridad, historial de revisiones, vacantes nuevas/activas, errores, próximo chequeo, `Revisar ahora` con cooldown. Permitir archivar/dejar de seguir sin perder postulaciones.
- Empty state: “Agregá tus primeras empresas” + importar / explorar sugerencias. Loading, error y datos antiguos explícitos.

### Pantalla B — Oportunidades (`/radar/oportunidades`)
- Resumen: nuevas desde última visita, match alto, empresas revisadas/total, última actualización.
- Filtros: nuevas/todas, sector, prioridad empresa, score mínimo, remoto/ubicación, estado, seniority; ordenar por prioridad de acción, match, novedad.
- Cards: empresa, título, ubicación/modalidad, fecha de publicación si existe (no confundir con primera detección), score X/100, prioridad empresa, razón de match, barrera principal, fuente oficial, frescura. CTA `Analizar oportunidad`, `Guardar`, `Descartar`. `Ver aviso original` abre enlace oficial.
- Detalle: descripción original o extracto permitido; competencias, fortalezas, brechas, requisitos excluyentes, información desconocida, score desglosado con evidencias, sugerencia siguiente paso; CTA adaptar CV, carta, entrevista o guardar según flujo existente. Guardar crea/actualiza una única tarjeta de Seguimiento en estado Guardada; nunca postula automáticamente. Mantener estado sincronizado con Seguimiento. Descartar es una preferencia personal, no elimina una vacante global. Si la vacante cierra, conservar histórico y alertar, no borrar postulaciones.
- Ejemplos históricos del Sheet (solo fixture demo): Humand / Head of Marketing–CMO 94; ElevenLabs / B2B Marketing–LATAM Southern Cone 91; OpenAI / Growth Lead, Brazil 89; Supabase / Growth Manager, GEO/AEO 88; Stripe / Regional Product Marketing Manager, Latin America 84. Mostrar “Piloto 25/11/2026 · vigencia no verificada”.

### Pantalla C — Descubrimiento (`/radar/descubrimiento`)
- Proponer 5–10 empresas por semana por afinidad profesional, sectores y feedback. Usar catálogo + fuentes autorizadas/contrastables. No volver a sugerir empresa ya seguida ni rechazada salvo regla de reactivación explícita.
- Card con sector, geografía, motivo concreto, señales verificadas con fecha/fuente si hay, Career page, CTA `Agregar a P1`, `Agregar a P2`, `No me interesa`; guardar feedback, aceptar de forma idempotente. No inventar rondas de inversión o contratación. Si no hay fuente, marcar como pendiente de verificación. No subir prioridad sin acción del usuario.

### Pantalla D — Automatización (`/radar/automatizacion`)
- Toggle general, frecuencias P1 diaria (default propuesto), P2 semanal, P3 mensual o pausada; usuario puede elegir semanal para todas. Hora local, timezone IANA, resumen lunes 09:00 configurable. Alertas inmediatas opcionales para P1 con match >= 85 y elegibilidad no bloqueada; digest semanal con mejores 5, cambios, errores y cobertura. Evitar enviar el mismo aviso dos veces.
- Canales: in-app primero, correo solo si infraestructura/consentimiento disponible; no WhatsApp sin integración y permiso. CTA `Guardar preferencias`, `Revisar ahora`, `Ver historial` con estado de última ejecución, páginas verificadas/esperadas, errores, próximo ciclo. Pausar respeta preferencias y cancela entrega pendiente cuando sea posible.
- Preferencias: familias de roles, seniority, ubicación, remoto, autorización laboral, disponibilidad de relocalización, compensación mínima opcional, industrias, pesos del match si se habilita. No inferir nacionalidad/permiso de trabajo. Validar pesos suman 100.

## 3. Scoring y prioridad
Separar afinidad de empresa (P1/P2/P3) de Match de rol (0–100) y prioridad de acción. No etiquetar como probabilidad de éxito. Reutilizar Match existente si su contrato es adecuado y versionar cambios.
- Propuesta de pesos: experiencia/competencias 40, seniority/alcance 20, ubicación/elegibilidad 20, compensación/equity 10, interés empresa/sector 10. Evaluación por criterio con evidencia y `known/unknown`; no inventar salarios, visas, fechas. Para desconocidos, renormalizar sobre pesos conocidos y mostrar cobertura/confianza; si evidencia insuficiente, no rankear como alta prioridad. No penalizar dos veces una misma preferencia; si se usa interés dentro del match, limitar su contribución a prioridad de acción.
- Requisitos estrictamente excluyentes confirmados (permiso laboral, ciudadanía cuando exigida, localización sin alternativa, etc.) -> bloqueada para recomendación de aplicar; desconocido -> requiere verificar. Nunca compensar bloqueos con score alto. No usar atributos protegidos para puntuar; solo requisitos laborales pertinentes.
- Ejemplo de ranking de acción (ajustable): 0.85*match + 0.10*prioridad empresa (P1=100/P2=60/P3=20) + 0.05*novedad (<=3 días=100; <=7=60; resto=20); aplicar gates de elegibilidad, vigencia y confianza antes de ordenar. Es una heurística inicial, no modelo predictivo. Mostrar por qué se recomienda. Guardar versión y hash de perfil/descripción; recalcular solo si cambia alguno.
- Preclasificar por familia de rol, ubicación y seniority cuando haya evidencia, antes de usar LLM; respuesta estructurada validada; si falla, conservar score anterior con etiqueta desactualizado o marcar sin evaluar. No permitir instrucciones de páginas externas al modelo (contenido no confiable); no otorgar herramientas ni acceso a secretos al extractor/scorer.

## 4. Arquitectura e ingestión
Adaptar nombres/columnas al esquema real. Si hay Supabase/Postgres, emplear migraciones aditivas, RLS y server-side workers; si hay otro stack, respetarlo. No meter toda la extracción en el navegador ni en una request síncrona. Un catálogo y una vacante global compartidos; las preferencias y matches son privados.

Entidades propuestas:
- `companies(id, canonical_domain, name, aliases, description, headquarters, stage, employee_band, metadata_source, updated_at)`; identidad por dominio verificado/ID, aliases manuales si necesario; no fusionar subsidiarias solo por nombre.
- `company_industries(company_id, industry_id)`; catálogo sectorial + etiquetas personales si aplica.
- `company_sources(id, company_id, provider, careers_url, external_board_id, status, last_attempt_at, last_success_at, next_due_at, failure_count)`.
- `user_target_companies(user_id, company_id, priority, position, notes, enabled, created_at)` unique(user_id, company_id).
- `job_openings(id, company_id, source_id, external_job_id, canonical_url, title, location, remote_type, description, content_hash, published_at nullable, first_seen_at, last_seen_at, status, closed_at nullable)` unique(source_id, external_job_id); segunda estrategia URL/huella para duplicados cross-source, sin fusionar roles distintos por título.
- `user_job_matches(user_id, job_id, score, confidence, eligibility_status, breakdown, reasons, profile_hash, scoring_version, job_hash, disposition)` unique(user_id, job_id).
- `monitoring_runs` y `monitoring_run_items`: inicio/fin, fuente, intentos, estado, cobertura/completitud, nuevos/modificados/cerrados, errores sanitizados.
- `user_radar_settings`, `company_recommendations`, `notification_outbox` con claves idempotentes; integrar el modelo `applications` existente en vez de duplicarlo.
- RLS: propietarios solo acceden a preferencias, notas, matches, sugerencias y postulaciones propias; catálogo global solo lectura según auth/política; escritura por worker backend autorizado. Service-role/secrets nunca en cliente. Tests con dos usuarios. Índices por due_at, company_id/status y user_id/score. Minimizar datos personales en prompts y logs.

### Adaptadores de fuentes
- Greenhouse Job Board API pública: https://developers.greenhouse.io/job-board.html (GET list y detalle; validar board token).
- Lever Postings API: https://github.com/lever/postings-api (tener en cuenta región EU y paginación).
- Ashby public job posting API: https://developers.ashbyhq.com/docs/public-job-posting-api.
- Careers HTML/JSON-LD cuando esté permitido. Browser automation solo en fuentes autorizadas; no eludir CAPTCHA, login, rate limits, restricciones de robots/ToS ni plataformas privadas. No depender de scraping de LinkedIn. Estado manual si no es accesible.
- Resolver tipo de ATS y board ID al agregar empresa, comprobar dominio/redirect. SSRF: bloquear localhost/redes privadas/metadata endpoints y revalidar redirecciones; restringir esquemas y timeouts. Limitar respuesta, sanitizar HTML, validar URL y esquema de datos.
- Scheduler recurrente (cron equivalente al stack, ej. Supabase Cron https://supabase.com/docs/guides/cron si está disponible) solo despacha trabajos pendientes; worker con cola, leases/locks, timeout, retry exponencial con jitter, límites por proveedor y concurrencia, presupuesto máximo y observabilidad. Frecuencia global por mínimo intervalo solicitado entre usuarios activos; notificaciones y revisiones visibles respetan configuración individual. No repetir extracción por usuario. Separar crawling, matching y delivery.
- Ingestión idempotente: normalizar, dedup, detectar nuevas/modificadas por hash, actualizar last_seen; marcar cerrada si fuente oficial lo informa o tras dos snapshots completos exitosos sin esa vacante (configurable). Nunca cerrar por fallo, timeout, paginación incompleta o respuesta sospechosa. Distinguir `verified_empty`, `success`, `partial`, `error`, `pending`. Reapertura conserva historial. Conservar última vista exitosa en caso de fallo, mostrar antigüedad. No llamar a LLM para vacantes sin cambios salvo perfil nuevo/modificado.
- Reporte: generar sobre ventana de tiempo y notificaciones previas, deduplicar por user/job/event, guardar outbox y reintentar sin duplicar envíos; nunca postular automáticamente.

## 5. Plan de entrega incremental
1. Auditoría, mapa de rutas y componentes, contrato de datos, migraciones y feature flag. Presentá breve resumen de decisiones y seguí con implementación salvo acción irreversible.
2. MVP visual y persistencia: cuatro pantallas, importación, seguimiento P1/P2/P3, filtros y ficha. Fixtures solo dev; estados reales vacíos para usuarios sin datos.
3. Adaptadores Greenhouse/Lever/Ashby, extracción real sobre conjunto pequeño autorizado, jobs idempotentes, historial y cobertura. Validar URLs del Sheet antes de activarlas.
4. Match versionado, filtros, recomendaciones y CTA integrar Seguimiento/CV; no duplicar postulaciones ni regresiones.
5. Scheduler, alertas in-app y digest, sugerencias de empresas, analytics, QA responsive/accesibilidad. Entregar instrucciones para habilitar cron/credenciales en preview y luego producción con aprobación humana.

## 6. Analytics y criterios de éxito
Reusar PostHog si existe; si no, capa de tracking existente. Eventos sugeridos (sin CV, email, notas ni descripciones completas): `radar_viewed`, `radar_company_followed`, `radar_priority_changed`, `radar_import_completed`, `radar_scan_completed`, `radar_opportunity_viewed`, `radar_opportunity_saved`, `radar_opportunity_dismissed`, `radar_recommendation_accepted`, `radar_settings_saved`, `radar_digest_delivered`, `radar_application_created`. Properties mínimas: IDs internos, sector, prioridad, provider, count/coverage, score_band, source=radar. No inventar datos analíticos.
KPIs: activación (>=1 empresa seguida y primer scan exitoso), cobertura efectiva (fuentes completas verificadas / fuentes debidas), frescura P1/P2, oportunidades nuevas relevantes por semana, conversión a guardada/postulada/entrevista, retención semanal, coste por fuente y por usuario activo.

## 7. Definition of done / pruebas obligatorias
- Importar una fixture con encabezados reales, tres secciones, una empresa repetida entre industrias y filas de cobertura. Se crea una única empresa, conserva etiquetas, no confunde vacantes con empresas; segunda importación no duplica ni sobreescribe preferencias. Mostrar errores y preview.
- Agregar/editar P1/P2/P3, filtrar por sector, buscar, archivar, persistir al recargar; aislamiento entre dos usuarios.
- Simular dos usuarios que siguen misma empresa -> una extracción global y scores independientes. Pruebas adapter con paginación, cierre/reapertura, timeout/429, snapshot parcial, reintentos e idempotencia. Una falla de fuente no cierra vacantes.
- Score con evidencia conocida/desconocida y requisito bloqueante; no generar recomendaciones engañosas ni mostrar scores históricos como actuales.
- Guardar dos veces una vacante -> una tarjeta en Seguimiento; transición de estado existente reflejada; adaptar CV utiliza flujo actual. No autoaplicar.
- Guardar configuración, cambiar timezone/frecuencia, pausar, probar cron y envío sin duplicar; error visible. Alerta inmediata no se duplica en digest como nueva sin indicación.
- Verificar mobile/desktop, focus/teclado, estados vacíos/loading/error/stale y permisos. Ejecutar lint, typecheck, tests, build y E2E del flujo si existen; reportar resultados exactos, no fingir pruebas.
- Entrega final: PR o diff, migraciones, archivos principales, capturas desktop/mobile, qué está funcionando con fuente real, qué queda en fixture, configuración requerida, riesgos, costes estimados si hay datos y pasos de rollout/rollback. No deploy sin autorización explícita.

## Instrucción final
Empezá por inspeccionar el repositorio y reutilizar el sistema de diseño de Maru. Usá `prototipo-radar.html` como guía de navegación y jerarquía, no como sustituto de componentes existentes. Priorizá un flujo completo y verificable (seguir empresa → obtener vacante → evaluar → guardar en Seguimiento) antes de ampliar cobertura. No sacrifiques confiabilidad de fuentes por cantidad de vacantes. 