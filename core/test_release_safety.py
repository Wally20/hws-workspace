import os
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

from django.http import Http404
from django.test import Client, RequestFactory, SimpleTestCase, override_settings

import app as legacy
from core import views


class LocalUploadServingTests(SimpleTestCase):
    def test_local_fallback_upload_is_served_with_safe_headers_and_mime_type(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            upload_root = Path(temp_dir) / "uploads"
            upload_file = upload_root / "content" / "test-photo.webp"
            upload_file.parent.mkdir(parents=True)
            upload_file.write_bytes(b"safe-webp-test")

            with override_settings(LOCAL_UPLOAD_ROOT=upload_root):
                response = Client().get(
                    "/static/uploads/content/test-photo.webp",
                    secure=True,
                )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(b"".join(response.streaming_content), b"safe-webp-test")
            self.assertEqual(response["Content-Type"], "image/webp")
            self.assertEqual(response["X-Content-Type-Options"], "nosniff")
            self.assertEqual(response["Cache-Control"], "public, max-age=3600")

    def test_local_upload_rejects_parent_traversal_and_symlink_escape(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            base_path = Path(temp_dir)
            upload_root = base_path / "uploads"
            upload_root.mkdir()
            outside_file = base_path / "outside.jpg"
            outside_file.write_bytes(b"private")
            (upload_root / "outside-link.jpg").symlink_to(outside_file)
            request = RequestFactory().get("/static/uploads/outside.jpg", secure=True)

            with override_settings(LOCAL_UPLOAD_ROOT=upload_root):
                with self.assertRaises(Http404):
                    views.local_upload(request, "../outside.jpg")
                with self.assertRaises(Http404):
                    views.local_upload(request, "outside-link.jpg")


class ExerciseVideoFallbackLimitTests(SimpleTestCase):
    def test_local_video_limit_is_small_while_bunny_keeps_configured_limit(self):
        without_bunny = {
            "BUNNY_STORAGE_ZONE": "",
            "BUNNY_STORAGE_ACCESS_KEY": "",
            "BUNNY_IMAGE_PUBLIC_BASE": "",
            "BUNNY_VIDEO_PUBLIC_BASE": "",
            "LOCAL_VIDEO_MAX_UPLOAD_MB": "250",
        }
        with patch.dict(os.environ, without_bunny, clear=False):
            local_config = legacy.get_exercise_video_storage_config()

        with_bunny = {
            "BUNNY_STORAGE_ZONE": "hws-test-zone",
            "BUNNY_STORAGE_ACCESS_KEY": "test-storage-key",
            "BUNNY_IMAGE_PUBLIC_BASE": "https://hws-test.b-cdn.net",
            "BUNNY_VIDEO_PUBLIC_BASE": "https://hws-video-test.b-cdn.net",
            "LOCAL_VIDEO_MAX_UPLOAD_MB": "250",
        }
        with patch.dict(os.environ, with_bunny, clear=False):
            bunny_config = legacy.get_exercise_video_storage_config()

        self.assertFalse(local_config["bunny_enabled"])
        self.assertEqual(local_config["max_upload_mb"], 250)
        self.assertTrue(bunny_config["bunny_enabled"])
        self.assertEqual(bunny_config["max_upload_mb"], legacy.EXERCISE_VIDEO_MAX_UPLOAD_MB)

    def test_oversized_local_video_is_rejected_before_storage_is_touched(self):
        upload_stream = Mock()
        upload_stream.tell.return_value = 251 * 1024 * 1024
        upload = Mock(
            filename="too-large.mp4",
            mimetype="video/mp4",
            stream=upload_stream,
        )
        without_bunny = {
            "BUNNY_STORAGE_ZONE": "",
            "BUNNY_STORAGE_ACCESS_KEY": "",
            "BUNNY_IMAGE_PUBLIC_BASE": "",
            "BUNNY_VIDEO_PUBLIC_BASE": "",
            "LOCAL_VIDEO_MAX_UPLOAD_MB": "250",
        }

        with (
            patch.dict(os.environ, without_bunny, clear=False),
            patch.object(
                legacy,
                "load_exercise_by_id",
                return_value={"id": 7, "title": "Test oefening"},
            ),
            patch.object(legacy, "upload_content_file") as upload_content_file,
        ):
            exercise, error = legacy.upload_exercise_video(7, upload)

        self.assertIsNone(exercise)
        self.assertEqual(error, "De video mag maximaal 250 MB zijn.")
        upload_content_file.assert_not_called()


class ExerciseImportAuthorizationTests(SimpleTestCase):
    trainer = {
        "id": "release-test-trainer",
        "fullName": "Release Test Trainer",
        "isAdmin": False,
        "systemRole": "Trainer",
    }
    admin = {
        "id": "release-test-admin",
        "fullName": "Release Test Admin",
        "isAdmin": True,
        "systemRole": "Admin",
    }

    def test_trainer_library_is_read_only_and_post_has_no_side_effect(self):
        with (
            patch.object(legacy, "get_current_user", return_value=self.trainer),
            patch.object(legacy, "validate_csrf_token", return_value=None),
            patch.object(legacy, "load_exercises", return_value=[]),
            patch.object(legacy, "load_exercise_import_preview") as load_preview,
            patch.object(legacy, "insert_exercises") as insert_exercises,
        ):
            page_response = Client().get("/oefeningen-bibliotheek", secure=True)
            post_response = Client().post(
                "/oefeningen-bibliotheek",
                {"action": "import_all", "preview_id": "trainer-preview"},
                secure=True,
            )

        self.assertEqual(page_response.status_code, 200)
        self.assertNotContains(page_response, 'class="exercise-import-form"')
        self.assertEqual(post_response.status_code, 403)
        load_preview.assert_not_called()
        insert_exercises.assert_not_called()

    def test_admin_can_execute_exercise_import(self):
        preview_exercises = [{"title": "Veilige test-oefening"}]
        with (
            patch.object(legacy, "get_current_user", return_value=self.admin),
            patch.object(legacy, "validate_csrf_token", return_value=None),
            patch.object(
                legacy,
                "load_exercise_import_preview",
                return_value=preview_exercises,
            ) as load_preview,
            patch.object(legacy, "apply_submitted_exercise_import_edits") as apply_edits,
            patch.object(legacy, "insert_exercises", return_value=1) as insert_exercises,
            patch.object(legacy, "clear_exercise_import_preview") as clear_preview,
        ):
            response = Client().post(
                "/oefeningen-bibliotheek",
                {"action": "import_all", "preview_id": "admin-preview"},
                secure=True,
            )

        self.assertEqual(response.status_code, 302)
        load_preview.assert_called_once_with("admin-preview")
        apply_edits.assert_called_once_with(preview_exercises)
        insert_exercises.assert_called_once_with(preview_exercises)
        clear_preview.assert_called_once_with("admin-preview")
