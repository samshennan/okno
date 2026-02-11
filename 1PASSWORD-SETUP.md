# 1Password Setup for Okno

**Purpose:** Store all Okno secrets in 1Password with CLI-friendly references

---

## Overview

We'll create **3 items** in 1Password that the app needs:
1. **Google OAuth credentials** (Client ID + Secret)
2. **Session secret** (random string for Express sessions)
3. **Service Account token** (for VPS to access 1Password)

---

## Item 1: Google OAuth Credentials

**When to create:** After you get Client ID and Secret from Google Cloud Console

**Category:** Login (this works best for CLI references)

**Item Name:** `Okno Google OAuth`

**Fields to fill:**

| Field Name | What to Store | Example | CLI Reference |
|------------|---------------|---------|---------------|
| `username` | (leave empty or put "OAuth") | — | — |
| `password` | (leave empty) | — | — |
| `client_id` (custom field) | Google OAuth Client ID | `123456-abcdef.apps.googleusercontent.com` | `op://Personal/Okno Google OAuth/client_id` |
| `client_secret` (custom field) | Google OAuth Client Secret | `GOCSPX-abc123xyz` | `op://Personal/Okno Google OAuth/client_secret` |

### How to Create:

1. Open 1Password app
2. Click **New Item** → Select **Login**
3. Title: `Okno Google OAuth`
4. Username: (leave empty or type "OAuth")
5. Click **Add more** → **Text field**
   - Label: `client_id`
   - Value: [paste Client ID from Google]
6. Click **Add more** → **Password** or **Text field**
   - Label: `client_secret`
   - Value: [paste Client Secret from Google]
   - Toggle "concealed" if using text field
7. Section: (leave default or add to "Credentials" section)
8. Vault: **Personal** (or whichever vault you prefer)
9. Click **Save**

---

## Item 2: Session Secret

**When to create:** Right now (before deployment)

**Category:** Password (stores a single secure value)

**Item Name:** `Okno Session Secret`

**What it is:** A random 32+ character string for encrypting Express session cookies

### How to Create:

1. Open 1Password app
2. Click **New Item** → Select **Password**
3. Title: `Okno Session Secret`
4. Click **Generate New Password**
   - Length: 32-64 characters
   - Include: Letters, numbers, symbols
5. Vault: **Personal**
6. Click **Save**

**CLI Reference:** `op://Personal/Okno Session Secret/password`

---

## Item 3: 1Password Service Account Token

**When to create:** After you create a Service Account in 1Password (Step 4 below)

**Category:** API Credential

**Item Name:** `Okno 1Password Service Account`

**What it is:** Token that allows VPS to read secrets from 1Password without interactive login

### How to Create:

1. Open 1Password web app: https://my.1password.com
2. Navigate to: **Settings → Developer → Service Accounts**
3. Click **Create Service Account**
4. Name: `Okno VPS`
5. Grant access to vault: **Personal** (or whichever vault has your Okno secrets)
6. Permissions: **Read-only** (more secure)
7. Click **Create Service Account**
8. **IMPORTANT:** Copy the token immediately (shown once only!)
9. Save to 1Password:
   - Click **New Item** → **API Credential**
   - Title: `Okno 1Password Service Account`
   - API Key field: [paste the token]
   - Vault: **Personal**
   - Click **Save**

**CLI Reference:** `op://Personal/Okno 1Password Service Account/credential`

---

## Testing CLI Access (Local)

After creating items, test you can access them:

```bash
# Test Google OAuth Client ID
op read "op://Personal/Okno Google OAuth/client_id"

# Test Google OAuth Client Secret
op read "op://Personal/Okno Google OAuth/client_secret"

# Test Session Secret
op read "op://Personal/Okno Session Secret/password"

# Test Service Account Token (only after creating it)
op read "op://Personal/Okno 1Password Service Account/credential"
```

**Expected result:** Each command should print the secret value

---

## The okno.env File (Secret References)

**When to create:** After all 3 items exist in 1Password

**What it is:** A file with 1Password secret references (NOT the actual secrets)

**Where:** Create this file in your project root (it's gitignored)

**Filename:** `okno.env`

**Contents:**

```bash
# Okno Environment Variables (1Password References)
# These are SECRET REFERENCES, not actual secrets
# 1Password CLI injects real values at runtime

GOOGLE_CLIENT_ID="op://Personal/Okno Google OAuth/client_id"
GOOGLE_CLIENT_SECRET="op://Personal/Okno Google OAuth/client_secret"
SESSION_SECRET="op://Personal/Okno Session Secret/password"
```

### How to Create:

```bash
# Create the file locally (for testing)
cat > okno.env << 'EOF'
GOOGLE_CLIENT_ID="op://Personal/Okno Google OAuth/client_id"
GOOGLE_CLIENT_SECRET="op://Personal/Okno Google OAuth/client_secret"
SESSION_SECRET="op://Personal/Okno Session Secret/password"
EOF

# Test it works locally
op run --env-file=okno.env -- node -e "console.log('Client ID:', process.env.GOOGLE_CLIENT_ID)"
```

**Expected result:** Should print your actual Client ID (not the reference path)

---

## VPS Setup (Using Service Account)

**On the VPS**, you'll set the Service Account token as an environment variable:

```bash
# SSH into VPS
ssh root@159.69.152.123

# Set OP_SERVICE_ACCOUNT_TOKEN permanently
echo 'export OP_SERVICE_ACCOUNT_TOKEN="ops_token_here"' >> ~/.bashrc
source ~/.bashrc

# Test it works
op read "op://Personal/Okno Google OAuth/client_id"
```

**Then** you can use `./start.sh` which runs:
```bash
op run --env-file=okno.env -- pm2 start ecosystem.config.js
```

This injects all secrets into PM2/Node.js environment at startup.

---

## Security Notes

✅ **DO:**
- Store the Service Account token in 1Password itself
- Use `op run` to inject secrets (never hardcode)
- Keep `okno.env` in `.gitignore` (it's already there)
- Use read-only Service Account permissions

❌ **DON'T:**
- Commit `okno.env` to git (even with references)
- Store raw secrets in environment files
- Share the Service Account token in plain text
- Give write permissions to Service Account

---

## Quick Reference Table

| Secret | 1Password Item | Field Path | Environment Variable |
|--------|----------------|------------|---------------------|
| OAuth Client ID | Okno Google OAuth | `client_id` | `GOOGLE_CLIENT_ID` |
| OAuth Client Secret | Okno Google OAuth | `client_secret` | `GOOGLE_CLIENT_SECRET` |
| Session Secret | Okno Session Secret | `password` | `SESSION_SECRET` |
| Service Account (VPS only) | Okno 1Password Service Account | `credential` | `OP_SERVICE_ACCOUNT_TOKEN` |

---

## Timeline

**Now (Steps 1-2):**
1. Create "Okno Google OAuth" item (after getting credentials from Google)
2. Create "Okno Session Secret" item (generate random password)

**Before VPS deployment (Step 3):**
3. Create "Okno 1Password Service Account" item (from 1Password web app)

**During VPS deployment:**
4. Create `okno.env` file on VPS with secret references
5. Set `OP_SERVICE_ACCOUNT_TOKEN` in VPS environment
6. Test with `op read` commands

---

## Next Steps

Once you have Google OAuth credentials from Cloud Console:
1. Store them in 1Password (this guide, Item 1)
2. Generate session secret in 1Password (this guide, Item 2)
3. Create `okno.env` locally for testing
4. Continue to VPS deployment

**Ready to continue with Google Cloud Console OAuth setup?**
