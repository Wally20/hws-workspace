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

        if request.path.startswith("/static/"):
            response["Cache-Control"] = "public, max-age=31536000, immutable"
        elif request.path.startswith("/api/dashboard-weather"):
            response["Cache-Control"] = "private, max-age=300, must-revalidate"
        elif request.path.startswith("/api/"):
            response["Cache-Control"] = "private, max-age=60, must-revalidate"
        else:
            response["Cache-Control"] = "private, no-cache, must-revalidate"

        vary = response.get("Vary")
        response["Vary"] = "Cookie, Accept-Encoding" if not vary else f"{vary}, Cookie, Accept-Encoding"
        response.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; "
            "img-src 'self' data: https:; "
            f"script-src 'self' 'nonce-{request.csp_nonce}'; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self' data:; connect-src 'self'; upgrade-insecure-requests",
        )
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("X-Frame-Options", "DENY")
        response.setdefault("Permissions-Policy", "camera=(), geolocation=(), microphone=()")
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if request.is_secure():
            response.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response
