# ADR-001: persistencia de Radar laboral

**Estado:** aceptada (27/11/2026). **Decisión:** no sumar proveedores. Radar usa lo que Maru ya tiene.

## Contexto

El prompt maestro proponía tablas en Postgres con RLS. Maru hoy tiene:

- Datos de cada persona en documentos de `localStorage` sincronizados con la cuenta en Upstash Redis (`src/lib/sync`), con compare-and-set y clave por hash del email.
- Catálogo de empresas (`data/match/companies.json`) e inventario de avisos (`data/match/inventory*.json`) como archivos versionados que genera una sincronización diaria en GitHub Actions. `docs/match.md` ya dejó asentado no crear otra base para el catálogo.

## Opciones

| Criterio | (a) Documento sincronizado + archivos versionados | (b) Sumar Postgres |
| --- | --- | --- |
| Dedup del catálogo (273 filas entre sectores) | En la importación, por dominio o URL de Careers, y si no por nombre normalizado. Corre en el navegador sobre el archivo de la persona. | Índice único por dominio. |
| Filtros combinables | En memoria: una persona sigue cientos de empresas, no millones. | SQL. |
| Unicidad (persona, empresa) | Un solo documento por persona con un mapa por id de empresa. | Constraint. |
| Unicidad (fuente, aviso) | Ya la resuelve el inventario (`bolsa:id_original` + hash). | Constraint. |
| Historial de corridas | Ya existe en `sync-state.json` y en `/match/admin`. | Tabla nueva. |
| Aislamiento por persona | El sync ya separa por cuenta y valida sesión en el servidor. | RLS. |
| Costo y operación | Cero: sin proveedor, migración ni secreto nuevo. | Proveedor nuevo, migraciones, backups y otra credencial. |
| Funciona sin cuenta | Sí (navegador). | No. |

## Decisión

**(a).** Claves y esquema:

- `maru:radar:v1` (navegador) → `maru:u:<hash>:radar` (cuenta). Contiene empresas seguidas (prioridad, orden, notas, etiquetas, archivo), configuración de automatización y feedback de descubrimiento. Versión del esquema en el campo `v`.
- Lo compartido (pedidos de incorporación de empresas, sesión 2) va bajo `maru:radar:*` en Redis. Nunca se reescriben claves de otras secciones.
- La lógica vive en `src/lib/radar/*` con funciones puras. Si más adelante hace falta Postgres, se reemplaza la carga y el guardado sin tocar las pantallas.

## Cuándo revisar

Si el catálogo compartido de Radar supera unas 5.000 empresas o hace falta consultar entre personas (por ejemplo, «cuántas siguen a X» para priorizar el crawling), conviene volver a evaluar (b).
