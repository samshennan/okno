---
phase: 13-architecture-review-security-audit
verified: 2026-03-12T23:16:28Z
status: gaps_found
score: 6/7 must-haves verified
gaps:
  - truth: "No CRITICAL or HIGH findings remain unfixed after the phase"
    status: partial
    reason: "express-rate-limit v7.5.0 was installed but the plan required v8.3.1+ to avoid CVE-2026-30827 (IPv4-mapped IPv6 bypass). v7.x is a separate major version that does not contain the fix. The audit report does not acknowledge this deviation or assess the CVE risk."
    artifacts:
      - path: "package.json"
        issue: "express-rate-limit listed as ^7.5.0, plan required ^8.3.1+"
      - path: ".planning/decisions/SECURITY-AUDIT-v2.md"
        issue: "Section 5 and Section 6 both mark PASS without noting the version shortfall or CVE-2026-30827 status"
    missing:
      - "Upgrade express-rate-limit to ^8.3.1 (or document explicit risk acceptance for CVE-2026-30827)"
      - "Update SECURITY-AUDIT-v2.md to address the version deviation and CVE status"
---

# Phase 13: Architecture Review + Security Audit - Verification Report

**Phase Goal:** Review the full codebase architecture and identify any security vulnerabilities before the app is used by real users. Produce a written findings report and fix all critical/high issues.
**Verified:** 2026-03-12T23:16:28Z
**Status:** gaps_found
**Score:** 6/7 must-haves verified
**Re-verification:** No - initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Session ID changes after OAuth callback (session fixation fixed) | VERIFIED | req.session.regenerate() called at auth.js line 217, followed by req.session.save() before redirect |
| 2 | Rate limiting returns 429 after 10 auth requests in 15 minutes | VERIFIED | authLimiter (max:10, windowMs:15min) applied to /auth/login and /auth/callback in server.js lines 124-125 |
| 3 | Rate limiting returns 429 after 5 feedback submissions in 15 minutes | VERIFIED | feedbackLimiter (max:5, windowMs:15min) applied to /api/feedback in server.js line 172 |
| 4 | Session cookie has sameSite: lax attribute | VERIFIED | sameSite: lax present in session cookie config at server.js line 88 |
| 5 | No API endpoint returns error.message to the client | VERIFIED | Grep across all 4 files confirms zero error.message in any res.json() call; all references are exclusively in logger.error() |
| 6 | SECURITY-AUDIT-v2.md has explicit verdicts for all 8 checklist sections | VERIFIED | All 8 sections present with PASS verdicts; F1-F4 documented as resolved; F5-F8 deferred with rationale |
| 7 | No CRITICAL or HIGH findings remain unfixed after the phase | PARTIAL | Session fixation (CRITICAL), error leaks (HIGH), SameSite (MEDIUM) all fixed. Rate limiting (HIGH) implemented with v7.5.0 instead of required v8.3.1+, leaving CVE-2026-30827 unaddressed and unacknowledged |

**Score: 6/7 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| auth.js | Session regeneration after OAuth callback | VERIFIED | req.session.regenerate() at line 217; req.session.save() inside regenerate callback; redirect only after save succeeds |
| server.js | Rate limiting middleware and SameSite cookie | VERIFIED | rateLimit imported line 23; authLimiter and feedbackLimiter defined lines 97-112; applied lines 124-125 and 172; sameSite: lax line 88 |
| package.json | express-rate-limit dependency | PARTIAL | Package present but at ^7.5.0 - plan required ^8.3.1+ to avoid CVE-2026-30827 |
| photo-proxy.js | Sanitized error responses in 6+ catch blocks | VERIFIED | All catch blocks log real error via logger.error, return only error code strings in responses |
| picker.js | Sanitized error responses, no details: errorData in responses | VERIFIED | All 3 catch blocks and 3 Google error forwards return only error code strings |
| feedback.js | Sanitized error responses in catch blocks | VERIFIED | Main catch, multer handler, and catch-all return generic error strings without error.message |
| health.js | Sanitized error responses + logger added | VERIFIED | Winston logger present; health GET catch returns generic status object; refresh catch returns generic error string |
| .planning/decisions/SECURITY-AUDIT-v2.md | 8 checklist sections with verdicts | VERIFIED | All 8 sections with PASS verdicts; findings table F1-F4 resolved; F5-F8 deferred |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| auth.js OAuth callback | req.session.regenerate | called after token exchange, before setting userId | VERIFIED | Line 217: correct order - regenerate, then set userId on new session, then save, then redirect |
| server.js | /auth/login, /auth/callback | authLimiter applied before route handlers | VERIFIED | Lines 124-125 mount authLimiter on both paths before app.use of authRouter at line 126 |
| server.js | /api/feedback | feedbackLimiter in middleware chain | VERIFIED | Line 172: requireAuth, feedbackLimiter, feedbackRouter in correct order |
| photo-proxy.js catch blocks | logger.error | real error logged server-side, generic to client | VERIFIED | All catch blocks: logger.error with error.message, then res.status().json with code only |

---

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| No CRITICAL/HIGH findings unfixed | PARTIAL | Rate limiting implemented but express-rate-limit CVE-2026-30827 not addressed; v7.x does not contain the fix |
| All 8 audit sections have explicit verdicts | SATISFIED | All 8 sections have PASS verdict |
| Architecture findings documented | SATISFIED | Architecture review section in SECURITY-AUDIT-v2.md covers module boundaries, circular dep, and in-memory maps |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| package.json | 21 | express-rate-limit@^7.5.0 (plan required ^8.3.1+) | Warning | CVE-2026-30827 (IPv4-mapped IPv6 bypass) not fixed; audit report does not acknowledge |
| SECURITY-AUDIT-v2.md | Sections 5,6 | Version not mentioned; CVE-2026-30827 not addressed | Warning | Audit report marks PASS without noting the CVE deviation from plan |

No blocker anti-patterns (placeholders, stubs, empty handlers) found in any implementation file.

---

### Human Verification Required

None - all required verifications are structural and confirmed programmatically.

---

## Gaps Summary

Six of seven must-haves are fully verified. The single gap is the express-rate-limit version.

The plan explicitly specified express-rate-limit@^8.3.1 with the note "IMPORTANT: Use v8.3.1+ to avoid CVE-2026-30827 (IPv4-mapped IPv6 bypass)." The 13-01-SUMMARY documents a deliberate deviation: v7.5.0 was installed with the rationale "latest stable for Express 4."

The problem is that v7.x and v8.x are separate major versions. v7.x does not contain the CVE-2026-30827 fix - the fix was introduced in v8.3.0. The CVE affects dual-stack (IPv4+IPv6) servers where an attacker can use an IPv4-mapped IPv6 address to bypass IP-based rate limiting. Whether the VPS is dual-stack is not determinable from the codebase.

The SECURITY-AUDIT-v2.md Section 5 (Dependency Audit) and Section 6 (Rate Limiting) both mark PASS without acknowledging this discrepancy or providing a risk rationale.

The rate limiting is functionally operational. The gap is that the identified CVE mitigation was not applied, and the audit report does not record an explicit risk acceptance decision for it.

**Resolution path (either one closes this gap):**

1. Upgrade to express-rate-limit@^8.3.1 (no API breaking changes between v7 and v8 for the features used here)
2. OR: Add an explicit note in SECURITY-AUDIT-v2.md Section 5 documenting the version choice, the CVE, and a reasoned risk acceptance (e.g. VPS runs IPv4-only behind nginx; dual-stack not configured; CVE not exploitable in this deployment)

---

_Verified: 2026-03-12T23:16:28Z_
_Verifier: Claude (gsd-verifier)_
