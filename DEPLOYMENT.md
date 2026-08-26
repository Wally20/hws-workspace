# Productie-deployment naast bestaand Django-project

Dit project draait nu als Django-project. Je kunt het veilig naast je bestaande Django-site draaien door het een eigen map, eigen virtualenv, eigen Gunicorn-service en eigen `nginx` server block te geven.

## 1. Hoe dit project in productie gestart moet worden

- WSGI entrypoint: `config.wsgi:application`
- Django startpunt voor development: `manage.py`
- Productieserver: Gunicorn achter `nginx`
- Reverse proxy: `nginx` op een apart subdomein
- Procesmodel: aparte `systemd` service, eigen poort, geen overlap met bestaand Django-project

Deze app gebruikt:

- Python 3.13.15 en Django 5.2 LTS
- SQLite database: `data/app.db`
- Templates: `templates/`
- Static files: `static/`
- Persistente lokale uploads: `/var/lib/overzicht/uploads/` via `LOCAL_UPLOAD_ROOT`

Gebruik in productie altijd een `DATA_DIR` buiten de git-worktree, bijvoorbeeld `/var/lib/overzicht/data`. Dan kunnen SQLite en sessiebestanden vrij schrijven zonder toekomstige `git pull` blokkades.

Voor de legacy businessdata zijn geen Django model-migraties nodig; de bestaande SQLite-tabellen in `data/app.db` blijven in gebruik.

## 2. Benodigde `.env` variabelen

Minimaal voor productie:

```dotenv
DJANGO_SECRET_KEY=<lange-random-secret>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=www.workspace.hwsvoetbalschool.nl
DJANGO_CSRF_TRUSTED_ORIGINS=https://www.workspace.hwsvoetbalschool.nl
DATA_DIR=/var/lib/overzicht/data
LOCAL_UPLOAD_ROOT=/var/lib/overzicht/uploads
SQLITE_BUSY_TIMEOUT_MS=30000
STORAGE_BACKUP_RETENTION=7
FLASK_SECRET_KEY=<lange-random-secret>
TRUSTED_HOSTS=www.workspace.hwsvoetbalschool.nl
SESSION_COOKIE_NAME=overzicht_session
SESSION_COOKIE_SECURE=1
SESSION_COOKIE_SAMESITE=Lax
SESSION_IDLE_TIMEOUT_SECONDS=3600
SESSION_ABSOLUTE_TIMEOUT_SECONDS=43200
SESSION_EXPIRE_AT_BROWSER_CLOSE=1
TRAINER_INVITE_TTL_HOURS=48
PREFERRED_URL_SCHEME=https
REVERSE_PROXY_HOPS=1
ADMIN_EMAIL=admin@jouwdomein.nl
ADMIN_PASSWORD=<sterk-wachtwoord>
AGENDA_API_SECRET=<aparte-lange-random-secret>
AGENDA_API_ALLOWED_ORIGINS=
ECWID_STORE_ID=<ecwid-store-id>
ECWID_SECRET_TOKEN=<ecwid-secret-token>
MONEYBIRD_API_TOKEN=<moneybird-api-token>
MONEYBIRD_ADMINISTRATION_ID=<moneybird-administratie-id>
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
REGISTRATION_EMAIL_FROM_NAME=HWS Voetbalschool
REGISTRATION_EMAIL_SUBJECT=Bevestiging inschrijving HWS Voetbalschool
REGISTRATION_EMAIL_BCC=david.van.walstijn@gmail.com
REGISTRATION_EMAIL_REPLY_TO=info@hwsvoetbalschool.nl
```

Optioneel voor Bunny image storage:

```dotenv
BUNNY_STORAGE_REGION=storage
BUNNY_STORAGE_ZONE=<zone>
BUNNY_STORAGE_ACCESS_KEY=<storage-password>
BUNNY_API_ACCESS_KEY=<api-key>
BUNNY_IMAGE_PUBLIC_BASE=https://<pull-zone>.b-cdn.net
BUNNY_IMAGE_BASE_PATH=content
BUNNY_IMAGE_MAX_UPLOAD_MB=15
BUNNY_IMAGE_ALLOWED_TYPES=image/jpeg,image/png,image/webp,image/avif
BUNNY_VIDEO_PUBLIC_BASE=https://<pull-zone>.b-cdn.net
BUNNY_VIDEO_BASE_PATH=exercise-videos
BUNNY_VIDEO_MAX_UPLOAD_MB=5000
BUNNY_VIDEO_ALLOWED_TYPES=video/mp4,video/webm,video/quicktime
LOCAL_VIDEO_MAX_UPLOAD_MB=250
```

Zonder een complete Bunny-configuratie worden uploads lokaal opgeslagen. De
lokale videolimiet blijft bewust 250 MB, zodat één upload de persistente schijf
niet kan vullen. Met Bunny blijft de ruimere `BUNNY_VIDEO_MAX_UPLOAD_MB` gelden.

Optioneel:

```dotenv
FLASK_DEBUG=0
PORT=8011
```

## 3. Exacte startopdracht

Gebruik het startscript, zodat opslaginitialisatie en de voorafgaande SQLite-backup precies één keer vóór het forken van Gunicorn plaatsvinden. Poort `8011` botst niet met de bestaande Django/Gunicorn-setup:

```bash
/srv/overzicht/scripts/start.sh \
  --workers 2 \
  --threads 2 \
  --bind 127.0.0.1:8011 \
  --access-logfile - \
  --error-logfile - \
  --timeout 7200
```

## 4. Voorstel `systemd` service

Bestand: `/etc/systemd/system/overzicht.service`

```ini
[Unit]
Description=Overzicht Django app via Gunicorn
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/srv/overzicht
EnvironmentFile=/srv/overzicht/.env
ExecStart=/srv/overzicht/scripts/start.sh \
    --workers 2 \
    --threads 2 \
    --bind 127.0.0.1:8011 \
    --access-logfile - \
    --error-logfile - \
    --timeout 7200
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 5. Voorstel `nginx` server block voor apart subdomein

Bestand: `/etc/nginx/sites-available/www.workspace.hwsvoetbalschool.nl`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name www.workspace.hwsvoetbalschool.nl;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.workspace.hwsvoetbalschool.nl;

    ssl_certificate /etc/letsencrypt/live/www.workspace.hwsvoetbalschool.nl/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/www.workspace.hwsvoetbalschool.nl/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 5000M;

    location /static/uploads/ {
        alias /var/lib/overzicht/uploads/;
        access_log off;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        add_header X-Content-Type-Options "nosniff" always;
    }

    location /static/ {
        alias /srv/overzicht/staticfiles/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:8011;
        proxy_read_timeout 7200s;
        proxy_send_timeout 7200s;
        proxy_connect_timeout 300s;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_redirect off;
    }
}
```

## 6. Static/media mappen

- Static root voor `nginx`: `/srv/overzicht/staticfiles/`
- Persistente lokale uploads: `/var/lib/overzicht/uploads/`
- SQLite data: `/var/lib/overzicht/data/`
- Databasebestand: `/var/lib/overzicht/data/app.db`
- Aanbevolen limiet voor mapuploads: `CONTENT_UPLOAD_MAX_REQUEST_MB=250` en `CONTENT_UPLOAD_MAX_FILES=500`

Gebruik in productie bij voorkeur `collectstatic`, zodat `nginx` uit `staticfiles/` kan serveren.

## 7. Precieze deploystappen

Voorbeeld met een nieuwe map `/srv/overzicht` en subdomein `www.workspace.hwsvoetbalschool.nl`.

### Servermap en bestanden

```bash
sudo mkdir -p /srv/overzicht /var/lib/overzicht/data /var/lib/overzicht/uploads
sudo chown -R $USER:www-data /srv/overzicht /var/lib/overzicht
rsync -av --delete /pad/naar/lokale/Overzicht/ /srv/overzicht/
cd /srv/overzicht
```

### Virtualenv en packages

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Environmentbestand

```bash
cp .env.example .env
nano .env
```

### Rechten voor database en uploads

```bash
sudo mkdir -p /var/lib/overzicht/data /var/lib/overzicht/uploads
sudo chown -R www-data:www-data /srv/overzicht /var/lib/overzicht
sudo find /srv/overzicht -type d -exec chmod 755 {} \;
sudo find /srv/overzicht -type f -exec chmod 644 {} \;
sudo chmod 755 /srv/overzicht/scripts/*.sh
sudo find /var/lib/overzicht -type d -exec chmod 755 {} \;
sudo find /var/lib/overzicht -type f -exec chmod 644 {} \;
sudo chmod 775 /var/lib/overzicht/data /var/lib/overzicht/uploads
```

### Eenmalige app-initialisatie

Er zijn geen Django model-migraties nodig voor de legacy applicatiedata. Initialiseer die opslag wel expliciet. `init_storage` maakt vóór schema- of seedwijzigingen een consistente SQLite-snapshot in `DATA_DIR/backups/`, publiceert die atomisch en bewaart standaard de laatste zeven backups. Als de backup mislukt, start de migratie niet. De lokale snapshots vervangen geen externe backup van het volledige `DATA_DIR`.

De releasecontrole draait deploychecks en de volledige testset uitsluitend tegen tijdelijke data. Daarna initialiseer je de live opslag en kun je `collectstatic` draaien.

```bash
source /srv/overzicht/.venv/bin/activate
cd /srv/overzicht
./scripts/check_release.sh
.venv/bin/python manage.py init_storage
.venv/bin/python manage.py collectstatic --noinput
```

Het initialisatiecommando zet SQLite duurzaam in WAL-modus. Iedere applicatieverbinding gebruikt daarnaast `synchronous=NORMAL` en een instelbare busy timeout. Het productieproces is beperkt tot twee workers met twee threads om de gelijktijdige schrijfdruk op SQLite beheersbaar te houden.

De meegeleverde periodieke `systemd`-services voeren hetzelfde commando als `ExecStartPre` en als gebruiker `www-data` uit. Daardoor kunnen facturen, registratiemails en spaarpotmeldingen ook op een nieuwe server nooit vóór de opslaginitialisatie starten, zonder root-owned databasebestanden achter te laten.

### Eenmalige migratie voor bestaande servers

Als je eerder live draaide met `/srv/overzicht/data/app.db`, verplaats die data eerst buiten de repo voordat je nieuwe deploys doet:

```bash
sudo systemctl stop overzicht
sudo mkdir -p /var/lib/overzicht/data
sudo cp /srv/overzicht/data/app.db /var/lib/overzicht/data/app.db
sudo cp /srv/overzicht/data/dashboard_events.json /var/lib/overzicht/data/dashboard_events.json
sudo cp /srv/overzicht/data/agenda_trainings.json /var/lib/overzicht/data/agenda_trainings.json
sudo chown -R www-data:www-data /var/lib/overzicht
```

Zorg daarna dat `/srv/overzicht/.env` `DATA_DIR=/var/lib/overzicht/data` bevat voordat je Gunicorn opnieuw start.

### Gunicorn handmatig testen

```bash
cd /srv/overzicht
source .venv/bin/activate
./scripts/start.sh \
  --workers 2 \
  --threads 2 \
  --bind 127.0.0.1:8011 \
  --access-logfile - \
  --error-logfile - \
  --timeout 7200
```

### `systemd` activeren

```bash
sudo cp /srv/overzicht/deploy/overzicht.service /etc/systemd/system/overzicht.service
```

Als je het servicebestand niet in de repo zet, maak het direct aan in `/etc/systemd/system/overzicht.service` met de inhoud hierboven en voer daarna uit:

```bash
sudo systemctl daemon-reload
sudo systemctl enable overzicht
sudo systemctl start overzicht
sudo systemctl status overzicht
```

### `nginx` activeren

```bash
sudo nano /etc/nginx/sites-available/www.workspace.hwsvoetbalschool.nl
sudo ln -s /etc/nginx/sites-available/www.workspace.hwsvoetbalschool.nl /etc/nginx/sites-enabled/www.workspace.hwsvoetbalschool.nl
sudo nginx -t
sudo systemctl reload nginx
```

### SSL certificaat

Als Let's Encrypt nog niet bestaat:

```bash
sudo certbot --nginx -d www.workspace.hwsvoetbalschool.nl
```

### Updates / restart flow

Bij een nieuwe release:

```bash
cd /srv/overzicht
source .venv/bin/activate
pip install -r requirements.txt
./scripts/check_release.sh
.venv/bin/python manage.py collectstatic --noinput
sudo systemctl restart overzicht
sudo systemctl reload nginx
```

## 8. ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, SSL en reverse proxy headers

- `ALLOWED_HOSTS`: instellen via `DJANGO_ALLOWED_HOSTS=www.workspace.hwsvoetbalschool.nl`
- `CSRF_TRUSTED_ORIGINS`: instellen via `DJANGO_CSRF_TRUSTED_ORIGINS=https://www.workspace.hwsvoetbalschool.nl`
- Django's CSRF-middleware beveiligt nieuwe native views. De tijdelijke legacy-wrappers blijven vrijgesteld van die dubbele controle en valideren hun bestaande CSRF-token server-side; migreer die wrappers stapsgewijs naar native Django-views.
- SSL: afdwingen via `nginx` redirect van `80 -> 443`
- Reverse proxy headers: `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Port`, `X-Forwarded-For`. Laat nginx deze headers overschrijven; voeg geen door de client aangeleverde waarden vooraan toe.
- App-config voor proxy: `REVERSE_PROXY_HOPS=1` bij precies één vertrouwde nginx-/platformproxy. Zonder proxy blijft de veilige standaard `0`, zodat forwardingheaders worden genegeerd.
- Session cookies: `SESSION_COOKIE_SECURE=1`, een idle timeout van 3600 seconden en een absolute timeout van 43200 seconden. De sessiecookie verloopt standaard ook bij het sluiten van de browser.

## 9. Mogelijke conflicten met bestaand project op dezelfde server

Geen conflict zolang je deze scheiding aanhoudt:

- eigen map: `/srv/overzicht`
- eigen virtualenv: `/srv/overzicht/.venv`
- eigen Gunicorn service: `overzicht.service`
- eigen bind-adres: `127.0.0.1:8011`
- eigen subdomein: `www.workspace.hwsvoetbalschool.nl`
- eigen `nginx` server block

Let extra op:

- gebruik niet dezelfde Gunicorn-poort als je bestaande Django-project
- gebruik niet dezelfde `systemd` servicenaam
- gebruik niet dezelfde projectmap of virtualenv
- gebruik niet dezelfde domeinnaam of `server_name`
- zorg dat `www-data` schrijfrechten heeft op `DATA_DIR` en `LOCAL_UPLOAD_ROOT`
- deze app gebruikt SQLite; dat is prima voor lichte interne tooling, maar minder geschikt voor zware gelijktijdige schrijfacties

## 10. Direct uitvoerbaar stappenplan

```bash
sudo mkdir -p /srv/overzicht
sudo chown -R $USER:www-data /srv/overzicht
rsync -av --delete /pad/naar/lokale/Overzicht/ /srv/overzicht/
cd /srv/overzicht

python3.13 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

cp .env.example .env
nano .env

sudo mkdir -p /var/lib/overzicht/data /var/lib/overzicht/uploads
sudo chown -R www-data:www-data /srv/overzicht
sudo find /srv/overzicht -type d -exec chmod 755 {} \;
sudo find /srv/overzicht -type f -exec chmod 644 {} \;
sudo chmod 755 /srv/overzicht/scripts/*.sh
sudo chmod 775 /var/lib/overzicht/data /var/lib/overzicht/uploads

./scripts/check_release.sh
.venv/bin/python manage.py collectstatic --noinput

./scripts/start.sh \
  --workers 2 \
  --threads 2 \
  --bind 127.0.0.1:8011 \
  --access-logfile - \
  --error-logfile - \
  --timeout 7200
```

Daarna:

1. Maak `/etc/systemd/system/overzicht.service` aan met het servicebestand hierboven.
2. Maak `/etc/nginx/sites-available/www.workspace.hwsvoetbalschool.nl` aan met het server block hierboven.
3. Voer uit:

```bash
sudo systemctl daemon-reload
sudo systemctl enable overzicht
sudo systemctl start overzicht
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d www.workspace.hwsvoetbalschool.nl
sudo systemctl restart overzicht
```
