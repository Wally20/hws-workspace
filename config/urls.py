from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from core import views


urlpatterns = [
    path("login", views.login_page, name="login_page"),
    path("uitnodiging/<str:invite_token>", views.invite_accept_page, name="invite_accept_page"),
    path("logout", views.logout_page, name="logout_page"),
    path("", views.index, name="index"),
    path("aanmeldingen", views.registrations_page, name="registrations_page"),
    path("aanmeldingen/<path:product_key>", views.registrations_detail_page, name="registrations_detail_page"),
    path("leads", views.leads_page, name="leads_page"),
    path("omzet", views.revenue_home_page, name="revenue_home_page"),
    path("omzet/totaal", views.revenue_total_page, name="revenue_total_page"),
    path("omzet/per-maand", views.revenue_monthly_page, name="revenue_monthly_page"),
    path("omzet/winst", views.revenue_profit_page, name="revenue_profit_page"),
    path("omzet/per-seizoen", views.revenue_season_page, name="revenue_season_page"),
    path("trainersvergoedingen", views.trainer_fees_home_page, name="trainer_fees_home_page"),
    path("trainersvergoedingen/per-training", views.trainer_fees_per_training_page, name="trainer_fees_per_training_page"),
    path("trainersvergoedingen/per-maand", views.trainer_fees_per_month_page, name="trainer_fees_per_month_page"),
    path("profiel", views.personal_profile_page, name="personal_profile_page"),
    path("trainers", views.trainers_page, name="trainers_page"),
    path("agenda", views.agenda_page, name="agenda_page"),
    path("voetbaldagen", views.football_days_page, name="football_days_page"),
    path("voetbaldagen/nieuw", views.football_days_new_page, name="football_days_new_page"),
    path("voetbaldagen/<int:playbook_id>", views.football_days_edit_page, name="football_days_edit_page"),
    path("oefeningen-bibliotheek", views.oefeningen_bibliotheek_page, name="oefeningen_bibliotheek_page"),
    path(
        "api/oefeningen-bibliotheek/category",
        views.api_update_exercise_category,
        name="api_update_exercise_category",
    ),
    path(
        "api/oefeningen-bibliotheek/update",
        views.api_update_exercise,
        name="api_update_exercise",
    ),
    path(
        "api/oefeningen-bibliotheek/delete",
        views.api_delete_exercise,
        name="api_delete_exercise",
    ),
    path("taken", views.tasks_page, name="tasks_page"),
    path("voorstellen-maker", views.voorstellen_maker_page, name="voorstellen_maker_page"),
    path("voorstellen-maker/<int:proposal_id>", views.voorstellen_maker_detail_page, name="voorstellen_maker_detail_page"),
    path(
        "api/voorstellen-maker/training-counts",
        views.api_voorstellen_maker_training_counts,
        name="api_voorstellen_maker_training_counts",
    ),
    path("social-media", views.social_media_page, name="social_media_page"),
    path("content", views.content_page, name="content_page"),
    path("content/<int:album_id>", views.content_album_page, name="content_album_page"),
    path("api/orders", views.api_orders, name="api_orders"),
    path("api/dashboard-summary", views.api_dashboard_summary, name="api_dashboard_summary"),
    path("api/products/search", views.api_product_search, name="api_product_search"),
    path("api/products/registration-count", views.api_product_registration_count, name="api_product_registration_count"),
    path("api/dashboard-events", views.api_dashboard_events, name="api_dashboard_events"),
    path(
        "api/registrations/email-status",
        views.api_update_registration_email_status,
        name="api_update_registration_email_status",
    ),
    path(
        "api/registrations/sync-emailed-orders",
        views.api_sync_emailed_registration_orders,
        name="api_sync_emailed_registration_orders",
    ),
    path(
        "api/leads/blocked-emails",
        views.api_save_leads_blocked_emails,
        name="api_save_leads_blocked_emails",
    ),
    path("api/dashboard-weather", views.api_dashboard_weather, name="api_dashboard_weather"),
    path("api/agenda-school-holidays", views.api_agenda_school_holidays, name="api_agenda_school_holidays"),
    path("api/agenda-public-holidays", views.api_agenda_public_holidays, name="api_agenda_public_holidays"),
    path("manifest.webmanifest", views.web_manifest, name="web_manifest"),
    path("service-worker.js", views.service_worker, name="service_worker"),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR / "static")
