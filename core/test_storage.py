import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase

import app as legacy


class StorageHardeningTests(SimpleTestCase):
    def setUp(self):
        super().setUp()
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.original_data_dir = legacy.DATA_DIR
        self.original_database_path = legacy.DATABASE_PATH
        legacy.DATA_DIR = self.temporary_directory.name
        legacy.DATABASE_PATH = os.path.join(legacy.DATA_DIR, "app.db")

    def tearDown(self):
        legacy.DATA_DIR = self.original_data_dir
        legacy.DATABASE_PATH = self.original_database_path
        self.temporary_directory.cleanup()
        super().tearDown()

    def write_value(self, value):
        with sqlite3.connect(legacy.DATABASE_PATH) as connection:
            connection.execute("CREATE TABLE IF NOT EXISTS backup_probe (value TEXT NOT NULL)")
            connection.execute("DELETE FROM backup_probe")
            connection.execute("INSERT INTO backup_probe (value) VALUES (?)", (value,))

    def test_backup_is_valid_atomic_snapshot_with_limited_retention(self):
        self.write_value("eerste waarde")

        with patch.object(legacy, "STORAGE_BACKUP_RETENTION", 2):
            first_backup = legacy.create_storage_backup()
            self.write_value("tweede waarde")
            legacy.create_storage_backup()
            self.write_value("derde waarde")
            latest_backup = legacy.create_storage_backup()

        backup_paths = sorted((Path(legacy.DATA_DIR) / "backups").glob("app-*.sqlite3"))
        self.assertEqual(len(backup_paths), 2)
        self.assertFalse(Path(first_backup).exists())
        self.assertTrue(Path(latest_backup).exists())
        self.assertEqual(os.stat(latest_backup).st_mode & 0o077, 0)
        self.assertFalse(list((Path(legacy.DATA_DIR) / "backups").glob("*.tmp")))

        with sqlite3.connect(latest_backup) as connection:
            self.assertEqual(connection.execute("PRAGMA quick_check").fetchone()[0], "ok")
            self.assertEqual(connection.execute("SELECT value FROM backup_probe").fetchone()[0], "derde waarde")

    def test_storage_database_uses_wal_normal_sync_and_busy_timeout(self):
        legacy.configure_storage_database()

        with legacy.get_db_connection() as connection:
            self.assertEqual(connection.execute("PRAGMA journal_mode").fetchone()[0], "wal")
            self.assertEqual(connection.execute("PRAGMA synchronous").fetchone()[0], 1)
            self.assertEqual(
                connection.execute("PRAGMA busy_timeout").fetchone()[0],
                legacy.SQLITE_BUSY_TIMEOUT_MS,
            )

    def test_local_cache_fingerprint_tracks_committed_wal_writes(self):
        legacy.configure_storage_database()
        with legacy.get_db_connection() as connection:
            connection.execute("CREATE TABLE cache_probe (value TEXT NOT NULL)")
            connection.execute("INSERT INTO cache_probe (value) VALUES ('eerste waarde')")

        reader = legacy.get_db_connection()
        try:
            reader.execute("BEGIN")
            reader.execute("SELECT value FROM cache_probe").fetchone()
            before_write = legacy.get_database_cache_fingerprint()

            with legacy.get_db_connection() as writer:
                writer.execute("UPDATE cache_probe SET value = 'tweede waarde'")

            after_write = legacy.get_database_cache_fingerprint()
        finally:
            reader.close()

        self.assertNotEqual(before_write, after_write)
        self.assertNotEqual(after_write[2:], (0, 0))

    def test_migration_backup_happens_before_database_mutations(self):
        call_order = []

        def record(name, result=None):
            def recorder():
                call_order.append(name)
                return result

            return recorder

        with (
            patch.object(legacy, "bootstrap_seed_data_files", side_effect=record("bootstrap")),
            patch.object(legacy, "create_storage_backup", side_effect=record("backup", "/tmp/safe.sqlite3")),
            patch.object(legacy, "configure_storage_database", side_effect=record("configure")),
            patch.object(legacy, "init_db", side_effect=record("init")),
            patch.object(legacy, "migrate_football_days_playbook_to_playbooks", side_effect=record("playbooks")),
            patch.object(legacy, "migrate_dashboard_events_json_to_db", side_effect=record("dashboard")),
            patch.object(legacy, "migrate_agenda_trainings_json_to_db", side_effect=record("agenda")),
            patch.object(legacy, "sync_seed_workspace_data", side_effect=record("sync")),
            patch.object(legacy, "seed_workspace_tables", side_effect=record("seed")),
            patch.object(legacy, "ensure_admin_account", side_effect=record("admin")),
        ):
            backup_path = legacy.run_storage_migrations()

        self.assertEqual(backup_path, "/tmp/safe.sqlite3")
        self.assertEqual(
            call_order,
            ["bootstrap", "backup", "configure", "init", "playbooks", "dashboard", "agenda", "sync", "seed", "admin"],
        )

    def test_backup_failure_stops_before_database_mutation(self):
        with (
            patch.object(legacy, "bootstrap_seed_data_files"),
            patch.object(legacy, "create_storage_backup", side_effect=RuntimeError("backup mislukt")),
            patch.object(legacy, "configure_storage_database") as configure_database,
            patch.object(legacy, "init_db") as init_database,
        ):
            with self.assertRaisesRegex(RuntimeError, "backup mislukt"):
                legacy.run_storage_migrations()

        configure_database.assert_not_called()
        init_database.assert_not_called()

    def test_plain_application_import_does_not_create_or_migrate_database(self):
        import_data_dir = Path(self.temporary_directory.name) / "import-data"
        import_session_dir = Path(self.temporary_directory.name) / "import-sessions"
        environment = os.environ.copy()
        environment.update(
            {
                "DATA_DIR": str(import_data_dir),
                "SESSION_FILE_PATH": str(import_session_dir),
                "DJANGO_SETTINGS_MODULE": "config.settings",
                "DJANGO_DEBUG": "1",
                "DJANGO_ALLOWED_HOSTS": "testserver,localhost,127.0.0.1",
                "TRUSTED_HOSTS": "testserver,localhost,127.0.0.1",
            }
        )

        completed = subprocess.run(
            [
                sys.executable,
                "-c",
                "import django; django.setup(); import app; print('import ok')",
            ],
            cwd=Path(__file__).resolve().parent.parent,
            env=environment,
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertEqual(completed.stdout.strip(), "import ok")
        self.assertFalse((import_data_dir / "app.db").exists())
