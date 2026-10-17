# DNS Setup for okno.moonacle.com

**Quick reference for Squarespace DNS configuration**

---

## Step 1: Log into Squarespace

1. Go to [Squarespace Login](https://login.squarespace.com/)
2. Select `moonacle.com` domain

---

## Step 2: Add DNS Record

Navigate to: **Settings → Domains → moonacle.com → DNS Settings**

Click **Add Record** and enter:

| Field | Value |
|-------|-------|
| **Record Type** | A |
| **Host** | okno |
| **Points to** | 159.69.152.123 |
| **TTL** | 3600 (or use default) |

---

## Step 3: Verify DNS Propagation

Wait 5-30 minutes, then test:

```bash
nslookup okno.moonacle.com
```

**Expected output:**
```
Name:    okno.moonacle.com
Address: 159.69.152.123
```

---

## Troubleshooting

**If DNS doesn't resolve after 30 minutes:**
1. Check that you used `okno` (not `okno.moonacle.com`) as the Host
2. Verify the IP is exactly `159.69.152.123`
3. Try flushing your local DNS cache:
   - Windows: `ipconfig /flushdns`
   - macOS: `sudo dscacheutil -flushcache`

**Check DNS propagation globally:**
- https://www.whatsmydns.net/#A/okno.moonacle.com

---

## What This Does

This A record tells DNS servers that `okno.moonacle.com` should resolve to your Hetzner VPS at IP `159.69.152.123`.

Once this is configured and propagated:
- nginx on your VPS will receive traffic for `okno.moonacle.com`
- Let's Encrypt can verify your domain ownership for SSL certificate
- Your app will be accessible at `https://okno.moonacle.com`

---

**Next step:** Continue with [DEPLOYMENT.md](DEPLOYMENT.md) Step 3 (VPS setup)
