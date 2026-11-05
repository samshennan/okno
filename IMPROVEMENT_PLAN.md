# IMPROVEMENT PLAN — okno-public (2026-07-03)

> Written by Claude Fable 5 (planning only — no changes made). Executor: any capable agent.
> Read this whole doc before starting any item. Do items in order unless marked independent.
>
> **SUPERSEDES** the 2026-07-01 IMPROVEMENT_PLAN.md that previously sat at this path. That
> plan was ~80% private-repo work and duplicated `C:\AI_LAB\okno\IMPROVEMENT_PLAN.md` with
> conflicting script specs. Division of labour now:
> - **Private-side work** (VPS deploy, secret rotation, sync-script rewrite, doc sweep, npm
>   scripts) lives in `C:\AI_LAB\okno\IMPROVEMENT_PLAN.md` — referred to below as **the okno
>   plan**. Where the old plan here conflicted with it (old "Script A" replaced
>   `export-public.sh` in place; the okno plan's **S3** creates `scripts/sync-public.sh` and
>   archives v1), **the okno plan wins**. Do not implement both.
> - **This plan** is public-side only: leak protection, integrity verification, portfolio
>   presentation of the published artifact, plus two carried-forward items the okno plan does
>   not cover (public metadata + CHANGELOG).
>
> **EXECUTOR SAFETY RULES — read before touching anything**
> 1. **This file must NEVER reach the public GitHub repo.** Until item 1 is done, run no
>    `git add`, `git add -A`, `git commit`, or push of any kind in `C:\AI_LAB\okno-public`.
> 2. **Never edit tracked files in `C:\AI_LAB\okno-public` directly.** This repo is a build
>    artifact of `C:\AI_LAB\okno` (private). Content changes go into the private repo and
>    flow through the sync script. Local-only infrastructure under `.git\` (info/exclude,
>    hooks/) is the ONLY thing this plan writes here.
> 3. **Never run `C:\AI_LAB\okno\scripts\export-public.sh` (v1).** Verified 2026-07-03: line
>    15 is `rm -rf "$PUBLIC_ROOT"` — it deletes this repo INCLUDING `.git` (history, remote
>    config, this plan, and the guard hooks installed by items 2–3), then re-inits with a
>    hardcoded commit (lines 142–146). The okno plan item 6 replaces it.
> 4. **Never run `C:\AI_LAB\okno\deploy-to-vps.sh`.** It does `apt upgrade` as root on a
>    shared VPS. The VPS is additionally FROZEN until ~2026-07-06 (live FLIPER experiment).
>    Nothing in THIS plan touches the VPS at all.
> 5. The secrets-guard hook blocks agent reads/greps of `.env*` paths and commands containing
>    the bare word `env`. Do not fight it. The transcript-safe verification method for
>    `.env.example` is built into the pre-push hook (item 3) — it prints counts, never content.

## TL;DR

- okno-public is the generated public mirror of the private repo `C:\AI_LAB\okno`, pushed to
  GitHub `samshennan/okno` (PUBLIC). One squashed commit `310c5fb`; local HEAD == remote HEAD
  (verified via `git ls-remote` 2026-07-03). It exists as a **job-hunt portfolio piece**.
- **Good news, verified:** tracked tree and its single-commit history are PII-clean (sweep run
  2026-07-03: only allowed `github.com/samshennan/okno` URLs), README has no frontmatter, all
  4 screenshots it references exist and are tracked, and the published `.env.example` contains
  0 secret-like and 0 PII-like patterns.
- **The one live leak risk:** this IMPROVEMENT_PLAN.md sits untracked in the working tree and
  `.git\info\exclude` is still empty — one careless `git add -A && git push` publishes internal
  VPS/infra context to public GitHub. Item 1 fixes it in one line; items 2–3 install local git
  hooks so this whole class of accident becomes impossible.
- **The portfolio gap nobody noticed:** the README cannot link the live demo (the PII sweep
  pattern matches `okno.samshennan.com`), and the GitHub `homepage` field — the only other
  place a hiring manager finds the live site — is **null** (description and topics are set,
  so this polish was started and dropped mid-task). Item 5 finishes it.
- Public metadata still self-contradicts (`license: ISC` vs MIT LICENSE, `author: ""`,
  `version: 0.1.0`, no `engines`) and CHANGELOG ends 2026-02-10 while the code is phase-14 —
  reads as abandoned. Item 4 carries these fixes forward (edits happen in the PRIVATE repo,
  published via the okno plan's sync).
- The big-ticket items (VPS deploy of phase 14 — live site verified still serving `okno-v1.4`
  vs repo `okno-v1.6` on 2026-07-03; sync-script rewrite; secret rotation) are the okno plan's
  items 2, 6, 4. Do them there, not here.

## Repo snapshot

- **What:** Okno — self-hosted Google Photos digital photo frame for an old iPad (Node 22 /
  Express 4, vanilla-JS PWA, better-sqlite3, google-auth-library, Helmet, Winston; Docker or
  PM2+nginx deploy paths). This repo is the clean public export: 58 files, allowlist-generated.
- **Topology:** local `C:\AI_LAB\okno` (private, 243 commits) → GitHub `samshennan/okno-staging`
  (PRIVATE, VPS pull source). Local `C:\AI_LAB\okno-public` (generated) → GitHub
  `samshennan/okno` (PUBLIC). There is no third repo.
- **State (all verified 2026-07-03/04 by direct command, not hearsay):**
  - Git: branch `main` only, no stashes, single commit `310c5fb`, `HEAD` ==
    `origin/main` == remote `refs/heads/main` (`git ls-remote` confirmed
    `310c5fbfbbe3d6a244350488f955fb01b01453fa` both sides). Tree clean except untracked
    `IMPROVEMENT_PLAN.md` (this file).
  - `.git\info\exclude`: still the stock template — no protection line yet.
  - `.git\hooks\`: only `.sample` files — no guard hooks yet.
  - PII sweep (`git grep -nIE "alicja|159\.69\.152|100\.81\.115|op://|1[Pp]assword|sam@|samshennan|moonacle"`
    excluding `.env.example`): 7 hits, ALL allowed `github.com/samshennan/okno` URLs
    (README.md x3, docs/DEPLOYMENT.md x2, public/index.html x2). Zero violations.
  - README.md line 1 is `# Okno` (no frontmatter); all four screenshot paths it references
    (`docs/screenshots/{slideshow,login,dashboard,settings}.png`) exist and are git-tracked.
  - `package.json`: `version 0.1.0`, `license ISC` (LICENSE file is MIT), `author ""`, no
    `engines`. CHANGELOG.md last entry `[0.1.1] - 2026-02-10`. `public/sw.js` line 1:
    `CACHE_VERSION = 'okno-v1.6'`.
  - Live site: `https://okno.samshennan.com/sw.js` returns `okno-v1.4`; `/login` returns 200.
    Deploy drift is real but is the okno plan's item 2 — out of scope here.
  - GitHub metadata (unauthenticated API check): description set ("Turn an old iPad into a
    self-hosted Google Photos frame…"), topics set (digital-photo-frame, google-photos, ipad,
    nodejs, pwa, self-hosted), `has_issues: true`, **`homepage: null`**.
  - Published `.env.example` (checked via its already-public raw.githubusercontent.com URL,
    counts only): 20 lines, 0 secret-like matches (`GOCSPX-`/32+ hex/`op://`), 0 PII-like
    matches, 3 placeholder-like matches. CLEAN.

## Priority queue

| # | Item | Kind | Impact | Effort | Risk |
|---|------|------|--------|--------|------|
| 1 | Exclude IMPROVEMENT_PLAN.md from git (`.git\info\exclude`) | hygiene | Closes the one live leak path to public GitHub, today | S | low |
| 2 | Install pre-commit guard hook (spec G1) | script | Makes committing the plan, frontmatter, or PII structurally impossible | S | low |
| 3 | Install pre-push guard hook + run first full audit (spec G2) | script | Blocks force-push/branch-delete; one-command "is the public artifact clean?" forever | S | low |
| 4 | Public metadata + CHANGELOG 0.2.0 (edits in PRIVATE repo; publish via okno plan sync) | hygiene | Repo stops contradicting its own licence and looking abandoned since February | M | low |
| 5 | Set GitHub `homepage` field to the live demo | optimization | The only live-demo pointer a hiring manager gets; currently null | S | low |
| 6 | Post-sync verification runbook (run after every okno-plan sync) | hygiene | Catches a bad sync before/right after it publishes | S | low |

Ordering: 1 → 2 → 3 strictly (each protects the next). Item 4 must wait until the okno plan's
item 6 (sync-public.sh) exists and has passed its zero-diff first run — see item 4 pre-conditions.
Item 5 is independent but time-gated (see item). Item 6 is a standing procedure, not one-shot.

## Work items

### 1. Exclude IMPROVEMENT_PLAN.md from git

**Why:** Verified: this file is untracked (`?? IMPROVEMENT_PLAN.md` in `git status`) and
`.git\info\exclude` has no entry for it. `git add -A` here today would stage it; a push would
publish internal VPS IPs, secret-item names, and personal context to the PUBLIC repo. The
tracked `.gitignore` cannot be used — it is an exported file; editing it creates drift against
the private repo. `.git\info\exclude` is local-only and never published.

**Steps (Git Bash):**
```bash
echo "IMPROVEMENT_PLAN.md" >> /c/AI_LAB/okno-public/.git/info/exclude
```

**Verify:**
```bash
cd /c/AI_LAB/okno-public && git status --short
```
Expected output: empty (the `?? IMPROVEMENT_PLAN.md` line is gone) while
`ls /c/AI_LAB/okno-public/IMPROVEMENT_PLAN.md` still lists the file.

**Done when:** both checks above pass.
**Rollback:** delete the added line from `C:\AI_LAB\okno-public\.git\info\exclude`.

### 2. Install the pre-commit guard hook (spec G1)

**Why:** Item 1 protects one filename. This hook protects the class: it rejects any commit that
stages this plan, stages markdown with Obsidian frontmatter (the known private→public
contamination from the 2026-06-20 merge), or stages content matching the PII pattern. It lives
in `.git\hooks\` — local-only, never published, never creates drift, and (per the okno plan's
S3 spec) survives syncs because sync-public.sh never touches `.git`. Note it would NOT survive
a v1 `export-public.sh` run — one more reason v1 is banned (safety rule 3).

**Steps:**
1. Create `C:\AI_LAB\okno-public\.git\hooks\pre-commit` with EXACTLY the G1 source from the
   script-candidates section below. Use the Write tool (it writes LF line endings; a CRLF
   shebang breaks Git Bash hooks). No `chmod` needed on Windows.
2. Sanity-check syntax: `bash -n /c/AI_LAB/okno-public/.git/hooks/pre-commit` → no output, exit 0.

**Verify (non-mutating dry test — uses a temp index, touches nothing real):**
```bash
cd /c/AI_LAB/okno-public && bash .git/hooks/pre-commit --selftest
```
Expected output: three `SELFTEST PASS` lines (plan-block, frontmatter-block, pii-block) and
exit 0. (`--selftest` fabricates fake staged content in a temp dir; see G1.)

**Done when:** selftest passes.
**Rollback:** delete `.git\hooks\pre-commit`.

### 3. Install the pre-push guard hook and run the first full audit (spec G2)

**Why:** Last line of defence plus a standing audit tool. As a hook it refuses force-pushes and
branch deletion on `main` (the public history is append-only by decision — single clean-room
commit `310c5fb` plus normal sync commits). Run manually (`--manual`) it audits the whole
public artifact: PII sweep, frontmatter scan, README link/screenshot integrity, plan-file
exclusion, and a counts-only secret scan of `.env.example`. This one command replaces the
"agent pokes around for 20 minutes" integrity check that has now been performed by hand three
times (2026-07-01 planning pass, 2026-07-03 scout, this session).

**Steps:**
1. Create `C:\AI_LAB\okno-public\.git\hooks\pre-push` with EXACTLY the G2 source below (Write
   tool, LF endings).
2. `bash -n /c/AI_LAB/okno-public/.git/hooks/pre-push` → exit 0.
3. Run the first audit: `cd /c/AI_LAB/okno-public && bash .git/hooks/pre-push --manual`

**Verify:** step 3 prints one `PASS` line per check and final line `AUDIT PASS (6/6)`, exit 0.
As of 2026-07-03 every underlying fact was verified true by hand, so a failure means either the
tree changed since or the hook source was mistyped — investigate before proceeding, do not
"fix" by weakening the hook.

**Done when:** audit passes.
**Rollback:** delete `.git\hooks\pre-push`.

### 4. Public metadata + CHANGELOG 0.2.0 — EDITS IN THE PRIVATE REPO

> Carried forward from the superseded plan because the okno plan does not cover it. All edits
> happen in `C:\AI_LAB\okno`; they reach this repo only via the okno plan's sync script.

**Pre-conditions (hard):** the okno plan's item 6 is done — `scripts/sync-public.sh` exists in
the private repo AND its first `--dry-run` produced the expected zero-content-diff result. If
you edit these files before that first run, you destroy that verification signal (the okno plan
uses "zero diff except frontmatter" to prove the new sync script is correct). Check:
`ls /c/AI_LAB/okno/scripts/sync-public.sh` exists, and the okno plan's item 6 is marked done or
its verify step demonstrably passed.

**Why (all verified in the public snapshot 2026-07-03):**
- `package.json` says `"license": "ISC"`; the LICENSE file and README both say MIT. A
  self-contradicting licence on a portfolio repo is the kind of detail hiring reviewers notice.
- `"author": ""` on a portfolio piece; no `engines` field while the Dockerfile pins
  `node:22-alpine` and README claims "Node 18+" (untested claim — better-sqlite3 v12 is picky).
- CHANGELOG ends `[0.1.1] - 2026-02-10` while the shipped code is phase-14 (`okno-v1.6`) —
  four-plus months of silence reads as abandonment, the exact opposite of the portfolio message.

**Steps (in `C:\AI_LAB\okno`):**
1. `package.json`: set `"license": "MIT"`, `"author": "Sam Shennan"`, add
   `"engines": { "node": ">=20" }`, set `"version": "0.2.0"` (default per open question 3 —
   proceed with 0.2.0 unless Sam has said otherwise).
2. `README.md`: change the heading `## Manual install (Node 18+)` to `## Manual install (Node 20+)`.
3. `CHANGELOG.md`: add a `## [0.2.0] - 2026-07-XX` entry summarising phases 10–14. Source
   material: `C:\AI_LAB\okno\.planning\phases\14-public-launch\SESSION-HANDOVER.md` ("What is
   DONE and verified", WP-A/WP-B/WP-C) and `C:\AI_LAB\okno\.planning\STATE.md` phase 10–13
   notes. **LLM part:** summarise faithfully — every bullet must trace to a line in those two
   files; invent nothing; keep it to 10–20 bullets grouped under Added/Changed/Fixed/Removed
   (the feedback/Stripe removal goes under Removed).
4. Commit in the private repo (`fix(meta): MIT licence, author, engines; changelog 0.2.0`)
   with the standard Claude trailer; push to okno-staging.
5. Publish via the okno plan's sync: `bash scripts/sync-public.sh` then `--push` (exact flags
   per the okno plan S3). The sync commit passes through this repo's new hooks — expected clean.
6. Tag after publish: `git -C /c/AI_LAB/okno tag v0.2.0 && git -C /c/AI_LAB/okno push origin v0.2.0`,
   then `git -C /c/AI_LAB/okno-public tag v0.2.0 && git -C /c/AI_LAB/okno-public push origin v0.2.0`.

**Verify:**
```bash
node -e "const p=require('C:/AI_LAB/okno-public/package.json'); console.log(p.version, p.license, p.author, p.engines.node)"
grep -m1 "^## \[0.2.0\]" /c/AI_LAB/okno-public/CHANGELOG.md
git -C /c/AI_LAB/okno-public log --oneline | tail -1
```
Expected: `0.2.0 MIT Sam Shennan >=20`; the new changelog heading; and the last history line
still `310c5fb feat: initial public release` (append-only history preserved). Then run item 6's
runbook.

**Done when:** all three checks pass and both tags are on GitHub
(`git ls-remote --tags origin | grep v0.2.0` in each repo).
**Rollback:** revert the private commit, re-run sync; `git -C /c/AI_LAB/okno-public revert HEAD && git push`.

### 5. Set the GitHub `homepage` field (independent, time-gated)

**Why:** Verified via the public API: description, topics, and issues are configured, but
`homepage` is `null`. The README deliberately contains no live-demo link (the export sweep
pattern matches `okno.samshennan.com` — see Missed opportunities #1), so the homepage field is
the ONLY route from the GitHub page to the live demo. Half of the okno plan's item 7 has
already been done by someone; this is the missing half.

**Timing rule (deterministic):** prefer to do this AFTER the okno plan's item 2 (VPS deploy)
so the demo shows current code. If the deploy has still not happened by **2026-07-10**, set it
anyway — a live v1.4 demo beats no demo link.

**Steps (Git Bash):**
```bash
gh repo edit samshennan/okno --homepage "https://okno.samshennan.com"
```
If `gh` returns 401: a dead revoked PAT in `HKCU\Environment` / `~/.env.ailab` is shadowing the
real keyring auth (known recurring issue — memory `project_dead_github_pat_shadows_keyring`).
Unset `GH_TOKEN`/`GITHUB_TOKEN` for the session and retry; do NOT generate a new token.

**Verify:**
```bash
curl -s https://api.github.com/repos/samshennan/okno | grep '"homepage"'
```
Expected: `"homepage": "https://okno.samshennan.com",`. Also fetch the homepage itself and
confirm it renders (house rule — no unverified "done"):
`curl -s -o /dev/null -w '%{http_code}\n' https://okno.samshennan.com/login` → `200`.

**Done when:** both checks pass.
**Rollback:** `gh repo edit samshennan/okno --homepage ""`.

### 6. Post-sync verification runbook (standing procedure, not one-shot)

**Why:** Every future private→public sync is a publication event on a portfolio repo. The
okno plan's sync script sweeps before committing; this runbook confirms from the public side
after it lands, using infrastructure items 1–3 installed.

**Steps — run after EVERY sync (and after item 4's publish):**
```bash
cd /c/AI_LAB/okno-public
bash .git/hooks/pre-push --manual                      # full audit: expect AUDIT PASS (6/6)
git log --oneline | tail -1                            # expect: 310c5fb feat: initial public release
git ls-remote origin main | cut -f1                    # expect: equals `git rev-parse HEAD`
ls IMPROVEMENT_PLAN.md .git/hooks/pre-commit .git/hooks/pre-push   # expect: all three still present
```

**Done when:** adopted — i.e., the okno plan's executor is told (add one line to the okno
plan's item 6 Verify section, or to `C:\AI_LAB\okno\CLAUDE.md`): "after every sync-public.sh
run, execute the post-sync runbook in okno-public/IMPROVEMENT_PLAN.md item 6."

## Deterministic script candidates

Both scripts below are local git hooks: they live under `.git\hooks\`, are never tracked,
never published, never create drift against the private repo, and survive the okno plan's
sync-public.sh (which never touches `.git`). Master copy = the source below, in this untracked
file; if the repo is ever re-cloned, re-install from here (or from the private repo if Sam
later adopts cross-repo insight #2).

Everything here is 100% mechanical — no LLM judgment anywhere. The only LLM-adjacent task in
this whole plan is drafting the CHANGELOG prose (item 4 step 3).

### G1 — `.git\hooks\pre-commit` (CREATE at `C:\AI_LAB\okno-public\.git\hooks\pre-commit`)

- **Purpose:** reject any commit in okno-public that stages (a) IMPROVEMENT_PLAN.md, (b) a
  markdown file starting with Obsidian `---` frontmatter, or (c) content matching the PII
  pattern, with the same two allowed exceptions as the private export sweep (LICENSE copyright
  line; `github.com/samshennan/okno` URLs).
- **Interface:** invoked automatically by `git commit`; `bash .git/hooks/pre-commit --selftest`
  runs a self-contained test in a temp repo and exits 0/1.
- **Inputs:** the git index (`git diff --cached`). **Outputs:** exit 0 (allow) / exit 1 (block,
  with reasons on stderr). Never prints file content beyond the offending line reference.
- **Algorithm:** (1) staged-name check for the plan file; (2) for each staged `.md`, read the
  staged blob's first line via `git show :file`, strip `\r`, block if `---`; (3) grep staged
  blobs for the PII pattern, filter allowed exceptions, block on any remainder.
- **Edge cases:** CRLF (strip `\r` before compare); binary files (`grep -I` skips); initial
  commit (`git show :file` works against the index regardless); deleted files (skipped via
  `--diff-filter=ACM`).
- **Source (write EXACTLY this):**

```bash
#!/usr/bin/env bash
# okno-public guard: block internal-plan/frontmatter/PII commits. Local-only, never published.
# Master copy lives in okno-public/IMPROVEMENT_PLAN.md (untracked). Re-install from there.
set -uo pipefail

fail() { echo "pre-commit GUARD BLOCK: $1" >&2; FAILED=1; }
FAILED=0

check_index() {
  # 1. Internal plan must never be committed.
  if git diff --cached --name-only | grep -qx "IMPROVEMENT_PLAN.md"; then
    fail "IMPROVEMENT_PLAN.md is staged (internal doc). Run: git restore --staged IMPROVEMENT_PLAN.md"
  fi
  # 2. No Obsidian frontmatter in staged markdown.
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    first=$(git show ":$f" 2>/dev/null | head -1 | tr -d '\r')
    if [ "$first" = "---" ]; then
      fail "$f starts with '---' (Obsidian frontmatter leaked from private repo). Fix upstream + re-sync."
    fi
  done < <(git diff --cached --name-only --diff-filter=ACM -- '*.md')
  # 3. PII sweep on staged blobs (same pattern family as the private export sweep).
  PATTERN='alicja|moonacle|159\.69\.152|100\.81\.115|op://|1password|1Password|sam@'
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    m=$(git show ":$f" 2>/dev/null | grep -inIE "$PATTERN" || true)
    [ -n "$m" ] && fail "$f matches PII pattern at: $(echo "$m" | cut -d: -f1 | tr '\n' ',' )(line numbers)"
    # samshennan allowed ONLY in github.com/samshennan/okno URLs, or anywhere in LICENSE.
    if [ "$(basename "$f")" != "LICENSE" ]; then
      s=$(git show ":$f" 2>/dev/null | grep -inI "samshennan" | grep -vi "github.com/samshennan/okno" || true)
      [ -n "$s" ] && fail "$f has 'samshennan' outside allowed github URL at line(s): $(echo "$s" | cut -d: -f1 | tr '\n' ',')"
    fi
  done < <(git diff --cached --name-only --diff-filter=ACM)
}

if [ "${1:-}" = "--selftest" ]; then
  T=$(mktemp -d) && cd "$T" && git init -q . && git config user.email t@t && git config user.name t
  echo x > IMPROVEMENT_PLAN.md && git add -f IMPROVEMENT_PLAN.md
  FAILED=0; check_index >/dev/null 2>&1; [ $FAILED -eq 1 ] && echo "SELFTEST PASS plan-block" || { echo "SELFTEST FAIL plan-block"; exit 1; }
  git rm -q --cached IMPROVEMENT_PLAN.md && printf -- '---\nx: y\n---\n# T\n' > t.md && git add t.md
  FAILED=0; check_index >/dev/null 2>&1; [ $FAILED -eq 1 ] && echo "SELFTEST PASS frontmatter-block" || { echo "SELFTEST FAIL frontmatter-block"; exit 1; }
  git rm -q --cached t.md && echo "host 159.69.152.123" > c.txt && git add c.txt
  FAILED=0; check_index >/dev/null 2>&1; [ $FAILED -eq 1 ] && echo "SELFTEST PASS pii-block" || { echo "SELFTEST FAIL pii-block"; exit 1; }
  cd / && rm -rf "$T"; exit 0
fi

check_index
[ $FAILED -eq 0 ] || { echo "Commit blocked. Fix causes in the PRIVATE repo and re-sync; do not edit okno-public directly." >&2; exit 1; }
exit 0
```

- **How to verify:** `bash -n` (syntax), then `--selftest` (three PASS lines, exit 0). The real
  sync commits from the okno plan's S3 should pass through silently.

### G2 — `.git\hooks\pre-push` (CREATE at `C:\AI_LAB\okno-public\.git\hooks\pre-push`)

- **Purpose:** (hook mode) refuse force-pushes and deletion of `main` — the public history is
  append-only by decision; (manual mode) full public-artifact audit in one command.
- **Interface:** invoked by `git push` (git feeds ref lines on stdin); or
  `bash .git/hooks/pre-push --manual` for the audit only. Exit 0 pass / 1 fail.
- **Audit checks (6):** 1 plan-file excluded and untracked; 2 tree PII sweep (tracked files,
  `.env.example` excluded, same exceptions); 3 no tracked `.md` starts with frontmatter;
  4 every relative link/image target in README.md exists on disk; 5 `.env.example` secret scan
  — COUNTS ONLY, content never printed (transcript-safe; also fine under the secrets-guard hook
  because git, not an agent tool, executes it during a push); 6 hooks themselves present.
- **Edge cases:** curl/network not needed (fully offline); zero-SHA stdin lines (branch delete
  → block for main); remote SHA not ancestor of local (force push → block); detached/other
  branches (allowed through — only `refs/heads/main` is guarded).
- **Source (write EXACTLY this):**

```bash
#!/usr/bin/env bash
# okno-public guard: block force-push/deletion of main; --manual runs the full artifact audit.
# Master copy lives in okno-public/IMPROVEMENT_PLAN.md (untracked). Re-install from there.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

PASS=0; FAILC=0
ok()   { echo "PASS $1"; PASS=$((PASS+1)); }
bad()  { echo "FAIL $1" >&2; FAILC=$((FAILC+1)); }
ZERO=0000000000000000000000000000000000000000

audit() {
  # 1 plan file protected
  if git check-ignore -q IMPROVEMENT_PLAN.md && ! git ls-files --error-unmatch IMPROVEMENT_PLAN.md >/dev/null 2>&1; then
    ok "IMPROVEMENT_PLAN.md untracked and excluded"
  else bad "IMPROVEMENT_PLAN.md is tracked or not in .git/info/exclude"; fi
  # 2 PII sweep over tracked files (env example handled in check 5)
  P='alicja|moonacle|159\.69\.152|100\.81\.115|op://|1password|1Password|sam@'
  v=$(git grep -nIE "$P" -- . ':!.env.example' 2>/dev/null || true)
  s=$(git grep -nI "samshennan" -- . ':!LICENSE' ':!.env.example' 2>/dev/null | grep -vi "github.com/samshennan/okno" || true)
  if [ -z "$v" ] && [ -z "$s" ]; then ok "PII sweep clean"; else bad "PII sweep hits:"; printf '%s\n%s\n' "$v" "$s" | sed '/^$/d' | cut -d: -f1,2 >&2; fi
  # 3 no frontmatter in tracked markdown
  fm=""
  while IFS= read -r f; do
    [ "$(head -1 "$f" | tr -d '\r')" = "---" ] && fm="$fm $f"
  done < <(git ls-files '*.md')
  if [ -z "$fm" ]; then ok "no frontmatter in tracked .md"; else bad "frontmatter in:$fm"; fi
  # 4 README relative links resolve
  missing=""
  while IFS= read -r p; do
    [ -f "$p" ] || missing="$missing $p"
  done < <(grep -oE '\]\(([A-Za-z0-9_./-]+)\)' README.md | sed 's/](\(.*\))/\1/' | grep -vE '^https?://')
  if [ -z "$missing" ]; then ok "README relative links all resolve"; else bad "README broken links:$missing"; fi
  # 5 env example: counts only, never print content
  if [ -f .env.example ]; then
    c=$(grep -cE 'GOCSPX-|[0-9a-fA-F]{32,}|op://' .env.example || true)
    if [ "${c:-0}" -eq 0 ]; then ok "env example: 0 secret-like patterns"; else bad "env example: $c secret-like patterns (content withheld - review with Sam)"; fi
  else bad ".env.example missing from tree"; fi
  # 6 guard hooks present
  if [ -f .git/hooks/pre-commit ] && [ -f .git/hooks/pre-push ]; then ok "guard hooks installed"; else bad "guard hook(s) missing"; fi
  echo "AUDIT $( [ $FAILC -eq 0 ] && echo PASS || echo FAIL ) ($PASS/6)"
  [ $FAILC -eq 0 ]
}

if [ "${1:-}" = "--manual" ]; then audit; exit $?; fi

# Hook mode: guard main against force-push and deletion, then audit.
while read -r local_ref local_sha remote_ref remote_sha; do
  [ "$remote_ref" = "refs/heads/main" ] || continue
  if [ "$local_sha" = "$ZERO" ]; then
    echo "pre-push GUARD BLOCK: deleting main on the public repo is forbidden." >&2; exit 1
  fi
  if [ "$remote_sha" != "$ZERO" ] && ! git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
    echo "pre-push GUARD BLOCK: non-fast-forward push to main (history rewrite). The public history is append-only." >&2; exit 1
  fi
done
audit || { echo "pre-push GUARD BLOCK: audit failed — fix in the PRIVATE repo and re-sync." >&2; exit 1; }
exit 0
```

- **How to verify:** `bash -n` (syntax); `bash .git/hooks/pre-push --manual` → `AUDIT PASS (6/6)`
  today (every check was hand-verified true on 2026-07-03). Force-push protection is verified
  by inspection only — do NOT test it with a real force push.

### Deliberately NOT built

- **Public-side sync/diff scripts** — the private→public sync (copy, frontmatter strip, sweep,
  commit, push, remote-HEAD verification) is fully specced as the okno plan's **S3
  (`scripts/sync-public.sh`)**. Nothing public-side should duplicate any of it.
- **Live-site health checks** — the okno plan's **S2 (`scripts/check-live-deploy.sh`)** covers
  version drift, HTTP, and cert expiry. Out of scope here.
- **CI workflow on the public repo** — a 15-line boot-and-curl GitHub Action would give a green
  badge, but `.github/workflows/` is not in the export allowlist and adding it is a private-repo
  decision. Noted in the okno plan (insight 7 there); skip until there is a second contributor
  or Sam asks.

## Missed opportunities & insights

1. **The PII sweep is silently vetoing the strongest portfolio move.** The forbidden-string
   pattern matches `samshennan`, so a "Live demo: okno.samshennan.com" line in the README would
   abort every future export. Nobody chose "no demo link in the README" — it fell out of a
   grep pattern. Two escape hatches: (a) the GitHub `homepage` field (item 5 — do this
   regardless), and (b) a deliberate sweep exception for `okno.samshennan.com` in README.md,
   which is a one-line change to the okno plan's S3 spec — but it advertises Sam's personal
   domain harder, so it is his call (open question 1). A hiring manager who never finds the
   live demo sees a photo-frame repo; one who does sees a shipped product their partner uses
   daily. The gap between those two impressions is the entire point of this repo.
2. **Someone half-finished the GitHub polish and nobody noticed.** Description, six good
   topics, and issues are all set; homepage is null. Neither prior plan recorded that the
   metadata work had partially happened — both specced it as fully to-do. Lesson for the audit
   process: before queueing "configure X", read X's current state; half-done work is invisible
   in plans and gets double-executed or dropped. (The double-execution risk here is benign —
   `gh repo edit` is idempotent — but the same blind spot on a destructive item would not be.)
3. **This repo had a rival 40KB plan that was 80% about a different repo.** The superseded
   2026-07-01 plan here and the okno plan cover the same private-side ground with conflicting
   script specs (replace-in-place vs new-file-plus-archive). An executor following both would
   have implemented the sync logic twice under two filenames. Standing rule worth adopting
   lab-wide: **generated-artifact repos get thin plans that point at the source repo's plan.**
   One system, one plan; mirrors get checklists.
4. **Adopt the `dist/` mental model** (carried from the superseded plan — it was right): you
   never hand-edit `dist/`, you never accept changes into `dist/`, you regenerate it. Every
   confusion an agent has had about this repo dissolves under that framing. Worth one line in
   `C:\AI_LAB\okno\CLAUDE.md` (the okno plan's insight already suggests documenting the
   topology there).
5. **The hooks pattern generalises.** Any public mirror in the lab (this is currently the only
   one, but JOBHUNT content or OPENCLAW extracts could grow one) should get the same two-file
   `.git\hooks` guard: local, invisible, survives syncs, costs nothing. G1/G2 above are
   copy-adaptable — only the PII pattern and allowed-exception lines change per repo.
6. **Stop re-auditing the public tree by hand.** Three sessions (2026-07-01, the scout, this
   one) each independently re-verified "is the public repo clean" by ad-hoc greps and curls —
   probably 30+ minutes of frontier-model time on a check that is now
   `bash .git/hooks/pre-push --manual`. This plan's main deliverable is that nobody does that
   by hand a fourth time.
7. **What NOT to do from this repo:** do not chase the live-site version drift here (okno plan
   item 2, gated on Sam + VPS freeze), do not "fix" the single-commit history (it is a
   deliberate clean-room snapshot), do not add a public CONTRIBUTING/CoC/templates suite (zero
   contributors; weight it when the first real issue arrives), and do not touch `.gitignore`
   or any tracked file locally, ever.

## Do NOT touch

- **No `git add -A`, commit, or push in this repo until item 1 is done.** The plan file leak
  is the single live risk today.
- **Tracked files in `C:\AI_LAB\okno-public`** — never edit locally. All content fixes go to
  `C:\AI_LAB\okno` and arrive via sync. The only writable paths here are `.git\info\exclude`
  and `.git\hooks\*` (items 1–3) plus this untracked plan file.
- **`C:\AI_LAB\okno\scripts\export-public.sh` (v1)** — never execute (rm -rf of this entire
  repo including `.git`). It is replaced/archived by the okno plan item 6.
- **`C:\AI_LAB\okno\deploy-to-vps.sh`** — never execute (root SSH, `apt upgrade` on a shared
  box).
- **The VPS (159.69.152.123 / Tailscale 100.81.115.98)** — frozen until ~2026-07-06 (live
  FLIPER experiment + n8n share the box). Nothing in this plan needs it; deploy work lives in
  the okno plan and is gated on Sam.
- **Git history on either repo** — no rebase, no force-push, no re-init. The pre-push hook
  enforces this for okno-public/main; respect it elsewhere too.
- **`.env.example` via direct agent reads** — the secrets-guard hook blocks it by path (and
  blocks Bash commands containing the bare word `env`). Use the counts-only check inside G2;
  the published copy was verified clean (0 secret-like, 0 PII-like) on 2026-07-03.
- **The secrets-guard hook itself and `~\.claude` config** — out of scope for any executor of
  this plan.

## Open questions for Sam

1. **Live-demo link in the public README?** Adding "Live demo: https://okno.samshennan.com"
   requires a deliberate exception for `okno.samshennan.com` in the sync sweep (one line in the
   okno plan's S3 spec) and puts your personal domain more prominently in the README. The
   GitHub homepage field (item 5) happens regardless. Yes/no?
2. **Homepage timing override:** item 5's default rule is "after the VPS deploy, or on
   2026-07-10 at the latest, whichever comes first". Say the word if you want it set today —
   the live site works, it is just the v1.4 build.
3. **Version number for item 4:** default is `0.2.0`. Say `1.0.0` if you prefer "shipped and
   stable in daily use" semantics — it is defensible; the executor proceeds with 0.2.0 absent
   an answer. (Same question exists in the superseded plan; answering here covers both.)
