from datetime import date

from django.core.management.base import BaseCommand, CommandError

import app as legacy


class Command(BaseCommand):
    help = "Maak MoneyBird-conceptfacturen aan voor automatische clubfacturen die vandaag gepland staan."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            default="",
            help="Verwerkingsdatum in YYYY-MM-DD. Standaard vandaag.",
        )

    def handle(self, *args, **options):
        process_date = date.today()
        configured_date = str(options.get("date") or "").strip()
        if configured_date:
            try:
                process_date = date.fromisoformat(configured_date)
            except ValueError as exc:
                raise CommandError("Vul --date in als YYYY-MM-DD.") from exc

        result = legacy.process_automatic_invoices(process_date)
        processed = result.get("processed", [])
        failed = [item for item in processed if item.get("error")]
        created = [item for item in processed if not item.get("error")]

        if failed:
            raise CommandError(
                "Automatische facturen deels mislukt: "
                f"{len(created)} aangemaakt/overgeslagen, {len(failed)} mislukt."
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Automatische facturen verwerkt: "
                f"{len(created)} instelling(en) verwerkt voor {result.get('date')}."
            )
        )
