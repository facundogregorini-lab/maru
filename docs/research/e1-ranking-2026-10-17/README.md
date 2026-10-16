# Ajustes de ranking y clasificación medidos contra E0 (17/10/2026)

Implementa los candidatos 1–4 de [E0](../e0-2026-10-16/README.md#candidatos-a-mejora-no-implementados-en-esta-etapa). Se usó el mismo catálogo que en E0 (generado el 16/10 a las 09:51Z), re-analizado con las reglas nuevas, y los mismos perfiles: `perfiles.json` es una copia sin editar. Los perfiles de reserva no se usaron para ajustar.

Reproducir: re-analizar `data/match/inventory.json` con `analyzeStandalone` + `buildOpportunities` (la sync diaria lo hace sola, porque `EXTRACTION_VERSION` pasó a 3) y correr `MATCH_INVENTORY_PATH=<inventario> npx --yes tsx@4 scripts/e0-baseline.ts docs/research/e1-ranking-2026-10-17`.

## Cambios

1. **Clasificación** (`extract.ts`): "IT/Cloud/Network/Security Operations" pasan a software y "Revenue/Sales Operations" a ventas. Cambiaron 66 publicaciones.
2. **Ranking** (`ranking.ts`):
   - Modalidad fuera de las preferidas: ×0,85.
   - Presencial/híbrido fuera de los lugares indicados: ×0,8, explicado en "gaps".
   - Seniority a dos o más escalones: ×0,85.
   - Antigüedad mayor a 90 días: ×0,93; mayor a 180 días: ×0,85.
   - Variedad: como mucho 2 avisos por empresa en el top 10. El resto baja, no desaparece; si no hay alternativas, completa.
3. **Calidad**: convocatorias abiertas ("talent pool", "general application"…) y proyectos de entrenamiento o evaluación de IA (por título o descripción): ×0,7, con el pendiente "Parece una convocatoria abierta…".
4. **Presentación**: las ubicaciones de Argentina van primero en Match y Búsquedas.

## Antes / después (top 10 automático; top 20 para empresas)

| Perfil | Familia del área | Seniority compatible | Ubicación posible | Empresas distintas (top 20) |
| --- | --- | --- | --- | --- |
| G1-adm-contable-jr | 10 → 10 | 5 → **7** | 10 → 10 | 10 → 10 |
| G1-finanzas-ssr | 10 → 8 | 4 → **6** | 4 → **5** | 14 → 14 |
| G1-rrhh-ssr | 10 → 10 | 4 → **5** | 6 → **7** | 12 → **14** |
| G2-ventas-jr | 10 → 10 | 8 → 8 | 9 → 9 | 11 → 11 |
| G2-logistica-ssr | 10 → 6\* | 7 → **8** | 5 → **7** | 10 → 10 |
| T1-dev-ssr | 10 → 10 | 8 → 7 | 10 → 8 | 6 → **11** |
| G1-atencion-jr (reserva) | 9 → 8 | 2 → **3** | 10 → 10 | 13 → 13 |
| T1-datos-jr (reserva) | 10 → 10 | 3 → **5** | 7 → **9** | 10 → 11 |

\* Logística baja porque IT Ops y RevOps dejaron de contar como "operaciones": es la clasificación correcta. El top 5 sigue sin avisos de logística porque el catálogo tiene sólo 4. Eso se resuelve con adquisición ([IMPORTACIONES.md](../../IMPORTACIONES.md)), no con ranking.

Revisión del top 5 contra los falsos positivos de E0:
- Finanzas ya no tiene un presencial en Buenos Aires en el #1.
- Los "Expert" de entrenamiento de IA (Anyone AI) salieron del top 5 de administración contable.
- Dev pasó de 6 a 11 empresas en el top 20.
- En T1-dev cae "ubicación posible" (10 → 8): entran avisos con modalidad sin dato que antes quedaban detrás de repetidos de la misma agencia.

## Límites

Son señales automáticas, no una nueva revisión manual de 40 casos. El efecto grande para generalistas depende de importar avisos argentinos (Fantastic, Google Jobs, Apify) y de sumar empleadores al directorio. Después de la primera importación, repetir esta medición en otra carpeta.
