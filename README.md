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

1. Maak een virtuele omgeving:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Maak een `.env` bestand op basis van `.env.example` en vul je Ecwid-gegevens in:

   ```bash
   cp .env.example .env
   ```

3. Start de app:

   ```bash
   python3 manage.py runserver 127.0.0.1:8000
   ```

4. Open:

   ```text
   http://127.0.0.1:8000
   ```

## Opslag

De app gebruikt nu een SQLite-database op `data/app.db` voor:

- dashboard-events
- agenda-trainings
- trainerprofielen

Bestaande data uit `data/dashboard_events.json` en `data/agenda_trainings.json` wordt bij de eerste start automatisch naar SQLite gemigreerd als de database nog leeg is.

Voor productie hoort runtime-data niet in de git-worktree te staan. Zet daarom in `.env`:

```dotenv
DATA_DIR=/var/lib/overzicht/data
```

## Server checklist

Zorg op je server voor:

1. Een Python-omgeving met de packages uit `requirements.txt`.
2. Schrijfrechten voor de app-gebruiker op `DATA_DIR` en `static/uploads/`.
3. Dat `DATA_DIR` meegenomen wordt in je back-ups, inclusief `app.db`.
4. Je `.env` met:
   - `ECWID_STORE_ID`
   - `ECWID_SECRET_TOKEN`
   - `MONEYBIRD_API_TOKEN`
   - `MONEYBIRD_ADMINISTRATION_ID`
   - `DJANGO_SECRET_KEY`
   - `FLASK_SECRET_KEY` (nog gebruikt door de legacy compatibiliteitslaag)
   - `DATA_DIR` (bijvoorbeeld `/var/lib/overzicht/data`)
   - optioneel: `ADMIN_PASSWORD`, `ADMIN_EMAIL`

## Inloggen

De website is nu beveiligd met een login.

- Als er nog geen admin-account bestaat, maakt de app automatisch een beheeraccount aan in `data/app.db`.
- Gebruik op je server direct `DJANGO_SECRET_KEY`, `FLASK_SECRET_KEY`, `ADMIN_PASSWORD` en `ADMIN_EMAIL` in je `.env`.

Voorbeeld deployment-commando's:

```bash
cd /pad/naar/Overzicht
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
mkdir -p /var/lib/overzicht/data
chmod 775 /var/lib/overzicht/data
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

Voor live gebruik draait productie via Gunicorn met `config.wsgi:application`.
Open je `templates/index.html` direct in Five Server, dan werkt het dashboard in statische demo-modus.
