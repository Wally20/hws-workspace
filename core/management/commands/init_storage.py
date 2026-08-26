from django.core.management.base import BaseCommand

import app as legacy


class Command(BaseCommand):
    help = "Initialiseer en migreer de legacy SQLite-opslag, met eerst een consistente lokale backup."
    requires_system_checks = []

    def handle(self, *args, **options):
        backup_path = legacy.run_storage_migrations()
        if backup_path:
            self.stdout.write(f"Veilige SQLite-backup gemaakt: {backup_path}")
        else:
            self.stdout.write("Geen bestaande SQLite-database gevonden; backup was niet nodig.")
        self.stdout.write(self.style.SUCCESS("Opslaginitialisatie voltooid."))
