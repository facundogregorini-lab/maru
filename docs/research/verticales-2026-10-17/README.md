# Avisos por vertical (17/10/2026)

Taxonomía de 15 verticales pedida por el dueño. Generado con `npm run match:verticals` sobre el inventario después de la sync con `EXTRACTION_VERSION` 7.
- **Publicaciones abiertas:** todo el catálogo, incluidas las de empresas del exterior.
- **Elegibles desde AR:** oportunidades únicas que se pueden tomar desde Argentina y que se muestran (menos de 120 días).

| Vertical | Publicaciones abiertas | % | Elegibles desde AR | % |
| --- | ---: | ---: | ---: | ---: |
| 1. Tecnología y Desarrollo de Software (IT) | 3645 | 27.3% | 647 | 17.5% |
| 2. Salud y Asistencia Médica | 183 | 1.4% | 73 | 2.0% |
| 3. Finanzas, Banca y Seguros | 229 | 1.7% | 72 | 1.9% |
| 4. Ventas y Desarrollo de Negocio | 1816 | 13.6% | 730 | 19.7% |
| 5. Marketing, Comunicación y Publicidad | 631 | 4.7% | 116 | 3.1% |
| 6. Recursos Humanos y Gestión del Talento | 420 | 3.1% | 212 | 5.7% |
| 7. Ingeniería, Operaciones y Manufactura | 1061 | 7.9% | 283 | 7.6% |
| 8. Cadena de Suministro, Logística y Transporte | 494 | 3.7% | 300 | 8.1% |
| 9. Administración, Legal y Finanzas Corporativas | 998 | 7.5% | 576 | 15.6% |
| 10. Atención al Cliente y Soporte | 383 | 2.9% | 165 | 4.5% |
| 11. Educación, Capacitación y E-Learning | 48 | 0.4% | 25 | 0.7% |
| 12. Hotelería, Gastronomía y Turismo | 113 | 0.8% | 97 | 2.6% |
| 13. Construcción, Arquitectura e Inmobiliario | 361 | 2.7% | 38 | 1.0% |
| 14. Arte, Medios, Entretenimiento y Creatividad | 105 | 0.8% | 36 | 1.0% |
| 15. Servicios Generales, Mantenimiento y Oficios | 348 | 2.6% | 110 | 3.0% |
| Fuera de la lista: tareas de IA e idiomas por proyecto | 1795 | 13.4% | 31 | 0.8% |
| Sin clasificar | 742 | 5.5% | 191 | 5.2% |
| **Total** | **13372** | 100% | **3702** | 100% |

## Cómo se reparte

Parte del área que calcula la extracción (`extract.ts`). Cuando un área nuestra cae en dos verticales, se reparte por palabras del título:

| Caso | Va a |
| --- | --- |
| Finanzas con banca, riesgo, crédito, seguros, tesorería, fraude o compliance | 3 |
| El resto de finanzas, y legal | 9 |
| Customer success | 4 |
| Repositores | 8 |
| Cajeros | 10 |
| Tiendas | 4 |
| Choferes, repartidores, vigiladores, limpieza y oficios de obra | 15 |
| Edición de video, diseño gráfico, copywriting, motion y dirección de arte | 14 |
| Obras, estimadores e inmobiliario | 13 |
| Consultoría | Según el título: tecnología → 1, finanzas → 3, RR. HH. → 6, resto → 7 |

- **"Tareas de IA e idiomas por proyecto"** (AI trainers, raters, lingüistas, data collectors) no entra en ninguna de las 15 verticales y se informa aparte. Son 13% del catálogo, pero casi todas son del exterior.
- **"Sin clasificar"** son títulos sin área clara ("Manager", "Specialist", "Principal").
