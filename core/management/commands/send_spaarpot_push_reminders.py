from datetime import date

from django.core.management.base import BaseCommand, CommandError

import app as legacy


class Command(BaseCommand):
    help = "Stuur de wekelijkse spaarpot-pushmelding naar geregistreerde browsers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            default="",
            help="Maandagdatum in YYYY-MM-DD. Standaard: huidige week.",
        )

    def handle(self, *args, **options):
        target_date = None
        configured_date = str(options.get("date") or "").strip()
        if configured_date:
            try:
                target_date = date.fromisoformat(configured_date)
            except ValueError as exc:
                raise CommandError("Vul --date in als YYYY-MM-DD.") from exc

        result = legacy.send_spaarpot_push_reminders(target_date)
        if result.get("error"):
            raise CommandError(str(result["error"]))
        if int(result.get("failed") or 0) > 0:
            raise CommandError(
                "Spaarpot-pushmeldingen deels mislukt: "
                f"{result.get('sent', 0)} verzonden, {result.get('failed', 0)} mislukt."
            )

        reminder = result.get("reminder", {})
        self.stdout.write(
            self.style.SUCCESS(
                "Spaarpot-pushmeldingen verzonden: "
                f"{result.get('sent', 0)} browser(s), bijstorten {reminder.get('topUpAmountLabel', 'EUR 0,00')}."
            )
        )
