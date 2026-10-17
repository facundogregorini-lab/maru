# Slop Monstruo en Maru

Fuente: https://github.com/axellaban/Slop-monstruo
Versión fijada: `d27c4f9e47da050cfc64942925de4b74e89b5bc8`.
Licencia: MIT, copyright Axel Laban y Jack Roberts; incluida en `LICENSE`.

Esta carpeta conserva el checker en español, su prueba y el criterio editorial. El
servidor de Maru no ejecuta Python ni las CLI de agentes. Usa `src/lib/writing.ts`,
con patrones de vocabulario y construcciones exportados del original en
`src/lib/writing-rules.json`. No depende de GitHub ni descarga reglas al responder.

La adaptación de puntuación y ritmo vive en TypeScript. La señal de prueba
posiblemente inventada se mantiene en el checker de desarrollo, pero no dispara una
reescritura automática: un número junto a “clientes” puede ser un logro real del CV.
La aplicación conserva cifras, enlaces y siglas al aceptar una edición.

Para una página o texto estático:

```bash
python3 tools/slop-monstruo/slop_monstruo.py borrador.txt
python3 tools/slop-monstruo/pruebas/test_slop_monstruo.py
```

Un 5/5 sólo indica que no se encontraron los patrones conocidos. Los términos
necesarios y la evidencia real se revisan en contexto, y el checker no demuestra
calidad, veracidad ni autoría.

El flujo completo de la skill pide una segunda familia de modelos. La adaptación
online usa el proveedor ya configurado de Maru, con una revisión condicional y
acotada. **No implementa una segunda familia** ni utiliza la sesión de Codex o Claude
de quien desarrolla para atender a usuarios. Ver `docs/ESCRITURA.md`.
