import io
import os
import re
import sqlite3
import tempfile
import time
from importlib import import_module
from unittest.mock import patch

from django.conf import settings
from django.test import Client, SimpleTestCase
from openpyxl import load_workbook

import app as legacy


class LegacyDjangoSmokeTests(SimpleTestCase):
    TEST_CSRF_TOKEN = "test-csrf-token-value-with-sufficient-length-1234567890"

    def tearDown(self):
        with legacy.get_db_connection() as connection:
            connection.execute("DELETE FROM rate_limit_attempts")
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

    def test_login_requires_valid_csrf_token(self):
        response = Client(enforce_csrf_checks=False).post(
            "/login",
            {"email": "admin@example.com", "password": "wrong-password"},
            secure=True,
        )

        self.assertEqual(response.status_code, 403)

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

    def test_session_timeout_redirects_to_login(self):
        client = Client()
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = legacy.load_trainer_profiles()[0]["id"]
        session_store["csrf_token"] = self.TEST_CSRF_TOKEN
        session_store["session_started_at"] = int(time.time()) - (legacy.SESSION_ABSOLUTE_TIMEOUT_SECONDS + 10)
        session_store["session_last_seen_at"] = int(time.time()) - (legacy.SESSION_IDLE_TIMEOUT_SECONDS + 10)
        session_store.save()
        client.cookies[settings.SESSION_COOKIE_NAME] = session_store.session_key

        response = client.get("/", secure=True)

        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith("/login"))

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

    def test_orders_page_filters_results(self):
        mock_payload = {
            "items": legacy.mock_orders(),
            "summary": legacy.build_summary(legacy.mock_orders()),
            "cachedAt": 0.0,
            "source": "mock",
        }
        with patch.object(legacy, "fetch_ecwid_orders", return_value=mock_payload):
            response = self.build_authenticated_client().get(
                "/bestellingen",
                {"q": "Anne", "status": "PAID"},
                secure=True,
            )

        self.assertEqual(response.status_code, 200)
        content = response.content.decode("utf-8")
        self.assertIn("Anne de Vries", content)
        self.assertNotIn("Milan Jansen", content)

    def test_team_assignment_export_returns_excel_for_selected_orders(self):
        client = self.build_authenticated_client()
        mock_payload = {
            "items": legacy.mock_orders(),
            "summary": legacy.build_summary(legacy.mock_orders()),
            "cachedAt": 0.0,
            "source": "mock",
        }
        with patch.object(legacy, "fetch_ecwid_orders", return_value=mock_payload):
            response = client.post(
                "/bestellingen/teamindeling-export",
                {
                    "csrf_token": self.TEST_CSRF_TOKEN,
                    "selected_order_ids": "WEB-1001,WEB-1002",
                },
                secure=True,
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        workbook = load_workbook(filename=io.BytesIO(response.content))
        worksheet = workbook["Teamindeling"]

        self.assertEqual(worksheet["A1"].value, "Teamindeling geselecteerde bestellingen")
        self.assertEqual(worksheet["A4"].value, "Datum")
        self.assertEqual(worksheet["H4"].value, "Team")
        self.assertEqual(worksheet["C5"].value, "Anne de Vries")

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
                    "line_weekday": [legacy.PROPOSAL_WEEKDAY_OPTIONS[0]["value"]],
                    "line_activity": ["Techniektraining onderbouw"],
                },
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/voorstellen-maker/42?success=Voorstel+opgeslagen.")
        mocked_create.assert_called_once()

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
                        {"label": "Maandag", "count": 2},
                        {"label": "Woensdag", "count": 1},
                    ],
                },
                {
                    "label": "Voetbaldag",
                    "count": 2,
                    "details": [
                        {"label": "Dinsdag", "count": 2},
                    ],
                },
                {
                    "label": "Samenwerkende amateurclubs",
                    "count": 2,
                    "details": [
                        {"label": "Maandag", "count": 1},
                        {"label": "Woensdag", "count": 1},
                    ],
                },
                {
                    "label": "Techniektrainingen",
                    "count": 2,
                    "details": [
                        {"label": "Vrijdag", "count": 2},
                    ],
                },
            ],
        )
