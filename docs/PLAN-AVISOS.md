# Continuación: inventario de empleos sin nuevos abonos

Fecha de corte: **16/10/2026**. Leer primero [ESTRATEGIA-AVISOS.md](ESTRATEGIA-AVISOS.md). Este plan es el traspaso para la próxima IA: producir cambios pequeños y revisables, conservar evidencia de los experimentos y volver con resultados al dueño antes de ampliar gasto o alcance.

## 1. Empezar por acá

1. Leer este documento, la estrategia y el [paquete de evidencia](research/avisos-2026-10-16/README.md).
2. Actualizar el checkout de `main`, revisar cambios ajenos e instrucciones del repo. Base conocida de este traspaso: `9c2f17d49a5d0e9af972383717c5d20c23b11642` antes del commit documental; PR #22, #23, #24, #26, #27, #29 y #30 ya integradas.
3. Confirmar vigencia y cuota del trial de Fantastic **antes de esperar o gastar**. Se inició el 16/10 y dura siete días; vencimiento esperado 23/10, verificar hora/estado reales. Último saldo observado de avisos: 450 de 500. Las requests se consumieron en otras consultas: no asumir las 48 del primer corte.
4. Ejecutar E0 con datos existentes. Después preparar la herramienta de E1 si hace falta, sin alterar sus límites de seguridad. Si aún hay trial, priorizar E1 porque el recurso vence; continuar el desarrollo gratuito en paralelo lógico, sin necesitar un agente adicional.
5. No contratar Fantastic: el dueño rechazó US$95/mes. La autorización vigente permite agotar el **saldo gratuito** inteligentemente. Si la cuota no se puede verificar, el trial venció o una acción generaría cargos, detener esa acción y seguir con los pasos offline/gratuitos.

No volver a pedir autorización para usar el trial gratuito dentro de ese alcance. Sí falta un presupuesto concreto para nuevas corridas pagas de Apify o cualquier recurrencia paga. El piloto anterior de US$0,50 ya se usó; no renovar ese permiso por interpretación.

## 2. Estado real y mapa de código

| Parte | Estado / archivos |
| --- | --- |
| Catálogo | `data/match/inventory.json`, `companies.json`, `sync-state.json`. Foto histórica: 6.439 grupos abiertos, 425 empresas, 909 elegibles desde Argentina. Recalcular para una línea de base nueva. |
| Actualización gratuita | `.github/workflows/match-sync.yml`, `scripts/match-sync.ts`, `src/lib/match/sync.ts`. Diario 06:17 Argentina. No hay proveedor pago conectado a ese cron. |
| Conectores y políticas | `src/lib/match/connectors.ts`, `sources.ts`, `inventory.ts`, `eligibility.ts`, `extract.ts`, `group.ts`, `ranking.ts`, `types.ts`. |
| Piloto Apify | `scripts/apify-jobs.ts`, `src/lib/match/apify.ts`, `tests/apify-jobs.test.ts`. Dry-run por defecto; salida candidata separada, `complete: false`. |
| Piloto Fantastic/Serp | `src/lib/match/provider-pilot.ts`, `src/app/api/match/admin/proveedores/route.ts`, panel `/match/admin`, `tests/provider-pilot.test.ts`. |
| Credenciales | `FANTASTIC_JOBS` y `SERP_API` existen en Vercel Production. No están autorizadas a descargarse a archivos ni a imprimirse. `APIFY_TOKEN` del runner no está confirmado; OAuth MCP no lo reemplaza. |
| Acceso admin | Sesión real del dueño y allowlist de Production comprobados después de PR #30. `ADMIN_EMAILS` admite comas, espacios y saltos de línea. No sigue bloqueado por el incidente histórico. |
| Cuota observada | Fantastic 450 avisos disponibles en el último corte; SerpAPI Free, precio 0, 248/250 búsquedas restantes en el último estado. Revalidar ambos; no están reservados. |
| Persistencia | Cuentas/perfil/match/seguimiento en Redis; catálogo JSON versionado. No hace falta crear otra base para esta fase. |
| Ranking | Local, sin LLM por aviso. La lectura del CV y el coach usan las APIs existentes; no cambiarlas para experimentar con proveedores. |

El panel actual tiene consultas fijas para `analista`: **no sirve todavía para ejecutar toda la matriz de E1**. Fantastic Estado hace cuatro conteos; Fantastic Muestra trae hasta 25 ATS + 25 job boards, previa consulta de cuota. Límites compartidos en Redis: dos intentos de muestra y tres de estado por proveedor en 24 h. No evadir esos límites repitiendo deployments, cambiando identidades o usando rutas públicas.

Si se amplía la herramienta para el experimento: mantener sesión + allowlist, mismo origen, claves sólo de servidor, lista cerrada de cohortes/parámetros, topes agregados de requests/filas y cuota confirmada. Previsualizar configuración y consumo máximo antes de iniciar. Descontar/reservar presupuesto de forma compartida ante concurrencia. Fallar sin llamada externa si no hay cuota verificable. Un cambio de límites debe ser explícito y justificado en la PR, no un bypass.

## 3. E0 — Línea de base y evaluación offline

**Objetivo:** saber qué falta en los resultados de Maru antes de comprar o sincronizar más volumen. Costo externo: cero.

- Reusar `samples.json`, `overlap.json`, `apify-metrics.json` y `fantastic-counts.json` del paquete. No repetir el piloto sólo para reconstruir sus números.
- Leer primero manifiesto y agregados; procesar las 185 filas por código y traer al contexto sólo los casos que haya que juzgar. No volcar todos los JSON ni usar un LLM por fila para contar, deduplicar o medir fechas.
- Obtener métricas del catálogo actual: abiertos, elegibles, por confirmar, familias, empleadores, fechas y fuentes; diferenciar registros, oportunidades canónicas y grupos visuales.
- Crear entre seis y nueve perfiles **sintéticos**, versionados, sin datos del usuario. Al menos cuatro generalistas (administración/finanzas, ventas, RR. HH., operaciones/logística) y dos de tecnología/datos. Incluir junior y semi senior y ubicaciones fuera de CABA; definir condiciones indispensables explícitas.
- Guardar top 10 o top 20, motivos y pendientes de cada perfil con el ranking actual. Contar oportunidades elegibles distintas, empresas distintas y duplicados visibles.
- Revisar una selección pequeña, como cinco resultados por perfil, con criterios fijos: rol/seniority compatibles, Argentina confirmada, destino útil, datos suficientes y ausencia de contradicción fuerte. Registrar desacuerdo y falso positivo; no convertir el score existente en la etiqueta de verdad.
- Fijar este benchmark antes de ajustar reglas. No usar sólo los mismos perfiles para ajustar y declarar victoria: reservar parte de los casos para una comprobación final.

**Entregable:** `docs/research/avisos-<fecha>/baseline.json`, perfiles sintéticos, resultados de referencia y una tabla breve de perfiles mal cubiertos. Identificar problemas de adquisición frente a problemas de clasificación/ranking.

**Estado: hecho el 16/10** en [research/e0-2026-10-16](research/e0-2026-10-16/README.md), con el script `scripts/e0-baseline.ts`, que se reutiliza para medir E1 a E3 con los mismos perfiles. Resultado: H1 se sostiene; para generalistas el problema principal es de adquisición. Candidatos de clasificación y ranking listados, sin implementar.

## 4. E1 — Aprovechar el trial de Fantastic

**Objetivo:** aprender cobertura por público y repetición temporal, no construir una sincronización productiva dependiente del trial. Ejecuciones manuales; este documento no crea cron ni seguimiento programado.

### Presupuesto de investigación propuesto

Si siguen disponibles **450 avisos gratuitos**, distribuir como sigue. El número es un máximo de filas devueltas, no un objetivo de gasto obligatorio.

| Bloque | Diseño | Máximo de avisos |
| --- | --- | ---: |
| Matriz principal | 3 cohortes × 2 feeds × 20 avisos × 3 cortes | 360 |
| Remoto / hueco prioritario | Hasta 30 ATS + 30 LinkedIn, elegibilidad Argentina/LATAM explícita a validar | 60 |
| Reserva | Corregir un filtro fallido, explorar un hueco detectado o validar una hipótesis específica | 30 |
| Total máximo | No pagar para completarlo | 450 |

La matriz necesita 18 requests de datos, más hasta tres del resto y las pocas consultas necesarias de cuota/conteos. Confirmar saldo real de requests. No gastar cuatro conteos en cada consulta de estado si basta una comprobación; tampoco asumir exactitud de headers de saldo cacheados por segundos. Registrar el consumo exacto de cada respuesta con `x-api-jobs-this-request` y un ledger local/compartido sin secretos.

Si el saldo bajó, reducir proporcionalmente el tamaño manteniendo comparabilidad. Si el tiempo hasta vencimiento no permite tres cortes, hacer dos y declararlo; no simular días ni reemplazar cortes por llamadas consecutivas.

### Cohortes y filtros

Definir y congelar antes del primer corte, por ejemplo:

| Cohorte | Áreas | Filtro de título candidato, a validar en la API |
| --- | --- | --- |
| G1 | Administración, finanzas, RR. HH. | `administrativo OR contable OR finanzas OR tesorería OR "recursos humanos" OR recruiter` |
| G2 | Ventas y operaciones | `comercial OR ventas OR "account executive" OR operaciones OR logística` |
| T1 | Tecnología, datos y producto | `developer OR desarrollador OR "software engineer" OR "data analyst" OR "analista de datos" OR QA OR "product manager"` |

No son una taxonomía validada ni garantizan cobertura; registrar las expresiones exactas finalmente usadas. Pueden solaparse. Usar sintaxis admitida, `location=Argentina`, descripción en texto y dos feeds separados: `active-ats` y `active-jb` con `source=linkedin`. Excluir campos de reclutadores en LinkedIn. No pedir enriquecimientos de planes superiores.

Para esta comparación **no** activar `exclude_ats_duplicate`: queremos observar las coincidencias de ambos feeds. Una exclusión previa escondería parte de la medición. La investigación deliberadamente puede volver a traer filas repetidas; esto no es el modelo de producción propuesto.

### Cortes y medición

- T0: primer corte después de preparar la herramienta. T1: aproximadamente 48 h después. T2: aproximadamente 96 h después, siempre antes del vencimiento real. Mantener ventana `7d`, filtros, tamaños y estrategia de orden/paginación idénticos.
- Registrar configuración, hora UTC, ventana, límite solicitado y filas reales. Si se alcanza el límite, marcar `truncated/unknownCoverage`; si cambia el orden, declararlo. No confundir un top 20 con un censo.
- Separar: mismo ID, misma URL, nueva versión del contenido, candidato a misma vacante en otro feed, primer ID visto en la muestra, indexación nueva y publicación reciente. Conservar `date_created` y `date_posted` originales.
- Medir por cohorte/feed: filas, útiles, elegibles, empresas, edad, datos faltantes, grupos adicionales frente al núcleo gratuito, proporción repetida frente a T0 y T1 y resultados adicionales para los perfiles de E0.
- Los IDs que desaparecen de esta muestra parcial **no** se marcan cerrados. Para observar cierre, usar evidencia de la URL original o el endpoint permitido por el trial si está disponible; registrar desconocido si no se puede verificar.
- El bloque remoto no debe asumir que un filtro de país captura todo el remoto global. Diseñar una consulta aparte sólo con parámetros soportados, guardar la justificación geográfica y no comprar masivamente remoto US/EU no elegible.
- La reserva se asigna después de mirar resultados. Si no hay una pregunta útil, dejarla sin usar o ampliar una cohorte de forma explícita, sin contaminar los cortes comparables. No gastar sólo para llegar a cero.

**Entregable:** manifest por ejecución, ledger de cuota, filas públicas seleccionadas, calidad/rechazos, comparación temporal y conclusiones H2/H3/H7. Persistir resultados inmediatamente: no depender de que otra IA herede pestañas, variables del REPL o archivos de este equipo.

## 5. E2 — Mejorar la base gratuita y medir el resultado

**Objetivo:** aumentar resultados útiles generalistas sin un abono nuevo. No esperar a tener completa la serie temporal de E1.

1. Usar empleadores observados en muestras y huecos de E0 para proponer una tanda pequeña de empresas generalistas.
2. Validar la URL real y si existe un conector admitido. No inventar slugs ni deducir permiso de contratación desde el logo o domicilio de la empresa. La presencia en un ATS que no integramos puede justificar estudiar un conector nuevo; no obliga a contratar Fantastic.
3. Usar `match:add-company` o el panel para empresas de ATS ya admitidos. Para otros ATS, revisar la documentación primaria y condiciones del endpoint específico antes de implementar. Evitar scraping indiscriminado de portales.
4. Ejecutar una sincronización candidata y comparar E0. Mantener fijos perfiles y ranking para aislar el efecto de nuevas fuentes.
5. Corregir clasificación, fechas o elegibilidad sólo ante casos concretos, con regresiones útiles. No ajustar el ranking para que apruebe automáticamente toda publicación de la nueva fuente.
6. Probar el resultado con Computer Use: búsquedas generalistas, filtro Argentina, detalle, motivos, guardado y destino original, incluyendo móvil. Sin postular, enviar formularios ni mensajes.

**Aceptación:** mejora demostrable en perfiles antes mal cubiertos, sin duplicados visibles nuevos ni incompatibilidades geográficas graves, y catálogo aún útil con Fantastic y SerpAPI deshabilitados. Reportar casos donde no mejora; cantidad bruta de filas no basta.

## 6. E3 — Descubrimiento selectivo con SerpAPI

Reutilizar primero las diez filas guardadas. Después, si se confirma el plan incluido, una tanda de hasta seis búsquedas sin paginar (como máximo 60 filas teóricas), una por necesidad de E0 mal cubierta. No agotar cientos de búsquedas sólo porque hay saldo.

La autorización expresa para agotar el saldo corresponde a Fantastic; no extenderla a gastar todo SerpAPI. Mantener las pruebas de Serp dentro del plan gratuito y de los límites existentes, sin cargos ni abonos. Si la tarea requiere ampliar el experimento, presentar alcance y costo antes de un consumo pago.

Conservar consulta normalizada, ubicación, fecha y resultados para reutilizarla. Medir destinos originales, agregadores secundarios, repetición con la base y empleadores que pueden incorporarse mediante conectores gratuitos. La antigüedad relativa se conserva como texto; no fabricar una fecha exacta ni afirmar vigencia por aparecer en Google.

**Entregable:** costo en búsquedas incluidas, oportunidades adicionales útiles y descubrimientos convertibles en nuevas fuentes gratuitas. Decidir si aporta suficiente para mantenerlo como complemento manual. No poner la consulta en la ruta de subida del CV.

## 7. E4 — Elegir una ampliación sostenible, si sigue haciendo falta

Reutilizar los datasets existentes de Apify y confrontarlos con E0–E3. Preparar una comparación de **una** ampliación a la vez: Indeed por costo, LinkedIn por ajuste al público, Computrabajo por huecos locales. Bumeran/ZonaJobs requiere una prueba nueva y no tiene gasto aprobado.

Para cada opción presentar:

- Qué perfiles y regiones mejora, y cuántas oportunidades distintas aporta después de deduplicar.
- Costo por fila entregada y por oportunidad adicional útil, incluyendo inicios, duplicados y descarte por antigüedad.
- Filtros disponibles, límites/truncamiento, estrategia de recuperación, frecuencia y comprobación de cierres. No prometer ventanas personalizadas no verificadas.
- Costo estimado de la carga inicial y del mantenimiento, saldo incluido verificado, tope acumulado mensual y comportamiento al agotarlo.
- Qué sucede si la fuente falla una semana o queda sin saldo: catálogo previo, indicador de actualización, sin cierres masivos ni cargos automáticos.

No asumir un presupuesto de US$25, US$30–100 ni US$19 por recomendaciones anteriores. **No hay uno aprobado.** Si no hace falta una fuente adicional para los perfiles del MVP, cerrar esta fase con el núcleo gratuito y las mejoras implementadas.

## 8. Implementación futura y puertas de revisión

Separar PRs pequeñas, con problema, evidencia, antes/después y validación:

1. Instrumentación/benchmark offline y exportación de muestras; sin tocar inventario productivo.
2. Herramienta acotada para E1 si la matriz no puede correrse con las superficies actuales; sin API pública de consumo.
3. Directorio/conectores gratuitos e importación candidata revisable; preservar atribución y vínculo original.
4. Sólo después de la decisión de E4: proveedor adicional opcional, presupuesto agregado, persistencia, checkpoints y cierre correctos; deshabilitado por defecto hasta disponer del presupuesto correspondiente.

Pruebas relevantes para código: repetir la misma tanda no duplica; dos runs concurrentes no exceden tope; falla tras una página no avanza checkpoint; agotamiento no dispara otro proveedor ni cierra avisos; una consulta parcial no suma ausencias; distinta requisición/ubicación no se fusiona; fecha desconocida y remoto ambiguo permanecen desconocidos; claves no aparecen en respuestas/logs.

Comandos actuales del repo, para PRs de código:

```sh
npx tsc --noEmit -p .
npx eslint src --quiet
npx vitest run
npx next build
```

Las modificaciones sólo documentales no necesitan repetir manualmente todo el build; validar enlaces, JSON, datos y diff. El CI del repo corre lint/tests/build al abrir PR. Los tests que requieren un Chromium ausente pueden omitirse; declarar los skips, no reportarlos como QC real.

Por checkpoint, actualizar el informe con: commit y fecha, hipótesis, configuración real, cuota antes/después, fallos, archivos, métricas por perfil, interpretación y próxima decisión. El dueño quiere revisar cómo queda el producto entre etapas; no acumular una integración grande ni reiniciar el research de cero.

## 9. Cierre de esta fase

Se considera logrado cuando hay un inventario útil para los dos públicos, mejoras concretas verificadas con perfiles fijos y Computer Use, operación demostrada sin el trial, documentación actualizada y una decisión fundada sobre si hace falta pagar algo más.

No son requisitos de esta fase: cobertura de todo Argentina, un número nacional de vacantes garantizado, embeddings, pgvector, alertas, múltiples scrapers permanentes o instalar otra base de datos.

Los pendientes ajenos a esta fase (SMTP, pagos reales, prueba de extensión y sincronización entre dispositivos) siguen en [PENDIENTES.md](PENDIENTES.md). No confundirlos con un bloqueo de acceso al panel de proveedores, que ya se resolvió.
