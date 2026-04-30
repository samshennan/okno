# Phase 15: Security Audit Re-run + Skill Refinement - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning
**Source:** PRD Express Path (command args from /gsd-plan-phase 15)

<domain>
## Phase Boundary

This phase re-runs the `security-audit` skill against OKNO's current `main` (commits 145638f / 4b7e711) post-Phase-14, diffs the findings against the prior baseline (`SECURITY-AUDIT-v2.md`), validates the specific surfaces Phase 14 touched, fixes any new CRITICAL/HIGH findings, produces `SECURITY-AUDIT-v3.md`, and feeds skill-improvement notes back into `~/.claude/skills/security-audit/SKILL.md`.

Out of scope:
- Phase 12 (README/portfolio polish) — separate phase
- Net-new security features that aren't fixes for findings
- Refactors unrelated to a finding

</domain>

<decisions>
## Implementation Decisions

### Audit execution
- Run the `security-audit` skill against current `main` head (HEAD = 145638f at time of planning, includes 4b7e711 hardening)
- Audit scope is the full 8-section checklist, same as v2

### Diff methodology
- Compare each section's verdict (PASS/FAIL/N/A) against `.planning/decisions/SECURITY-AUDIT-v2.md`
- Bucket findings into: NEW (post-v2), STILL OPEN (carried over), FIXED (closed since v2), MISSED-IN-V2 (skill caught what it didn't before)
- A finding is "new" only if v2 was PASS or N/A and v3 is FAIL

### Phase 14 surface validation (mandatory checks)
- **CSP**: Verify no inline `<script>` or `<style>` remain in `public/*.html`. Confirm `script-src-attr` and `style-src-attr` are `'none'` and that `unsafe-inline` is gone from `script-src` and `style-src` in `server.js`.
- **/auth/status donation URL reflection**: Confirm `DONATION_URL` is validated against `^https://buy.stripe.com/` before reflection. No open redirect or stored-XSS via the env var.
- **multer 2.1**: Confirm `multer@2.1.1` is the resolved version in `package-lock.json` and the upload handler uses safe defaults (no path traversal via filename, MIME+extension cross-check still in place).
- **google-auth-library v10**: Confirm `google-auth-library@10.x` resolved; check breaking-change surface (token-refresh, OAuth2Client constructor) against current usage in `auth.js`.
- **Feedback input limits**: Confirm 2000-char description/reason caps, 254-char email cap, MIME+extension check, and email regex are present in `/api/feedback` handler.

### Fix scope
- Any CRITICAL or HIGH from v3 that was not present in v2 MUST be fixed before phase closes
- MEDIUM/LOW findings: triaged into the audit doc with rationale; fix only if cheap or carries to next phase as todos
- Fixes commit atomically with messages referencing the finding ID

### Output: SECURITY-AUDIT-v3.md
- Lives at `.planning/decisions/SECURITY-AUDIT-v3.md`
- Same 8-section structure as v2
- Frontmatter includes audit date, commit SHA audited, supersedes-pointer to v2
- Each section: verdict + evidence + diff-from-v2 line

### Skill refinement
- Capture skill-improvement notes inline as the audit runs (false N/As, stack-mismatch noise, missed checks, structural improvements)
- At phase close, edit `~/.claude/skills/security-audit/SKILL.md` with at least one concrete improvement (per phase success criteria)
- The improvement must be backed by a specific finding from this audit, not a generic suggestion

### Claude's Discretion
- Which exact files to grep first when validating each Phase 14 surface
- Tooling for the audit run (security-audit skill is the primary; ad-hoc `npm audit`, ripgrep allowed)
- How to structure SECURITY-AUDIT-v3.md beyond the v2 baseline
- Whether to keep v2 alongside v3 or move v2 to an `archive/` subfolder (default: keep both, v3 supersedes)
- Exact wording of skill-improvement edits

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit baseline + skill
- `.planning/decisions/SECURITY-AUDIT-v2.md` — prior baseline, source of diff comparison
- `~/.claude/skills/security-audit/SKILL.md` — the skill being exercised + refined
- `.planning/decisions/SECURITY-ASSESSMENT.md` — predecessor doc (obsolete, superseded by v2 — read for historical context only)

### Phase 14 work to validate
- `.planning/phases/14-friend-testing-hardening/14-SUMMARY.md` — what Phase 14 changed
- `.planning/handoffs/2026-04-30-phase-14-friend-testing-hardening-backfill.md` — backfill context
- `.planning/HANDOVER.md` — current session resume point

### Code surfaces to inspect
- `server.js` — CSP config, helmet middleware, route mounting
- `auth.js` — OAuth flow, `/auth/status`, google-auth-library usage
- `public/*.html` + `public/css/*.css` + `public/js/*.js` — CSP inline-leak validation
- `package.json` + `package-lock.json` — multer/google-auth-library version pinning
- `/api/feedback` handler (locate during audit) — input limit validation
- `.env.example` — env var contract

### Project guidance
- `CLAUDE.md` — project conventions
- `.planning/STATE.md` — project decision history
- `.planning/ROADMAP.md` (Phase 15 section, lines 157–185) — success criteria

</canonical_refs>

<specifics>
## Specific Ideas

- Audited commit MUST be `145638f` (current `main` head) — reproducibility
- Phase 13's audit produced `SECURITY-AUDIT-v2.md`; v3 must follow the same naming pattern
- Roadmap success criterion: "≤2 false N/A items in Section 2 (DB variant detection)" — this is testable in v3's output
- Roadmap success criterion: "at least one concrete improvement to security-audit skill" — testable via `git diff` on `~/.claude/skills/security-audit/SKILL.md` at phase close

</specifics>

<deferred>
## Deferred Ideas

- Continuous-audit automation (cron / pre-commit) — out of scope, separate future phase
- SAST tooling integration (Semgrep, CodeQL) — out of scope unless a finding demands it
- Threat-modelling refresh — covered by audit's section 8, no separate doc needed

</deferred>

---

*Phase: 15-security-audit-re-run-skill-refinement*
*Context gathered: 2026-04-30 via PRD Express Path*
