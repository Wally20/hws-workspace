from __future__ import annotations

import secrets

from django.http import HttpResponse

import app as legacy

from .legacy_compat import convert_response, request_context


class LegacyRequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        with request_context(request):
            return self.get_response(request)


class LegacyLoginRequiredMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        with request_context(request):
            access_response = legacy.require_login()
            if access_response is not None:
                return convert_response(access_response)
            return self.get_response(request)


class LegacyResponseHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not getattr(request, "csp_nonce", ""):
            request.csp_nonce = secrets.token_urlsafe(16)
        response = self.get_response(request)
        is_public_invite = request.path.startswith("/uitnodiging/")
        is_public_contract = request.path.startswith("/gedeelde-overeenkomst/")

        if is_public_invite or is_public_contract:
            response["Cache-Control"] = "no-store, max-age=0"
            response["Pragma"] = "no-cache"
            response["Expires"] = "0"
        elif response.has_header("Cache-Control"):
            pass
        elif request.path == "/service-worker.js":
            response["Cache-Control"] = "public, max-age=60"
        elif request.path == "/manifest.webmanifest":
            response["Cache-Control"] = "public, max-age=3600"
        elif request.path.startswith("/static/"):
            response["Cache-Control"] = "public, max-age=31536000, immutable"
        elif request.path.startswith("/api/dashboard-weather"):
            response["Cache-Control"] = "private, max-age=300, must-revalidate"
        elif request.path.startswith("/api/v1/agenda/"):
            response["Cache-Control"] = "no-store"
        elif request.path.startswith("/api/"):
            response["Cache-Control"] = "private, max-age=60, must-revalidate"
        else:
            response["Cache-Control"] = "private, no-cache, must-revalidate"

        vary = response.get("Vary")
        response["Vary"] = "Cookie, Accept-Encoding" if not vary else f"{vary}, Cookie, Accept-Encoding"
        csp = (
            "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; "
            "img-src 'self' data: https:; "
            f"script-src 'self' 'nonce-{request.csp_nonce}'; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:; "
            "worker-src 'self'; manifest-src 'self'; "
            "connect-src 'self' https://opendata.rijksoverheid.nl https://date.nager.at"
        )
        if request.is_secure():
            csp = f"{csp}; upgrade-insecure-requests"
        response.setdefault("Content-Security-Policy", csp)
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("X-Frame-Options", "DENY")
        response.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if is_public_invite or is_public_contract:
            response["X-Robots-Tag"] = "noindex, nofollow, noarchive, nosnippet"
            response["Referrer-Policy"] = "no-referrer"
        if request.is_secure():
            response.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
