# Frontend hosting (VPS)

Since 2026-10-15 the whole site runs on the VPS (148.230.125.240): the React frontend at
www.capimaxbrx.com (capimaxbrx.com redirects to it) and the Django API at api.capimaxbrx.com.
DNS is managed at Hostinger (nameservers apollo/athena.dns-parking.com).

These files are copies of what is installed on the server:

| File here | On the server |
|---|---|
| `capimax-deploy-frontend.sh` | `/usr/local/sbin/capimax-deploy-frontend.sh` |
| `nginx-capimax-web.conf` | `/etc/nginx/sites-available/capimax-web` |
| `nginx-00-default.conf` | `/etc/nginx/sites-available/00-default` |

Build-time values (public, they end up in the browser bundle) live in
`/etc/capimax/frontend.env`: `VITE_API_BASE_URL`, `VITE_GOOGLE_OAUTH_CLIENT_ID`.

## Deploy the frontend

    ssh root@148.230.125.240 /usr/local/sbin/capimax-deploy-frontend.sh

It pulls `/opt/capimax-brx`, builds that commit as user `capimax` (Node 20 in `/opt/node`),
copies the build to `/var/www/capimax-brx/releases/<time>` and switches the `current`
symlink nginx serves. The last 5 builds are kept; to roll back:

    ln -sfn /var/www/capimax-brx/releases/<older> /var/www/capimax-brx/current

## Certificates

Let's Encrypt via certbot (timer `certbot.timer`): `capimaxbrx.com` + `www` renew over HTTP
(webroot `/var/www/letsencrypt`), `api.capimaxbrx.com` through the nginx plugin.
`/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads nginx after a renewal.
Always run `nginx -t` before reloading (nginx 1.24: use `listen 443 ssl http2;`).
