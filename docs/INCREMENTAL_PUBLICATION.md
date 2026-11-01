# Incremental publication recovery checkpoint

Recorded November 1, 2026. This is a recovery note, not an instruction to run unattended work.

## Verified published state

- Working research-first UI at code commit `2d5dac5607a054c4e591238bbd6817b3c2c15b37`.
- Verified URL: https://rawcdn.githack.com/hazelfjeld/ai-atlas/2d5dac5607a054c4e591238bbd6817b3c2c15b37/index.html
- Verification run: https://github.com/hazelfjeld/ai-atlas/actions/runs/41361273376
- Catalog job `125011959277`: passed.
- GitHack HTTP job `125011984544`: passed; all 12 served files matched the checked-out commit, with HTTP 200 and checked HTML/JavaScript MIME types.
- Published records: 30 papers and 10 safety reports, in eight five-record JSON chunks under `data/`.
- Every original record field is preserved. Chunk bytes match the compact serialization of the prepared catalog.
- UI: keyword/topic/type filtering, record dialogs, deep links, full JSON exports, phone/desktop layout, and explicit coverage/progress.
- Frontend SHA-256 and count validation reject partial or mixed-version catalogs instead of presenting them as complete.
- No scheduled collector, no live feed, no account service, no personal-data persistence.

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

Remaining catalogs include `terms.json` (1,345), `technologies.json` (300), `playbooks.json` (20), sections, source registers, source-health metadata and the review queue. Full original UI assets, collectors, tests, spreadsheets, and database downloads are also in the archive. Do not claim these are published merely because the archive exists.

## Next bounded increments

1. Read the current repository tree and manifest before writing. Preserve newer edits and use exactly one writer. The prior blocker was large/incomplete transfers; small UTF-8 file writes have now succeeded.
2. Stage a modest dictionary or technology batch from the original artifact. Preserve IDs and every field. Use compact JSON, UTF-8, and a trailing newline. Calculate record counts, byte counts, SHA-256 and Git blob hashes before uploading.
3. Upload batches to new paths. Read back the tree/blob IDs and compare against local originals. Do not discard already committed batches when a later upload fails.
4. Extend the loader/validation/UI for the new catalog kind only when a coherent section is ready. Distinguish the imported count from the prepared target; never silently claim a partial catalog is complete.
5. Update the manifest after the data and code are committed. Switch the entry point last; an `index.html` update triggers read-only publication checks. Inspect both jobs, not only the overall workflow badge. The older compact workflow can succeed while skipping import.
6. Produce a new commit-pinned GitHack link after verification. The old pinned URL remains a stable checkpoint. The main-branch URL may be cached.
7. Restore the full original comparison/playbook/source/download experience incrementally. Reconcile the current UI with the original before overwriting anything. Keep the prepared full app separate from this partial publication in status language.
8. Treat automatic research discovery as a later integration. No automated candidate may become a verified incident merely because it was fetched. Keep event dates, disclosure dates, revisions, provenance and review state separate. Do not claim exhaustive coverage.

The existing `release/` import helpers are retained for recovery but should not be run blindly against this checkpoint. Publication authorization does not authorize paid services, embedded secrets, or unrelated repository changes.
