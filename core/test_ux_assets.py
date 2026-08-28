from pathlib import Path

from django.test import Client, SimpleTestCase


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class UxAssetRegressionTests(SimpleTestCase):
    def read_project_file(self, relative_path):
        return (PROJECT_ROOT / relative_path).read_text(encoding="utf-8")

    def test_global_workspace_search_is_started_and_accessible(self):
        source = self.read_project_file("static/base.js")

        self.assertIn("initWorkspacePageSearch();", source)
        self.assertIn('role="combobox"', source)
        self.assertIn("aria-activedescendant", source)
        self.assertIn("focusBeforeSearch", source)

    def test_service_worker_activation_never_navigates_open_tabs(self):
        source = self.read_project_file("static/service-worker.js")
        activate_handler = source.split('self.addEventListener("activate"', 1)[1].split(
            'self.addEventListener("push"', 1
        )[0]

        self.assertIn("self.clients.claim()", activate_handler)
        self.assertNotIn("navigate(", activate_handler)
        self.assertNotIn("matchAll(", activate_handler)

    def test_notification_click_only_opens_same_origin_targets(self):
        source = self.read_project_file("static/service-worker.js")
        notification_handler = source.split(
            'self.addEventListener("notificationclick"', 1
        )[1]

        self.assertIn("targetUrl.origin === self.location.origin", source)
        self.assertIn("getSafeNotificationUrl(event.notification.data?.url)", notification_handler)
        self.assertNotIn(
            'new URL(event.notification.data?.url || "/", self.location.origin).href',
            notification_handler,
        )

    def test_pwa_assets_are_available_with_expected_types(self):
        service_worker = Client().get("/service-worker.js", secure=True)
        manifest = Client().get("/manifest.webmanifest", secure=True)

        self.assertEqual(service_worker.status_code, 200)
        self.assertTrue(service_worker["Content-Type"].startswith("text/javascript"))
        self.assertEqual(service_worker["Service-Worker-Allowed"], "/")
        self.assertEqual(manifest.status_code, 200)
        self.assertTrue(manifest["Content-Type"].startswith("application/manifest+json"))

    def test_dashboard_editor_hidden_attribute_wins_over_grid_layout(self):
        stylesheet = self.read_project_file("static/styles.css")
        dashboard_template = self.read_project_file("templates/index.html")

        self.assertIn(".event-editor[hidden]", stylesheet)
        self.assertIn('aria-controls="eventEditor"', dashboard_template)
        self.assertIn('aria-expanded="false"', dashboard_template)

    def test_exercise_library_has_bounded_progressive_results(self):
        template = self.read_project_file("templates/oefeningen_bibliotheek.html")
        source = self.read_project_file("static/oefeningen-bibliotheek-20260510-editor.js")

        self.assertIn('id="exerciseShowMore"', template)
        self.assertIn('id="exerciseResultStatus"', template)
        self.assertIn("exerciseVisibleLimit", source)
        self.assertIn("getExercisePageSize", source)

    def test_offline_page_does_not_promise_background_sync(self):
        source = self.read_project_file("static/offline.html")

        self.assertIn("Wijzigingen worden niet offline opgeslagen", source)

    def test_login_defers_nonessential_background_slides(self):
        stylesheet = self.read_project_file("static/styles.css")
        source = self.read_project_file("static/login-background.js")
        login_template = self.read_project_file("templates/login.html")

        self.assertIn(".login-background-ready .login-background-slide-2", stylesheet)
        self.assertIn('navigator.connection?.saveData === true', source)
        self.assertIn('document.body.classList.add("login-background-static")', source)
        self.assertIn('document.body.classList.add("login-background-ready")', source)
        self.assertIn("/static/login-background.js", login_template)

    def test_workspace_logo_is_explicitly_bounded(self):
        stylesheet = self.read_project_file("static/styles.css")
        base_template = self.read_project_file("templates/base.html")

        self.assertIn('class="workspace-brand"', base_template)
        self.assertIn(".workspace-brand img", stylesheet)
        self.assertIn("width: 54px", stylesheet)
        self.assertIn("height: 54px", stylesheet)

    def test_agenda_summary_rows_copy_dates_directly(self):
        source = self.read_project_file("static/agenda.js")
        template = self.read_project_file("templates/agenda.html")
        copy_handler = source.split("agendaSummaryCopyButtons.forEach", 1)[1].split(
            "agendaBulkDateInputs.forEach", 1
        )[0]

        self.assertIn('button.addEventListener("click", () => copyAgendaSummaryDays(button));', copy_handler)
        self.assertNotIn("setBulkModalOpen", copy_handler)
        self.assertIn('id="agendaSummaryCopyFeedback"', template)
        self.assertIn('data-agenda-summary-copy="{{ detail.copyText }}"', template)
