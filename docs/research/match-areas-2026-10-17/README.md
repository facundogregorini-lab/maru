# Match en tecnología, marketing y finanzas (17/10/2026)

Esta medición responde a un pedido del dueño: que tecnología, marketing y finanzas sean fuertes. Usa 4 perfiles **sintéticos** nuevos ([perfiles.json](perfiles.json)) para las áreas que E0 no cubría: marketing digital semi senior, trade marketing junior, banca y riesgo semi senior, y desarrollo junior.

Para reproducirla:

```
npx --yes tsx@4 scripts/e0-baseline.ts docs/research/match-areas-2026-10-17
```

El comando regenera `baseline.json` y `resultados.json`.

## Qué mostró y qué se corrigió

| Perfil | Antes | Corrección | Después |
| --- | --- | --- | --- |
| Marketing digital semi senior (CABA) | Bien: #1 "Analista Marketing Digital" en Dia (99%), y después Scale Army, Xometry y Despegar | — | Igual |
| Trade marketing junior (Córdoba) | #1 "Recepcionista con perfil en marketing y comunicación" (74%) | Lo que sigue a "con" / "with" en el título califica, no es el puesto | #1 "Trade Marketing Analyst" de Essity; el aviso de recepcionista sale |
| Banca y riesgo semi senior (CABA) | "Analista de Riesgos Crediticios" del Banco Carrefour en Martínez quedaba #3 (67%): Martínez contaba como otra ciudad | Para quien busca en la ciudad de Buenos Aires, el Gran Buenos Aires pesa ×0,95, no ×0,8 o ×0,7 como otra provincia; además se explica en la tarjeta | #2 (79%) |
| Banca y riesgo | El aviso no tenía habilidades que coincidieran con el CV (scoring, análisis de crédito) | Habilidades nuevas: riesgo crediticio, prevención de lavado, mercado de capitales, modelos financieros y trade marketing (`EXTRACTION_VERSION` 10) | Se aplica en la próxima sync |
| Desarrollo junior (Rosario) | El #1 queda en 71%: casi todo es semi senior o senior | Es un problema de **oferta**, no de ranking: hay 17 avisos junior elegibles | — |

## Oferta por área (elegibles visibles, 17/10)

| | Tecnología | Marketing | Finanzas |
| --- | ---: | ---: | ---: |
| Avisos | 529 | 131 | 439 |
| Empresas | 217 | 57 | 315 |
| Llega solo de los ATS de las empresas | 60% | 73% | 9% |
| Junior o pasantía | 3% | 8% | 19% |

Para sumar oferta en estas áreas:

- **Conectores nuevos:** SmartRecruiters, Recruitee y Workday (búsqueda "Argentina" en el sitio de empleo de cada empresa).
- **41 empresas nuevas en el directorio,** cada una con evidencia de un aviso propio: PwC, Fiserv, Marsh McLennan, Thomson Reuters, dentsu, Essity, Natura, COMAFI, Cocos Capital, Pearster y otras.
- **Google Jobs automático** los días 2 y 17, con 30 búsquedas de marketing y finanzas.

El efecto se mide después de la primera sync con estos cambios.

## Límites

- Los perfiles se miraron mientras se ajustaban las reglas. Para una comprobación ciega hace falta un perfil nuevo.
- La revisión es sobre título, empresa y ubicación, sin abrir los avisos.
