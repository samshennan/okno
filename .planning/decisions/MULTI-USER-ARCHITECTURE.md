# Okno - Multi-User Architecture Decision

**Date**: February 13, 2026
**Status**: Decided (Option A: Client-Side Storage)

## Context
As Okno moves from a private family-use tool to a public-ready application, we need a way to support multiple users without the overhead and liability of managing their private photo data on our servers.

## Decision: Client-Side Primary Storage (Option A)
We will adopt a **Client-Side Primary** architecture for the multi-user phase.

### How it Works
1.  **Authentication**: Users sign in with Google via OAuth.
2.  **Token Management**: OAuth tokens (including refresh tokens) are stored in the user's browser (IndexedDB) encrypted with a session-based key.
3.  **Photo Selection**: List of selected photo IDs and metadata is stored in the browser's `localStorage` or `IndexedDB`.
4.  **Slideshow Execution**: The slideshow logic fetches photos directly from the Google Photos API using the client-held token.
5.  **VPS Role**: The VPS serves only static files and acts as a stateless proxy for bypass cases (e.g., bypassing CORS if necessary, though direct API calls are preferred).

### Rationale
-   **Privacy & Liability**: We store zero personal data. No OAuth tokens or photo lists touching the VPS disk.
-   **Scalability**: Zero server-side storage means we can support thousands of users with minimal VPS resources.
-   **Cost**: No database costs, minimal storage costs.
-   **Security**: The user's device is the vault for their data.

### Trade-offs
-   **Multi-Device Sync**: Without a server-side DB, a user cannot currently "pick" on a phone and "play" on an iPad unless they use the same browser profiles or we add a lightweight sync mechanism later.
-   **Session Expiry**: If the browser cache is cleared, the user must re-authenticate and re-select.

## Implementation Path
1.  **Phase 1**: Port existing `photo-cache.js` logic to a browser-side `PhotoManager` class.
2.  **Phase 2**: Implement IndexedDB storage for tokens and metadata.
3.  **Phase 3**: Remove server-side token/cache persistence.
