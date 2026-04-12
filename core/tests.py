from importlib import import_module
from unittest.mock import patch

from django.conf import settings
from django.test import Client, SimpleTestCase

import app as legacy


class LegacyDjangoSmokeTests(SimpleTestCase):
    def build_authenticated_client(self) -> Client:
        client = Client()
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = legacy.load_trainer_profiles()[0]["id"]
        session_store.save()
        client.cookies[settings.SESSION_COOKIE_NAME] = session_store.session_key
        client.cookies[settings.SESSION_COOKIE_NAME]["secure"] = settings.SESSION_COOKIE_SECURE
        return client

    def test_login_page_renders(self):
        response = Client().get("/login")

        self.assertEqual(response.status_code, 200)
        self.assertIn("HWS Voetbalschool", response.content.decode("utf-8"))

    def test_dashboard_events_api_requires_only_legacy_session(self):
        response = self.build_authenticated_client().get("/api/dashboard-events", secure=True)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"][0]["label"], legacy.load_dashboard_events_config()[0]["label"])

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
