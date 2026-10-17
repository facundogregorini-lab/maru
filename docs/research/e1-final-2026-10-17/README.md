# Cierre de la base con Google Jobs y Apify (17/10/2026, tarde)

Misma metodología que E0 (`scripts/e0-baseline.ts`) con los mismos perfiles (`perfiles.json`, copiado sin editar). Compara con [e1-idioma-2026-10-17](../e1-idioma-2026-10-17/README.md), la medición anterior del mismo día.

## Qué entró

- **Google Jobs (SerpApi, plan gratuito):** tandas 3, 4 y 5. Las tandas 3 y 4 cubren RR. HH., logística, contable, caja, recepción, repositor, telemarketer y cobranzas en el interior y en las ciudades grandes. La tanda 5 cubre oficios y servicios (operario, chofer, enfermero, mozo, cocinero, vigilador, auxiliar contable, técnico de mantenimiento, electricista y docente) en Buenos Aires, Córdoba, Rosario, Mendoza y Tucumán. Entre las dos mediciones pasó de 159 a **961 publicaciones abiertas**.
- **Apify Computrabajo:** 11 palabras del interior; publicaciones abiertas de 575 a 900.
- **Sync diaria** a mano después de importar. Re-analiza todo y revisa la vigencia de 150 importados: LinkedIn respondió 84 publicados y 31 sin dato, y Computrabajo 35 sin dato (ya bloquea al bot y desde ahora se saltea).
- Se sacaron del directorio 4 empresas que fallaban hacía 10 corridas: Remote.com, Welocalize y GovWorx (404) y Remote People (error de red).

## Ajustes medidos en esta tanda

- **Empresas con sufijos** (`group.ts`): el mismo puesto aparecía dos veces porque la empresa venía escrita "NEO-BIZ Consultores" en un lado y "Neo-Biz" en otro. Ahora el agrupamiento compara el nombre sin sufijos societarios ni de rubro (S.A., SRL, Inc., Consultores, Argentina, Group…).
- **Presencial en otra ciudad** (`ranking.ts`): ×0,7 en vez de ×0,8. Significa mudarse o viajar todos los días. El híbrido sigue en ×0,8. Para el perfil de logística en Tucumán, el puesto presencial en Neuquén salió del top 10 y entró uno presencial en Tucumán.

## Catálogo

| | Antes | Ahora |
| --- | ---: | ---: |
| Oportunidades abiertas | 12.054 | 13.128 |
| Elegibles desde Argentina | 2.743 | **3.683** |
| Por confirmar | 910 | 985 |
| Elegibles con ubicación en Argentina | 2.340 | 3.111 |
| Empleadores con elegibles | 1.040 | **1.505** |
| Elegibles sin modalidad informada | 876 | 1.497 |

E0 (16/10) tenía 909 grupos elegibles y 90 empleadores.

## Por perfil

| Perfil | Elegibles del área | Empleadores del área | Ubicación posible en el top 10 | Score medio del top 10 |
| --- | ---: | ---: | ---: | ---: |
| G1-adm-contable-jr | 433 → 581 | 296 → 395 | 9 → 9 | 77 → 82 |
| G1-finanzas-ssr | 433 → 581 | 296 → 395 | 6 → 7 | 78 → 78 |
| G1-rrhh-ssr | 178 → 214 | 112 → 140 | 8 → 8 | 75 → 75 |
| G2-ventas-jr | 398 → 656 | 248 → 401 | 10 → 10 | 93 → 94 |
| G2-logistica-ssr (Tucumán) | 348 → 402 | 213 → 250 | 2 → 3 | 67 → 68 |
| T1-dev-ssr | 407 → 411 | 143 → 147 | 9 → 9 | 76 → 76 |
| G1-atencion-jr (reserva) | 100 → 127 | 77 → 98 | 5 → 5 | 74 → 75 |
| T1-datos-jr (reserva) | 88 → 89 | 52 → 53 | 5 → 5 | 67 → 67 |

## Lo que sigue flojo

- **Logística en Tucumán:** hay pocos avisos locales en todas las fuentes. El top 10 mezcla Tucumán con otras ciudades sin modalidad informada, y cada uno avisa "confirmalo antes de postularte".
- **Modalidad desconocida:** creció con Google Jobs, que casi nunca la informa. No se adivina.
- **Oficios:** caen en la familia "otros" (no hay familia de gastronomía, seguridad ni oficios). El orden igual funciona por similitud de título, pero los filtros por área no los distinguen.
