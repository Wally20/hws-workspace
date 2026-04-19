from django.conf import settings
from django.conf.urls.static import static
from django.urls import path

from core import views


urlpatterns = [
    path("login", views.login_page, name="login_page"),
    path("uitnodiging/<str:invite_token>", views.invite_accept_page, name="invite_accept_page"),
    path("logout", views.logout_page, name="logout_page"),
    path("", views.index, name="index"),
    path("bestellingen", views.orders_page, name="orders_page"),
    path("bestellingen/teamindeling-export", views.export_orders_team_assignment, name="export_orders_team_assignment"),
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
    path("taken", views.tasks_page, name="tasks_page"),
    path("voorstellen-maker", views.voorstellen_maker_page, name="voorstellen_maker_page"),
    path("social-media", views.social_media_page, name="social_media_page"),
    path("content", views.content_page, name="content_page"),
    path("content/<int:album_id>", views.content_album_page, name="content_album_page"),
    path("api/orders", views.api_orders, name="api_orders"),
    path("api/dashboard-summary", views.api_dashboard_summary, name="api_dashboard_summary"),
    path("api/products/search", views.api_product_search, name="api_product_search"),
    path("api/dashboard-events", views.api_dashboard_events, name="api_dashboard_events"),
    path("api/dashboard-weather", views.api_dashboard_weather, name="api_dashboard_weather"),
    path("api/agenda-school-holidays", views.api_agenda_school_holidays, name="api_agenda_school_holidays"),
    path("api/agenda-public-holidays", views.api_agenda_public_holidays, name="api_agenda_public_holidays"),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.BASE_DIR / "static")
