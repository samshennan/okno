# Google OAuth Setup Guide for Okno

**Project:** Okno (created in Google Cloud Console)
**Account:** sam@samshennan.com
**Goal:** Get OAuth Client ID and Secret for Google Photos Picker API

---

## Part 1: Enable Required APIs

### Step 1.1: Enable Google Photos Library API

1. In Google Cloud Console, go to **Navigation Menu** (☰) → **APIs & Services** → **Library**
2. Search for: `Google Photos Library API`
3. Click on **Google Photos Library API**
4. Click **Enable**
5. Wait for it to enable (~5 seconds)

### Step 1.2: Enable Google Picker API

1. Still in **API Library**, search for: `Google Picker API`
2. Click on **Google Picker API**
3. Click **Enable**
4. Wait for it to enable

**Note:** You might also see "Photos Picker API" - enable that too if you see it.

---

## Part 2: Configure OAuth Consent Screen

**Why:** This is what users see when they authenticate. **MUST** be set to "In Production" to avoid 7-day token expiry.

### Step 2.1: Start OAuth Consent Screen Setup

1. Go to **Navigation Menu** (☰) → **APIs & Services** → **OAuth consent screen**
2. Select **User Type:**
   - Choose **External** (allows any Google account to auth)
   - Click **Create**

### Step 2.2: App Information

Fill in the form:

| Field | Value |
|-------|-------|
| **App name** | `Okno` |
| **User support email** | `sam@samshennan.com` |
| **App logo** | (optional - skip for now) |
| **Application home page** | `https://okno.moonacle.com` |
| **Application privacy policy link** | (optional - leave blank) |
| **Application terms of service link** | (optional - leave blank) |
| **Authorized domains** | Add: `moonacle.com` |
| **Developer contact information** | `sam@samshennan.com` |

Click **Save and Continue**

### Step 2.3: Scopes

**What to add:**

1. Click **Add or Remove Scopes**
2. Search and select these scopes:
   - `https://www.googleapis.com/auth/photoslibrary.readonly` (Read-only access to Google Photos)
   - `https://www.googleapis.com/auth/userinfo.email` (See your email address)
   - `https://www.googleapis.com/auth/userinfo.profile` (See your personal info)

3. Click **Update**
4. Click **Save and Continue**

### Step 2.4: Test Users (Skip if Publishing)

- Click **Save and Continue** (skip adding test users for now)

### Step 2.5: Summary

- Review the summary
- Click **Back to Dashboard**

### Step 2.6: Publish App (CRITICAL!)

**⚠️ IMPORTANT:** This step prevents 7-day token expiry!

1. On the OAuth consent screen dashboard, you should see a yellow banner saying "Testing" or similar
2. Click **Publish App** button
3. Confirm by clicking **Confirm** in the popup

**Status should change to:** "In Production" or "Published"

**Why this matters:** If left in "Testing" mode, OAuth tokens expire after 7 days and you'd need to re-authenticate constantly.

---

## Part 3: Create OAuth 2.0 Credentials

### Step 3.1: Navigate to Credentials

1. Go to **Navigation Menu** (☰) → **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** (at the top)
3. Select **OAuth client ID**

### Step 3.2: Application Type

1. **Application type:** Select **Web application**
2. **Name:** `Okno Backend`

### Step 3.3: Authorized Redirect URIs

**Critical:** This tells Google where to redirect after authentication.

1. Under **Authorized redirect URIs**, click **+ Add URI**
2. Enter **EXACTLY:** `https://okno.moonacle.com/auth/callback`
3. Double-check spelling and HTTPS!

### Step 3.4: Create

1. Click **Create**
2. A popup appears with your credentials!

**⚠️ IMPORTANT:** Keep this popup open! You'll copy these in the next step.

---

## Part 4: Save Credentials to 1Password

### Step 4.1: Copy Client ID

1. In the credentials popup, find **Your Client ID**
2. Click the **Copy** icon
3. Keep it in your clipboard

### Step 4.2: Create 1Password Item

1. Open **1Password app**
2. Click **New Item** → **Login**
3. Fill in:
   - **Title:** `Okno Google OAuth`
   - **Username:** (leave empty or type "OAuth")
   - **Password:** (leave empty)

### Step 4.3: Add Client ID as Custom Field

1. Click **Add more** → **Text field**
2. **Label:** `client_id`
3. **Value:** Paste the Client ID you copied
4. Click **Save** (the field, not the item yet)

### Step 4.4: Copy Client Secret

1. Back in the Google popup, find **Your Client Secret**
2. Click the **Copy** icon

### Step 4.5: Add Client Secret as Custom Field

1. In the same 1Password item, click **Add more** → **Text field**
2. **Label:** `client_secret`
3. **Value:** Paste the Client Secret
4. Click the **eye icon** to toggle it to "concealed" (optional but recommended)
5. **Vault:** Ensure it's in **Personal** vault

### Step 4.6: Save Item

1. Click **Save** to save the entire 1Password item
2. **Done!** You can close the Google credentials popup now.

---

## Part 5: Verification

### Check You Have Everything:

**In 1Password, you should now have:**
- ✅ **Okno Session Secret** (Password type)
- ✅ **Okno Google OAuth** (Login type with `client_id` and `client_secret` fields)

**In Google Cloud Console:**
- ✅ Google Photos Library API enabled
- ✅ OAuth consent screen configured and **Published** (In Production)
- ✅ OAuth 2.0 Client created with redirect URI: `https://okno.moonacle.com/auth/callback`

### Test 1Password CLI Access:

Open terminal and run:

```bash
# Test Client ID
op read "op://Personal/Okno Google OAuth/client_id"

# Test Client Secret
op read "op://Personal/Okno Google OAuth/client_secret"

# Test Session Secret
op read "op://Personal/Okno Session Secret/password"
```

**Expected:** Each command prints the actual value (not an error).

---

## Part 6: Create okno.env File

Now create the environment file with 1Password references:

```bash
# Navigate to your project
cd "c:\AI LAB\01_AI_Experiments\OKNO"

# Create okno.env with secret references
cat > okno.env << 'EOF'
# Okno Environment Variables (1Password References)
GOOGLE_CLIENT_ID="op://Personal/Okno Google OAuth/client_id"
GOOGLE_CLIENT_SECRET="op://Personal/Okno Google OAuth/client_secret"
SESSION_SECRET="op://Personal/Okno Session Secret/password"
EOF

# Test it works
op run --env-file=okno.env -- node -e "console.log('Client ID:', process.env.GOOGLE_CLIENT_ID)"
```

**Expected:** Should print your actual Client ID (not the reference path).

---

## Troubleshooting

### "App is in Testing mode" warning
- **Fix:** Go back to OAuth consent screen → Click **Publish App**

### "Redirect URI mismatch" error (during OAuth flow)
- **Fix:** Verify redirect URI is exactly: `https://okno.moonacle.com/auth/callback`
- Check for typos, HTTP vs HTTPS, trailing slashes

### "API not enabled" error
- **Fix:** Go to API Library → Enable Google Photos Library API

### 1Password CLI returns error
- **Fix:** Run `op signin` to authenticate
- Verify item name matches exactly: `Okno Google OAuth`
- Verify field names: `client_id` and `client_secret` (lowercase, underscore)

---

## Next Steps

✅ **You've completed:**
- DNS configuration
- Google OAuth setup
- 1Password secrets storage

📋 **Next up:**
- Create 1Password Service Account (for VPS)
- Deploy code to VPS
- Configure nginx + SSL
- Start the app!

**Ready to continue? Let me know when you've completed these steps!**
