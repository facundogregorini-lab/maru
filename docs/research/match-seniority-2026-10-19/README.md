# /match: nivel, salario y función (19/10/2026)

Caso reportado: un líder de growth (Fever, Mercado Libre, cofundador SaaS) con Manager/Director/VP y USD 7.000 por mes veía Video Editors, analistas y avisos de USD 1.500–5.500 con 62–74 %.

- [antes.md](antes.md): top 20 con el ranking anterior (main antes de la PR 127), sobre el inventario del 19/10, 03:42 UTC.
- [despues-reglas.md](despues-reglas.md): mismo inventario con la etapa por reglas nueva (filtros eliminatorios y puntaje 40/25/20/15).

Perfiles ficticios en `tests/match-eval-cases.ts`. Se regenera con `npx tsx scripts/match-eval.ts <archivo>`. El set de evaluación automático (`tests/match-eval.test.ts`) usa avisos fijos para que no cambie con cada sincronización.

Líder de growth, antes → después (reglas): Head of Marketing de Halter pasa del puesto 18 (66 %) al 1; salen Video Editor (74 % y 67 %), Creative Strategist, Paid Media Specialist y todos los avisos en USD con máximo menor a 7.000. Los "Manager" sin equipo a cargo y los salarios sin moneda quedan en "Por confirmar".

Pendiente: `despues-ia.md`, con la re-evaluación por IA (`npx tsx scripts/match-eval.ts despues-ia.md --ia` con `ANTHROPIC_API_KEY`, o el workflow manual `match-eval`).
