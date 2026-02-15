# Phase 6: User Setup Required

**Generated:** 2026-02-15
**Phase:** 06-stripe-+-demo-mode
**Status:** Incomplete

Complete these items for the Stripe donation integration to function. Claude automated everything possible; these items require human access to the Stripe Dashboard.

## Environment Variables

No environment variables needed -- Stripe Payment Links are URL-based, not API-based.

## Dashboard Configuration

- [ ] **Create a Stripe Payment Link**
  - Location: Stripe Dashboard -> Payment Links (https://dashboard.stripe.com/payment-links)
  - Steps:
    1. Click "+ New"
    2. Select "Customers choose what to pay"
    3. Title: "Support Okno"
    4. Description: "Buy the developer a coffee"
    5. Suggested amount: $5, minimum: $1
    6. Click "Save"
    7. Copy the generated URL

- [ ] **Replace placeholder URL in settings.html**
  - File: `public/settings.html`
  - Find: `https://buy.stripe.com/PLACEHOLDER`
  - Replace with: The URL copied from step above (e.g., `https://buy.stripe.com/abc123xyz`)

## Verification

After completing setup:

1. Open `public/settings.html` and search for `buy.stripe.com`
2. Confirm the URL is no longer `PLACEHOLDER`
3. Visit the URL in a browser -- it should show a Stripe-hosted payment page

---

**Once all items complete:** Mark status as "Complete" at top of file.
