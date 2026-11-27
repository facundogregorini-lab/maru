# ADR-001 — Persistencia de Radar laboral

- **Estado:** aceptada (sesión 1, 27/11/2026).
- **Decisión:** opción (a), sólo Upstash Redis, con keys `maru:radar:v1:*` y una capa de repositorio con interfaces.

## Contexto

Radar necesita guardar un catálogo global de empresas (deduplicado entre sectores), las fuentes de Careers de cada una, las empresas que sigue cada persona con su prioridad y notas, sus ajustes y, desde la sesión 3, vacantes, corridas de monitoreo y matches.

Maru hoy usa sólo Upstash Redis por REST (`src/lib/db.ts`), compartido entre Preview y Production y con otras apps (por eso todo va bajo `maru:`). No hay Postgres. El volumen inicial es chico: 273 registros del Sheet, que quedan en unas 200 empresas únicas, 40 vacantes históricas y pocos usuarios con el flag prendido.

## Opciones

### (a) Sólo Upstash Redis

Keys versionadas `maru:radar:v1:*` (el prefijo `maru:` es la convención del repo para la base compartida; `radar:v1` es el namespace pedido). Índices con sets. Acceso a través de interfaces (`CompanyRepo`, `CompanySourceRepo`, `TargetCompanyRepo`, `RadarSettingsRepo`, `PilotJobRepo`, `ImportRunRepo`) para poder cambiar el backend sin tocar pantallas ni rutas.

### (b) Sumar Postgres (Supabase, Neon u otro)

Catálogo, vacantes y matches en tablas con restricciones `unique`; preferencias y estado efímero en Redis.

## Evaluación

| Criterio | (a) Redis | (b) Postgres |
|---|---|---|
| Dedup del catálogo (273 → ~200) | La identidad es la key: `company:d:<dominio>` o `company:s:<slug>`. Upsert por key = dedup sin índice extra. El merge de etiquetas se hace en el servidor. | `unique(canonical_domain)` y `ON CONFLICT`. Más robusto ante escrituras concurrentes. |
| Filtros combinables (sector, prioridad, región, texto) | Se filtra en el servidor sobre la lista de la persona (cientos de filas: un `SMEMBERS` + un `MGET`). Sin búsqueda de texto indexada: para el catálogo se recorre en memoria. Alcanza hasta unos miles de empresas. | `WHERE` + índices + `ILIKE`/`tsvector`. Escala sin pensar. |
| Unicidad (user, company) | Un documento por persona con un mapa `companyId → target`, escrito con compare-and-set (`compareAndSetJson`). La unicidad es estructural. | `unique(user_id, company_id)`. |
| Unicidad (source, external_job_id) | Key `job:<sourceId>:<externalId>` (sesión 3). Igual que hoy el inventario de Match usa `${boardId}:${externalId}`. | `unique(source_id, external_job_id)`. |
| Historial de corridas | Listas acotadas (`LPUSH` + `LTRIM`) por fuente y globales. Sin consultas ad hoc. | Tabla `monitoring_runs` con consultas libres. |
| Aislamiento por usuario | En la capa de servidor: toda key privada se arma con el `userId` de la sesión verificada, nunca con un parámetro. Tests con dos usuarios. | RLS en la base, o lo mismo en el servidor si se usa con service role. |
| Costo | Cero extra: mismo plan de Upstash. Cada pantalla son 2 o 3 comandos en un pipeline. | Un proveedor nuevo (plan gratis al principio), otra credencial en Vercel, otro punto de falla. |
| Complejidad operativa | Ya conocida, con modo memoria para tests y desarrollo. Sin migraciones. | Migraciones, conexión desde funciones serverless (pooling), backups, y Preview que hoy comparte base con Production: habría que resolver eso también. |

## Decisión

**(a) Sólo Upstash Redis.** Con el volumen previsto para las etapas 1 a 4 no hay ninguna consulta que Redis no resuelva en uno o dos viajes, y evita sumar un proveedor. La capa de repositorio deja la puerta abierta a (b): las pantallas y las rutas sólo conocen las interfaces.

## Esquema `maru:radar:v1:*`

| Key | Tipo | Qué guarda |
|---|---|---|
| `maru:radar:v1:company:<companyId>` | JSON | Empresa del catálogo global (`Company`). `companyId` = `d:<dominio>` o `s:<slug>`. |
| `maru:radar:v1:companies` | set | Índice de ids del catálogo. |
| `maru:radar:v1:sources:<companyId>` | JSON | Fuentes registradas de la empresa (`CompanySource[]`). |
| `maru:radar:v1:u:<userId>:targets` | JSON (CAS) | Empresas que sigue la persona: `{ items: { [companyId]: TargetCompany }, updatedAt }`. |
| `maru:radar:v1:u:<userId>:settings` | JSON | Ajustes de monitoreo (`RadarSettings`). |
| `maru:radar:v1:u:<userId>:pilot` | JSON | Vacantes históricas del piloto importadas por la persona. |
| `maru:radar:v1:u:<userId>:imports` | lista (20) | Resumen de cada importación (sin contenido del archivo). |

Reglas: sólo se agregan keys nuevas; nada de Radar lee ni escribe keys de otras secciones. Un cambio de forma incompatible pasa a `v2` con migración por lectura.

## Riesgos aceptados

- **Escrituras concurrentes al catálogo.** El merge de una empresa se hace con `MGET` + `SET`. Dos importaciones simultáneas que tocan la misma empresa pueden perder una etiqueta de sector. Es poco probable con el flag acotado; si molesta, se pasa a un script Lua de merge o a CAS por empresa.
- **Catálogo global escrito por personas.** La importación suma empresas al catálogo compartido. Sólo agrega datos y completa campos vacíos; nunca pisa un dato existente. Las notas del Sheet van a la nota personal, no al catálogo.
- **Búsqueda de texto sin índice.** Se recorre el catálogo en memoria. Con más de unas 5.000 empresas habrá que sumar un índice (prefijos en sets) o pasar a (b).

## Cuándo revisar

Si el catálogo pasa de ~5.000 empresas, si hacen falta consultas analíticas sobre vacantes o matches entre usuarios, o si se separa la base de Preview de la de Production, conviene reabrir este ADR y evaluar (b).
