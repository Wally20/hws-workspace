import os
import re
import sqlite3
import tempfile
import time
from datetime import date, datetime
from importlib import import_module
from unittest.mock import Mock, patch

from django.conf import settings
from django.test import Client, SimpleTestCase

import app as legacy


class LegacyDjangoSmokeTests(SimpleTestCase):
    TEST_CSRF_TOKEN = "test-csrf-token-value-with-sufficient-length-1234567890"

    def tearDown(self):
        with legacy.get_db_connection() as connection:
            connection.execute("DELETE FROM rate_limit_attempts")
            connection.execute("DELETE FROM registration_email_statuses")
            connection.execute("DELETE FROM registration_email_reminder_statuses")
            connection.execute("DELETE FROM registration_event_statuses")
            connection.execute("DELETE FROM registration_event_email_settings WHERE product_key LIKE 'id:999%'")
            connection.execute("DELETE FROM football_days_playbooks WHERE title LIKE 'Test draaiboek%'")
        super().tearDown()

    def extract_csrf_token(self, response) -> str:
        content = response.content.decode("utf-8")
        match = re.search(r'name="csrf_token" value="([^"]+)"', content)
        self.assertIsNotNone(match)
        return match.group(1)

    def build_authenticated_client(self) -> Client:
        client = Client()
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = legacy.load_trainer_profiles()[0]["id"]
        session_store["csrf_token"] = self.TEST_CSRF_TOKEN
        session_store["session_started_at"] = int(time.time())
        session_store["session_last_seen_at"] = int(time.time())
        session_store.save()
        client.cookies[settings.SESSION_COOKIE_NAME] = session_store.session_key
        client.cookies[settings.SESSION_COOKIE_NAME]["secure"] = settings.SESSION_COOKIE_SECURE
        return client

    def test_login_page_renders(self):
        response = Client().get("/login", secure=True)

        self.assertEqual(response.status_code, 200)
        self.assertIn("HWS Voetbalschool", response.content.decode("utf-8"))
        self.assertIn('name="csrf_token"', response.content.decode("utf-8"))

    def test_logout_action_is_only_visible_on_personal_profile(self):
        client = self.build_authenticated_client()

        profile_response = client.get("/profiel", secure=True)
        trainers_response = client.get("/trainers", secure=True)

        self.assertEqual(profile_response.status_code, 200)
        self.assertContains(profile_response, 'class="profile-logout-button"')
        self.assertContains(profile_response, ">Uitloggen</button>")
        self.assertNotContains(trainers_response, ">Uitloggen</button>")

    def test_materials_club_pdf_is_single_landscape_a4_page(self):
        club = {
            "name": "Testclub",
            "quantities": {"material-1": 12, "material-2": 20},
        }
        materials = [
            {"key": "material-1", "name": "Ballen"},
            {"key": "material-2", "name": "Hesjes"},
        ]

        pdf_bytes = legacy.create_materials_club_pdf(club, materials)

        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))
        self.assertEqual(pdf_bytes.count(b"/Type /Page\n"), 1)
        self.assertIn(b"/MediaBox [ 0 0 841.8898 595.2756 ]", pdf_bytes)

    def test_saved_materials_club_has_inline_pdf_export(self):
        inventory = {
            "materials": [
                {
                    "id": 1,
                    "key": "material-1",
                    "name": "Ballen",
                    "totalCount": 8,
                    "allocatedCount": 8,
                    "availableCount": 0,
                }
            ],
            "clubs": [
                {
                    "id": 42,
                    "key": "club-42",
                    "name": "VV Test",
                    "quantities": {"material-1": 8},
                    "totalCount": 8,
                }
            ],
            "totalCount": 8,
            "allocatedCount": 8,
            "availableCount": 0,
        }
        client = self.build_authenticated_client()

        with (
            patch.object(legacy, "require_page_access", return_value=None),
            patch.object(legacy, "load_materials_inventory", return_value=inventory),
        ):
            page_response = client.get("/materialen", secure=True)
            pdf_response = client.get("/materialen/clubs/42/export-pdf", secure=True)

        self.assertEqual(page_response.status_code, 200)
        self.assertIn('/materialen/clubs/42/export-pdf', page_response.content.decode("utf-8"))
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response["Content-Type"], "application/pdf")
        self.assertIn('inline; filename="materialenkrat-vv-test.pdf"', pdf_response["Content-Disposition"])
        self.assertTrue(pdf_response.content.startswith(b"%PDF-"))

    def test_saved_materials_clubs_can_be_exported_in_one_pdf(self):
        inventory = {
            "materials": [
                {
                    "id": 1,
                    "key": "material-1",
                    "name": "Ballen",
                    "totalCount": 18,
                    "allocatedCount": 18,
                    "availableCount": 0,
                }
            ],
            "clubs": [
                {"id": 42, "key": "club-42", "name": "VV Test", "quantities": {"material-1": 8}, "totalCount": 8},
                {"id": 43, "key": "club-43", "name": "SV Voorbeeld", "quantities": {"material-1": 10}, "totalCount": 10},
            ],
            "totalCount": 18,
            "allocatedCount": 18,
            "availableCount": 0,
        }
        client = self.build_authenticated_client()

        with (
            patch.object(legacy, "require_page_access", return_value=None),
            patch.object(legacy, "load_materials_inventory", return_value=inventory),
        ):
            page_response = client.get("/materialen", secure=True)
            pdf_response = client.get("/materialen/clubs/export-pdf", secure=True)

        self.assertEqual(page_response.status_code, 200)
        page_content = page_response.content.decode("utf-8")
        self.assertIn("data-open-club-export-modal", page_content)
        self.assertIn('value="42" data-export-club-checkbox checked', page_content)
        self.assertIn('value="43" data-export-club-checkbox checked', page_content)
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response["Content-Type"], "application/pdf")
        self.assertIn(
            'attachment; filename="materialenkratten-alle-clubs.pdf"',
            pdf_response["Content-Disposition"],
        )
        self.assertTrue(pdf_response.content.startswith(b"%PDF-"))
        self.assertEqual(pdf_response.content.count(b"/Type /Page\n"), 2)

    def test_materials_clubs_pdf_only_contains_selected_clubs(self):
        inventory = {
            "materials": [{"id": 1, "key": "material-1", "name": "Ballen"}],
            "clubs": [
                {"id": 42, "key": "club-42", "name": "VV Test", "quantities": {"material-1": 8}},
                {"id": 43, "key": "club-43", "name": "SV Voorbeeld", "quantities": {"material-1": 10}},
            ],
        }
        client = self.build_authenticated_client()

        with (
            patch.object(legacy, "require_page_access", return_value=None),
            patch.object(legacy, "load_materials_inventory", return_value=inventory),
        ):
            pdf_response = client.get("/materialen/clubs/export-pdf?club_id=43", secure=True)

        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response["Content-Type"], "application/pdf")
        self.assertIn(
            'attachment; filename="materialenkratten-geselecteerde-clubs.pdf"',
            pdf_response["Content-Disposition"],
        )
        self.assertTrue(pdf_response.content.startswith(b"%PDF-"))
        self.assertEqual(pdf_response.content.count(b"/Type /Page\n"), 1)

    def test_login_requires_valid_csrf_token(self):
        response = Client(enforce_csrf_checks=False).post(
            "/login",
            {"email": "admin@example.com", "password": "wrong-password"},
            secure=True,
        )

        self.assertEqual(response.status_code, 403)

    def test_automatic_invoice_lines_deduct_previous_month_cancellations(self):
        setting = {
            "id": 1,
            "clubName": "VV Gorssel",
            "standardAmount": "100.00",
            "trainingAmount": "25.00",
            "periodStart": "2026-09-01",
            "periodEnd": "2027-06-01",
        }
        trainings = [
            {
                "location": "VV Gorssel",
                "trainingType": "samenwerkende_amateurclub",
                "status": "geannuleerd",
                "date": "2026-09-14",
                "time": "18:00",
            },
            {
                "location": "VV Gorssel",
                "trainingType": "samenwerkende_amateurclub",
                "status": "geannuleerd",
                "date": "2026-09-21",
                "time": "18:00",
            },
        ]

        with patch.object(legacy, "load_agenda_trainings", return_value=trainings) as mocked_load:
            payload = legacy.build_automatic_invoice_lines(setting, legacy.date(2026, 10, 1))

        mocked_load.assert_called_once_with("2026-09-01", "2026-09-30")
        self.assertEqual(payload["invoiceLines"][0]["description"], "Factuurbedrag 2 seizoen 2026/2027")
        self.assertEqual(payload["invoiceLines"][0]["price"], "100.00")
        self.assertEqual(payload["invoiceLines"][1]["description"], "Niet gegeven trainingen september 2026 (2 x 25,00)")
        self.assertEqual(payload["invoiceLines"][1]["price"], "-50.00")
        self.assertEqual(payload["totalAmountLabel"], "€ 50,00")

    def test_login_rate_limit_blocks_repeated_attempts(self):
        client = Client()
        csrf_token = self.extract_csrf_token(client.get("/login", secure=True))

        with patch.object(legacy, "authenticate_user", return_value=None):
            for _ in range(5):
                response = client.post(
                    "/login",
                    {"csrf_token": csrf_token, "email": "admin@example.com", "password": "wrong-password"},
                    secure=True,
                )
                self.assertEqual(response.status_code, 200)

            blocked_response = client.post(
                "/login",
                {"csrf_token": csrf_token, "email": "admin@example.com", "password": "wrong-password"},
                secure=True,
            )

        self.assertEqual(blocked_response.status_code, 429)

    def test_login_success_rotates_session_and_redirects(self):
        client = Client()
        csrf_token = self.extract_csrf_token(client.get("/login", secure=True))
        fake_user = {"id": "trainer-123", "isAdmin": True}

        with patch.object(legacy, "authenticate_user", return_value=fake_user):
            response = client.post(
                "/login",
                {"csrf_token": csrf_token, "email": "admin@example.com", "password": "correct-password"},
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/trainers")
        self.assertEqual(client.session["user_id"], "trainer-123")
        self.assertIn("csrf_token", client.session)

    def test_dashboard_events_api_requires_only_legacy_session(self):
        response = self.build_authenticated_client().get("/api/dashboard-events", secure=True)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["label"], legacy.load_dashboard_events_config()[0]["label"])

    def test_dashboard_events_post_requires_csrf_token(self):
        response = self.build_authenticated_client().post(
            "/api/dashboard-events",
            data='{"items":[]}',
            content_type="application/json",
            secure=True,
        )

        self.assertEqual(response.status_code, 403)

    def test_dashboard_events_post_accepts_valid_csrf_token(self):
        client = self.build_authenticated_client()
        with patch.object(legacy, "save_dashboard_events_config") as mocked_save:
            response = client.post(
                "/api/dashboard-events",
                data='{"items":[{"productId":"1","label":"Clinic","matchTerms":["Clinic"]}]}',
                content_type="application/json",
                HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
                secure=True,
            )

        self.assertEqual(response.status_code, 200)
        mocked_save.assert_called_once()

    def test_dashboard_events_can_be_saved_empty(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            original_data_dir = legacy.DATA_DIR
            original_database_path = legacy.DATABASE_PATH
            try:
                legacy.DATA_DIR = temp_dir
                legacy.DATABASE_PATH = os.path.join(temp_dir, "app.db")
                legacy.clear_local_data_cache()
                legacy.init_db()

                legacy.save_dashboard_events_config(
                    [{"productId": "1", "label": "Clinic", "matchTerms": ["Clinic"]}]
                )
                legacy.save_dashboard_events_config([])

                self.assertEqual(legacy.load_dashboard_events_config(), [])
            finally:
                legacy.DATA_DIR = original_data_dir
                legacy.DATABASE_PATH = original_database_path
                legacy.clear_local_data_cache()

    def test_training_session_save_uses_exercise_library(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            original_data_dir = legacy.DATA_DIR
            original_database_path = legacy.DATABASE_PATH
            try:
                legacy.DATA_DIR = temp_dir
                legacy.DATABASE_PATH = os.path.join(temp_dir, "app.db")
                legacy.clear_local_data_cache()
                legacy.init_db()
                with legacy.get_db_connection() as connection:
                    connection.execute(
                        """
                        INSERT INTO exercises (
                            title, category, duration, training_exercise, description,
                            coaching, variation_easier, variation_harder, dimensions,
                            materials, field_json, source_slide, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            "Passing vorm",
                            "Passing",
                            "10 minuten",
                            "Techniek",
                            "Omschrijving",
                            "Coaching",
                            "",
                            "",
                            "",
                            "Ballen",
                            "{}",
                            None,
                            legacy.utcnow_iso(),
                        ),
                    )

                training = legacy.save_training_session(
                    {
                        "title": "Training JO11",
                        "notes": "Focus op passing.",
                        "exercises": [{"exerciseId": 1}],
                    }
                )

                self.assertIsNotNone(training)
                self.assertEqual(training["title"], "Training JO11")
                self.assertEqual(training["exercises"][0]["title"], "Passing vorm")
            finally:
                legacy.DATA_DIR = original_data_dir
                legacy.DATABASE_PATH = original_database_path
                legacy.clear_local_data_cache()

    def test_exercise_library_loads_alphabetically_by_title(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            original_data_dir = legacy.DATA_DIR
            original_database_path = legacy.DATABASE_PATH
            try:
                legacy.DATA_DIR = temp_dir
                legacy.DATABASE_PATH = os.path.join(temp_dir, "app.db")
                legacy.clear_local_data_cache()
                legacy.init_db()
                with legacy.get_db_connection() as connection:
                    for title, category in [
                        ("Zigzag dribbel", "Dribbelvormen"),
                        ("1v1 lijndribbbel", "1v1 vormen"),
                        ("Aanname onder druk", "Techniek"),
                        ("Balcontrole", "Passing"),
                    ]:
                        connection.execute(
                            """
                            INSERT INTO exercises (
                                title, category, duration, training_exercise, description,
                                coaching, variation_easier, variation_harder, dimensions,
                                materials, field_json, source_slide, updated_at
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                title,
                                category,
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "",
                                "{}",
                                None,
                                legacy.utcnow_iso(),
                            ),
                        )

                self.assertEqual(
                    [exercise["title"] for exercise in legacy.load_exercises()],
                    ["Aanname onder druk", "Balcontrole", "Zigzag dribbel", "1v1 lijndribbbel"],
                )
            finally:
                legacy.DATA_DIR = original_data_dir
                legacy.DATABASE_PATH = original_database_path
                legacy.clear_local_data_cache()

    def test_authenticated_session_stays_valid_after_old_timestamps(self):
        client = Client()
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = legacy.load_trainer_profiles()[0]["id"]
        session_store["csrf_token"] = self.TEST_CSRF_TOKEN
        session_store["session_started_at"] = int(time.time()) - (legacy.SESSION_ABSOLUTE_TIMEOUT_SECONDS + 10)
        session_store["session_last_seen_at"] = int(time.time()) - (legacy.SESSION_IDLE_TIMEOUT_SECONDS + 10)
        session_store.save()
        client.cookies[settings.SESSION_COOKIE_NAME] = session_store.session_key

        response = client.get("/", secure=True)

        self.assertEqual(response.status_code, 200)

    def test_security_headers_present(self):
        response = Client().get("/login", secure=True)

        self.assertEqual(response.status_code, 200)
        self.assertIn("default-src 'self'", response["Content-Security-Policy"])
        self.assertIn("script-src 'self' 'nonce-", response["Content-Security-Policy"])
        self.assertIn("connect-src 'self' https://opendata.rijksoverheid.nl https://date.nager.at", response["Content-Security-Policy"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["X-Frame-Options"], "DENY")

    def test_upload_validation_rejects_mismatched_extension(self):
        class UploadedFile:
            filename = "malicious.jpg"
            mimetype = "image/png"

            def read(self):
                return b"\x89PNG\r\n\x1a\nfake"

        config = {
            "allowed_types": ["image/png"],
            "max_upload_mb": 5,
            "base_path": "content",
        }
        album = {"id": 1, "slug": "test-album"}

        with self.assertRaisesMessage(ValueError, "Bestandsextensie niet toegestaan"):
            legacy.prepare_content_upload_entry(album, UploadedFile(), config)

    def test_dashboard_falls_back_to_mock_data_for_placeholder_ecwid_config(self):
        with patch.dict(
            "os.environ",
            {
                "ECWID_STORE_ID": "HIER_JOUW_ECWID_STORE_ID",
                "ECWID_SECRET_TOKEN": "HIER_JOUW_ECWID_SECRET_TOKEN",
            },
            clear=False,
        ):
            response = self.build_authenticated_client().get("/", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Live Ecwid-koppeling staat nog niet aan.", content)

    def test_trainer_has_dashboard_access_and_lands_there_after_login(self):
        trainer = {"id": "trainer-123", "isAdmin": False, "systemRole": "Trainer"}

        self.assertIn("dashboard", legacy.get_visible_pages_for_user(trainer))
        self.assertIn("agenda", legacy.get_visible_pages_for_user(trainer))
        self.assertNotIn("management", legacy.get_visible_pages_for_user(trainer))
        self.assertNotIn("marketing", legacy.get_visible_pages_for_user(trainer))
        self.assertEqual(legacy.get_default_post_login_path(trainer), "/")

    def test_trainer_cannot_open_management_or_marketing_pages(self):
        trainer = {
            "id": "trainer-123",
            "fullName": "Test Trainer",
            "isAdmin": False,
            "systemRole": "Trainer",
        }

        with patch.object(legacy, "get_current_user", return_value=trainer):
            management_response = Client().get("/management", secure=True)
            marketing_response = Client().get("/marketing", secure=True)

        self.assertRedirects(management_response, "/", fetch_redirect_response=False)
        self.assertRedirects(marketing_response, "/", fetch_redirect_response=False)

    def test_trainer_agenda_only_renders_assigned_appointments_and_is_read_only(self):
        trainer = {
            "id": "trainer-123",
            "fullName": "Test Trainer",
            "isAdmin": False,
            "systemRole": "Trainer",
        }
        today = legacy.date.today()
        own_training = {
            "id": "own-training",
            "title": "Mijn eigen training",
            "date": today.isoformat(),
            "time": "18:00",
            "endTime": "19:00",
            "location": "VV Gorssel",
            "trainingType": "techniektraining",
            "trainingTypeLabel": "Techniektraining",
            "trainingTypeClass": "agenda-event-type-techniektraining",
            "status": "gepland",
            "statusLabel": "Gepland",
            "statusClass": "agenda-event-status-gepland",
            "trainers": [{"id": "trainer-123", "name": "Test Trainer"}],
            "notes": "",
        }
        other_training = {
            **own_training,
            "id": "other-training",
            "title": "Training van een collega",
            "trainers": [{"id": "trainer-999", "name": "Andere Trainer"}],
        }

        with (
            patch.object(legacy, "get_current_user", return_value=trainer),
            patch.object(legacy, "load_agenda_trainings", return_value=[own_training, other_training]),
            patch.object(legacy, "auto_mark_completed_agenda_trainings", return_value=0),
            patch.object(legacy, "build_agenda_external_labels", return_value={}),
        ):
            response = Client().get("/agenda", secure=True)
            post_response = Client().post("/agenda", {"action": "delete_training"}, secure=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Mijn eigen training")
        self.assertNotContains(response, "Training van een collega")
        self.assertNotContains(response, "+ Nieuwe Training")
        self.assertNotContains(response, 'id="agendaEditModal"')
        self.assertEqual(post_response.status_code, 403)

    def test_trainer_dashboard_hides_upcoming_event_registrations_card(self):
        trainer = {
            "id": "trainer-123",
            "fullName": "Test Trainer",
            "isAdmin": False,
            "systemRole": "Trainer",
        }

        with (
            patch.object(legacy, "get_current_user", return_value=trainer),
            patch.object(legacy, "fetch_orders_non_blocking", return_value=legacy.get_empty_dashboard_payload()),
            patch.object(legacy, "build_trainer_dashboard_week_schedule", return_value=[]),
        ):
            response = Client().get("/", secure=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Mijn afspraken deze week")
        self.assertNotContains(response, "Inschrijvingen Aankomende Events")
        self.assertNotContains(response, 'id="eventsSummaryCard"')

    def test_trainer_week_schedule_only_contains_own_upcoming_items_this_week(self):
        trainings = [
            {
                "id": "past-today",
                "title": "Ochtendtraining",
                "date": "2026-07-15",
                "time": "08:00",
                "endTime": "09:30",
                "location": "Veld 1",
                "status": "gegeven",
                "statusLabel": "Gegeven",
                "trainers": [{"id": "trainer-123", "name": "Test Trainer"}],
            },
            {
                "id": "own-today",
                "title": "Techniektraining JO12",
                "date": "2026-07-15",
                "time": "18:00",
                "endTime": "19:30",
                "location": "Sportpark Zuid",
                "status": "gepland",
                "statusLabel": "Gepland",
                "trainers": [{"id": "trainer-123", "name": "Test Trainer"}],
            },
            {
                "id": "other-trainer",
                "title": "Andere training",
                "date": "2026-07-16",
                "time": "17:00",
                "endTime": "18:00",
                "location": "Veld 2",
                "status": "gepland",
                "statusLabel": "Gepland",
                "trainers": [{"id": "trainer-999", "name": "Andere Trainer"}],
            },
            {
                "id": "own-sunday",
                "title": "Clinic",
                "date": "2026-07-19",
                "time": "10:00",
                "endTime": "12:00",
                "location": "HWS",
                "status": "geannuleerd",
                "statusLabel": "Geannuleerd",
                "trainers": [{"id": "trainer-123", "name": "Test Trainer"}],
            },
            {
                "id": "next-week",
                "title": "Training volgende week",
                "date": "2026-07-20",
                "time": "18:00",
                "endTime": "19:30",
                "location": "HWS",
                "status": "gepland",
                "statusLabel": "Gepland",
                "trainers": [{"id": "trainer-123", "name": "Test Trainer"}],
            },
        ]

        with patch.object(legacy, "load_agenda_trainings", return_value=trainings) as mocked_load:
            schedule = legacy.build_trainer_dashboard_week_schedule(
                {"id": "trainer-123", "isAdmin": False, "systemRole": "Trainer"},
                reference_datetime=datetime(2026, 7, 15, 12, 0),
            )

        mocked_load.assert_called_once_with("2026-07-15", "2026-07-19")
        self.assertEqual([item["id"] for item in schedule], ["own-today", "own-sunday"])
        self.assertEqual(schedule[0]["dateLabel"], "Vandaag")
        self.assertEqual(schedule[0]["timeLabel"], "18:00 - 19:30")
        self.assertEqual(schedule[1]["dateLabel"], "Zondag 19 juli")

    def test_trainer_dashboard_renders_personal_week_schedule_tile(self):
        trainer = {"id": "trainer-123", "fullName": "Test Trainer", "isAdmin": False, "systemRole": "Trainer"}
        dashboard_payload = {
            "source": "mock",
            "summary": {},
            "reportSummary": {"ecwidRevenue": 0, "moneybirdRevenue": 0, "combinedRevenue": 0},
            "productSummary": [],
            "lastUpdated": "",
            "message": None,
        }
        schedule = [
            {
                "id": "own-training",
                "date": "2026-07-16",
                "dateLabel": "Morgen",
                "time": "18:00",
                "timeLabel": "18:00 - 19:30",
                "title": "Techniektraining JO12",
                "location": "Sportpark Zuid",
                "status": "gepland",
                "statusLabel": "Gepland",
            }
        ]

        with patch.object(legacy, "get_current_user", return_value=trainer), patch.object(
            legacy, "fetch_orders_non_blocking", return_value={}
        ), patch.object(
            legacy, "build_dashboard_frontend_payload", return_value=dashboard_payload
        ), patch.object(
            legacy, "build_trainer_dashboard_week_schedule", return_value=schedule
        ), patch.object(
            legacy,
            "load_dashboard_weather_settings",
            return_value={"weather_lat": "52.25", "weather_lon": "6.16", "weather_name": "Deventer"},
        ):
            response = self.build_authenticated_client().get("/", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Mijn afspraken deze week", content)
        self.assertIn("Techniektraining JO12", content)
        self.assertIn("Sportpark Zuid", content)

    def test_orders_page_is_visible_for_all_authenticated_users(self):
        self.assertIn("orders", legacy.get_visible_pages_for_user({"id": "admin", "isAdmin": True}))
        self.assertIn(
            "orders",
            legacy.get_visible_pages_for_user({"id": "social", "isAdmin": False, "systemRole": "Social media beheerder"}),
        )
        self.assertIn("orders", legacy.get_visible_pages_for_user({"id": "trainer", "isAdmin": False, "systemRole": "Trainer"}))

    def test_football_day_only_agenda_day_counts_as_no_activity(self):
        summary_day_plans = legacy.add_football_day_only_no_activity_days(
            [
                {
                    "date": "2026-05-01",
                    "planType": "Voetbaldag",
                }
            ],
            [],
        )
        summary = legacy.build_agenda_day_plan_summary(summary_day_plans)
        no_activity = next(item for item in summary if item["label"] == "Geen activiteit")
        football_day = next(item for item in summary if item["label"] == "Voetbaldag")

        self.assertEqual(football_day["count"], 1)
        self.assertEqual(no_activity["count"], 1)
        self.assertEqual(no_activity["details"][0]["copyText"], "1. Vrijdag 1 mei 2026")

    def test_football_day_only_training_item_counts_as_no_activity(self):
        summary_day_plans = legacy.add_football_day_only_no_activity_days(
            [],
            [
                {
                    "title": "Voetbaldag VV Voorst",
                    "date": "2026-05-01",
                    "time": "09:00",
                }
            ],
        )
        summary = legacy.build_agenda_day_plan_summary(summary_day_plans)
        no_activity = next(item for item in summary if item["label"] == "Geen activiteit")

        self.assertEqual(no_activity["count"], 1)
        self.assertEqual(no_activity["details"][0]["copyText"], "1. Vrijdag 1 mei 2026")

    def test_football_day_with_training_does_not_count_as_no_activity(self):
        summary_day_plans = legacy.add_football_day_only_no_activity_days(
            [],
            [
                {
                    "title": "Voetbaldag VV Voorst",
                    "date": "2026-05-01",
                    "time": "09:00",
                },
                {
                    "title": "Techniektraining JO10",
                    "date": "2026-05-01",
                    "time": "17:00",
                },
            ],
        )
        summary = legacy.build_agenda_day_plan_summary(summary_day_plans)
        no_activity = next(item for item in summary if item["label"] == "Geen activiteit")

        self.assertEqual(no_activity["count"], 0)

    def test_leads_page_is_visible_for_all_authenticated_users(self):
        self.assertIn("leads", legacy.get_visible_pages_for_user({"id": "admin", "isAdmin": True}))
        self.assertIn(
            "leads",
            legacy.get_visible_pages_for_user({"id": "social", "isAdmin": False, "systemRole": "Social media beheerder"}),
        )
        self.assertIn("leads", legacy.get_visible_pages_for_user({"id": "trainer", "isAdmin": False, "systemRole": "Trainer"}))

    def test_spaarpot_is_visible_for_admin_users(self):
        self.assertIn("spaarpot", legacy.get_visible_pages_for_user({"id": "admin", "isAdmin": True}))
        self.assertNotIn(
            "spaarpot",
            legacy.get_visible_pages_for_user({"id": "trainer", "isAdmin": False, "systemRole": "Trainer"}),
        )

    def test_spaarpot_quarter_summary_uses_moneybird_payment_dates(self):
        invoices = [
            {
                "id": "1",
                "invoice_id": "2026-0001",
                "payments": [
                    {"payment_date": "2026-01-15", "price": "100.00"},
                    {"payment_date": "2026-03-20", "price": "50.00"},
                    {"payment_date": "2026-04-01", "price": "200.00"},
                    {"payment_date": "2026-04-02", "price": "-25.00"},
                ],
            },
            {
                "id": "2",
                "invoice_id": "2025-0009",
                "payments": [{"payment_date": "2025-12-31", "price": "80.00"}],
            },
        ]

        entries = legacy.build_spaarpot_payment_entries(invoices)
        summary = legacy.build_spaarpot_quarter_summary(entries, 2026)

        self.assertEqual(len(entries), 4)
        self.assertEqual(summary["quarters"][0]["income"], 150.0)
        self.assertEqual(summary["quarters"][0]["reserve"], 13.5)
        self.assertEqual(summary["quarters"][1]["income"], 200.0)
        self.assertEqual(summary["quarters"][1]["reserve"], 18.0)
        self.assertEqual(summary["income"], 350.0)
        self.assertEqual(summary["reserve"], 31.5)

    def test_spaarpot_quarter_summary_includes_moneybird_stripe_mutations(self):
        invoices = [
            {
                "id": "1",
                "invoice_id": "2026-0001",
                "payments": [{"payment_date": "2026-01-15", "price": "100.00"}],
            }
        ]
        financial_mutations = [
            {
                "id": "mutation-1",
                "code": "STR-1001",
                "date": "2026-02-10",
                "amount": "-250.00",
                "contra_account_name": "STRIPE",
                "message": "Stripe payout",
                "payments": [{"invoice_type": "ExternalSalesInvoice"}],
            },
            {
                "id": "mutation-2",
                "code": "BANK-1002",
                "date": "2026-02-11",
                "amount": "75.00",
                "contra_account_name": "Andere klant",
                "message": "Losse betaling",
                "payments": [],
            },
            {
                "id": "mutation-3",
                "code": "STR-1002",
                "date": "2026-04-14",
                "amount": "929.84",
                "contra_account_name": "STRIPE TECHNOLOGY EUROPE, LIMITED",
                "message": "",
                "payments": [],
            },
            {
                "id": "mutation-4",
                "code": "STR-1003",
                "date": "2026-02-12",
                "amount": "-50.00",
                "contra_account_name": "STRIPE",
                "message": "Stripe gekoppeld aan verkoopfactuur",
                "payments": [{"invoice_type": "SalesInvoice"}],
            },
        ]

        entries = legacy.build_spaarpot_payment_entries(invoices, financial_mutations)
        summary = legacy.build_spaarpot_quarter_summary(entries, 2026)

        self.assertEqual(len(entries), 3)
        self.assertEqual(summary["quarters"][0]["income"], 350.0)
        self.assertEqual(summary["quarters"][0]["reserve"], 31.5)
        self.assertEqual(summary["quarters"][1]["income"], 929.84)
        self.assertEqual(summary["quarters"][1]["reserve"], 83.69)
        self.assertIn("Stripe STR-1001", [entry["invoiceId"] for entry in entries])
        self.assertIn("Stripe STR-1002", [entry["invoiceId"] for entry in entries])
        self.assertNotIn("Stripe STR-1003", [entry["invoiceId"] for entry in entries])

    def test_spaarpot_quarter_summary_includes_manual_reservations(self):
        entries = legacy.build_spaarpot_payment_entries(
            [
                {
                    "id": "1",
                    "invoice_id": "2026-0001",
                    "payments": [{"payment_date": "2026-01-15", "price": "100.00"}],
                }
            ]
        )
        entries.append(
            {
                "source": "manual",
                "date": "2026-02-01",
                "dateLabel": "01-02-2026",
                "year": 2026,
                "quarter": 1,
                "quarterLabel": "JAN-FEB-MAA",
                "invoiceId": "Handmatig",
                "contactName": "",
                "accountLabel": "Reservering trainersvergoedingen",
                "amount": 0.0,
                "reserve": 250.0,
            }
        )

        summary = legacy.build_spaarpot_quarter_summary(entries, 2026)

        self.assertEqual(summary["quarters"][0]["income"], 100.0)
        self.assertEqual(summary["quarters"][0]["reserve"], 259.0)
        self.assertEqual(summary["quarters"][0]["paymentCount"], 1)
        self.assertEqual(summary["quarters"][0]["manualCount"], 1)

    def test_spaarpot_weekly_reminder_uses_previous_monday_window(self):
        entries = [
            {"source": "payment", "date": "2026-05-24", "reserve": 4.5},
            {"source": "payment", "date": "2026-05-25", "reserve": 9.0},
            {"source": "stripe", "date": "2026-05-31", "reserve": 18.0},
            {"source": "payment", "date": "2026-06-01", "reserve": 36.0},
        ]

        reminder = legacy.build_spaarpot_weekly_reminder(entries, date(2026, 6, 1))

        self.assertEqual(reminder["weekStart"], "2026-05-25")
        self.assertEqual(reminder["weekEnd"], "2026-06-01")
        self.assertEqual(reminder["previousBalance"], 4.5)
        self.assertEqual(reminder["weeklyAdded"], 27.0)
        self.assertEqual(reminder["topUpAmount"], 27.0)
        self.assertEqual(reminder["currentBalance"], 31.5)
        self.assertEqual(reminder["paymentCount"], 2)

    def test_spaarpot_page_renders_moneybird_quarters(self):
        moneybird = {
            "invoices": [
                {
                    "id": "1",
                    "invoice_id": "2026-0001",
                    "contact": {"company_name": "Voetbal Ouder", "bank_account": "NL91ABNA0417164300"},
                    "payments": [{"payment_date": "2026-01-15", "price": "100.00"}],
                }
            ],
            "financialMutations": [
                {
                    "id": "mutation-1",
                    "code": "STR-1001",
                    "date": "2026-01-20",
                    "amount": "-50.00",
                    "contra_account_name": "STRIPE",
                    "message": "Stripe payout",
                    "payments": [{"invoice_type": "ExternalSalesInvoice"}],
                }
            ],
            "message": None,
        }
        payload = {
            "moneybird": moneybird,
            "message": None,
            "cachedAt": 1767222000.0,
        }
        manual_entries = [
            {
                "source": "manual",
                "id": 1,
                "date": "2026-01-22",
                "dateLabel": "22-01-2026",
                "year": 2026,
                "quarter": 1,
                "quarterLabel": "JAN-FEB-MAA",
                "invoiceId": "Handmatig",
                "contactName": "",
                "accountLabel": "Reservering trainersvergoedingen",
                "amount": 0.0,
                "reserve": 125.0,
            }
        ]

        with patch.object(legacy, "get_current_user", return_value={"id": "admin", "isAdmin": True}), patch.object(
            legacy,
            "fetch_orders_non_blocking",
            return_value=payload,
        ) as fetch_orders_non_blocking, patch.object(legacy, "fetch_moneybird_summary") as fetch_moneybird_summary, patch.object(
            legacy, "load_spaarpot_manual_entries", return_value=manual_entries
        ):
            response = Client().get("/spaarpot?year=2026", secure=True)

        self.assertEqual(response.status_code, 200)
        fetch_orders_non_blocking.assert_called_once()
        fetch_moneybird_summary.assert_not_called()
        content = response.content.decode("utf-8")
        self.assertIn("Spaarpot", content)
        self.assertIn("JAN-FEB-MAA", content)
        self.assertIn('href="/spaarpot?year=2026&quarter=1"', content)
        self.assertIn('href="/spaarpot?year=2026&quarter=4"', content)
        self.assertIn("2026-0001", content)
        self.assertIn("Voetbal Ouder - NL91ABNA0417164300", content)
        self.assertIn("Stripe STR-1001", content)
        self.assertIn("STRIPE", content)
        self.assertIn("Reservering trainersvergoedingen", content)
        self.assertIn("€ 138,50", content)

    def test_football_days_new_page_renders_for_authenticated_user(self):
        response = self.build_authenticated_client().get("/voetbaldagen/nieuw", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Nieuw draaiboek", content)
        self.assertIn('action="/voetbaldagen/nieuw"', content)
        self.assertIn('id="footballProgramImageImport"', content)
        self.assertIn("Importeer afbeelding", content)
        self.assertIn('id="footballProgramImportModal"', content)
        self.assertIn('id="confirmFootballProgramImport"', content)
        self.assertIn('data-reuse-playbook="fieldLayout"', content)

    def test_football_days_new_page_saves_and_redirects_to_created_playbook(self):
        response = self.build_authenticated_client().post(
            "/voetbaldagen/nieuw",
            {
                "csrf_token": self.TEST_CSRF_TOKEN,
                "title": "Test draaiboek voetbaldag",
                "event_date": "2026-05-01",
                "location": "Sportpark HWS",
                "ecwid_product_id": "101",
                "ecwid_product_name": "Meivakantie Camp",
                "ecwid_product_sku": "MVC-1",
                "staff_name": ["Test Trainer"],
                "staff_role": ["Trainer"],
                "staff_setup_task": ["Veld 1 uitzetten"],
                "program_start": ["09:00"],
                "program_end": ["10:00"],
                "program_activity": ["Training"],
                "contingencies": "Regenplan klaarzetten.",
            },
            secure=True,
        )

        self.assertEqual(response.status_code, 302)
        self.assertRegex(response["Location"], r"^/voetbaldagen/\d+\?success=")
        created_id = int(response["Location"].split("/voetbaldagen/", 1)[1].split("?", 1)[0])
        created_playbook = legacy.load_football_days_playbook(created_id)
        self.assertEqual(created_playbook["title"], "Test draaiboek voetbaldag")
        self.assertEqual(created_playbook["ecwidProductId"], "101")
        self.assertEqual(created_playbook["ecwidProductName"], "Meivakantie Camp")
        self.assertEqual(created_playbook["contingencies"], "Regenplan klaarzetten.")
        self.assertEqual(
            created_playbook["staff"],
            [{"name": "Test Trainer", "role": "Trainer", "setupTask": "Veld 1 uitzetten"}],
        )
        self.assertEqual(
            created_playbook["program"],
            [{"startTime": "09:00", "endTime": "10:00", "activity": "Training", "icon": "football"}],
        )

    def test_football_days_edit_page_shows_ecwid_registration_count(self):
        playbook_id = legacy.save_football_days_playbook(
            {
                "title": "Test draaiboek met Ecwid",
                "eventDate": "2026-05-01",
                "location": "Sportpark HWS",
                "ecwidProductId": "101",
                "ecwidProductName": "Meivakantie Camp",
                "ecwidProductSku": "MVC-1",
                "staff": [],
                "program": [],
                "contingencies": "",
            }
        )
        orders_payload = {
            "items": [
                {"items": [{"productId": 101, "quantity": 2}, {"productId": 102, "quantity": 1}]},
                {"items": [{"productId": 101, "quantity": 3}]},
            ]
        }

        with patch.object(legacy, "fetch_ecwid_orders", return_value=orders_payload):
            response = self.build_authenticated_client().get(f"/voetbaldagen/{playbook_id}", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn('value="Meivakantie Camp"', content)
        self.assertIn('id="footballRegistrationCount">5</strong>', content)

    def test_football_days_overview_defers_registration_count_fetch(self):
        legacy.save_football_days_playbook(
            {
                "title": "Test draaiboek snel overzicht",
                "eventDate": "2026-05-01",
                "location": "Sportpark HWS",
                "ecwidProductId": "101",
                "ecwidProductName": "Meivakantie Camp",
                "ecwidProductSku": "MVC-1",
                "staff": [],
                "program": [],
                "contingencies": "",
            }
        )

        with patch.object(legacy, "fetch_ecwid_orders") as mocked_fetch_orders:
            response = self.build_authenticated_client().get("/voetbaldagen", secure=True)

        self.assertEqual(response.status_code, 200)
        mocked_fetch_orders.assert_not_called()
        content = response.content.decode("utf-8")
        self.assertIn("voetbaldagen-overview.js", content)
        self.assertIn("data-football-registration-count", content)

    def test_football_days_registration_counts_api_batches_products(self):
        playbook_id = legacy.save_football_days_playbook(
            {
                "title": "Test draaiboek batch telling",
                "eventDate": "2026-05-01",
                "location": "Sportpark HWS",
                "ecwidProductId": "101",
                "ecwidProductName": "Meivakantie Camp",
                "ecwidProductSku": "MVC-1",
                "staff": [],
                "program": [],
                "contingencies": "",
            }
        )
        orders_payload = {
            "items": [
                {"items": [{"productId": 101, "quantity": 2}]},
                {"items": [{"productId": 101, "quantity": 3}]},
            ]
        }

        with patch.object(legacy, "fetch_ecwid_orders", return_value=orders_payload):
            response = self.build_authenticated_client().get(
                f"/api/voetbaldagen/registration-counts?playbook_ids={playbook_id}",
                secure=True,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["counts"][str(playbook_id)], 5)

    def test_amateur_clubs_page_uses_same_playbook_flow_with_own_storage(self):
        response = self.build_authenticated_client().post(
            "/samenwerkende-amateurclubs/nieuw",
            {
                "csrf_token": self.TEST_CSRF_TOKEN,
                "title": "Test draaiboek samenwerkende amateurclub",
                "event_date": "2026-05-08",
                "cycle_number": "4",
                "cycle_start_date": "2026-09-01",
                "cycle_end_date": "2026-12-18",
                "cycle_no_training_dates": "2026-10-19 - Herfstvakantie\n2026-10-21 - Geen veld beschikbaar",
                "location": "Sportpark Samen",
                "staff_name": ["Test Trainer"],
                "staff_role": ["Trainer"],
                "staff_setup_task": ["Veld uitzetten"],
                "program_start": ["17:00"],
                "program_end": ["18:00"],
                "program_activity": ["Teamtraining"],
                "contingencies": "Regenplan klaarzetten.",
            },
            secure=True,
        )

        self.assertEqual(response.status_code, 302)
        self.assertRegex(response["Location"], r"^/samenwerkende-amateurclubs/\d+\?success=")
        created_id = int(response["Location"].split("/samenwerkende-amateurclubs/", 1)[1].split("?", 1)[0])
        self.assertIsNone(legacy.load_football_days_playbook(created_id))
        created_playbook = legacy.load_football_days_playbook(created_id, "samenwerkende-amateurclubs")
        self.assertEqual(created_playbook["title"], "Test draaiboek samenwerkende amateurclub")
        self.assertEqual(created_playbook["playbookType"], "samenwerkende-amateurclubs")
        self.assertEqual(created_playbook["cycleNumber"], "4")
        self.assertEqual(created_playbook["cycleStartDate"], "2026-09-01")
        self.assertEqual(created_playbook["cycleEndDate"], "2026-12-18")
        self.assertEqual(
            [row["date"] for row in created_playbook["cycleNoTrainingDates"]],
            ["2026-10-19", "2026-10-21"],
        )
        self.assertEqual(
            [row["description"] for row in created_playbook["cycleNoTrainingDates"]],
            ["Herfstvakantie", "Geen veld beschikbaar"],
        )

        overview = self.build_authenticated_client().get("/samenwerkende-amateurclubs", secure=True)
        content = overview.content.decode("utf-8")
        self.assertEqual(overview.status_code, 200)
        self.assertIn("Samenwerkende Amateurclubs", content)
        self.assertIn("Cyclus 4: 2026-09-01 t/m 2026-12-18", content)
        self.assertIn("/api/samenwerkende-amateurclubs/registration-counts", content)
        self.assertIn(f'action="/samenwerkende-amateurclubs/{created_id}/dupliceren"', content)

        export_data = legacy.normalize_football_days_export_payload(created_playbook, "samenwerkende-amateurclubs")
        self.assertEqual(export_data["cycleNumber"], "4")
        self.assertEqual(export_data["coverTitle"], "Test draaiboek samenwerkende amateurclub")
        self.assertEqual(
            legacy.football_days_pdf_filename({**export_data, "title": "HWS - SJO Almen/Harfsen - Cyclus 4"}),
            "HWS - SJO Almen-Harfsen - Cyclus 4.pdf",
        )
        self.assertIn("CYCLUS 4", export_data["coverMeta"])
        self.assertEqual(
            [row["date"] for row in export_data["cycleNoTrainingDates"]],
            ["2026-10-19", "2026-10-21"],
        )

    def test_amateur_club_playbook_can_be_duplicated_from_overview_tile(self):
        playbook_id = legacy.save_football_days_playbook(
            {
                "playbookType": "samenwerkende-amateurclubs",
                "title": "Test draaiboek dupliceren",
                "cycleNumber": "5",
                "cycleStartDate": "2026-09-01",
                "cycleEndDate": "2026-12-18",
                "location": "SV Voorbeeld",
                "staff": [{"name": "Test Trainer", "role": "Trainer", "setupTask": "Veld klaarzetten"}],
                "program": [{"startTime": "17:00", "endTime": "18:00", "activity": "Teamtraining"}],
                "fieldTrainings": [{"name": "Training 1", "date": "2026-09-03", "fieldLayout": []}],
                "cycleNoTrainingDates": [{"date": "2026-10-19", "description": "Herfstvakantie"}],
                "contingencies": "Binnen trainen.",
            },
            playbook_type="samenwerkende-amateurclubs",
        )

        response = self.build_authenticated_client().post(
            f"/samenwerkende-amateurclubs/{playbook_id}/dupliceren",
            {"csrf_token": self.TEST_CSRF_TOKEN},
            secure=True,
        )

        self.assertEqual(response.status_code, 302)
        self.assertRegex(response["Location"], r"^/samenwerkende-amateurclubs/\d+\?success=")
        duplicate_id = int(response["Location"].split("/samenwerkende-amateurclubs/", 1)[1].split("?", 1)[0])
        self.assertNotEqual(duplicate_id, playbook_id)
        duplicate = legacy.load_football_days_playbook(duplicate_id, "samenwerkende-amateurclubs")
        self.assertEqual(duplicate["title"], "Kopie van Test draaiboek dupliceren")
        self.assertEqual(duplicate["cycleNumber"], "5")
        self.assertEqual(duplicate["location"], "SV Voorbeeld")
        self.assertEqual(duplicate["staff"], [{"name": "Test Trainer", "role": "Trainer", "setupTask": "Veld klaarzetten"}])
        self.assertEqual([row["date"] for row in duplicate["cycleNoTrainingDates"]], ["2026-10-19"])

    def test_amateur_club_training_dates_are_sorted_for_cycle_pdf(self):
        trainings = [
            {"name": "Training 3", "date": "2026-10-15"},
            {"name": "Training zonder datum", "date": ""},
            {"name": "Training 1", "date": "2026-09-03"},
            {"name": "Training 2", "date": "2026-09-17"},
        ]

        sorted_trainings = legacy.sorted_football_cycle_trainings(trainings)

        self.assertEqual(
            [training["name"] for training in sorted_trainings],
            ["Training 1", "Training 2", "Training 3", "Training zonder datum"],
        )

    def test_no_training_dates_are_normalized_for_cycle_pdf(self):
        dates = legacy.normalize_football_no_training_dates("2026-10-21 - Geen veld\n2026-10-19 - Herfstvakantie, 2026-10-21 dubbel")

        self.assertEqual([row["date"] for row in dates], ["2026-10-19", "2026-10-21"])
        self.assertEqual([row["description"] for row in dates], ["Herfstvakantie", "Geen veld"])
        self.assertEqual(dates[0]["dateLabel"], "Maandag 19 oktober 2026")

    def test_registrations_page_only_loads_products_for_overview(self):
        catalog_payload = {
            "items": [
                {"id": "101", "name": "Meivakantie Camp", "sku": "MVC-1", "price": 79.0, "enabled": True},
                {"id": "102", "name": "Zomercamp", "sku": "ZC-1", "price": 99.0, "enabled": True},
            ],
            "source": "ecwid",
        }

        with patch.object(legacy, "fetch_catalog_products", return_value=catalog_payload), patch.object(
            legacy,
            "fetch_ecwid_orders",
        ) as mocked_fetch_orders:
            response = self.build_authenticated_client().get("/aanmeldingen", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        mocked_fetch_orders.assert_not_called()
        self.assertIn("Meivakantie Camp", content)
        self.assertIn("Zomercamp", content)
        self.assertIn('id="registrationsProductSearch"', content)

    def test_registration_email_status_updates_ecwid_to_processing(self):
        client = self.build_authenticated_client()
        mocked_response = Mock()
        mocked_response.raise_for_status.return_value = None
        mocked_response.content = b'{"updateCount": 1}'
        mocked_response.json.return_value = {"updateCount": 1}

        with patch.dict(
            os.environ,
            {
                "ECWID_STORE_ID": "87654321",
                "ECWID_SECRET_TOKEN": "secret_abcdefghijklmnopqrstuvwxyz123456",
            },
            clear=False,
        ), patch.object(legacy.requests, "put", return_value=mocked_response) as mocked_put:
            response = client.post(
                "/api/registrations/email-status",
                data='{"productKey":"camp-1","orderIds":["ORDER-1"],"emailed":true}',
                content_type="application/json",
                HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
                secure=True,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ecwidUpdatedOrderIds"], ["ORDER-1"])
        mocked_put.assert_called_once()
        self.assertEqual(
            mocked_put.call_args.kwargs["json"],
            {"fulfillmentStatus": legacy.ECWID_PROCESSING_FULFILLMENT_STATUS},
        )

    def test_registration_email_status_keeps_working_without_ecwid_config(self):
        client = self.build_authenticated_client()

        with patch.dict(
            os.environ,
            {
                "ECWID_STORE_ID": "HIER_JOUW_ECWID_STORE_ID",
                "ECWID_SECRET_TOKEN": "HIER_JOUW_ECWID_SECRET_TOKEN",
            },
            clear=False,
        ), patch.object(legacy.requests, "put") as mocked_put:
            response = client.post(
                "/api/registrations/email-status",
                data='{"productKey":"camp-1","orderIds":["ORDER-2"],"emailed":true}',
                content_type="application/json",
                HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
                secure=True,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["ecwidUpdatedOrderIds"], [])
        mocked_put.assert_not_called()

    def test_cancel_registration_event_updates_ecwid_to_returned_and_marks_event_canceled(self):
        client = self.build_authenticated_client()
        mocked_response = Mock()
        mocked_response.raise_for_status.return_value = None
        mocked_response.content = b'{"updateCount": 1}'
        mocked_response.json.return_value = {"updateCount": 1}
        catalog_payload = {
            "items": [
                {"id": "101", "name": "Meivakantie Camp", "sku": "MVC-1", "price": 79.0, "enabled": True},
            ],
            "source": "ecwid",
        }
        orders_payload = {
            "items": [
                {
                    "id": "ORDER-1",
                    "orderNumber": "ORDER-1",
                    "createdAt": "2026-05-01T10:00:00+00:00",
                    "customerName": "Klant Een",
                    "email": "een@example.com",
                    "items": [
                        {"productId": 101, "name": "Meivakantie Camp", "quantity": 2, "price": 79.0, "sku": "MVC-1"},
                    ],
                },
            ],
            "summary": legacy.build_summary([]),
            "cachedAt": 0.0,
            "source": "ecwid",
        }

        with patch.dict(
            os.environ,
            {
                "ECWID_STORE_ID": "87654321",
                "ECWID_SECRET_TOKEN": "secret_abcdefghijklmnopqrstuvwxyz123456",
            },
            clear=False,
        ), patch.object(legacy, "fetch_catalog_products", return_value=catalog_payload), patch.object(
            legacy,
            "fetch_ecwid_orders",
            return_value=orders_payload,
        ), patch.object(legacy.requests, "put", return_value=mocked_response) as mocked_put:
            response = client.post(
                "/api/registrations/event-canceled",
                data='{"productKey":"id:101"}',
                content_type="application/json",
                HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
                secure=True,
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["eventCanceled"])
        self.assertFalse(response.json()["eventCompleted"])
        self.assertTrue(legacy.is_registration_event_canceled("id:101"))
        self.assertFalse(legacy.is_registration_event_completed("id:101"))
        mocked_put.assert_called_once()
        self.assertEqual(
            mocked_put.call_args.kwargs["json"],
            {"fulfillmentStatus": legacy.ECWID_RETURNED_FULFILLMENT_STATUS},
        )

    def test_registration_email_status_returns_error_when_ecwid_update_fails(self):
        client = self.build_authenticated_client()

        with patch.dict(
            os.environ,
            {
                "ECWID_STORE_ID": "87654321",
                "ECWID_SECRET_TOKEN": "secret_abcdefghijklmnopqrstuvwxyz123456",
            },
            clear=False,
        ), patch.object(legacy.requests, "put", side_effect=legacy.requests.RequestException("boom")):
            response = client.post(
                "/api/registrations/email-status",
                data='{"productKey":"camp-1","orderIds":["ORDER-3"],"emailed":true}',
                content_type="application/json",
                HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
                secure=True,
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(
            response.json()["error"],
            "Ecwid-bestelling kon niet op in verwerking worden gezet.",
        )
        self.assertEqual(
            legacy.load_registration_emailed_order_ids("camp-1", {"ORDER-3"}),
            set(),
        )

    def test_sync_emailed_registration_orders_updates_each_unique_order_once(self):
        client = self.build_authenticated_client()
        legacy.set_registration_orders_emailed("camp-1", ["ORDER-1", "ORDER-2"], True)
        legacy.set_registration_orders_emailed("camp-2", ["ORDER-1"], True)

        mocked_response = Mock()
        mocked_response.raise_for_status.return_value = None
        mocked_response.content = b'{"updateCount": 1}'
        mocked_response.json.return_value = {"updateCount": 1}

        with patch.dict(
            os.environ,
            {
                "ECWID_STORE_ID": "87654321",
                "ECWID_SECRET_TOKEN": "secret_abcdefghijklmnopqrstuvwxyz123456",
            },
            clear=False,
        ), patch.object(legacy.requests, "put", return_value=mocked_response) as mocked_put:
            response = client.post(
                "/api/registrations/sync-emailed-orders",
                data="{}",
                content_type="application/json",
                HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
                secure=True,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["syncedOrderIds"], ["ORDER-1", "ORDER-2"])
        self.assertEqual(response.json()["failedOrderIds"], [])
        self.assertEqual(mocked_put.call_count, 2)

    def test_sync_emailed_registration_orders_reports_partial_failures(self):
        client = self.build_authenticated_client()
        legacy.set_registration_orders_emailed("camp-1", ["ORDER-1", "ORDER-2"], True)

        mocked_response = Mock()
        mocked_response.raise_for_status.return_value = None
        mocked_response.content = b'{"updateCount": 1}'
        mocked_response.json.return_value = {"updateCount": 1}

        with patch.dict(
            os.environ,
            {
                "ECWID_STORE_ID": "87654321",
                "ECWID_SECRET_TOKEN": "secret_abcdefghijklmnopqrstuvwxyz123456",
            },
            clear=False,
        ), patch.object(
            legacy.requests,
            "put",
            side_effect=[legacy.requests.RequestException("boom"), mocked_response],
        ):
            response = client.post(
                "/api/registrations/sync-emailed-orders",
                data="{}",
                content_type="application/json",
                HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
                secure=True,
            )

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["syncedOrderIds"], ["ORDER-2"])
        self.assertEqual(response.json()["failedOrderIds"], ["ORDER-1"])

    def test_registrations_detail_page_renders_selected_order_details(self):
        legacy.set_registration_orders_emailed("id:101", ["ORDER-1"], True)
        mock_orders = [
            {
                "id": "ORDER-1",
                "orderNumber": "ORDER-1",
                "createdAt": "2026-04-10T10:00:00+02:00",
                "status": "PAID",
                "paymentStatus": "PAID",
                "fulfillmentStatus": "AWAITING_PROCESSING",
                "total": 79.0,
                "email": "klant1@example.com",
                "customerName": "Klant Een",
                "paymentMethod": "iDEAL",
                "shippingMethod": "Digitaal",
                "itemCount": 1,
                "orderExtraFields": [
                    {"title": "Voornaam", "value": "Klant"},
                    {"title": "Achternaam", "value": "Een"},
                    {"title": "Geboortedatum", "value": "14-05-2014"},
                    {"title": "Geslacht", "value": "Jongen"},
                    {"title": "Club/Team", "value": "VV Voorst JO11-1"},
                    {"title": "Dieetwensen", "value": "Glutenvrij"},
                    {"title": "Opmerkingen", "value": "Komt iets later."},
                ],
                "items": [
                    {"productId": 101, "name": "Meivakantie Camp", "quantity": 1, "price": 79.0, "sku": "MVC-1"},
                ],
            },
            {
                "id": "ORDER-2",
                "orderNumber": "ORDER-2",
                "createdAt": "2026-04-11T11:30:00+02:00",
                "status": "PAID",
                "paymentStatus": "PAID",
                "fulfillmentStatus": "AWAITING_PROCESSING",
                "total": 79.0,
                "email": "klant2@example.com",
                "customerName": "Klant Twee",
                "paymentMethod": "iDEAL",
                "shippingMethod": "Digitaal",
                "itemCount": 1,
                "orderExtraFields": [
                    {"title": "Voornaam", "value": "Klant"},
                    {"title": "Achternaam", "value": "Twee"},
                    {"title": "Geboortedatum", "value": "02-11-2013"},
                    {"title": "Geslacht", "value": "Meisje"},
                    {"title": "Club/Team", "value": "SV Twello MO13-1"},
                    {"title": "Dieetwensen", "value": "Geen"},
                    {"title": "Opmerkingen", "value": "Heeft kniebrace om."},
                ],
                "items": [
                    {"productId": 101, "name": "Meivakantie Camp", "quantity": 1, "price": 79.0, "sku": "MVC-1"},
                ],
            },
        ]
        catalog_payload = {
            "items": [
                {"id": "101", "name": "Meivakantie Camp", "sku": "MVC-1", "price": 79.0, "enabled": True},
                {"id": "102", "name": "Zomercamp", "sku": "ZC-1", "price": 99.0, "enabled": True},
            ],
            "source": "ecwid",
        }
        orders_payload = {
            "items": mock_orders,
            "summary": legacy.build_summary(mock_orders),
            "cachedAt": 0.0,
            "source": "ecwid",
        }

        with patch.object(legacy, "fetch_catalog_products", return_value=catalog_payload), patch.object(
            legacy,
            "fetch_ecwid_orders",
            return_value=orders_payload,
        ):
            response = self.build_authenticated_client().get("/aanmeldingen/id:101", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Meivakantie Camp", content)
        self.assertIn("Klant Een", content)
        self.assertIn("Klant Twee", content)
        self.assertIn("Voornaam", content)
        self.assertIn("Achternaam", content)
        self.assertIn("Geboortedatum", content)
        self.assertIn("Geslacht", content)
        self.assertIn("Club/Team", content)
        self.assertIn("Dieetwensen", content)
        self.assertIn("Opmerkingen", content)
        self.assertIn("14-05-2014", content)
        self.assertIn("VV Voorst JO11-1", content)
        self.assertIn("Glutenvrij", content)
        self.assertIn("Komt iets later.", content)
        self.assertIn("Kopieer alle e-mailadressen", content)
        self.assertIn("Kopieer e-mailadressen die nog niet gemaild zijn", content)
        self.assertIn("Event afgerond", content)
        self.assertIn("Event geannuleerd", content)
        self.assertIn('data-product-key="id:101"', content)
        self.assertIn('data-order-id="ORDER-1"', content)
        self.assertIn('data-order-id="ORDER-2"', content)
        self.assertIn('class="registration-emailed-checkbox"', content)
        self.assertRegex(content, r'class="registration-emailed-checkbox"[^>]*data-order-id="ORDER-1"[^>]*checked')
        self.assertIn('id="registrationPendingEmailCount">1</span> nog niet gemaild', content)
        self.assertIn("Terug naar alle aanmeldingen", content)
        self.assertNotIn('id="registrationsProductSearch"', content)

    def test_registration_email_status_api_updates_and_clears_status(self):
        client = self.build_authenticated_client()

        with patch.dict(
            os.environ,
            {
                "ECWID_STORE_ID": "HIER_JOUW_ECWID_STORE_ID",
                "ECWID_SECRET_TOKEN": "HIER_JOUW_ECWID_SECRET_TOKEN",
            },
            clear=False,
        ):
            set_response = client.post(
                "/api/registrations/email-status",
                data='{"productKey":"id:101","orderIds":["ORDER-1","ORDER-2"],"emailed":true}',
                content_type="application/json",
                HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
                secure=True,
            )

        self.assertEqual(set_response.status_code, 200)
        self.assertEqual(
            legacy.load_registration_emailed_order_ids("id:101"),
            {"ORDER-1", "ORDER-2"},
        )

        clear_response = client.post(
            "/api/registrations/email-status",
            data='{"productKey":"id:101","orderIds":["ORDER-2"],"emailed":false}',
            content_type="application/json",
            HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
            secure=True,
        )

        self.assertEqual(clear_response.status_code, 200)
        self.assertEqual(legacy.load_registration_emailed_order_ids("id:101"), {"ORDER-1"})

    def test_auto_email_new_registration_orders_sends_once_and_marks_emailed(self):
        mock_order = {
            "id": "ORDER-1",
            "orderNumber": "ORDER-1",
            "createdAt": "2026-04-10T10:00:00+02:00",
            "status": "PAID",
            "paymentStatus": "PAID",
            "email": "klant@example.com",
            "customerName": "Klant Een",
            "orderExtraFields": [
                {"title": "Voornaam", "value": "Klant"},
                {"title": "Achternaam", "value": "Een"},
            ],
            "items": [
                {"productId": 101, "name": "Meivakantie Camp", "quantity": 1, "price": 79.0, "sku": "MVC-1"},
            ],
        }

        with patch.dict(
            os.environ,
            {
                "REGISTRATION_AUTO_EMAILS_ENABLED": "1",
                "REGISTRATION_AUTO_EMAILS_START_DATE": "2026-04-01",
                "REGISTRATION_EMAIL_SYNC_ECWID_PROCESSING": "0",
            },
            clear=False,
        ), patch.object(settings, "EMAIL_HOST", "smtp.strato.de"), patch.object(
            settings,
            "EMAIL_HOST_USER",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            settings,
            "EMAIL_HOST_PASSWORD",
            "test-password",
        ), patch.object(
            settings,
            "DEFAULT_FROM_EMAIL",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            legacy,
            "EmailMessage",
        ) as mocked_email_message:
            first_result = legacy.auto_email_new_registration_orders([mock_order])
            second_result = legacy.auto_email_new_registration_orders([mock_order])

        self.assertEqual(first_result["sentOrderIds"], ["id:101:ORDER-1"])
        self.assertEqual(first_result["failedOrderIds"], [])
        self.assertEqual(second_result["sentOrderIds"], [])
        self.assertEqual(mocked_email_message.call_count, 1)
        mocked_email_message.return_value.send.assert_called_once_with(fail_silently=False)
        self.assertEqual(legacy.load_registration_emailed_order_ids("id:101"), {"ORDER-1"})

    def test_manual_registration_product_email_hides_customer_in_bcc(self):
        mock_order = {
            "id": "ORDER-1",
            "orderNumber": "ORDER-1",
            "createdAt": "2026-04-10T10:00:00+02:00",
            "status": "PAID",
            "paymentStatus": "PAID",
            "email": "klant@example.com",
            "customerName": "Klant Een",
            "orderExtraFields": [
                {"title": "Voornaam", "value": "Klant"},
                {"title": "Achternaam", "value": "Een"},
            ],
            "items": [
                {"productId": 101, "name": "Meivakantie Camp", "quantity": 1, "price": 79.0, "sku": "MVC-1"},
            ],
        }

        with patch.dict(
            os.environ,
            {
                "REGISTRATION_EMAIL_SYNC_ECWID_PROCESSING": "0",
                "REGISTRATION_EMAIL_BCC": "david.van.walstijn@gmail.com",
            },
            clear=False,
        ), patch.object(
            settings,
            "DEFAULT_FROM_EMAIL",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            legacy,
            "EmailMessage",
        ) as mocked_email_message:
            result = legacy.send_registration_product_emails("id:101", [mock_order])

        self.assertEqual(result["sentOrderIds"], ["ORDER-1"])
        mocked_email_message.assert_called_once()
        email_kwargs = mocked_email_message.call_args.kwargs
        self.assertEqual(email_kwargs["to"], ["info@hwsvoetbalschool.nl"])
        self.assertIn("<p>", email_kwargs["body"])
        self.assertEqual(
            email_kwargs["bcc"],
            ["klant@example.com", "david.van.walstijn@gmail.com"],
        )
        self.assertEqual(mocked_email_message.return_value.content_subtype, "html")
        mocked_email_message.return_value.send.assert_called_once_with(fail_silently=False)

    def test_registration_email_body_renders_basic_formatting_as_html(self):
        rendered_body = legacy.render_registration_email_body_html(
            "Beste ouder,\n\n**Belangrijk** en *schuin*\n- Neem voetbalschoenen mee\n- Neem **water** mee"
        )

        self.assertIn("<strong>Belangrijk</strong>", rendered_body)
        self.assertIn("<em>schuin</em>", rendered_body)
        self.assertIn("<ul>", rendered_body)
        self.assertIn("<li>Neem voetbalschoenen mee</li>", rendered_body)
        self.assertIn("<li>Neem <strong>water</strong> mee</li>", rendered_body)

    def test_registration_email_html_appends_hws_signature(self):
        rendered_body = legacy.render_registration_email_html("Beste ouder,\n\nBedankt voor je inschrijving.")

        self.assertIn("Met vriendelijke groet,", rendered_body)
        self.assertIn("David van Walstijn", rendered_body)
        self.assertIn("HWS Voetbalschool", rendered_body)
        self.assertIn("hws-logo.png", rendered_body)
        self.assertIn("06-24845896", rendered_body)
        self.assertIn("info@hwsvoetbalschool.nl", rendered_body)

    def test_registration_confirmation_email_uses_hws_signature(self):
        mock_order = {
            "id": "ORDER-1",
            "orderNumber": "ORDER-1",
            "createdAt": "2026-04-10T10:00:00+02:00",
            "status": "PAID",
            "paymentStatus": "PAID",
            "email": "klant@example.com",
            "customerName": "Klant Een",
            "orderExtraFields": [
                {"title": "Voornaam", "value": "Klant"},
                {"title": "Achternaam", "value": "Een"},
            ],
        }
        mock_item = {"productId": 101, "name": "Meivakantie Camp", "quantity": 1, "price": 79.0, "sku": "MVC-1"}

        with patch.object(
            settings,
            "DEFAULT_FROM_EMAIL",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            legacy,
            "EmailMessage",
        ) as mocked_email_message:
            legacy.send_registration_confirmation_email(mock_order, mock_item)

        email_kwargs = mocked_email_message.call_args.kwargs
        self.assertIn("Met vriendelijke groet,", email_kwargs["body"])
        self.assertIn("David van Walstijn", email_kwargs["body"])
        self.assertIn("hws-logo.png", email_kwargs["body"])
        self.assertEqual(mocked_email_message.return_value.content_subtype, "html")

    def test_registration_confirmation_email_can_prefix_reminder_subject(self):
        mock_order = {
            "id": "ORDER-1",
            "orderNumber": "ORDER-1",
            "createdAt": "2026-04-10T10:00:00+02:00",
            "status": "PAID",
            "paymentStatus": "PAID",
            "email": "klant@example.com",
            "customerName": "Klant Een",
        }
        mock_item = {"productId": 9991, "name": "Test Event", "quantity": 1, "price": 79.0, "sku": "TEST"}

        legacy.save_registration_event_email_settings(
            "id:9991",
            "Test Event",
            "2026-08-05",
            "",
            "Praktische informatie {product_naam}",
            "Beste {klant_naam},\n\nDit is de eventmail.",
        )

        with patch.object(
            settings,
            "DEFAULT_FROM_EMAIL",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            legacy,
            "EmailMessage",
        ) as mocked_email_message:
            legacy.send_registration_confirmation_email(mock_order, mock_item, subject_prefix="Reminder: ")

        self.assertEqual(
            mocked_email_message.call_args.kwargs["subject"],
            "Reminder: Praktische informatie Test Event",
        )

    def test_registration_reminder_emails_send_once_for_due_paid_emailed_orders(self):
        mock_order = {
            "id": "ORDER-1",
            "orderNumber": "ORDER-1",
            "createdAt": "2026-07-01T10:00:00+02:00",
            "status": "PAID",
            "paymentStatus": "PAID",
            "email": "klant@example.com",
            "customerName": "Klant Een",
            "items": [
                {"productId": 9992, "name": "Test Reminder Event", "quantity": 1, "price": 79.0, "sku": "TEST"},
            ],
        }
        legacy.save_registration_event_email_settings(
            "id:9992",
            "Test Reminder Event",
            "2026-08-05",
            "",
            "Praktische informatie {product_naam}",
            "Beste {klant_naam},\n\nDit is de eventmail.",
        )
        legacy.set_registration_orders_emailed("id:9992", ["ORDER-1"], True)

        with patch.dict(
            os.environ,
            {"REGISTRATION_AUTO_EMAILS_ENABLED": "1", "REGISTRATION_EMAIL_ONLY_PAID": "1"},
            clear=False,
        ), patch.object(settings, "EMAIL_HOST", "smtp.strato.de"), patch.object(
            settings,
            "EMAIL_HOST_USER",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            settings,
            "EMAIL_HOST_PASSWORD",
            "test-password",
        ), patch.object(
            settings,
            "DEFAULT_FROM_EMAIL",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            legacy,
            "EmailMessage",
        ) as mocked_email_message:
            first_result = legacy.send_registration_reminder_emails(
                [mock_order],
                reminder_date=legacy.parse_iso_date("2026-07-29"),
            )
            second_result = legacy.send_registration_reminder_emails(
                [mock_order],
                reminder_date=legacy.parse_iso_date("2026-07-29"),
            )

        self.assertEqual(first_result["dueProductKeys"], ["id:9992"])
        self.assertEqual(first_result["sentOrderIds"], ["id:9992:ORDER-1"])
        self.assertEqual(second_result["sentOrderIds"], [])
        self.assertEqual(second_result["skippedOrderIds"], ["id:9992:ORDER-1"])
        self.assertEqual(mocked_email_message.call_count, 1)
        self.assertEqual(
            mocked_email_message.call_args.kwargs["subject"],
            "Reminder: Praktische informatie Test Reminder Event",
        )

    def test_registration_reminder_emails_skip_when_original_email_not_sent(self):
        mock_order = {
            "id": "ORDER-2",
            "orderNumber": "ORDER-2",
            "createdAt": "2026-07-01T10:00:00+02:00",
            "status": "PAID",
            "paymentStatus": "PAID",
            "email": "klant@example.com",
            "customerName": "Klant Een",
            "items": [
                {"productId": 9993, "name": "Test Reminder Event", "quantity": 1, "price": 79.0, "sku": "TEST"},
            ],
        }
        legacy.save_registration_event_email_settings(
            "id:9993",
            "Test Reminder Event",
            "2026-08-05",
            "",
            "Praktische informatie",
            "Beste {klant_naam},\n\nDit is de eventmail.",
        )

        with patch.dict(
            os.environ,
            {"REGISTRATION_AUTO_EMAILS_ENABLED": "1", "REGISTRATION_EMAIL_ONLY_PAID": "1"},
            clear=False,
        ), patch.object(settings, "EMAIL_HOST", "smtp.strato.de"), patch.object(
            settings,
            "EMAIL_HOST_USER",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            settings,
            "EMAIL_HOST_PASSWORD",
            "test-password",
        ), patch.object(
            settings,
            "DEFAULT_FROM_EMAIL",
            "info@hwsvoetbalschool.nl",
        ), patch.object(
            legacy,
            "EmailMessage",
        ) as mocked_email_message:
            result = legacy.send_registration_reminder_emails(
                [mock_order],
                reminder_date=legacy.parse_iso_date("2026-07-29"),
            )

        self.assertEqual(result["sentOrderIds"], [])
        self.assertEqual(result["skippedOrderIds"], ["id:9993:ORDER-2"])
        mocked_email_message.assert_not_called()

    def test_registrations_page_redirects_legacy_product_query_to_detail_page(self):
        response = self.build_authenticated_client().get("/aanmeldingen?product=id:101", secure=True)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/aanmeldingen/id:101")

    def test_leads_page_renders_product_email_selection(self):
        legacy.save_blocked_lead_emails("nooit@example.com\nstop@example.com")
        mock_orders = [
            {
                "id": "ORDER-1",
                "orderNumber": "ORDER-1",
                "createdAt": "2026-04-10T10:00:00+02:00",
                "status": "PAID",
                "paymentStatus": "PAID",
                "fulfillmentStatus": "AWAITING_PROCESSING",
                "total": 79.0,
                "email": "klant1@example.com",
                "customerName": "Klant Een",
                "paymentMethod": "iDEAL",
                "shippingMethod": "Digitaal",
                "itemCount": 1,
                "items": [
                    {"productId": 101, "name": "Meivakantie Camp", "quantity": 1, "price": 79.0, "sku": "MVC-1"},
                ],
            },
            {
                "id": "ORDER-2",
                "orderNumber": "ORDER-2",
                "createdAt": "2026-04-11T11:30:00+02:00",
                "status": "PAID",
                "paymentStatus": "PAID",
                "fulfillmentStatus": "AWAITING_PROCESSING",
                "total": 99.0,
                "email": "klant2@example.com",
                "customerName": "Klant Twee",
                "paymentMethod": "iDEAL",
                "shippingMethod": "Digitaal",
                "itemCount": 1,
                "items": [
                    {"productId": 102, "name": "Zomercamp", "quantity": 1, "price": 99.0, "sku": "ZC-1"},
                ],
            },
        ]
        catalog_payload = {
            "items": [
                {"id": "101", "name": "Meivakantie Camp", "sku": "MVC-1", "price": 79.0, "enabled": True},
                {"id": "102", "name": "Zomercamp", "sku": "ZC-1", "price": 99.0, "enabled": True},
            ],
            "source": "ecwid",
        }
        orders_payload = {
            "items": mock_orders,
            "summary": legacy.build_summary(mock_orders),
            "cachedAt": 0.0,
            "source": "ecwid",
        }

        with patch.object(legacy, "fetch_catalog_products", return_value=catalog_payload), patch.object(
            legacy,
            "fetch_ecwid_orders",
            return_value=orders_payload,
        ):
            response = self.build_authenticated_client().get("/leads", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Leads", content)
        self.assertIn("Meivakantie Camp", content)
        self.assertIn("Zomercamp", content)
        self.assertIn('id="copyLeadEmailsButton"', content)
        self.assertIn('id="leadEmailsPreview"', content)
        self.assertIn('id="saveLeadBlockedEmailsButton"', content)
        self.assertIn('data-product-emails=\'["klant1@example.com"]\'', content)
        self.assertIn('data-product-emails=\'["klant2@example.com"]\'', content)
        self.assertIn(">nooit@example.com\nstop@example.com</textarea>", content)

    def test_leads_blocked_emails_api_saves_normalized_list(self):
        client = self.build_authenticated_client()

        response = client.post(
            "/api/leads/blocked-emails",
            data='{"blockedEmails":"Test@Example.com, tweede@example.com\\n test@example.com "}',
            content_type="application/json",
            HTTP_X_CSRF_TOKEN=self.TEST_CSRF_TOKEN,
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["blockedEmails"], "test@example.com\ntweede@example.com")
        self.assertEqual(legacy.load_blocked_lead_emails(), "test@example.com\ntweede@example.com")

    def test_proposal_create_redirects_to_detail_page(self):
        client = self.build_authenticated_client()

        with patch.object(legacy, "create_proposal", return_value=42) as mocked_create:
            response = client.post(
                "/voorstellen-maker",
                {
                    "csrf_token": self.TEST_CSRF_TOKEN,
                    "action": "create_proposal",
                    "club_name": "SV Voorbeeld",
                    "proposal_type": legacy.PROPOSAL_TYPE_OPTIONS[0]["value"],
                    "season_start_year": str(legacy.PROPOSAL_MIN_SEASON_START_YEAR),
                    "price_per_training": "85,00",
                    "line_weekday": [
                        legacy.PROPOSAL_WEEKDAY_OPTIONS[0]["value"],
                        legacy.PROPOSAL_WEEKDAY_OPTIONS[2]["value"],
                    ],
                    "line_time": ["18:00", "19:30"],
                    "line_training_kind": [
                        legacy.PROPOSAL_TRAINING_KIND_OPTIONS[0]["value"],
                        legacy.PROPOSAL_TRAINING_KIND_OPTIONS[1]["value"],
                    ],
                    "line_team": ["JO15-1", "JO17-1"],
                },
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/voorstellen-maker/42?success=Voorstel+opgeslagen.")
        mocked_create.assert_called_once_with(
            "SV Voorbeeld",
            legacy.PROPOSAL_TYPE_OPTIONS[0]["value"],
            legacy.PROPOSAL_MIN_SEASON_START_YEAR,
            "85.00",
            [
                {
                    "weekday": legacy.PROPOSAL_WEEKDAY_OPTIONS[0]["value"],
                    "time": "18:00",
                    "trainingKind": legacy.PROPOSAL_TRAINING_KIND_OPTIONS[0]["value"],
                    "team": "JO15-1",
                },
                {
                    "weekday": legacy.PROPOSAL_WEEKDAY_OPTIONS[2]["value"],
                    "time": "19:30",
                    "trainingKind": legacy.PROPOSAL_TRAINING_KIND_OPTIONS[1]["value"],
                    "team": "JO17-1",
                },
            ],
        )

    def test_validate_proposal_input_requires_complete_line_with_time_kind_and_team(self):
        payload, error = legacy.validate_proposal_input(
            "SV Voorbeeld",
            legacy.PROPOSAL_TYPE_OPTIONS[0]["value"],
            str(legacy.PROPOSAL_MIN_SEASON_START_YEAR),
            "85,00",
            [
                {
                    "weekday": legacy.PROPOSAL_WEEKDAY_OPTIONS[0]["value"],
                    "time": "18:00",
                    "trainingKind": "",
                    "team": "JO15-1",
                }
            ],
        )

        self.assertIsNone(payload)
        self.assertEqual(error, "Vul per regel dag, tijd, soort en team in.")

    def test_proposal_delete_redirects_to_overview_page(self):
        client = self.build_authenticated_client()

        with patch.object(legacy, "delete_proposal") as mocked_delete:
            response = client.post(
                "/voorstellen-maker",
                {
                    "csrf_token": self.TEST_CSRF_TOKEN,
                    "action": "delete_proposal",
                    "proposal_id": "42",
                },
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/voorstellen-maker?success=Voorstel+verwijderd.")
        mocked_delete.assert_called_once_with(42)

    def test_proposal_builder_page_renders_script_nonce_for_inline_logic(self):
        response = self.build_authenticated_client().get("/voorstellen-maker", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn('<script nonce="', content)
        self.assertIn('id="addProposalLineButton"', content)

    def test_forwarded_grouped_budget_rows_keep_one_group_in_trainer_planning(self):
        rows = [
            {
                "trainingType": "Samenwerkende amateurclub",
                "club": "VV Gorssel",
                "activityTitle": "JO11-1",
                "trainerAmount": "45.00",
                "trainerGroup": "avond-test",
                "trainerId": "trainer-1",
            },
            {
                "trainingType": "Samenwerkende amateurclub",
                "club": "VV Gorssel",
                "activityTitle": "JO11-2",
                "trainerAmount": "",
                "trainerGroup": "avond-test",
                "trainerId": "trainer-1",
            },
        ]
        activity_options = [
            {
                "key": legacy.build_budget_activity_key(row["trainingType"], row["club"], row["activityTitle"]),
                "scheduleSlots": [{"weekday": "maandag", "startTime": start_time}],
            }
            for row, start_time in zip(rows, ["17:15", "18:30"])
        ]

        with (
            patch.object(legacy, "build_budget_activity_options", return_value=activity_options),
            patch.object(legacy, "load_trainer_profiles", return_value=[{"id": "trainer-1", "trainerFees": []}]),
            patch.object(legacy, "update_trainer_fee_rows") as mocked_update,
        ):
            added, skipped = legacy.forward_budget_rows_to_trainer_profiles(rows, {0}, 2026)

        self.assertEqual((added, skipped), (2, 0))
        forwarded_rows = mocked_update.call_args.args[1]
        self.assertEqual([row["group"] for row in forwarded_rows], ["avond-test", "avond-test"])
        self.assertEqual([row["amount"] for row in forwarded_rows], ["45.00", "45.00"])

    def test_proposal_training_counts_api_counts_only_matching_agenda_days_in_selected_season(self):
        client = self.build_authenticated_client()
        target_dates = [
            "2026-07-06",
            "2026-07-08",
            "2026-07-10",
            "2027-06-25",
            "2027-07-02",
        ]
        training_ids = [
            "proposal-training-count-test-1",
            "proposal-training-count-test-2",
        ]

        with legacy.get_db_connection() as connection:
            connection.execute(
                f"DELETE FROM agenda_day_plans WHERE date IN ({', '.join(['?'] * len(target_dates))})",
                target_dates,
            )
            connection.executemany(
                """
                INSERT INTO agenda_day_plans (date, plan_type, updated_at)
                VALUES (?, ?, ?)
                """,
                [
                    ("2026-07-06", "Samenwerkende amateurclubs", "2026-04-19T12:00:00"),
                    ("2026-07-08", "Samenwerkende amateurclubs", "2026-04-19T12:00:00"),
                    ("2026-07-10", "Techniektrainingen", "2026-04-19T12:00:00"),
                    ("2027-06-25", "Samenwerkende amateurclubs", "2026-04-19T12:00:00"),
                    ("2027-07-02", "Samenwerkende amateurclubs", "2026-04-19T12:00:00"),
                ],
            )
            connection.executemany(
                """
                INSERT INTO agenda_trainings (id, title, date, time, end_time, location, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        training_ids[0],
                        "Losse techniektraining die niet mag meetellen",
                        "2026-07-13",
                        "18:00",
                        "19:00",
                        "",
                        "",
                    ),
                    (
                        training_ids[1],
                        "Losse amateurclubtraining die niet mag meetellen",
                        "2026-07-15",
                        "18:00",
                        "19:00",
                        "",
                        "",
                    ),
                ],
            )

        try:
            amateurclub_response = client.get(
                "/api/voorstellen-maker/training-counts",
                {
                    "proposal_type": legacy.PROPOSAL_TYPE_OPTIONS[0]["value"],
                    "season_start_year": "2026",
                },
                secure=True,
            )
            techniek_response = client.get(
                "/api/voorstellen-maker/training-counts",
                {
                    "proposal_type": legacy.PROPOSAL_TYPE_OPTIONS[1]["value"],
                    "season_start_year": "2026",
                },
                secure=True,
            )

            self.assertEqual(amateurclub_response.status_code, 200)
            self.assertEqual(
                amateurclub_response.json()["weekdayCounts"],
                {
                    "monday": 1,
                    "tuesday": 0,
                    "wednesday": 1,
                    "thursday": 0,
                    "friday": 1,
                    "saturday": 0,
                    "sunday": 0,
                },
            )
            self.assertEqual(amateurclub_response.json()["totalTrainings"], 3)

            self.assertEqual(techniek_response.status_code, 200)
            self.assertEqual(
                techniek_response.json()["weekdayCounts"],
                {
                    "monday": 0,
                    "tuesday": 0,
                    "wednesday": 0,
                    "thursday": 0,
                    "friday": 1,
                    "saturday": 0,
                    "sunday": 0,
                },
            )
            self.assertEqual(techniek_response.json()["totalTrainings"], 1)
        finally:
            with legacy.get_db_connection() as connection:
                connection.execute(
                    f"DELETE FROM agenda_day_plans WHERE date IN ({', '.join(['?'] * len(target_dates))})",
                    target_dates,
                )
                connection.execute(
                    f"DELETE FROM agenda_trainings WHERE id IN ({', '.join(['?'] * len(training_ids))})",
                    training_ids,
                )

    def test_admin_sees_all_accounts_on_team_page(self):
        extra_profiles = [
            (
                "trainer-extra-admin-test-1",
                "Anne de Vries",
                "anne@example.com",
                "anne.de.vries",
                None,
                None,
                None,
                None,
                "Social media beheerder",
                "Medewerker",
                "Social media beheerder",
                "",
                "",
                "",
                "",
                "",
                0,
                "Uitgenodigd",
                "2026-04-19T10:00:00",
            ),
            (
                "trainer-extra-admin-test-2",
                "Milan Jansen",
                "milan@example.com",
                "milan.jansen",
                None,
                None,
                None,
                None,
                "Admin",
                "Medewerker",
                "Admin",
                "",
                "",
                "",
                "",
                "",
                1,
                "Actief",
                "2026-04-19T11:00:00",
            ),
        ]
        with legacy.get_db_connection() as connection:
            connection.executemany(
                """
                INSERT INTO trainer_profiles (
                    id, full_name, email, username, password_hash, invite_token, invite_expires_at, invite_accepted_at,
                    role, member_type, system_role, knvb_license, education, availability_days, phone, notes, is_admin, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                extra_profiles,
            )

        try:
            response = self.build_authenticated_client().get("/trainers", secure=True)

            self.assertEqual(response.status_code, 200)
            content = response.content.decode("utf-8")
            self.assertIn("Anne de Vries", content)
            self.assertIn("Milan Jansen", content)
            self.assertIn("3 totaal", content)
            self.assertIn("1 uitgenodigd", content)
        finally:
            with legacy.get_db_connection() as connection:
                connection.execute(
                    "DELETE FROM trainer_profiles WHERE id IN (?, ?)",
                    ("trainer-extra-admin-test-1", "trainer-extra-admin-test-2"),
                )

    def test_content_page_repairs_orphan_albums_for_admin_visibility(self):
        album_id = 99999
        with legacy.get_db_connection() as connection:
            connection.execute("DELETE FROM content_photos WHERE album_id = ?", (album_id,))
            connection.execute("DELETE FROM content_albums WHERE id = ?", (album_id,))
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
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    album_id,
                    "/static/uploads/content/2026-04-19/99999-admin-debug-check/test.jpg",
                    "content/2026-04-19/99999-admin-debug-check/test.jpg",
                    "test.jpg",
                    "test.jpg",
                    "image/jpeg",
                    1234,
                    "local",
                    "2026-04-19T12:00:00",
                ),
            )

        try:
            response = self.build_authenticated_client().get("/content", secure=True)

            self.assertEqual(response.status_code, 200)
            content = response.content.decode("utf-8")
            self.assertIn("Admin Debug Check", content)
            self.assertIn("automatisch hersteld", content)

            repaired_album = legacy.load_content_album(album_id)
            self.assertIsNotNone(repaired_album)
            self.assertEqual(repaired_album["title"], "Admin Debug Check")
        finally:
            with legacy.get_db_connection() as connection:
                connection.execute("DELETE FROM content_photos WHERE album_id = ?", (album_id,))
                connection.execute("DELETE FROM content_albums WHERE id = ?", (album_id,))

    def test_sync_seed_workspace_data_restores_missing_team_profiles(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            seed_dir = os.path.join(temp_dir, "seed")
            live_dir = os.path.join(temp_dir, "live")
            os.makedirs(seed_dir, exist_ok=True)
            os.makedirs(live_dir, exist_ok=True)

            seed_db_path = os.path.join(seed_dir, "app.db")
            live_db_path = os.path.join(live_dir, "app.db")
            trainer_schema = next(
                row["sql"]
                for row in legacy.get_db_connection().execute(
                    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'trainer_profiles'"
                ).fetchall()
                if row["sql"]
            )

            with sqlite3.connect(seed_db_path) as seed_connection:
                seed_connection.execute(trainer_schema)
                seed_connection.execute(
                    """
                    INSERT INTO trainer_profiles (
                        id, full_name, email, username, role, phone, notes, status, created_at,
                        password_hash, is_admin, member_type, system_role, knvb_license,
                        education, availability_days, invite_token, invite_expires_at, invite_accepted_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "trainer-seed-tijn",
                        "Tijn ten Bloemendal",
                        "tijn@example.com",
                        "tijn.ten.bloemendal",
                        "Social media beheerder",
                        "",
                        "",
                        "Actief",
                        "2026-04-19T12:00:00",
                        "",
                        0,
                        "Medewerker",
                        "Social media beheerder",
                        "",
                        "",
                        "",
                        None,
                        None,
                        None,
                    ),
                )

            with sqlite3.connect(live_db_path) as live_connection:
                live_connection.execute(trainer_schema)

            original_data_dir = legacy.DATA_DIR
            original_bundled_data_dir = legacy.BUNDLED_DATA_DIR
            original_database_path = legacy.DATABASE_PATH
            original_dashboard_events_path = legacy.DASHBOARD_EVENTS_PATH
            original_agenda_trainings_path = legacy.AGENDA_TRAININGS_PATH
            try:
                legacy.BUNDLED_DATA_DIR = seed_dir
                legacy.DATA_DIR = live_dir
                legacy.DATABASE_PATH = live_db_path
                legacy.DASHBOARD_EVENTS_PATH = os.path.join(live_dir, "dashboard_events.json")
                legacy.AGENDA_TRAININGS_PATH = os.path.join(live_dir, "agenda_trainings.json")

                legacy.sync_seed_workspace_data()

                with sqlite3.connect(live_db_path) as live_connection:
                    row = live_connection.execute(
                        "SELECT full_name FROM trainer_profiles WHERE email = ?",
                        ("tijn@example.com",),
                    ).fetchone()

                self.assertIsNotNone(row)
                self.assertEqual(row[0], "Tijn ten Bloemendal")
            finally:
                legacy.DATA_DIR = original_data_dir
                legacy.BUNDLED_DATA_DIR = original_bundled_data_dir
                legacy.DATABASE_PATH = original_database_path
                legacy.DASHBOARD_EVENTS_PATH = original_dashboard_events_path
                legacy.AGENDA_TRAININGS_PATH = original_agenda_trainings_path

    def test_sync_seed_workspace_data_restores_missing_content_albums(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            seed_dir = os.path.join(temp_dir, "seed")
            live_dir = os.path.join(temp_dir, "live")
            os.makedirs(seed_dir, exist_ok=True)
            os.makedirs(live_dir, exist_ok=True)

            seed_db_path = os.path.join(seed_dir, "app.db")
            live_db_path = os.path.join(live_dir, "app.db")
            with legacy.get_db_connection() as connection:
                table_sql = {
                    str(row["name"]): str(row["sql"])
                    for row in connection.execute(
                        """
                        SELECT name, sql
                        FROM sqlite_master
                        WHERE type = 'table' AND name IN ('content_albums', 'content_photos')
                        """
                    ).fetchall()
                    if row["sql"]
                }

            with sqlite3.connect(seed_db_path) as seed_connection:
                seed_connection.execute(table_sql["content_albums"])
                seed_connection.execute(table_sql["content_photos"])
                seed_connection.execute(
                    """
                    INSERT INTO content_albums (id, title, slug, created_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (21, "Tijn Album", "tijn-album", "2026-04-19T12:00:00"),
                )
                seed_connection.execute(
                    """
                    INSERT INTO content_photos (
                        album_id, image_url, remote_path, file_name, original_name,
                        content_type, file_size, storage_backend, uploaded_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        21,
                        "/static/uploads/content/2026-04-19/tijn-album/cover.jpg",
                        "content/2026-04-19/tijn-album/cover.jpg",
                        "cover.jpg",
                        "cover.jpg",
                        "image/jpeg",
                        4096,
                        "local",
                        "2026-04-19T12:00:00",
                    ),
                )

            with sqlite3.connect(live_db_path) as live_connection:
                live_connection.execute(table_sql["content_albums"])
                live_connection.execute(table_sql["content_photos"])

            original_data_dir = legacy.DATA_DIR
            original_bundled_data_dir = legacy.BUNDLED_DATA_DIR
            original_database_path = legacy.DATABASE_PATH
            original_dashboard_events_path = legacy.DASHBOARD_EVENTS_PATH
            original_agenda_trainings_path = legacy.AGENDA_TRAININGS_PATH
            try:
                legacy.BUNDLED_DATA_DIR = seed_dir
                legacy.DATA_DIR = live_dir
                legacy.DATABASE_PATH = live_db_path
                legacy.DASHBOARD_EVENTS_PATH = os.path.join(live_dir, "dashboard_events.json")
                legacy.AGENDA_TRAININGS_PATH = os.path.join(live_dir, "agenda_trainings.json")

                legacy.sync_seed_workspace_data()

                with sqlite3.connect(live_db_path) as live_connection:
                    album_row = live_connection.execute(
                        "SELECT id, title FROM content_albums WHERE slug = ?",
                        ("tijn-album",),
                    ).fetchone()
                    photo_row = live_connection.execute(
                        """
                        SELECT remote_path
                        FROM content_photos
                        WHERE album_id = ?
                        """,
                        (album_row[0],),
                    ).fetchone()

                self.assertIsNotNone(album_row)
                self.assertEqual(album_row[1], "Tijn Album")
                self.assertIsNotNone(photo_row)
                self.assertEqual(photo_row[0], "content/2026-04-19/tijn-album/cover.jpg")
            finally:
                legacy.DATA_DIR = original_data_dir
                legacy.BUNDLED_DATA_DIR = original_bundled_data_dir
                legacy.DATABASE_PATH = original_database_path
                legacy.DASHBOARD_EVENTS_PATH = original_dashboard_events_path
                legacy.AGENDA_TRAININGS_PATH = original_agenda_trainings_path

    def test_save_agenda_day_plans_persists_to_database(self):
        target_dates = ["2026-04-20", "2026-04-21"]
        with legacy.get_db_connection() as connection:
            connection.execute("DELETE FROM agenda_day_plans WHERE date IN (?, ?)", target_dates)

        try:
            legacy.save_agenda_day_plans(
                {
                    "2026-04-20": "Voetbaldag",
                    "2026-04-21": "Techniektrainingen",
                }
            )

            self.assertEqual(
                legacy.load_agenda_day_plans(target_dates),
                {
                    "2026-04-20": "Voetbaldag",
                    "2026-04-21": "Techniektrainingen",
                },
            )
        finally:
            with legacy.get_db_connection() as connection:
                connection.execute("DELETE FROM agenda_day_plans WHERE date IN (?, ?)", target_dates)

    def test_save_agenda_day_plans_clears_removed_values_with_replace_dates(self):
        target_dates = ["2026-04-22", "2026-04-23"]
        with legacy.get_db_connection() as connection:
            connection.execute("DELETE FROM agenda_day_plans WHERE date IN (?, ?)", target_dates)
            connection.executemany(
                """
                INSERT INTO agenda_day_plans (date, plan_type, updated_at)
                VALUES (?, ?, ?)
                """,
                [
                    ("2026-04-22", "Voetbaldag", "2026-04-19T12:00:00"),
                    ("2026-04-23", "Techniektrainingen", "2026-04-19T12:00:00"),
                ],
            )

        try:
            legacy.save_agenda_day_plans(
                {"2026-04-22": "Geen activiteit"},
                replace_dates=target_dates,
            )

            self.assertEqual(
                legacy.load_agenda_day_plans(target_dates),
                {"2026-04-22": "Geen activiteit"},
            )
        finally:
            with legacy.get_db_connection() as connection:
                connection.execute("DELETE FROM agenda_day_plans WHERE date IN (?, ?)", target_dates)

    def test_agenda_page_renders_saved_day_plan(self):
        monday_date = legacy.date.today() - legacy.timedelta(days=legacy.date.today().weekday())
        monday = monday_date.isoformat()
        with legacy.get_db_connection() as connection:
            connection.execute("DELETE FROM agenda_day_plans WHERE date = ?", (monday,))
            connection.execute(
                """
                INSERT INTO agenda_day_plans (date, plan_type, updated_at)
                VALUES (?, ?, ?)
                """,
                (monday, "Samenwerkende amateurclubs", "2026-04-19T12:00:00"),
            )

        try:
            response = self.build_authenticated_client().get("/agenda?week=0", secure=True)

            self.assertEqual(response.status_code, 200)
            content = response.content.decode("utf-8")
            self.assertIn("Samenwerkende amateurclubs", content)
            self.assertIn("Dagplanning bewerken", content)
            self.assertIn("data-day-plan-dropzone=", content)
        finally:
            with legacy.get_db_connection() as connection:
                connection.execute("DELETE FROM agenda_day_plans WHERE date = ?", (monday,))

    def test_agenda_page_renders_external_labels_server_side(self):
        monday_date = legacy.date.today() - legacy.timedelta(days=legacy.date.today().weekday())
        monday = monday_date.isoformat()
        school_year = f"{monday_date.year}-{monday_date.year + 1}"

        with patch.object(
            legacy,
            "fetch_school_holidays_for_schoolyear",
            return_value={
                "items": [
                    {
                        "date": monday,
                        "label": "Meivakantie",
                        "schoolyear": school_year,
                        "region": "heel nederland",
                    }
                ]
            },
        ), patch.object(
            legacy,
            "fetch_public_holidays_for_year",
            return_value={
                "items": [
                    {
                        "date": monday,
                        "label": "Koningsdag",
                        "localName": "Koningsdag",
                        "name": "King's Day",
                    }
                ]
            },
        ):
            response = self.build_authenticated_client().get("/agenda?week=0", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Meivakantie (heel Nederland)", content)
        self.assertIn("Koningsdag", content)
        self.assertIn("agenda-day-external-label", content)

    def test_agenda_month_view_renders_day_plan_and_external_labels(self):
        today = legacy.date.today()
        month_start = today.replace(day=1)
        visible_date = month_start.isoformat()
        school_year = f"{month_start.year}-{month_start.year + 1}"

        with legacy.get_db_connection() as connection:
            connection.execute("DELETE FROM agenda_day_plans WHERE date = ?", (visible_date,))
            connection.execute(
                """
                INSERT INTO agenda_day_plans (date, plan_type, updated_at)
                VALUES (?, ?, ?)
                """,
                (visible_date, "Voetbaldag", "2026-04-19T12:00:00"),
            )

        with patch.object(
            legacy,
            "fetch_school_holidays_for_schoolyear",
            return_value={
                "items": [
                    {
                        "date": visible_date,
                        "label": "Meivakantie",
                        "schoolyear": school_year,
                        "region": "heel nederland",
                    }
                ]
            },
        ), patch.object(
            legacy,
            "fetch_public_holidays_for_year",
            return_value={
                "items": [
                    {
                        "date": visible_date,
                        "label": "Dag van de Arbeid",
                        "localName": "Dag van de Arbeid",
                        "name": "Labour Day",
                    }
                ]
            },
        ):
            response = self.build_authenticated_client().get("/agenda?view=month&month=0", secure=True)

        try:
            self.assertEqual(response.status_code, 200)
            content = response.content.decode("utf-8")
            self.assertIn("agenda-month-grid", content)
            self.assertIn("Voetbaldag", content)
            self.assertIn("Meivakantie (heel Nederland)", content)
            self.assertIn("Dag van de Arbeid", content)
        finally:
            with legacy.get_db_connection() as connection:
                connection.execute("DELETE FROM agenda_day_plans WHERE date = ?", (visible_date,))

    def test_agenda_page_renders_summary_filter_controls(self):
        response = self.build_authenticated_client().get("/agenda?summary_filter=season_2026_2027", secure=True)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Overzicht dagplanning", content)
        self.assertIn("Totaal", content)
        self.assertIn("Seizoen 2026/2027", content)
        self.assertIn("Maandag 24 augustus 2026 t/m zondag 13 juni 2027", content)
        self.assertIn("summary_filter=season_2026_2027", content)


class AgendaDayPlanSummaryTests(SimpleTestCase):
    def test_filter_agenda_day_plans_for_summary_keeps_only_days_inside_season(self):
        filtered_day_plans = legacy.filter_agenda_day_plans_for_summary(
            [
                {"date": "2026-08-23", "planType": "Geen activiteit"},
                {"date": "2026-08-24", "planType": "Geen activiteit"},
                {"date": "2027-06-13", "planType": "Voetbaldag"},
                {"date": "2027-06-14", "planType": "Techniektrainingen"},
            ],
            "season_2026_2027",
        )

        self.assertEqual(
            filtered_day_plans,
            [
                {"date": "2026-08-24", "planType": "Geen activiteit"},
                {"date": "2027-06-13", "planType": "Voetbaldag"},
            ],
        )

    def test_filtered_agenda_summary_copy_text_uses_only_filtered_days(self):
        filtered_day_plans = legacy.filter_agenda_day_plans_for_summary(
            [
                {"date": "2026-08-23", "planType": "Voetbaldag"},
                {"date": "2026-08-24", "planType": "Voetbaldag"},
                {"date": "2027-06-13", "planType": "Voetbaldag"},
                {"date": "2027-06-14", "planType": "Voetbaldag"},
            ],
            "season_2026_2027",
        )

        summary_by_label = {
            item["label"]: item
            for item in legacy.build_agenda_day_plan_summary(filtered_day_plans)
        }

        copy_texts_by_weekday = {
            detail["label"]: detail["copyText"]
            for detail in summary_by_label["Voetbaldag"]["details"]
        }

        self.assertEqual(copy_texts_by_weekday["Maandag"], "1. Maandag 24 augustus 2026")
        self.assertEqual(copy_texts_by_weekday["Zondag"], "1. Zondag 13 juni 2027")

    def test_build_agenda_day_plan_summary_counts_all_saved_days_per_weekday(self):
        summary = legacy.build_agenda_day_plan_summary(
            [
                {"date": "2026-07-06", "planType": "Geen activiteit"},
                {"date": "2026-07-08", "planType": "Geen activiteit"},
                {"date": "2026-07-13", "planType": "Geen activiteit"},
                {"date": "2026-07-07", "planType": "Voetbaldag"},
                {"date": "2026-07-14", "planType": "Voetbaldag"},
                {"date": "2026-07-06", "planType": "Samenwerkende amateurclubs"},
                {"date": "2026-07-08", "planType": "Samenwerkende amateurclubs"},
                {"date": "2026-07-10", "planType": "Techniektrainingen"},
                {"date": "2026-07-17", "planType": "Techniektrainingen"},
            ]
        )

        self.assertEqual(
            summary,
            [
                {
                    "label": "Geen activiteit",
                    "count": 3,
                    "details": [
                        {
                            "label": "Maandag",
                            "count": 2,
                            "days": [
                                {"date": "2026-07-06", "label": "Maandag 6 juli 2026"},
                                {"date": "2026-07-13", "label": "Maandag 13 juli 2026"},
                            ],
                            "copyText": "1. Maandag 6 juli 2026\n2. Maandag 13 juli 2026",
                        },
                        {
                            "label": "Woensdag",
                            "count": 1,
                            "days": [
                                {"date": "2026-07-08", "label": "Woensdag 8 juli 2026"},
                            ],
                            "copyText": "1. Woensdag 8 juli 2026",
                        },
                    ],
                },
                {
                    "label": "Voetbaldag",
                    "count": 2,
                    "details": [
                        {
                            "label": "Dinsdag",
                            "count": 2,
                            "days": [
                                {"date": "2026-07-07", "label": "Dinsdag 7 juli 2026"},
                                {"date": "2026-07-14", "label": "Dinsdag 14 juli 2026"},
                            ],
                            "copyText": "1. Dinsdag 7 juli 2026\n2. Dinsdag 14 juli 2026",
                        },
                    ],
                },
                {
                    "label": "Samenwerkende amateurclubs",
                    "count": 2,
                    "details": [
                        {
                            "label": "Maandag",
                            "count": 1,
                            "days": [
                                {"date": "2026-07-06", "label": "Maandag 6 juli 2026"},
                            ],
                            "copyText": "1. Maandag 6 juli 2026",
                        },
                        {
                            "label": "Woensdag",
                            "count": 1,
                            "days": [
                                {"date": "2026-07-08", "label": "Woensdag 8 juli 2026"},
                            ],
                            "copyText": "1. Woensdag 8 juli 2026",
                        },
                    ],
                },
                {
                    "label": "Techniektrainingen",
                    "count": 2,
                    "details": [
                        {
                            "label": "Vrijdag",
                            "count": 2,
                            "days": [
                                {"date": "2026-07-10", "label": "Vrijdag 10 juli 2026"},
                                {"date": "2026-07-17", "label": "Vrijdag 17 juli 2026"},
                            ],
                            "copyText": "1. Vrijdag 10 juli 2026\n2. Vrijdag 17 juli 2026",
                        },
                    ],
                },
            ],
        )
