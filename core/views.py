from __future__ import annotations

from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.views.decorators.csrf import csrf_exempt

import app as legacy

from .legacy_compat import convert_response, request_context


SAFE_LOCAL_UPLOAD_CONTENT_TYPES = {
    ".avif": "image/avif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".mp4": "video/mp4",
    ".png": "image/png",
    ".webm": "video/webm",
    ".webp": "image/webp",
}


def local_upload(request, upload_path: str):
    """Serve Bunny fallback uploads without exposing files outside their root."""
    try:
        upload_root = Path(settings.LOCAL_UPLOAD_ROOT).resolve(strict=True)
        requested_file = (upload_root / upload_path).resolve(strict=True)
        requested_file.relative_to(upload_root)
    except (FileNotFoundError, OSError, RuntimeError, ValueError):
        raise Http404("Upload niet gevonden.")

    if not requested_file.is_file():
        raise Http404("Upload niet gevonden.")

    content_type = SAFE_LOCAL_UPLOAD_CONTENT_TYPES.get(requested_file.suffix.lower())
    if not content_type:
        raise Http404("Uploadtype niet toegestaan.")

    response = FileResponse(requested_file.open("rb"), content_type=content_type)
    response["Cache-Control"] = "public, max-age=3600"
    response["X-Content-Type-Options"] = "nosniff"
    return response


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
management_page = legacy_view("management_page")
customer_satisfaction_page = legacy_view("customer_satisfaction_page")
customer_satisfaction_product_page = legacy_view("customer_satisfaction_product_page")
customer_satisfaction_form_page = legacy_view("customer_satisfaction_form_page")
planning_page = legacy_view("planning_page")
planning_edit_page = legacy_view("planning_edit_page")
api_management_page = legacy_view("api_management_page")
materialen_page = legacy_view("materialen_page")
materialen_club_export_pdf = legacy_view("materialen_club_export_pdf")
materialen_all_clubs_export_pdf = legacy_view("materialen_all_clubs_export_pdf")
budget_page = legacy_view("budget_page")
leads_page = legacy_view("leads_page")
revenue_home_page = legacy_view("revenue_home_page")
revenue_total_page = legacy_view("revenue_total_page")
revenue_monthly_page = legacy_view("revenue_monthly_page")
revenue_profit_page = legacy_view("revenue_profit_page")
revenue_season_page = legacy_view("revenue_season_page")
financien_page = legacy_view("financien_page")
automatic_invoices_page = legacy_view("automatic_invoices_page")
spaarpot_page = legacy_view("spaarpot_page")
trainer_fees_home_page = legacy_view("trainer_fees_home_page")
personal_profile_page = legacy_view("personal_profile_page")
trainers_page = legacy_view("trainers_page")
agenda_page = legacy_view("agenda_page")
draaiboeken_page = legacy_view("draaiboeken_page")
checklists_page = legacy_view("checklists_page")
checklist_detail_page = legacy_view("checklist_detail_page")
checklist_planning_detail_page = legacy_view("checklist_planning_detail_page")
checklists_export_pdf = legacy_view("checklists_export_pdf")
dressing_room_signs_page = legacy_view("dressing_room_signs_page")
dressing_room_sign_detail_page = legacy_view("dressing_room_sign_detail_page")
dressing_room_signs_export_pdf = legacy_view("dressing_room_signs_export_pdf")
football_days_home_page = legacy_view("football_days_home_page")
football_days_page = legacy_view("football_days_page")
football_days_new_page = legacy_view("football_days_new_page")
football_days_edit_page = legacy_view("football_days_edit_page")
trainers_information_page = legacy_view("trainers_information_page")
trainers_information_export_pdf = legacy_view("trainers_information_export_pdf")
trainers_information_detail_page = legacy_view("trainers_information_detail_page")
trainers_information_document_export_pdf = legacy_view("trainers_information_document_export_pdf")
amateur_clubs_home_page = legacy_view("amateur_clubs_home_page")
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
voorstellen_maker_page = legacy_view("voorstellen_maker_page")
voorstellen_maker_detail_page = legacy_view("voorstellen_maker_detail_page")
api_voorstellen_maker_training_counts = legacy_view("voorstellen_maker_training_counts_api")
overeenkomsten_page = legacy_view("overeenkomsten_page")
overeenkomsten_new_page = legacy_view("overeenkomsten_new_page")
overeenkomsten_edit_page = legacy_view("overeenkomsten_edit_page")
overeenkomsten_file = legacy_view("overeenkomsten_file")
overeenkomsten_signed_file = legacy_view("overeenkomsten_signed_file")
overeenkomsten_export_pdf = legacy_view("overeenkomsten_export_pdf")
overeenkomsten_export_docx = legacy_view("overeenkomsten_export_docx")
contract_public_share_page = legacy_view("contract_public_share_page")
contract_public_pdf = legacy_view("contract_public_pdf")
marketing_page = legacy_view("marketing_page")
social_media_page = legacy_view("social_media_page")
content_page = legacy_view("content_page")
content_album_page = legacy_view("content_album_page")
api_orders = legacy_view("api_orders")
api_agenda_events = legacy_view("api_agenda_events")
api_agenda_calendar = legacy_view("api_agenda_calendar")
api_dashboard_summary = legacy_view("api_dashboard_summary")
api_product_search = legacy_view("api_product_search")
api_product_registration_count = legacy_view("api_product_registration_count")
api_football_days_registration_counts = legacy_view("api_football_days_registration_counts")
api_football_days_export_pdf = legacy_view("api_football_days_export_pdf")
api_football_days_export_pptx = legacy_view("api_football_days_export_pptx")
api_amateur_clubs_registration_counts = legacy_view("api_amateur_clubs_registration_counts")
api_amateur_clubs_export_pdf = legacy_view("api_amateur_clubs_export_pdf")
api_amateur_clubs_export_pptx = legacy_view("api_amateur_clubs_export_pptx")
api_planning_export_pdf = legacy_view("api_planning_export_pdf")
api_planning_export_png = legacy_view("api_planning_export_png")
api_dashboard_weather = legacy_view("api_dashboard_weather")
api_agenda_school_holidays = legacy_view("api_agenda_school_holidays")
api_agenda_public_holidays = legacy_view("api_agenda_public_holidays")
api_update_registration_email_status = legacy_view("api_update_registration_email_status")
api_save_registration_event_email_settings = legacy_view("api_save_registration_event_email_settings")
api_send_registration_event_email = legacy_view("api_send_registration_event_email")
api_sync_emailed_registration_orders = legacy_view("api_sync_emailed_registration_orders")
api_complete_registration_event = legacy_view("api_complete_registration_event")
api_cancel_registration_event = legacy_view("api_cancel_registration_event")
api_send_customer_satisfaction_test_email = legacy_view("api_send_customer_satisfaction_test_email")
api_save_leads_blocked_emails = legacy_view("api_save_leads_blocked_emails")
api_push_status = legacy_view("api_push_status")
api_push_subscribe = legacy_view("api_push_subscribe")
api_push_unsubscribe = legacy_view("api_push_unsubscribe")


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
