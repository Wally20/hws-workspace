from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.http import FileResponse
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
registrations_page = legacy_view("registrations_page")
registrations_detail_page = legacy_view("registrations_detail_page")
export_registration_team_assignment = legacy_view("export_registration_team_assignment")
leads_page = legacy_view("leads_page")
revenue_home_page = legacy_view("revenue_home_page")
revenue_total_page = legacy_view("revenue_total_page")
revenue_monthly_page = legacy_view("revenue_monthly_page")
revenue_profit_page = legacy_view("revenue_profit_page")
revenue_season_page = legacy_view("revenue_season_page")
spaarpot_page = legacy_view("spaarpot_page")
trainer_fees_home_page = legacy_view("trainer_fees_home_page")
trainer_fees_per_training_page = legacy_view("trainer_fees_per_training_page")
trainer_fees_per_month_page = legacy_view("trainer_fees_per_month_page")
personal_profile_page = legacy_view("personal_profile_page")
trainers_page = legacy_view("trainers_page")
agenda_page = legacy_view("agenda_page")
draaiboeken_page = legacy_view("draaiboeken_page")
football_days_page = legacy_view("football_days_page")
football_days_new_page = legacy_view("football_days_new_page")
football_days_edit_page = legacy_view("football_days_edit_page")
amateur_clubs_page = legacy_view("amateur_clubs_page")
amateur_clubs_new_page = legacy_view("amateur_clubs_new_page")
amateur_clubs_duplicate_page = legacy_view("amateur_clubs_duplicate_page")
amateur_clubs_edit_page = legacy_view("amateur_clubs_edit_page")
oefenstof_page = legacy_view("oefenstof_page")
oefeningen_bibliotheek_page = legacy_view("oefeningen_bibliotheek_page")
exercise_videos_page = legacy_view("exercise_videos_page")
trainingen_page = legacy_view("trainingen_page")
trainingen_saved_page = legacy_view("trainingen_saved_page")
trainingen_maker_page = legacy_view("trainingen_maker_page")
api_save_training = legacy_view("api_save_training")
api_update_exercise_category = legacy_view("api_update_exercise_category")
api_update_exercise = legacy_view("api_update_exercise")
api_update_exercise_field_image = legacy_view("api_update_exercise_field_image")
api_update_exercise_field_overlay = legacy_view("api_update_exercise_field_overlay")
api_update_exercise_video = legacy_view("api_update_exercise_video")
api_delete_exercise_video = legacy_view("api_delete_exercise_video")
api_delete_exercise = legacy_view("api_delete_exercise")
tasks_page = legacy_view("tasks_page")
voorstellen_maker_page = legacy_view("voorstellen_maker_page")
voorstellen_maker_detail_page = legacy_view("voorstellen_maker_detail_page")
api_voorstellen_maker_training_counts = legacy_view("voorstellen_maker_training_counts_api")
overeenkomsten_page = legacy_view("overeenkomsten_page")
overeenkomsten_new_page = legacy_view("overeenkomsten_new_page")
overeenkomsten_edit_page = legacy_view("overeenkomsten_edit_page")
overeenkomsten_export_pdf = legacy_view("overeenkomsten_export_pdf")
overeenkomsten_export_docx = legacy_view("overeenkomsten_export_docx")
social_media_page = legacy_view("social_media_page")
content_page = legacy_view("content_page")
content_album_page = legacy_view("content_album_page")
api_orders = legacy_view("api_orders")
api_dashboard_summary = legacy_view("api_dashboard_summary")
api_product_search = legacy_view("api_product_search")
api_product_registration_count = legacy_view("api_product_registration_count")
api_football_days_registration_counts = legacy_view("api_football_days_registration_counts")
api_football_days_export_pdf = legacy_view("api_football_days_export_pdf")
api_amateur_clubs_registration_counts = legacy_view("api_amateur_clubs_registration_counts")
api_amateur_clubs_export_pdf = legacy_view("api_amateur_clubs_export_pdf")
api_dashboard_weather = legacy_view("api_dashboard_weather")
api_agenda_school_holidays = legacy_view("api_agenda_school_holidays")
api_agenda_public_holidays = legacy_view("api_agenda_public_holidays")
api_update_registration_email_status = legacy_view("api_update_registration_email_status")
api_sync_emailed_registration_orders = legacy_view("api_sync_emailed_registration_orders")
api_save_leads_blocked_emails = legacy_view("api_save_leads_blocked_emails")


def service_worker(request, *args, **kwargs):
    response = FileResponse(
        open(Path(settings.BASE_DIR) / "static" / "service-worker.js", "rb"),
        content_type="text/javascript; charset=utf-8",
    )
    response["Service-Worker-Allowed"] = "/"
    response["Cache-Control"] = "public, max-age=60"
    return response


def web_manifest(request, *args, **kwargs):
    response = FileResponse(
        open(Path(settings.BASE_DIR) / "static" / "manifest.webmanifest", "rb"),
        content_type="application/manifest+json",
    )
    response["Cache-Control"] = "public, max-age=3600"
    return response


@csrf_exempt
def api_dashboard_events(request, *args, **kwargs):
    with request_context(request):
        if request.method == "POST":
            response = legacy.api_save_dashboard_events(*args, **kwargs)
        else:
            response = legacy.api_dashboard_events(*args, **kwargs)
        return convert_response(response)
