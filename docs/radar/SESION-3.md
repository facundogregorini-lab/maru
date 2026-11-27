# Sesión 3 — Match de rol, Oportunidades y Seguimiento

Actuá como senior product engineer de Maru. Antes de empezar, leé `docs/radar/_REGLAS_COMUNES.md`, `docs/radar/ESTADO.md`, `docs/radar/AUDITORIA.md` y el ADR. Cubrís la **etapa 4** de `docs/radar/PROMPT_MAESTRO.md` (§3 Scoring completo y §2 Pantalla B).

Si ESTADO.md dice que la sesión 2 no dejó vacantes reales funcionando, frená y avisame.

## Objetivo
Cerrar el flujo completo de punta a punta: **seguir empresa → vacante real → evaluación → guardar en Seguimiento**.

## Alcance
1. **Contrato de Match:**
   - Revisá el Match existente (AUDITORIA.md). Si su contrato sirve, reutilizalo y versionalo. Si no, creá `radar-match` versionado sin romper el actual.
   - Documentá la decisión en `docs/radar/ADR-002-match.md`.
2. **Scoring (§3 del maestro):**
   - Pesos configurables desde `user_radar_settings`. Por default: competencias 40, seniority 20, ubicación y elegibilidad 20, compensación 10, interés 10.
   - Cada criterio lleva evidencia y un estado `known` o `unknown`. Si hay desconocidos, se renormaliza sobre los pesos conocidos y se muestra la cobertura o confianza. Con evidencia insuficiente, la vacante no puede quedar como prioridad alta.
   - Los gates de elegibilidad son: requisitos excluyentes confirmados → `blocked`; desconocidos → `needs_verification`. Un bloqueo nunca se compensa con score.
   - No se usan atributos protegidos. No se infieren nacionalidad ni permiso de trabajo: salen solo de lo que el usuario declaró en Automatización.
   - Antes de llamar al LLM, hacé una preclasificación determinística por familia de rol, ubicación y seniority, para no evaluar con LLM lo que obviamente no encaja.
   - Usá el cliente de Claude existente, con salida estructurada validada con Zod. La descripción del aviso va como contenido no confiable y el scorer no tiene herramientas.
   - Si la llamada falla, conservá el score anterior marcado como "desactualizado" o dejá la vacante en "sin evaluar".
   - Guardá `scoring_version`, `profile_hash` y `job_hash`, y recalculá solo si cambia alguno.
   - El perfil sale del CV y las preferencias del usuario que Maru ya tiene. No hardcodees ningún perfil.
   - Minimizá los datos personales en el prompt.
3. **Prioridad de acción:**
   - Heurística inicial: `0.85·match + 0.10·prioridad de empresa (P1=100, P2=60, P3=20) + 0.05·novedad`, aplicada después de los gates de elegibilidad, vigencia y confianza.
   - Si el match ya incluye el interés por la empresa, limitá su peso en esta fórmula para no contarlo dos veces.
   - Siempre se muestra por qué se recomienda. Nunca se presenta como probabilidad.
4. **Pantalla Oportunidades completa (§2 Pantalla B):**
   - Resumen, filtros, orden por prioridad de acción, match o novedad, y cards con score X/100, razón, barrera principal, fuente y frescura.
   - Detalle con competencias, fortalezas, brechas, excluyentes, desconocidos, desglose del score con evidencia y siguiente paso.
5. **Integración con Seguimiento y CV:**
   - `Guardar` crea o actualiza **una única** tarjeta en Seguimiento en estado Guardada, usando el modelo existente (no un modelo nuevo). Es idempotente y el estado se mantiene sincronizado en ambos sentidos.
   - `Descartar` es una preferencia personal: no borra la vacante global.
   - `Adaptar CV`, `Carta` y `Entrevista` abren los flujos existentes con la vacante precargada.
   - Si una vacante cierra, se conserva el histórico y se avisa, sin tocar postulaciones.
6. **Costo:** medí los tokens y el costo por evaluación en la corrida real y estimá el costo por usuario activo por semana. Anotalo en ESTADO.md.

## Tests (§7)
- Score con evidencia conocida y desconocida, y con requisito bloqueante.
- No se muestran scores históricos del piloto como actuales.
- Guardar dos veces la misma vacante deja una sola tarjeta en Seguimiento, y la transición de estado se refleja.
- No hay autopostulación.
- No se recalcula si no cambian los hashes.
- Aislamiento entre dos usuarios.

## Ejecución real
Evaluá las vacantes reales de las empresas P1 de tu usuario de prueba. Mostrá en ESTADO.md el top 5 con su desglose y la cantidad de vacantes bloqueadas o por verificar.

## Fuera de alcance en esta sesión
Scheduler, alertas, digest y descubrimiento.

## Cierre
Seguí la regla de merge y "Al terminar" de las reglas comunes. Actualizá `ESTADO.md`.
