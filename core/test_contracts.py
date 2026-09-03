import base64
import hashlib
import os
import re
import tempfile
import time
from io import BytesIO
from importlib import import_module
from unittest.mock import patch
from urllib.parse import urlsplit

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, SimpleTestCase
from PIL import Image, ImageDraw
from pypdf import PdfReader
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

import app as legacy


class UploadedContractFlowTests(SimpleTestCase):
    csrf_token = "contract-test-csrf-token-with-sufficient-length-123456789"

    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.original_data_dir = legacy.DATA_DIR
        self.original_database_path = legacy.DATABASE_PATH
        legacy.DATA_DIR = self.temporary_directory.name
        legacy.DATABASE_PATH = os.path.join(self.temporary_directory.name, "app.db")
        legacy.init_db()
        legacy.clear_local_data_cache()
        self.addCleanup(self.restore_storage_globals)
        self.user_patch = patch.object(
            legacy,
            "get_user_by_id",
            return_value={"id": "contract-admin", "isAdmin": True, "systemRole": "Admin"},
        )
        self.user_patch.start()
        self.addCleanup(self.user_patch.stop)

    def restore_storage_globals(self):
        legacy.DATA_DIR = self.original_data_dir
        legacy.DATABASE_PATH = self.original_database_path
        legacy.clear_local_data_cache()

    def authenticated_client(self) -> Client:
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["user_id"] = "contract-admin"
        session_store["csrf_token"] = self.csrf_token
        session_store["session_started_at"] = int(time.time())
        session_store["session_last_seen_at"] = int(time.time())
        session_store.save()
        client = Client()
        client.cookies[settings.SESSION_COOKIE_NAME] = session_store.session_key
        return client

    @staticmethod
    def pdf_bytes() -> bytes:
        output = BytesIO()
        pdf = canvas.Canvas(output, pagesize=A4)
        pdf.drawString(72, 760, "Testovereenkomst HWS Voetbalschool")
        pdf.save()
        return output.getvalue()

    @staticmethod
    def signature_data_url() -> str:
        image = Image.new("RGBA", (900, 260), (255, 255, 255, 0))
        drawing = ImageDraw.Draw(image)
        drawing.line((110, 170, 230, 90, 360, 175, 510, 70, 720, 155), fill=(20, 20, 20, 255), width=8)
        output = BytesIO()
        image.save(output, format="PNG")
        return "data:image/png;base64," + base64.b64encode(output.getvalue()).decode("ascii")

    def upload_contract(self, client: Client, filename: str = "Samenwerking 2026.pdf") -> int:
        response = client.post(
            "/overeenkomsten",
            {
                "csrf_token": self.csrf_token,
                "action": "upload_contract",
                "club_name": "VV Testclub",
                "season": "2026/2027",
                "contract_pdf": SimpleUploadedFile(filename, self.pdf_bytes(), content_type="application/pdf"),
            },
            secure=True,
        )
        self.assertEqual(response.status_code, 302)
        self.assertRegex(response["Location"], r"^/overeenkomsten/\d+\?success=")
        return int(response["Location"].split("/overeenkomsten/", 1)[1].split("?", 1)[0])

    def create_share_link(self, client: Client, contract_id: int, link_type: str) -> tuple[str, str]:
        action = "create_sign_link" if link_type == "sign" else "create_view_link"
        response = client.post(
            f"/overeenkomsten/{contract_id}",
            {
                "csrf_token": self.csrf_token,
                "action": action,
                "expiry_days": "30",
            },
            secure=True,
        )
        self.assertEqual(response.status_code, 302)
        latest_share = client.session["latest_contract_share"]
        self.assertEqual(latest_share["type"], link_type)
        share_path = urlsplit(latest_share["url"]).path
        return share_path, share_path.rstrip("/").rsplit("/", 1)[-1]

    def test_pdf_upload_is_stored_privately_and_rendered_as_tile(self):
        client = self.authenticated_client()
        contract_id = self.upload_contract(client)
        contract = legacy.load_contract(contract_id)

        self.assertEqual(contract["clubName"], "VV Testclub")
        self.assertEqual(contract["season"], "2026/2027")
        self.assertEqual(contract["originalFilename"], "Samenwerking 2026.pdf")
        self.assertEqual(contract["status"], "concept")
        stored_path = legacy.resolve_contract_storage_path(contract["pdfStorageName"])
        self.assertTrue(stored_path.startswith(self.temporary_directory.name))
        self.assertTrue(os.path.isfile(stored_path))

        overview = client.get("/overeenkomsten", secure=True)
        detail = client.get(f"/overeenkomsten/{contract_id}", secure=True)
        pdf_response = client.get(f"/overeenkomsten/{contract_id}/bestand", secure=True)

        self.assertContains(overview, "VV Testclub")
        self.assertContains(overview, 'data-contract-tile')
        self.assertContains(overview, 'id="contractSearch"')
        self.assertContains(detail, "Maak weergavelink")
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response["Content-Type"], "application/pdf")
        self.assertIn("inline", pdf_response["Content-Disposition"])
        self.assertEqual(pdf_response["X-Frame-Options"], "SAMEORIGIN")

    def test_invalid_pdf_upload_is_rejected_without_database_record(self):
        client = self.authenticated_client()
        response = client.post(
            "/overeenkomsten",
            {
                "csrf_token": self.csrf_token,
                "action": "upload_contract",
                "club_name": "VV Testclub",
                "season": "2026/2027",
                "contract_pdf": SimpleUploadedFile("vals.pdf", b"geen pdf", content_type="application/pdf"),
            },
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "geen geldige PDF-inhoud")
        self.assertContains(response, 'id="contractUploadModal"')
        self.assertEqual(legacy.load_uploaded_contracts(), [])

    def test_private_pdf_requires_login(self):
        authenticated_client = self.authenticated_client()
        contract_id = self.upload_contract(authenticated_client)

        response = Client().get(f"/overeenkomsten/{contract_id}/bestand", secure=True)

        self.assertEqual(response.status_code, 302)
        self.assertIn("/login?next=", response["Location"])

    def test_view_link_is_public_hashed_and_can_be_revoked(self):
        client = self.authenticated_client()
        contract_id = self.upload_contract(client)
        share_path, raw_token = self.create_share_link(client, contract_id, "view")

        with legacy.get_db_connection() as connection:
            row = connection.execute("SELECT id, token_hash FROM contract_share_links").fetchone()
        self.assertNotIn(raw_token, row["token_hash"])
        self.assertEqual(row["token_hash"], hashlib.sha256(raw_token.encode("utf-8")).hexdigest())

        public_client = Client()
        public_page = public_client.get(share_path, secure=True)
        public_pdf = public_client.get(f"{share_path}/pdf", secure=True)
        self.assertEqual(public_page.status_code, 200)
        self.assertContains(public_page, "VV Testclub")
        self.assertEqual(public_page["X-Robots-Tag"], "noindex, nofollow, noarchive, nosnippet")
        self.assertEqual(public_pdf.status_code, 200)
        self.assertTrue(public_pdf.content.startswith(b"%PDF-"))

        revoke_response = client.post(
            f"/overeenkomsten/{contract_id}",
            {
                "csrf_token": self.csrf_token,
                "action": "revoke_share_link",
                "share_id": str(row["id"]),
            },
            secure=True,
        )
        self.assertEqual(revoke_response.status_code, 302)
        self.assertEqual(public_client.get(share_path, secure=True).status_code, 410)

    def test_signing_link_creates_signed_pdf_with_evidence_page(self):
        admin_client = self.authenticated_client()
        contract_id = self.upload_contract(admin_client)
        share_path, _ = self.create_share_link(admin_client, contract_id, "sign")
        public_client = Client()
        signing_page = public_client.get(share_path, secure=True)
        csrf_match = re.search(
            r'name="csrf_token" value="([^"]+)"',
            signing_page.content.decode("utf-8"),
        )
        self.assertIsNotNone(csrf_match)

        signing_response = public_client.post(
            share_path,
            {
                "csrf_token": csrf_match.group(1),
                "signer_name": "Jan de Ondertekenaar",
                "signer_email": "jan@testclub.nl",
                "signer_role": "Voorzitter",
                "agreement": "1",
                "signature_data": self.signature_data_url(),
            },
            secure=True,
        )
        self.assertEqual(signing_response.status_code, 302)
        self.assertIn("completed=1", signing_response["Location"])

        contract = legacy.load_contract(contract_id)
        self.assertEqual(contract["status"], "signed")
        self.assertEqual(contract["signerName"], "Jan de Ondertekenaar")
        signed_bytes = legacy.read_private_contract_file(contract["signedPdfStorageName"])
        self.assertIsNotNone(signed_bytes)
        self.assertEqual(len(PdfReader(BytesIO(signed_bytes)).pages), 2)

        completed_page = public_client.get(signing_response["Location"], secure=True)
        signed_pdf_response = public_client.get(f"{share_path}/pdf", secure=True)
        self.assertContains(completed_page, "Overeenkomst ondertekend")
        self.assertEqual(len(PdfReader(BytesIO(signed_pdf_response.content)).pages), 2)

    def test_blank_signature_is_rejected_and_expired_link_is_unavailable(self):
        admin_client = self.authenticated_client()
        contract_id = self.upload_contract(admin_client)
        share_path, raw_token = self.create_share_link(admin_client, contract_id, "sign")
        public_client = Client()
        signing_page = public_client.get(share_path, secure=True)
        csrf_match = re.search(
            r'name="csrf_token" value="([^"]+)"',
            signing_page.content.decode("utf-8"),
        )
        blank_image = Image.new("RGBA", (900, 260), (255, 255, 255, 0))
        blank_output = BytesIO()
        blank_image.save(blank_output, format="PNG")
        blank_signature = "data:image/png;base64," + base64.b64encode(blank_output.getvalue()).decode("ascii")

        response = public_client.post(
            share_path,
            {
                "csrf_token": csrf_match.group(1),
                "signer_name": "Jan de Ondertekenaar",
                "signer_email": "jan@testclub.nl",
                "agreement": "1",
                "signature_data": blank_signature,
            },
            secure=True,
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "zichtbare handtekening")
        self.assertFalse(legacy.load_contract(contract_id)["signedAt"])

        with legacy.get_db_connection() as connection:
            connection.execute(
                "UPDATE contract_share_links SET expires_at = '2000-01-01T00:00:00' WHERE token_hash = ?",
                (hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),),
            )
        self.assertEqual(public_client.get(share_path, secure=True).status_code, 410)
