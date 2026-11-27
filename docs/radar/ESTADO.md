# Radar laboral: estado

Traspaso entre sesiones. Lo actualiza cada PR del Radar.

## Sesión 1 (27/11/2026): base, empresas e importación

**Hecho**

- Auditoría (`AUDITORIA.md`) y decisión de persistencia (`ADR-001-persistencia.md`): no se suma ningún proveedor. El Radar es un documento más del sync (`radar` → `maru:radar:v1`, en la cuenta `maru:u:<hash>:radar`).
- Feature flag `RADAR_ENABLED` (`src/lib/radar/access.ts`):
  - sin definir o `0`: apagado (las rutas `/radar` y `/api/radar/*` dan 404);
  - `admins`: sólo los emails de `ADMIN_EMAILS`;
  - `1`: para todos o para `RADAR_ALLOWLIST`.
  - Además, `NEXT_PUBLIC_RADAR_NAV=1` (se lee al compilar) hace que la navegación consulte `/api/radar/acceso` para mostrar el ítem. Sin esa variable, ninguna visita suma pedidos.
- Navegación: «Radar laboral» debajo de Match en la barra lateral y en el menú de celular, sólo con acceso.
- Pantallas en `/radar/*`, con subnav:
  - **Mis empresas** (completa): resumen P1, P2, por clasificar y fuentes para revisar; filtros por sector, prioridad, región, texto, estado de fuente y archivadas; tabla en escritorio y tarjetas en celular; prioridad editable; orden manual; ficha con notas, link de Careers, estado de monitoreo y archivar.
  - **Agregar empresa**: búsqueda en el directorio de Match o carga manual.
  - **Importar empresas** (XLSX o CSV, leído en el navegador): pestañas como sectores, secciones LatAm y Global, «JOB OPENINGS · PILOTO» como vacantes históricas, «COBERTURA DEL PILOTO» ignorada; dedup por dominio, bolsa o nombre; conflictos a confirmar; mapeo de columnas corregible; prioridad sugerida opcional; idempotente.
  - **Oportunidades**: por ahora sólo las vacantes del piloto importado, marcadas «vigencia no verificada».
  - **Descubrimiento**: estado vacío.
  - **Automatización**: guarda la configuración (frecuencias, alertas, resumen, día, hora, zona horaria, consentimiento de email). Todavía no envía nada y lo dice.
- Estado de cada empresa (`/api/radar/estado`) contra el directorio (`data/match/companies.json`) y el inventario: monitoreada, error, vista en portales, lista para sumar o sin fuente, con búsquedas abiertas, elegibles desde Argentina y última lectura.
- Ranking de Match con `scope` (empresas y bolsas) para la sesión siguiente.
- Tests: `tests/radar-import.test.ts` y `tests/radar-api.test.ts`.

**Funciona con datos reales:** estado de las empresas y conteo de búsquedas (inventario diario de Match). **Fixture:** ninguna; las vacantes del piloto son las que importa la persona, siempre como históricas.

**Pendiente del dueño:** exportar el Research Laboral a .xlsx e importarlo desde «Importar empresas» (con el Radar prendido para su cuenta).

**Para la sesión siguiente:** Oportunidades en vivo, con `POST /api/match/ranking` y `scope` de las empresas seguidas. Guardar va a Seguimiento con `upsertTracked` y descartar con las interacciones de Match. El perfil y las preferencias salen de `loadMatch()`.
