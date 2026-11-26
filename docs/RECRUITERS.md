# Maru Recruiters

Sección para empresas y reclutadores: arman el perfil ideal de una búsqueda, cargan o encuentran candidatos, los califican y les escriben. El modelo de referencia es Metaview (relevamiento del 26/11/2026 en el Project «Maru», `research/rea-metaview-recruiters.md`); el diseño de interacción está en el canvas «Maru Recruiters · Parte 1: ICP y sourcing».

## Principios

- La IA clasifica y explica; nunca descarta ni rechaza sola. La categoría de cada candidato sale de una regla fija sobre los criterios (`categoriaDe`), no de la IA.
- Nada usa ni infiere edad, género, nacionalidad, foto u otras características protegidas. Los prompts lo prohíben y la IA lee el perfil sin nombre ni contacto (`perfilParaEvaluar`).
- Cada versión del perfil ideal queda guardada con sus resultados (`versiones`), para comparar qué perfil funciona mejor.
- No se scrapea LinkedIn. Fuentes: CVs que sube el reclutador y, desde la PR 3, candidatos de Maru que activen «Abierto a propuestas».

## Flujo

1. **Brief:** texto o voz, más el aviso (link o texto) y un CV de referencia opcionales. La IA arma la versión 1 del perfil ideal: obligatorios con peso (excluyente o importante) y origen, deseables, perfiles a evitar, industrias de referencia, seniority, ubicación y hasta 2 preguntas.
2. **Perfil ideal:** el reclutador edita, responde las preguntas (la IA reescribe el borrador) y aprueba. Editar un perfil ya aprobado crea una versión nueva en borrador.
3. **Candidatos:** cada CV se extrae (texto del PDF gratis con `unpdf`, la IA sólo estructura) y, con el perfil aprobado, se evalúa: estado por criterio (cumple, no cumple, sin datos) con evidencia, por qué apareció y alertas de inconsistencia.
4. **Calificación:** Sí, Tal vez o No, con motivo opcional. Con 5 calificaciones, la IA propone de 1 a 4 ajustes al perfil explicando qué calificaciones los justifican. Los aceptados crean una versión nueva y los candidatos quedan pendientes de reevaluar.

## Datos (Upstash, claves `maru:rec:`)

| Clave | Qué guarda |
| --- | --- |
| `maru:rec:b:<id>` | La búsqueda: brief, aviso, historial de perfiles ideales, preguntas, propuestas, fuentes. |
| `maru:rec:b:<id>:c` | Conjunto de ids de candidatos. |
| `maru:rec:c:<búsqueda>:<candidato>` | Perfil como texto (sin contacto), contacto (sólo CVs propios), evaluación y decisión. |
| `maru:rec:u:<cuenta>:b` | Búsquedas de cada cuenta (hash del email). |
| `maru:rec:uso:<cuenta>:<día>` | Lecturas con IA del día. |

## API

- `GET/POST /api/recruiters/busquedas`: lista y alta (con el brief).
- `GET/DELETE/POST /api/recruiters/busquedas/[id]`: la búsqueda con sus candidatos; `POST` recibe `{ accion }`: `editar_icp`, `responder`, `aprobar`, `agregar_cv`, `evaluar` (hasta 5 por pedido), `calificar`, `proponer`, `aplicar`, `borrar_candidato`.
- Todas exigen sesión. Una búsqueda de otra cuenta responde 404.

## Costos y topes

- Modelo: Haiku 5.5 (nivel `rapido`), esfuerzo bajo. Una evaluación lee unos 3.000 tokens y escribe unos 500: alrededor de US$0,0006, más la revisión editorial del «por qué».
- Cupo: 200 lecturas con IA por cuenta y por día (`RECRUITERS_DAILY_AI`). Cuentan el perfil ideal, cada CV leído, cada evaluación y cada pedido de ajustes. Si la IA falla, la lectura se devuelve.
- Topes: 50 búsquedas por cuenta, 300 candidatos por búsqueda, brief de 4.000 caracteres.

## Outreach (PR 4)

- Una secuencia por búsqueda (`maru:rec:s:<búsqueda>`) y una inscripción por candidato (`maru:rec:i:<búsqueda>:<candidato>`). Las activas están en `maru:rec:enviar` para el envío diario.
- El primer paso sale al inscribir o al activar; los siguientes, con el cron de lunes a viernes 10:00 ART, en días hábiles.
- Email: Resend, «<remitente> vía Maru» desde `RECRUITERS_FROM` (por defecto `recruiters@marucoach.com`), Reply-To del reclutador. Los siguientes mails responden en el mismo hilo («Re: …»). Al pie, siempre: «Me interesa», «No, gracias», privacidad y baja global (`maru:rec:baja:<hash>`).
- WhatsApp: con la API de WhatsApp Business (plantilla aprobada) sale solo; sin ella, tarea con `wa.me` y el texto. LinkedIn: siempre tarea manual.
- Candidatos de Maru: el mail va al email de su cuenta sin mostrarlo. Al tocar «Me interesa», la empresa ve su nombre y email. La baja también apaga «Abierto a propuestas».
- Las respuestas por mail le llegan al reclutador; Maru no lee su casilla, por eso existe «Respondió» para frenar a mano.
