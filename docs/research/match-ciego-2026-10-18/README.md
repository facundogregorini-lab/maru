# Comprobación ciega del Match (18/10/2026)

Para esta comprobación se definieron 6 perfiles **sintéticos** nuevos ([perfiles.json](perfiles.json)), con los mismos criterios que la del [17/10](../match-ciego-2026-10-17/README.md), antes de correrlos. Se corrieron una sola vez, con el motor que ya incluye los tres ajustes de abajo, y no se tocaron reglas después de mirar los resultados.

El foco son tecnología, marketing y finanzas, las áreas que el dueño quiere fuertes:

- frontend semi senior en Rosario, sólo remoto;
- DevOps senior en CABA;
- performance marketing semi senior en Córdoba;
- gerente de marketing;
- analista financiero junior en CABA;
- tesorería semi senior en Mendoza.

**Criterios** (sobre el top 5 elegible de cada perfil):

| Veredicto | Condición |
| --- | --- |
| Útil | Mismo tipo de puesto y área, seniority a un escalón o menos, y ubicación posible: remoto elegible, o la ciudad o el GBA del perfil |
| Dudoso | Cumple el área pero falla el seniority o la ubicación, o el título es ambiguo |
| Falso | Otra área u otro tipo de puesto |

Además, el #1 debería ser útil y tener 80% o más.

## Resultado

Corrida sobre el inventario del 18/10 (`resultados.json`, revisión a mano):

| Perfil | Útil | Dudoso | Falso | #1 útil y ≥ 80% |
| --- | ---: | ---: | ---: | --- |
| D1 Frontend semi senior | 4 | 1 | 0 | Sí, 85%: AI-First Frontend Software Engineer |
| D2 DevOps senior | 5 | 0 | 0 | Sí, 89% |
| D3 Performance marketing | 4 | 1 | 0 | Sí, 97%: Senior Paid Media Buyer |
| D4 Gerente de marketing | 4 | 1 | 0 | Sí, 89%: Head of Brand |
| D5 Analista financiero junior | 2 | 3 | 0 | No: el #1 (99%) es de riesgos, no de análisis financiero |
| D6 Tesorería en Mendoza | 2 | 3 | 0 | Sí, 94%: Analista de tesorería en Mendoza |
| **Total (30 casos)** | **21 (70%)** | **9** | **0** | **5 de 6** |

Los dudosos, uno por uno:

- **D1 #4:** "Senior Developer - Java, React…" es fullstack con Java.
- **D3 #5:** "Marketing Strategist" no dice si es de campañas pagas.
- **D4 #3:** "Recruitment Marketing Manager" es marketing para selección de personal.
- **D5:**
  - #1, "Analista Junior de Gestión de Riesgos para la Industria Financiera": coincide por "financiera", pero es riesgos;
  - #2, "Customer Finance Coordinator": es cobranza a clientes;
  - #5, "Finance Auxiliary Jr": es un puesto auxiliar, no de analista.
- **D6:**
  - #2, tesorería en Ezeiza, y #5, tesorería en CABA: son de otra provincia; el primero no informa modalidad y el segundo es presencial;
  - #4, "Administrativo Tesorería" en Santa Fe: es remoto, pero es un puesto de apoyo, no de analista.

## Lectura

- No hubo resultados de otra área en el top 5 de ningún perfil. El 17/10 hubo 5.
- Tecnología y marketing quedan bien.
- En finanzas la oferta es amplia, pero los títulos son ambiguos: "financiera" puede ser el rubro o el área, y "Customer Finance" es cobranza. Es lo próximo a mirar.
- Tesorería en Mendoza: hay poca oferta local. Lo de otras provincias aparece más abajo y con la advertencia de ubicación, pero sigue en el top 5 por falta de alternativas.

## Límite

Después de mirar estos resultados, estos perfiles **ya no son ciegos**. Los perfiles son inventados: la prueba mide coherencia, no contrataciones.
