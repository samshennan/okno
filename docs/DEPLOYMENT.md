---
project: okno
type: setup
tags: [project/okno, type/setup, area/docs]
---

# Deployment Guide

Two paths: Docker (recommended) or manual Node + PM2.

---

## Prerequisites

- A server running Linux (Ubuntu 22.04+ recommended)
- A domain name pointing to your server
- SSL via Let's Encrypt (certbot)
- Google OAuth credentials — see [GOOGLE-OAUTH-SETUP.md](GOOGLE-OAUTH-SETUP.md)

---

## Docker (recommended)

### 1. Install Docker

Follow the [official Docker install guide](https://docs.docker.com/engine/install/ubuntu/) for your distro.

### 2. Clone and configure

```bash
git clone https://github.com/samshennan/okno.git
cd okno
cp .env.example .env
```

Edit `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
SESSION_SECRET=your-random-secret   # openssl rand -hex 32
PORT=3100
NODE_ENV=production

# Optional: restrict to specific Google accounts
# ALLOWED_EMAILS=you@gmail.com,partner@gmail.com
```

### 3. Start the container

```bash
docker compose up -d
```

Photo data and logs are persisted in `./data` and `./logs` on the host.

### 4. Configure nginx

Copy the template:

```bash
sudo cp nginx.conf.template /etc/nginx/sites-available/okno
sudo nano /etc/nginx/sites-available/okno
```

Replace `YOUR_DOMAIN` with your actual domain. Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/okno /etc/nginx/sites-enabled/okno
sudo nginx -t && sudo systemctl reload nginx
```

### 5. SSL with certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN
```

Certbot will edit your nginx config to add HTTPS and set up auto-renewal.

---

## Manual (Node 18+ + PM2)

### 1. Install Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. Clone and install

```bash
git clone https://github.com/samshennan/okno.git /var/www/okno
cd /var/www/okno
npm ci --omit=dev
cp .env.example .env
# fill in .env
```

### 3. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed instructions to enable auto-start on reboot
```

### 4. nginx and SSL

Same as the Docker path above (steps 4 and 5).

---

## ALLOWED_EMAILS

By default, any Google account can sign in to your Okno instance. If you want to restrict access to specific accounts:

```env
ALLOWED_EMAILS=you@gmail.com,partner@gmail.com
```

Values are comma-separated, case-insensitive, and trimmed. Anyone not on the list is redirected to `/login?error=access_denied`.

Leave the variable unset (or empty) to allow all Google accounts.

---

## Updating

### Docker

```bash
git pull
docker compose down && docker compose up -d --build
```

### PM2

```bash
git pull
npm ci --omit=dev
pm2 restart okno
```

---

## Health check

```
GET /api/health
```

Returns JSON with uptime, cache stats, and auth status. Useful for monitoring.

---

## Logs

| Path | Contents |
|------|----------|
| `logs/combined.log` | All log output |
| `logs/error.log` | Errors only |

Or via PM2: `pm2 logs okno`

---

## Troubleshooting

**Port 3100 already in use**
```bash
sudo ss -tlnp | grep 3100
```
Change the `PORT` in `.env` if needed, and update your nginx config to match.

**"Redirect URI mismatch" error during login**
Check that your Google Cloud redirect URI exactly matches `https://YOUR_DOMAIN/auth/callback` — no trailing slash, correct scheme.

**Frame goes blank after a week**
Your OAuth consent screen is still in "Testing" mode. See [GOOGLE-OAUTH-SETUP.md](GOOGLE-OAUTH-SETUP.md) — publish to "In Production".

**better-sqlite3 build errors (Docker)**
The Dockerfile uses a multi-stage build with the native build tools (python3, make, g++) in the builder stage. If you are building outside Docker, ensure you have those tools installed: `sudo apt install -y python3 make g++`
