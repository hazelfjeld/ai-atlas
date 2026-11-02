# Incremental publication recovery checkpoint

## Professor demonstration checkpoint — November 1, 2026

This section supersedes the older partial-import status below. All prepared catalogs are now imported: **1,345 terms, 300 technologies, 30 papers, 10 safety reports and 20 playbooks**. Source registers and original downloads are restored. The integrated workspace verifies 45 chunks before rendering; global search, comparisons and cross-catalog links are available. All 1,345 terms have permanent pages; 12 have expanded explanations, leaving 1,333 detailed expansions pending.

Public release code: `7a6533c9e38da862a845fbfd74eacafd4dcf6eaa`. Recovery and verification evidence: `docs/DEMO_CHECKPOINT.md`, `release/http-verification.json`, `release/browser-verification.json`. The complete approved source archive was recovered through the original conversation and verified before import. The concurrent ten-profile technology increment was merged and preserved; its compressed records equal the corresponding complete-catalog records.

**Next work:** expand the remaining guides in substantive batches, review sources and freshness, improve accessibility and coverage from observed issues. Do not repeat the prepared imports, regress counts to a partial catalog, or overwrite the integrated entry point with an older importer. Keep the printable demo, offline fallback and compact research/technology/playbook paths working. Website-side automatic collection remains off. Existing recurring development scheduling is separate and was not changed by this sprint.


Recorded November 1, 2026. This is a recovery note, not an instruction to run unattended work.

## Verified published state

- Working research-first UI at code commit `2d5dac5607a054c4e591238bbd6817b3c2c15b37`.
- Verified URL: https://rawcdn.githack.com/hazelfjeld/ai-atlas/2d5dac5607a054c4e591238bbd6817b3c2c15b37/index.html
- Verification run: https://github.com/hazelfjeld/ai-atlas/actions/runs/41361273376
- Catalog job `125011959277`: passed.
- GitHack HTTP job `125011984544`: passed; all 12 served files matched the checked-out commit, with HTTP 200 and checked HTML/JavaScript MIME types.
- Published records at the original checkpoint: 30 papers and 10 safety reports, in eight five-record JSON chunks under `data/`. A newer verified checkpoint adds **20 complete original playbooks** in four more chunks.
- Every original record field is preserved. Chunk bytes match the compact serialization of the prepared catalog.
- UI: keyword/topic/type filtering, record dialogs, deep links, full JSON exports, phone/desktop layout, and explicit coverage/progress.
- Frontend SHA-256 and count validation reject partial or mixed-version catalogs instead of presenting them as complete.
- No scheduled collector, no live feed, no account service, no personal-data persistence.

## New verified playbook checkpoint (November 1, 2026)

- Commit: `6385e484c390545e4fd8280e1a76de3499020d1a`.
- URL: https://rawcdn.githack.com/hazelfjeld/ai-atlas/6385e484c390545e4fd8280e1a76de3499020d1a/playbooks.html
- Actions: https://github.com/hazelfjeld/ai-atlas/actions/runs/41367887480 (both jobs passed, 18 exact hosted files verified).
- Playbooks `PB-01` through `PB-20` preserved with original fields, technology IDs, rationale, first step, validation, caveat, tags and editorial review status. The four uploaded blob hashes match the original archive byte-for-byte after canonical compact serialization.
- New `playbooks.html` and `playbooks.js` support search, topic filters, record anchors, details and export. Frontend verifies SHA-256, bytes, counts and duplicate IDs before rendering.
- Offline browser fixture test passed all 20 records, search, reset, filter, deep link, JSON export, mobile layout and absence of JavaScript errors. Hosted browser interaction still not tested (browser navigation blocked); GitHack HTTP responses were verified independently.
- `publication.json` now counts 20 playbooks under `extensions.playbooks`. `files` remains research/safety-only because `checkpoint.js` still supports those two kinds. Validator and CI were expanded accordingly. No website-side automatic collector is active.

## Current test boundaries

Sixteen offline browser checks passed with local fetch fixtures and a Python SHA-256 bridge. The environment blocked browser navigation to localhost, so these are not local-HTTP integration tests. GitHub Actions separately verified actual GitHack HTTP responses. Hosted-browser interactions have not been tested.

Tested UI files have these Git blob IDs:

| File | Git blob SHA |
| --- | --- |
| index.html | 0aab6e2ec4669d11ed7d62652418beca210898d2 |
| checkpoint.css | 33b7b5837869f41511c49884d127ab00eb60abf7 |
| checkpoint.js | 31a94bfa9b97e1456dd84939b8f37230a605434a |
| publication.json | ec26b255b44b62c7c15ad9f0deaca8a8760b14e4 |

## Recover the remaining original content

The source artifact is the conversation attachment `Atlas_GitHub_GitHack_Ready.zip`.

Archive SHA-256: `1f1b648e113cec13583217e9ae363def0028506706eed28a7f1f6b9cd4793125`.

Original catalog directory within it: `ai-atlas/app/public/data/`.

Remaining **unpublished** catalogs include `terms.json` (1,345), `technologies.json` (300), sections, source registers, source-health metadata and the review queue. `playbooks.json` (20) is now fully published. Full original UI assets, collectors, tests, spreadsheets, and database downloads are also in the archive. Do not claim these are published merely because the archive exists.

## Next bounded increments

1. Read the current repository tree and manifest before writing. Preserve newer edits and use exactly one writer. The prior blocker was large/incomplete transfers; small UTF-8 file writes have now succeeded.
2. Stage a modest dictionary or technology batch from the original artifact (playbooks are complete). Preserve IDs and every field. Use compact JSON, UTF-8, and a trailing newline. Calculate record counts, byte counts, SHA-256 and Git blob hashes before uploading.
3. Upload batches to new paths. Read back the tree/blob IDs and compare against local originals. Do not discard already committed batches when a later upload fails.
4. Extend the loader/validation/UI for the new catalog kind only when a coherent section is ready. Keep main `files` paper/safety-only until the current `checkpoint.js` is updated; use another checksummed extension, as with playbooks, when appropriate. Distinguish the imported count from the prepared target; never silently claim a partial catalog is complete.
5. Update the manifest after the data and code are committed. Switch the entry point last; an `index.html` update triggers read-only publication checks. Inspect both jobs, not only the overall workflow badge. The older compact workflow can succeed while skipping import.
6. Produce a new commit-pinned GitHack link after verification. The old pinned URL remains a stable checkpoint. The main-branch URL may be cached.
7. Restore the full original comparison/playbook/source/download experience incrementally. Reconcile the current UI with the original before overwriting anything. Keep the prepared full app separate from this partial publication in status language.
8. Treat automatic research discovery as a later integration. No automated candidate may become a verified incident merely because it was fetched. Keep event dates, disclosure dates, revisions, provenance and review state separate. Do not claim exhaustive coverage.

The existing `release/` import helpers are retained for recovery but should not be run blindly against this checkpoint. Publication authorization does not authorize paid services, embedded secrets, or unrelated repository changes.
