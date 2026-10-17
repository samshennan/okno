# Phase 6: Stripe + Demo Mode - Context

**Gathered:** 2026-02-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Two independent features: (1) a demo mode that lets unauthenticated visitors experience the full Okno slideshow with sample photos, and (2) Stripe integration for one-click donations from signed-in users. Demo mode is fully isolated from real user data.

</domain>

<decisions>
## Implementation Decisions

### Demo content & experience
- Mix of personal-feel (travel, family, pets, food) and scenic/landscape photos — shows the app works for all photo types
- 10-15 sample photos — enough variety without long load times
- Demo cycles through all photos once, then shows end-of-demo CTA (not infinite loop)
- Sample photos include fake EXIF dates so the photo date overlay displays naturally during the demo

### Demo entry & indicator
- "Try Demo" button placement on home page: Claude's discretion (based on existing layout)
- Subtle "Demo" pill/badge in a corner during slideshow — visible but doesn't distract from photos
- No settings access in demo mode — runs with defaults only (Ken Burns ON, blur ON, photo date ON, clock OFF)
- Full PWA support — demo can be installed and run fullscreen, showing the complete experience
- Direct URL route (/demo) — shareable, linkable from README

### Donate button & amounts
- Donate button on settings page ("Support Okno" section) — not in feedback modal
- Donation amount approach: Claude's discretion (balance simplicity with flexibility)
- One-time donations only — no recurring/subscription
- Casual/fun tone — "Buy me a coffee" or "Support Okno" style, friendly indie developer vibe
- Donate button only visible to signed-in users, not in demo mode

### Demo-to-signup flow
- After one cycle completes: end-of-demo CTA design is Claude's discretion
- Two options at end: "Watch again" (restart demo) and "Use your own photos" (sign in) — no pressure
- /demo route goes straight to demo slideshow — easy to share

### Claude's Discretion
- "Try Demo" button placement and visual weight on home page
- Donation amount structure (fixed vs presets vs custom)
- End-of-demo CTA design (full-screen vs overlay)
- Demo photo selection and curation (within the mix-of-both and 10-15 count constraints)
- Sample photo file format and optimization

</decisions>

<specifics>
## Specific Ideas

- Demo should showcase all visual effects (Ken Burns, blur, date overlay) so visitors see the full experience
- Fake dates on demo photos should span different months/years to show the date overlay working naturally
- /demo URL is important for the README portfolio link (Phase 7 depends on this)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-stripe-+-demo-mode*
*Context gathered: 2026-02-15*
