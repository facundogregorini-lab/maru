# Revisión manual del top 5 después de las importaciones (17/10/2026)

Repite la revisión de 40 casos de [E0](../e0-2026-10-16/README.md): top 5 elegible de los 8 perfiles sintéticos, con los mismos criterios (rol, seniority, Argentina/ubicación, datos, contradicciones). El catálogo es el de `main` del 17/10 (Fantastic agotado, Teamtailor, Google Jobs del interior, Apify), re-analizado con las reglas de esta PR. Igual que en E0, la revisión la hace una IA sobre metadatos, sin abrir los avisos.

## Arreglos que salieron de la revisión (en esta PR)

1. **"sem" de SEM marcaba como marketing todo "Semi Senior …"**: la regla no tenía límite de palabra. "Semi Senior Financial Analyst" pasa a finanzas. `EXTRACTION_VERSION` 4.
2. **"Coincide con lo que buscás" por una palabra genérica**: "Analista de Calidad" coincidía con "Analista de logística" sólo por "analista". La similitud de cargos ahora pondera lo específico (logística, contable, recruiter) y le da poco peso a analista, asistente, ejecutivo, especialista, jefe, etc.
3. **"No queda claro dónde hay que trabajar"** en avisos de la misma ciudad de la persona: si el lugar coincide, la ubicación indispensable se cumple aunque el aviso no diga modalidad.
4. **Agregadores secundarios de Google Jobs**: se suman jobleads.com, trabajoar.com y empleosyempleos.com.ar.

## Resultado (útil · dudoso · falso positivo)

| Perfil | E0 (16/10) | Ahora | Qué cambió |
| --- | --- | --- | --- |
| G1-adm-contable-jr (Córdoba) | 3 · 1 · 1 | **4 · 1 · 0** | 3 avisos contables en Córdoba; sin proyectos de IA. |
| G1-finanzas-ssr (Rosario) | 2 · 2 · 1 | **3 · 2 · 0** | Milicic y Grupo FYO en Rosario; dudosos: Tucumán sin modalidad y un puesto de Philip Morris en Salta. |
| G1-rrhh-ssr (Mendoza) | 3 · 1 · 1 | **3 · 2 · 0** | Sin "talent pools"; dudosos: recruiter ejecutivo sin seniority y agencia offshore. |
| G2-ventas-jr (La Plata) | 1 · 4 · 0 | **3 · 2 · 0** | Ventas locales (Elit, SANY, vendedor en provincia de Buenos Aires); dudosos: Pilar presencial y un puesto que probablemente pide inglés. |
| G2-logistica-ssr (Tucumán) | **0 · 1 · 4** | **1 · 4 · 0** | Los 5 son de logística (antes: IT Ops y RevOps). Uno en Tucumán; los demás en Chaco y Buenos Aires sin modalidad. |
| T1-dev-ssr (Córdoba) | 3 · 2 · 0 | 3 · 2 · 0 | Sin cambios; dudosos: senior para un semi senior. |
| G1-atencion-jr (reserva) | 4 · 1 · 0 | 1 · 4 · 0 | **Empeoró**: entran puestos remotos de empresas de EE. UU. (cobranzas, despacho) que casi seguro piden inglés fluido. |
| T1-datos-jr (reserva) | 3 · 0 · 2 | 2 · 3 · 0 | Sin Lead/Senior; dudosos: presenciales en CABA para alguien de Neuquén. |
| **Total** | **19 · 12 · 9** | **20 · 20 · 0** | |

**Lectura:** los falsos positivos desaparecen (9 → 0) porque el catálogo tiene oferta real del área. Los dudosos suben por dos causas que no son de ranking sino de datos:
- **Modalidad desconocida en otra ciudad.** Ya se penaliza y se avisa, pero la mitad de Computrabajo y LinkedIn no declara modalidad.
- **Inglés implícito.** Avisos escritos en inglés de empresas de EE. UU. no dicen "inglés requerido" de forma estructurada. Es el candidato 5 de E0 (extraer el idioma) y la próxima mejora.

El perfil de reserva de atención al cliente lo muestra claro: no se ajustó nada con él y empeoró por el inglés implícito.
