#!/usr/bin/env bash

set -euo pipefail

release_check_root="$(mktemp -d "${TMPDIR:-/tmp}/hws-release-check.XXXXXX")"

cleanup_release_check() {
  case "${release_check_root}" in
    "${TMPDIR:-/tmp}"/hws-release-check.*)
      rm -rf -- "${release_check_root}"
      ;;
  esac
}

trap cleanup_release_check EXIT

export DATA_DIR="${release_check_root}/data"
export SESSION_FILE_PATH="${release_check_root}/sessions"
export DJANGO_DEBUG="0"
export DJANGO_ALLOWED_HOSTS="testserver,localhost,127.0.0.1"
export DJANGO_CSRF_TRUSTED_ORIGINS="https://testserver"
export TRUSTED_HOSTS="testserver,localhost,127.0.0.1"
export DJANGO_SECRET_KEY="release-check-django-secret-with-at-least-32-characters"
export FLASK_SECRET_KEY="release-check-flask-secret-with-at-least-32-characters"
export SESSION_COOKIE_SECURE="1"
export FORCE_HTTPS="1"
export ECWID_STORE_ID=""
export ECWID_SECRET_TOKEN=""
export MONEYBIRD_API_TOKEN=""
export MONEYBIRD_ADMINISTRATION_ID=""
export REGISTRATION_AUTO_EMAILS_ENABLED="0"
export EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"

python manage.py init_storage
python manage.py check --deploy --fail-level WARNING
python manage.py test core
