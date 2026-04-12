from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parent.parent


def load_dotenv() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv()


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    value = env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


SECRET_KEY = env("DJANGO_SECRET_KEY") or env("FLASK_SECRET_KEY") or "django-dev-secret-change-me"
DEBUG = env_bool("DJANGO_DEBUG", default=env("FLASK_DEBUG", "0") != "0")
ALLOWED_HOSTS = [item.strip() for item in env("DJANGO_ALLOWED_HOSTS", env("TRUSTED_HOSTS", "127.0.0.1,localhost,testserver")).split(",") if item.strip()]
CSRF_TRUSTED_ORIGINS = [item.strip() for item in env("DJANGO_CSRF_TRUSTED_ORIGINS").split(",") if item.strip()]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "core.middleware.LegacyRequestMiddleware",
    "core.middleware.LegacyLoginRequiredMiddleware",
    "core.middleware.LegacyResponseHeadersMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.jinja2.Jinja2",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "environment": "core.jinja2.environment",
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"
SESSION_COOKIE_NAME = env("SESSION_COOKIE_NAME", "overzicht_session")
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", default=False)
SESSION_COOKIE_SAMESITE = env("SESSION_COOKIE_SAMESITE", "Lax")

LANGUAGE_CODE = "nl"
TIME_ZONE = env("TZ", "Europe/Amsterdam") or "Europe/Amsterdam"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
