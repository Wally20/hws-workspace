from django.core.management.base import BaseCommand, CommandError

import app as legacy


class Command(BaseCommand):
    help = "Synchroniseer alle lokaal als gemaild gemarkeerde aanmeldingen naar Ecwid fulfillmentstatus PROCESSING."

    def handle(self, *args, **options):
        config = legacy.get_config()
        if not config["store_id"] or not config["secret_token"]:
            raise CommandError("Live Ecwid-koppeling staat nog niet aan. Controleer ECWID_STORE_ID en ECWID_SECRET_TOKEN.")

        order_ids = legacy.load_all_registration_emailed_order_ids()
        if not order_ids:
            self.stdout.write(self.style.WARNING("Er staan geen gemailde bestellingen klaar om te synchroniseren."))
            return

        result = legacy.sync_emailed_registration_orders_to_ecwid(order_ids)
        synced_count = len(result["syncedOrderIds"])
        failed_count = len(result["failedOrderIds"])

        self.stdout.write(self.style.SUCCESS(f"{synced_count} bestellingen naar Ecwid gesynchroniseerd."))
        if failed_count:
            failed_ids = ", ".join(result["failedOrderIds"])
            raise CommandError(f"{failed_count} bestellingen niet bijgewerkt: {failed_ids}")
