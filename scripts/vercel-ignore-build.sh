#!/bin/sh
# Paso "Ignored Build Step" de Vercel: salir con 0 saltea el deploy; cualquier otro código construye.
# Los cambios que sólo tocan documentación, tests, marketing o los workflows no cambian el sitio,
# y cada deploy cuenta para el tope diario del plan gratuito.
# Se compara contra el último deploy exitoso de la rama (Vercel lo pasa en VERCEL_GIT_PREVIOUS_SHA),
# así un push con varios commits no se saltea por mirar sólo el último. Si ese commit no está en el
# clon, git diff falla y se construye igual: ante la duda, deploy.
base="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
# Redeploy del mismo commit (por ejemplo, después de cambiar una variable de Vercel, como la clave de
# Anthropic): no hay diff, pero el pedido es explícito. Sin esto, el redeploy queda cancelado.
if [ "$(git rev-parse "$base" 2>/dev/null)" = "$(git rev-parse HEAD)" ]; then
  echo "Redeploy del mismo commit: se construye."
  exit 1
fi
# Un cambio en este script se construye, para que la regla nueva rija desde ese mismo deploy.
if ! git diff --quiet "$base" HEAD -- scripts/vercel-ignore-build.sh; then
  echo "Cambió el paso de deploy: se construye."
  exit 1
fi
if git diff --quiet "$base" HEAD -- . \
  ':(exclude)docs' \
  ':(exclude)tests' \
  ':(exclude)marketing' \
  ':(exclude)video' \
  ':(exclude)tools' \
  ':(exclude).github' \
  ':(exclude)scripts' \
  ':(exclude)*.md'; then
  echo "Sólo cambiaron docs, tests, scripts o marketing: no hace falta deploy."
  exit 0
fi
echo "Hay cambios que afectan al sitio: se construye."
exit 1
