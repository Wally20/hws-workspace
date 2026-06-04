from datetime import date

from django.core.management.base import BaseCommand, CommandError

import app as legacy


class Command(BaseCommand):
    help = "Stuur automatische registratiereminders voor events die over 7 dagen starten."

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            default="",
            help="Reminderdatum in YYYY-MM-DD. Standaard vandaag.",
        )

    def handle(self, *args, **options):
        reminder_date = date.today()
        configured_date = str(options.get("date") or "").strip()
        if configured_date:
            try:
                reminder_date = date.fromisoformat(configured_date)
            except ValueError as exc:
                raise CommandError("Vul --date in als YYYY-MM-DD.") from exc

        if not legacy.registration_auto_email_is_configured():
            raise CommandError("Automatische inschrijvingsmail is niet volledig geconfigureerd.")

        ecwid_payload = legacy.fetch_orders_from_ecwid(run_auto_email=False)
        if ecwid_payload.get("source") != "ecwid":
            raise CommandError(str(ecwid_payload.get("message") or "Ecwid-orders konden niet live worden geladen."))

        result = legacy.send_registration_reminder_emails(
            ecwid_payload.get("items", []),
            reminder_date=reminder_date,
        )
        if result["failedOrderIds"]:
            raise CommandError(
                "Reminders deels mislukt: "
                f"{len(result['sentOrderIds'])} verzonden, "
                f"{len(result['failedOrderIds'])} mislukt."
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Registratiereminders verwerkt: "
                f"{len(result['sentOrderIds'])} verzonden, "
                f"{len(result['skippedOrderIds'])} overgeslagen, "
                f"{len(result['dueProductKeys'])} product(en) gepland."
            )
        )
