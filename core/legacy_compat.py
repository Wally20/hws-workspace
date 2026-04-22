from __future__ import annotations

import json
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Callable
from urllib.parse import urlencode

from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import redirect as django_redirect
from django.template import engines
from django.urls import reverse

import app as legacy


current_request: ContextVar[Any] = ContextVar("legacy_current_request", default=None)


ENDPOINTS = {
    "login_page": "login_page",
    "invite_accept_page": "invite_accept_page",
    "logout_page": "logout_page",
    "index": "index",
    "registrations_page": "registrations_page",
    "registrations_detail_page": "registrations_detail_page",
    "leads_page": "leads_page",
    "revenue_home_page": "revenue_home_page",
    "revenue_total_page": "revenue_total_page",
    "revenue_monthly_page": "revenue_monthly_page",
    "revenue_profit_page": "revenue_profit_page",
    "revenue_season_page": "revenue_season_page",
    "trainer_fees_home_page": "trainer_fees_home_page",
    "trainer_fees_per_training_page": "trainer_fees_per_training_page",
    "trainer_fees_per_month_page": "trainer_fees_per_month_page",
    "personal_profile_page": "personal_profile_page",
    "trainers_page": "trainers_page",
    "agenda_page": "agenda_page",
    "tasks_page": "tasks_page",
    "voorstellen_maker_page": "voorstellen_maker_page",
    "voorstellen_maker_detail_page": "voorstellen_maker_detail_page",
    "social_media_page": "social_media_page",
    "content_page": "content_page",
    "content_album_page": "content_album_page",
    "api_orders": "api_orders",
    "api_dashboard_summary": "api_dashboard_summary",
    "api_product_search": "api_product_search",
    "api_dashboard_events": "api_dashboard_events",
    "api_save_dashboard_events": "api_dashboard_events",
    "api_dashboard_weather": "api_dashboard_weather",
}

PATH_KWARGS = {
    "invite_accept_page": {"invite_token"},
    "registrations_detail_page": {"product_key"},
    "voorstellen_maker_detail_page": {"proposal_id"},
    "content_album_page": {"album_id"},
}


def get_current_request():
    request = current_request.get()
    if request is None:
        raise RuntimeError("No active Django request bound to legacy compatibility layer.")
    return request


class LegacyParamSource:
    def __init__(self, query_dict):
        self.query_dict = query_dict

    def get(self, key: str, default: Any = None, type: Callable[[Any], Any] | None = None):
        value = self.query_dict.get(key, default)
        if value is None:
            return default
        if type is None:
            return value
        try:
            return type(value)
        except (TypeError, ValueError):
            return default

    def getlist(self, key: str):
        return self.query_dict.getlist(key)


class LegacyFilesSource:
    def __init__(self, files):
        self.files = files

    def getlist(self, key: str):
        return [LegacyUploadedFile(uploaded_file) for uploaded_file in self.files.getlist(key)]


class LegacyUploadedFile:
    def __init__(self, uploaded_file):
        self.uploaded_file = uploaded_file
        self.filename = getattr(uploaded_file, "name", "")
        self.mimetype = getattr(uploaded_file, "content_type", "")

    def read(self, *args, **kwargs):
        return self.uploaded_file.read(*args, **kwargs)


class LegacyRequestProxy:
    @property
    def method(self) -> str:
        return get_current_request().method

    @property
    def path(self) -> str:
        return get_current_request().path

    @property
    def url(self) -> str:
        return get_current_request().build_absolute_uri()

    @property
    def remote_addr(self) -> str:
        return str(get_current_request().META.get("REMOTE_ADDR", "") or "")

    @property
    def is_secure(self) -> bool:
        return bool(get_current_request().is_secure())

    @property
    def META(self):
        return get_current_request().META

    @property
    def environ(self):
        return get_current_request().META

    @property
    def args(self) -> LegacyParamSource:
        return LegacyParamSource(get_current_request().GET)

    @property
    def form(self) -> LegacyParamSource:
        return LegacyParamSource(get_current_request().POST)

    @property
    def files(self) -> LegacyFilesSource:
        return LegacyFilesSource(get_current_request().FILES)

    @property
    def headers(self):
        return get_current_request().headers

    def get_json(self, silent: bool = False):
        request = get_current_request()
        if not request.body:
            return None
        try:
            return json.loads(request.body.decode(request.encoding or "utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            if silent:
                return None
            raise


class LegacySessionProxy:
    permanent = False

    def __getitem__(self, key: str):
        return get_current_request().session[key]

    def __setitem__(self, key: str, value: Any) -> None:
        get_current_request().session[key] = value

    def __contains__(self, key: str) -> bool:
        return key in get_current_request().session

    def get(self, key: str, default: Any = None):
        return get_current_request().session.get(key, default)

    def pop(self, key: str, default: Any = None):
        return get_current_request().session.pop(key, default)

    def clear(self) -> None:
        get_current_request().session.clear()


def legacy_render_template(template_name: str, **context: Any) -> HttpResponse:
    request = get_current_request()
    user = legacy.get_current_user()
    template = engines["jinja2"].get_template(template_name)
    merged_context = {
        "asset_version": legacy.get_asset_version(),
        "legacy_csrf_token": legacy.ensure_csrf_token(),
        "csp_nonce": getattr(request, "csp_nonce", ""),
        "current_user": user,
        "visible_pages": legacy.get_visible_pages_for_user(user),
        "can_view_revenue": bool(user and user.get("isAdmin")),
        "is_social_media_manager": legacy.is_social_media_manager(user),
        **context,
    }
    return HttpResponse(template.render(merged_context, request=request))


def legacy_jsonify(*args: Any, **kwargs: Any) -> JsonResponse:
    if args and kwargs:
        raise TypeError("jsonify supports args or kwargs, not both")
    if len(args) > 1:
        payload: Any = list(args)
    elif len(args) == 1:
        payload = args[0]
    else:
        payload = kwargs
    safe = isinstance(payload, dict)
    return JsonResponse(payload, safe=safe)


def legacy_redirect(location: str):
    if location.startswith("/"):
        return HttpResponseRedirect(location)
    return django_redirect(location)


def legacy_url_for(endpoint: str, **kwargs: Any) -> str:
    external = bool(kwargs.pop("_external", False))
    view_name = ENDPOINTS[endpoint]
    cleaned_kwargs = {key: value for key, value in kwargs.items() if value is not None}
    path_kwargs = {key: cleaned_kwargs[key] for key in PATH_KWARGS.get(endpoint, set()) if key in cleaned_kwargs}
    query_items = {key: value for key, value in cleaned_kwargs.items() if key not in PATH_KWARGS.get(endpoint, set())}
    path = reverse(view_name, kwargs=path_kwargs or None)

    if query_items:
        path = f"{path}?{urlencode(query_items, doseq=True)}"
    if external:
        return get_current_request().build_absolute_uri(path)
    return path


def convert_response(response: Any):
    if isinstance(response, tuple):
        headers = None
        if len(response) == 3:
            base, status, headers = response
        else:
            base, status = response
        if isinstance(base, HttpResponse):
            base.status_code = status
            if headers:
                for header_name, header_value in headers.items():
                    base[header_name] = header_value
            return base
        if isinstance(base, (dict, list)):
            converted = JsonResponse(base, safe=isinstance(base, dict), status=status)
        else:
            converted = HttpResponse(base, status=status)
        if headers:
            for header_name, header_value in headers.items():
                converted[header_name] = header_value
        return converted
    if isinstance(response, HttpResponse):
        return response
    if isinstance(response, (dict, list)):
        return JsonResponse(response, safe=isinstance(response, dict))
    return HttpResponse(response)


def bind_legacy_globals() -> None:
    legacy.request = LegacyRequestProxy()
    legacy.session = LegacySessionProxy()
    legacy.render_template = legacy_render_template
    legacy.jsonify = legacy_jsonify
    legacy.redirect = legacy_redirect
    legacy.url_for = legacy_url_for


bind_legacy_globals()


@contextmanager
def request_context(request):
    token = current_request.set(request)
    try:
        yield
    finally:
        current_request.reset(token)
