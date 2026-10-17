# Estado y próximos pasos de Maru

## Escritura con Slop Monstruo (17/10/2026)

**Publicación pendiente por cuota de Vercel:** PR #75 (home y CTA) está en Production. La preview de PR #76 fue rechazada con `Deployment rate limited — retry in 24 hours` (`build-rate-limit`). El código de escritura tiene CI de GitHub aprobado. No afirmar que ya está activo para usuarios hasta ver un deployment Ready del commit de main que incluya PR #76.

Próxima acción al liberarse la cuota: redeployar el último `main`, confirmar Ready y aliases de `www.marucoach.com`, y generar una carta y un guion con datos ficticios. Verificar idioma, hechos y longitud, y correr el checker sobre los resultados. No cambiar el plan de Vercel ni las claves para esto.

- Fuente en español fijada y licenciada, skill instalada y adaptación de servidor para todos los planes. Política común en las 14 rutas de redacción; extracción literal excluida.
- Checker de prosa y una revisión condicional por pedido, con guardias de cifras, siglas, links, campos permitidos, longitud y esquema. Timeout o error conserva la generación válida; no usa cuotas extra del usuario ni sesiones CLI. La segunda familia de modelos de la skill no está implementada online. Detalles y límites: `docs/ESCRITURA.md`.
- Corregidos los laureles “100% gratis” en las landings de herramientas y la FAQ de entrevista que decía un pedido por mes en vez de por semana. Se muestran los límites de los planes.
- Validación: 340 tests aprobados (14 de escritura), 7 omitidos; TypeScript y ESLint sin errores. El smoke test con cartas y guiones del proveedor real queda pendiente del deploy. No se reescriben documentos ya guardados.

## Home y recorrido hacia las herramientas (17/10/2026)

- Quitados el selector Web/Extensión y la franja repetida de descarga. La extensión queda en Herramientas; se agregó también la entrevista al menú.
- Home revisado por bloques: presentación y dos entradas claras (Match y catálogo), cifras con alcance geográfico, buscador sin CV, muestra estática de avisos, recorrido y ocho herramientas, preguntas frecuentes y cierre. Se quitaron laureles, estadísticas ajenas presentadas como resultados y carruseles que repetían información. Los ejemplos siguen rotulados.
- Las cifras ahora excluyen avisos de más de 120 días y sin enlace, como el catálogo visible; se agregó regresión. Las modalidades inferidas se identifican.
- CTA principal de Match, tarjetas del catálogo y detalle: **Postulación personalizada**, verde, con el aviso precargado. La fuente queda como enlace secundario **Ver aviso original**. Abrir una fuente ya no marca una postulación como enviada: ese estado lo confirma la persona en Seguimiento.
- Se explicitan límites del plan gratis y condiciones del feedback de cámara; las FAQ reflejan sincronización, Google y frecuencia por fuente. No se cambiaron planes, cuotas ni pagos.
- Revisión editorial con Slop Monstruo en español: copia visible del home 5/5, sin tomar ese puntaje como validación factual. La revisión adicional con la CLI de Claude no estuvo disponible: su sesión OAuth local venció; no se aceptó ninguna salida como texto editado.
- QC: menú de herramientas y Escape, lectura móvil, FAQ del plan gratuito y ausencia de desborde horizontal. Evidencias y validación final en `docs/QC-HOME-2026-10-17.md`.


## QC y porcentaje de Match (17/10/2026, PR #71)

- **Seguimiento de objetivos en texto libre:** se detectó que “inteligencia artificial” no reconocía AI y que un objetivo corto se diluía contra toda la lista de requisitos. Corregido con equivalencias de frases y cobertura del objetivo por evidencia: título > requisito > deseable > mención de contexto. Director/Head/Founder son genéricos y ya no justifican experiencia directa en otra especialidad. Cuatro regresiones adicionales; no se modificaron preferencias reales de la cuenta.
- Calibración pedida por el dueño: quitar la doble penalización de intención y los topes 95/98; datos ausentes afectan confianza, sin asignarles 50%. Roles contenidos en títulos largos, equivalencias locales y deseables con peso limitado. La antigüedad de una persona no implica Lead.
- Afinidad separada del orden: guardados, descartes y frescura mantienen el ranking sin alterar el porcentaje. Se preservan las mejoras hasta PR #70, incluidos ubicación, elegibilidad, variedad de empresas, idioma y ocultamiento a 120 días. Las búsquedas agregadas por la persona no desaparecen por el umbral de coincidencia mínima.
- Regresión reproducible con cinco perfiles ficticios sobre el mismo catálogo: [decisiones, muestra y resultados](QC-MATCH-2026-10-17.md). Máximos administración 82→100, ventas 95→100, datos 91→92, marketing junior 74→85, operaciones 93→88 (baja al corregir ciudad/provincia). Son pruebas de coherencia, no validación de contrataciones.
- QC visual detectó que Mar del Plata, Provincia de Buenos Aires se presentaba como la ciudad de Buenos Aires. Corregida esa comparación, con regresiones de formatos y alias CABA/Capital Federal. Guardar, preparar postulación y cambiar estado en seguimiento comprobados en preview, con datos ficticios.
- Bug del editor CV/carta corregido: guardar mientras escribe, conservando el cursor y Escape. Antes se perdía la última edición si recargaba sin salir del campo.
- Idioma sin nivel corregido: queda por confirmar, sin dar por cumplido inglés avanzado ni excluir por un nivel desconocido. La confianza refleja años de experiencia desconocidos y salario no comparable.
- QC completo de postulación (CV y ocho campos, sin inventar disponibilidad/salario), entrevista (4 preguntas + 3 repreguntas, informe 70 conservado al recargar) y Match móvil a 390 px sin desborde. Límites y mejoras menores documentados en el registro.
- Ver el registro de QC en ese documento para distinguir esta pasada de la anterior y sus limitaciones. No repetir importaciones de proveedores para validar el ranking: `scripts/match-calibration.ts` usa el inventario local.

Actualizado el 16/10/2026 (noche: importación de avisos, ver "Avisos: qué falta"). Las PR #23 (cuentas, sincronización y planes), #24 (teleprompter, cámaras y perfil en texto), #26 (piloto Apify y calidad de avisos), #27 (panel privado de proveedores), #29 (muestras y fechas SerpAPI) y #30 (allowlist admin) ya están integradas en `main`. El login Google de la PR #22 está preservado. Los pilotos siguen separados del inventario público; no se activaron consumos recurrentes.

## Calidad de avisos: plan en curso (desde 17/10/2026)

Regla de trabajo pedida por el dueño: **cada avance se mergea a `main` y se anota acá**, para que otra sesión pueda seguir si se cortan los tokens. Diagnóstico de partida (17/10, sobre 3.966 oportunidades elegibles):
- 22% en "Otros";
- 46% sin seniority;
- 39% sin modalidad;
- 14,5% con más de 60 días (todas de ATS gratuitos);
- 2.854 importados nunca revisados por liveness;
- "Córdoba, España" figuraba como elegible.

| # | Paso | Estado |
| --- | --- | --- |
| A | Clasificación: familias nuevas (Industria y oficios, Gastronomía y hotelería, Comercio y retail, Seguridad, IA e idiomas por proyecto), reglas corregidas y seniority de oficios | **Hecho** (ver abajo) |
| B | Elegibilidad: el país antes que la ciudad (Córdoba, España), provincias del interior y ciudades del exterior | **Hecho** (ver abajo) |
| C | Frescura: ranking por antigüedad (bajar >60 días, ocultar >120) y liveness rotativa de todos los importados | **Hecho** (ver abajo) |
| D | Modalidad: "presencial (inferido)" en portales locales con ciudad y sin mención de remoto | **Hecho** (ver abajo) |
| E | Métricas de calidad en `match:report` y presentación (empresa confidencial, consultoras, sufijos de ciudad en el título) | **Hecho** (ver abajo) |
| F | Google Jobs mensual automático (gratis) | **Siguiente**: lo decide el dueño |

**A (hecho):** `EXTRACTION_VERSION` 6. Por título, "Otros" baja de 4.404 a 1.327 publicaciones abiertas, y en elegibles de 956 a 242. La sync diaria re-analiza todo con las reglas nuevas.
- Las familias nuevas suman 2.290 publicaciones abiertas: 1.769 de IA e idiomas, 261 de industria y oficios, 126 de comercio, 94 de gastronomía y 20 de seguridad.
- Lo que queda en "Otros" son títulos sin área clara ("Manager", "Specialist", "Principal").
- Se revisaron a mano los 319 títulos que cambiaron de área y se corrigieron los errores (inmobiliario, personas, ingenieros de procesos).

**B (hecho):** `EXTRACTION_VERSION` 7. Sobre las 13.372 publicaciones abiertas, la elegibilidad queda así:

| Estado | Antes | Después |
| --- | ---: | ---: |
| Elegibles | 4.202 | 4.290 |
| Por confirmar | 1.027 | 619 |
| No elegibles | 8.143 | 8.463 |

- Pasan a elegibles 90 publicaciones del interior que no decían "Argentina" (Resistencia, San Luis, Corrientes, Comodoro Rivadavia, Santiago del Estero…).
- Pasan a no elegibles 327 de ciudades o países del exterior que no se reconocían (Auckland, Atenas, Budapest, Dubái…).
- Una ciudad de nombre repetido (Córdoba, Rosario, San Juan…) ya no cuenta como Argentina si la fuente informa otro país donde existe o el título lo nombra.
- Los 619 "por confirmar" que quedan son casi todos "remoto sin región" (679 antes). Su antigüedad se trata en el paso C.

### Cómo seguir (para la próxima sesión)

**C (hecho, 17/10):**
- `src/lib/match/ranking.ts` exporta `HIDE_AFTER_DAYS` (120), `STALE_AFTER_DAYS` (60) y `ageDays(o, now)`. El Match no ofrece avisos de más de 120 días, salvo los guardados, y baja ×0,85 los de más de 60. Reemplaza el castigo anterior (>180 ×0,85, >90 ×0,93).
- `searchJobs` (`/busquedas`) tampoco los lista. La página de detalle sigue andando para quien tenga el link.
- Revisión de vigencia (`src/lib/match/liveness.ts`):
  - turna entre fuentes con `roundRobin`;
  - tiene un tope de tiempo (`budgetMs`);
  - el workflow corre `--max=400 --budget-min=8` con `timeout-minutes: 40`.
- Los tests usan fechas fijas (`NOW` y `vi.useFakeTimers` en `match-api`), así no se rompen cuando los avisos de prueba envejezcan.
- Medición con el inventario commiteado al 17/10, antes de la sync con reglas nuevas:
  - de 3.683 elegibles, 489 tienen más de 60 días;
  - 306 tienen más de 120 y quedan ocultas, todas de ATS gratuitos que las siguen publicando (Lever 162, Greenhouse 74, Ashby 46, Teamtailor 22, Get on Board 2).
  - Si el dueño prefiere mostrar esas búsquedas "siempre abiertas", alcanza con subir `HIDE_AFTER_DAYS`.
- Queda abierto: Computrabajo sigue salteada por `blockedSources`. Desde la nube de Claude no hay red para investigar por qué.

**D (hecho, 17/10):**
- `withWorkplace` (`src/lib/match/inventory.ts`) marca `presencial` con evidencia "inferido: <ciudad> sin mención de remoto". Lo hace en `serpapi`, `apify-computrabajo`, `apify-indeed` y `apify-linkedin`, cuando el aviso:
  - tiene una ciudad concreta, es decir, no sólo "Argentina", "Remoto" o "Desde casa";
  - y ni el título, ni la ubicación, ni el texto mencionan remoto, híbrido, home office, teletrabajo, mixto o virtual.
- `isInferred()` vive en `labels.ts` y se puede usar en el navegador.
- Cómo se usa lo inferido:
  - Se muestra como "Presencial (inferido)" en `/busquedas` y en el Match.
  - En el Match cuenta para ordenar, pero no para excluir con el indispensable de modalidad: queda como "no informa la modalidad".
  - Al agrupar, una modalidad que declara el aviso le gana a una inferida.
- Medición, simulando la sync con las reglas nuevas sobre el inventario commiteado:
  - en elegibles, "sin modalidad" baja de 1.552 a 199 y 1.415 pasan a inferidas;
  - por fuente, son 652 de Google Jobs, 530 de Computrabajo, 249 de LinkedIn y 79 de Indeed.
- Los importados se re-analizan solos en la próxima sync (`refreshImported`), porque la modalidad entra en el hash.

**E (hecho, 17/10):**
- **Métricas:** `npm run match:report` imprime una línea "Calidad" y guarda `quality` en el JSON.
  - Mide sobre los grupos elegibles: % en "Otros", sin modalidad (y cuántas inferidas), sin seniority, con más de 60 días, ocultas por más de 120, empresa confidencial y consultora.
  - También cuenta los grupos "por confirmar".
  - Con el inventario commiteado da: "Otros" 5,6%, sin modalidad 41,4% (sin re-analizar todavía con D), sin seniority 45,1%, más de 60 días 12,3%, ocultas 7,4%, confidencial 4,9% y consultora 12,8%.
- **Empresa confidencial:** `isGenericCompany` y `displayCompany` en `labels.ts`.
  - Muestra "Empresa confidencial" para "Importante empresa del sector…", "Confidencial" y similares.
  - No marca empresas reales como "La Anónima" o "Sociedad Anónima".
  - Esos avisos no se agrupan entre sí.
- **Consultora:** `isConsultora` cubre Adecco, Manpower, Randstad, Bayton, Grupo Gestión, ADN, Consultores de Empresas, Michael Page, servicios eventuales, etc.
  - Se ve como la etiqueta "Consultora" (`src/components/busquedas/CompanyName.tsx`) en las tarjetas de búsquedas, en el detalle y en el Match.
- **Sufijos de lugar:** `baseTitle` en `group.ts` saca del título el lugar pegado al final, como " - Rosario", "(Argentina)" o " – Zona Norte". Toma los lugares de una lista o de las ubicaciones del aviso.
  - La modalidad no se recorta, porque "(Remoto)" y "(Híbrido)" son búsquedas distintas.
  - Los grupos visibles pasan de 9.752 a 9.527 (225 casi-duplicados menos). Los ids viejos siguen andando como alias.

**Pulido de títulos (hecho, 17/10):** `displayTitle` (`labels.ts`) muestra los títulos:
- sin códigos internos ("Ref. 21518:", "(req208687)", "ID89121");
- con la primera letra en mayúscula;
- y sin gritar si vinieron todos en mayúsculas, conservando siglas como CABA o B2B.

Se usa en `/busquedas`, el detalle, el Match y la home. Para buscar y agrupar se sigue usando el título original. Al 17/10 había unos 300 títulos abiertos con ese ruido.

**Seniority:** el 45% de los grupos elegibles no la tiene, y casi todos son avisos que no la dicen ("Vendedor", "Asesor comercial"). No se infiere, para no adivinar.

**Auditoría del Match (17/10):** corrí los 8 perfiles de E0 (`docs/research/e0-2026-10-16/perfiles.json`) contra el inventario sincronizado y corregí lo que salía mal:
- "Para vos" contaba todos los avisos elegibles (3.443), aunque fueran de otra área con 5% de coincidencia. Ahora sólo lista los que llegan a `MIN_SCORE` (25%) y quedan entre 85 y 678 por perfil. El resto se cuenta en `counts.lowMatch` y la pantalla explica cómo verlos: filtrando por área se muestran igual.
- La ciudad se compara por partes (`placeSegments` y `samePlace`): "Rosario de Lerma" (Salta) ya no cuenta como Rosario. La ciudad de la persona es lo que va antes de la coma.
- Avisos de "Confidencial" duplicados: con el mismo nombre genérico, el mismo título y el mismo lugar, se juntan.
- El % nunca es 100: el tope es 98, o 95 si falta información.
- Ubicaciones (`displayLocations`):
  - sin repetir el mismo lugar escrito distinto;
  - sin "Argentina" suelto si hay una ciudad;
  - "Remoto desde Argentina" cuando es elegible y remoto pero las ubicaciones no lo dicen.
- "Desde casa" o "Remote" como ubicación ahora cuenta como modalidad remota.
- Nuevo motivo: "Es en <ciudad>, donde buscás".
- `/busquedas`: la búsqueda por texto incluye el lugar ("vendedor córdoba").
- Sin cambiar: la seniority que falta no se infiere. Logística y datos junior siguen con poca oferta, y ahí el problema es de adquisición, no de ranking.

**F.** Google Jobs mensual: lo decide el dueño (ver "Próximos pasos", punto 1).

**Después de cada merge:** correr el workflow `match-sync` a mano (Actions → match-sync → Run workflow) para re-analizar el inventario con `EXTRACTION_VERSION` 7. Si no, se hace solo en la sync diaria de las 9:17 UTC.

## Próximos pasos (17/10/2026, cierre de la base de avisos)

Estado: **13.128 oportunidades abiertas, 3.683 elegibles desde Argentina, 1.505 empleadores con elegibles** (E0: 909 grupos y 90 empleadores).
- Gasto total en APIs: **US$4,56**, todo en Apify. Fantastic usó el trial y Google Jobs el plan gratuito.
- ~70% de las publicaciones elegibles vienen de las APIs.
- Gasto, avisos por fuente, verticales y duplicación en [research/proveedores-2026-10-17](research/proveedores-2026-10-17/README.md). Para recalcularlo: `npm run match:report -- --apify-real-usd=<uso real>`.

En orden de impacto:

1. **Google Jobs todos los meses** (gratis). Sus avisos vencen a los 21 días sin volver a verse: sin esta corrida se pierden ~860 avisos elegibles. Correr `match-providers` con `provider=serpapi`, `--max-searches=80 --reserve=20` y las búsquedas que más rindieron (ver IMPORTACIONES, "Próximas corridas"). **Decisión del dueño:** si se agenda un cron mensual (no cuesta plata; usa sólo el plan gratuito y deja la reserva).
2. ~~**Clasificar "Otros"**~~ (hecho en el paso A de "Calidad de avisos"). Era: 3.645 publicaciones abiertas, 27%. En las APIs son oficios (chofer, mozo, operario, vigilador, electricista); en los ATS son puestos que el clasificador no reconoce. Sumar familias "gastronomía y hotelería", "seguridad", "oficios y producción" y revisar una muestra de los ATS. Mejora filtros por área y la medición por perfil.
3. **Apify: decidir presupuesto** (quedan ~US$0,44 del tope aprobado de US$5). Si se aprueba más, conviene Computrabajo:
   - es lo que más avisos elegibles nuevos trae (900, 6,6% duplicado), a ≈ US$0,003 por aviso;
   - Indeed es más barato (≈ US$0,0007) pero descarta 2 de cada 3 filas;
   - LinkedIn por Apify tiene 20% duplicado con otras fuentes.

   Sin presupuesto nuevo, los avisos de Apify vencen solos a los 30 días.
4. **No renovar Fantastic.** Su feed ATS se superpone 37% con otras fuentes (20% ya estaba gratis). Lo valioso fue descubrir empleadores para la sync gratuita (`providers-discoveries.json`), y eso ya se aprovechó.
5. **Modalidad desconocida** en 1.497 publicaciones elegibles (sobre todo Google Jobs, que casi nunca la informa). No se adivina; cada tarjeta lo avisa. Sólo mejora leyendo el aviso original o con una fuente que lo informe.
6. **Conectores Workable / Workday / SuccessFactors** (decisión del dueño, punto 2 de "Avisos: qué falta"). Es la forma de sumar empleadores argentinos generalistas sin pagar.
7. **QA en el producto** con navegador: búsquedas generalistas, logos, "vista hace…", detalle y destino original, en escritorio y celular.
8. **Tamaño del inventario:** 43 MB de 100 MB permitidos por GitHub. Si pasa de ~70 MB, recortar descripciones guardadas o mover a Vercel Blob.
9. **Seguridad:** rotar las claves pegadas en el chat del 16/10 y actualizar los secrets de GitHub y Vercel.

## Prioridad inmediata: próxima etapa de avisos

El dueño pidió un traspaso para que otra IA implemente por etapas y después se revisen los resultados. Público principal: **profesionales generalistas**; secundario: tecnología/remoto. **US$95/mes por Fantastic fue rechazado** para esta etapa. Se puede aprovechar inteligentemente todo el saldo gratuito del trial, sin contratar ni habilitar sobreconsumos.

1. Leer [ESTRATEGIA-AVISOS.md](ESTRATEGIA-AVISOS.md): decisiones, hipótesis, evidencia, costos y límites de lo que sabemos.
2. Seguir [PLAN-AVISOS.md](PLAN-AVISOS.md): E0 benchmark offline; E1 trial estratificado y temporal; E2 ampliar base gratuita; E3 descubrimiento selectivo; E4 decidir si aún hace falta una fuente adicional.
3. Reutilizar [muestras y métricas](research/avisos-2026-10-16/README.md). No repetir corridas para recuperar números ya guardados.
4. Priorizar la verificación de vigencia/cuota del trial: comenzó el 16/10; vencimiento esperado 23/10, confirmar hora real. Último saldo observado: 450 avisos. La propuesta reparte hasta 360 en cortes comparables, 60 en remoto/huecos y 30 de reserva; no obliga a consumir si no aporta aprendizaje.
5. Conservar el catálogo gratuito y el ranking actual; demostrar que la mejora funciona cuando Fantastic quede deshabilitado. No hay presupuesto recurrente aprobado para Apify ni otro proveedor.

**E0 hecho (16/10, costo cero):** ver [research/e0-2026-10-16](research/e0-2026-10-16/README.md). Con 8 perfiles sintéticos (2 de reserva) y revisión manual del top 5:
- De los 909 grupos elegibles desde Argentina, el 56% es de 8 empleadores, la mayoría agencias de staffing o proyectos de IA y lingüística.
- Por área, los elegibles son 13 de administración, 21 de finanzas, 38 de RR. HH. y 4 de logística, contra 254 de software. Hay 37 junior.
- El perfil de logística quedó 0 útiles de 5 (la familia "operaciones" mezcla IT y Revenue Ops).

Conclusión: **para generalistas el problema principal es de adquisición (H1)**. El ranking tiene fallas menores (modalidad y ciudad, seniority, variedad, antigüedad) y hay candidatos de mejora listados ahí, sin implementar todavía. Siguiente:
- **E1** si el trial de Fantastic sigue vigente: se corre desde el panel con sesión real. Desde los entornos de Claude en la nube no hay red ni claves de producción.
- **E2** en paralelo: sumar empleadores argentinos generalistas.

**Importación de proveedores (17/10):** el dueño pidió usar las APIs probadas para tener avisos a la altura del MVP y aprobó **US$5 para Apify**. Se agregó el workflow manual `match-providers` (Fantastic con saldo del trial, Google Jobs con búsquedas del plan gratuito, Apify con tope acumulado), con ledger de consumo, vencimiento automático de lo importado y logos de la fuente. Ver [IMPORTACIONES.md](IMPORTACIONES.md).

### Avisos: qué falta (actualizado 16/10 noche, para seguir con otra IA)

Hecho:
- E0 (línea de base).
- Ajustes de ranking.
- Importación de Fantastic, Google Jobs y Apify con topes (#32 a #34).
- Primera corrida real y sync con reglas nuevas.

Detalle operativo y saldos en [IMPORTACIONES.md](IMPORTACIONES.md). Pendiente, en orden de impacto:

1. ~~**Segundo corte de Fantastic**~~ (hecho 17/10). Se usaron las cohortes nuevas G3/G4 y `offset` para no pagar repetidos. El trial queda agotado: 448/450. Medición en [research/e1-corte2-2026-10-17](research/e1-corte2-2026-10-17/README.md). **Elegibles: 909 → 2.687 grupos; empleadores 90 → 1.039.**
2. **Conectores gratuitos nuevos para ATS que aparecieron en Fantastic.** **Teamtailor ya está hecho** (17/10): usa el RSS público documentado y suma 8 empleadores argentinos (Bidcom, BYMA, Día, Naranja X, PECOM, CDA, Talento Cumbre, David Kennedy). Teamtailor suma 13 empleadores en total (incluye Diagnóstico Maipú, IOL, CPA Ferrere, Umbral y Spyrosoft). **Decisión del dueño:** Workable (10), Workday (9), SuccessFactors (6) y SmartRecruiters (3) tienen endpoints JSON públicos que usan sus propias páginas de empleo, pero **sin documentación oficial** para terceros: sólo hay descripciones de scrapers. Por la regla del plan (fuentes primarias, sin scraping indiscriminado) no se implementaron. Si el dueño acepta ese riesgo, el de Workable (`apply.workable.com/api/v1/widget/accounts/{cuenta}`) es el más simple. Es la forma sostenible de cubrir empleadores argentinos generalistas (Natura, Quilmes/AB InBev, Swiss Medical, EY, Bidcom, BYMA…) sin pagar.
   - Workday tiene un endpoint JSON público por tenant (`/wday/cxs/{tenant}/{site}/jobs`). Teamtailor y Workable tienen páginas de empleo públicas.
   - Antes de implementarlos, revisar la documentación y las condiciones de cada endpoint (PLAN-AVISOS §5). No usar scraping indiscriminado.
3. **Modalidad desconocida** (avance 17/10): ~1.100 publicaciones elegibles siguen sin modalidad. Ya se toman frases explícitas en español e inglés: reparto de días, "de forma presencial", "#LI-Remote", "in-office presence N days", etc. Lo que queda casi siempre dice sólo el lugar ("lugar de trabajo: Saavedra"), y eso no prueba que sea presencial: no se adivina. Para avanzar más hace falta que la fuente lo informe o leer el aviso original.
4. **Interior del país y oficios** (cierre 17/10, tarde): 216 búsquedas de Google Jobs este mes (tandas 1 a 5, con oficios y servicios en las ciudades grandes) y Computrabajo con 11 palabras del interior. Google Jobs pasó a 961 publicaciones abiertas y Computrabajo a 900. Apify quedó en US$4,56 reales de US$5: no se usa más sin aprobación nueva. **Elegibles: 3.683 de 1.505 empleadores** ([research/e1-final-2026-10-17](research/e1-final-2026-10-17/README.md)).
   - Queda repetir Google Jobs cada mes con el plan gratuito: los avisos vencen a los 21 días. Ver IMPORTACIONES, "Próximas corridas".
   - Logística en Tucumán sigue con poca oferta local.
   - Los oficios caen en la familia "otros": falta una familia propia (gastronomía, seguridad, oficios) si se quiere filtrarlos por área.
5. ~~**Revisión manual**~~ (hecha 17/10): [research/e1-revision-2026-10-17](research/e1-revision-2026-10-17/README.md). Falsos positivos 9 → 0, útiles 19 → 20, dudosos 12 → 20. Los dudosos son por modalidad desconocida en otra ciudad y por **inglés implícito** (avisos en inglés de empresas de EE. UU.). El idioma requerido ya se detecta: inglés implícito en avisos escritos en inglés, fluidez en puestos de cara al cliente y más idiomas ([research/e1-idioma-2026-10-17](research/e1-idioma-2026-10-17/README.md)). Sigue pendiente una revisión humana real abriendo los avisos.
6. ~~**Vigencia de importados**~~ (hecho 16/10): `scripts/match-liveness.ts` corre en `match-sync` después de la sincronización. Revisa hasta 150 importados por día, cada uno cada 3 días como mínimo. Cierra con 404/410 o con frases explícitas ("ya no está disponible", "No longer accepting applications"). Bloqueos y errores no cierran nada. El 17/10 la corrida dio 150/150 "sin dato", casi seguro Computrabajo bloqueando al bot. Ahora cada revisión guarda su resultado y las fuentes con ≥90% "sin dato" (mínimo 20 revisiones) se saltean, para gastar los pedidos en las que responden (Fantastic y Google Jobs responden bien). El log muestra el desglose por fuente. Los avisos de Computrabajo igual vencen solos a los 30 días.
8. **Tamaño de `data/match/inventory.json`:** desde el 16/10 no guarda las oportunidades, que se reconstruyen al cargar en 0,4 s: pasó de 50 a 36 MB. GitHub rechaza archivos de más de 100 MB. Si vuelve a crecer:
   - recortar descripciones guardadas (hoy hasta 6.000–12.000 caracteres);
   - acortar la retención de cerrados (30 días);
   - o mover el inventario a una base o a Vercel Blob.
7. **Probar en el producto con Computer Use** (PLAN-AVISOS §5.6): búsquedas generalistas, filtro Argentina, logos, "vista hace…", detalle y destino original, también en celular.

Seguridad: las claves se cargaron como secrets de GitHub Actions. Si las que se pegaron en el chat del 16/10 no se rotaron, rotarlas y actualizar los secrets y Vercel. El repo es público: nunca pasarlas como inputs ni en archivos.

Resultado de la primera importación (16/10, noche), con los secrets cargados:
- Google Jobs: +88.
- Fantastic: +272.
- Apify: +1.305, de los cuales Indeed aportó 213 después del arreglo de campos. Costó unos US$2,8 reales.
- La sync manual sumó 360 avisos de 6 empleadores descubiertos.

**Elegibles desde Argentina: 909 grupos (E0) → 2.722 oportunidades; empleadores con elegibles 90 → 847.** Medición en [research/e1-importacion-2026-10-16](research/e1-importacion-2026-10-16/README.md).

La PR #10 (borrador "Login: Continuar con Google + magic link") sigue abierta, pero `main` ya tiene esa funcionalidad por #22/#23. Es del dueño: cerrarla si ya no hace falta.

Las recomendaciones anteriores de tres portales con frecuencias fijas quedaron reemplazadas por este plan. Preparar PRs pequeñas y resultados por checkpoint para revisión; no empezar una migración a pgvector, una búsqueda API por CV o alertas automáticas.

## Implementado en esta tanda

- **Sincronización segura**: PUT con versión, compare-and-set atómico en Redis, conflictos con 409 y reintento con la base común. Altas simultáneas desde dos dispositivos no se pierden. Se respetan borrados, tanto de toda la cuenta como de tarjetas y guardados. Subidas y respuestas se vinculan a su sesión para no contaminar otra cuenta.
- **Interfaz al día**: Match y el selector de perfil reciben los cambios de la cuenta y de otras pestañas, sin recargar ni guardar automáticamente un estado vacío. El borrado de cuenta informa éxito sólo tras confirmación; sin conexión informa que falta confirmar.
- **Google preservado**: mismo email y cookie de sesión que magic link. El proveedor de autenticación escucha cambios entre ventanas y al recuperar el foco. Prueba de integración: una sesión Google recupera el perfil guardado con una sesión por email.
- **Protección de IA en Redis**: contadores atómicos compartidos entre instancias, TTL y hashes de IP; se agregan chat y acciones de facturación. Sin base hay alternativa local; con base caída se evita llamar a IA sin control.
- **Planes y cobro preparados**: `/precios`, estado por cuenta, checkout mensual de Mercado Pago, notificaciones firmadas, consulta del proveedor, acreditación idempotente, cancelación de renovación, recuperación de pagos y cuotas mensuales. El default es apagado (`NEXT_PUBLIC_BILLING_ENABLED=false`); comprobar la bandera efectiva de Production antes de afirmar su estado actual. No se verificaron cobros reales. Ver [COBROS.md](COBROS.md).
- **Chat con Maru**: panel de Búsquedas en escritorio y desplegable en celular. Referencias sólo a avisos abiertos proporcionados desde el inventario. Perfil opcional, historial de la página sin persistencia y limpieza al cambiar de cuenta.
- **Pulido**: resultados de Match en `AppShell`, guía del seguimiento en `/seguimiento/guia`, links de Planes y textos de privacidad corregidos.
- **Logos**: 15 marcas verificadas desde Simple Icons 16.35.0, servidas como SVG local. Correspondencia por nombre exacto; el resto conserva inicial y color. Fuentes y licencias en `public/companies/`.
- **Video de portada**: el renderer usa la misma agrupación que la web y reconstruye las oportunidades desde las publicaciones. Regenerado el 17/10 con el catálogo importado: 9.005 búsquedas, 1.606 empresas y 2.967 elegibles desde Argentina al renderizar (antes 6.439 / 425 / 909). Volver a correr `node scripts/render-intro-video.mjs` cuando cambien mucho los números.

## QC y correcciones del 16/10

- Teleprompter: se reprodujo “Completá los tres primeros pasos” con los tres campos completos; se quitó el mínimo oculto de motivación y se explican los requisitos de cada campo. “Aporto valor” ya genera un guion en el preview probado.
- Cámara: preview, grabación, revisión y repetir toma verificadas con Computer Use; selección de cámara/micrófono y apagado disponibles. Entrevista: cámara en sala y llamada, respuesta por texto e informe comprobados. No se enviaron fotogramas reales al feedback de IA durante este QC.
- Perfil: un resumen pegado sin empresas/fechas ya no se rechaza como PDF escaneado.
- CV, carta, match, filtros/detalle y seguimiento se probaron con un perfil ficticio en preview. Seguimiento retiene el cambio de estado tras recargar. El ZIP de extensión descarga bien; su instalación y autocompletado real en Chrome quedan pendientes porque la política del navegador de Computer Use bloqueó `chrome://extensions`.
- Apify: MCP autenticado, tres ejecuciones pagas aprobadas dentro de US$0,50 y datasets evaluados; 144 recibidos, 125 aceptados, 123 oportunidades canónicas. Sin cron ni publicación automática. Ver [APIFY.md](APIFY.md).
- Redacción con IA: se informa la fecha actual para experiencias vigentes; en formularios, disponibilidad, referidos, salarios y notas de idiomas sin confirmar deben quedar pendientes, sin valores supuestos.
- Calidad de avisos: se amplían títulos locales, se corrigen rangos de años y “Semi Senior”, y la extracción se recalcula al refrescar cada aviso.

## Lo que tiene que resolver el dueño

1. **Definición comercial.** Confirmar o ajustar la propuesta antes de habilitar cobro: semanal $4.500, mensual $10.000 y trimestral $22.500 (destacado); gratis 1 CV y 1 carta por día y 1 entrevista y 1 guion por semana; pago ilimitado con uso razonable (25 pedidos por día); STAR, feedback de cámara y Word sólo con plan. Detalle en [COBROS.md](COBROS.md). Comprobar el estado de la bandera de cobro de Production; no asumir que sigue igual al default. El diseño mantiene gratis el buscador, ranking, lectura de perfil y extensión.
2. **Mercado Pago.** El dueño informó que cargó las claves; falta comprobar configuración y circuito real con la cuenta, sin volver a solicitar secretos ya cargados. Revisar `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` y notificaciones firmadas a `<dominio>/api/billing/webhook` para suscripciones, comprobantes y pagos. No se hicieron cobros reales. No sirve pegar un link de pago genérico ni volver con `?suscripcion=ok`. Pasos y fuentes en [COBROS.md](COBROS.md).
   - Primer cobro real (semanal, 17/10): Mercado Pago aprobó el pago pero la cuenta quedó "pago iniciado sin terminar" y "Actualizar estado" daba 503. "Actualizar estado" ahora busca también otras suscripciones con la misma referencia (sólo reemplazan a la guardada si están autorizadas), tolera pasos fallidos y registra el error en los logs (`[billing refresh]`, `[billing status]`, con la ruta de Mercado Pago que falló). Si vuelve a fallar, revisar esos logs en Vercel y la configuración del webhook.
   - Segunda vuelta: la suscripción ya pasó a "authorized" pero el pago no se acreditaba y seguía el 503. Las búsquedas auxiliares ya no cortan la recuperación; si no hay comprobante con pago, se busca el pago por la referencia (`/v1/payments/search`), con la misma validación. Si un pago aprobado no se acredita (importe, moneda o fecha), el motivo se muestra en `/precios` como "Detalle: …", igual que el código de Mercado Pago que falló.
3. **Datos del negocio y legales.** Titular/razón social, identificación fiscal, domicilio y contacto; revisión de términos y privacidad, política/procedimiento de arrepentimiento y reembolso, y su botón antes de vender. La cancelación de renovación ya existe; este circuito legal depende de la definición del negocio.
4. **Google y email.** El dueño informó que agregó `https://www.marucoach.com/api/auth/google/callback` y se observó sesión real en `www.marucoach.com`; el panel y sus claves ya funcionan después de PR 30. No volver a tratar `ADMIN_EMAILS` como bloqueo pendiente. Falta comprobar un ingreso Google fresco desde cero. Magic link falló por ausencia de `SMTP_URL`; configurar también `EMAIL_FROM`. Si cambia el dominio, revisar su URI específica. Los previews requieren su propia URI o magic link.
5. **Validación real.** Ingresar con la misma cuenta en compu y celular, guardar una búsqueda, editar desde ambos y comprobar el borrado. Los contadores Redis del panel de proveedores se verificaron en Production, pero eso no reemplaza una prueba real de perfil/match/seguimiento entre dos dispositivos. Evitar modificar el perfil real del dueño durante QC; usar un perfil de prueba autorizado.
6. **Chrome Web Store.** Crear/completar la cuenta de publicador, ficha, datos de privacidad y subir el ZIP generado por `/extension`. La instalación por ZIP sigue disponible hasta publicar. Usar únicamente testimonios de usuarios reales que autoricen publicarlos.
7. **Dominio y medición.** El dominio canónico productivo ya es `https://www.marucoach.com`. Revisar `NEXT_PUBLIC_CONTACT_EMAIL` y activar Vercel Analytics si se desea usarlo; no cambiar el dominio para las pruebas de proveedores.
8. **Habilitar venta al final.** Sólo tras aprobar precio, textos, legales y pruebas de pago: `NEXT_PUBLIC_BILLING_ENABLED=true` en Production y nuevo build/deploy. La bandera pública se fija al compilar. La rama se puede desplegar con cobro apagado mientras se resuelven esos puntos.

## Validación técnica

TypeScript, ESLint, suite de tests y build de Next. Nuevas regresiones de concurrencia, borrado, sesión Google/email, cobro simulado, firmas y chat. QA con Chromium en 1440 y 390 px sobre Planes, Búsquedas, guía de Seguimiento y Match; perfil remoto visible sin recarga. Los tests de extensión/PDF que dependen del Chromium Linux configurado se omiten en macOS; no se reportan como ejecutados.

La IA del chat y el circuito financiero se probaron con respuestas simuladas. Hubo además QC real con perfil ficticio en postulación, CV, carta, teleprompter y entrevista, y estado real de proveedores en Production. Eso no prueba entrega de email, sincronización entre dos dispositivos ni pagos reales; quedan las verificaciones indicadas arriba.

## Backlog de producto posterior al lanzamiento

- Ampliar logos verificados para las 425 empresas.
- Extensión: Workday, buscadores de ciudad y formularios de varios pasos.
- Alertas de búsquedas nuevas, etiquetas "nuevas desde tu visita", mejoras del razonamiento del Match, filtros de calidad y salarios normalizados.
- Comparación ATS antes/después y mejoras de viñetas más visibles.
- Medir latencia/costo de IA con uso real antes de cambiar modelos o precios.

## Cómo seguir

Mantener el idioma rioplatense, datos reales y los tokens existentes. No inventar testimonios, postulantes ni promesas de empleo. Flujo: rama → PR → chequeos y preview → integrar. Chequeos: `npx tsc --noEmit -p .`, `npx eslint src --quiet`, `npx vitest run`, `npx next build`.

## Próximo paso para avisos pagos

La conexión MCP de Codex funciona. Para correr Apify fuera del chat hace falta `APIFY_TOKEN` como secreto del runner y una selección de consultas/ventanas; ese secreto del runner no está confirmado. El permiso de US$0,50 fue sólo para el piloto ya realizado y no hay presupuesto recurrente aprobado. El comando `match:apify` por defecto es dry-run y produce candidatos separados. La nueva prioridad es [el plan sin abonos](PLAN-AVISOS.md), no habilitar un cron pago.

## Fantastic.jobs y SerpAPI

Variables `FANTASTIC_JOBS` y `SERP_API` cargadas y verificadas desde el panel de Production con sesión real. Límites actuales en [PROVEEDORES-AVISOS.md](PROVEEDORES-AVISOS.md). Se completaron 50 filas Fantastic y diez Google Jobs en los playgrounds; el paquete del research conserva 185 registros públicos de los seis pilotos. El último conteo `1m` fue 5.671 ATS y 15.394 job boards; al excluir duplicados con ATS quedaron 13.757 job boards, 19.428 sumados. No equivale a avisos abiertos hoy ni justifica un abono rechazado. No se importaron estas muestras ni se crearon recurrencias. La autorización actual es para aprovechar sólo el saldo gratuito de Fantastic según E1, revalidando antes vigencia y cuotas.
