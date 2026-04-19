from __future__ import annotations

from django.views.decorators.csrf import csrf_exempt

import app as legacy

from .legacy_compat import convert_response, request_context


def legacy_view(function_name: str):
    legacy_function = getattr(legacy, function_name)

    @csrf_exempt
    def view(request, *args, **kwargs):
        with request_context(request):
            response = legacy_function(*args, **kwargs)
            return convert_response(response)

    view.__name__ = function_name
    return view


login_page = legacy_view("login_page")
invite_accept_page = legacy_view("invite_accept_page")
logout_page = legacy_view("logout_page")
index = legacy_view("index")
orders_page = legacy_view("orders_page")
export_orders_team_assignment = legacy_view("export_orders_team_assignment")
revenue_home_page = legacy_view("revenue_home_page")
revenue_total_page = legacy_view("revenue_total_page")
revenue_monthly_page = legacy_view("revenue_monthly_page")
revenue_profit_page = legacy_view("revenue_profit_page")
revenue_season_page = legacy_view("revenue_season_page")
trainer_fees_home_page = legacy_view("trainer_fees_home_page")
trainer_fees_per_training_page = legacy_view("trainer_fees_per_training_page")
trainer_fees_per_month_page = legacy_view("trainer_fees_per_month_page")
personal_profile_page = legacy_view("personal_profile_page")
trainers_page = legacy_view("trainers_page")
agenda_page = legacy_view("agenda_page")
tasks_page = legacy_view("tasks_page")
social_media_page = legacy_view("social_media_page")
content_page = legacy_view("content_page")
content_album_page = legacy_view("content_album_page")
api_orders = legacy_view("api_orders")
api_dashboard_summary = legacy_view("api_dashboard_summary")
api_product_search = legacy_view("api_product_search")
api_dashboard_weather = legacy_view("api_dashboard_weather")
api_agenda_school_holidays = legacy_view("api_agenda_school_holidays")


@csrf_exempt
def api_dashboard_events(request, *args, **kwargs):
    with request_context(request):
        if request.method == "POST":
            response = legacy.api_save_dashboard_events(*args, **kwargs)
        else:
            response = legacy.api_dashboard_events(*args, **kwargs)
        return convert_response(response)
