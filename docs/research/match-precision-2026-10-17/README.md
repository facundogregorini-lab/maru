# Match: precisión por tipo de puesto (17/10/2026)

Pedido del dueño: "las búsquedas deben ser precisas, excelentes; el % de match debe ser generoso". Costo externo: cero.

La parte de "generoso" ya la había resuelto [match-score-2026-10-17](../match-score-2026-10-17/manifest.json) (PR #70):
- los datos que faltan no cuentan como 50%;
- hay un mínimo de 25% para entrar en "Para vos".

Este cambio ataca la **precisión**. Se midió con los 8 perfiles sintéticos de [E0](../e0-2026-10-16/perfiles.json), con `rankOpportunities` y el catálogo del 17/10.

## Problema

La similitud de cargos sólo miraba el área del título. Por eso un puesto de otro tipo pero del mismo rubro salía arriba:

| Perfil | Antes | Puntaje |
| --- | --- | ---: |
| Ventas junior | #1 "Vigilador en local comercial" | 100% |
| Analista de logística | #2 "Operario logística Eventual" | 84% |
| Analista de datos junior | #1 "Data Engineer Semi Senior" | 91% |

Ser "del área buscada" sumaba +0,3 aunque el tipo de puesto no tuviera nada que ver.

## Cambio (`src/lib/match/ranking.ts`)

- **`parseRole`** separa cada cargo en dos partes. Ignora el seniority, los lugares ("zona Tucumán"), la modalidad y el ruido del aviso.
  - **Tipo de puesto:** análisis, técnico, gestión, apoyo u operativo.
  - **Área.** "Administrative Analyst" y "Analista administrativo" son lo mismo: si una palabra ambigua ("administrativo", "ejecutivo", "técnico") va junto a otra palabra de cargo, cuenta como área.
- **`roleSimilarity`** mide cuánto de lo buscado aparece en el título y lo ajusta según el tipo de puesto:

  | Combinación | Factor |
  | --- | ---: |
  | Mismo tipo | ×1 |
  | Un lado sin tipo | ×0,9 |
  | Con gestión | ×0,85 |
  | Otros tipos distintos | ×0,75 |
  | Operativo contra no operativo | ×0,45 |

- **Bonos de área:** el de "área buscada" y el de "área de tu experiencia" se multiplican por esa misma compatibilidad.

## Resultado (top 5)

| Perfil | Antes | Después |
| --- | --- | --- |
| Ventas junior | #1 Vigilador en local comercial (100%) | Sale del top 40. Arriba: Vendedor mostrador, Ejecutivo comercial, Vendedor |
| Logística semi senior | #2 Operario logística Eventual (84%) | Sale del top 8. Arriba: Coordinador de logística, Encargado de logística |
| Datos junior | #1 Data Engineer (91%) | #1 Junior Data Analyst (89%); Data Engineer pasa a #2 (84%) |
| Finanzas, RR. HH., desarrollo, atención | — | Sin cambios relevantes |

Tests: `tests/match-ranking-e0.test.ts` (describe "tipo de puesto además del área").

## Pendiente en esta línea

- **Habilidades de generalistas:** `findSkills` es sobre todo técnico. Faltan WMS, Tango, liquidación de sueldos y conciliaciones, para que administración, logística y RR. HH. tengan requisitos medibles.
- **Tope del puntaje:** se puede mostrar como máximo 99% en lugar de 100%. Hoy muchos avisos de administración y ventas dan 100%, y eso puede leerse como una certeza.
