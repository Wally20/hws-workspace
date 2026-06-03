from datetime import datetime

from django.core.management.base import BaseCommand, CommandError

import app as legacy


class Command(BaseCommand):
    help = "Stuur een testmail met dezelfde template als automatische Ecwid-inschrijvingsmails."

    def add_arguments(self, parser):
        parser.add_argument("recipient", help="E-mailadres waar de testbevestiging naartoe moet.")
        parser.add_argument(
            "--product-name",
            default="HWS Voetbalschool testinschrijving",
            help="Productnaam die in de testmail wordt gebruikt.",
        )
        parser.add_argument(
            "--order-number",
            default="TEST-ECWID-AANMELDING",
            help="Ordernummer dat in de testmail wordt gebruikt.",
        )

    def handle(self, *args, **options):
        recipient = str(options["recipient"] or "").strip()
        if not legacy.is_valid_email_address(recipient):
            raise CommandError("Vul een geldig ontvangstadres in.")

        if not legacy.registration_auto_email_is_configured():
            raise CommandError(
                "Automatische inschrijvingsmail is niet volledig geconfigureerd. "
                "Controleer REGISTRATION_AUTO_EMAILS_ENABLED, EMAIL_HOST_USER, "
                "EMAIL_HOST_PASSWORD en DEFAULT_FROM_EMAIL."
            )

        order = {
            "id": "TEST-ECWID-AANMELDING",
            "orderNumber": options["order_number"],
            "createdAt": datetime.now().astimezone().isoformat(),
            "status": "PAID",
            "paymentStatus": "PAID",
            "email": recipient,
            "customerName": "David van Walstijn",
            "orderExtraFields": [
                {"title": "Voornaam", "value": "Test"},
                {"title": "Achternaam", "value": "Inschrijving"},
            ],
        }
        item = {
            "productId": "test",
            "name": options["product_name"],
            "quantity": 1,
            "price": 0,
            "sku": "TEST",
        }

        try:
            legacy.send_registration_confirmation_email(order, item)
        except Exception as exc:
            raise CommandError(f"Testmail kon niet worden verstuurd: {exc}") from exc

        self.stdout.write(self.style.SUCCESS(f"Testbevestiging verstuurd naar {recipient}."))
