# Okno Marketing Copy

Options for home page hero section.

---

## Option 1: Simple & Direct

### Hero
**Your Photos. Your iPad. Zero Subscriptions.**

Transform your iPad into a beautiful digital photo frame. Connect your Google Photos and let your memories shine—no monthly fees, no proprietary hardware, just you and your photos.

### Why Login?
We need permission to access your Google Photos so you can select which photos to display. Your login is secure, your photos stay private, and we never store your images—just the links to display them.

**Your privacy matters:** We only access photos you explicitly select. Nothing else.

---

## Option 2: Emotional & Story-Driven

### Hero
**A Window to Your Memories** 🪟

Remember when photos lived on walls, not in clouds? Okno brings them back—beautifully displayed, always changing, reminding you of moments that matter.

Turn any iPad into a window to your favorite memories. No subscriptions. No hassle. Just photos.

### Why Login?
To show your photos, we need your permission to access Google Photos. Think of it like handing us a key to your photo album—we'll only look at the pages you want to share.

**What we see:** Only the photos you select
**What we don't see:** Your other albums, location data, or personal info
**What we store:** Nothing. Your photos stream directly from Google.

---

## Option 3: Problem → Solution

### Hero
**Tired of Paying $10/Month for a Photo Frame?**

Digital photo frames shouldn't cost more than Netflix. Okno is free, open-source, and runs on the iPad you already own.

- ✅ No monthly fees ($0 forever)
- ✅ No proprietary hardware ($0 to start)
- ✅ Your photos, your control (privacy-first)

### Why Login?
We use Google's secure login to access your photos with your permission. It's the same technology banks use—except we're just borrowing photos for your slideshow.

**After you login:**
1. Select up to 2,000 photos
2. Start your slideshow
3. That's it. No payment, no signup, no catch.

---

## Option 4: Technical & Transparent

### Hero
**Open-Source Photo Frame. Self-Hosted. Privacy-First.**

For people who don't want another subscription, another account, or another company storing their family photos.

Okno connects directly to Google Photos, lets you pick your favorites, and displays them on your iPad. No middleman. No data collection. No bullshit.

### Why Login?
**What happens when you click "Login with Google Photos":**

1. Google asks: "Allow Okno to see photos you select?"
2. You say yes (or no—your choice)
3. We get a secure token to fetch ONLY the photos you pick
4. We never see your password, emails, or other photos
5. You can revoke access anytime in your Google account settings

**What we do with your photos:**
- ✅ Stream them for your slideshow
- ✅ Cache metadata (titles, dates) for 50 minutes
- ❌ Never upload or store actual images
- ❌ Never share with anyone (including us)

**Your data, your control.** Revoke access anytime: [Google Account Settings](https://myaccount.google.com/permissions)

---

## Option 5: Benefit-Focused (Recommended)

### Hero
**Your Memories, Always Visible**

Turn your iPad into a beautiful photo frame that displays your favorite Google Photos. No subscriptions, no hardware to buy—just your memories, rotating throughout the day.

**Perfect for:**
- 📸 Family photos in your living room
- 🏠 Vacation memories in your home office
- 👴 Sharing memories with loved ones across homes
- 🎁 Gifts (just log in and leave it for grandparents)

### Why Login with Google?

**Short answer:** So we can show your photos!

**Long answer:**
When you click "Login with Google Photos," we ask Google for permission to access the photos you select—nothing more. Your login is secure (we never see your password), and your photos stay private.

**What we access:**
- ✅ Only photos you explicitly select (up to 2,000)
- ✅ Photo metadata (dates, dimensions) to display them properly

**What we DON'T access:**
- ❌ Your other Google Photos albums
- ❌ Your Gmail, contacts, or location data
- ❌ Anything you don't select

**What we store:**
- Photo IDs and temporary display links (expire every hour)
- No actual images—they stream directly from Google

**Your peace of mind:**
- You can revoke access anytime in your [Google Account settings](https://myaccount.google.com/permissions)
- We're open-source—[see the code on GitHub](https://github.com/samshennan/okno)
- No tracking, no ads, no data selling

---

## Trust Signals to Add

### Security Badges
```
🔒 Secure Google OAuth
✅ Open-Source Code
🚫 No Data Collection
🔐 HTTPS Encrypted
```

### Social Proof (When Available)
```
★★★★★ "Best free photo frame solution" - Reddit r/selfhosted
⭐ 1,000+ GitHub stars
👥 10,000+ photos displayed daily
```

### Privacy Promise
```
We never:
- Store your images
- Track your activity
- Sell your data
- Require payment

We only:
- Display photos you select
- Cache temporary links (60-min expiry)
- Keep the slideshow running smoothly
```

---

## Call-to-Action Variations

### Primary CTA
- "Start Your Slideshow" (action-oriented)
- "Try It Free Forever" (benefit-oriented)
- "Login with Google Photos" (direct)
- "See Your Photos Now" (immediate)

### Secondary CTA
- "How It Works"
- "Why We Need Login"
- "View on GitHub"
- "Learn More"

---

## Recommended Copy for Current Users (Sam + Alicja)

Since you have email allowlist active, consider this friendly version:

### Hero
**Welcome Home** 🪟

Your family photo frame is ready. Login to select photos and start your slideshow across both homes.

### Why Login?
This is your private photo frame for Sam and Alicja. We use Google login to securely access your shared photo library and display your selected favorites.

**What happens:**
1. Login with your Google account
2. Select up to 2,000 photos
3. Start slideshow on your iPad
4. Photos refresh automatically every hour

**Privacy:** Only you and Alicja can access this frame. Your photos never leave Google's servers—we just display them.

---

## FAQ Section (Optional)

**Q: Why do you need my Google login?**
A: To access your Google Photos library and let you choose which photos to display. We use Google's secure OAuth system—the same tech banks use.

**Q: Do you store my photos?**
A: No. We only store temporary links (called baseUrls) that expire every hour. Your actual photos stay safely in Google Photos.

**Q: Can you see all my photos?**
A: No. You explicitly select which photos we can display (up to 2,000). We can't see anything else in your Google account.

**Q: What if I don't trust you?**
A: Fair! We're open-source—[check the code yourself](https://github.com/samshennan/okno). You can also self-host it on your own server.

**Q: How much does it cost?**
A: $0 forever. No subscriptions, no hidden fees, no ads.

**Q: Can I revoke access?**
A: Yes, anytime. Go to [Google Account Permissions](https://myaccount.google.com/permissions) and remove Okno.

---

## Recommended Final Copy (For Home Page)

**Combine Option 5 (Benefit-Focused) with FAQ section**

**Reasoning:**
- Clear value proposition
- Addresses privacy concerns upfront
- Shows trust signals
- Multiple CTAs for different user types
- FAQ reduces friction

**Implementation:**
```html
<section class="hero">
  <h1>Your Memories, Always Visible</h1>
  <p class="subtitle">Transform your iPad into a beautiful photo frame...</p>
  <button class="cta-primary">Login with Google Photos</button>
  <button class="cta-secondary">Why We Need Login?</button>
</section>

<section class="trust-signals">
  🔒 Secure Google OAuth | ✅ Open-Source | 🚫 No Data Collection
</section>

<section class="why-login">
  <h2>Why Login with Google?</h2>
  <p>So we can show your photos! Your login is secure...</p>
  [Expand with Option 5 content]
</section>

<section class="faq">
  <h2>Questions?</h2>
  [FAQ items]
</section>
```

---

**Next Step:** Choose a copy option and I'll implement it in `public/index.html`!
