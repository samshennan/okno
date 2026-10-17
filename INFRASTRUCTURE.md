# Okno Infrastructure

**Created:** 2026-02-10
**Purpose:** Local reference for deployment configuration

## Domain

- **Domain:** `okno.moonacle.com`
- **Root domain:** `moonacle.com`
- **DNS Provider:** Squarespace
- **Expiration:** May 4, 2026

## VPS (Hetzner)

- **Provider:** Hetzner Cloud
- **IP Address:** `159.69.152.123`
- **SSH User:** `root`
- **Console:** https://console.hetzner.com/projects/13253008/servers/118657846/overview
- **n8n URL:** http://159.69.152.123:5678

## Deployment URLs

- **Production:** `https://okno.moonacle.com`
- **API Health:** `https://okno.moonacle.com/api/health`
- **OAuth Callback:** `https://okno.moonacle.com/auth/callback`
- **Random Photo:** `https://okno.moonacle.com/api/photo/random`

## DNS Configuration Required

Add this A record in Squarespace DNS settings:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | okno | 159.69.152.123 | 3600 (1 hour) |

## Ports

- **Express (backend):** 3100
- **n8n:** 5678
- **nginx HTTP:** 80
- **nginx HTTPS:** 443

## SSL

- **Provider:** Let's Encrypt (via certbot)
- **Auto-renewal:** Enabled via certbot timer

---

**Credentials stored in 1Password:**
- Item: "Hetzner n8n AI" (VPS access)
- Item: "Okno Google OAuth" (to be created)
- Item: "Okno Session Secret" (to be created)
