# Changelog

All notable changes to Okno will be documented in this file.

## [0.1.0] - 2026-02-10 - v1 LAUNCH 🎉

### 🎯 Vision Achieved
Okno is a Google Photos digital photo frame that runs on iPad. No monthly fees, no proprietary hardware, just beautiful memories displayed across two homes.

### ✨ Features

#### Photo Slideshow
- **Three Display Modes:**
  - **Fill Screen** (cover mode) - Zoom to fill, may crop edges
  - **Show All** (contain mode) - Full photo with black bars
  - **2 Portraits** (dual mode) - Two portrait photos side-by-side
- **Interval Controls:** 10s, 30s, 1m, 2m, 5m
- **Fullscreen Support** with one-tap toggle
- **Smooth Crossfade** transitions (1 second)
- **Random Photo Selection** from cache
- **Control Visibility:** Tap to show, auto-hide after 4 seconds
- **Keyboard Shortcuts** (desktop): Space (play/pause), arrows (prev/next), Esc (exit)

#### Google Photos Integration
- **Photo Picker API** - Select up to 2000 photos
- **OAuth 2.0 Authentication** with refresh tokens
- **Auto-Refresh baseUrls** every 50 minutes (prevents expiry)
- **Image Proxy** with Authorization headers
- **Session Persistence** - Photos remembered across visits
- **Server-Side Cache** - Survives restarts

#### Security
- **Email Allowlist** - Only authorized family members can access
- **HTTPS Enforced** in production (Let's Encrypt SSL)
- **CSRF Protection** for OAuth flow
- **httpOnly Cookies** prevent XSS attacks
- **Session Isolation** with secure file store
- **Helmet.js Security Headers**

#### iPad Optimization
- **Touch Controls** - Tap to show/hide controls
- **Sleep Mode Reminder** - Instructions for Auto-Lock settings
- **Responsive Design** - Works on all screen sizes
- **PWA-Ready** - Can be added to home screen
- **Auto-Redirect** - Refresh slideshow page returns to home

#### VPS Deployment
- **nginx Reverse Proxy** with SSL
- **PM2 Process Manager** for reliability
- **1Password Secrets** management
- **Auto-Restart** on crashes
- **Logging** with Winston (error + combined logs)
- **Health Endpoint** for monitoring

### 🏠 Use Case
- **Two Homes:** Sam's house + Alicja's house
- **Shared Library:** Single Google Photos account
- **Dual iPads:** One photo frame per home
- **Family Only:** Email allowlist security

### 📊 Technical Stats
- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JS (zero dependencies)
- **Storage:** File-based sessions + JSON cache
- **API:** Google Photos Picker API + OAuth 2.0
- **Deployment:** Ubuntu VPS + nginx + PM2
- **SSL:** Let's Encrypt (auto-renewal)

### 🔒 Security Features
- Email allowlist (sam@samshennan.com, alicja.chodara@gmail.com)
- OAuth state CSRF protection
- Secure session cookies (httpOnly, HTTPS-only in prod)
- 1Password integration for secrets
- Security audit completed (see SECURITY-AUDIT.md)

### 🎨 UX Highlights
- **Zero-friction slideshow** - Just tap "Start Slideshow"
- **Persistent controls** - Tap anywhere to show/hide
- **Sleep reminder** - iPad users see Auto-Lock instructions
- **Friendly errors** - Redirects to home if no photos
- **Keyboard help** - Desktop users see shortcuts

### 🐛 Bugs Fixed During Development
- CSP blocking inline scripts → Added unsafe-inline directives
- Function name conflict (`setInterval`) → Renamed to `changeInterval`
- Property mismatch (`cache.size` vs `cache.totalItems`) → Fixed
- baseUrl extraction from nested Picker API structure → Fixed
- `imageResponse.body.pipe` not supported → Switched to Buffer
- Control visibility inconsistent on iPad → JavaScript state management
- Keyboard help showing on iPad → Hidden with media query
- Control buttons missing on iPad → Show on page load + fixed click logic
- Direct slideshow.html access showing error → Auto-redirect to home

### 📝 Documentation
- [SECURITY-AUDIT.md](SECURITY-AUDIT.md) - Comprehensive security analysis
- [ROADMAP.md](ROADMAP.md) - Future features and phases
- [HANDOVER.md](HANDOVER.md) - Session restoration context
- [1PASSWORD-SETUP.md](1PASSWORD-SETUP.md) - Secrets management
- [GOOGLE-OAUTH-SETUP.md](GOOGLE-OAUTH-SETUP.md) - OAuth configuration
- [VPS-DEPLOYMENT-GUIDE.md](VPS-DEPLOYMENT-GUIDE.md) - Infrastructure setup

### 🚀 Deployment
- **Production URL:** https://okno.moonacle.com
- **VPS:** Hetzner Cloud (Ubuntu 22.04)
- **Domain:** moonacle.com (Cloudflare DNS)
- **SSL:** Let's Encrypt via certbot
- **Process Manager:** PM2 with ecosystem config
- **Reverse Proxy:** nginx

### 🙏 Credits
Built with Claude Code (Anthropic) by Sam Shennan for family use.

### 🎯 What's Next?
See [ROADMAP.md](ROADMAP.md) for Phase 2 (Photo Management UI) and beyond.

---

## Future Releases

### [0.2.0] - Photo Management (Planned)
- Thumbnail grid view of all cached photos
- Toggle individual photos on/off
- Select All / Unselect All buttons
- Filter by active/hidden status
- Edit photos without re-selecting 2000 items

### [0.3.0] - Video Support (Planned)
- Include videos toggle
- Video playback in slideshow
- Auto-play with volume control

### [1.0.0] - Multi-Tenant Release (Planned)
- Per-user OAuth tokens
- Per-user photo caches
- Public GitHub release
- Open-source portfolio piece

### [1.1.0] - Full Library Sync (Planned)
- Google Photos Library API integration
- Cloud storage (Cloudflare R2)
- Entire library support (>2000 photos)
- Background sync

---

**Okno** - Polish for "window" 🪟
