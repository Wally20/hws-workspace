import os
import json
import calendar
import re
import sqlite3
import shutil
import threading
import time
import secrets
import hashlib
import hmac
import mimetypes
import unicodedata
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from decimal import Decimal, InvalidOperation
from datetime import date, datetime, time as dt_time, timedelta
from math import ceil
from typing import Any, Dict, List, Optional, Set, Tuple

import requests
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash


ECWID_API_BASE = "https://app.ecwid.com/api/v3"
MONEYBIRD_API_BASE = "https://moneybird.com/api/v2"
RIJKSOVERHEID_SCHOOL_HOLIDAYS_API_BASE = "https://opendata.rijksoverheid.nl/v1/infotypes/schoolholidays"
NAGER_PUBLIC_HOLIDAYS_API_BASE = "https://date.nager.at/api/v3/PublicHolidays"
BUNDLED_DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DATA_DIR = os.getenv("DATA_DIR", BUNDLED_DATA_DIR)
DATABASE_PATH = os.path.join(DATA_DIR, "app.db")
DASHBOARD_EVENTS_PATH = os.path.join(DATA_DIR, "dashboard_events.json")
AGENDA_TRAININGS_PATH = os.path.join(DATA_DIR, "agenda_trainings.json")
AGENDA_DAY_PLAN_OPTIONS = (
    "Geen activiteit",
    "Voetbaldag",
    "Samenwerkende amateurclubs",
    "Techniektrainingen",
)
AGENDA_SUMMARY_FILTER_OPTIONS = (
    {
        "key": "total",
        "label": "Totaal",
        "description": "Alle ingevoerde dagen",
    },
    {
        "key": "season_2026_2027",
        "label": "Seizoen 2026/2027",
        "description": "Maandag 24 augustus 2026 t/m zondag 13 juni 2027",
        "start": date(2026, 8, 24),
        "end": date(2027, 6, 13),
    },
)
DUTCH_MONTH_NAMES = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"]
DUTCH_WEEKDAY_NAMES = [
    "Maandag",
    "Dinsdag",
    "Woensdag",
    "Donderdag",
    "Vrijdag",
    "Zaterdag",
    "Zondag",
]
ECWID_RESPONSE_FIELDS = (
    "total,count,offset,limit,"
    "items(id,orderNumber,createDate,status,paymentStatus,fulfillmentStatus,total,email,"
    "paymentMethod,shippingOption,items(productId,name,quantity,price,sku),"
    "shippingPerson(name),billingPerson(name))"
)

app = Flask(__name__)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 31536000
ASSET_VERSION = str(int(time.time()))

CACHE_TTL_SECONDS = 300
AGENDA_EXTERNAL_CACHE_TTL_SECONDS = 43200
orders_cache: Dict[str, Any] = {
    "payload": None,
    "cached_at": 0.0,
}
cache_lock = threading.Lock()
refresh_in_progress = False
ecwid_orders_cache: Dict[str, Any] = {
    "payload": None,
    "cached_at": 0.0,
}
ecwid_orders_cache_lock = threading.Lock()
ecwid_refresh_in_progress = False
agenda_school_holidays_cache: Dict[str, Any] = {}
agenda_school_holidays_cache_lock = threading.Lock()
agenda_public_holidays_cache: Dict[str, Any] = {}
agenda_public_holidays_cache_lock = threading.Lock()
content_album_lock = threading.Lock()

PASSWORD_HASH_METHOD = os.getenv("PASSWORD_HASH_METHOD", "").strip() or "scrypt"
SESSION_IDLE_TIMEOUT_SECONDS = max(300, int(os.getenv("SESSION_IDLE_TIMEOUT_SECONDS", "3600") or "3600"))
SESSION_ABSOLUTE_TIMEOUT_SECONDS = max(
    SESSION_IDLE_TIMEOUT_SECONDS,
    int(os.getenv("SESSION_ABSOLUTE_TIMEOUT_SECONDS", "43200") or "43200"),
)
CSRF_TOKEN_LENGTH = 48
GENERIC_AUTH_ERROR_MESSAGE = "De combinatie van inloggegevens is ongeldig of de actie kon niet worden voltooid."
ALLOWED_IMAGE_EXTENSIONS = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "image/avif": {".avif"},
}
SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "img-src 'self' data: https:; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "font-src 'self' data:; "
        "connect-src 'self' https://opendata.rijksoverheid.nl https://date.nager.at; "
        "upgrade-insecure-requests"
    ),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}
RATE_LIMIT_RULES = (
    (re.compile(r"^/login$"), 5, 300, "login"),
    (re.compile(r"^/uitnodiging/[^/]+$"), 5, 600, "invite"),
    (re.compile(r"^/api/dashboard-events$"), 20, 300, "dashboard-events"),
    (re.compile(r"^/content(?:/\d+)?$"), 20, 300, "content"),
    (re.compile(r"^/trainers$"), 20, 300, "trainers"),
)


def get_asset_version() -> str:
    latest_mtime = 0
    static_root = os.path.join(os.path.dirname(__file__), "static")

    for root, _, filenames in os.walk(static_root):
        for filename in filenames:
            file_path = os.path.join(root, filename)
            try:
                latest_mtime = max(latest_mtime, int(os.path.getmtime(file_path)))
            except OSError:
                continue

    if latest_mtime:
        return str(latest_mtime)
    return ASSET_VERSION


@app.context_processor
def inject_asset_version():
    return {
        "asset_version": get_asset_version(),
        "legacy_csrf_token": ensure_csrf_token(),
    }


def load_dotenv() -> None:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_dotenv()


def get_env(name: str) -> str:
    return os.getenv(name, "").strip()


def get_env_int(name: str, default: int) -> int:
    value = get_env(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


PASSWORD_HASH_METHOD = get_env("PASSWORD_HASH_METHOD") or PASSWORD_HASH_METHOD
SESSION_IDLE_TIMEOUT_SECONDS = max(300, get_env_int("SESSION_IDLE_TIMEOUT_SECONDS", SESSION_IDLE_TIMEOUT_SECONDS))
SESSION_ABSOLUTE_TIMEOUT_SECONDS = max(
    SESSION_IDLE_TIMEOUT_SECONDS,
    get_env_int("SESSION_ABSOLUTE_TIMEOUT_SECONDS", SESSION_ABSOLUTE_TIMEOUT_SECONDS),
)
AGENDA_SCHOOL_REGION = (get_env("AGENDA_SCHOOL_REGION") or "midden").strip().lower() or "midden"


def is_placeholder_value(value: str) -> bool:
    normalized = (value or "").strip()
    if not normalized:
        return True

    lowered = normalized.lower()
    compact = re.sub(r"[^a-z0-9]+", "", lowered)
    placeholder_fragments = (
        "hierjouw",
        "replacewith",
        "placeholder",
        "example",
        "yourstore",
        "yoursecret",
        "ecwidstoreid",
        "ecwidsecrettoken",
        "moneybirdapitoken",
        "moneybirdadministrationid",
    )
    if compact == "..." or any(fragment in compact for fragment in placeholder_fragments):
        return True

    return lowered.startswith("hier_jouw_") or lowered.startswith("replace-with-") or lowered in {
        "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "12345678",
        "123456789012345678",
        "...",
    }


def get_secret_env(name: str) -> str:
    value = get_env(name)
    if value and not is_placeholder_value(value) and len(value) >= 32:
        return value
    return ""


def trusted_hosts_are_local(hosts: List[str]) -> bool:
    local_hosts = {"127.0.0.1", "localhost", "testserver"}
    normalized_hosts = {
        host.split(":", 1)[0].strip().lower()
        for host in hosts
        if host.strip()
    }
    return not normalized_hosts or normalized_hosts.issubset(local_hosts)


def should_require_configured_secret(trusted_hosts: List[str]) -> bool:
    return not app.debug and not trusted_hosts_are_local(trusted_hosts)


def get_env_bool(name: str, default: bool = False) -> bool:
    value = get_env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def get_env_int(name: str, default: int) -> int:
    value = get_env(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def configure_app() -> None:
    trusted_hosts = [item.strip() for item in get_env("TRUSTED_HOSTS").split(",") if item.strip()]
    session_cookie_secure_default = get_env_bool("SESSION_COOKIE_SECURE", default=not app.debug)
    configured_secret = get_secret_env("FLASK_SECRET_KEY")

    if not configured_secret and should_require_configured_secret(trusted_hosts):
        raise RuntimeError("FLASK_SECRET_KEY ontbreekt of is te zwak. Gebruik een random secret van minimaal 32 tekens.")

    app.config.update(
        SECRET_KEY=configured_secret or secrets.token_urlsafe(48),
        SESSION_COOKIE_NAME=get_env("SESSION_COOKIE_NAME") or "overzicht_session",
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=session_cookie_secure_default,
        SESSION_COOKIE_SAMESITE=get_env("SESSION_COOKIE_SAMESITE") or "Lax",
        PREFERRED_URL_SCHEME=get_env("PREFERRED_URL_SCHEME") or "https",
        PERMANENT_SESSION_LIFETIME=timedelta(seconds=SESSION_ABSOLUTE_TIMEOUT_SECONDS),
    )

    if trusted_hosts:
        app.config["TRUSTED_HOSTS"] = trusted_hosts

    proxy_hops = max(0, get_env_int("REVERSE_PROXY_HOPS", 1))
    if proxy_hops:
        app.wsgi_app = ProxyFix(
            app.wsgi_app,
            x_for=proxy_hops,
            x_proto=proxy_hops,
            x_host=proxy_hops,
            x_port=proxy_hops,
            x_prefix=proxy_hops,
        )


configure_app()


def is_request_secure() -> bool:
    forwarded_proto = str(request.headers.get("X-Forwarded-Proto", "") or "").split(",")[0].strip().lower()
    if forwarded_proto:
        return forwarded_proto == "https"
    return bool(getattr(request, "is_secure", False))


def should_enforce_https() -> bool:
    return get_env_bool("FORCE_HTTPS", default=app.config.get("SESSION_COOKIE_SECURE", False))


def should_skip_https_redirect() -> bool:
    host = str(request.headers.get("Host", "") or "").split(":")[0].strip().lower()
    return host in {"localhost", "127.0.0.1", "testserver"}


def get_client_ip() -> str:
    forwarded_for = str(request.headers.get("X-Forwarded-For", "") or "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    for header_name in ("X-Real-IP", "CF-Connecting-IP"):
        header_value = str(request.headers.get(header_name, "") or "").strip()
        if header_value:
            return header_value
    return str(getattr(request, "remote_addr", "") or "unknown").strip() or "unknown"


def hash_password(password: str) -> str:
    return generate_password_hash(password.strip(), method=PASSWORD_HASH_METHOD, salt_length=16)


def password_needs_rehash(password_hash: str) -> bool:
    normalized_hash = str(password_hash or "").strip()
    return bool(normalized_hash) and not normalized_hash.startswith(f"{PASSWORD_HASH_METHOD}:")


def update_user_password_hash(profile_id: str, password: str) -> None:
    with get_db_connection() as connection:
        connection.execute(
            "UPDATE trainer_profiles SET password_hash = ? WHERE id = ?",
            (hash_password(password), profile_id.strip()),
        )


def ensure_csrf_token() -> str:
    token = str(session.get("csrf_token", "") or "").strip()
    if len(token) < CSRF_TOKEN_LENGTH:
        token = secrets.token_urlsafe(36)
        session["csrf_token"] = token
    return token


def is_safe_redirect_target(target: str) -> bool:
    normalized = str(target or "").strip()
    return normalized.startswith("/") and not normalized.startswith("//")


def get_request_csrf_token() -> str:
    header_token = str(
        request.headers.get("X-CSRF-Token", "") or request.headers.get("X-CSRFToken", "") or ""
    ).strip()
    if header_token:
        return header_token
    environ = getattr(request, "environ", {}) or getattr(request, "META", {})
    if isinstance(environ, dict):
        header_token = str(environ.get("HTTP_X_CSRF_TOKEN", "") or environ.get("HTTP_X_CSRFTOKEN", "")).strip()
        if header_token:
            return header_token
    return str(request.form.get("csrf_token", "") or "").strip()


def csrf_error_response() -> Any:
    if request.path.startswith("/api/") or request_prefers_json():
        return jsonify({"error": "Ongeldig of ontbrekend CSRF-token."}), 403
    return "Ongeldig of ontbrekend CSRF-token.", 403


def validate_csrf_token() -> Optional[Any]:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return None
    session_token = ensure_csrf_token()
    request_token = get_request_csrf_token()
    if request_token and hmac.compare_digest(session_token, request_token):
        return None
    return csrf_error_response()


def rotate_authenticated_session(user_id: str) -> None:
    session.clear()
    session.permanent = True
    session["user_id"] = user_id
    session["csrf_token"] = secrets.token_urlsafe(36)
    now = int(time.time())
    session["session_started_at"] = now
    session["session_last_seen_at"] = now


def handle_session_timeout() -> Optional[Any]:
    user_id = str(session.get("user_id", "") or "").strip()
    if not user_id:
        ensure_csrf_token()
        return None

    now = int(time.time())
    started_at = int(session.get("session_started_at", now) or now)
    last_seen_at = int(session.get("session_last_seen_at", now) or now)
    expired = (now - last_seen_at) > SESSION_IDLE_TIMEOUT_SECONDS or (now - started_at) > SESSION_ABSOLUTE_TIMEOUT_SECONDS
    if expired:
        session.clear()
        ensure_csrf_token()
        if request.path.startswith("/api/"):
            return jsonify({"error": "Sessie verlopen. Log opnieuw in."}), 401
        return redirect(url_for("login_page", next=request.path))

    session["session_last_seen_at"] = now
    session.permanent = True
    ensure_csrf_token()
    return None


def get_rate_limit_rule(path: str) -> Optional[Tuple[int, int, str]]:
    for pattern, max_attempts, window_seconds, scope in RATE_LIMIT_RULES:
        if pattern.match(path):
            return max_attempts, window_seconds, scope
    return None


def apply_rate_limit(max_attempts: int, window_seconds: int, scope: str) -> Optional[int]:
    user = get_current_user()
    identity = str(user["id"]) if user is not None else ""
    request_key = f"{scope}:{get_client_ip()}:{identity}:{request.path}"
    if scope == "login":
        request_key = f"{request_key}:{request.form.get('email', '').strip().lower()[:120]}"
    if scope == "invite":
        request_key = f"{request_key}:{request.path.rsplit('/', 1)[-1]}"

    now = time.time()
    window_start = now - window_seconds

    with get_db_connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            "DELETE FROM rate_limit_attempts WHERE created_at < ?",
            (window_start,),
        )
        row = connection.execute(
            """
            SELECT COUNT(*) AS total, MIN(created_at) AS first_attempt
            FROM rate_limit_attempts
            WHERE request_key = ? AND created_at >= ?
            """,
            (request_key, window_start),
        ).fetchone()
        total_attempts = int(row["total"] or 0)
        first_attempt = float(row["first_attempt"] or now)
        if total_attempts >= max_attempts:
            retry_after = max(1, int(window_seconds - (now - first_attempt)))
            return retry_after

        connection.execute(
            "INSERT INTO rate_limit_attempts (request_key, created_at) VALUES (?, ?)",
            (request_key, now),
        )
    return None


def rate_limit_error_response(retry_after: int) -> Any:
    message = "Te veel verzoeken. Probeer het over enkele minuten opnieuw."
    if request.path.startswith("/api/") or request_prefers_json():
        return jsonify({"error": message}), 429, {"Retry-After": str(retry_after)}
    return message, 429, {"Retry-After": str(retry_after)}


def validate_image_signature(content_type: str, file_bytes: bytes) -> bool:
    if content_type == "image/jpeg":
        return file_bytes.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return file_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return len(file_bytes) > 12 and file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WEBP"
    if content_type == "image/avif":
        return len(file_bytes) > 12 and file_bytes[4:12] in {b"ftypavif", b"ftypavis"}
    return False


def apply_security_headers(response: Any) -> Any:
    for header_name, header_value in SECURITY_HEADERS.items():
        response.headers.setdefault(header_name, header_value)
    if is_request_secure():
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


def get_config() -> Dict[str, str]:
    store_id = get_env("ECWID_STORE_ID")
    secret_token = get_env("ECWID_SECRET_TOKEN")
    moneybird_token = get_env("MONEYBIRD_API_TOKEN")
    moneybird_administration_id = get_env("MONEYBIRD_ADMINISTRATION_ID")

    return {
        "store_id": "" if is_placeholder_value(store_id) else store_id,
        "secret_token": "" if is_placeholder_value(secret_token) else secret_token,
        "moneybird_token": "" if is_placeholder_value(moneybird_token) else moneybird_token,
        "moneybird_administration_id": (
            "" if is_placeholder_value(moneybird_administration_id) else moneybird_administration_id
        ),
    }


def get_content_storage_config() -> Dict[str, Any]:
    allowed_types_raw = get_env("BUNNY_IMAGE_ALLOWED_TYPES")
    allowed_types = [
        item.strip()
        for item in allowed_types_raw.split(",")
        if item.strip()
    ]
    if not allowed_types:
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/avif"]

    max_upload_mb = max(1, get_env_int("BUNNY_IMAGE_MAX_UPLOAD_MB", 15))
    max_request_mb = max(max_upload_mb, get_env_int("CONTENT_UPLOAD_MAX_REQUEST_MB", 250))
    max_upload_files = max(1, get_env_int("CONTENT_UPLOAD_MAX_FILES", 500))

    region = get_env("BUNNY_STORAGE_REGION") or "storage"
    zone = get_env("BUNNY_STORAGE_ZONE")
    access_key = get_env("BUNNY_STORAGE_ACCESS_KEY")
    api_access_key = get_env("BUNNY_API_ACCESS_KEY")
    public_base = get_env("BUNNY_IMAGE_PUBLIC_BASE").rstrip("/")
    base_path = get_env("BUNNY_IMAGE_BASE_PATH").strip().strip("/")
    if not base_path:
        base_path = "content"

    missing_config = [
        key
        for key, value in (
            ("BUNNY_STORAGE_ZONE", zone),
            ("BUNNY_STORAGE_ACCESS_KEY", access_key),
            ("BUNNY_IMAGE_PUBLIC_BASE", public_base),
        )
        if not value
    ]

    local_upload_root = get_env("LOCAL_UPLOAD_ROOT")
    if not local_upload_root:
        local_upload_root = os.path.join(os.path.dirname(__file__), "static", "uploads")

    return {
        "region": region,
        "zone": zone,
        "access_key": access_key,
        "api_access_key": api_access_key,
        "public_base": public_base,
        "base_path": base_path,
        "max_upload_mb": max_upload_mb,
        "max_request_mb": max_request_mb,
        "max_upload_files": max_upload_files,
        "allowed_types": allowed_types,
        "missing_config": missing_config,
        "bunny_enabled": not missing_config,
        "local_upload_root": local_upload_root,
    }


app.config["MAX_CONTENT_LENGTH"] = get_content_storage_config()["max_request_mb"] * 1024 * 1024


def is_public_path(path: str) -> bool:
    return path.startswith("/static/") or path in {"/login"} or path.startswith("/uitnodiging/")


def get_current_user() -> Optional[Dict[str, Any]]:
    user_id = str(session.get("user_id", "")).strip()
    if user_id:
        user = get_user_by_id(user_id)
        if user is not None:
            return user

    username = str(session.get("username", "")).strip()
    if username:
        user = get_user_by_username(username)
        if user is not None:
            session["user_id"] = user["id"]
            return user

    return None


@app.context_processor
def inject_current_user():
    return {"current_user": get_current_user()}


@app.context_processor
def inject_navigation_permissions():
    user = get_current_user()
    return {
        "visible_pages": get_visible_pages_for_user(user),
        "can_view_revenue": bool(user and user.get("isAdmin")),
        "is_social_media_manager": is_social_media_manager(user),
    }


@app.before_request
def require_login():
    if should_enforce_https() and not is_request_secure() and not should_skip_https_redirect():
        secure_url = request.url.replace("http://", "https://", 1)
        return redirect(secure_url, code=301)

    session_response = handle_session_timeout()
    if session_response is not None:
        return session_response

    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        rate_limit_rule = get_rate_limit_rule(request.path)
        if rate_limit_rule is not None:
            max_attempts, window_seconds, scope = rate_limit_rule
            retry_after = apply_rate_limit(max_attempts, window_seconds, scope)
            if retry_after is not None:
                return rate_limit_error_response(retry_after)

        csrf_response = validate_csrf_token()
        if csrf_response is not None:
            return csrf_response

    if is_public_path(request.path):
        return None

    user = get_current_user()
    if user is None:
        return redirect(url_for("login_page", next=request.path))

    session["user_id"] = user["id"]
    return None


def format_ecwid_date(value: str) -> str:
    if not value:
        return ""

    for pattern in ("%Y-%m-%d %H:%M:%S %z", "%Y-%m-%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(value, pattern)
            return parsed.isoformat()
        except ValueError:
            continue

    return value


def normalize_order(order: Dict[str, Any]) -> Dict[str, Any]:
    customer_name = (
        order.get("shippingPerson", {}).get("name")
        or order.get("billingPerson", {}).get("name")
        or "Onbekende klant"
    )
    products = order.get("items", [])

    return {
        "id": order.get("id", ""),
        "createdAt": format_ecwid_date(order.get("createDate", "")),
        "orderNumber": order.get("orderNumber") or order.get("id", ""),
        "status": order.get("status", "UNKNOWN"),
        "paymentStatus": order.get("paymentStatus", "UNKNOWN"),
        "fulfillmentStatus": order.get("fulfillmentStatus", "UNKNOWN"),
        "total": order.get("total", 0),
        "email": order.get("email", ""),
        "customerName": customer_name,
        "paymentMethod": order.get("paymentMethod", "Onbekend"),
        "shippingMethod": order.get("shippingOption", "Niet opgegeven"),
        "itemCount": sum(item.get("quantity", 0) for item in products),
        "isRefunded": order.get("paymentStatus") == "REFUNDED",
        "items": [
            {
                "productId": item.get("productId"),
                "name": item.get("name", "Naamloos product"),
                "quantity": item.get("quantity", 0),
                "price": item.get("price", 0),
                "sku": item.get("sku", ""),
            }
            for item in products
        ],
    }


def sort_orders_desc(orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def sort_key(order: Dict[str, Any]) -> datetime:
        created_at = order.get("createdAt", "")
        if not created_at:
            return datetime.min
        try:
            return datetime.fromisoformat(created_at)
        except ValueError:
            return datetime.min

    return sorted(orders, key=sort_key, reverse=True)


def decorate_orders_for_list(orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    decorated_orders = []
    for order in orders:
        created_at = order.get("createdAt", "")
        display_date = "-"
        display_time = "-"

        if created_at:
            try:
                parsed = datetime.fromisoformat(created_at)
                display_date = parsed.strftime("%d-%m-%Y")
                display_time = parsed.strftime("%H:%M")
            except ValueError:
                pass

        item_names = ", ".join(item.get("name", "Naamloos product") for item in order.get("items", []))
        decorated_order = dict(order)
        decorated_order["displayDate"] = display_date
        decorated_order["displayTime"] = display_time
        decorated_order["itemNames"] = item_names or "-"
        decorated_orders.append(decorated_order)

    return decorated_orders


def build_orders_filter_options(orders: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, str]]]:
    statuses = sorted(
        {str(order.get("status", "")).strip() for order in orders if str(order.get("status", "")).strip()}
    )
    payment_statuses = sorted(
        {
            str(order.get("paymentStatus", "")).strip()
            for order in orders
            if str(order.get("paymentStatus", "")).strip()
        }
    )
    month_map: Dict[str, str] = {}
    for order in orders:
        created_at = parse_iso_datetime(order.get("createdAt", ""))
        if created_at is None:
            continue
        month_key = created_at.strftime("%Y-%m")
        month_map[month_key] = get_month_label(month_key).capitalize()

    return {
        "statuses": [{"value": value, "label": value.replace("_", " ").title()} for value in statuses],
        "payment_statuses": [
            {"value": value, "label": value.replace("_", " ").title()} for value in payment_statuses
        ],
        "months": [
            {"value": value, "label": month_map[value]}
            for value in sorted(month_map.keys(), reverse=True)
        ],
    }


def filter_orders(
    orders: List[Dict[str, Any]],
    search_query: str = "",
    status: str = "",
    payment_status: str = "",
    month: str = "",
) -> List[Dict[str, Any]]:
    normalized_query = search_query.strip().lower()
    normalized_status = status.strip()
    normalized_payment_status = payment_status.strip()
    normalized_month = month.strip()

    filtered_orders: List[Dict[str, Any]] = []
    for order in orders:
        created_at = parse_iso_datetime(order.get("createdAt", ""))
        searchable_parts = [
            str(order.get("orderNumber", "") or ""),
            str(order.get("customerName", "") or ""),
            str(order.get("email", "") or ""),
            str(order.get("paymentMethod", "") or ""),
            str(order.get("shippingMethod", "") or ""),
        ]
        searchable_parts.extend(str(item.get("name", "") or "") for item in order.get("items", []))
        searchable_text = " ".join(searchable_parts).lower()

        if normalized_query and normalized_query not in searchable_text:
            continue
        if normalized_status and str(order.get("status", "")).strip() != normalized_status:
            continue
        if normalized_payment_status and str(order.get("paymentStatus", "")).strip() != normalized_payment_status:
            continue
        if normalized_month:
            if created_at is None or created_at.strftime("%Y-%m") != normalized_month:
                continue

        filtered_orders.append(order)

    return filtered_orders


def build_orders_page_url(page: int = 1, search_query: str = "", status: str = "", payment_status: str = "", month: str = "") -> str:
    params: Dict[str, Any] = {"page": page}
    if search_query.strip():
        params["q"] = search_query.strip()
    if status.strip():
        params["status"] = status.strip()
    if payment_status.strip():
        params["payment_status"] = payment_status.strip()
    if month.strip():
        params["month"] = month.strip()
    return url_for("orders_page", **params)


def parse_selected_order_ids(raw_ids: List[str]) -> List[str]:
    selected_ids: List[str] = []
    for raw_id in raw_ids:
        for candidate in str(raw_id or "").split(","):
            cleaned = candidate.strip()
            if cleaned and cleaned not in selected_ids:
                selected_ids.append(cleaned)
    return selected_ids


def build_team_assignment_rows(orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for order in sort_orders_desc(orders):
        created_at = parse_iso_datetime(order.get("createdAt", ""))
        display_date = created_at.strftime("%d-%m-%Y") if created_at else "-"

        for item in order.get("items", []):
            quantity = max(int(item.get("quantity") or 0), 1)
            for participant_index in range(quantity):
                rows.append(
                    {
                        "date": display_date,
                        "orderNumber": str(order.get("orderNumber", "") or order.get("id", "")),
                        "customerName": str(order.get("customerName", "") or "-"),
                        "email": str(order.get("email", "") or "-"),
                        "product": str(item.get("name", "") or "Naamloos product"),
                        "sku": str(item.get("sku", "") or "-"),
                        "participantLabel": participant_index + 1 if quantity > 1 else "",
                        "team": "",
                    }
                )

    rows.sort(key=lambda row: (row["product"].lower(), row["date"], row["customerName"].lower(), row["orderNumber"]))
    return rows


def build_team_assignment_workbook(orders: List[Dict[str, Any]]) -> BytesIO:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Teamindeling"

    worksheet["A1"] = "Teamindeling geselecteerde bestellingen"
    worksheet["A1"].font = Font(size=14, bold=True)
    worksheet.merge_cells("A1:H1")
    worksheet["A2"] = f"Gegenereerd op {datetime.now().strftime('%d-%m-%Y %H:%M')}"
    worksheet.merge_cells("A2:H2")

    headers = ["Datum", "Ordernummer", "Naam", "E-mail", "Product", "SKU", "Deelnemer", "Team"]
    header_fill = PatternFill(fill_type="solid", fgColor="111111")
    header_font = Font(color="FFFFFF", bold=True)

    for column_index, header in enumerate(headers, start=1):
        cell = worksheet.cell(row=4, column=column_index, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    for row_index, item in enumerate(build_team_assignment_rows(orders), start=5):
        worksheet.cell(row=row_index, column=1, value=item["date"])
        worksheet.cell(row=row_index, column=2, value=item["orderNumber"])
        worksheet.cell(row=row_index, column=3, value=item["customerName"])
        worksheet.cell(row=row_index, column=4, value=item["email"])
        worksheet.cell(row=row_index, column=5, value=item["product"])
        worksheet.cell(row=row_index, column=6, value=item["sku"])
        worksheet.cell(row=row_index, column=7, value=item["participantLabel"])
        worksheet.cell(row=row_index, column=8, value=item["team"])

    worksheet.freeze_panes = "A5"
    worksheet.auto_filter.ref = f"A4:H{max(5, worksheet.max_row)}"

    column_widths = {
        "A": 14,
        "B": 16,
        "C": 24,
        "D": 30,
        "E": 36,
        "F": 18,
        "G": 12,
        "H": 18,
    }
    for column, width in column_widths.items():
        worksheet.column_dimensions[column].width = width

    for row in worksheet.iter_rows(min_row=5, max_row=worksheet.max_row, min_col=1, max_col=8):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)

    buffer = BytesIO()
    workbook.save(buffer)
    buffer.seek(0)
    return buffer


def build_summary(orders: List[Dict[str, Any]]) -> Dict[str, Any]:
    revenue = sum(
        float(order.get("total") or 0)
        for order in orders
        if order.get("paymentStatus") != "REFUNDED"
    )
    return {
        "orderCount": len(orders),
        "revenue": round(revenue, 2),
        "paidCount": sum(1 for order in orders if order.get("paymentStatus") == "PAID"),
        "openCount": sum(1 for order in orders if order.get("paymentStatus") != "PAID"),
        "refundedCount": sum(1 for order in orders if order.get("paymentStatus") == "REFUNDED"),
    }


def decimal_from_value(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0"))
    except (InvalidOperation, ValueError):
        return Decimal("0")


def calculate_margin_percentage(revenue: Decimal, profit: Decimal) -> float:
    if revenue == 0:
        return 0.0

    return round(float((profit / revenue) * Decimal("100")), 1)


def get_mutation_search_text(mutation: Dict[str, Any]) -> str:
    sepa_fields = mutation.get("sepa_fields") or {}
    parts = [
        str(mutation.get("contra_account_name", "")).strip(),
        str(mutation.get("message", "")).strip(),
        str(mutation.get("description", "")).strip(),
        str(sepa_fields.get("remi", "")).strip(),
        str(sepa_fields.get("eref", "")).strip(),
        str(sepa_fields.get("sref", "")).strip(),
    ]
    return normalize_match_text(" ".join(part for part in parts if part))


def is_excluded_equity_mutation(mutation: Dict[str, Any]) -> bool:
    mutation_text = get_mutation_search_text(mutation)
    if not mutation_text:
        return False

    excluded_names = [
        "nick horst",
        "horst nick",
        "david van walstijn",
        "walstijn david",
    ]
    return any(normalize_match_text(name) in mutation_text for name in excluded_names)


def is_expense_payment(payment: Dict[str, Any]) -> bool:
    invoice_type = str(payment.get("invoice_type", "")).strip()
    return invoice_type in {"Document", "PurchaseInvoice", "Receipt", "PurchaseTransaction"}


def has_expense_booking(mutation: Dict[str, Any], ledger_account_types: Dict[str, str]) -> bool:
    for booking in mutation.get("ledger_account_bookings") or []:
        ledger_account_id = str(booking.get("ledger_account_id", "")).strip()
        if ledger_account_types.get(ledger_account_id) in {"expenses", "direct_costs"}:
            return True
    return False


def is_cost_mutation(mutation: Dict[str, Any], ledger_account_types: Dict[str, str]) -> bool:
    mutation_amount = decimal_from_value(mutation.get("amount"))
    if mutation_amount >= 0 or is_excluded_equity_mutation(mutation):
        return False

    if any(is_expense_payment(payment) for payment in (mutation.get("payments") or [])):
        return True

    return has_expense_booking(mutation, ledger_account_types)


def build_report_summary(ecwid_summary: Dict[str, Any], moneybird_summary: Dict[str, Any]) -> Dict[str, Any]:
    ecwid_revenue = decimal_from_value(ecwid_summary.get("revenue"))
    moneybird_revenue = decimal_from_value(moneybird_summary.get("revenue_received"))
    expenses_total = decimal_from_value(moneybird_summary.get("expenses_total"))
    total_revenue = ecwid_revenue + moneybird_revenue
    total_profit = total_revenue - expenses_total

    return {
        "ecwidRevenue": round(float(ecwid_revenue), 2),
        "moneybirdRevenue": round(float(moneybird_revenue), 2),
        "combinedRevenue": round(float(total_revenue), 2),
        "expensesTotal": round(float(expenses_total), 2),
        "profitTotal": round(float(total_profit), 2),
        "profitMarginPercentage": calculate_margin_percentage(total_revenue, total_profit),
        "moneybirdInvoiceCount": moneybird_summary.get("invoiceCount", 0),
        "moneybirdAdministrationName": moneybird_summary.get("administrationName", ""),
        "moneybirdLastSyncedAt": moneybird_summary.get("lastSyncedAt", ""),
    }


def get_default_dashboard_events() -> List[Dict[str, Any]]:
    return [
        {"label": "Voetbaldag VV Voorst", "matchTerms": ["vv voorst voetbaldag"]},
        {"label": "Voetbaldag SV Harfsen", "matchTerms": ["sv harfsen voetbaldag"]},
        {"label": "Voetbaldag WWNA", "matchTerms": ["wwna voetbaldag"]},
        {"label": "SummerCamp ABS", "matchTerms": ["apeldoornse boys"]},
        {
            "label": "SummerCamp SC Terschelling",
            "matchTerms": ["sc terschelling summercamp", "summercamp sc terschelling"],
        },
    ]


def get_db_connection() -> sqlite3.Connection:
    os.makedirs(DATA_DIR, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    return connection


def bootstrap_seed_data_files() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.abspath(DATA_DIR) == os.path.abspath(BUNDLED_DATA_DIR):
        return

    for filename in ("app.db", "dashboard_events.json", "agenda_trainings.json"):
        source_path = os.path.join(BUNDLED_DATA_DIR, filename)
        target_path = os.path.join(DATA_DIR, filename)
        if os.path.exists(target_path) or not os.path.exists(source_path):
            continue
        shutil.copy2(source_path, target_path)


def sync_seed_workspace_data() -> None:
    if os.path.abspath(DATA_DIR) == os.path.abspath(BUNDLED_DATA_DIR):
        return

    source_db_path = os.path.join(BUNDLED_DATA_DIR, "app.db")
    if not os.path.exists(source_db_path) or not os.path.exists(DATABASE_PATH):
        return

    with sqlite3.connect(DATABASE_PATH, timeout=30) as connection:
        connection.execute("ATTACH DATABASE ? AS seed", (source_db_path,))
        target_tables = {
            str(row[0])
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        seed_tables = {
            str(row[0])
            for row in connection.execute(
                "SELECT name FROM seed.sqlite_master WHERE type = 'table'"
            ).fetchall()
        }

        if {"trainer_profiles"} <= target_tables and {"trainer_profiles"} <= seed_tables:
            connection.execute(
                """
                INSERT INTO trainer_profiles (
                    id,
                    full_name,
                    email,
                    username,
                    role,
                    phone,
                    notes,
                    status,
                    created_at,
                    password_hash,
                    is_admin,
                    member_type,
                    system_role,
                    knvb_license,
                    education,
                    availability_days,
                    invite_token,
                    invite_expires_at,
                    invite_accepted_at
                )
                SELECT
                    seed_profile.id,
                    seed_profile.full_name,
                    seed_profile.email,
                    seed_profile.username,
                    seed_profile.role,
                    seed_profile.phone,
                    seed_profile.notes,
                    seed_profile.status,
                    seed_profile.created_at,
                    seed_profile.password_hash,
                    seed_profile.is_admin,
                    seed_profile.member_type,
                    seed_profile.system_role,
                    seed_profile.knvb_license,
                    seed_profile.education,
                    seed_profile.availability_days,
                    seed_profile.invite_token,
                    seed_profile.invite_expires_at,
                    seed_profile.invite_accepted_at
                FROM seed.trainer_profiles AS seed_profile
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM trainer_profiles AS live_profile
                    WHERE live_profile.id = seed_profile.id
                       OR lower(live_profile.email) = lower(seed_profile.email)
                )
                """
            )

        if {"content_albums", "content_photos"} <= target_tables and {"content_albums", "content_photos"} <= seed_tables:
            connection.execute(
                """
                INSERT INTO content_albums (title, slug, created_at)
                SELECT seed_album.title, seed_album.slug, seed_album.created_at
                FROM seed.content_albums AS seed_album
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM content_albums AS live_album
                    WHERE live_album.slug = seed_album.slug
                )
                """
            )
            connection.execute(
                """
                INSERT INTO content_photos (
                    album_id,
                    image_url,
                    remote_path,
                    file_name,
                    original_name,
                    content_type,
                    file_size,
                    storage_backend,
                    uploaded_at
                )
                SELECT
                    live_album.id,
                    seed_photo.image_url,
                    seed_photo.remote_path,
                    seed_photo.file_name,
                    seed_photo.original_name,
                    seed_photo.content_type,
                    seed_photo.file_size,
                    seed_photo.storage_backend,
                    seed_photo.uploaded_at
                FROM seed.content_photos AS seed_photo
                JOIN seed.content_albums AS seed_album
                    ON seed_album.id = seed_photo.album_id
                JOIN content_albums AS live_album
                    ON live_album.slug = seed_album.slug
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM content_photos AS live_photo
                    WHERE live_photo.remote_path = seed_photo.remote_path
                )
                """
            )

        connection.commit()
        connection.execute("DETACH DATABASE seed")


def init_db() -> None:
    with get_db_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS dashboard_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id TEXT,
                label TEXT NOT NULL,
                match_terms TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agenda_trainings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                date TEXT NOT NULL,
                time TEXT NOT NULL,
                end_time TEXT,
                location TEXT,
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS agenda_day_plans (
                date TEXT PRIMARY KEY,
                plan_type TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS trainer_profiles (
                id TEXT PRIMARY KEY,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                username TEXT NOT NULL,
                password_hash TEXT,
                invite_token TEXT,
                invite_expires_at TEXT,
                invite_accepted_at TEXT,
                role TEXT NOT NULL,
                member_type TEXT,
                system_role TEXT,
                knvb_license TEXT,
                education TEXT,
                availability_days TEXT,
                phone TEXT,
                notes TEXT,
                is_admin INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_profiles_username
            ON trainer_profiles (username COLLATE NOCASE);

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                due_date TEXT NOT NULL,
                is_done INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS dashboard_preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS social_media_ideas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                platform TEXT NOT NULL,
                content_type TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'Midden',
                is_scheduled INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS social_media_schedule (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                platform TEXT NOT NULL,
                publish_date TEXT NOT NULL,
                publish_time TEXT NOT NULL,
                status TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS content_albums (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS content_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                album_id INTEGER NOT NULL,
                image_url TEXT NOT NULL,
                remote_path TEXT NOT NULL,
                file_name TEXT NOT NULL,
                original_name TEXT,
                content_type TEXT,
                file_size INTEGER NOT NULL DEFAULT 0,
                storage_backend TEXT NOT NULL DEFAULT 'local',
                uploaded_at TEXT NOT NULL,
                FOREIGN KEY (album_id) REFERENCES content_albums(id)
            );

            CREATE TABLE IF NOT EXISTS rate_limit_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_key TEXT NOT NULL,
                created_at REAL NOT NULL
            );
            """
        )

        existing_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(trainer_profiles)").fetchall()
        }
        if "password_hash" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN password_hash TEXT")
        if "invite_token" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN invite_token TEXT")
        if "invite_expires_at" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN invite_expires_at TEXT")
        if "invite_accepted_at" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN invite_accepted_at TEXT")
        if "is_admin" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
        if "member_type" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN member_type TEXT")
        if "system_role" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN system_role TEXT")
        if "knvb_license" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN knvb_license TEXT")
        if "education" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN education TEXT")
        if "availability_days" not in existing_columns:
            connection.execute("ALTER TABLE trainer_profiles ADD COLUMN availability_days TEXT")

        social_ideas_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(social_media_ideas)").fetchall()
        }
        if "priority" not in social_ideas_columns:
            connection.execute("ALTER TABLE social_media_ideas ADD COLUMN priority TEXT NOT NULL DEFAULT 'Midden'")
        if "is_scheduled" not in social_ideas_columns:
            connection.execute("ALTER TABLE social_media_ideas ADD COLUMN is_scheduled INTEGER NOT NULL DEFAULT 0")

        content_photo_columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(content_photos)").fetchall()
        }
        if "original_name" not in content_photo_columns:
            connection.execute("ALTER TABLE content_photos ADD COLUMN original_name TEXT")
        if "content_type" not in content_photo_columns:
            connection.execute("ALTER TABLE content_photos ADD COLUMN content_type TEXT")
        if "file_size" not in content_photo_columns:
            connection.execute("ALTER TABLE content_photos ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0")
        if "storage_backend" not in content_photo_columns:
            connection.execute("ALTER TABLE content_photos ADD COLUMN storage_backend TEXT NOT NULL DEFAULT 'local'")

        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_content_photos_album_uploaded
            ON content_photos (album_id, uploaded_at ASC, id ASC)
            """
        )

        duplicate_email = connection.execute(
            """
            SELECT lower(email) AS email_key, COUNT(*) AS total
            FROM trainer_profiles
            GROUP BY lower(email)
            HAVING COUNT(*) > 1
            LIMIT 1
            """
        ).fetchone()
        if duplicate_email is None:
            connection.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_profiles_email
                ON trainer_profiles (email COLLATE NOCASE)
                """
            )
        connection.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_trainer_profiles_invite_token
            ON trainer_profiles (invite_token)
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_lookup
            ON rate_limit_attempts (request_key, created_at)
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_agenda_day_plans_date
            ON agenda_day_plans (date)
            """
        )


def table_has_rows(table_name: str) -> bool:
    with get_db_connection() as connection:
        row = connection.execute(f"SELECT 1 FROM {table_name} LIMIT 1").fetchone()
    return row is not None


def migrate_dashboard_events_json_to_db() -> None:
    if table_has_rows("dashboard_events"):
        return

    events = get_default_dashboard_events()
    if os.path.exists(DASHBOARD_EVENTS_PATH):
        try:
            with open(DASHBOARD_EVENTS_PATH, "r", encoding="utf-8") as config_file:
                data = json.load(config_file)
            if isinstance(data, list) and data:
                events = data
        except (OSError, json.JSONDecodeError):
            pass

    save_dashboard_events_config(events)


def migrate_agenda_trainings_json_to_db() -> None:
    if table_has_rows("agenda_trainings") or not os.path.exists(AGENDA_TRAININGS_PATH):
        return

    try:
        with open(AGENDA_TRAININGS_PATH, "r", encoding="utf-8") as trainings_file:
            data = json.load(trainings_file)
    except (OSError, json.JSONDecodeError):
        return

    if not isinstance(data, list):
        return

    trainings = []
    for item in data:
        if not isinstance(item, dict):
            continue
        trainings.append(
            {
                "id": str(item.get("id", "")).strip() or str(int(time.time() * 1000)),
                "title": str(item.get("title", "")).strip(),
                "date": str(item.get("date", "")).strip(),
                "time": str(item.get("time", "")).strip(),
                "endTime": str(item.get("endTime", "")).strip(),
                "location": str(item.get("location", "")).strip(),
                "notes": str(item.get("notes", "")).strip(),
            }
        )

    if trainings:
        save_agenda_trainings(trainings)


def run_storage_migrations() -> None:
    bootstrap_seed_data_files()
    init_db()
    migrate_dashboard_events_json_to_db()
    migrate_agenda_trainings_json_to_db()
    sync_seed_workspace_data()
    seed_workspace_tables()
    ensure_admin_account()


def load_dashboard_events_config() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT product_id, label, match_terms
            FROM dashboard_events
            ORDER BY id ASC
            """
        ).fetchall()

    if not rows:
        return get_default_dashboard_events()

    cleaned = []
    for row in rows:
        try:
            match_terms = json.loads(row["match_terms"] or "[]")
        except json.JSONDecodeError:
            match_terms = []
        cleaned.append(
            {
                "productId": row["product_id"],
                "label": row["label"] or "Onbekend event",
                "matchTerms": match_terms if isinstance(match_terms, list) else [],
            }
        )

    return cleaned or get_default_dashboard_events()


def normalize_match_text(value: str) -> str:
    return "".join(char.lower() if char.isalnum() else " " for char in value).strip()


def matches_configured_event(item_name: str, configured_event: Dict[str, Any], product_id: Any) -> bool:
    configured_product_id = configured_event.get("productId")
    if configured_product_id is not None:
        if product_id is None:
            return False
        return str(configured_product_id) == str(product_id)

    normalized_item_name = normalize_match_text(item_name)
    item_tokens = {token for token in normalized_item_name.split() if token}

    for raw_term in configured_event.get("matchTerms", []):
        normalized_term = normalize_match_text(str(raw_term))
        term_tokens = {token for token in normalized_term.split() if token}
        if term_tokens and term_tokens.issubset(item_tokens):
            return True

    return False


def save_dashboard_events_config(events: List[Dict[str, Any]]) -> None:
    with get_db_connection() as connection:
        connection.execute("DELETE FROM dashboard_events")
        connection.executemany(
            """
            INSERT INTO dashboard_events (product_id, label, match_terms)
            VALUES (?, ?, ?)
            """,
            [
                (
                    None if item.get("productId") is None else str(item.get("productId")),
                    str(item.get("label", "")).strip() or "Onbekend event",
                    json.dumps(item.get("matchTerms", []), ensure_ascii=True),
                )
                for item in events
            ],
        )


def load_agenda_trainings(start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    query = """
        SELECT id, title, date, time, end_time, location, notes
        FROM agenda_trainings
    """
    params: List[str] = []
    conditions: List[str] = []

    normalized_start_date = str(start_date or "").strip()
    normalized_end_date = str(end_date or "").strip()

    if normalized_start_date:
        conditions.append("date >= ?")
        params.append(normalized_start_date)
    if normalized_end_date:
        conditions.append("date <= ?")
        params.append(normalized_end_date)
    if conditions:
        query += "\n        WHERE " + " AND ".join(conditions)
    query += "\n        ORDER BY date ASC, time ASC"

    with get_db_connection() as connection:
        rows = connection.execute(query, params).fetchall()

    trainings = []
    for row in rows:
        trainings.append(
            {
                "id": str(row["id"]),
                "title": str(row["title"] or "").strip(),
                "date": str(row["date"] or "").strip(),
                "time": str(row["time"] or "").strip(),
                "endTime": str(row["end_time"] or "").strip(),
                "location": str(row["location"] or "").strip(),
                "notes": str(row["notes"] or "").strip(),
            }
        )

    return trainings


def save_agenda_trainings(trainings: List[Dict[str, Any]]) -> None:
    with get_db_connection() as connection:
        connection.execute("DELETE FROM agenda_trainings")
        connection.executemany(
            """
            INSERT INTO agenda_trainings (id, title, date, time, end_time, location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    str(item.get("id", "")).strip(),
                    str(item.get("title", "")).strip(),
                    str(item.get("date", "")).strip(),
                    str(item.get("time", "")).strip(),
                    str(item.get("endTime", "")).strip(),
                    str(item.get("location", "")).strip(),
                    str(item.get("notes", "")).strip(),
                )
                for item in trainings
                if str(item.get("id", "")).strip()
            ],
        )


def add_agenda_training(
    title: str,
    date_value: str,
    time_value: str,
    end_time_value: str,
    location: str,
    notes: str,
) -> None:
    trainings = load_agenda_trainings()
    trainings.append(
        {
            "id": str(int(time.time() * 1000)),
            "title": title.strip(),
            "date": date_value.strip(),
            "time": time_value.strip(),
            "endTime": end_time_value.strip(),
            "location": location.strip(),
            "notes": notes.strip(),
        }
    )
    save_agenda_trainings(trainings)


def is_allowed_agenda_day_plan(plan_type: str) -> bool:
    return str(plan_type or "").strip() in AGENDA_DAY_PLAN_OPTIONS


def load_agenda_day_plans(date_values: List[str]) -> Dict[str, str]:
    normalized_dates = [str(value or "").strip() for value in date_values if str(value or "").strip()]
    if not normalized_dates:
        return {}

    placeholders = ",".join("?" for _ in normalized_dates)
    with get_db_connection() as connection:
        rows = connection.execute(
            f"""
            SELECT date, plan_type
            FROM agenda_day_plans
            WHERE date IN ({placeholders})
            """,
            normalized_dates,
        ).fetchall()

    return {
        str(row["date"] or "").strip(): str(row["plan_type"] or "").strip()
        for row in rows
        if str(row["date"] or "").strip() and str(row["plan_type"] or "").strip()
    }


def load_all_agenda_day_plans() -> List[Dict[str, str]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT date, plan_type
            FROM agenda_day_plans
            ORDER BY date
            """
        ).fetchall()

    return [
        {
            "date": str(row["date"] or "").strip(),
            "planType": str(row["plan_type"] or "").strip(),
        }
        for row in rows
        if str(row["date"] or "").strip() and str(row["plan_type"] or "").strip()
    ]


def normalize_agenda_summary_filter(value: Any) -> str:
    normalized_value = str(value or "").strip().lower()
    valid_keys = {str(option.get("key") or "").strip() for option in AGENDA_SUMMARY_FILTER_OPTIONS}
    return normalized_value if normalized_value in valid_keys else "total"


def get_agenda_summary_filter_option(filter_key: str) -> Dict[str, Any]:
    normalized_key = normalize_agenda_summary_filter(filter_key)
    for option in AGENDA_SUMMARY_FILTER_OPTIONS:
        if option.get("key") == normalized_key:
            return option
    return AGENDA_SUMMARY_FILTER_OPTIONS[0]


def filter_agenda_day_plans_for_summary(day_plans: List[Dict[str, Any]], filter_key: str) -> List[Dict[str, Any]]:
    selected_filter = get_agenda_summary_filter_option(filter_key)
    start_date = selected_filter.get("start")
    end_date = selected_filter.get("end")
    if not isinstance(start_date, date) or not isinstance(end_date, date):
        return list(day_plans)

    filtered_day_plans: List[Dict[str, Any]] = []
    for day_plan in day_plans:
        current_date = day_plan.get("date")
        if isinstance(current_date, str):
            current_date = parse_iso_date(current_date.strip())
        if not isinstance(current_date, date):
            continue
        if start_date <= current_date <= end_date:
            filtered_day_plans.append(day_plan)

    return filtered_day_plans


def save_agenda_day_plans(day_plans: Dict[str, str], replace_dates: Optional[List[str]] = None) -> None:
    cleaned_rows: List[Tuple[str, str, str]] = []
    for raw_date, raw_plan_type in day_plans.items():
        date_value = str(raw_date or "").strip()
        plan_type = str(raw_plan_type or "").strip()
        if not date_value:
            continue
        if parse_iso_date(date_value) is None:
            raise ValueError("Ongeldige datum voor dagplanning.")
        if not plan_type:
            continue
        if not is_allowed_agenda_day_plan(plan_type):
            raise ValueError("Ongeldig agendatype gekozen.")
        cleaned_rows.append((date_value, plan_type, utcnow_iso()))

    target_dates = [
        str(value or "").strip()
        for value in (replace_dates or [row[0] for row in cleaned_rows])
        if str(value or "").strip()
    ]
    for date_value in target_dates:
        if parse_iso_date(date_value) is None:
            raise ValueError("Ongeldige datum voor dagplanning.")

    with get_db_connection() as connection:
        if target_dates:
            placeholders = ",".join("?" for _ in target_dates)
            connection.execute(
                f"DELETE FROM agenda_day_plans WHERE date IN ({placeholders})",
                target_dates,
            )
        connection.executemany(
            """
            INSERT INTO agenda_day_plans (date, plan_type, updated_at)
            VALUES (?, ?, ?)
            """,
            cleaned_rows,
        )


def utcnow_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat()


def save_dashboard_preference(key: str, value: str) -> None:
    with get_db_connection() as connection:
        connection.execute(
            """
            INSERT INTO dashboard_preferences (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, value),
        )


def load_dashboard_weather_settings() -> Dict[str, str]:
    defaults = {
        "weather_name": "Deventer",
        "weather_lat": "52.25",
        "weather_lon": "6.16",
    }
    with get_db_connection() as connection:
        rows = connection.execute(
            "SELECT key, value FROM dashboard_preferences WHERE key IN ('weather_name', 'weather_lat', 'weather_lon')"
        ).fetchall()

    settings = dict(defaults)
    for row in rows:
        settings[str(row["key"])] = str(row["value"])
    return settings


def load_tasks() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, due_date, is_done, created_at
            FROM tasks
            ORDER BY is_done ASC, due_date ASC, created_at DESC
            """
        ).fetchall()

    return [
        {
            "id": int(row["id"]),
            "title": str(row["title"] or "").strip(),
            "dueDate": str(row["due_date"] or "").strip(),
            "isDone": bool(row["is_done"]),
            "createdAt": str(row["created_at"] or "").strip(),
        }
        for row in rows
    ]


def add_task(title: str, due_date: str) -> None:
    with get_db_connection() as connection:
        connection.execute(
            "INSERT INTO tasks (title, due_date, is_done, created_at) VALUES (?, ?, 0, ?)",
            (title.strip(), due_date.strip(), utcnow_iso()),
        )


def toggle_task(task_id: int) -> None:
    with get_db_connection() as connection:
        connection.execute(
            """
            UPDATE tasks
            SET is_done = CASE WHEN is_done = 1 THEN 0 ELSE 1 END
            WHERE id = ?
            """,
            (task_id,),
        )


def delete_task(task_id: int) -> None:
    with get_db_connection() as connection:
        connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))


def load_social_media_ideas() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, platform, content_type, priority, is_scheduled, notes, created_at
            FROM social_media_ideas
            ORDER BY created_at DESC, id DESC
            """
        ).fetchall()

    return [
        {
            "platforms": parse_social_media_platforms(row["platform"]),
            "id": int(row["id"]),
            "title": str(row["title"] or "").strip(),
            "platform": format_social_media_platforms(parse_social_media_platforms(row["platform"])),
            "contentType": str(row["content_type"] or "").strip(),
            "priority": str(row["priority"] or "Midden").strip() or "Midden",
            "isScheduled": bool(row["is_scheduled"]),
            "notes": str(row["notes"] or "").strip(),
            "createdAt": str(row["created_at"] or "").strip(),
        }
        for row in rows
    ]


def parse_social_media_platforms(raw_value: Any) -> List[str]:
    values: List[str] = []
    seen: set[str] = set()

    for part in str(raw_value or "").split(","):
        platform = part.strip()
        if not platform or platform in seen:
            continue
        values.append(platform)
        seen.add(platform)

    return values


def format_social_media_platforms(platforms: List[str]) -> str:
    return ", ".join(platforms)


def add_social_media_idea(title: str, platforms: List[str], content_type: str, priority: str, notes: str) -> None:
    with get_db_connection() as connection:
        connection.execute(
            """
            INSERT INTO social_media_ideas (title, platform, content_type, priority, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                title.strip(),
                format_social_media_platforms(platforms),
                content_type.strip(),
                priority.strip() or "Midden",
                notes.strip(),
                utcnow_iso(),
            ),
        )


def update_social_media_idea(idea_id: int, title: str, platforms: List[str], content_type: str, priority: str, notes: str) -> None:
    with get_db_connection() as connection:
        connection.execute(
            """
            UPDATE social_media_ideas
            SET
                title = ?,
                platform = ?,
                content_type = ?,
                priority = ?,
                notes = ?
            WHERE id = ?
            """,
            (
                title.strip(),
                format_social_media_platforms(platforms),
                content_type.strip(),
                priority.strip() or "Midden",
                notes.strip(),
                idea_id,
            ),
        )


def set_social_media_idea_scheduled(idea_id: int, is_scheduled: bool) -> None:
    with get_db_connection() as connection:
        connection.execute(
            "UPDATE social_media_ideas SET is_scheduled = ? WHERE id = ?",
            (1 if is_scheduled else 0, idea_id),
        )


def delete_social_media_idea(idea_id: int) -> None:
    with get_db_connection() as connection:
        connection.execute("DELETE FROM social_media_ideas WHERE id = ?", (idea_id,))


def load_social_media_schedule() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, title, platform, publish_date, publish_time, status, notes, created_at
            FROM social_media_schedule
            ORDER BY publish_date ASC, publish_time ASC, id ASC
            """
        ).fetchall()

    return [
        {
            "id": int(row["id"]),
            "title": str(row["title"] or "").strip(),
            "platform": str(row["platform"] or "").strip(),
            "publishDate": str(row["publish_date"] or "").strip(),
            "publishTime": str(row["publish_time"] or "").strip(),
            "status": str(row["status"] or "").strip(),
            "notes": str(row["notes"] or "").strip(),
            "createdAt": str(row["created_at"] or "").strip(),
        }
        for row in rows
    ]


def build_social_media_week_events(schedule_items: List[Dict[str, Any]], week_start: date) -> List[Dict[str, Any]]:
    calendar_start_minutes = 0
    pixels_per_hour = 56
    week_end = week_start + timedelta(days=6)
    events = []

    for item in schedule_items:
        publish_date = str(item.get("publishDate", "")).strip()
        publish_time = str(item.get("publishTime", "")).strip()
        if not publish_date or not publish_time:
            continue

        item_date = date.fromisoformat(publish_date)
        if item_date < week_start or item_date > week_end:
            continue

        start_dt = combine_date_and_time(publish_date, publish_time)
        end_dt = start_dt + timedelta(minutes=60)
        start_minutes = start_dt.hour * 60 + start_dt.minute
        end_minutes = end_dt.hour * 60 + end_dt.minute
        top = max(((start_minutes - calendar_start_minutes) / 60) * pixels_per_hour, 0)
        height = max(((end_minutes - start_minutes) / 60) * pixels_per_hour, 48)

        events.append(
            {
                "id": item["id"],
                "title": item["title"],
                "date": publish_date,
                "time": publish_time,
                "endTime": end_dt.strftime("%H:%M"),
                "location": item.get("platform", ""),
                "notes": item.get("notes", ""),
                "status": item.get("status", ""),
                "dayIndex": (item_date - week_start).days,
                "top": round(top, 1),
                "height": round(height, 1),
            }
        )

    return events


def add_social_media_schedule_item(
    title: str,
    platform: str,
    publish_date: str,
    publish_time: str,
    status: str,
    notes: str,
) -> None:
    with get_db_connection() as connection:
        connection.execute(
            """
            INSERT INTO social_media_schedule (title, platform, publish_date, publish_time, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                title.strip(),
                platform.strip(),
                publish_date.strip(),
                publish_time.strip(),
                status.strip(),
                notes.strip(),
                utcnow_iso(),
            ),
        )


def update_social_media_schedule_item(
    item_id: int,
    title: str,
    platform: str,
    publish_date: str,
    publish_time: str,
    status: str,
    notes: str,
) -> None:
    with get_db_connection() as connection:
        connection.execute(
            """
            UPDATE social_media_schedule
            SET
                title = ?,
                platform = ?,
                publish_date = ?,
                publish_time = ?,
                status = ?,
                notes = ?
            WHERE id = ?
            """,
            (
                title.strip(),
                platform.strip(),
                publish_date.strip(),
                publish_time.strip(),
                status.strip(),
                notes.strip(),
                item_id,
            ),
        )


def delete_social_media_schedule_item(item_id: int) -> None:
    with get_db_connection() as connection:
        connection.execute("DELETE FROM social_media_schedule WHERE id = ?", (item_id,))


def slugify_value(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return slug or "album"


def sanitize_upload_filename(file_name: str) -> str:
    normalized = unicodedata.normalize("NFKD", file_name or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    sanitized = re.sub(r"[^a-zA-Z0-9._-]+", "-", ascii_value).strip(".-_")
    return sanitized or f"bestand-{int(time.time())}.bin"


def format_datetime_display(value: str, fallback: str = "-") -> str:
    parsed = parse_iso_datetime(value)
    if parsed is None:
        return fallback
    return parsed.strftime("%d-%m-%Y %H:%M")


def can_manage_content(user: Optional[Dict[str, Any]]) -> bool:
    if not user:
        return False
    return bool(user.get("isAdmin")) or is_social_media_manager(user)


def derive_recovered_album_title(album_id: int, remote_path: str) -> str:
    normalized_path = str(remote_path or "").strip().strip("/")
    path_parts = [part for part in normalized_path.split("/") if part]
    if len(path_parts) >= 3:
        candidate = path_parts[2]
        if "-" in candidate:
            candidate = candidate.split("-", 1)[1]
        candidate = candidate.replace("-", " ").strip()
        if candidate:
            return candidate.title()
    return f"Hersteld album {album_id}"


def ensure_content_album_records_exist() -> int:
    with get_db_connection() as connection:
        orphan_rows = connection.execute(
            """
            SELECT
                cp.album_id,
                MIN(cp.uploaded_at) AS first_uploaded_at,
                MIN(cp.remote_path) AS sample_remote_path
            FROM content_photos cp
            LEFT JOIN content_albums ca ON ca.id = cp.album_id
            WHERE ca.id IS NULL
            GROUP BY cp.album_id
            ORDER BY cp.album_id ASC
            """
        ).fetchall()

        if not orphan_rows:
            return 0

        repaired_total = 0
        for row in orphan_rows:
            album_id = int(row["album_id"])
            title = derive_recovered_album_title(album_id, str(row["sample_remote_path"] or "").strip())
            connection.execute(
                """
                INSERT INTO content_albums (id, title, slug, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    album_id,
                    title,
                    slugify_value(title),
                    str(row["first_uploaded_at"] or "").strip() or datetime.utcnow().isoformat(),
                ),
            )
            repaired_total += 1

    return repaired_total


def build_content_storage_status() -> Dict[str, Any]:
    config = get_content_storage_config()
    return {
        "mode_label": "Bunny.net" if config["bunny_enabled"] else "Lokale opslag",
        "is_bunny_enabled": config["bunny_enabled"],
        "missing_config": config["missing_config"],
        "base_path": config["base_path"],
        "max_upload_mb": config["max_upload_mb"],
        "max_request_mb": config["max_request_mb"],
        "max_upload_files": config["max_upload_files"],
        "allowed_types": config["allowed_types"],
    }


def request_prefers_json() -> bool:
    accept = str(request.headers.get("Accept", "") or "").lower()
    requested_with = str(request.headers.get("X-Requested-With", "") or "").lower()
    return "application/json" in accept or requested_with == "xmlhttprequest"


def get_bunny_storage_host(region: str) -> str:
    normalized_region = (region or "storage").strip().lower()
    if normalized_region == "storage":
        return "https://storage.bunnycdn.com"
    return f"https://{normalized_region}.storage.bunnycdn.com"


def upload_content_bytes(remote_path: str, content: bytes, content_type: str) -> Dict[str, str]:
    config = get_content_storage_config()
    normalized_remote_path = remote_path.strip().strip("/")
    if not normalized_remote_path:
        raise ValueError("Geen uploadpad opgegeven.")

    if config["bunny_enabled"]:
        upload_url = f"{get_bunny_storage_host(config['region'])}/{config['zone']}/{normalized_remote_path}"
        checksum = hashlib.sha256(content).hexdigest().upper()
        response = requests.put(
            upload_url,
            headers={
                "AccessKey": config["access_key"],
                "Content-Type": content_type,
                "Checksum": checksum,
                "Content-Length": str(len(content)),
            },
            data=content,
            timeout=60,
        )
        response.raise_for_status()
        return {
            "url": f"{config['public_base']}/{normalized_remote_path}",
            "storage_backend": "bunny",
        }

    local_root = config["local_upload_root"]
    local_path = os.path.join(local_root, *normalized_remote_path.split("/"))
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "wb") as local_file:
        local_file.write(content)
    return {
        "url": f"/static/uploads/{normalized_remote_path}",
        "storage_backend": "local",
    }


def delete_content_file(remote_path: str, storage_backend: str) -> None:
    normalized_remote_path = str(remote_path or "").strip().strip("/")
    if not normalized_remote_path:
        return

    if storage_backend == "bunny":
        config = get_content_storage_config()
        if not config["bunny_enabled"]:
            return
        delete_url = f"{get_bunny_storage_host(config['region'])}/{config['zone']}/{normalized_remote_path}"
        response = requests.delete(
            delete_url,
            headers={"AccessKey": config["access_key"]},
            timeout=30,
        )
        if response.status_code not in {200, 201, 202, 204, 404}:
            response.raise_for_status()
        if response.status_code != 404:
            try:
                purge_content_url(f"{config['public_base']}/{normalized_remote_path}")
            except requests.RequestException:
                pass
        return

    local_root = get_content_storage_config()["local_upload_root"]
    local_path = os.path.join(local_root, *normalized_remote_path.split("/"))
    if os.path.exists(local_path):
        os.remove(local_path)


def purge_content_url(public_url: str) -> bool:
    config = get_content_storage_config()
    api_access_key = str(config.get("api_access_key") or "").strip()
    normalized_public_url = str(public_url or "").strip()
    if not api_access_key or not normalized_public_url:
        return False

    response = requests.post(
        "https://api.bunny.net/purge",
        headers={"AccessKey": api_access_key},
        params={
            "url": normalized_public_url,
            "async": "false",
        },
        timeout=30,
    )
    response.raise_for_status()
    return True


def create_content_album(title: str) -> int:
    slug = slugify_value(title)
    created_at = datetime.utcnow().isoformat()
    with get_db_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO content_albums (title, slug, created_at)
            VALUES (?, ?, ?)
            """,
            (title.strip(), slug, created_at),
        )
        return int(cursor.lastrowid)


def find_content_album_by_title(title: str) -> Optional[Dict[str, Any]]:
    normalized_title = str(title or "").strip()
    if not normalized_title:
        return None

    with get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT id
            FROM content_albums
            WHERE lower(trim(title)) = lower(trim(?))
            ORDER BY created_at ASC, id ASC
            LIMIT 1
            """,
            (normalized_title,),
        ).fetchone()

    if row is None:
        return None
    return load_content_album(int(row["id"]))


def load_content_album(album_id: int) -> Optional[Dict[str, Any]]:
    ensure_content_album_records_exist()
    with get_db_connection() as connection:
        album_row = connection.execute(
            """
            SELECT id, title, slug, created_at
            FROM content_albums
            WHERE id = ?
            """,
            (album_id,),
        ).fetchone()
        if album_row is None:
            return None

        stats_row = connection.execute(
            """
            SELECT
                COUNT(*) AS photo_count,
                MIN(uploaded_at) AS first_uploaded_at,
                MAX(uploaded_at) AS last_uploaded_at
            FROM content_photos
            WHERE album_id = ?
            """,
            (album_id,),
        ).fetchone()

        cover_row = connection.execute(
            """
            SELECT image_url
            FROM content_photos
            WHERE album_id = ?
            ORDER BY uploaded_at ASC, id ASC
            LIMIT 1
            """,
            (album_id,),
        ).fetchone()

    uploaded_at = (
        str(stats_row["first_uploaded_at"] or "").strip()
        if stats_row is not None
        else ""
    ) or str(album_row["created_at"] or "").strip()
    return {
        "id": int(album_row["id"]),
        "title": str(album_row["title"] or "").strip(),
        "slug": str(album_row["slug"] or "").strip(),
        "createdAt": str(album_row["created_at"] or "").strip(),
        "uploadedAt": uploaded_at,
        "uploadedAtDisplay": format_datetime_display(uploaded_at),
        "photoCount": int(stats_row["photo_count"] or 0) if stats_row is not None else 0,
        "coverUrl": str(cover_row["image_url"] or "").strip() if cover_row is not None else "",
    }


def load_content_album_summaries() -> List[Dict[str, Any]]:
    ensure_content_album_records_exist()
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                a.id,
                a.title,
                a.slug,
                a.created_at,
                COUNT(p.id) AS photo_count,
                MIN(p.uploaded_at) AS first_uploaded_at,
                MAX(p.uploaded_at) AS last_uploaded_at
            FROM content_albums a
            LEFT JOIN content_photos p ON p.album_id = a.id
            GROUP BY a.id
            ORDER BY COALESCE(MAX(p.uploaded_at), a.created_at) DESC, a.id DESC
            """
        ).fetchall()

        cover_rows = connection.execute(
            """
            SELECT cp.album_id, cp.image_url
            FROM content_photos cp
            INNER JOIN (
                SELECT album_id, MIN(id) AS first_photo_id
                FROM content_photos
                GROUP BY album_id
            ) first_photos
                ON first_photos.album_id = cp.album_id
               AND first_photos.first_photo_id = cp.id
            """
        ).fetchall()

    cover_map = {int(row["album_id"]): str(row["image_url"] or "").strip() for row in cover_rows}
    albums = []
    for row in rows:
        uploaded_at = str(row["first_uploaded_at"] or "").strip() or str(row["created_at"] or "").strip()
        albums.append(
            {
                "id": int(row["id"]),
                "title": str(row["title"] or "").strip(),
                "slug": str(row["slug"] or "").strip(),
                "createdAt": str(row["created_at"] or "").strip(),
                "uploadedAt": uploaded_at,
                "uploadedAtDisplay": format_datetime_display(uploaded_at),
                "lastUploadedAt": str(row["last_uploaded_at"] or "").strip(),
                "photoCount": int(row["photo_count"] or 0),
                "coverUrl": cover_map.get(int(row["id"]), ""),
            }
        )
    return albums


def load_content_album_photos(album_id: int) -> List[Dict[str, Any]]:
    ensure_content_album_records_exist()
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                album_id,
                image_url,
                remote_path,
                file_name,
                original_name,
                content_type,
                file_size,
                storage_backend,
                uploaded_at
            FROM content_photos
            WHERE album_id = ?
            ORDER BY uploaded_at ASC, id ASC
            """,
            (album_id,),
        ).fetchall()

    photos = []
    for row in rows:
        photos.append(
            {
                "id": int(row["id"]),
                "albumId": int(row["album_id"]),
                "imageUrl": str(row["image_url"] or "").strip(),
                "remotePath": str(row["remote_path"] or "").strip(),
                "fileName": str(row["file_name"] or "").strip(),
                "originalName": str(row["original_name"] or "").strip(),
                "contentType": str(row["content_type"] or "").strip(),
                "fileSize": int(row["file_size"] or 0),
                "storageBackend": str(row["storage_backend"] or "local").strip(),
                "uploadedAt": str(row["uploaded_at"] or "").strip(),
                "uploadedAtDisplay": format_datetime_display(str(row["uploaded_at"] or "").strip()),
            }
        )
    return photos


def store_content_photo(
    album_id: int,
    original_name: str,
    file_name: str,
    content_type: str,
    file_size: int,
    remote_path: str,
    image_url: str,
    storage_backend: str,
) -> None:
    uploaded_at = datetime.utcnow().isoformat()
    with get_db_connection() as connection:
        connection.execute(
            """
            INSERT INTO content_photos (
                album_id,
                image_url,
                remote_path,
                file_name,
                original_name,
                content_type,
                file_size,
                storage_backend,
                uploaded_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                album_id,
                image_url,
                remote_path,
                file_name,
                original_name,
                content_type,
                file_size,
                storage_backend,
                uploaded_at,
            ),
        )


def store_content_photos(album_id: int, uploaded_items: List[Dict[str, Any]]) -> None:
    if not uploaded_items:
        return

    uploaded_at = datetime.utcnow().isoformat()
    rows: List[Tuple[Any, ...]] = []
    for item in uploaded_items:
        rows.append(
            (
                album_id,
                item["image_url"],
                item["remote_path"],
                item["file_name"],
                item["original_name"],
                item["content_type"],
                item["file_size"],
                item["storage_backend"],
                uploaded_at,
            )
        )

    with get_db_connection() as connection:
        connection.executemany(
            """
            INSERT INTO content_photos (
                album_id,
                image_url,
                remote_path,
                file_name,
                original_name,
                content_type,
                file_size,
                storage_backend,
                uploaded_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            rows,
        )


def delete_content_photo(photo_id: int, album_id: int) -> bool:
    with get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT id, remote_path, storage_backend
            FROM content_photos
            WHERE id = ? AND album_id = ?
            """,
            (photo_id, album_id),
        ).fetchone()
        if row is None:
            return False
        connection.execute("DELETE FROM content_photos WHERE id = ?", (photo_id,))

    delete_content_file(
        str(row["remote_path"] or "").strip(),
        str(row["storage_backend"] or "local").strip(),
    )
    return True


def delete_empty_content_album(album_id: int) -> None:
    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT 1 FROM content_photos WHERE album_id = ? LIMIT 1",
            (album_id,),
        ).fetchone()
        if row is None:
            connection.execute("DELETE FROM content_albums WHERE id = ?", (album_id,))


def delete_content_album(album_id: int) -> bool:
    photos = load_content_album_photos(album_id)
    album = load_content_album(album_id)
    if album is None:
        return False

    for photo in photos:
        delete_content_file(photo["remotePath"], photo["storageBackend"])

    with get_db_connection() as connection:
        connection.execute("DELETE FROM content_photos WHERE album_id = ?", (album_id,))
        connection.execute("DELETE FROM content_albums WHERE id = ?", (album_id,))
    return True


def resolve_content_album_id(selected_album_id: int, new_album_title: str) -> Optional[int]:
    if selected_album_id:
        return selected_album_id
    normalized_title = new_album_title.strip()
    if normalized_title:
        with content_album_lock:
            existing_album = find_content_album_by_title(normalized_title)
            if existing_album is not None:
                return int(existing_album["id"])
            return create_content_album(normalized_title)
    return None


def collect_content_upload_files() -> List[Any]:
    uploaded_files: List[Any] = []
    for field_name in ("photos", "photo_folder"):
        uploaded_files.extend(request.files.getlist(field_name))
    return uploaded_files


def prepare_content_upload_entry(album: Dict[str, Any], uploaded_file: Any, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    original_name = str(getattr(uploaded_file, "filename", "") or "").strip()
    if not original_name:
        return None

    file_bytes = uploaded_file.read()
    if not file_bytes:
        return None

    content_type = str(getattr(uploaded_file, "mimetype", "") or "").strip().lower()
    if not content_type:
        guessed_type = mimetypes.guess_type(original_name)[0]
        content_type = str(guessed_type or "").strip().lower()

    if content_type not in config["allowed_types"]:
        raise ValueError(f"Bestandstype niet toegestaan: {original_name}")

    max_upload_bytes = config["max_upload_mb"] * 1024 * 1024
    if len(file_bytes) > max_upload_bytes:
        raise ValueError(
            f"Bestand is te groot: {original_name}. Maximaal {config['max_upload_mb']} MB toegestaan."
        )

    safe_name = sanitize_upload_filename(original_name)
    extension = os.path.splitext(safe_name)[1].lower()
    if not extension:
        guessed_extension = mimetypes.guess_extension(content_type) or ""
        extension = guessed_extension.lower()
    allowed_extensions = ALLOWED_IMAGE_EXTENSIONS.get(content_type, set())
    if allowed_extensions and extension not in allowed_extensions:
        raise ValueError(f"Bestandsextensie niet toegestaan: {original_name}")
    if not validate_image_signature(content_type, file_bytes):
        raise ValueError(f"Bestandsinhoud niet geldig voor type: {original_name}")

    unique_name = f"{int(time.time() * 1000)}-{secrets.token_hex(4)}{extension}"
    remote_path = "/".join(
        [
            config["base_path"],
            date.today().isoformat(),
            f"{album['id']}-{album['slug']}",
            unique_name,
        ]
    )
    return {
        "original_name": original_name,
        "file_name": unique_name,
        "content_type": content_type,
        "file_size": len(file_bytes),
        "remote_path": remote_path,
        "content": file_bytes,
    }


def upload_prepared_content_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    upload_result = upload_content_bytes(
        entry["remote_path"],
        entry["content"],
        entry["content_type"],
    )
    return {
        "original_name": entry["original_name"],
        "file_name": entry["file_name"],
        "content_type": entry["content_type"],
        "file_size": entry["file_size"],
        "remote_path": entry["remote_path"],
        "image_url": upload_result["url"],
        "storage_backend": upload_result["storage_backend"],
    }


def upload_files_to_content_album(album_id: int, uploaded_files: List[Any]) -> int:
    album = load_content_album(album_id)
    if album is None:
        raise ValueError("Het gekozen album bestaat niet meer.")

    config = get_content_storage_config()
    prepared_entries: List[Dict[str, Any]] = []
    for uploaded_file in uploaded_files:
        prepared_entry = prepare_content_upload_entry(album, uploaded_file, config)
        if prepared_entry is not None:
            prepared_entries.append(prepared_entry)

    if not prepared_entries:
        raise ValueError("Selecteer minimaal één foto om te uploaden.")

    max_workers = min(4, len(prepared_entries))
    uploaded_items: List[Dict[str, Any]] = []
    try:
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {
                executor.submit(upload_prepared_content_entry, entry): entry
                for entry in prepared_entries
            }
            for future in as_completed(future_map):
                uploaded_items.append(future.result())
    except Exception:
        for uploaded_item in uploaded_items:
            try:
                delete_content_file(uploaded_item["remote_path"], uploaded_item["storage_backend"])
            except requests.RequestException:
                pass
        raise

    store_content_photos(album["id"], uploaded_items)
    return len(uploaded_items)


def derive_member_type_from_role(role: str) -> str:
    normalized_role = role.strip().lower()
    if normalized_role in {"vrijwilliger"}:
        return "Vrijwilliger"
    if normalized_role in {"stagiair"}:
        return "Stagiair"
    return "Medewerker"


def normalize_system_role(role: str) -> str:
    normalized_role = role.strip().lower()
    if normalized_role in {"admin", "beheerder"}:
        return "Admin"
    if normalized_role == "social media beheerder":
        return "Social media beheerder"
    return role.strip()


def is_allowed_system_role(role: str) -> bool:
    return normalize_system_role(role) in {"Admin", "Social media beheerder"}


def role_grants_admin_access(role: str) -> bool:
    return normalize_system_role(role) == "Admin"


def is_social_media_manager(user: Optional[Dict[str, Any]]) -> bool:
    if not user:
        return False
    return normalize_system_role(str(user.get("systemRole") or user.get("role") or "")) == "Social media beheerder"


def get_visible_pages_for_user(user: Optional[Dict[str, Any]]) -> Set[str]:
    if not user:
        return set()
    if user.get("isAdmin"):
        return {
            "dashboard",
            "agenda",
            "tasks",
            "orders",
            "revenue",
            "trainer-fees",
            "voorstellen-maker",
            "social-media",
            "content",
            "trainers",
            "profile",
        }
    if is_social_media_manager(user):
        return {"dashboard", "voorstellen-maker", "social-media", "content", "profile"}
    return {"profile"}


def user_can_access_page(user: Optional[Dict[str, Any]], page_key: str) -> bool:
    return page_key in get_visible_pages_for_user(user)


def require_page_access(page_key: str) -> Optional[Any]:
    user = get_current_user()
    if user is None:
        return redirect(url_for("login_page", next=request.path))
    if user_can_access_page(user, page_key):
        return None
    fallback_page = "dashboard" if user_can_access_page(user, "dashboard") else "profile"
    if fallback_page == "dashboard":
        return redirect(url_for("index"))
    return redirect(url_for("personal_profile_page"))


def build_user_payload(row: sqlite3.Row) -> Dict[str, Any]:
    system_role = normalize_system_role(str(row["system_role"] or row["role"] or ""))
    return {
        "id": str(row["id"]),
        "fullName": str(row["full_name"] or "").strip(),
        "email": str(row["email"] or "").strip(),
        "username": str(row["username"] or "").strip(),
        "passwordHash": str(row["password_hash"] or "").strip(),
        "inviteToken": str(row["invite_token"] or "").strip(),
        "inviteExpiresAt": str(row["invite_expires_at"] or "").strip(),
        "inviteAcceptedAt": str(row["invite_accepted_at"] or "").strip(),
        "role": system_role,
        "memberType": str(row["member_type"] or "").strip(),
        "systemRole": system_role,
        "knvbLicense": str(row["knvb_license"] or "").strip(),
        "education": str(row["education"] or "").strip(),
        "availabilityDays": [day for day in str(row["availability_days"] or "").split(",") if day],
        "phone": str(row["phone"] or "").strip(),
        "notes": str(row["notes"] or "").strip(),
        "isAdmin": bool(row["is_admin"]) or role_grants_admin_access(system_role),
        "status": str(row["status"] or "Actief").strip(),
        "createdAt": str(row["created_at"] or "").strip(),
    }


def normalize_username_seed(value: str) -> str:
    cleaned = []
    previous_separator = False
    for char in value.lower():
        if char.isalnum():
            cleaned.append(char)
            previous_separator = False
        elif not previous_separator:
            cleaned.append(".")
            previous_separator = True

    normalized = "".join(cleaned).strip(".")
    return normalized or "gebruiker"


def build_invite_expiry(days: int = 14) -> str:
    return (datetime.utcnow() + timedelta(days=days)).replace(microsecond=0).isoformat()


def create_invite_token() -> str:
    return secrets.token_urlsafe(32)


def update_trainer_profile(
    profile_id: str,
    full_name: str,
    email: str,
    username: str,
    member_type: str,
    system_role: str,
    knvb_license: str,
    education: str,
    phone: str,
    notes: str,
    availability_days: List[str],
    is_admin: bool,
) -> None:
    with get_db_connection() as connection:
        connection.execute(
            """
            UPDATE trainer_profiles
            SET
                full_name = ?,
                email = ?,
                username = ?,
                role = ?,
                member_type = ?,
                system_role = ?,
                knvb_license = ?,
                education = ?,
                availability_days = ?,
                phone = ?,
                notes = ?,
                is_admin = ?
            WHERE id = ?
            """,
            (
                full_name.strip(),
                email.strip(),
                username.strip(),
                system_role.strip() or "Trainer",
                member_type.strip(),
                system_role.strip(),
                knvb_license.strip(),
                education.strip(),
                ",".join(day.strip() for day in availability_days if day.strip()),
                phone.strip(),
                notes.strip(),
                1 if is_admin else 0,
                profile_id.strip(),
            ),
        )


def delete_trainer_profile(profile_id: str) -> None:
    with get_db_connection() as connection:
        connection.execute("DELETE FROM trainer_profiles WHERE id = ?", (profile_id.strip(),))


def seed_workspace_tables() -> None:
    settings = load_dashboard_weather_settings()
    for key, value in settings.items():
        save_dashboard_preference(key, value)

    if not table_has_rows("tasks"):
        add_task("Veldindeling controleren", "2026-04-01")
        add_task("Trainingsmateriaal klaarzetten", "2026-04-02")


def build_workspace_summary() -> Dict[str, int]:
    tasks = load_tasks()
    agenda_items = load_agenda_trainings()
    team_members = load_trainer_profiles()
    return {
        "openTasks": sum(1 for item in tasks if not item.get("isDone")),
        "doneTasks": sum(1 for item in tasks if item.get("isDone")),
        "agendaCount": len(agenda_items),
        "teamCount": len(team_members),
    }


def get_weather_description(code: int) -> Dict[str, str]:
    descriptions = {
        0: {"label": "Onbewolkt", "icon": "Sun"},
        1: {"label": "Licht bewolkt", "icon": "CloudSun"},
        2: {"label": "Half bewolkt", "icon": "Cloud"},
        3: {"label": "Bewolkt", "icon": "Cloud"},
        45: {"label": "Mist", "icon": "CloudFog"},
        48: {"label": "Rijp mist", "icon": "CloudFog"},
        51: {"label": "Lichte motregen", "icon": "CloudDrizzle"},
        53: {"label": "Motregen", "icon": "CloudDrizzle"},
        55: {"label": "Zware motregen", "icon": "CloudRain"},
        61: {"label": "Lichte regen", "icon": "CloudRain"},
        63: {"label": "Regen", "icon": "CloudRain"},
        65: {"label": "Zware regen", "icon": "CloudRain"},
        71: {"label": "Lichte sneeuw", "icon": "CloudSnow"},
        73: {"label": "Sneeuw", "icon": "CloudSnow"},
        75: {"label": "Zware sneeuw", "icon": "Snowflake"},
        80: {"label": "Lichte buien", "icon": "CloudRain"},
        81: {"label": "Buien", "icon": "CloudRain"},
        82: {"label": "Zware buien", "icon": "CloudLightning"},
        95: {"label": "Onweer", "icon": "CloudLightning"},
        96: {"label": "Onweer met hagel", "icon": "CloudLightning"},
        99: {"label": "Zwaar onweer", "icon": "CloudLightning"},
    }
    return descriptions.get(code, {"label": "Onbekend", "icon": "Cloud"})


def load_trainer_profiles() -> List[Dict[str, Any]]:
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                id,
                full_name,
                email,
                username,
                password_hash,
                invite_token,
                invite_expires_at,
                invite_accepted_at,
                role,
                member_type,
                system_role,
                knvb_license,
                education,
                availability_days,
                phone,
                notes,
                is_admin,
                status,
                created_at
            FROM trainer_profiles
            ORDER BY full_name COLLATE NOCASE ASC, created_at DESC
            """
        ).fetchall()

    profiles = []
    for row in rows:
        profile = build_user_payload(row)
        profile["memberType"] = profile.get("memberType") or ("Medewerker" if profile.get("isAdmin") else "Vrijwilliger")
        profile["systemRole"] = profile.get("systemRole") or profile.get("role") or ""
        profiles.append(profile)

    return profiles


def build_admin_account_debug_summary() -> Dict[str, Any]:
    profiles = load_trainer_profiles()
    return {
        "total": len(profiles),
        "admins": sum(1 for item in profiles if item.get("isAdmin")),
        "invited": sum(1 for item in profiles if item.get("status") == "Uitgenodigd"),
        "active": sum(1 for item in profiles if item.get("status") == "Actief"),
    }


def build_admin_content_debug_summary(repaired_albums: Optional[int] = None) -> Dict[str, Any]:
    if repaired_albums is None:
        repaired_albums = ensure_content_album_records_exist()
    with get_db_connection() as connection:
        counts_row = connection.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM content_albums) AS album_count,
                (SELECT COUNT(*) FROM content_photos) AS photo_count,
                (
                    SELECT COUNT(*)
                    FROM content_photos cp
                    LEFT JOIN content_albums ca ON ca.id = cp.album_id
                    WHERE ca.id IS NULL
                ) AS orphan_photo_count,
                (SELECT COUNT(*) FROM exercises) AS exercise_count,
                (SELECT COUNT(*) FROM faq_items) AS faq_count,
                (SELECT COUNT(*) FROM training_plans) AS training_plan_count,
                (SELECT COUNT(*) FROM workflow_documents) AS workflow_document_count
            """
        ).fetchone()

    return {
        "albums": int(counts_row["album_count"] or 0) if counts_row is not None else 0,
        "photos": int(counts_row["photo_count"] or 0) if counts_row is not None else 0,
        "orphanPhotos": int(counts_row["orphan_photo_count"] or 0) if counts_row is not None else 0,
        "repairedAlbums": repaired_albums,
        "exercises": int(counts_row["exercise_count"] or 0) if counts_row is not None else 0,
        "faqItems": int(counts_row["faq_count"] or 0) if counts_row is not None else 0,
        "trainingPlans": int(counts_row["training_plan_count"] or 0) if counts_row is not None else 0,
        "workflowDocuments": int(counts_row["workflow_document_count"] or 0) if counts_row is not None else 0,
    }


def trainer_username_exists(username: str, exclude_profile_id: str = "") -> bool:
    with get_db_connection() as connection:
        if exclude_profile_id.strip():
            row = connection.execute(
                """
                SELECT 1
                FROM trainer_profiles
                WHERE lower(username) = lower(?) AND id != ?
                LIMIT 1
                """,
                (username.strip(), exclude_profile_id.strip()),
            ).fetchone()
        else:
            row = connection.execute(
                "SELECT 1 FROM trainer_profiles WHERE lower(username) = lower(?) LIMIT 1",
                (username.strip(),),
            ).fetchone()
    return row is not None


def trainer_email_exists(email: str, exclude_profile_id: str = "") -> bool:
    with get_db_connection() as connection:
        if exclude_profile_id.strip():
            row = connection.execute(
                """
                SELECT 1
                FROM trainer_profiles
                WHERE lower(email) = lower(?) AND id != ?
                LIMIT 1
                """,
                (email.strip(), exclude_profile_id.strip()),
            ).fetchone()
        else:
            row = connection.execute(
                "SELECT 1 FROM trainer_profiles WHERE lower(email) = lower(?) LIMIT 1",
                (email.strip(),),
            ).fetchone()
    return row is not None


def build_internal_username(full_name: str, email: str, exclude_profile_id: str = "") -> str:
    email_local_part = email.strip().split("@", 1)[0]
    base_value = normalize_username_seed(email_local_part or full_name or "gebruiker")
    candidate = base_value
    suffix = 2

    while trainer_username_exists(candidate, exclude_profile_id=exclude_profile_id):
        candidate = f"{base_value}.{suffix}"
        suffix += 1

    return candidate


def add_trainer_profile(
    full_name: str,
    email: str,
    password: str,
    role: str,
    member_type: str,
    system_role: str,
    knvb_license: str,
    education: str,
    availability_days: List[str],
    phone: str,
    notes: str,
    is_admin: bool = False,
) -> None:
    created_at = datetime.now().isoformat(timespec="seconds")
    profile_id = f"trainer-{int(time.time() * 1000)}"
    username = build_internal_username(full_name, email)
    with get_db_connection() as connection:
        connection.execute(
            """
            INSERT INTO trainer_profiles (
                id, full_name, email, username, password_hash, invite_token, invite_expires_at, invite_accepted_at,
                role, member_type, system_role, knvb_license, education, availability_days, phone, notes, is_admin, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id,
                full_name.strip(),
                email.strip(),
                username.strip(),
                hash_password(password),
                None,
                None,
                utcnow_iso(),
                role.strip() or system_role.strip() or "Trainer",
                member_type.strip() or "Vrijwilliger",
                system_role.strip() or role.strip() or "Trainer",
                knvb_license.strip(),
                education.strip(),
                ",".join(day.strip() for day in availability_days if day.strip()),
                phone.strip(),
                notes.strip(),
                1 if is_admin else 0,
                "Actief",
                created_at,
            ),
        )


def create_trainer_invite_profile(
    full_name: str,
    email: str,
    role: str,
    member_type: str,
    system_role: str,
    knvb_license: str,
    education: str,
    availability_days: List[str],
    phone: str,
    notes: str,
    is_admin: bool = False,
) -> Dict[str, str]:
    created_at = datetime.now().isoformat(timespec="seconds")
    profile_id = f"trainer-{int(time.time() * 1000)}"
    username = build_internal_username(full_name, email)
    invite_token = create_invite_token()
    invite_expires_at = build_invite_expiry()
    with get_db_connection() as connection:
        connection.execute(
            """
            INSERT INTO trainer_profiles (
                id, full_name, email, username, password_hash, invite_token, invite_expires_at, invite_accepted_at,
                role, member_type, system_role, knvb_license, education, availability_days, phone, notes, is_admin, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_id,
                full_name.strip(),
                email.strip(),
                username.strip(),
                None,
                invite_token,
                invite_expires_at,
                None,
                role.strip() or system_role.strip() or "Trainer",
                member_type.strip() or "Vrijwilliger",
                system_role.strip() or role.strip() or "Trainer",
                knvb_license.strip(),
                education.strip(),
                ",".join(day.strip() for day in availability_days if day.strip()),
                phone.strip(),
                notes.strip(),
                1 if is_admin else 0,
                "Uitgenodigd",
                created_at,
            ),
        )

    return {
        "profileId": profile_id,
        "inviteToken": invite_token,
        "inviteExpiresAt": invite_expires_at,
    }


def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id, full_name, email, username, password_hash, invite_token, invite_expires_at, invite_accepted_at, role, member_type, system_role,
                knvb_license, education, availability_days, phone, notes, is_admin, status, created_at
            FROM trainer_profiles
            WHERE id = ?
            LIMIT 1
            """,
            (user_id.strip(),),
        ).fetchone()

    if row is None:
        return None

    return build_user_payload(row)


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id, full_name, email, username, password_hash, invite_token, invite_expires_at, invite_accepted_at, role, member_type, system_role,
                knvb_license, education, availability_days, phone, notes, is_admin, status, created_at
            FROM trainer_profiles
            WHERE lower(username) = lower(?)
            LIMIT 1
            """,
            (username.strip(),),
        ).fetchone()

    if row is None:
        return None

    return build_user_payload(row)


def get_user_by_login(login_value: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id, full_name, email, username, password_hash, invite_token, invite_expires_at, invite_accepted_at, role, member_type, system_role,
                knvb_license, education, availability_days, phone, notes, is_admin, status, created_at
            FROM trainer_profiles
            WHERE lower(email) = lower(?) OR lower(username) = lower(?)
            ORDER BY is_admin DESC, created_at ASC
            LIMIT 1
            """,
            (login_value.strip(), login_value.strip()),
        ).fetchone()

    if row is None:
        return None

    return build_user_payload(row)


def get_user_by_invite_token(invite_token: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT
                id, full_name, email, username, password_hash, invite_token, invite_expires_at, invite_accepted_at, role, member_type, system_role,
                knvb_license, education, availability_days, phone, notes, is_admin, status, created_at
            FROM trainer_profiles
            WHERE invite_token = ?
            LIMIT 1
            """,
            (invite_token.strip(),),
        ).fetchone()

    if row is None:
        return None

    return build_user_payload(row)


def accept_trainer_invite(profile_id: str, password: str) -> None:
    with get_db_connection() as connection:
        connection.execute(
            """
            UPDATE trainer_profiles
            SET
                password_hash = ?,
                invite_token = NULL,
                invite_accepted_at = ?,
                status = 'Actief'
            WHERE id = ?
            """,
            (
                hash_password(password),
                utcnow_iso(),
                profile_id.strip(),
            ),
        )


def authenticate_user(login_value: str, password: str) -> Optional[Dict[str, Any]]:
    user = get_user_by_login(login_value)
    if user is None or not user.get("passwordHash"):
        return None
    if not check_password_hash(user["passwordHash"], password):
        return None
    if password_needs_rehash(user["passwordHash"]):
        update_user_password_hash(user["id"], password)
        user = get_user_by_id(user["id"]) or user
    return user


def ensure_admin_account() -> None:
    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT 1 FROM trainer_profiles WHERE is_admin = 1 LIMIT 1"
        ).fetchone()
    if row is not None:
        return

    admin_password = get_env("ADMIN_PASSWORD")
    admin_email = get_env("ADMIN_EMAIL")
    if not admin_email or not admin_password or is_placeholder_value(admin_password):
        app.logger.warning("Geen automatisch admin-account aangemaakt: ADMIN_EMAIL/ADMIN_PASSWORD ontbreken.")
        return

    add_trainer_profile(
        full_name="Beheerder",
        email=admin_email,
        password=admin_password,
        role="Admin",
        member_type="Medewerker",
        system_role="Admin",
        knvb_license="",
        education="",
        availability_days=[],
        phone="",
        notes="Automatisch aangemaakt beheeraccount.",
        is_admin=True,
    )


def require_admin_user() -> Optional[Any]:
    user = get_current_user()
    if user is None or not user.get("isAdmin"):
        return require_page_access("dashboard")
    return None


def get_default_post_login_path(user: Dict[str, Any]) -> str:
    if user.get("isAdmin"):
        return "/trainers"
    if is_social_media_manager(user):
        return "/"
    return "/profiel"


def is_valid_email_address(value: str) -> bool:
    normalized = str(value or "").strip()
    return bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized))


def combine_date_and_time(date_value: str, time_value: str) -> datetime:
    return datetime.fromisoformat(f"{date_value}T{time_value}")


def compute_default_end_time(time_value: str) -> str:
    start = datetime.strptime(time_value, "%H:%M")
    end = start + timedelta(minutes=90)
    return end.strftime("%H:%M")


def get_week_days(week_start: date) -> List[Dict[str, Any]]:
    day_names = ["ma", "di", "wo", "do", "vr", "za", "zo"]
    days = []
    for index in range(7):
        current = week_start + timedelta(days=index)
        days.append(
            {
                "date": current,
                "key": current.isoformat(),
                "shortLabel": f"{day_names[index]} {current.day}-{current.month}",
                "isToday": current == date.today(),
            }
        )
    return days


def build_agenda_day_plan_summary(day_plans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    summary: List[Dict[str, Any]] = []
    plan_counts = {option: 0 for option in AGENDA_DAY_PLAN_OPTIONS}
    weekday_counts = {
        option: {weekday: 0 for weekday in range(7)}
        for option in AGENDA_DAY_PLAN_OPTIONS
    }

    for day_plan in day_plans:
        plan_type = str(day_plan.get("planType") or day_plan.get("plan_type") or "").strip()
        if plan_type not in plan_counts:
            continue

        plan_counts[plan_type] += 1

        current_date = day_plan.get("date")
        if isinstance(current_date, str):
            current_date = parse_iso_date(current_date.strip())
        if isinstance(current_date, date):
            weekday_counts[plan_type][current_date.weekday()] += 1

    for option in AGENDA_DAY_PLAN_OPTIONS:
        item = {
            "label": option,
            "count": plan_counts.get(option, 0),
            "details": [
                {"label": DUTCH_WEEKDAY_NAMES[weekday], "count": count}
                for weekday, count in weekday_counts[option].items()
                if count > 0
            ],
        }
        summary.append(item)

    return summary


def build_week_label(week_start: date) -> str:
    week_end = week_start + timedelta(days=6)
    if week_start.month == week_end.month:
        return f"{week_start.day}-{week_end.day} {DUTCH_MONTH_NAMES[week_start.month - 1]} {week_start.year}"
    return (
        f"{week_start.day} {DUTCH_MONTH_NAMES[week_start.month - 1]} - "
        f"{week_end.day} {DUTCH_MONTH_NAMES[week_end.month - 1]} {week_start.year}"
    )


def add_months(base_date: date, month_offset: int) -> date:
    month_index = (base_date.month - 1) + month_offset
    year = base_date.year + (month_index // 12)
    month = (month_index % 12) + 1
    return date(year, month, 1)


def build_month_label(month_start: date) -> str:
    return f"{DUTCH_MONTH_NAMES[month_start.month - 1]} {month_start.year}"


def build_agenda_month_days(month_start: date) -> List[List[Dict[str, Any]]]:
    sunday_first_calendar = calendar.Calendar(firstweekday=6)
    month_weeks: List[List[Dict[str, Any]]] = []

    for week in sunday_first_calendar.monthdatescalendar(month_start.year, month_start.month):
        week_days: List[Dict[str, Any]] = []
        for current_date in week:
            week_days.append(
                {
                    "date": current_date,
                    "key": current_date.isoformat(),
                    "dayNumber": current_date.day,
                    "isCurrentMonth": current_date.month == month_start.month,
                    "isToday": current_date == date.today(),
                }
            )
        month_weeks.append(week_days)

    return month_weeks


def normalize_agenda_label(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_agenda_region(value: Any) -> str:
    return normalize_agenda_label(value).lower()


def expand_agenda_date_range(start_date: str, end_date: str) -> List[str]:
    if not start_date or not end_date:
        return []

    current_date = date.fromisoformat(start_date)
    final_date = date.fromisoformat(end_date)
    expanded_dates: List[str] = []

    while current_date <= final_date:
        expanded_dates.append(current_date.isoformat())
        current_date += timedelta(days=1)

    return expanded_dates


def fetch_school_holidays_for_schoolyear(school_year: str, region: str) -> Dict[str, Any]:
    normalized_school_year = normalize_agenda_label(school_year)
    normalized_region = normalize_agenda_region(region) or "all"
    cache_key = f"{normalized_school_year}:{normalized_region}"
    now = time.time()

    with agenda_school_holidays_cache_lock:
        cached_payload = agenda_school_holidays_cache.get(cache_key)
        if cached_payload and now - float(cached_payload.get("cached_at") or 0.0) < AGENDA_EXTERNAL_CACHE_TTL_SECONDS:
            return dict(cached_payload["payload"])

    response = requests.get(
        f"{RIJKSOVERHEID_SCHOOL_HOLIDAYS_API_BASE}/schoolyear/{normalized_school_year}",
        params={"output": "json"},
        timeout=12,
    )
    response.raise_for_status()
    payload = response.json()
    records = payload if isinstance(payload, list) else [payload]
    items: List[Dict[str, Any]] = []
    seen_items: Set[Tuple[str, str, str]] = set()

    for record in records:
        if not isinstance(record, dict):
            continue
        for content_item in record.get("content", []):
            if not isinstance(content_item, dict):
                continue
            parsed_school_year = normalize_agenda_label(content_item.get("schoolyear"))
            for vacation in content_item.get("vacations", []):
                if not isinstance(vacation, dict):
                    continue
                vacation_type = normalize_agenda_label(vacation.get("type"))
                for region_item in vacation.get("regions", []):
                    if not isinstance(region_item, dict):
                        continue
                    region_name = normalize_agenda_region(region_item.get("region"))
                    if normalized_region != "all" and region_name not in {normalized_region, "heel nederland"}:
                        continue
                    start_date = normalize_agenda_label(region_item.get("startdate"))[:10]
                    end_date = normalize_agenda_label(region_item.get("enddate"))[:10]
                    for date_key in expand_agenda_date_range(start_date, end_date):
                        dedupe_key = (date_key, vacation_type, region_name)
                        if not date_key or not vacation_type or dedupe_key in seen_items:
                            continue
                        seen_items.add(dedupe_key)
                        items.append(
                            {
                                "date": date_key,
                                "label": vacation_type,
                                "schoolyear": parsed_school_year,
                                "region": region_name,
                            }
                        )

    result = {
        "items": items,
        "schoolYear": normalized_school_year,
        "region": normalized_region,
        "cachedAt": now,
    }
    with agenda_school_holidays_cache_lock:
        agenda_school_holidays_cache[cache_key] = {
            "payload": result,
            "cached_at": now,
        }
    return dict(result)


def fetch_public_holidays_for_year(year: int) -> Dict[str, Any]:
    normalized_year = int(year)
    cache_key = str(normalized_year)
    now = time.time()

    with agenda_public_holidays_cache_lock:
        cached_payload = agenda_public_holidays_cache.get(cache_key)
        if cached_payload and now - float(cached_payload.get("cached_at") or 0.0) < AGENDA_EXTERNAL_CACHE_TTL_SECONDS:
            return dict(cached_payload["payload"])

    response = requests.get(
        f"{NAGER_PUBLIC_HOLIDAYS_API_BASE}/{normalized_year}/NL",
        timeout=12,
    )
    response.raise_for_status()
    payload = response.json()
    items: List[Dict[str, Any]] = []
    seen_items: Set[Tuple[str, str]] = set()

    for item in payload if isinstance(payload, list) else []:
        if not isinstance(item, dict):
            continue
        date_key = normalize_agenda_label(item.get("date"))
        label = normalize_agenda_label(item.get("localName")) or normalize_agenda_label(item.get("name"))
        dedupe_key = (date_key, label)
        if not date_key or not label or dedupe_key in seen_items:
            continue
        seen_items.add(dedupe_key)
        items.append(
            {
                "date": date_key,
                "label": label,
                "localName": normalize_agenda_label(item.get("localName")),
                "name": normalize_agenda_label(item.get("name")),
            }
        )

    result = {
        "items": items,
        "year": normalized_year,
        "cachedAt": now,
    }
    with agenda_public_holidays_cache_lock:
        agenda_public_holidays_cache[cache_key] = {
            "payload": result,
            "cached_at": now,
        }
    return dict(result)


def format_agenda_school_holiday_label(label: Any, region: Any) -> str:
    normalized_label = normalize_agenda_label(label)
    normalized_region = normalize_agenda_region(region)
    if not normalized_label:
        return ""
    if not normalized_region:
        return normalized_label
    if normalized_region == "heel nederland":
        return f"{normalized_label} (heel Nederland)"
    return f"{normalized_label} ({normalized_region})"


def get_agenda_school_holiday_region_order(region: Any) -> int:
    normalized_region = normalize_agenda_region(region)
    if normalized_region == "noord":
        return 1
    if normalized_region == "midden":
        return 2
    if normalized_region == "zuid":
        return 3
    return 99


def build_agenda_school_holiday_labels(items: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    grouped_items: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for item in items:
        date_key = normalize_agenda_label(item.get("date"))[:10]
        base_label = normalize_agenda_label(item.get("label"))
        region_name = normalize_agenda_region(item.get("region"))
        if not date_key or not base_label or not region_name:
            continue

        group_key = (date_key, base_label)
        group = grouped_items.setdefault(
            group_key,
            {
                "date": date_key,
                "base_label": base_label,
                "regions": set(),
            },
        )
        group["regions"].add(region_name)

    labels: List[Dict[str, str]] = []
    for group in grouped_items.values():
        region_names = list(group["regions"])
        has_nationwide = "heel nederland" in region_names or all(
            region_name in group["regions"] for region_name in ("noord", "midden", "zuid")
        )
        if has_nationwide:
            formatted_label = format_agenda_school_holiday_label(group["base_label"], "heel nederland")
        else:
            sorted_regions = ", ".join(
                sorted(region_names, key=get_agenda_school_holiday_region_order)
            )
            formatted_label = f"{group['base_label']} ({sorted_regions})"

        labels.append(
            {
                "date": group["date"],
                "label": formatted_label,
            }
        )

    labels.sort(key=lambda item: (item["date"], item["label"]))
    return labels


def build_agenda_external_labels(day_keys: List[str], school_region: str = "all") -> Dict[str, List[str]]:
    labels_by_day: Dict[str, List[str]] = {day_key: [] for day_key in day_keys}
    seen_labels: Dict[str, Set[str]] = {day_key: set() for day_key in day_keys}
    valid_day_keys = set(day_keys)
    years = sorted(
        {
            int(day_key[:4])
            for day_key in day_keys
            if len(day_key) >= 4 and day_key[:4].isdigit()
        }
    )
    school_years = sorted(
        {
            f"{year - 1}-{year}"
            for year in years
        }
        | {
            f"{year}-{year + 1}"
            for year in years
        }
    )

    school_holiday_items: List[Dict[str, Any]] = []
    for school_year in school_years:
        payload = fetch_school_holidays_for_schoolyear(school_year, school_region)
        school_holiday_items.extend(payload.get("items", []))

    for holiday in build_agenda_school_holiday_labels(school_holiday_items):
        date_key = normalize_agenda_label(holiday.get("date"))[:10]
        label = normalize_agenda_label(holiday.get("label"))
        if date_key not in valid_day_keys or not label or label in seen_labels[date_key]:
            continue
        seen_labels[date_key].add(label)
        labels_by_day[date_key].append(label)

    for year in years:
        payload = fetch_public_holidays_for_year(year)
        for holiday in payload.get("items", []):
            date_key = normalize_agenda_label(holiday.get("date"))[:10]
            label = normalize_agenda_label(holiday.get("label"))
            if date_key not in valid_day_keys or not label or label in seen_labels[date_key]:
                continue
            seen_labels[date_key].add(label)
            labels_by_day[date_key].append(label)

    return labels_by_day


def build_agenda_week_events(trainings: List[Dict[str, Any]], week_start: date) -> List[Dict[str, Any]]:
    calendar_start_minutes = 0
    pixels_per_hour = 56
    week_end = week_start + timedelta(days=6)
    events = []

    for training in trainings:
        if not training.get("date") or not training.get("time"):
            continue

        training_date = date.fromisoformat(training["date"])
        if training_date < week_start or training_date > week_end:
            continue

        start_time = training["time"]
        end_time = training.get("endTime") or compute_default_end_time(start_time)
        start_dt = combine_date_and_time(training["date"], start_time)
        end_dt = combine_date_and_time(training["date"], end_time)
        if end_dt <= start_dt:
            end_dt = start_dt + timedelta(minutes=90)

        start_minutes = start_dt.hour * 60 + start_dt.minute
        end_minutes = end_dt.hour * 60 + end_dt.minute
        top = max(((start_minutes - calendar_start_minutes) / 60) * pixels_per_hour, 0)
        height = max(((end_minutes - start_minutes) / 60) * pixels_per_hour, 48)
        column = (training_date - week_start).days + 2

        events.append(
            {
                "id": training["id"],
                "title": training["title"],
                "date": training["date"],
                "time": start_time,
                "endTime": end_time,
                "location": training.get("location", ""),
                "notes": training.get("notes", ""),
                "dayIndex": (training_date - week_start).days,
                "top": round(top, 1),
                "height": round(height, 1),
            }
        )

    return events


def build_agenda_month_events(trainings: List[Dict[str, Any]], visible_day_keys: Set[str]) -> Dict[str, List[Dict[str, Any]]]:
    events_by_day: Dict[str, List[Dict[str, Any]]] = {day_key: [] for day_key in visible_day_keys}

    for training in trainings:
        training_date = normalize_agenda_label(training.get("date"))[:10]
        start_time = normalize_agenda_label(training.get("time"))
        if training_date not in visible_day_keys or not start_time:
            continue

        events_by_day.setdefault(training_date, []).append(
            {
                "id": training.get("id"),
                "title": normalize_agenda_label(training.get("title")),
                "time": start_time,
                "endTime": normalize_agenda_label(training.get("endTime")) or compute_default_end_time(start_time),
                "location": normalize_agenda_label(training.get("location")),
            }
        )

    for day_events in events_by_day.values():
        day_events.sort(key=lambda item: (item.get("time", ""), item.get("title", "")))

    return events_by_day


def build_product_summary(orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    configured_events = load_dashboard_events_config()
    summary = []

    for configured_event in configured_events:
        configured_product_id = configured_event.get("productId")
        sold_count = 0

        for order in orders:
            for item in order.get("items", []):
                if matches_configured_event(
                    item.get("name", ""),
                    configured_event,
                    item.get("productId"),
                ):
                    sold_count += int(item.get("quantity", 0) or 0)

        summary.append(
            {
                "productId": configured_product_id,
                "label": configured_event.get("label", "Onbekend event"),
                "soldCount": sold_count,
            }
        )

    return sorted(summary, key=lambda item: item["soldCount"], reverse=True)


def search_catalog_products(keyword: str) -> List[Dict[str, Any]]:
    config = get_config()
    if not config["store_id"] or not config["secret_token"] or not keyword.strip():
        return []

    query = normalize_match_text(keyword)
    query_tokens = {token for token in query.split() if token}
    products = []
    offset = 0
    limit = 100

    while True:
        response = requests.get(
            f"{ECWID_API_BASE}/{config['store_id']}/products",
            headers={"Authorization": f"Bearer {config['secret_token']}"},
            params={
                "offset": offset,
                "limit": limit,
                "responseFields": "total,count,items(id,name,sku,price,enabled)",
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        items = payload.get("items", [])
        products.extend(items)

        if not items or len(items) < limit or len(products) >= payload.get("total", 0):
            break

        offset += limit

    filtered_products = []
    for item in products:
        normalized_name = normalize_match_text(item.get("name", ""))
        item_tokens = {token for token in normalized_name.split() if token}
        if query_tokens and not query_tokens.issubset(item_tokens):
            continue

        filtered_products.append(
            {
                "id": item.get("id"),
                "name": item.get("name", "Naamloos product"),
                "sku": item.get("sku", ""),
                "price": item.get("price", 0),
                "enabled": item.get("enabled", True),
            }
        )

    return filtered_products[:20]


def fetch_orders_from_ecwid() -> Dict[str, Any]:
    config = get_config()
    if not config["store_id"] or not config["secret_token"]:
        return {
            "source": "mock",
            "items": mock_orders(),
            "summary": build_summary(mock_orders()),
            "message": (
                "Live Ecwid-koppeling staat nog niet aan. "
                "Voeg ECWID_STORE_ID en ECWID_SECRET_TOKEN toe."
            ),
        }

    all_orders: List[Dict[str, Any]] = []
    offset = 0
    limit = 100
    total = 0

    try:
        while True:
            response = requests.get(
                f"{ECWID_API_BASE}/{config['store_id']}/orders",
                headers={"Authorization": f"Bearer {config['secret_token']}"},
                params={
                    "limit": limit,
                    "offset": offset,
                    "responseFields": ECWID_RESPONSE_FIELDS,
                },
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()

            batch = payload.get("items", [])
            total = payload.get("total", total)
            all_orders.extend(batch)

            if not batch or len(batch) < limit or len(all_orders) >= total:
                break

            offset += limit
    except requests.RequestException:
        return {
            "source": "mock",
            "items": mock_orders(),
            "summary": build_summary(mock_orders()),
            "message": (
                "Ecwid kon nu niet worden geladen. "
                "Controleer ECWID_STORE_ID en ECWID_SECRET_TOKEN; tijdelijke voorbeelddata wordt getoond."
            ),
        }

    normalized_orders = [normalize_order(order) for order in all_orders]

    return {
        "source": "ecwid",
        "items": normalized_orders,
        "summary": build_summary(normalized_orders),
        "total": total,
        "count": len(all_orders),
    }


def get_moneybird_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }


def fetch_moneybird_administration(config: Dict[str, str]) -> Dict[str, Any]:
    token = config["moneybird_token"]
    administration_id = config["moneybird_administration_id"]
    if not token:
        return {}

    response = requests.get(
        f"{MONEYBIRD_API_BASE}/administrations.json",
        headers=get_moneybird_headers(token),
        timeout=20,
    )
    response.raise_for_status()
    administrations = response.json()
    if not isinstance(administrations, list) or not administrations:
        return {}

    if administration_id:
        for administration in administrations:
            if str(administration.get("id")) == str(administration_id):
                return administration

    return administrations[0]


def fetch_moneybird_ledger_account_types(token: str, administration_id: Any) -> Dict[str, str]:
    response = requests.get(
        f"{MONEYBIRD_API_BASE}/{administration_id}/ledger_accounts.json",
        headers=get_moneybird_headers(token),
        timeout=20,
    )
    response.raise_for_status()
    accounts = response.json()
    if not isinstance(accounts, list):
        return {}

    return {
        str(account.get("id")): str(account.get("account_type", "")).strip()
        for account in accounts
        if account.get("id")
    }


def fetch_moneybird_summary() -> Dict[str, Any]:
    config = get_config()
    token = config["moneybird_token"]
    if not token:
        return {
            "source": "missing",
            "invoiceCount": 0,
            "revenue_received": 0.0,
            "message": "Moneybird-koppeling staat nog niet aan. Voeg MONEYBIRD_API_TOKEN toe.",
        }

    try:
        administration = fetch_moneybird_administration(config)
        administration_id = administration.get("id")
        if not administration_id:
            return {
                "source": "missing",
                "invoiceCount": 0,
                "revenue_received": 0.0,
                "expenses_total": 0.0,
                "financialMutations": [],
                "message": "Geen Moneybird-administratie gevonden voor de huidige API-token.",
            }

        ledger_account_types = fetch_moneybird_ledger_account_types(token, administration_id)

        sync_url = f"{MONEYBIRD_API_BASE}/{administration_id}/sales_invoices/synchronization.json"
        response = requests.get(
            sync_url,
            headers=get_moneybird_headers(token),
            timeout=20,
        )
        response.raise_for_status()
        sync_items = response.json()
        if not isinstance(sync_items, list):
            sync_items = []

        invoice_ids = [item.get("id") for item in sync_items if item.get("id")]
        invoices: List[Dict[str, Any]] = []
        batch_size = 100

        for start_index in range(0, len(invoice_ids), batch_size):
            batch_ids = invoice_ids[start_index : start_index + batch_size]
            detail_response = requests.post(
                sync_url,
                headers={
                    **get_moneybird_headers(token),
                    "Content-Type": "application/json",
                },
                json={"ids": batch_ids},
                timeout=20,
            )
            detail_response.raise_for_status()
            batch = detail_response.json()
            if isinstance(batch, list):
                invoices.extend(batch)

        invoice_years = []
        for invoice in invoices:
            invoice_date = parse_iso_date(str(invoice.get("invoice_date", "")).strip())
            if invoice_date is not None:
                invoice_years.append(invoice_date.year)

        start_year = min(invoice_years, default=date.today().year)
        end_year = max(invoice_years, default=date.today().year) + 1

        mutations_sync_url = f"{MONEYBIRD_API_BASE}/{administration_id}/financial_mutations/synchronization.json"
        mutation_response = requests.get(
            mutations_sync_url,
            headers=get_moneybird_headers(token),
            params={"filter": f"period:{start_year}01..{end_year}12,state:all,mutation_type:credit"},
            timeout=20,
        )
        mutation_response.raise_for_status()
        mutation_sync_items = mutation_response.json()
        if not isinstance(mutation_sync_items, list):
            mutation_sync_items = []

        mutation_ids = [item.get("id") for item in mutation_sync_items if item.get("id")]
        financial_mutations: List[Dict[str, Any]] = []

        for start_index in range(0, len(mutation_ids), batch_size):
            batch_ids = mutation_ids[start_index : start_index + batch_size]
            detail_response = requests.post(
                mutations_sync_url,
                headers={
                    **get_moneybird_headers(token),
                    "Content-Type": "application/json",
                },
                json={"ids": batch_ids},
                timeout=20,
            )
            detail_response.raise_for_status()
            batch = detail_response.json()
            if isinstance(batch, list):
                financial_mutations.extend(batch)

        invoiced_total = sum(decimal_from_value(invoice.get("total_price_incl_tax")) for invoice in invoices)
        received_total = sum(decimal_from_value(invoice.get("total_paid")) for invoice in invoices)
        expenses_total = sum(
            abs(decimal_from_value(mutation.get("amount")))
            for mutation in financial_mutations
            if is_cost_mutation(mutation, ledger_account_types)
        )
        outstanding_total = invoiced_total - received_total
        last_synced_at = max(
            (
                str(value).strip()
                for value in [
                    *(invoice.get("updated_at", "") for invoice in invoices),
                    *(mutation.get("updated_at", "") for mutation in financial_mutations),
                ]
                if value
            ),
            default="",
        )

        return {
            "source": "moneybird",
            "administrationId": str(administration_id),
            "administrationName": administration.get("name", ""),
            "invoiceCount": len(invoices),
            "revenue_total": round(float(invoiced_total), 2),
            "revenue_received": round(float(received_total), 2),
            "revenue_outstanding": round(float(outstanding_total), 2),
            "expenses_total": round(float(expenses_total), 2),
            "lastSyncedAt": last_synced_at,
            "invoices": invoices,
            "financialMutations": financial_mutations,
            "ledgerAccountTypes": ledger_account_types,
        }
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 0
        if status_code == 401:
            message = "Moneybird API-token is ongeldig of ingetrokken. Controleer MONEYBIRD_API_TOKEN."
        elif status_code == 403:
            message = "Moneybird-token heeft onvoldoende rechten voor deze administratie."
        elif status_code == 404:
            message = "Moneybird-administratie niet gevonden. Controleer MONEYBIRD_ADMINISTRATION_ID."
        else:
            message = "Moneybird reageerde met een fout. Controleer token, administratie en rechten."
        return {
            "source": "error",
            "administrationId": str(config.get("moneybird_administration_id") or ""),
            "invoiceCount": 0,
            "revenue_total": 0.0,
            "revenue_received": 0.0,
            "revenue_outstanding": 0.0,
            "expenses_total": 0.0,
            "lastSyncedAt": "",
            "invoices": [],
            "financialMutations": [],
            "ledgerAccountTypes": {},
            "message": message,
        }
    except requests.RequestException:
        return {
            "source": "error",
            "administrationId": str(config.get("moneybird_administration_id") or ""),
            "invoiceCount": 0,
            "revenue_total": 0.0,
            "revenue_received": 0.0,
            "revenue_outstanding": 0.0,
            "expenses_total": 0.0,
            "lastSyncedAt": "",
            "invoices": [],
            "financialMutations": [],
            "ledgerAccountTypes": {},
            "message": "Moneybird is tijdelijk niet bereikbaar. Probeer het zo opnieuw.",
        }


def fetch_dashboard_payload() -> Dict[str, Any]:
    ecwid_payload = fetch_orders_from_ecwid()
    moneybird_payload = fetch_moneybird_summary()
    ecwid_summary = ecwid_payload.get("summary", build_summary(ecwid_payload.get("items", [])))
    report_summary = build_report_summary(ecwid_summary, moneybird_payload)
    messages = [message for message in [ecwid_payload.get("message"), moneybird_payload.get("message")] if message]

    return {
        **ecwid_payload,
        "moneybird": moneybird_payload,
        "reportSummary": report_summary,
        "message": " ".join(messages) if messages else None,
    }


def fetch_ecwid_orders_payload() -> Dict[str, Any]:
    payload = fetch_orders_from_ecwid()
    items = payload.get("items", [])
    if "summary" not in payload:
        payload["summary"] = build_summary(items)
    return payload


def refresh_orders_cache() -> None:
    global refresh_in_progress
    try:
        payload = fetch_dashboard_payload()
        with cache_lock:
            orders_cache["payload"] = payload
            orders_cache["cached_at"] = time.time()
    finally:
        refresh_in_progress = False


def start_background_refresh() -> None:
    global refresh_in_progress
    if refresh_in_progress:
        return

    refresh_in_progress = True
    threading.Thread(target=refresh_orders_cache, daemon=True).start()


def refresh_ecwid_orders_cache() -> None:
    global ecwid_refresh_in_progress
    try:
        payload = fetch_ecwid_orders_payload()
        with ecwid_orders_cache_lock:
            ecwid_orders_cache["payload"] = payload
            ecwid_orders_cache["cached_at"] = time.time()
    finally:
        ecwid_refresh_in_progress = False


def start_ecwid_orders_background_refresh() -> None:
    global ecwid_refresh_in_progress
    if ecwid_refresh_in_progress:
        return

    ecwid_refresh_in_progress = True
    threading.Thread(target=refresh_ecwid_orders_cache, daemon=True).start()


def fetch_orders(force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    with cache_lock:
        cached_payload = orders_cache.get("payload")
        cached_at = float(orders_cache.get("cached_at") or 0.0)

    cache_is_fresh = cached_payload is not None and now - cached_at < CACHE_TTL_SECONDS

    if not force_refresh and cache_is_fresh:
        payload = dict(cached_payload)
        payload["cachedAt"] = cached_at
        return payload

    if not force_refresh and cached_payload is not None:
        payload = dict(cached_payload)
        payload["cachedAt"] = cached_at
        start_background_refresh()
        return payload

    try:
        payload = fetch_dashboard_payload()
    except requests.RequestException:
        if cached_payload is not None:
            payload = dict(cached_payload)
            payload["cachedAt"] = cached_at
            payload["message"] = (
                "Er wordt tijdelijk een recente cacheversie getoond omdat Ecwid niet direct reageerde."
            )
            return payload
        raise

    with cache_lock:
        orders_cache["payload"] = payload
        orders_cache["cached_at"] = now

    payload_with_cache = dict(payload)
    payload_with_cache["cachedAt"] = now
    return payload_with_cache


def fetch_ecwid_orders(force_refresh: bool = False) -> Dict[str, Any]:
    now = time.time()
    with ecwid_orders_cache_lock:
        cached_payload = ecwid_orders_cache.get("payload")
        cached_at = float(ecwid_orders_cache.get("cached_at") or 0.0)

    cache_is_fresh = cached_payload is not None and now - cached_at < CACHE_TTL_SECONDS

    if not force_refresh and cache_is_fresh:
        payload = dict(cached_payload)
        payload["cachedAt"] = cached_at
        return payload

    if not force_refresh and cached_payload is not None:
        payload = dict(cached_payload)
        payload["cachedAt"] = cached_at
        start_ecwid_orders_background_refresh()
        return payload

    try:
        payload = fetch_ecwid_orders_payload()
    except requests.RequestException:
        if cached_payload is not None:
            payload = dict(cached_payload)
            payload["cachedAt"] = cached_at
            payload["message"] = (
                "Er wordt tijdelijk een recente cacheversie getoond omdat Ecwid niet direct reageerde."
            )
            return payload
        raise

    with ecwid_orders_cache_lock:
        ecwid_orders_cache["payload"] = payload
        ecwid_orders_cache["cached_at"] = now

    payload_with_cache = dict(payload)
    payload_with_cache["cachedAt"] = now
    return payload_with_cache


def get_empty_dashboard_payload(message: Optional[str] = None) -> Dict[str, Any]:
    empty_summary = build_summary([])
    empty_moneybird = {
        "source": "pending",
        "invoiceCount": 0,
        "revenue_received": 0.0,
        "revenue_total": 0.0,
        "revenue_outstanding": 0.0,
        "expenses_total": 0.0,
        "lastSyncedAt": "",
        "invoices": [],
        "financialMutations": [],
        "ledgerAccountTypes": {},
    }
    return {
        "source": "pending",
        "items": [],
        "summary": empty_summary,
        "moneybird": empty_moneybird,
        "reportSummary": build_report_summary(empty_summary, empty_moneybird),
        "message": message,
        "cachedAt": 0.0,
    }


def fetch_orders_non_blocking() -> Dict[str, Any]:
    now = time.time()
    with cache_lock:
        cached_payload = orders_cache.get("payload")
        cached_at = float(orders_cache.get("cached_at") or 0.0)

    if cached_payload is not None:
        payload = dict(cached_payload)
        payload["cachedAt"] = cached_at
        if now - cached_at >= CACHE_TTL_SECONDS:
            start_background_refresh()
        return payload

    start_background_refresh()
    return get_empty_dashboard_payload(
        "Dashboard wordt op de achtergrond bijgewerkt. De nieuwste cijfers verschijnen zo automatisch."
    )


def format_cache_timestamp(timestamp: float) -> str:
    if not timestamp:
        return datetime.now().strftime("%d-%m-%Y %H:%M")
    return datetime.fromtimestamp(timestamp).strftime("%d-%m-%Y %H:%M")


def build_dashboard_frontend_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    moneybird_payload = payload.get("moneybird", {})
    ledger_account_types = moneybird_payload.get("ledgerAccountTypes", {})
    monthly_revenue_series = build_monthly_revenue_series(
        payload.get("items", []),
        moneybird_payload.get("invoices", []),
        moneybird_payload.get("financialMutations", []),
        ledger_account_types,
    )
    return {
        "source": payload.get("source", "mock"),
        "summary": payload.get("summary", {}),
        "reportSummary": payload.get("reportSummary", {}),
        "productSummary": build_product_summary(payload.get("items", [])),
        "monthlyRevenueSeries": monthly_revenue_series[-12:],
        "moneybird": moneybird_payload,
        "message": payload.get("message"),
        "cachedAt": payload.get("cachedAt", 0.0),
        "lastUpdated": format_cache_timestamp(payload.get("cachedAt", 0.0)),
    }


def parse_iso_datetime(value: str) -> Optional[datetime]:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def invite_is_expired(user: Dict[str, Any]) -> bool:
    expires_at = parse_iso_datetime(user.get("inviteExpiresAt", ""))
    if expires_at is None:
        return False
    return expires_at < datetime.utcnow()


def parse_iso_date(value: str) -> Optional[date]:
    if not value:
        return None

    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def format_currency(value: float) -> str:
    return f"EUR {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def get_month_label(month_key: str) -> str:
    month_names = [
        "januari",
        "februari",
        "maart",
        "april",
        "mei",
        "juni",
        "juli",
        "augustus",
        "september",
        "oktober",
        "november",
        "december",
    ]
    month_date = datetime.strptime(f"{month_key}-01", "%Y-%m-%d")
    return f"{month_names[month_date.month - 1]} {month_date.year}"


def build_month_options(orders: List[Dict[str, Any]], moneybird_invoices: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    month_keys = set()

    for order in orders:
        created_at = parse_iso_datetime(order.get("createdAt", ""))
        if created_at is not None:
            month_keys.add(created_at.strftime("%Y-%m"))

    for invoice in moneybird_invoices:
        invoice_date = parse_iso_date(str(invoice.get("invoice_date", "")).strip())
        if invoice_date is not None:
            month_keys.add(invoice_date.strftime("%Y-%m"))

    sorted_months = sorted(month_keys, reverse=True)
    options = []
    for month_key in sorted_months:
        options.append(
            {
                "value": month_key,
                "label": get_month_label(month_key),
            }
        )

    return options


def build_profit_month_options(
    orders: List[Dict[str, Any]],
    moneybird_invoices: List[Dict[str, Any]],
    financial_mutations: List[Dict[str, Any]],
    ledger_account_types: Dict[str, str],
) -> List[Dict[str, str]]:
    month_keys = set()

    for order in orders:
        created_at = parse_iso_datetime(order.get("createdAt", ""))
        if created_at is not None:
            month_keys.add(created_at.strftime("%Y-%m"))

    for invoice in moneybird_invoices:
        for payment in invoice.get("payments") or []:
            payment_date = parse_iso_date(str(payment.get("payment_date", "")).strip())
            if payment_date is not None:
                month_keys.add(payment_date.strftime("%Y-%m"))

    for mutation in financial_mutations:
        mutation_date = parse_iso_date(str(mutation.get("date", "")).strip())
        if mutation_date is not None and is_cost_mutation(mutation, ledger_account_types):
            month_keys.add(mutation_date.strftime("%Y-%m"))

    return [
        {"value": month_key, "label": get_month_label(month_key)}
        for month_key in sorted(month_keys, reverse=True)
    ]


def get_football_season_label(start_year: int) -> str:
    return f"{start_year}/{start_year + 1}"


def build_football_season_options(start_year: int = 2022, reference_date: Optional[date] = None) -> List[Dict[str, str]]:
    current_date = reference_date or date.today()
    current_season_start_year = current_date.year if current_date.month >= 7 else current_date.year - 1

    return [
        {
            "value": str(season_start_year),
            "label": get_football_season_label(season_start_year),
        }
        for season_start_year in range(current_season_start_year, start_year - 1, -1)
    ]


def get_football_season_range(season_start_year: int) -> Dict[str, date]:
    return {
        "start": date(season_start_year, 7, 1),
        "end": date(season_start_year + 1, 6, 30),
    }


def build_moneybird_revenue_by_month(moneybird_invoices: List[Dict[str, Any]]) -> Dict[str, Decimal]:
    revenue_by_month: Dict[str, Decimal] = {}

    for invoice in moneybird_invoices:
        for payment in invoice.get("payments") or []:
            payment_date = parse_iso_date(str(payment.get("payment_date", "")).strip())
            if payment_date is None:
                continue

            month_key = payment_date.strftime("%Y-%m")
            revenue_by_month[month_key] = revenue_by_month.get(month_key, Decimal("0")) + decimal_from_value(
                payment.get("price")
            )

    return revenue_by_month


def build_moneybird_expenses_by_month(
    financial_mutations: List[Dict[str, Any]],
    ledger_account_types: Dict[str, str],
) -> Dict[str, Decimal]:
    expenses_by_month: Dict[str, Decimal] = {}

    for mutation in financial_mutations:
        mutation_date = parse_iso_date(str(mutation.get("date", "")).strip())
        if mutation_date is None or not is_cost_mutation(mutation, ledger_account_types):
            continue

        month_key = mutation_date.strftime("%Y-%m")
        expenses_by_month[month_key] = expenses_by_month.get(month_key, Decimal("0")) + abs(
            decimal_from_value(mutation.get("amount"))
        )

    return expenses_by_month


def build_period_revenue_summary(
    orders: List[Dict[str, Any]],
    moneybird_invoices: List[Dict[str, Any]],
    financial_mutations: List[Dict[str, Any]],
    ledger_account_types: Dict[str, str],
    period_start: date,
    period_end: date,
    period_label: str,
    period_value: str,
) -> Dict[str, Any]:
    ecwid_revenue = Decimal("0")
    ecwid_order_count = 0

    for order in orders:
        created_at = parse_iso_datetime(order.get("createdAt", ""))
        if created_at is None or order.get("paymentStatus") == "REFUNDED":
            continue

        created_date = created_at.date()
        if created_date < period_start or created_date > period_end:
            continue

        ecwid_revenue += decimal_from_value(order.get("total"))
        ecwid_order_count += 1

    moneybird_revenue = Decimal("0")
    moneybird_payment_count = 0

    for invoice in moneybird_invoices:
        for payment in invoice.get("payments") or []:
            payment_date = parse_iso_date(str(payment.get("payment_date", "")).strip())
            if payment_date is None or payment_date < period_start or payment_date > period_end:
                continue

            moneybird_revenue += decimal_from_value(payment.get("price"))
            moneybird_payment_count += 1

    expenses = Decimal("0")
    for mutation in financial_mutations:
        mutation_date = parse_iso_date(str(mutation.get("date", "")).strip())
        if (
            mutation_date is None
            or mutation_date < period_start
            or mutation_date > period_end
            or not is_cost_mutation(mutation, ledger_account_types)
        ):
            continue

        expenses += abs(decimal_from_value(mutation.get("amount")))

    combined_revenue = ecwid_revenue + moneybird_revenue
    profit = combined_revenue - expenses
    return {
        "selectedPeriod": period_value,
        "selectedPeriodLabel": period_label,
        "periodStart": period_start.isoformat(),
        "periodEnd": period_end.isoformat(),
        "ecwidRevenue": round(float(ecwid_revenue), 2),
        "ecwidOrderCount": ecwid_order_count,
        "moneybirdRevenue": round(float(moneybird_revenue), 2),
        "moneybirdPaymentCount": moneybird_payment_count,
        "expenses": round(float(expenses), 2),
        "combinedRevenue": round(float(combined_revenue), 2),
        "profit": round(float(profit), 2),
        "profitMarginPercentage": calculate_margin_percentage(combined_revenue, profit),
    }


def build_football_season_summary(
    orders: List[Dict[str, Any]],
    moneybird_invoices: List[Dict[str, Any]],
    financial_mutations: List[Dict[str, Any]],
    ledger_account_types: Dict[str, str],
    season_start_year: int,
) -> Dict[str, Any]:
    season_range = get_football_season_range(season_start_year)
    return build_period_revenue_summary(
        orders,
        moneybird_invoices,
        financial_mutations,
        ledger_account_types,
        season_range["start"],
        season_range["end"],
        get_football_season_label(season_start_year),
        str(season_start_year),
    )


def build_monthly_revenue_summary(
    orders: List[Dict[str, Any]],
    moneybird_invoices: List[Dict[str, Any]],
    financial_mutations: List[Dict[str, Any]],
    ledger_account_types: Dict[str, str],
    selected_month: str,
) -> Dict[str, Any]:
    month_start = datetime.strptime(f"{selected_month}-01", "%Y-%m-%d").date()
    next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    month_end = next_month - timedelta(days=1)
    summary = build_period_revenue_summary(
        orders,
        moneybird_invoices,
        financial_mutations,
        ledger_account_types,
        month_start,
        month_end,
        get_month_label(selected_month),
        selected_month,
    )
    summary["selectedMonth"] = selected_month
    summary["selectedMonthLabel"] = summary["selectedPeriodLabel"]
    return summary


def build_monthly_revenue_series(
    orders: List[Dict[str, Any]],
    moneybird_invoices: List[Dict[str, Any]],
    financial_mutations: List[Dict[str, Any]],
    ledger_account_types: Dict[str, str],
) -> List[Dict[str, Any]]:
    month_keys: Set[str] = set()
    ecwid_by_month: Dict[str, Decimal] = {}
    moneybird_by_month = build_moneybird_revenue_by_month(moneybird_invoices)
    expenses_by_month = build_moneybird_expenses_by_month(financial_mutations, ledger_account_types)

    for order in orders:
        created_at = parse_iso_datetime(order.get("createdAt", ""))
        if created_at is None or order.get("paymentStatus") == "REFUNDED":
            continue
        month_key = created_at.strftime("%Y-%m")
        month_keys.add(month_key)
        ecwid_by_month[month_key] = ecwid_by_month.get(month_key, Decimal("0")) + decimal_from_value(order.get("total"))

    for month_key in moneybird_by_month:
        month_keys.add(month_key)

    for month_key in expenses_by_month:
        month_keys.add(month_key)

    series = []
    for month_key in sorted(month_keys):
        ecwid_revenue = ecwid_by_month.get(month_key, Decimal("0"))
        moneybird_revenue = moneybird_by_month.get(month_key, Decimal("0"))
        expenses = expenses_by_month.get(month_key, Decimal("0"))
        combined_revenue = ecwid_revenue + moneybird_revenue
        profit = combined_revenue - expenses
        series.append(
            {
                "month": month_key,
                "label": get_month_label(month_key),
                "ecwidRevenue": round(float(ecwid_revenue), 2),
                "moneybirdRevenue": round(float(moneybird_revenue), 2),
                "combinedRevenue": round(float(combined_revenue), 2),
                "expenses": round(float(expenses), 2),
                "profit": round(float(profit), 2),
                "profitMarginPercentage": calculate_margin_percentage(combined_revenue, profit),
            }
        )

    return series


def build_profit_totals(
    orders: List[Dict[str, Any]],
    moneybird_invoices: List[Dict[str, Any]],
    financial_mutations: List[Dict[str, Any]],
    ledger_account_types: Dict[str, str],
) -> Dict[str, Any]:
    monthly_series = build_monthly_revenue_series(orders, moneybird_invoices, financial_mutations, ledger_account_types)
    combined_revenue = sum(decimal_from_value(item.get("combinedRevenue")) for item in monthly_series)
    expenses = sum(decimal_from_value(item.get("expenses")) for item in monthly_series)
    profit = combined_revenue - expenses

    return {
        "combinedRevenue": round(float(combined_revenue), 2),
        "expenses": round(float(expenses), 2),
        "profit": round(float(profit), 2),
        "profitMarginPercentage": calculate_margin_percentage(combined_revenue, profit),
    }


def mock_orders() -> List[Dict[str, Any]]:
    return [
        {
            "id": "WEB-1001",
            "orderNumber": "WEB-1001",
            "createdAt": "2026-04-04T14:12:00+02:00",
            "status": "PAID",
            "paymentStatus": "PAID",
            "fulfillmentStatus": "AWAITING_PROCESSING",
            "total": 89.95,
            "email": "anne@example.com",
            "customerName": "Anne de Vries",
            "paymentMethod": "iDEAL",
            "shippingMethod": "PostNL pakket",
            "itemCount": 3,
            "items": [
                {"name": "Linnen blouse", "quantity": 1, "price": 49.95, "sku": "BL-01"},
                {"name": "Canvas tas", "quantity": 2, "price": 20.00, "sku": "TS-02"},
            ],
        },
        {
            "id": "WEB-1002",
            "orderNumber": "WEB-1002",
            "createdAt": "2026-04-03T09:05:00+02:00",
            "status": "PROCESSING",
            "paymentStatus": "AWAITING_PAYMENT",
            "fulfillmentStatus": "AWAITING_PROCESSING",
            "total": 129.00,
            "email": "milan@example.com",
            "customerName": "Milan Jansen",
            "paymentMethod": "Bankoverschrijving",
            "shippingMethod": "Afhalen",
            "itemCount": 1,
            "items": [
                {"name": "Leren portefeuille", "quantity": 1, "price": 129.00, "sku": "PF-09"},
            ],
        },
        {
            "id": "WEB-1003",
            "orderNumber": "WEB-1003",
            "createdAt": "2026-04-01T16:45:00+02:00",
            "status": "SHIPPED",
            "paymentStatus": "PAID",
            "fulfillmentStatus": "SHIPPED",
            "total": 62.50,
            "email": "noor@example.com",
            "customerName": "Noor Bakker",
            "paymentMethod": "Creditcard",
            "shippingMethod": "DHL",
            "itemCount": 2,
            "items": [
                {"name": "Keramische mok", "quantity": 2, "price": 17.50, "sku": "MK-11"},
                {"name": "Theeblik", "quantity": 1, "price": 27.50, "sku": "TB-03"},
            ],
        },
    ]


run_storage_migrations()


@app.route("/login", methods=["GET", "POST"])
def login_page() -> str:
    existing_user = get_current_user()
    if existing_user is not None and request.method == "GET":
        return redirect(get_default_post_login_path(existing_user))

    login_error = ""
    next_path = request.args.get("next", "").strip() or request.form.get("next", "").strip()

    if request.method == "POST":
        login_value = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        user = authenticate_user(login_value, password)
        if user is None:
            login_error = GENERIC_AUTH_ERROR_MESSAGE
        else:
            rotate_authenticated_session(user["id"])
            if not next_path or next_path == "/":
                next_path = get_default_post_login_path(user)
            if not is_safe_redirect_target(next_path):
                next_path = get_default_post_login_path(user)
            return redirect(next_path)

    if not next_path:
        fallback_user = existing_user or {"isAdmin": True}
        next_path = get_default_post_login_path(fallback_user)

    return render_template("login.html", login_error=login_error, next_path=next_path)


@app.route("/uitnodiging/<invite_token>", methods=["GET", "POST"])
def invite_accept_page(invite_token: str) -> str:
    invited_user = get_user_by_invite_token(invite_token)
    if invited_user is None:
        return render_template(
            "invite_accept.html",
            invited_user=None,
            invite_error="Deze aanmeldlink is niet geldig of is al gebruikt.",
            invite_success="",
        )

    if invited_user.get("passwordHash"):
        return redirect(url_for("login_page"))

    if invite_is_expired(invited_user):
        return render_template(
            "invite_accept.html",
            invited_user=invited_user,
            invite_error="Deze aanmeldlink is verlopen. Maak een nieuwe uitnodiging aan voor dit teamlid.",
            invite_success="",
        )

    invite_error = ""
    invite_success = ""

    if request.method == "POST":
        password = request.form.get("password", "")
        password_confirm = request.form.get("password_confirm", "")

        if len(password) < 12:
            invite_error = "Kies een wachtwoord van minimaal 12 tekens."
        elif password != password_confirm:
            invite_error = "De wachtwoorden komen niet overeen."
        else:
            accept_trainer_invite(invited_user["id"], password)
            refreshed_user = get_user_by_id(invited_user["id"])
            if refreshed_user is not None:
                rotate_authenticated_session(refreshed_user["id"])
            invite_success = "Wachtwoord opgeslagen. Je account is geactiveerd."
            if refreshed_user is not None:
                return redirect(get_default_post_login_path(refreshed_user))

    return render_template(
        "invite_accept.html",
        invited_user=invited_user,
        invite_error=invite_error,
        invite_success=invite_success,
    )


@app.post("/logout")
def logout_page():
    session.clear()
    return redirect(url_for("login_page"))


@app.get("/")
def index() -> str:
    access_redirect = require_page_access("dashboard")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    dashboard_payload = build_dashboard_frontend_payload(payload)
    return render_template(
        "index.html",
        active_page="dashboard",
        dashboard_weather=load_dashboard_weather_settings(),
        source=dashboard_payload["source"],
        summary=dashboard_payload["summary"],
        report_summary=dashboard_payload["reportSummary"],
        product_summary=dashboard_payload["productSummary"],
        last_updated=dashboard_payload["lastUpdated"],
        message=dashboard_payload["message"],
    )


@app.get("/bestellingen")
def orders_page() -> str:
    access_redirect = require_page_access("orders")
    if access_redirect is not None:
        return access_redirect

    page = max(request.args.get("page", default=1, type=int), 1)
    search_query = request.args.get("q", "").strip()
    selected_status = request.args.get("status", "").strip()
    selected_payment_status = request.args.get("payment_status", "").strip()
    selected_month = request.args.get("month", "").strip()
    per_page = 20
    payload = fetch_ecwid_orders()
    all_orders = sort_orders_desc(payload.get("items", []))
    filter_options = build_orders_filter_options(all_orders)
    filtered_orders = filter_orders(
        all_orders,
        search_query=search_query,
        status=selected_status,
        payment_status=selected_payment_status,
        month=selected_month,
    )
    total_orders = len(filtered_orders)
    total_pages = max(ceil(total_orders / per_page), 1)
    current_page = min(page, total_pages)
    start_index = (current_page - 1) * per_page
    end_index = start_index + per_page
    page_orders = decorate_orders_for_list(filtered_orders[start_index:end_index])

    pagination_links = []
    for page_number in range(1, total_pages + 1):
        pagination_links.append(
            {
                "page": page_number,
                "url": build_orders_page_url(
                    page=page_number,
                    search_query=search_query,
                    status=selected_status,
                    payment_status=selected_payment_status,
                    month=selected_month,
                ),
            }
        )

    return render_template(
        "orders.html",
        active_page="orders",
        source=payload.get("source", "mock"),
        summary=payload.get("summary", build_summary(payload.get("items", []))),
        orders=page_orders,
        current_page=current_page,
        total_pages=total_pages,
        total_orders=total_orders,
        start_number=start_index + 1 if total_orders else 0,
        end_number=min(end_index, total_orders),
        total_unfiltered_orders=len(all_orders),
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
        search_query=search_query,
        selected_status=selected_status,
        selected_payment_status=selected_payment_status,
        selected_month=selected_month,
        filter_options=filter_options,
        has_active_filters=bool(search_query or selected_status or selected_payment_status or selected_month),
        refresh_url=build_orders_page_url(
            page=current_page,
            search_query=search_query,
            status=selected_status,
            payment_status=selected_payment_status,
            month=selected_month,
        ),
        reset_filters_url=url_for("orders_page"),
        prev_page_url=(
            build_orders_page_url(
                page=current_page - 1,
                search_query=search_query,
                status=selected_status,
                payment_status=selected_payment_status,
                month=selected_month,
            )
            if current_page > 1
            else ""
        ),
        next_page_url=(
            build_orders_page_url(
                page=current_page + 1,
                search_query=search_query,
                status=selected_status,
                payment_status=selected_payment_status,
                month=selected_month,
            )
            if current_page < total_pages
            else ""
        ),
        pagination_links=pagination_links,
    )


@app.post("/bestellingen/teamindeling-export")
def export_orders_team_assignment():
    access_redirect = require_page_access("orders")
    if access_redirect is not None:
        return access_redirect

    selected_ids = parse_selected_order_ids(request.form.getlist("selected_order_ids"))
    if not selected_ids:
        return redirect(url_for("orders_page"))

    payload = fetch_ecwid_orders()
    orders_by_id = {
        str(order.get("id", "") or order.get("orderNumber", "")): order
        for order in payload.get("items", [])
    }
    selected_orders = [orders_by_id[order_id] for order_id in selected_ids if order_id in orders_by_id]

    if not selected_orders:
        return redirect(url_for("orders_page"))

    workbook_buffer = build_team_assignment_workbook(selected_orders)
    filename = f"teamindeling-bestellingen-{datetime.now().strftime('%Y%m%d-%H%M')}.xlsx"
    return (
        workbook_buffer.getvalue(),
        200,
        {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@app.get("/omzet")
def revenue_home_page() -> str:
    access_redirect = require_page_access("revenue")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    return render_template(
        "revenue_home.html",
        active_page="revenue",
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
    )


@app.get("/omzet/totaal")
def revenue_total_page() -> str:
    access_redirect = require_page_access("revenue")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    orders = payload.get("items", [])
    moneybird = payload.get("moneybird", {})
    ledger_account_types = moneybird.get("ledgerAccountTypes", {})
    monthly_revenue_series = build_monthly_revenue_series(
        orders,
        moneybird.get("invoices", []),
        moneybird.get("financialMutations", []),
        ledger_account_types,
    )

    return render_template(
        "revenue_total.html",
        active_page="revenue",
        report_summary=payload.get("reportSummary", build_report_summary(payload.get("summary", {}), {})),
        monthly_revenue_series=monthly_revenue_series,
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
    )


@app.get("/omzet/per-maand")
def revenue_monthly_page() -> str:
    access_redirect = require_page_access("revenue")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    orders = payload.get("items", [])
    moneybird = payload.get("moneybird", {})
    moneybird_invoices = moneybird.get("invoices", [])
    financial_mutations = moneybird.get("financialMutations", [])
    ledger_account_types = moneybird.get("ledgerAccountTypes", {})
    month_options = build_profit_month_options(orders, moneybird_invoices, financial_mutations, ledger_account_types)

    selected_month = request.args.get("month", "").strip()
    available_months = {option["value"] for option in month_options}
    if selected_month not in available_months:
        selected_month = month_options[0]["value"] if month_options else datetime.now().strftime("%Y-%m")

    monthly_summary = build_monthly_revenue_summary(
        orders,
        moneybird_invoices,
        financial_mutations,
        ledger_account_types,
        selected_month,
    )

    return render_template(
        "revenue_monthly.html",
        active_page="revenue",
        month_options=month_options,
        monthly_summary=monthly_summary,
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
    )


@app.get("/omzet/winst")
def revenue_profit_page() -> str:
    access_redirect = require_page_access("revenue")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    orders = payload.get("items", [])
    moneybird = payload.get("moneybird", {})
    moneybird_invoices = moneybird.get("invoices", [])
    financial_mutations = moneybird.get("financialMutations", [])
    ledger_account_types = moneybird.get("ledgerAccountTypes", {})
    month_options = build_profit_month_options(orders, moneybird_invoices, financial_mutations, ledger_account_types)

    selected_month = request.args.get("month", "").strip()
    available_months = {option["value"] for option in month_options}
    if selected_month not in available_months:
        selected_month = month_options[0]["value"] if month_options else datetime.now().strftime("%Y-%m")

    monthly_summary = build_monthly_revenue_summary(
        orders,
        moneybird_invoices,
        financial_mutations,
        ledger_account_types,
        selected_month,
    )
    total_summary = build_profit_totals(orders, moneybird_invoices, financial_mutations, ledger_account_types)

    return render_template(
        "revenue_profit.html",
        active_page="revenue",
        month_options=month_options,
        total_summary=total_summary,
        monthly_summary=monthly_summary,
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
    )


@app.get("/omzet/per-seizoen")
def revenue_season_page() -> str:
    access_redirect = require_page_access("revenue")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    orders = payload.get("items", [])
    moneybird = payload.get("moneybird", {})
    moneybird_invoices = moneybird.get("invoices", [])
    financial_mutations = moneybird.get("financialMutations", [])
    ledger_account_types = moneybird.get("ledgerAccountTypes", {})
    season_options = build_football_season_options(start_year=2022)

    selected_season = request.args.get("season", "").strip()
    available_seasons = {option["value"] for option in season_options}
    if selected_season not in available_seasons:
        selected_season = season_options[0]["value"] if season_options else "2022"

    season_summary = build_football_season_summary(
        orders,
        moneybird_invoices,
        financial_mutations,
        ledger_account_types,
        int(selected_season),
    )

    return render_template(
        "revenue_season.html",
        active_page="revenue",
        season_options=season_options,
        season_summary=season_summary,
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
    )


@app.get("/trainersvergoedingen")
def trainer_fees_home_page() -> str:
    access_redirect = require_page_access("trainer-fees")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    return render_template(
        "trainer_fees_home.html",
        active_page="trainer-fees",
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
    )


@app.get("/trainersvergoedingen/per-training")
def trainer_fees_per_training_page() -> str:
    access_redirect = require_page_access("trainer-fees")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    return render_template(
        "trainer_fees_per_training.html",
        active_page="trainer-fees",
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
    )


@app.get("/trainersvergoedingen/per-maand")
def trainer_fees_per_month_page() -> str:
    access_redirect = require_page_access("trainer-fees")
    if access_redirect is not None:
        return access_redirect

    payload = fetch_orders()
    return render_template(
        "trainer_fees_per_month.html",
        active_page="trainer-fees",
        last_updated=format_cache_timestamp(payload.get("cachedAt", 0.0)),
        message=payload.get("message"),
    )


@app.route("/profiel", methods=["GET", "POST"])
def personal_profile_page() -> str:
    user = get_current_user()
    if user is None:
        return redirect(url_for("login_page"))

    form_error = request.args.get("error", "").strip()
    form_success = request.args.get("success", "").strip()

    if request.method == "POST":
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        full_name = " ".join(part for part in [first_name, last_name] if part).strip()
        email = request.form.get("email", "").strip()
        submitted_role = request.form.get("system_role", "").strip()
        current_role = normalize_system_role(str(user.get("systemRole") or user.get("role") or ""))
        system_role = normalize_system_role(submitted_role) if user.get("isAdmin") else current_role
        is_admin = role_grants_admin_access(system_role)
        member_type = derive_member_type_from_role(system_role)
        knvb_license = request.form.get("knvb_license", "").strip()
        education = request.form.get("education", "").strip()
        phone = request.form.get("phone", "").strip()
        notes = request.form.get("notes", "").strip()
        availability_days = request.form.getlist("availability_days")

        if not full_name or not email or not system_role:
            return redirect(url_for("personal_profile_page", error="Vul alle verplichte velden in."))
        if not is_valid_email_address(email):
            return redirect(url_for("personal_profile_page", error="Vul een geldig e-mailadres in."))
        if user.get("isAdmin") and not is_allowed_system_role(system_role):
            return redirect(url_for("personal_profile_page", error="Kies een geldige rol."))
        if trainer_email_exists(email, exclude_profile_id=user["id"]):
            return redirect(url_for("personal_profile_page", error="Dit e-mailadres is al gekoppeld aan een ander account."))

        update_trainer_profile(
            user["id"],
            full_name,
            email,
            build_internal_username(full_name, email, exclude_profile_id=user["id"]),
            member_type,
            system_role,
            knvb_license,
            education,
            phone,
            notes,
            availability_days,
            is_admin,
        )
        return redirect(url_for("personal_profile_page", success="Profiel opgeslagen."))

    profile = dict(user)
    name_parts = profile.get("fullName", "").split()
    profile["firstName"] = name_parts[0] if name_parts else ""
    profile["lastName"] = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""
    profile["initials"] = "".join(part[:1] for part in name_parts[:2]).upper() or "PP"

    return render_template(
        "personal_profile.html",
        active_page="profile",
        profile=profile,
        form_error=form_error,
        form_success=form_success,
        can_edit_role=bool(user.get("isAdmin")),
    )


@app.route("/trainers", methods=["GET", "POST"])
def trainers_page() -> str:
    admin_redirect = require_admin_user()
    if admin_redirect is not None:
        return admin_redirect

    form_error = request.args.get("error", "").strip()
    form_success = request.args.get("success", "").strip()
    invite_link = str(session.pop("latest_invite_link", "") or "").strip()

    if request.method == "POST":
        action = request.form.get("action", "").strip()
        if action == "update":
            profile_id = request.form.get("profile_id", "").strip()
            first_name = request.form.get("first_name", "").strip()
            last_name = request.form.get("last_name", "").strip()
            full_name = " ".join(part for part in [first_name, last_name] if part).strip()
            email = request.form.get("email", "").strip()
            system_role = normalize_system_role(request.form.get("system_role", "").strip())
            is_admin = role_grants_admin_access(system_role)
            member_type = derive_member_type_from_role(system_role)
            knvb_license = request.form.get("knvb_license", "").strip()
            education = request.form.get("education", "").strip()
            availability_days = request.form.getlist("availability_days")
            phone = request.form.get("phone", "").strip()
            notes = request.form.get("notes", "").strip()

            if not profile_id or not full_name or not email or not system_role:
                return redirect(url_for("trainers_page", error="Vul alle verplichte velden in."))
            if not is_valid_email_address(email):
                return redirect(url_for("trainers_page", error="Vul een geldig e-mailadres in."))
            if not is_allowed_system_role(system_role):
                return redirect(url_for("trainers_page", error="Kies een geldige rol."))

            existing_profile = next((item for item in load_trainer_profiles() if item.get("id") == profile_id), None)
            if existing_profile is None:
                return redirect(url_for("trainers_page", error="Dit teamlid bestaat niet meer."))

            if trainer_email_exists(email, exclude_profile_id=profile_id):
                return redirect(url_for("trainers_page", error="Dit e-mailadres bestaat al."))

            update_trainer_profile(
                profile_id,
                full_name,
                email,
                build_internal_username(full_name, email, exclude_profile_id=profile_id),
                member_type,
                system_role,
                knvb_license,
                education,
                phone,
                notes,
                availability_days,
                is_admin,
            )
            return redirect(url_for("trainers_page", success="Teamlid opgeslagen."))
        if action == "delete":
            profile_id = request.form.get("profile_id", "").strip()
            if not profile_id:
                return redirect(url_for("trainers_page", error="Teamlid kon niet worden verwijderd."))

            current_user = get_current_user()
            existing_profile = next((item for item in load_trainer_profiles() if item.get("id") == profile_id), None)
            if existing_profile is None:
                return redirect(url_for("trainers_page", error="Dit teamlid bestaat niet meer."))
            if current_user is not None and current_user.get("id") == profile_id:
                return redirect(url_for("trainers_page", error="Je kunt je eigen account niet verwijderen."))
            if existing_profile.get("isAdmin"):
                admin_count = sum(1 for item in load_trainer_profiles() if item.get("isAdmin"))
                if admin_count <= 1:
                    return redirect(url_for("trainers_page", error="De laatste admin kan niet worden verwijderd."))

            delete_trainer_profile(profile_id)
            return redirect(url_for("trainers_page", success="Teamlid verwijderd."))

        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        full_name = " ".join(part for part in [first_name, last_name] if part).strip()
        email = request.form.get("email", "").strip()
        system_role = normalize_system_role(request.form.get("system_role", "").strip())
        is_admin = role_grants_admin_access(system_role)
        member_type = derive_member_type_from_role(system_role)
        role = system_role or request.form.get("role", "").strip()
        knvb_license = request.form.get("knvb_license", "").strip()
        education = request.form.get("education", "").strip()
        availability_days = request.form.getlist("availability_days")
        phone = request.form.get("phone", "").strip()
        notes = request.form.get("notes", "").strip()

        if not full_name or not email or not system_role:
            return redirect(url_for("trainers_page", error="Vul alle verplichte velden in."))
        if not is_valid_email_address(email):
            return redirect(url_for("trainers_page", error="Vul een geldig e-mailadres in."))
        if not is_allowed_system_role(system_role):
            return redirect(url_for("trainers_page", error="Kies een geldige rol."))

        if trainer_email_exists(email):
            return redirect(url_for("trainers_page", error="Dit e-mailadres bestaat al."))

        try:
            invite = create_trainer_invite_profile(
                full_name,
                email,
                role,
                member_type,
                system_role,
                knvb_license,
                education,
                availability_days,
                phone,
                notes,
                is_admin=is_admin,
            )
        except sqlite3.IntegrityError:
            return redirect(url_for("trainers_page", error="Dit account kon niet worden opgeslagen. Controleer of het e-mailadres uniek is."))
        session["latest_invite_link"] = url_for("invite_accept_page", invite_token=invite["inviteToken"], _external=True)
        return redirect(url_for("trainers_page", success="Teamlid opgeslagen. De aanmeldlink is klaar om te delen."))

    profiles = load_trainer_profiles()
    for profile in profiles:
        created_at = parse_iso_datetime(profile.get("createdAt", ""))
        profile["createdAtDisplay"] = created_at.strftime("%d-%m-%Y %H:%M") if created_at else "-"
        initials = "".join(part[:1] for part in profile.get("fullName", "").split()[:2]).upper() or "TM"
        profile["initials"] = initials
        profile["availabilityLabel"] = ", ".join(profile.get("availabilityDays", [])) or "Niet ingesteld"

    return render_template(
        "trainers.html",
        active_page="trainers",
        trainer_profiles=profiles,
        account_debug=build_admin_account_debug_summary(),
        form_error=form_error,
        form_success=form_success,
        invite_link=invite_link,
    )


@app.route("/agenda", methods=["GET", "POST"])
def agenda_page() -> str:
    access_redirect = require_page_access("agenda")
    if access_redirect is not None:
        return access_redirect

    view_mode = normalize_agenda_label(request.args.get("view", "week")).lower() or "week"
    if view_mode not in {"week", "month"}:
        view_mode = "week"
    summary_filter = normalize_agenda_summary_filter(request.args.get("summary_filter", "total"))
    week_offset = request.args.get("week", default=0, type=int)
    month_offset = request.args.get("month", default=0, type=int)
    redirect_week = request.form.get("week", "").strip()
    redirect_month = request.form.get("month", "").strip()
    redirect_view = normalize_agenda_label(request.form.get("view", "")).lower()
    redirect_summary_filter = request.form.get("summary_filter", "").strip()
    if redirect_view in {"week", "month"}:
        view_mode = redirect_view
    if redirect_summary_filter:
        summary_filter = normalize_agenda_summary_filter(redirect_summary_filter)
    if redirect_week:
        try:
            week_offset = int(redirect_week)
        except ValueError:
            week_offset = week_offset
    if redirect_month:
        try:
            month_offset = int(redirect_month)
        except ValueError:
            month_offset = month_offset

    if request.method == "POST":
        action = request.form.get("action", "").strip()
        if action == "save_day_plans":
            raw_day_plans = request.form.get("day_plans", "").strip()
            raw_visible_dates = request.form.get("visible_dates", "").strip() or request.form.get("week_dates", "").strip()
            day_plans_payload = {}
            visible_dates: List[str] = []
            if raw_day_plans:
                try:
                    parsed_payload = json.loads(raw_day_plans)
                except json.JSONDecodeError:
                    parsed_payload = {}
                if isinstance(parsed_payload, dict):
                    day_plans_payload = {
                        str(key or "").strip(): str(value or "").strip()
                        for key, value in parsed_payload.items()
                    }
            if raw_visible_dates:
                try:
                    parsed_visible_dates = json.loads(raw_visible_dates)
                except json.JSONDecodeError:
                    parsed_visible_dates = []
                if isinstance(parsed_visible_dates, list):
                    visible_dates = [str(value or "").strip() for value in parsed_visible_dates if str(value or "").strip()]

            try:
                save_agenda_day_plans(day_plans_payload, replace_dates=visible_dates)
                return redirect(
                    url_for(
                        "agenda_page",
                        view=view_mode,
                        summary_filter=summary_filter,
                        week=week_offset,
                        month=month_offset,
                        success="Dagplanning opgeslagen.",
                    )
                )
            except ValueError as exc:
                return redirect(
                    url_for(
                        "agenda_page",
                        view=view_mode,
                        summary_filter=summary_filter,
                        week=week_offset,
                        month=month_offset,
                        error=str(exc),
                    )
                )

        title = request.form.get("title", "").strip()
        date_value = request.form.get("date", "").strip()
        time_value = request.form.get("time", "").strip()
        end_time_value = request.form.get("end_time", "").strip()
        location = request.form.get("location", "").strip()
        notes = request.form.get("notes", "").strip()

        if title and date_value and time_value:
            add_agenda_training(
                title,
                date_value,
                time_value,
                end_time_value or compute_default_end_time(time_value),
                location,
                notes,
            )
            return redirect(
                url_for(
                    "agenda_page",
                    view=view_mode,
                    summary_filter=summary_filter,
                    week=week_offset,
                    month=month_offset,
                    success="Training toegevoegd.",
                )
            )

        return redirect(
            url_for(
                "agenda_page",
                view=view_mode,
                summary_filter=summary_filter,
                week=week_offset,
                month=month_offset,
            )
        )

    today = date.today()
    week_start = today - timedelta(days=today.weekday()) + timedelta(days=week_offset * 7)
    month_start = add_months(today.replace(day=1), month_offset)
    week_days = get_week_days(week_start)
    month_weeks = build_agenda_month_days(month_start)
    month_days = [day for week in month_weeks for day in week]
    visible_days = week_days if view_mode == "week" else month_days
    visible_day_keys = [day["key"] for day in visible_days]
    day_plans = load_agenda_day_plans(visible_day_keys)
    all_day_plans = load_all_agenda_day_plans()
    filtered_summary_day_plans = filter_agenda_day_plans_for_summary(all_day_plans, summary_filter)
    selected_summary_filter = get_agenda_summary_filter_option(summary_filter)
    for day in visible_days:
        day["planType"] = day_plans.get(day["key"], "")
    agenda_day_plan_summary = build_agenda_day_plan_summary(filtered_summary_day_plans)
    week_end = week_start + timedelta(days=6)
    month_visible_start = month_days[0]["date"] if month_days else month_start
    month_visible_end = month_days[-1]["date"] if month_days else month_start
    agenda_external_labels: Dict[str, List[str]] = {day["key"]: [] for day in visible_days}
    try:
        agenda_external_labels = build_agenda_external_labels(
            visible_day_keys,
            AGENDA_SCHOOL_REGION,
        )
    except requests.RequestException:
        agenda_external_labels = {day["key"]: [] for day in visible_days}
    trainings = load_agenda_trainings(week_start.isoformat(), week_end.isoformat())
    month_trainings = load_agenda_trainings(month_visible_start.isoformat(), month_visible_end.isoformat())
    calendar_events = build_agenda_week_events(trainings, week_start)
    month_events = build_agenda_month_events(month_trainings, set(visible_day_keys))
    time_slots = [f"{hour:02d}" for hour in range(24)]
    month_day_names = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"]

    return render_template(
        "agenda.html",
        active_page="agenda",
        trainings=trainings,
        agenda_view=view_mode,
        agenda_summary_filter=summary_filter,
        agenda_summary_filter_options=AGENDA_SUMMARY_FILTER_OPTIONS,
        agenda_summary_filter_label=selected_summary_filter.get("label", "Totaal"),
        agenda_summary_filter_description=selected_summary_filter.get("description", ""),
        week_days=week_days,
        week_offset=week_offset,
        week_label=build_week_label(week_start),
        month_offset=month_offset,
        month_label=build_month_label(month_start),
        month_weeks=month_weeks,
        month_day_names=month_day_names,
        month_events=month_events,
        calendar_events=calendar_events,
        time_slots=time_slots,
        agenda_visible_dates=visible_day_keys,
        today_week_offset=0,
        agenda_day_plan_options=AGENDA_DAY_PLAN_OPTIONS,
        agenda_day_plan_summary=agenda_day_plan_summary,
        agenda_external_labels=agenda_external_labels,
        agenda_school_region=AGENDA_SCHOOL_REGION,
        success=request.args.get("success", "").strip(),
        error=request.args.get("error", "").strip(),
    )


@app.route("/taken", methods=["GET", "POST"])
def tasks_page() -> str:
    access_redirect = require_page_access("tasks")
    if access_redirect is not None:
        return access_redirect

    if request.method == "POST":
        action = request.form.get("action", "").strip()
        if action == "create":
            title = request.form.get("title", "").strip()
            due_date = request.form.get("due_date", "").strip()
            if title and due_date:
                add_task(title, due_date)
                return redirect(url_for("tasks_page", success="Taak opgeslagen."))
        elif action == "toggle":
            task_id = request.form.get("task_id", type=int)
            if task_id:
                toggle_task(task_id)
                return redirect(url_for("tasks_page", filter=request.args.get("filter", "all"), success="Taakstatus bijgewerkt."))
        elif action == "delete":
            task_id = request.form.get("task_id", type=int)
            if task_id:
                delete_task(task_id)
                return redirect(url_for("tasks_page", filter=request.args.get("filter", "all"), success="Taak verwijderd."))

    active_filter = request.args.get("filter", "all").strip() or "all"
    tasks = load_tasks()
    if active_filter == "open":
        tasks = [item for item in tasks if not item.get("isDone")]
    elif active_filter == "done":
        tasks = [item for item in tasks if item.get("isDone")]

    return render_template(
        "tasks.html",
        active_page="tasks",
        tasks=tasks,
        current_filter=active_filter,
        success=request.args.get("success", "").strip(),
    )


@app.get("/voorstellen-maker")
def voorstellen_maker_page() -> str:
    access_redirect = require_page_access("voorstellen-maker")
    if access_redirect is not None:
        return access_redirect

    return render_template(
        "voorstellen_maker.html",
        active_page="voorstellen-maker",
    )


@app.route("/social-media", methods=["GET", "POST"])
def social_media_page() -> str:
    access_redirect = require_page_access("social-media")
    if access_redirect is not None:
        return access_redirect

    redirect_week = request.form.get("week_offset", default=0, type=int)

    if request.method == "POST":
        action = request.form.get("action", "").strip()
        if action == "create_idea":
            title = request.form.get("title", "").strip()
            platforms = parse_social_media_platforms(request.form.getlist("platform") or request.form.get("platform", ""))
            content_type = request.form.get("content_type", "").strip()
            priority = request.form.get("priority", "").strip() or "Midden"
            notes = request.form.get("notes", "").strip()
            if title and platforms and content_type:
                add_social_media_idea(title, platforms, content_type, priority, notes)
                return redirect(url_for("social_media_page", week=redirect_week, success="Contentidee opgeslagen."))
        elif action == "update_idea":
            idea_id = request.form.get("idea_id", type=int)
            title = request.form.get("title", "").strip()
            platforms = parse_social_media_platforms(request.form.getlist("platform") or request.form.get("platform", ""))
            content_type = request.form.get("content_type", "").strip()
            priority = request.form.get("priority", "").strip() or "Midden"
            notes = request.form.get("notes", "").strip()
            if idea_id and title and platforms and content_type:
                update_social_media_idea(idea_id, title, platforms, content_type, priority, notes)
                return redirect(url_for("social_media_page", week=redirect_week, success="Contentidee opgeslagen."))
            return redirect(url_for("social_media_page", week=redirect_week, error="Vul alle velden van het contentidee in."))
        elif action == "toggle_idea_scheduled":
            idea_id = request.form.get("idea_id", type=int)
            is_scheduled = request.form.get("is_scheduled") == "1"
            if idea_id:
                set_social_media_idea_scheduled(idea_id, is_scheduled)
                return redirect(url_for("social_media_page", week=redirect_week, success="Contentidee bijgewerkt."))
        elif action == "delete_idea":
            idea_id = request.form.get("idea_id", type=int)
            if idea_id:
                delete_social_media_idea(idea_id)
                return redirect(url_for("social_media_page", week=redirect_week, success="Contentidee verwijderd."))
        elif action == "create_plan":
            title = request.form.get("title", "").strip()
            platform = request.form.get("platform", "").strip()
            publish_date = request.form.get("publish_date", "").strip()
            publish_time = request.form.get("publish_time", "").strip()
            status = request.form.get("status", "").strip() or "Gepland"
            notes = request.form.get("notes", "").strip()
            idea_id = request.form.get("idea_id", type=int)
            if title and platform and publish_date and publish_time:
                add_social_media_schedule_item(title, platform, publish_date, publish_time, status, notes)
                if idea_id:
                    set_social_media_idea_scheduled(idea_id, True)
                return redirect(url_for("social_media_page", week=redirect_week, success="Contentplanning opgeslagen."))
            return redirect(url_for("social_media_page", week=redirect_week, error="Vul alle velden van de planning in."))
        elif action == "update_plan":
            plan_id = request.form.get("plan_id", type=int)
            title = request.form.get("title", "").strip()
            platform = request.form.get("platform", "").strip()
            publish_date = request.form.get("publish_date", "").strip()
            publish_time = request.form.get("publish_time", "").strip()
            status = request.form.get("status", "").strip() or "Gepland"
            notes = request.form.get("notes", "").strip()
            if plan_id and title and platform and publish_date and publish_time:
                update_social_media_schedule_item(plan_id, title, platform, publish_date, publish_time, status, notes)
                return redirect(url_for("social_media_page", week=redirect_week, success="Afspraak bijgewerkt."))
            return redirect(url_for("social_media_page", week=redirect_week, error="Vul alle velden van de afspraak in."))
        elif action == "delete_plan":
            plan_id = request.form.get("plan_id", type=int)
            if plan_id:
                delete_social_media_schedule_item(plan_id)
                return redirect(url_for("social_media_page", week=redirect_week, success="Geplande post verwijderd."))

    week_offset = request.args.get("week", default=0, type=int)
    today = date.today()
    week_start = today - timedelta(days=today.weekday()) + timedelta(days=week_offset * 7)
    week_days = get_week_days(week_start)
    schedule_items = load_social_media_schedule()
    ideas = load_social_media_ideas()
    calendar_events = build_social_media_week_events(schedule_items, week_start)
    time_slots = [f"{hour:02d}" for hour in range(24)]
    return render_template(
        "social_media.html",
        active_page="social-media",
        ideas=ideas,
        schedule_items=schedule_items,
        week_offset=week_offset,
        week_days=week_days,
        week_label=build_week_label(week_start),
        calendar_events=calendar_events,
        time_slots=time_slots,
        error=request.args.get("error", "").strip(),
        success=request.args.get("success", "").strip(),
    )


@app.route("/content", methods=["GET", "POST"])
def content_page() -> str:
    access_redirect = require_page_access("content")
    if access_redirect is not None:
        return access_redirect

    user = get_current_user()
    if request.method == "POST":
        if not can_manage_content(user):
            return redirect(url_for("content_page", error="Je hebt geen rechten om content te beheren."))

        action = request.form.get("action", "").strip()
        if action == "create_album":
            existing_album_id = request.form.get("album_id", default=0, type=int)
            new_album_title = request.form.get("album_title", "").strip()
            album_id = resolve_content_album_id(existing_album_id, new_album_title)
            if album_id is None:
                error_message = "Kies een bestaand album of vul een nieuwe albumtitel in."
                if request_prefers_json():
                    return jsonify({"ok": False, "error": error_message}), 400
                return redirect(url_for("content_page", error=error_message))

            album_url = url_for("content_album_page", album_id=album_id)
            if request_prefers_json():
                return jsonify({"ok": True, "albumId": album_id, "albumUrl": album_url})
            return redirect(album_url)

        if action == "upload_album_photos":
            existing_album_id = request.form.get("album_id", default=0, type=int)
            new_album_title = request.form.get("album_title", "").strip()
            uploaded_files = collect_content_upload_files()
            album_id = resolve_content_album_id(existing_album_id, new_album_title)
            if album_id is None:
                return redirect(url_for("content_page", error="Kies een bestaand album of vul een nieuwe albumtitel in."))

            created_new_album = not existing_album_id and bool(new_album_title)
            try:
                uploaded_count = upload_files_to_content_album(album_id, uploaded_files)
            except ValueError as exc:
                if created_new_album:
                    delete_empty_content_album(album_id)
                return redirect(url_for("content_page", error=str(exc)))
            except requests.RequestException:
                if created_new_album:
                    delete_empty_content_album(album_id)
                return redirect(url_for("content_page", error="Upload mislukt. Probeer het opnieuw."))

            return redirect(
                url_for(
                    "content_album_page",
                    album_id=album_id,
                    success=f"{uploaded_count} foto{'s' if uploaded_count != 1 else ''} geupload.",
                )
            )
        if action == "delete_album":
            album_id = request.form.get("album_id", type=int)
            if not album_id:
                return redirect(url_for("content_page", error="Geen album geselecteerd om te verwijderen."))
            try:
                deleted = delete_content_album(album_id)
            except requests.RequestException:
                return redirect(url_for("content_page", error="Album verwijderen mislukt. Probeer het opnieuw."))
            if not deleted:
                return redirect(url_for("content_page", error="Het gekozen album kon niet worden gevonden."))
            return redirect(url_for("content_page", success="Fotoalbum verwijderd."))

    repaired_albums = ensure_content_album_records_exist()
    albums = load_content_album_summaries()
    return render_template(
        "content.html",
        active_page="content",
        albums=albums,
        content_storage=build_content_storage_status(),
        content_debug=(
            build_admin_content_debug_summary(repaired_albums=repaired_albums)
            if user and user.get("isAdmin")
            else None
        ),
        can_manage_content=can_manage_content(user),
        success=request.args.get("success", "").strip(),
        error=request.args.get("error", "").strip(),
    )


@app.route("/content/<int:album_id>", methods=["GET", "POST"])
def content_album_page(album_id: int) -> str:
    access_redirect = require_page_access("content")
    if access_redirect is not None:
        return access_redirect

    user = get_current_user()
    album = load_content_album(album_id)
    if album is None:
        return redirect(url_for("content_page", error="Dit fotoalbum bestaat niet."))

    if request.method == "POST":
        if not can_manage_content(user):
            return redirect(url_for("content_album_page", album_id=album_id, error="Je hebt geen rechten voor deze actie."))

        action = request.form.get("action", "").strip()
        if action == "upload_album_photos":
            uploaded_files = collect_content_upload_files()
            try:
                uploaded_count = upload_files_to_content_album(album_id, uploaded_files)
            except ValueError as exc:
                return redirect(url_for("content_album_page", album_id=album_id, error=str(exc)))
            except requests.RequestException:
                return redirect(url_for("content_album_page", album_id=album_id, error="Upload mislukt. Probeer het opnieuw."))
            return redirect(
                url_for(
                    "content_album_page",
                    album_id=album_id,
                    success=f"{uploaded_count} foto{'s' if uploaded_count != 1 else ''} geupload.",
                )
            )
        if action == "delete_photo":
            photo_id = request.form.get("photo_id", type=int)
            if not photo_id:
                return redirect(url_for("content_album_page", album_id=album_id, error="Geen foto geselecteerd om te verwijderen."))
            try:
                deleted = delete_content_photo(photo_id, album_id)
            except requests.RequestException:
                return redirect(url_for("content_album_page", album_id=album_id, error="Foto verwijderen mislukt. Probeer het opnieuw."))
            if not deleted:
                return redirect(url_for("content_album_page", album_id=album_id, error="De gekozen foto kon niet worden gevonden."))
            return redirect(url_for("content_album_page", album_id=album_id, success="Foto verwijderd."))
        if action == "delete_album":
            try:
                deleted = delete_content_album(album_id)
            except requests.RequestException:
                return redirect(url_for("content_album_page", album_id=album_id, error="Album verwijderen mislukt. Probeer het opnieuw."))
            if not deleted:
                return redirect(url_for("content_page", error="Het gekozen album kon niet worden gevonden."))
            return redirect(url_for("content_page", success="Fotoalbum verwijderd."))

    photos = load_content_album_photos(album_id)
    return render_template(
        "content_album.html",
        active_page="content",
        album=album,
        photos=photos,
        content_storage=build_content_storage_status(),
        can_manage_content=can_manage_content(user),
        success=request.args.get("success", "").strip(),
        error=request.args.get("error", "").strip(),
    )


@app.get("/api/orders")
def api_orders():
    access_redirect = require_page_access("orders")
    if access_redirect is not None:
        return access_redirect

    try:
        force_refresh = request.args.get("refresh") == "1"
        return jsonify(fetch_ecwid_orders(force_refresh=force_refresh))
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        return jsonify({"error": "Ecwid API request mislukt"}), status_code
    except requests.RequestException:
        return jsonify({"error": "Netwerkfout bij Ecwid"}), 502


@app.get("/api/dashboard-summary")
def api_dashboard_summary():
    access_redirect = require_page_access("dashboard")
    if access_redirect is not None:
        return access_redirect

    try:
        force_refresh = request.args.get("refresh") == "1"
        payload = fetch_orders(force_refresh=force_refresh)
        frontend_payload = build_dashboard_frontend_payload(payload)
        user = get_current_user()
        if user is not None and not user.get("isAdmin"):
            frontend_payload["summary"] = {}
            frontend_payload["reportSummary"] = {}
            frontend_payload["monthlyRevenueSeries"] = []
            frontend_payload["moneybird"] = {}
        return jsonify(frontend_payload)
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        return jsonify({"error": "Dashboardgegevens ophalen mislukt"}), status_code
    except requests.RequestException:
        return jsonify({"error": "Netwerkfout bij dashboardgegevens"}), 502


@app.get("/api/products/search")
def api_product_search():
    access_redirect = require_page_access("dashboard")
    if access_redirect is not None:
        return access_redirect

    query = request.args.get("q", "").strip()
    try:
        return jsonify({"items": search_catalog_products(query)})
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        return jsonify({"error": "Productzoekopdracht mislukt"}), status_code
    except requests.RequestException:
        return jsonify({"error": "Netwerkfout bij productzoekopdracht"}), 502


@app.get("/api/dashboard-events")
def api_dashboard_events():
    access_redirect = require_page_access("dashboard")
    if access_redirect is not None:
        return access_redirect

    return jsonify({"items": load_dashboard_events_config()})


@app.post("/api/dashboard-events")
def api_save_dashboard_events():
    access_redirect = require_page_access("dashboard")
    if access_redirect is not None:
        return access_redirect

    payload = request.get_json(silent=True) or {}
    items = payload.get("items", [])
    if not isinstance(items, list):
        return jsonify({"error": "Ongeldige payload"}), 400
    if len(items) > 50:
        return jsonify({"error": "Te veel items in één verzoek."}), 400

    sanitized_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label", "")).strip()[:120]
        if not label:
            continue
        product_id = item.get("productId")
        sanitized_items.append(
            {
                "productId": product_id,
                "label": label,
                "matchTerms": [
                    str(term).strip()[:120]
                    for term in item.get("matchTerms", [label])
                    if str(term).strip()
                ][:10] or [label],
            }
        )

    save_dashboard_events_config(sanitized_items)
    return jsonify({"ok": True, "items": sanitized_items})


@app.get("/api/dashboard-weather")
def api_dashboard_weather():
    access_redirect = require_page_access("dashboard")
    if access_redirect is not None:
        return access_redirect

    settings = load_dashboard_weather_settings()
    lat = request.args.get("lat", type=float)
    lon = request.args.get("lon", type=float)
    location_name = request.args.get("name", "").strip()

    if lat is None or lon is None:
        try:
            lat = float(settings.get("weather_lat", "52.25"))
            lon = float(settings.get("weather_lon", "6.16"))
        except ValueError:
            lat, lon = 52.25, 6.16

    if not location_name:
        location_name = settings.get("weather_name", "Deventer")

    try:
        weather_response = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current_weather": "true",
                "timezone": "auto",
            },
            timeout=8,
        )
        weather_response.raise_for_status()
        weather_payload = weather_response.json()
        current_weather = weather_payload.get("current_weather") or {}
        weather_code = int(current_weather.get("weathercode", -1))
        weather_meta = get_weather_description(weather_code)
        temperature = float(current_weather.get("temperature", 0))
        windspeed = float(current_weather.get("windspeed", 0))
        return jsonify(
            {
                "location": location_name,
                "temperature": round(temperature),
                "windspeed": round(windspeed, 1),
                "weatherCode": weather_code,
                "condition": weather_meta["label"],
                "icon": weather_meta["icon"],
                "isWarning": weather_code >= 61,
            }
        )
    except (requests.RequestException, TypeError, ValueError):
        return jsonify({"error": "Weergegevens ophalen mislukt"}), 502


@app.get("/api/agenda-school-holidays")
def api_agenda_school_holidays():
    access_redirect = require_page_access("agenda")
    if access_redirect is not None:
        return access_redirect

    raw_school_years = request.args.get("schoolYears", "").strip()
    school_years = []
    if raw_school_years:
        school_years = [normalize_agenda_label(value) for value in raw_school_years.split(",") if normalize_agenda_label(value)]
    if not school_years:
        current_year = date.today().year
        school_years = [f"{current_year}-{current_year + 1}"]

    region = normalize_agenda_region(request.args.get("region", "")) or "all"
    items: List[Dict[str, Any]] = []
    latest_cached_at = 0.0

    try:
        for school_year in school_years:
            payload = fetch_school_holidays_for_schoolyear(school_year, region)
            items.extend(payload.get("items", []))
            latest_cached_at = max(latest_cached_at, float(payload.get("cachedAt") or 0.0))
        return jsonify(
            {
                "items": items,
                "region": region,
                "cachedAt": latest_cached_at,
            }
        )
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        return jsonify({"error": "Schoolvakanties ophalen mislukt"}), status_code
    except requests.RequestException:
        return jsonify({"error": "Netwerkfout bij schoolvakanties"}), 502


@app.get("/api/agenda-public-holidays")
def api_agenda_public_holidays():
    access_redirect = require_page_access("agenda")
    if access_redirect is not None:
        return access_redirect

    raw_years = request.args.get("years", "").strip()
    years: List[int] = []
    if raw_years:
        for value in raw_years.split(","):
            normalized_value = normalize_agenda_label(value)
            if not normalized_value:
                continue
            try:
                years.append(int(normalized_value))
            except ValueError:
                continue
    if not years:
        current_year = date.today().year
        years = [current_year, current_year + 1]

    items: List[Dict[str, Any]] = []
    latest_cached_at = 0.0

    try:
        for year in years:
            payload = fetch_public_holidays_for_year(year)
            items.extend(payload.get("items", []))
            latest_cached_at = max(latest_cached_at, float(payload.get("cachedAt") or 0.0))
        return jsonify(
            {
                "items": items,
                "cachedAt": latest_cached_at,
            }
        )
    except requests.HTTPError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        return jsonify({"error": "Feestdagen ophalen mislukt"}), status_code
    except requests.RequestException:
        return jsonify({"error": "Netwerkfout bij feestdagen"}), 502


@app.after_request
def set_response_headers(response):
    if request.method == "GET" and response.status_code == 200:
        response.add_etag()
        response.make_conditional(request)

    if request.path.startswith("/static/"):
        response.cache_control.public = True
        response.cache_control.max_age = 31536000
        response.cache_control.immutable = True
    elif request.path.startswith("/api/dashboard-weather"):
        response.cache_control.private = True
        response.cache_control.max_age = 300
        response.cache_control.must_revalidate = True
    elif request.path.startswith("/api/"):
        response.cache_control.private = True
        response.cache_control.max_age = 60
        response.cache_control.must_revalidate = True
    else:
        response.cache_control.private = True
        response.cache_control.no_cache = True
        response.cache_control.must_revalidate = True
    response.headers["Vary"] = "Cookie, Accept-Encoding"
    return apply_security_headers(response)


@app.errorhandler(413)
def handle_request_entity_too_large(_exc):
    message = "Upload te groot. Verklein het bestand of upload minder bestanden tegelijk."
    if request.path.startswith("/api/") or request_prefers_json():
        return jsonify({"error": message}), 413
    return redirect(url_for("content_page", error=message))


@app.errorhandler(Exception)
def handle_unexpected_exception(exc):
    if isinstance(exc, HTTPException):
        return exc
    app.logger.exception("Onverwachte fout tijdens request", exc_info=exc)
    if request.path.startswith("/api/"):
        return jsonify({"error": "Interne serverfout"}), 500
    return "Er is een interne fout opgetreden.", 500


if __name__ == "__main__":
    debug_mode = get_env("FLASK_DEBUG") != "0"
    port = int(get_env("PORT") or "5001")
    app.run(debug=debug_mode, use_reloader=debug_mode, port=port)
