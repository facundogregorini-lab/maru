# E0 — Línea de base offline del inventario (16/10/2026)

Primera etapa de [PLAN-AVISOS.md](../../PLAN-AVISOS.md#3-e0--línea-de-base-y-evaluación-offline). Costo externo: **cero** (sin proveedores, sin red, sin IA por aviso). Base: `main` en `f214e02`, catálogo `data/match/inventory.json` generado el `2026-10-16T09:51Z`.

## Archivos

| Archivo | Qué es |
| --- | --- |
| [perfiles.json](perfiles.json) | 8 perfiles **sintéticos** versionados (6 generalistas, 2 de tecnología/datos; junior y semi senior; ciudades fuera de CABA; indispensables explícitos). `G1-atencion-jr` y `T1-datos-jr` son **reserva**: no se usan para ajustar reglas, sólo para la comprobación final. |
| [baseline.json](baseline.json) | Métricas del catálogo y, por perfil, conteos del ranking, variedad del top 20, señales automáticas del top 10 y oferta del catálogo para su área. |
| [resultados.json](resultados.json) | Top 20 elegible (con motivos, pendientes y señales automáticas) y top 5 por confirmar de cada perfil. |
| [revision.json](revision.json) | Revisión manual de los 5 primeros de cada perfil (40 casos) con criterios fijos y veredicto. |

Reproducir: `npx --yes tsx@4 scripts/e0-baseline.ts docs/research/e0-2026-10-16` (regenera `baseline.json` y `resultados.json` con el catálogo vigente: para comparar después de un cambio, guardar en otra carpeta y copiar `perfiles.json` sin editarlo).

## Catálogo: niveles que no hay que mezclar

| Nivel | Cantidad |
| --- | ---: |
| Registros (publicaciones por fuente) | 9.793 |
| Oportunidades canónicas abiertas | 9.792 |
| Grupos visuales (puesto + empresa) | 6.439 |
| Grupos **elegibles desde Argentina** | **909** |
| Grupos por confirmar | 809 |
| Empleadores con algún grupo elegible | **90** (de 425) |

**Los elegibles están concentrados y sesgados a tecnología:**

- 8 empleadores tienen el **56%** de los 909 elegibles: Welo Global 146 (proyectos de traducción y lingüística), Scale Army 78 y Hire Hangar 74 (agencias de staffing offshore), Sezzle 71, Anyone AI 38 (entrenamiento de IA), Rehire 38, Despegar 31 y Alpaca 29.
- Por familia: software 254, otros 202, marketing 91, ventas 74, operaciones 61, datos 42, diseño 42, RR. HH. 38, atención al cliente 26, finanzas 21, administración 13, **logística 4**.
- Seniority: junior 37, semi senior 98, senior 227, lead/manager/director 197, sin dato 342. **Hay muy poco para juniors.**
- Modalidad: remoto 639, híbrido 84, presencial 53, desconocida 133. Casi nada presencial o híbrido en el interior del país.
- Antigüedad de publicación: 66 en los últimos 7 días, 225 de 8 a 30 días, 285 de 31 a 90 días y **333 con más de 90 días** (avisos "siempre abiertos" de los ATS o pools).

## Resultados por perfil

"Oferta del área" = grupos elegibles del catálogo en las familias del perfil (antes de rankear). Revisión = top 5 elegible, juzgado a mano.

| Perfil | Oferta del área (empleadores) | Top 10: seniority ok / ubicación posible | Revisión top 5: útil · dudoso · falso + | Diagnóstico |
| --- | --- | --- | --- | --- |
| G1-adm-contable-jr | 34 (16) | 5 / 10 | 3 · 1 · 1 | Poca oferta; aparece un "AI training" como contable. |
| G1-finanzas-ssr | 34 (16) | 4 / 4 | 2 · 2 · 1 | Presencial en Buenos Aires sale #1 aunque pidió híbrido/remoto desde Rosario. |
| G1-rrhh-ssr | 38 (17) | 4 / 6 | 3 · 1 · 1 | 3 de 5 de la misma agencia; un "talent pool" como vacante. |
| G2-ventas-jr | 74 (23) | 8 / 9 | 1 · 4 · 0 | La mayoría probablemente exige inglés y el perfil marcó idioma indispensable (sólo español): el aviso no lo dice estructurado. |
| G2-logistica-ssr | **4 de logística** + 61 de operaciones (30) | 7 / 5 | **0 · 1 · 4** | Mal cubierto: "operaciones" mezcla IT Ops y Revenue Ops con logística. |
| T1-dev-ssr | 254 (54) | 8 / 10 | 3 · 2 · 0 | Bien cubierto en volumen; avisos de 11 a 14 meses en el top 2. Sólo 6 empresas en el top 20. |
| G1-atencion-jr (reserva) | 26 (14) | 2 / 10 | 4 · 1 · 0 | Aceptable, con agencias offshore. |
| T1-datos-jr (reserva) | 42 (17), **9 con seniority posible** | 3 / 7 | 3 · 0 · 2 | Lead y Senior en el top 5 de un junior. |

Duplicados visibles en los top 20: **0** en todos los perfiles (la agrupación por puesto + empresa funciona).

## Perfiles mal cubiertos: ¿adquisición o ranking?

| Perfil | Problema principal | Evidencia |
| --- | --- | --- |
| Logística / operaciones | **Adquisición + clasificación** | Sólo 4 avisos elegibles de logística en todo el catálogo; la familia "operaciones" agrupa IT Operations y Revenue Operations, que el ranking muestra como del área. |
| Administración / finanzas / RR. HH. junior y semi senior | **Adquisición** | 13 de administración, 21 de finanzas y 38 de RR. HH. elegibles, de 16-17 empleadores; casi todo remoto internacional o presencial en Buenos Aires. Nada en Córdoba, Rosario, Mendoza o Tucumán. |
| Ventas sólo en español | **Datos** (requisito de idioma) | El requisito de inglés no está estructurado en muchos avisos: el filtro de idioma indispensable no puede excluirlos y quedan "dudosos". |
| Juniors (datos, administración) | **Adquisición + ranking** | 37 elegibles junior en todo el catálogo; el ranking sube Lead/Senior al top 5 de un junior. |
| Todos | **Ranking** (menor) | Modalidad y ciudad preferidas pesan poco cuando no son indispensables (presencial en otra ciudad sale #1); falta variedad de empleadores (3 de 5 de la misma agencia); avisos de más de 6 meses arriba. |
| Todos | **Presentación** | Si la búsqueda se publica en muchos países, la tarjeta puede no mostrar Argentina aunque la evidencia lo confirma (Hire Hangar: "Argentina - Buenos Aires" está en la evidencia, no en las ubicaciones visibles). |

**Conclusión de E0:** la hipótesis **H1 se sostiene** para los perfiles generalistas. El directorio gratuito está sesgado a tecnología, remoto internacional y agencias de staffing, y casi no tiene empleadores argentinos de áreas generalistas ni del interior. Mejorar el ranking ayuda en el margen (seniority, modalidad, variedad, antigüedad), pero **el problema principal de los generalistas es de adquisición**. Eso orienta E2 (ampliar empleadores generalistas argentinos con conectores gratuitos) y define qué medir en E1 y E3: cuántas oportunidades útiles *adicionales* aportan para administración, finanzas, RR. HH., logística y ventas en el interior.

## Candidatos a mejora (no implementados en esta etapa)

El plan pide fijar el benchmark antes de tocar reglas. Cada uno va en una PR chica, medida con estos mismos perfiles (sin usar los de reserva para ajustar):

1. **Clasificación:** separar "IT Operations" y "Revenue/Sales Operations" de operaciones/logística (`src/lib/match/extract.ts`).
2. **Ranking:**
   - Penalizar más la modalidad y la ciudad fuera de las preferidas, aunque no sean indispensables.
   - Penalizar el seniority a dos o más escalones.
   - Bajar los avisos con más de 180 días.
   - Diversificar empleadores (tope de 2 por empresa en el top 10).
3. **Calidad de inventario:** marcar proyectos de entrenamiento de IA, transcripción y lingüística masiva y "talent pools" (Welo Global, Anyone AI y pools) para que no aparezcan como empleo del área.
4. **Presentación:** cuando un grupo es elegible, mostrar primero la ubicación de Argentina.
5. **Idioma:** extraer "inglés requerido" del texto del aviso para que el idioma indispensable funcione.
6. **Adquisición (E2):** sumar empleadores argentinos de áreas generalistas con ATS ya integrados o nuevos conectores gratuitos (Workable, Teamtailor). Partir de los empleadores observados en las muestras de Apify, Fantastic y Serp de [avisos-2026-10-16](../avisos-2026-10-16/README.md).

## Límites de esta medición

- La revisión es de una IA sobre metadatos (título, empresa, ubicaciones, evidencia, fechas), sin abrir los avisos originales. "Probable inglés" es una inferencia del tipo de empresa, no un dato del aviso.
- 5 casos por perfil es una muestra chica a propósito: sirve para detectar patrones, no para estimar tasas.
- El catálogo es una foto (sync diario). Comparar siempre contra este `baseline.json`, no contra números de memoria.
