# Phase 11: Photo Management - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can hide individual photos from their slideshow. Hidden photos are marked in the DB and permanently excluded from random selection. A hidden photos section in settings lets users see what's hidden and restore photos. No new photo browsing or library management features.

</domain>

<decisions>
## Implementation Decisions

### Hide button reveal
- Tapping the screen reveals the hide button (Claude's discretion on reveal mechanism)
- Button is positioned in a corner (top or bottom — Claude picks least intrusive)
- Button reads "Hide" as a text label
- Revealing controls does NOT pause the slideshow — it keeps cycling

### Post-hide behavior
- After hiding: brief feedback (~1s) then advance to next photo
- Show a subtle toast with an Undo option (not just a plain confirmation)
- If user taps Undo: photo is silently unhidden, slideshow continues — photo will appear again later
- No hard pause on the photo; move on naturally after the brief beat

### Settings page depth
- Ship the optional thumbnail grid of hidden photos (not just count + button)
- Section lives at the bottom of the settings page (rarely-needed admin action)
- "Unhide all" requires a confirm dialog: e.g. "Unhide all 5 photos? They'll appear in your slideshow again."

### Unhide granularity
- Each thumbnail in the grid has a per-photo restore button overlaid on it
- Both per-photo restore and "Unhide all" are available

### Claude's Discretion
- Exact reveal mechanism for the hide button (tap-to-show-controls vs persistent low-opacity)
- Top vs bottom corner placement
- Thumbnail grid layout and sizing
- Toast styling and duration

</decisions>

<specifics>
## Specific Ideas

- The hide button should feel subtle enough not to distract during normal slideshow viewing
- The undo flow (toast → undo → photo silently restored) mirrors patterns like Gmail's undo send

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-photo-management*
*Context gathered: 2026-03-12*
