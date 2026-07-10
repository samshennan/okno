---
project: okno
type: setup
tags: [project/okno, type/setup, area/docs]
---

# Google OAuth Setup

Okno requires a Google Cloud project with the Photos Picker API enabled. This is a one-time setup. It takes about 15 minutes.

You need a Google account to create the Cloud project — it does not need to be the same account users will sign in with.

---

## 1. Create a Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project selector at the top, then "New Project"
3. Give it a name (e.g. "Okno") and click "Create"

---

## 2. Enable the Photos Picker API

1. In the left menu, go to **APIs & Services > Library**
2. Search for **Photos Picker API**
3. Click it, then click **Enable**

> Note: Do not enable `photoslibrary.readonly` — that scope was removed by Google in March 2025. The correct scope for Okno is `photospicker.mediaitems.readonly`, which is granted automatically when you enable the Photos Picker API.

---

## 3. Configure the OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** as the user type, then click **Create**
3. Fill in the required fields:
   - **App name:** Okno (or whatever you prefer)
   - **User support email:** you@yourdomain.com
   - **Developer contact email:** you@yourdomain.com
4. Click "Save and Continue"

### Add the required scope

1. Click "Add or Remove Scopes"
2. Search for and select: `photospicker.mediaitems.readonly`
3. The email/profile scopes (`userinfo.email`, `userinfo.profile`) should already be listed — confirm they are present
4. Click "Update", then "Save and Continue"

### Skip Test Users

Click "Save and Continue" without adding test users.

### Publish to "In Production" (critical)

On the OAuth consent screen dashboard, click **Publish App** and confirm.

**Why this matters:** If your app is left in "Testing" mode, Google expires OAuth refresh tokens after 7 days. When that happens, Okno loses access to your photos and the frame goes blank. Publishing to "In Production" means tokens last indefinitely (until the user revokes access).

Publishing does not mean Google has reviewed or verified your app — it just means your tokens will not expire. For apps with fewer than 100 users, no verification is required.

---

## 4. Create OAuth credentials

1. Go to **APIs & Services > Credentials**
2. Click **+ Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: anything (e.g. "Okno Backend")
5. Under **Authorised redirect URIs**, add:
   ```
   https://YOUR_DOMAIN/auth/callback
   ```
   Replace `YOUR_DOMAIN` with your actual domain (e.g. `okno.your-domain.com`).
6. Click **Create**

Copy the **Client ID** and **Client Secret** — you will need them in your `.env` file.

---

## 5. The "unverified app" warning

When someone signs in for the first time, Google may show a warning: "Google hasn't verified this app." This is expected — Google only reviews apps that request sensitive scopes or have a large user base.

To proceed:
1. Click "Advanced" (bottom left of the warning screen)
2. Click "Go to [your app name] (unsafe)"

This is a one-time click per Google account. It is safe to proceed — you own the app.

---

## 6. Add credentials to your .env

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

See `.env.example` for the full list of required variables.
