# Okno - Security Assessment (Multi-User Phase)

**Date**: February 13, 2026

## Overview
As Okno transitions to multi-user support, the security model shifts from a shared-host model to a **Client-Side Isolated** model.

## Target Security Model: Option A (Client-Side Storage)

### 1. Data Isolation
- **Mechanism**: Use browser-native `localStorage` and `IndexedDB`.
- **Level**: High. Browsers enforce the **Same-Origin Policy (SOP)**, meaning User A's browser cannot access User B's photo list or tokens.
- **VPS Responsibility**: None. The server no longer stores cross-user data, eliminating the risk of accidental data leakage via server-side bugs.

### 2. Token Security
- **At Rest**: Tokens are stored in IndexedDB. While this is isolated by domain, it is plain-text on the user's disk.
- **Mitigation**: Implement **Encryption at Rest** in the browser using the `SubtleCrypto` API, with a key derived from a user-provided passphrase or a session-specific salt.
- **In Transit**: All API calls (to Google and VPS) are strictly **HTTPS**.

### 3. Session Management
- **Type**: Stateless.
- **Strategy**: Use short-lived JWTs or session-only cookies for authentication to the VPS (feedback, health check).
- **Control**: Users have full control. Clearing browser data immediately revokes the "vault" on that device.

### 4. Attack Surface Analysis
- **XSS (Cross-Site Scripting)**: Critical risk. If an attacker injects a script, they could steal tokens from IndexedDB.
  - **Mitigation**: Strict **Content Security Policy (CSP)**. No `unsafe-inline` scripts. Sanitized inputs.
- **CSRF (Cross-Site Request Forgery)**:
  - **Mitigation**: SameSite cookie attributes and custom request headers for all API calls.

## Compliance (GDPR/EU Privacy)
The Client-Side approach is inherently **Private by Design**:
- We don't process or store PII (Personally Identifiable Information).
- No "Right to Erasure" (Right to be Forgotten) requests needed, as users can "forget" themselves by clearing cache.
- No data processing agreements needed for the primary photo flow.

## Recommendations
1.  **Strict CSP**: Implement a restrictive CSP that only allows scripts from `self` and trusted CDNs (like Lucide/Inter).
2.  **Audit**: Perform a manual audit of third-party scripts (Lucide, Inter) to ensure no data exfiltration.
3.  **Transparency**: Provide a clear "Privacy Settings" view in the app explaining where data is stored.
