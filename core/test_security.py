import os
import re
import sqlite3
import tempfile
import time
from datetime import datetime, timedelta
from importlib import import_module
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.contrib.sessions.middleware import SessionMiddleware
from django.test import Client, RequestFactory, SimpleTestCase

import app as legacy
from core.legacy_compat import request_context


class AuthenticationSecurityTests(SimpleTestCase):
    csrf_token = "security-test-csrf-token-with-sufficient-length-1234567890"

    def setUp(self):
        self.factory = RequestFactory()

    def build_request(self, path="/", *, started_at=None, last_seen_at=None):
        request = self.factory.get(path, secure=True)
        SessionMiddleware(lambda current_request: None).process_request(request)
        request.session["user_id"] = "security-test-user"
        request.session["csrf_token"] = self.csrf_token
        if started_at is not None:
            request.session["session_started_at"] = started_at
        if last_seen_at is not None:
            request.session["session_last_seen_at"] = last_seen_at
        return request

    def test_idle_session_timeout_clears_authentication(self):
        now = int(time.time())
        request = self.build_request(
            started_at=now - 60,
            last_seen_at=now - legacy.SESSION_IDLE_TIMEOUT_SECONDS,
        )

        with request_context(request):
            response = legacy.handle_session_timeout()

        self.assertEqual(response.status_code, 302)
        self.assertIn("session_expired=1", response["Location"])
        self.assertNotIn("user_id", request.session)
        self.assertIn("csrf_token", request.session)

    def test_absolute_session_timeout_applies_even_when_recently_active(self):
        now = int(time.time())
        request = self.build_request(
            started_at=now - legacy.SESSION_ABSOLUTE_TIMEOUT_SECONDS,
            last_seen_at=now - 1,
        )

        with request_context(request):
            response = legacy.handle_session_timeout()

        self.assertEqual(response.status_code, 302)
        self.assertNotIn("user_id", request.session)

    def test_active_session_updates_last_seen_without_resetting_start(self):
        now = int(time.time())
        started_at = now - 600
        request = self.build_request(started_at=started_at, last_seen_at=now - 60)

        with patch.object(legacy.time, "time", return_value=now), request_context(request):
            response = legacy.handle_session_timeout()

        self.assertIsNone(response)
        self.assertEqual(request.session["session_started_at"], started_at)
        self.assertEqual(request.session["session_last_seen_at"], now)

    def test_pre_timestamp_session_is_migrated_to_bounded_timestamps(self):
        now = int(time.time())
        request = self.build_request()

        with patch.object(legacy.time, "time", return_value=now), request_context(request):
            response = legacy.handle_session_timeout()

        self.assertIsNone(response)
        self.assertEqual(request.session["session_started_at"], now)
        self.assertEqual(request.session["session_last_seen_at"], now)

    def test_login_cycles_django_session_key_and_invalidates_old_record(self):
        client = Client()
        login_response = client.get("/login", secure=True)
        csrf_match = re.search(r'name="csrf_token" value="([^"]+)"', login_response.content.decode("utf-8"))
        self.assertIsNotNone(csrf_match)
        old_session_key = client.cookies[settings.SESSION_COOKIE_NAME].value
        fake_user = {"id": "rotated-session-user", "isAdmin": True}

        with (
            patch.object(legacy, "authenticate_user", return_value=fake_user),
            patch.object(legacy, "get_rate_limit_rule", return_value=None),
        ):
            response = client.post(
                "/login",
                {
                    "csrf_token": csrf_match.group(1),
                    "email": "admin@example.com",
                    "password": "valid-password",
                },
                secure=True,
            )

        new_session_key = client.cookies[settings.SESSION_COOKIE_NAME].value
        old_session = import_module(settings.SESSION_ENGINE).SessionStore(session_key=old_session_key)
        self.assertEqual(response.status_code, 302)
        self.assertNotEqual(new_session_key, old_session_key)
        self.assertFalse(old_session.exists(old_session_key))
        self.assertEqual(client.session["user_id"], "rotated-session-user")
        self.assertEqual(
            int(response.cookies[settings.SESSION_COOKIE_NAME]["max-age"]),
            settings.SESSION_COOKIE_AGE,
        )
        self.assertTrue(response.cookies[settings.SESSION_COOKIE_NAME]["expires"])

    def test_timeout_flushes_old_key_before_creating_anonymous_session(self):
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = "expired-session-user"
        session_store["csrf_token"] = self.csrf_token
        session_store["session_started_at"] = int(time.time()) - legacy.SESSION_ABSOLUTE_TIMEOUT_SECONDS
        session_store["session_last_seen_at"] = int(time.time())
        session_store.save()
        old_session_key = session_store.session_key
        client = Client()
        client.cookies[settings.SESSION_COOKIE_NAME] = old_session_key

        response = client.get("/", secure=True)

        new_session_key = client.cookies[settings.SESSION_COOKIE_NAME].value
        old_session = import_module(settings.SESSION_ENGINE).SessionStore(session_key=old_session_key)
        self.assertEqual(response.status_code, 302)
        self.assertNotEqual(new_session_key, old_session_key)
        self.assertFalse(old_session.exists(old_session_key))
        self.assertNotIn("user_id", client.session)

    def test_logout_flushes_server_session_and_expires_cookie(self):
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = "logout-session-user"
        session_store["csrf_token"] = self.csrf_token
        session_store["session_started_at"] = int(time.time())
        session_store["session_last_seen_at"] = int(time.time())
        session_store.save()
        old_session_key = session_store.session_key
        client = Client()
        client.cookies[settings.SESSION_COOKIE_NAME] = old_session_key
        fake_user = {"id": "logout-session-user", "isAdmin": True}

        with patch.object(legacy, "get_user_by_id", return_value=fake_user):
            response = client.post(
                "/logout",
                {"csrf_token": self.csrf_token},
                secure=True,
            )

        old_session = import_module(settings.SESSION_ENGINE).SessionStore(session_key=old_session_key)
        self.assertEqual(response.status_code, 302)
        self.assertFalse(old_session.exists(old_session_key))
        self.assertEqual(response.cookies[settings.SESSION_COOKIE_NAME]["max-age"], 0)

    def test_session_helpers_remain_compatible_with_standalone_cookie_session(self):
        class StandaloneSession(dict):
            permanent = False

        standalone_session = StandaloneSession({"attacker_value": "discard-me"})
        with patch.object(legacy, "session", standalone_session):
            legacy.rotate_authenticated_session("standalone-user")
            self.assertNotIn("attacker_value", standalone_session)
            self.assertEqual(standalone_session["user_id"], "standalone-user")
            legacy.invalidate_authenticated_session()

        self.assertEqual(standalone_session, {})


class ProxyAndRateLimitSecurityTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def client_ip_for(self, forwarded_for, *, proxy_hops, remote_addr="10.0.0.8"):
        request = self.factory.get(
            "/login",
            HTTP_X_FORWARDED_FOR=forwarded_for,
            REMOTE_ADDR=remote_addr,
        )
        with patch.object(legacy, "REVERSE_PROXY_HOPS", proxy_hops), request_context(request):
            return legacy.get_client_ip()

    def test_forwarding_header_is_ignored_without_configured_proxy(self):
        self.assertEqual(
            self.client_ip_for("198.51.100.25", proxy_hops=0, remote_addr="203.0.113.8"),
            "203.0.113.8",
        )

    def test_client_ip_is_selected_from_trusted_right_side_of_chain(self):
        forwarded_for = "192.0.2.44, 198.51.100.25"

        self.assertEqual(self.client_ip_for(forwarded_for, proxy_hops=1), "198.51.100.25")
        self.assertEqual(self.client_ip_for(forwarded_for, proxy_hops=2), "192.0.2.44")

    def test_invalid_trusted_forwarded_address_falls_back_to_peer(self):
        self.assertEqual(
            self.client_ip_for("192.0.2.44, not-an-ip", proxy_hops=1),
            "10.0.0.8",
        )

    def run_login_limit_attempt(self, email, client_ip, spoofed_prefix):
        request = self.factory.post(
            "/login",
            {"email": email},
            HTTP_X_FORWARDED_FOR=f"{spoofed_prefix}, {client_ip}",
            REMOTE_ADDR="10.0.0.8",
        )
        SessionMiddleware(lambda current_request: None).process_request(request)
        with patch.object(legacy, "REVERSE_PROXY_HOPS", 1), request_context(request):
            return legacy.apply_rate_limit(5, 300, "login")

    def test_login_limit_applies_independently_to_ip_and_account(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            original_database_path = legacy.DATABASE_PATH
            legacy.DATABASE_PATH = os.path.join(temp_dir, "app.db")
            try:
                with sqlite3.connect(legacy.DATABASE_PATH) as connection:
                    connection.execute(
                        """
                        CREATE TABLE rate_limit_attempts (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            request_key TEXT NOT NULL,
                            created_at REAL NOT NULL
                        )
                        """
                    )

                for attempt in range(25):
                    self.assertIsNone(
                        self.run_login_limit_attempt(
                            f"different-{attempt}@example.com",
                            "198.51.100.25",
                            f"192.0.2.{attempt + 1}",
                        )
                    )
                self.assertIsNotNone(
                    self.run_login_limit_attempt(
                        "another@example.com",
                        "198.51.100.25",
                        "192.0.2.99",
                    )
                )

                with sqlite3.connect(legacy.DATABASE_PATH) as connection:
                    connection.execute("DELETE FROM rate_limit_attempts")

                for attempt in range(5):
                    self.assertIsNone(
                        self.run_login_limit_attempt(
                            "same-account@example.com",
                            f"198.51.100.{attempt + 1}",
                            "192.0.2.10",
                        )
                    )
                self.assertIsNotNone(
                    self.run_login_limit_attempt(
                        "same-account@example.com",
                        "198.51.100.99",
                        "192.0.2.10",
                    )
                )
            finally:
                legacy.DATABASE_PATH = original_database_path


class DestructiveActionSecurityTests(SimpleTestCase):
    csrf_token = "destructive-test-csrf-token-with-sufficient-length-123456"

    def build_authenticated_client(self):
        client = Client()
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = "security-admin"
        session_store["csrf_token"] = self.csrf_token
        session_store["session_started_at"] = int(time.time())
        session_store["session_last_seen_at"] = int(time.time())
        session_store.save()
        client.cookies[settings.SESSION_COOKIE_NAME] = session_store.session_key
        return client

    def test_destructive_templates_use_csp_safe_confirmation_attributes(self):
        base_dir = Path(settings.BASE_DIR)
        template_names = (
            "overeenkomsten_form.html",
            "automatic_invoices.html",
            "voorstellen_maker.html",
            "voorstellen_maker_detail.html",
            "content.html",
            "content_album.html",
        )

        for template_name in template_names:
            content = (base_dir / "templates" / template_name).read_text(encoding="utf-8")
            self.assertIsNone(re.search(r"\son(?:click|submit)\s*=", content, flags=re.IGNORECASE))
            self.assertIn("data-confirm-submit", content)
            self.assertIn("data-confirm-value", content)

        base_template = (base_dir / "templates" / "base.html").read_text(encoding="utf-8")
        self.assertIn("/static/destructive-actions.js", base_template)

    def test_templates_do_not_use_csp_blocked_inline_event_handlers(self):
        templates_dir = Path(settings.BASE_DIR) / "templates"

        for template_path in templates_dir.glob("*.html"):
            content = template_path.read_text(encoding="utf-8")
            self.assertIsNone(
                re.search(r"\son[a-z]+\s*=", content, flags=re.IGNORECASE),
                msg=f"Inline event handler in {template_path.name}",
            )

    def test_official_csrf_and_clickjacking_middleware_cover_future_native_views(self):
        self.assertIn("django.middleware.csrf.CsrfViewMiddleware", settings.MIDDLEWARE)
        self.assertIn("django.middleware.clickjacking.XFrameOptionsMiddleware", settings.MIDDLEWARE)
        self.assertEqual(settings.X_FRAME_OPTIONS, "DENY")

    def test_proposal_delete_without_server_confirmation_is_refused(self):
        client = self.build_authenticated_client()
        admin_user = {"id": "security-admin", "isAdmin": True, "role": "Eigenaar"}

        with (
            patch.object(legacy, "get_user_by_id", return_value=admin_user),
            patch.object(legacy, "delete_proposal") as delete_proposal,
        ):
            response = client.post(
                "/voorstellen-maker",
                {
                    "csrf_token": self.csrf_token,
                    "action": "delete_proposal",
                    "proposal_id": "42",
                },
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        self.assertIn("error=Verwijderen+is+niet+bevestigd", response["Location"])
        delete_proposal.assert_not_called()

    def test_proposal_delete_with_matching_confirmation_is_allowed(self):
        client = self.build_authenticated_client()
        admin_user = {"id": "security-admin", "isAdmin": True, "role": "Eigenaar"}

        with (
            patch.object(legacy, "get_user_by_id", return_value=admin_user),
            patch.object(legacy, "delete_proposal") as delete_proposal,
        ):
            response = client.post(
                "/voorstellen-maker",
                {
                    "csrf_token": self.csrf_token,
                    "action": "delete_proposal",
                    "proposal_id": "42",
                    "delete_confirmation": "delete:proposal:42",
                },
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        delete_proposal.assert_called_once_with(42)

    def test_automatic_invoice_delete_without_confirmation_is_refused(self):
        client = self.build_authenticated_client()
        admin_user = {"id": "security-admin", "isAdmin": True, "role": "Eigenaar"}

        with (
            patch.object(legacy, "get_user_by_id", return_value=admin_user),
            patch.object(legacy, "delete_automatic_invoice_setting") as delete_setting,
        ):
            response = client.post(
                "/financien/automatisch-facturen",
                {
                    "csrf_token": self.csrf_token,
                    "action": "delete_setting",
                    "setting_id": "7",
                },
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        self.assertIn("error=Verwijderen+is+niet+bevestigd", response["Location"])
        delete_setting.assert_not_called()

    def test_contract_delete_without_confirmation_never_touches_database(self):
        client = self.build_authenticated_client()
        admin_user = {"id": "security-admin", "isAdmin": True, "role": "Eigenaar"}

        with (
            patch.object(legacy, "get_user_by_id", return_value=admin_user),
            patch.object(legacy, "load_contract", return_value={"id": 9, "clubName": "Veilige club"}),
            patch.object(legacy, "get_db_connection") as database_connection,
        ):
            response = client.post(
                "/overeenkomsten/9",
                {
                    "csrf_token": self.csrf_token,
                    "action": "delete",
                },
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        self.assertIn("error=Verwijderen+is+niet+bevestigd", response["Location"])
        database_connection.assert_not_called()


class PublicInvitationSecurityTests(SimpleTestCase):
    def build_invite_record(self, *, expires_at=None):
        return {
            "id": "trainer-public-invite-test",
            "fullName": "Gevoelige Voornaam Achternaam",
            "email": "gevoelig@example.com",
            "phone": "0612345678",
            "address": "Privelaan 123",
            "city": "Deventer",
            "postalCode": "1234 AB",
            "bankAccountNumber": "NL91ABNA0417164300",
            "bankAccountName": "Gevoelige Voornaam Achternaam",
            "knvbLicense": "VC 2",
            "education": "Privé opleiding",
            "systemRole": "Trainer",
            "inviteRequiresClothingKeys": False,
            "inviteExpiresAt": expires_at
            or (datetime.utcnow() + timedelta(hours=1)).replace(microsecond=0).isoformat(),
        }

    def test_invite_expiry_default_is_short_and_bounded(self):
        before = datetime.utcnow()
        expires_at = datetime.fromisoformat(legacy.build_invite_expiry())
        after = datetime.utcnow()

        self.assertGreaterEqual(
            expires_at,
            before + timedelta(hours=legacy.TRAINER_INVITE_TTL_HOURS) - timedelta(seconds=1),
        )
        self.assertLessEqual(expires_at, after + timedelta(hours=legacy.TRAINER_INVITE_TTL_HOURS))
        self.assertLessEqual(legacy.TRAINER_INVITE_TTL_HOURS, 168)

    def test_missing_or_invalid_invite_expiry_is_rejected(self):
        self.assertTrue(legacy.invite_is_expired({"inviteExpiresAt": ""}))
        self.assertTrue(legacy.invite_is_expired({"inviteExpiresAt": "not-a-date"}))

    def test_public_invite_response_is_not_cached_or_indexed_and_has_no_stored_pii(self):
        invite_record = self.build_invite_record()

        with patch.object(legacy, "get_user_by_invite_token", return_value=invite_record):
            response = Client().get("/uitnodiging/public-security-token", secure=True)

        content = response.content.decode("utf-8")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store, max-age=0")
        self.assertEqual(response["Pragma"], "no-cache")
        self.assertEqual(response["X-Robots-Tag"], "noindex, nofollow, noarchive, nosnippet")
        self.assertEqual(response["Referrer-Policy"], "no-referrer")
        for sensitive_value in (
            invite_record["fullName"],
            invite_record["email"],
            invite_record["phone"],
            invite_record["address"],
            invite_record["postalCode"],
            invite_record["bankAccountNumber"],
            invite_record["bankAccountName"],
            invite_record["education"],
        ):
            self.assertNotIn(sensitive_value, content)
        self.assertIn('name="address" value=""', content)
        self.assertIn('name="bank_account_number" value=""', content)
        self.assertIn('name="email" value=""', content)

    def test_expired_invite_page_does_not_disclose_trainer_identity(self):
        invite_record = self.build_invite_record(
            expires_at=(datetime.utcnow() - timedelta(minutes=1)).replace(microsecond=0).isoformat()
        )

        with patch.object(legacy, "get_user_by_invite_token", return_value=invite_record):
            response = Client().get("/uitnodiging/expired-security-token", secure=True)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Deze aanmeldlink is verlopen")
        self.assertNotContains(response, invite_record["fullName"])
        self.assertNotContains(response, invite_record["email"])
        self.assertEqual(response["Cache-Control"], "no-store, max-age=0")


class AccountInvariantSecurityTests(SimpleTestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_data_dir = legacy.DATA_DIR
        self.original_database_path = legacy.DATABASE_PATH
        legacy.DATA_DIR = self.temp_dir.name
        legacy.DATABASE_PATH = os.path.join(self.temp_dir.name, "app.db")
        legacy.clear_local_data_cache()
        legacy.init_db()

    def tearDown(self):
        legacy.DATA_DIR = self.original_data_dir
        legacy.DATABASE_PATH = self.original_database_path
        legacy.clear_local_data_cache()
        self.temp_dir.cleanup()
        super().tearDown()

    def insert_profile(
        self,
        profile_id,
        *,
        is_admin,
        status="Actief",
        invite_token=None,
        invite_expires_at=None,
        knvb_license="",
        education="",
    ):
        system_role = "Admin" if is_admin else "Trainer"
        with legacy.get_db_connection() as connection:
            connection.execute(
                """
                INSERT INTO trainer_profiles (
                    id, full_name, email, username, password_hash,
                    invite_token, invite_expires_at, role, member_type,
                    system_role, knvb_license, education, is_admin, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_id,
                    f"Profiel {profile_id}",
                    f"{profile_id}@example.com",
                    profile_id,
                    legacy.hash_password("veilig-testwachtwoord-123"),
                    invite_token,
                    invite_expires_at,
                    system_role,
                    "Medewerker",
                    system_role,
                    knvb_license,
                    education,
                    1 if is_admin else 0,
                    status,
                    legacy.utcnow_iso(),
                ),
            )
        legacy.clear_local_data_cache()

    def demote_profile(self, profile_id):
        legacy.update_trainer_profile(
            profile_id,
            f"Profiel {profile_id}",
            f"{profile_id}@example.com",
            profile_id,
            "Medewerker",
            "Trainer",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            [],
            False,
        )

    def test_last_active_admin_cannot_be_demoted_even_with_invited_admin_present(self):
        self.insert_profile("last-admin", is_admin=True)
        self.insert_profile("invited-admin", is_admin=True, status="Uitgenodigd")

        with self.assertRaisesMessage(ValueError, "laatste actieve admin"):
            self.demote_profile("last-admin")

        persisted = legacy.get_user_by_id("last-admin")
        self.assertTrue(persisted["isAdmin"])
        self.assertEqual(persisted["systemRole"], "Admin")

    def test_last_active_admin_cannot_be_deleted_by_any_caller(self):
        self.insert_profile("last-admin", is_admin=True)
        self.insert_profile("regular-trainer", is_admin=False)

        with self.assertRaisesMessage(ValueError, "laatste actieve admin"):
            legacy.delete_trainer_profile("last-admin")

        self.assertIsNotNone(legacy.get_user_by_id("last-admin"))

    def test_admin_can_be_demoted_when_another_active_admin_remains(self):
        self.insert_profile("first-admin", is_admin=True)
        self.insert_profile("second-admin", is_admin=True)

        self.demote_profile("first-admin")

        self.assertFalse(legacy.get_user_by_id("first-admin")["isAdmin"])
        self.assertTrue(legacy.get_user_by_id("second-admin")["isAdmin"])

    def test_invite_acceptance_preserves_blank_optional_qualifications(self):
        invite_token = "preserve-optional-fields-token"
        self.insert_profile(
            "invited-trainer",
            is_admin=False,
            status="Uitgenodigd",
            invite_token=invite_token,
            invite_expires_at=(datetime.utcnow() + timedelta(hours=1)).replace(microsecond=0).isoformat(),
            knvb_license="Bestaande KNVB-licentie",
            education="Bestaande opleiding",
        )

        legacy.accept_trainer_invite(
            "invited-trainer",
            invite_token,
            "Nieuwe Trainer",
            "nieuwe-trainer@example.com",
            "0612345678",
            "Sportlaan 1",
            "Deventer",
            "1234 AB",
            "NL91ABNA0417164300",
            "Nieuwe Trainer",
            "",
            "",
            "nieuw-veilig-wachtwoord-123",
        )

        persisted = legacy.get_user_by_id("invited-trainer")
        self.assertEqual(persisted["knvbLicense"], "Bestaande KNVB-licentie")
        self.assertEqual(persisted["education"], "Bestaande opleiding")
        self.assertEqual(persisted["status"], "Actief")


class RecoverableContentDeletionTests(SimpleTestCase):
    csrf_token = "content-trash-csrf-token-with-sufficient-length-123456789"

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        database_path = os.path.join(self.temp_dir.name, "app.db")
        self.data_dir_patch = patch.object(legacy, "DATA_DIR", self.temp_dir.name)
        self.database_path_patch = patch.object(legacy, "DATABASE_PATH", database_path)
        self.data_dir_patch.start()
        self.database_path_patch.start()
        self.addCleanup(self.data_dir_patch.stop)
        self.addCleanup(self.database_path_patch.stop)
        legacy.init_db()

    def build_authenticated_client(self):
        client = Client()
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = "content-trash-admin"
        session_store["csrf_token"] = self.csrf_token
        session_store["session_started_at"] = int(time.time())
        session_store["session_last_seen_at"] = int(time.time())
        session_store.save()
        client.cookies[settings.SESSION_COOKIE_NAME] = session_store.session_key
        return client

    def insert_album_with_photo(self):
        with legacy.get_db_connection() as connection:
            album_cursor = connection.execute(
                """
                INSERT INTO content_albums (title, slug, created_at)
                VALUES (?, ?, ?)
                """,
                ("Veilig album", "veilig-album", "2026-08-26T12:00:00"),
            )
            album_id = int(album_cursor.lastrowid)
            photo_cursor = connection.execute(
                """
                INSERT INTO content_photos (
                    album_id, image_url, remote_path, file_name, original_name,
                    content_type, file_size, storage_backend, uploaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    album_id,
                    "/static/uploads/content/veilig.jpg",
                    "content/veilig.jpg",
                    "veilig.jpg",
                    "veilig.jpg",
                    "image/jpeg",
                    128,
                    "local",
                    "2026-08-26T12:00:00",
                ),
            )
            return album_id, int(photo_cursor.lastrowid)

    def test_photo_and_album_deletion_are_recoverable_and_never_delete_files(self):
        album_id, photo_id = self.insert_album_with_photo()

        with patch.object(legacy, "delete_content_file") as delete_file:
            self.assertTrue(legacy.delete_content_photo(photo_id, album_id))
            delete_file.assert_not_called()

        with legacy.get_db_connection() as connection:
            deleted_photo = connection.execute(
                "SELECT deleted_at FROM content_photos WHERE id = ?",
                (photo_id,),
            ).fetchone()
        self.assertIsNotNone(deleted_photo)
        self.assertTrue(deleted_photo["deleted_at"])
        self.assertEqual(legacy.load_content_album_photos(album_id), [])
        self.assertEqual(len(legacy.load_deleted_content_album_photos(album_id)), 1)

        self.assertTrue(legacy.restore_content_photo(photo_id, album_id))
        self.assertEqual(len(legacy.load_content_album_photos(album_id)), 1)

        with patch.object(legacy, "delete_content_file") as delete_file:
            self.assertTrue(legacy.delete_content_album(album_id))
            delete_file.assert_not_called()

        self.assertIsNone(legacy.load_content_album(album_id))
        self.assertEqual(legacy.load_deleted_content_album_summaries()[0]["id"], album_id)
        with legacy.get_db_connection() as connection:
            retained_photo_count = connection.execute(
                "SELECT COUNT(*) FROM content_photos WHERE album_id = ?",
                (album_id,),
            ).fetchone()[0]
        self.assertEqual(retained_photo_count, 1)

        self.assertTrue(legacy.restore_content_album(album_id))
        self.assertIsNotNone(legacy.load_content_album(album_id))

    def test_soft_delete_schema_migration_preserves_existing_content(self):
        with tempfile.TemporaryDirectory() as legacy_data_dir:
            legacy_database_path = os.path.join(legacy_data_dir, "app.db")
            with sqlite3.connect(legacy_database_path) as connection:
                connection.executescript(
                    """
                    CREATE TABLE content_albums (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        slug TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    CREATE TABLE content_photos (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        album_id INTEGER NOT NULL,
                        image_url TEXT NOT NULL,
                        remote_path TEXT NOT NULL,
                        file_name TEXT NOT NULL,
                        original_name TEXT,
                        content_type TEXT,
                        file_size INTEGER NOT NULL DEFAULT 0,
                        storage_backend TEXT NOT NULL DEFAULT 'local',
                        uploaded_at TEXT NOT NULL
                    );
                    INSERT INTO content_albums (id, title, slug, created_at)
                    VALUES (7, 'Bestaand album', 'bestaand-album', '2026-01-01T10:00:00');
                    INSERT INTO content_photos (
                        id, album_id, image_url, remote_path, file_name, original_name,
                        content_type, file_size, storage_backend, uploaded_at
                    ) VALUES (
                        9, 7, '/static/uploads/bestaand.jpg', 'bestaand.jpg', 'bestaand.jpg',
                        'bestaand.jpg', 'image/jpeg', 256, 'local', '2026-01-01T10:00:00'
                    );
                    """
                )

            with (
                patch.object(legacy, "DATA_DIR", legacy_data_dir),
                patch.object(legacy, "DATABASE_PATH", legacy_database_path),
            ):
                legacy.init_db()
                with legacy.get_db_connection() as connection:
                    album_columns = {
                        row["name"] for row in connection.execute("PRAGMA table_info(content_albums)")
                    }
                    photo_columns = {
                        row["name"] for row in connection.execute("PRAGMA table_info(content_photos)")
                    }
                    album = connection.execute(
                        "SELECT title, deleted_at FROM content_albums WHERE id = 7"
                    ).fetchone()
                    photo = connection.execute(
                        "SELECT original_name, deleted_at FROM content_photos WHERE id = 9"
                    ).fetchone()

            self.assertIn("deleted_at", album_columns)
            self.assertIn("deleted_at", photo_columns)
            self.assertEqual(album["title"], "Bestaand album")
            self.assertIsNone(album["deleted_at"])
            self.assertEqual(photo["original_name"], "bestaand.jpg")
            self.assertIsNone(photo["deleted_at"])

    def test_content_delete_requires_matching_server_confirmation(self):
        client = self.build_authenticated_client()
        admin_user = {"id": "content-trash-admin", "isAdmin": True, "role": "Eigenaar"}

        with (
            patch.object(legacy, "require_page_access", return_value=None),
            patch.object(legacy, "get_current_user", return_value=admin_user),
            patch.object(legacy, "delete_content_album") as delete_album,
        ):
            refused = client.post(
                "/content",
                {
                    "csrf_token": self.csrf_token,
                    "action": "delete_album",
                    "album_id": "42",
                },
                secure=True,
            )

        self.assertEqual(refused.status_code, 302)
        self.assertIn("Verwijderen+is+niet+bevestigd", refused["Location"])
        delete_album.assert_not_called()

        with (
            patch.object(legacy, "require_page_access", return_value=None),
            patch.object(legacy, "get_current_user", return_value=admin_user),
            patch.object(legacy, "delete_content_album", return_value=True) as delete_album,
        ):
            accepted = client.post(
                "/content",
                {
                    "csrf_token": self.csrf_token,
                    "action": "delete_album",
                    "album_id": "42",
                    "delete_confirmation": "delete:content-album:42",
                },
                secure=True,
            )

        self.assertEqual(accepted.status_code, 302)
        delete_album.assert_called_once_with(42)

    def test_photo_delete_requires_matching_server_confirmation(self):
        client = self.build_authenticated_client()
        admin_user = {"id": "content-trash-admin", "isAdmin": True, "role": "Eigenaar"}
        album = {"id": 42, "title": "Veilig album"}

        with (
            patch.object(legacy, "require_page_access", return_value=None),
            patch.object(legacy, "get_current_user", return_value=admin_user),
            patch.object(legacy, "load_content_album", return_value=album),
            patch.object(legacy, "delete_content_photo") as delete_photo,
        ):
            refused = client.post(
                "/content/42",
                {
                    "csrf_token": self.csrf_token,
                    "action": "delete_photo",
                    "photo_id": "9",
                },
                secure=True,
            )

        self.assertEqual(refused.status_code, 302)
        self.assertIn("Verwijderen+is+niet+bevestigd", refused["Location"])
        delete_photo.assert_not_called()

        with (
            patch.object(legacy, "require_page_access", return_value=None),
            patch.object(legacy, "get_current_user", return_value=admin_user),
            patch.object(legacy, "load_content_album", return_value=album),
            patch.object(legacy, "delete_content_photo", return_value=True) as delete_photo,
        ):
            accepted = client.post(
                "/content/42",
                {
                    "csrf_token": self.csrf_token,
                    "action": "delete_photo",
                    "photo_id": "9",
                    "delete_confirmation": "delete:content-photo:9",
                },
                secure=True,
            )

        self.assertEqual(accepted.status_code, 302)
        delete_photo.assert_called_once_with(9, 42)
