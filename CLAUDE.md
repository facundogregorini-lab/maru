# Instrucciones para trabajar en Maru

- **Mergear a `main` a medida que se avanza**, en PRs chicas con CI verde, y **anotar cada avance en `docs/PENDIENTES.md`** (sección del plan en curso). Si la sesión se corta, otra tiene que poder seguir desde ahí. Lo pidió el dueño y vale siempre.
- Textos para el usuario y documentación en español rioplatense.
- Claves de proveedores: sólo como secrets de GitHub Actions o variables de Vercel. El repo es público: nunca en inputs, argumentos, archivos ni logs.
- Topes de gasto vigentes en `docs/IMPORTACIONES.md`: no superarlos sin aprobación nueva del dueño.
- Antes de pushear: `npx vitest run`, `npx tsc --noEmit -p .` y `npx eslint src scripts tests`.

- Textos nuevos del producto y prompts: seguir `docs/ESCRITURA.md` (Slop Monstruo). Toda redacción con IA usa `askStructured` y declara los campos de prosa; no editar datos literales ni prometer autoría humana.
