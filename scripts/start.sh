#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${project_root}"

if [[ -n "${PYTHON_BIN:-}" ]]; then
  python_bin="${PYTHON_BIN}"
elif [[ -x "${project_root}/.venv/bin/python" ]]; then
  python_bin="${project_root}/.venv/bin/python"
else
  python_bin="python"
fi

# STATIC_ROOT used to contain tracked output with checkout timestamps newer than
# the source assets. A normal collectstatic then skipped stale CSS/JS, leaving
# current templates paired with months-old frontend files. Clearing the generated
# directory first makes every service start self-healing and deterministic.
"${python_bin}" manage.py collectstatic --noinput --clear
"${python_bin}" manage.py init_storage
# Gunicorn 26 enables a control socket under the process home by default. The
# platform does not use that interface, and production service users may not
# have a writable home, so keep it explicitly disabled.
if [[ -n "${GUNICORN_BIN:-}" ]]; then
  exec "${GUNICORN_BIN}" config.wsgi:application --no-control-socket "$@"
fi

# Run Gunicorn through the selected interpreter. This avoids stale executable
# shebangs after a project directory or virtual environment has been moved.
exec "${python_bin}" -m gunicorn config.wsgi:application --no-control-socket "$@"
