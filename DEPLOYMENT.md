# Productie-deployment naast bestaand Django-project

Dit project draait nu als Django-project. Je kunt het veilig naast je bestaande Django-site draaien door het een eigen map, eigen virtualenv, eigen Gunicorn-service en eigen `nginx` server block te geven.

## 1. Hoe dit project in productie gestart moet worden

- WSGI entrypoint: `config.wsgi:application`
- Django startpunt voor development: `manage.py`
- Productieserver: Gunicorn achter `nginx`
- Reverse proxy: `nginx` op een apart subdomein
- Procesmodel: aparte `systemd` service, eigen poort, geen overlap met bestaand Django-project

Deze app gebruikt:

- SQLite database: `data/app.db`
- Templates: `templates/`
- Static files: `static/`
- Uploads/media-achtig pad: `static/uploads/`

Voor de legacy businessdata zijn geen Django model-migraties nodig; de bestaande SQLite-tabellen in `data/app.db` blijven in gebruik.

## 2. Benodigde `.env` variabelen

Minimaal voor productie:

```dotenv
DJANGO_SECRET_KEY=<lange-random-secret>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=www.workspace.hwsvoetbalschool.nl
DJANGO_CSRF_TRUSTED_ORIGINS=https://www.workspace.hwsvoetbalschool.nl
FLASK_SECRET_KEY=<lange-random-secret>
TRUSTED_HOSTS=www.workspace.hwsvoetbalschool.nl
SESSION_COOKIE_NAME=overzicht_session
SESSION_COOKIE_SECURE=1
SESSION_COOKIE_SAMESITE=Lax
PREFERRED_URL_SCHEME=https
REVERSE_PROXY_HOPS=1
ADMIN_EMAIL=admin@jouwdomein.nl
ADMIN_PASSWORD=<sterk-wachtwoord>
ECWID_STORE_ID=<ecwid-store-id>
ECWID_SECRET_TOKEN=<ecwid-secret-token>
MONEYBIRD_API_TOKEN=<moneybird-api-token>
MONEYBIRD_ADMINISTRATION_ID=<moneybird-administratie-id>
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
```

Optioneel:

```dotenv
FLASK_DEBUG=0
PORT=8011
```

## 3. Exacte Gunicorn startopdracht

Gebruik bijvoorbeeld poort `8011`, zodat dit niet botst met je bestaande Django/Gunicorn setup:

```bash
/srv/overzicht/.venv/bin/gunicorn \
  --workers 2 \
  --threads 4 \
  --bind 127.0.0.1:8011 \
  --access-logfile - \
  --error-logfile - \
  --timeout 120 \
  config.wsgi:application
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
ExecStart=/srv/overzicht/.venv/bin/gunicorn \
    --workers 2 \
    --threads 4 \
    --bind 127.0.0.1:8011 \
    --access-logfile - \
    --error-logfile - \
    --timeout 120 \
    config.wsgi:application
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

    client_max_body_size 20M;

    location /static/ {
        alias /srv/overzicht/staticfiles/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:8011;
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
- Uploads/media-achtig pad: `/srv/overzicht/static/uploads/`
- SQLite data: `/srv/overzicht/data/`
- Databasebestand: `/srv/overzicht/data/app.db`

Gebruik in productie bij voorkeur `collectstatic`, zodat `nginx` uit `staticfiles/` kan serveren.

## 7. Precieze deploystappen

Voorbeeld met een nieuwe map `/srv/overzicht` en subdomein `www.workspace.hwsvoetbalschool.nl`.

### Servermap en bestanden

```bash
sudo mkdir -p /srv/overzicht
sudo chown -R $USER:www-data /srv/overzicht
rsync -av --delete /pad/naar/lokale/Overzicht/ /srv/overzicht/
cd /srv/overzicht
```

### Virtualenv en packages

```bash
python3 -m venv .venv
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
mkdir -p data static/uploads
sudo chown -R www-data:www-data /srv/overzicht
sudo find /srv/overzicht -type d -exec chmod 755 {} \;
sudo find /srv/overzicht -type f -exec chmod 644 {} \;
sudo chmod 775 /srv/overzicht/data /srv/overzicht/static/uploads
```

### Eenmalige app-initialisatie

Er zijn geen Django model-migraties nodig voor de applicatiedata.
Wel kun je veilig `manage.py check` en `collectstatic` draaien.

```bash
source /srv/overzicht/.venv/bin/activate
cd /srv/overzicht
.venv/bin/python manage.py check
.venv/bin/python manage.py collectstatic --noinput
```

### Gunicorn handmatig testen

```bash
cd /srv/overzicht
source .venv/bin/activate
.venv/bin/gunicorn \
  --workers 2 \
  --threads 4 \
  --bind 127.0.0.1:8011 \
  --access-logfile - \
  --error-logfile - \
  --timeout 120 \
  config.wsgi:application
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
sudo systemctl restart overzicht
sudo systemctl reload nginx
```

## 8. ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, SSL en reverse proxy headers

- `ALLOWED_HOSTS`: instellen via `DJANGO_ALLOWED_HOSTS=www.workspace.hwsvoetbalschool.nl`
- `CSRF_TRUSTED_ORIGINS`: instellen via `DJANGO_CSRF_TRUSTED_ORIGINS=https://www.workspace.hwsvoetbalschool.nl`
- De legacy formulieren draaien nu zonder Django CSRF-checks, zodat de bestaande templates blijven werken. Dat is functioneel compatibel, maar wel een security-punt om later nog netjes te moderniseren.
- SSL: afdwingen via `nginx` redirect van `80 -> 443`
- Reverse proxy headers: `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Port`, `X-Forwarded-For`
- App-config voor proxy: `REVERSE_PROXY_HOPS=1`
- Session cookies: `SESSION_COOKIE_SECURE=1`

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
- zorg dat `www-data` schrijfrechten heeft op `data/` en `static/uploads/`
- deze app gebruikt SQLite; dat is prima voor lichte interne tooling, maar minder geschikt voor zware gelijktijdige schrijfacties

## 10. Direct uitvoerbaar stappenplan

```bash
sudo mkdir -p /srv/overzicht
sudo chown -R $USER:www-data /srv/overzicht
rsync -av --delete /pad/naar/lokale/Overzicht/ /srv/overzicht/
cd /srv/overzicht

python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

cp .env.example .env
nano .env

mkdir -p data static/uploads
sudo chown -R www-data:www-data /srv/overzicht
sudo find /srv/overzicht -type d -exec chmod 755 {} \;
sudo find /srv/overzicht -type f -exec chmod 644 {} \;
sudo chmod 775 /srv/overzicht/data /srv/overzicht/static/uploads

.venv/bin/python manage.py check
.venv/bin/python manage.py collectstatic --noinput

.venv/bin/gunicorn \
  --workers 2 \
  --threads 4 \
  --bind 127.0.0.1:8011 \
  --access-logfile - \
  --error-logfile - \
  --timeout 120 \
  config.wsgi:application
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
