# Okno 🪟

> Polish for "window" - A window to your memories

**Okno** is a Google Photos digital photo frame that runs in your browser. No monthly fees, no proprietary hardware, just beautiful memories displayed on any device.

🎉 **v0.1.0 - Family Use Release** - Built for Sam + Alicja across two homes

---

## ✨ Features

### Photo Slideshow
- 📸 **Three Display Modes:** Fill Screen, Show All, or 2 Portraits side-by-side
- ⏱️ **Interval Controls:** 10s, 30s, 1m, 2m, 5m
- 🖥️ **Fullscreen Support** with smooth transitions
- 🎨 **Beautiful Crossfades** between photos
- ⌨️ **Keyboard Shortcuts** (desktop): Space, arrows, Esc

### Google Photos Integration
- ☁️ **Up to 2000 photos** from Google Photos Picker
- 🔄 **Auto-refresh URLs** every 50 minutes (no expiry issues)
- 💾 **Persistent cache** - photos remembered across visits
- 🔐 **OAuth 2.0** with secure token refresh

### Security
- 🔒 **Email allowlist** - family-only access
- 🛡️ **HTTPS enforced** in production
- 🍪 **Secure sessions** with httpOnly cookies
- ✅ **CSRF protection** for OAuth flow

### iPad Optimized
- 👆 **Touch controls** - tap to show/hide
- 💡 **Sleep mode reminder** for Auto-Lock settings
- 📱 **Responsive design** for all screen sizes
- 🏠 **PWA-ready** - add to home screen

---

## 🚀 Quick Start

### For Family Use (Current Setup)

1. Visit **https://okno.moonacle.com**
2. Click "Select Photos"
3. Authenticate with Google (sam@samshennan.com or alicja.chodara@gmail.com)
4. Select up to 2000 photos from your library
5. Click "Start Slideshow"
6. Tap screen to show controls
7. Tap "Fullscreen" for immersive experience

**iPad Tips:**
- Set Auto-Lock to "Never" (Settings → Display & Brightness)
- Add to home screen for app-like experience
- Use "2 Portraits" mode for portrait photo collections

---

## 🏗️ Architecture

```
┌─────────────────┐
│   iPad/Browser  │
│  (Slideshow UI) │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│  nginx (SSL)    │
│  Reverse Proxy  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Node.js/Express│
│  - Auth (OAuth) │
│  - Photo Proxy  │
│  - Cache Mgmt   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Google Photos   │
│  Picker API     │
└─────────────────┘
```

**Tech Stack:**
- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JS
- **Storage:** File-based sessions + JSON cache
- **API:** Google Photos Picker API + OAuth 2.0
- **Deployment:** Ubuntu VPS + nginx + PM2 + Let's Encrypt

---

## 📋 Current Limitations

### Google Picker Limitations
- ❌ No "Select All" button - must click each photo manually
- ⚠️ 2000 photo maximum (Google's limit, not ours)
- 🔄 Must re-select photos to change collection

### Single-Tenant Design
- ⚠️ Shared OAuth token - one Google account at a time
- ⚠️ Shared photo cache - both homes see same photos
- ✅ Perfect for family with shared Google Photos library
- ❌ Not suitable for public/multi-user deployment (yet)

See [ROADMAP.md](ROADMAP.md) for planned improvements.

---

## 🗺️ Roadmap

### Phase 2: Photo Management (Next)
- Thumbnail grid view
- Toggle photos on/off
- Select All / Unselect All
- Edit selection without re-picking 2000 photos

### Phase 3: Video Support
- Include videos toggle
- Video playback in slideshow

### Phase 4: Multi-Tenant
- Per-user authentication
- Per-user photo collections
- Public GitHub release

### Phase 5: Full Library Sync
- Cloud storage integration
- Support for >2000 photos
- Background sync

See [ROADMAP.md](ROADMAP.md) for full details.

---

## 🔒 Security

### Current Setup (Family Use)
- ✅ Email allowlist (sam@samshennan.com, alicja.chodara@gmail.com)
- ✅ HTTPS enforced
- ✅ CSRF protection
- ✅ Secure session cookies
- ✅ Security audit completed

### Not Recommended For
- ❌ Public deployment (single-tenant design)
- ❌ Multiple separate users (shared token/cache)
- ❌ Sensitive/private photos (unless email allowlist configured)

See [SECURITY-AUDIT.md](SECURITY-AUDIT.md) for detailed analysis.

---

## 📦 Deployment

### Production (Current)
```bash
# VPS: Hetzner Cloud Ubuntu 22.04
# Domain: okno.moonacle.com
# SSL: Let's Encrypt

# Quick deploy
./deploy-to-vps.sh

# Update existing deployment
./update-vps.sh
```

See [VPS-DEPLOYMENT-GUIDE.md](VPS-DEPLOYMENT-GUIDE.md) for full setup.

### Local Development
```bash
# Install dependencies
npm install

# Set up environment variables
cp okno.env .env
# Edit .env with your Google OAuth credentials

# Start server
npm start

# Visit http://localhost:3100
```

---

## 🤝 Contributing

**Current Status:** Private family use

**Future:** Open-source portfolio piece (Phase 4)

Contributions welcome after multi-tenant refactor! See [ROADMAP.md](ROADMAP.md) Phase 4.

---

## 📄 License

MIT License - See LICENSE file (to be added in Phase 4)

---

## 🙏 Acknowledgments

- Built with [Claude Code](https://claude.com/claude-code) by Anthropic
- Uses [Google Photos Picker API](https://developers.google.com/photos/picker/guides)
- Inspired by commercial digital frames (Aura, Nixplay) but free and self-hosted

---

## 📞 Support

**For Family Use:**
- Sam: sam@samshennan.com
- If slideshow not working, check https://okno.moonacle.com/api/health

**For Future Open Source:**
- GitHub Issues (after Phase 4 release)
- Documentation wiki
- Discord community (planned)

---

## 🎯 Project Goals

1. ✅ **Family photo frame** - Two homes, shared memories
2. ✅ **Zero monthly fees** - Self-hosted, no subscriptions
3. ✅ **iPad native** - Touch-optimized, PWA-ready
4. ⏳ **Photo management** - Easy curation (Phase 2)
5. ⏳ **Open source** - Portfolio piece (Phase 4)

---

**Made with ❤️ for family memories**

*Okno (Polish): window - A window into our shared memories across two homes* 🪟
