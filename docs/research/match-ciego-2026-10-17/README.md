# Comprobación ciega del Match (17/10/2026)

Para esta comprobación se definieron 6 perfiles **sintéticos** nuevos ([perfiles.json](perfiles.json)) y los criterios de evaluación antes de mirar cualquier resultado. Las reglas no se ajustaron con estos perfiles antes de la corrida.

**Perfiles:**
- QA semi senior en Córdoba, sólo remoto;
- community manager junior en Rosario;
- contador senior en CABA;
- inside sales semi senior en Mendoza, remoto;
- data engineer senior;
- docente que quiere pasar a RR. HH. en La Plata o CABA.

**Criterios** (sobre el top 5 elegible de cada perfil):

| Veredicto | Condición |
| --- | --- |
| Útil | Mismo tipo de puesto y área, seniority a un escalón o menos, y ubicación posible: remoto elegible, o la ciudad o el GBA del perfil |
| Dudoso | Cumple el área pero falla el seniority o la ubicación, o el título es ambiguo |
| Falso | Otra área u otro tipo de puesto |

Además, el #1 debería ser útil y tener 80% o más.

## Resultado

Corrida sobre el inventario del 17/10 (`resultados.json`):

| Perfil | Útil | Dudoso | Falso | #1 útil y ≥ 80% |
| --- | ---: | ---: | ---: | --- |
| C1 QA semi senior | 4 | 1 | 0 | Sí, 98%: Software QA Analyst |
| C2 Community manager junior | 2 | 2 | 1 | No: el #1 es en Córdoba sin modalidad clara (81%) |
| C3 Contador senior | 1 | 1 | **3** | Sí, 99%: Contador para estudio |
| C4 Inside sales semi senior | 4 | 1 | 0 | Sí, 99% |
| C5 Data engineer senior | 4 | 0 | 1 | Sí, 97% |
| C6 Cambio a RR. HH. | 3 | 2 | 0 | Sí, 86% |
| **Total (30 casos)** | **18 (60%)** | **7** | **5** | **5 de 6** |

## Hallazgos

1. **Contador senior: aparecían puestos de apoyo.** En el top 5 había "Asistente contable" y "Administrativo contable" con 97–98%. Esos avisos no dicen el nivel, así que el seniority quedaba neutro.
   - **Corregido:** "asistente" / "assistant" en el título cuenta como junior, igual que "auxiliar". Con esto los asistentes salen del top 6.
   - **Pendiente:** "Administrativo contable" sin nivel sigue alto para un perfil senior o jefe.
2. **Community manager en Rosario:** casi no hay oferta local, y avisos de Córdoba sin modalidad informada quedan arriba. Las causas son la oferta y que la modalidad desconocida en otra provincia sólo resta ×0,88.
3. **Data engineer:** se cuela "Data Scientist". Los dos son cargos técnicos del área datos, y el tipo de puesto no los separa.
4. **Cambio a RR. HH.:** una pasantía en Neuquén queda #2 (70%) para alguien de La Plata y CABA. Es el mismo caso que el hallazgo 2.

## Límite

Después de mirar estos resultados, estos perfiles **ya no son ciegos**. La próxima comprobación necesita perfiles nuevos, definidos antes de correr.

## Seguimiento (18/10)

Se corrigieron los tres pendientes y se volvieron a correr estos perfiles sobre el inventario del 18/10. Ya no son ciegos: sirven como regresión, no como medición.

- **Data engineer:** en datos e IA el cargo técnico dice la disciplina. "Data Scientist" sale del top 40; "Data Architect" se mantiene como paso siguiente.
- **Contador senior:** "Administrativo contable" y "Asistente…" sin nivel se estiman junior. Lo hace el ranking, no el aviso, y aparece como brecha: "parece un puesto de apoyo". Salen del top 5 ("Administrativo Contable Temporal" estaba #3 con 98%).
- **Otra provincia sin modalidad:** pasa de ×0,88 a ×0,8, igual que un híbrido en otra ciudad. Con la ubicación indispensable, de ×0,75 a ×0,7. El híbrido en otra ciudad pasa de ×0,8 a ×0,75.
  - Community manager en Rosario: el aviso de Córdoba baja de #1 (81%) a #3 (73%).
  - Cambio a RR. HH.: la pasantía en Neuquén baja de #2 a #5.

Nueva comprobación ciega con 6 perfiles nuevos: [match-ciego-2026-10-18](../match-ciego-2026-10-18/README.md).
