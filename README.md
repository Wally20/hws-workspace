# Ecwid bestellingen overzicht

Dit project draait nu als Django-project. De bestaande applicatielogica is tijdelijk via een compatibiliteitslaag gekoppeld, zodat de huidige pagina's en API-endpoints blijven werken terwijl deployment voortaan via Django loopt.

## Wat je nog nodig hebt

Voor live data zijn deze Ecwid-gegevens nodig:

- `ECWID_STORE_ID`
- `ECWID_SECRET_TOKEN`
- `MONEYBIRD_API_TOKEN`
- `MONEYBIRD_ADMINISTRATION_ID` (optioneel als de token toegang heeft tot maar 1 administratie)

Met alleen een public token kun je geen bestellingen ophalen.

## Starten

Het project gebruikt Python 3.13.15 (zie `.python-version`) en Django 5.2 LTS.

1. Maak met Python 3.13.15 een virtuele omgeving:

   ```bash
   python3.13 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Maak een `.env` bestand op basis van `.env.example` en vul je Ecwid-gegevens in:

   ```bash
   cp .env.example .env
   ```

3. Initialiseer de opslag en start daarna de app:

   ```bash
   python3 manage.py init_storage
   python3 manage.py runserver 127.0.0.1:8000
   ```

4. Open:

   ```text
   http://127.0.0.1:8000
   ```

Voer vóór een release de geïsoleerde deploycontrole uit. Deze gebruikt een tijdelijke datamap en verstuurt geen echte integratiemails:

```bash
./scripts/check_release.sh
```

## Opslag

De app gebruikt nu een SQLite-database op `data/app.db` voor:

- dashboard-events
- agenda-trainings
- trainerprofielen

Bestaande data uit `data/dashboard_events.json` en `data/agenda_trainings.json` wordt door `python manage.py init_storage` naar SQLite gemigreerd als de database nog leeg is. Initialisatie gebeurt bewust niet meer tijdens een gewone module-import.

Vóór iedere muterende opslaginitialisatie maakt het commando met SQLite's online backup-API een consistente, atomisch gepubliceerde snapshot in `DATA_DIR/backups/`. Standaard blijven de laatste zeven snapshots staan; pas dit zo nodig aan met `STORAGE_BACKUP_RETENTION` (1–30). Deze lokale snapshots zijn een extra vangnet en vervangen geen externe serverbackup.

SQLite draait na initialisatie in WAL-modus. Runtimeverbindingen gebruiken `synchronous=NORMAL` en wachten standaard maximaal 30 seconden op een schrijflock (`SQLITE_BUSY_TIMEOUT_MS=30000`).

Voor productie hoort runtime-data niet in de git-worktree te staan. Zet daarom in `.env`:

```dotenv
DATA_DIR=/var/lib/overzicht/data
```

## Server checklist

Zorg op je server voor:

1. Python 3.13.15 met de vastgezette packages uit `requirements.txt`.
2. Schrijfrechten voor de app-gebruiker op `DATA_DIR` en `static/uploads/`.
3. Dat `DATA_DIR` meegenomen wordt in je back-ups, inclusief `app.db`.
4. Je `.env` met:
   - `ECWID_STORE_ID`
   - `ECWID_SECRET_TOKEN`
   - `MONEYBIRD_API_TOKEN`
   - `MONEYBIRD_ADMINISTRATION_ID`
   - `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` en `REGISTRATION_AUTO_EMAILS_ENABLED=1` voor automatische inschrijvingsmails via STRATO
   - `DJANGO_SECRET_KEY`
   - `FLASK_SECRET_KEY` (nog gebruikt door de legacy compatibiliteitslaag)
   - `DATA_DIR` (bijvoorbeeld `/var/lib/overzicht/data`)
   - optioneel: `ADMIN_PASSWORD`, `ADMIN_EMAIL`

## Inloggen

De website is nu beveiligd met een login.

- Als er nog geen admin-account bestaat, maakt de app automatisch een beheeraccount aan in `data/app.db`.
- Gebruik op je server direct `DJANGO_SECRET_KEY`, `FLASK_SECRET_KEY`, `ADMIN_PASSWORD` en `ADMIN_EMAIL` in je `.env`.

## Agenda-API

Beheerders vinden de agenda-koppeling onder **Management → API**. Daar staan:

- de read-only JSON-URL;
- de API-sleutel en complete `.env`-configuratie voor het ontvangende project;
- voorbeelden voor Python en JavaScript/Node.js;
- een geheime iCalendar-URL voor Google Calendar, Apple Agenda en Outlook;
- een actie om de sleutel direct te vernieuwen en de oude koppeling in te trekken.

JSON-endpoint:

```text
GET /api/v1/agenda/events
Authorization: Bearer <API-sleutel>
```

Optionele queryparameters zijn `start`, `end`, `include_cancelled` en `include_day_plans`. Zonder datumbereik worden alle afspraken teruggegeven.

Zet in productie bij voorkeur een aparte sterke signing secret:

```dotenv
AGENDA_API_SECRET=<minimaal-32-willekeurige-tekens>
```

Als deze ontbreekt, gebruikt de koppeling `DJANGO_SECRET_KEY`. Wijziging van de gebruikte signing secret maakt bestaande API-sleutels ongeldig.

Server-side gebruik heeft de voorkeur. Wanneer een browser op een ander domein de JSON-API rechtstreeks moet aanroepen, configureer dan uitsluitend de exacte toegestane origins:

```dotenv
AGENDA_API_ALLOWED_ORIGINS=https://persoonlijk.example.nl,https://beheer.example.nl
```

Voorbeeld deployment-commando's:

```bash
cd /pad/naar/Overzicht
python3.13 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdir -p /var/lib/overzicht/data
chmod 775 /var/lib/overzicht/data
python3 manage.py init_storage
python3 manage.py runserver 127.0.0.1:8000
```

## Eenmalige serverfix voor vastlopende `git pull`

Als je server eerder live schreef naar `/srv/overzicht/data/app.db`, verplaats die data dan eenmalig buiten de repo:

```bash
sudo systemctl stop overzicht
sudo mkdir -p /var/lib/overzicht/data
sudo cp /srv/overzicht/data/app.db /var/lib/overzicht/data/app.db
sudo cp /srv/overzicht/data/dashboard_events.json /var/lib/overzicht/data/dashboard_events.json
sudo cp /srv/overzicht/data/agenda_trainings.json /var/lib/overzicht/data/agenda_trainings.json
sudo chown -R www-data:www-data /var/lib/overzicht
```

Zet daarna `DATA_DIR=/var/lib/overzicht/data` in `/srv/overzicht/.env`, pull de nieuwe versie en start de service opnieuw. Vanaf dat moment schrijft productie niet meer in een door git beheerde map en blokkeert `git pull` hier niet meer op.

## Opmerking

Als `.env` of de Ecwid-omgevingsvariabelen ontbreken, draait het besteloverzicht in demo-modus met voorbeeldbestellingen. De rapporttegel laat Moneybird-omzet alleen live zien als de Moneybird-variabelen zijn ingevuld.

Voor live gebruik start `scripts/start.sh` eerst één opslaginitialisatie en daarna Gunicorn met `config.wsgi:application`. De ongebruikte Gunicorn-controlsocket staat daarbij expliciet uit, zodat de service geen schrijfbare home-directory nodig heeft.
Open je `templates/index.html` direct in Five Server, dan werkt het dashboard in statische demo-modus.

## Automatische inschrijvingsmails via STRATO

De app kan nieuwe betaalde Ecwid-inschrijvingen automatisch een bevestigingsmail sturen. Zet hiervoor in `.env`:

```dotenv
EMAIL_HOST=smtp.strato.de
EMAIL_PORT=587
EMAIL_USE_SSL=0
EMAIL_USE_TLS=1
EMAIL_HOST_USER=info@hwsvoetbalschool.nl
EMAIL_HOST_PASSWORD=<strato-mailbox-wachtwoord>
DEFAULT_FROM_EMAIL=info@hwsvoetbalschool.nl
REGISTRATION_AUTO_EMAILS_ENABLED=1
REGISTRATION_AUTO_EMAILS_START_DATE=2026-06-03
REGISTRATION_EMAIL_ONLY_PAID=1
REGISTRATION_EMAIL_SYNC_ECWID_PROCESSING=1
ECWID_AUTO_RETURN_REFUNDED_ORDERS=1
REGISTRATION_EMAIL_FROM_NAME=HWS Voetbalschool
REGISTRATION_EMAIL_SUBJECT=Bevestiging inschrijving HWS Voetbalschool
REGISTRATION_EMAIL_BCC=david.van.walstijn@gmail.com
REGISTRATION_EMAIL_REPLY_TO=info@hwsvoetbalschool.nl
```

Laat `REGISTRATION_AUTO_EMAILS_ENABLED=0` staan zolang je alleen wilt testen zonder echte mails te versturen. Zet `REGISTRATION_AUTO_EMAILS_START_DATE` op de datum waarop automatische mails live mogen gaan, zodat oude orders niet alsnog worden gemaild.

Met `ECWID_AUTO_RETURN_REFUNDED_ORDERS=1` zet de server volledig terugbetaalde Ecwid-bestellingen tijdens iedere live Ecwid-synchronisatie automatisch op afhandelstatus `RETURNED`. Gedeeltelijk terugbetaalde bestellingen worden niet aangepast.
