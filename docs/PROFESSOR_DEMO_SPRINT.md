# Presentation readiness sprint — November 2, 2026

## Goal and expiry

Prioritize a dependable, demonstrable Atlas release for the morning of Monday, November 2, 2026, America/Chicago. This is a planning target, not a guaranteed delivery time or a known meeting time. The existing hourly ChatGPT task remains the only scheduled writer. It is not uninterrupted execution or a separate production data feed. After the presentation deadline, resume the ongoing expansion roadmap; do not stop the task.

## First things to ship

1. Import the original missing glossary and technology catalogs in small verified batches. Preserve IDs and every field; improve the working UI alongside the data. The prepared baseline has 1,345 terms and 300 technologies. Check current counts before writing. The first hourly run already published all 20 original playbooks.
2. Keep research, safety, playbooks and newly available sections discoverable, searchable and readable. Favor actual shipped content and broken-path fixes over planning-only commits, new infrastructure or cosmetic rewrites.
3. After the finite prepared baseline is public, add substantive linked term pages. Continue evidence/freshness work in bounded batches so the discovery backlog cannot indefinitely postpone encyclopedia work.
4. Preserve a known-good commit-pinned presentation release. No destructive last-minute imports, force-pushes or unsupported status claims.

## Guided demo

`demo.html` provides a printable, JavaScript-free walkthrough of the currently working research, safety, playbook and progress views. It deliberately quotes no fixed counts and links to the current release's inventory. Extend the tour only when a newly added section really works. Keep internal links relative so each commit-pinned release remains self-contained.

Suggested path: research question -> source and caveats -> report/evidence type -> practical playbook -> published coverage and limitations. Do not call an experiment a deployment incident or an imported evidence label a fresh independent audit.

## Acceptance checks before calling a demo ready

- Catalog checksums, IDs and displayed counts agree with the committed manifest.
- Search, reset, topic/report-type filters and record dialogs work on each live section.
- Source URLs, internal navigation and direct links are correct; no links to missing catalog pages.
- Desktop, phone and keyboard navigation are usable. Distinguish static checks from real browser tests.
- Public HTTP responses match the intended commit; do not confuse an HTTP 200 confirmation/interstitial with the app.
- Preserve a verified stable URL and, where possible, a self-contained offline fallback for the presentation.
- Keep coverage, as-of dates and the website collector's actual status explicit.
- Finish a run with concrete counts, tested commit, exact remaining limitations and the next unfinished batch.

## Change recorded in the interactive session

Added `demo.html` in commit a9c8c9b4ee005794550b0c55f5c0cc5d1750d42a. Fourteen local structural checks passed: page heading/IDs, skip target, viewport, print styles, focus indication, no JavaScript dependency, expected routes, explicit coverage/feed language, relative paths and safe link schemes. These are not hosted-browser interaction tests or a whole-app test suite.

The original archive is available in the originating conversation as `Atlas_GitHub_GitHack_Ready.zip`; the current interactive runtime confirmed its mounted path. Future runs must locate their own accessible copy rather than assuming this container persists. Archive details and import guidance remain in `docs/INCREMENTAL_PUBLICATION.md` and `docs/HOURLY_EXPANSION_ROADMAP.md`.

## Concurrency and recovery

Read the latest branch and file SHAs before each write. If another writer or a changed file is detected, reconcile or choose an independent path; never overwrite newer work. Commit verified dependencies before changing entry points. Keep a short durable checkpoint so a new run resumes the next unfinished batch instead of starting over.
