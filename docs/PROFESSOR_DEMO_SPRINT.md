# Presentation readiness sprint — November 2, 2026

## Updated three-minute professor walkthrough — November 1, 2026

The latest **verified**, non-destructive presentation release is `839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6`:
[original Atlas workspace](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/index.html#/overview) · [three-minute guided tour](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/demo.html) · [Games inside Atlas](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/index.html#/games) · [dated news archive](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/whats-new.html). The original `3694cfd...` link remains a historical, immutable recovery point, but it predates the integrated Games tab.

The new printable tour includes a bounded four-stop sequence: **00:00–00:40** open the expanded machine-learning concept and citations; **00:40–01:25** compare technologies and caveats; **01:25–02:15** play Quiz or Match inside the original workspace; **02:15–03:00** distinguish controlled safety evaluations from incident reports and inspect the true publication status of What's New Today. The original longer evidence-first walkthrough remains available underneath.

The complete source baseline is unchanged at **1,705 records** (1,345 terms, 300 technologies, 20 playbooks, 30 papers, 10 safety reports). All 1,345 terms have stable pages; **12** are substantively expanded, leaving **1,333** for depth work. At the time of this update, `atlas-daily-staging/daily-queue/index.json` had **zero** batches and `data/daily/published-batches.json` had zero receipts. An awaiting-first-edition screen is therefore expected, not a report of no AI news.

Verification: [presentation HTML/link and public byte checks](https://github.com/hazelfjeld/ai-atlas/actions/runs/41383692531) passed at `c61ca332...`; [full catalog integrity, 52+ automated rules/UI tests, reproducible pages and exact GitHack content](https://github.com/hazelfjeld/ai-atlas/actions/runs/41383788268) passed at `839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6`. The second commit corrected the validator's valid-route list to include the native `#/games` route; it did not alter the demo HTML. Hosted full-browser testing of the newly revised printable tour remains a separate limitation; CI checked public HTML bytes, not an interactive teaching session.

**Next run:** check for staged reviewed daily batches first. If none, expand another small set of high-value substantive concept guides with primary references and rerun the content/link checks. Preserve the pinned verified professor release.

## Professor demonstration checkpoint — November 1, 2026

This section supersedes the older partial-import status below. All prepared catalogs are now imported: **1,345 terms, 300 technologies, 30 papers, 10 safety reports and 20 playbooks**. Source registers and original downloads are restored. The integrated workspace verifies 45 chunks before rendering; global search, comparisons and cross-catalog links are available. All 1,345 terms have permanent pages; 12 have expanded explanations, leaving 1,333 detailed expansions pending.

Public release code: `3694cfd81702ae88f09054839623c3159a94a026`. Recovery and verification evidence: `docs/DEMO_CHECKPOINT.md`, `release/http-verification.json`, `release/browser-verification.json`. The complete approved source archive was recovered through the original conversation and verified before import. The concurrent ten-profile technology increment was merged and preserved; its compressed records equal the corresponding complete-catalog records.

**Next work:** expand the remaining guides in substantive batches, review sources and freshness, improve accessibility and coverage from observed issues. Do not repeat the prepared imports, regress counts to a partial catalog, or overwrite the integrated entry point with an older importer. Keep the printable demo, offline fallback and compact research/technology/playbook paths working. Website-side automatic collection remains off. Existing recurring development scheduling is separate and was not changed by this sprint.


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

## Technology preview made available for the professor demo

- Release: `7b2c31fd8d6437a0230141bace9c7d9de7de7ed0`; technology catalog: https://rawcdn.githack.com/hazelfjeld/ai-atlas/7b2c31fd8d6437a0230141bace9c7d9de7de7ed0/technologies.html
- Ten complete original technology records are published, while 290 await import. The comparison UI supports up to three selected records. A useful tour compares Amazon Bedrock vs Amazon SageMaker AI: pick both and show strengths, best-fit uses, caveats and source documentation.
- `demo.html` was extended with this technology step. Research 30, safety 10, playbooks 20 remain intact. The verification workflow passed both catalog/syntax and actual GitHack static-file checks: https://github.com/hazelfjeld/ai-atlas/actions/runs/41373737867. This is not a hosted browser interaction test.
- Continue source-exact technology batches beginning TECH-0011, then the 1,345 glossary terms. Avoid broad unverified status claims during the presentation.
