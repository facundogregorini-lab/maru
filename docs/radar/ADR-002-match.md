# ADR-002 — Match de rol de Radar (`radar-match`)

- **Estado:** aceptada (sesión 3, 27/11/2026).
- **Decisión:** scorer nuevo y versionado, `radar-match@1`, que **reutiliza las piezas determinísticas de Match** y el cliente de Claude, sin tocar el ranking de `/match`.

## Contexto

Match (`src/lib/match/ranking.ts` + `rerank.ts`) ordena el inventario compartido de `/match` y `/busquedas`:

- su unidad es `Opportunity` del inventario en archivos, no las vacantes de Radar (`JobOpening` por fuente);
- la elegibilidad asume que la persona está en Argentina (`classifyEligibility`) y no usa lo que declara;
- los componentes (rol 40, seniority 25, requisitos 20, preferencias 15) no llevan estado conocido/desconocido ni cobertura;
- la evaluación con IA vive en una caché en memoria de una hora, no se guarda por persona ni por hash.

Radar necesita pesos configurables por persona, criterios con evidencia y `known/unknown` con renormalización, gates `blocked` / `needs_verification` a partir de lo declarado, y resultados persistidos con `scoring_version`, `profile_hash` y `job_hash`.

## Opciones

1. **Reutilizar `rankOpportunities` tal cual.** Habría que convertir cada vacante en `Opportunity`, aceptar la elegibilidad argentina y perder `known/unknown`. No cumple §3.
2. **Extender Match.** Cambiar su contrato afectaría `/match`, `/busquedas`, el copiloto y las alertas, que hoy funcionan. Riesgo alto sin beneficio para esas pantallas.
3. **Scorer propio de Radar que reutiliza piezas de Match** (elegida).

## Qué se reutiliza

- `extract()` (familia de rol, seniority, idiomas, años, habilidades) y `postingLevel` / `profileLevel` / `targetRange` / `levelScore` / `levelVerdict` / `functionMismatch` de `fit.ts` para la preclasificación sin IA.
- `salaryFromText` para el salario publicado. Nunca se infiere un salario.
- El perfil `MatchProfile` y las preferencias `MatchPrefs` que la persona ya cargó en Match (documento `match` sincronizado con la cuenta). No se hardcodea ningún perfil.
- `askStructured` (Haiku, salida Zod, política de escritura sobre la prosa).

## Diseño de `radar-match@1`

Cinco criterios, cada uno con `score` 0–100, `known` y evidencia. Pesos de `user_radar_settings` (por defecto 40/20/20/10/10).

| Criterio | De dónde sale |
|---|---|
| Experiencia y competencias | IA (puntaje y evidencia del CV y del aviso). Sin IA, sólo si el aviso lista habilidades requeridas. |
| Seniority y alcance | Reglas (`levelScore`); si el nivel del aviso es dudoso, la IA puede precisarlo. |
| Ubicación y elegibilidad | Reglas, con lo que la persona declaró en Automatización (países donde puede trabajar, relocalización, modalidad). |
| Compensación | Sólo salario publicado en USD comparado con el mínimo declarado. Si no hay dato, desconocido. |
| Interés por empresa | Prioridad personal (P1 100, P2 70, P3 40, sin clasificar 50). |

- **Score** = suma ponderada de los criterios conocidos / suma de sus pesos. **Cobertura** = peso conocido / 100. **Confianza:** alta si cobertura ≥ 80 % y evaluó la IA; media ≥ 60 %; baja el resto.
- **Gates** (antes de ordenar, nunca compensados por el score): `blocked` si un excluyente está confirmado (presencial en un país sin permiso declarado y sin relocalización, ciudadanía o clearance exigidos, pide permiso explícito de un país no declarado, presencial cuando se pidió sólo remoto); `needs_verification` si falta un dato (la persona no declaró dónde puede trabajar, el aviso no dice el país, remoto restringido a un país no declarado).
- **Preclasificación sin IA:** función distinta, nivel claramente fuera de rango o bloqueo → se guarda con método `reglas` y no se llama a la IA.
- **Prioridad de acción** (se calcula al leer, no se guarda): `a·match + c·prioridad + 0,05·novedad`, con `c = máx(0; 0,10 − 0,85·peso_interés/100)` y `a = 0,95 − c`, para no contar dos veces el interés que ya está en el match. Novedad: ≤ 3 días 100, ≤ 7 días 60, resto 20. Con `needs_verification` el tope es 69 y con confianza baja 59: nunca quedan como prioridad alta. Bloqueadas y cerradas no tienen prioridad.
- **Recalcular** sólo si cambia `scoring_version`, `profile_hash` (perfil, preferencias, elegibilidad declarada y pesos) o `job_hash` (`contentHash` de la vacante). Si la IA falla, queda el resultado anterior marcado «desactualizado»; si no había, «sin evaluar».
- **Prompt:** sólo titular, cargos, años, habilidades, idiomas, liderazgo, un resumen corto y lo que busca. Sin nombre, contacto, ciudad ni permisos de trabajo (la elegibilidad se resuelve con reglas). El aviso va dentro de `<aviso>` como contenido no confiable; el scorer no tiene herramientas.
- **Persistencia:** `maru:radar:v1:u:<uid>:matches:<companyId>` (un documento por empresa seguida).

## Consecuencias

- `/match` no cambia.
- Las reglas de función y nivel son las mismas en las dos secciones; una mejora en `fit.ts` mejora las dos.
- `scoring_version` sube cuando cambia el prompt, los criterios o la fórmula: todo se vuelve a evaluar.
