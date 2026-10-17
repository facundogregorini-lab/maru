# Idioma requerido: inglés implícito y más idiomas (17/10/2026)

Candidato 5 de E0 y la causa principal de los "dudosos" de la [revisión del 17/10](../e1-revision-2026-10-17/README.md). Mismos perfiles (`perfiles.json` sin editar) y mismo catálogo re-analizado.

## Cambios

- **Inglés implícito** (`extract.ts`): si el aviso está escrito en inglés (palabras funcionales en los primeros 2.000 caracteres) y no declara el nivel, se agrega inglés requerido "intermedio o más (el aviso está escrito en inglés)". Afecta a ~1.000 de ~3.100 publicaciones elegibles.
- **De cara al cliente** (`ranking.ts`): en atención al cliente y ventas, un aviso en inglés sin nivel declarado pide **fluidez**. Atender o vender en inglés exige más que leerlo.
- **El idioma pesa en el total**: ×0,85 si el aviso pide un nivel mayor al del CV, ×0,7 si el CV no menciona el idioma. Antes sólo pesaba dentro del 10% de preferencias, así que no cambiaba el orden.
- **Más idiomas y el título**: chino, japonés, ruso, árabe, hebreo y neerlandés; se busca también en el título ("Recruiter con CHINO").
- `EXTRACTION_VERSION` 5.

## Efecto en el top 5

| Perfil | Antes | Después |
| --- | --- | --- |
| G1-atencion-jr (reserva, inglés intermedio) | #1 y #3: atención telefónica para empresas de EE. UU. (cobranzas, despacho) | Los 4 primeros son en español (Mar del Plata, Viedma, Rosario, agencia de viajes remota); el de EE. UU. pasa al #5 con la brecha explicada |
| G1-rrhh-ssr | "Recruiter con CHINO" aparecía arriba | Baja por chino requerido; el top 5 queda de recruiters en español o con inglés intermedio |
| T1-dev-ssr / T1-datos-jr (B2/intermedio) | — | Sin cambios: el nivel intermedio alcanza para avisos técnicos en inglés |

Límite: es una heurística sobre el idioma del texto, no la palabra del empleador. Cada aviso afectado muestra la brecha ("Pide inglés fluido (el aviso está escrito en inglés…); tu CV dice intermedio") para que la persona decida.
