# Phase 8: Database Foundation + Data Migration - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

All persistent storage moves from file-based JSON (tokens.json, cache.json, config.json) to SQLite. The existing user's data auto-migrates as the first user account. After migration, no production code reads from JSON files. Original files are preserved as .migrated backups until verified, then cleaned up.

</domain>

<decisions>
## Implementation Decisions

### Migration trigger & experience
- Claude's discretion on all migration UX decisions
- Flexibility to choose: auto-migrate on startup vs CLI command
- Flexibility to choose: block startup vs maintenance page during migration
- Flexibility to choose: seamless post-migration vs requiring re-auth
- Flexibility to choose: fail-loud vs fallback behavior on migration failure

### Schema scope for Phase 9
- Claude's discretion on schema design
- Flexibility to pre-wire multi-tenant columns (user_id) now or defer to Phase 9
- Flexibility on DB file location (data/ vs db/ directory)
- Flexibility on table normalization level
- PRAGMA user_version migration runner already decided in PROJECT.md — implement as planned

### Data cleanup during migration
- **Clean up stale data during migration** — don't migrate garbage into the new DB
- Skip expired/revoked Google tokens — if the refresh token is known invalid, don't migrate it
- Skip cache entries with dead baseUrls — Google Photos URLs expire after ~60min, no point migrating stale ones
- Migrate all valid data (active tokens, valid cache entries, settings)

### Backup retention
- **Delete .migrated JSON backups after verification** — don't keep forever
- Claude's discretion on what constitutes "verified working" (N successful startups, time-based, etc.)
- Auto-cleanup preferred over manual CLI command

### Claude's Discretion
- Migration trigger mechanism (auto vs CLI)
- App behavior during migration (block vs maintenance page)
- Post-migration user experience (seamless vs re-auth)
- Migration failure handling (fail-loud vs fallback)
- Schema design: table structure, normalization, multi-tenant pre-wiring
- DB file location
- Backup verification threshold and cleanup timing

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude's technical judgment on this infrastructure phase.

Key constraint from PROJECT.md: better-sqlite3, WAL mode, hand-rolled migration runner with PRAGMA user_version, no ORM.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-database-foundation*
*Context gathered: 2026-02-27*
