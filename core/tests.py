import io
import re
import time
from importlib import import_module
from unittest.mock import patch

from django.conf import settings
from django.test import Client, SimpleTestCase

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
