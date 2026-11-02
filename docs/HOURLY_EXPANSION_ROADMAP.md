# AI Atlas — recurring expansion plan

## Latest verified incremental progress — November 1, 2026

- **Published commit:** [2871660](https://github.com/hazelfjeld/ai-atlas/commit/2871660bf7d5e1ad8c0a3fb18756843a9a03c516). The verified professor presentation link at commit `839fee0` remains a known-good recovery point.
- **New substantive guides (4):** [specification gaming](../terms/MLD-1149-specification-gaming.html), [reward hacking](../terms/MLD-1039-reward-hacking.html), [Goodhart's law](../terms/MLD-0470-goodhart-s-law.html), [goal misgeneralization](../terms/MLD-0469-goal-misgeneralization.html). Each includes mechanism, worked cases, evaluation procedure, limitations and primary research citations.
- **Verified coverage:** 1,705 source records; 1,345 stable term pages; **16** expanded editorial guides, **1,329** not yet expanded; no newly imported terms, technologies or incident reports in this batch. The 16 authored guides are editorial syntheses, not independently peer-reviewed manuscripts.
- **Validation:** [Actions run 41389008878](https://github.com/hazelfjeld/ai-atlas/actions/runs/41389008878) passed catalog integrity, 56 JavaScript tests, reproducible page/offline generation, 18,309 internal links and exact GitHack HTTP bytes. Feature-branch checks also verified all four new guide pages by HTTP. Hosted browser interactions remain a separate untested boundary.
- **Daily queue:** the staging index reported zero batches and production receipts zero at the start of this run; no real daily edition was manufactured. Recheck both on the next run before any further guide expansion.
- **Next bounded step:** process the first source-verified daily batch if staged; otherwise expand another few high-value concept guides and inspect broken/changed upstream citations. Keep the older pinned demo accessible. No Cloudflare/DNS/billing changes were made.

## Professor demonstration checkpoint — November 1, 2026

This section supersedes the older partial-import status below. All prepared catalogs are now imported: **1,345 terms, 300 technologies, 30 papers, 10 safety reports and 20 playbooks**. Source registers and original downloads are restored. The integrated workspace verifies 45 chunks before rendering; global search, comparisons and cross-catalog links are available. All 1,345 terms have permanent pages; 12 have expanded explanations, leaving 1,333 detailed expansions pending.

Public release code: `3694cfd81702ae88f09054839623c3159a94a026`. Recovery and verification evidence: `docs/DEMO_CHECKPOINT.md`, `release/http-verification.json`, `release/browser-verification.json`. The complete approved source archive was recovered through the original conversation and verified before import. The concurrent ten-profile technology increment was merged and preserved; its compressed records equal the corresponding complete-catalog records.

**Next work:** expand the remaining guides in substantive batches, review sources and freshness, improve accessibility and coverage from observed issues. Do not repeat the prepared imports, regress counts to a partial catalog, or overwrite the integrated entry point with an older importer. Keep the printable demo, offline fallback and compact research/technology/playbook paths working. Website-side automatic collection remains off. Existing recurring development scheduling is separate and was not changed by this sprint.


This roadmap is a resumable implementation checklist for the authorized hourly AI Atlas automation. It is **not** evidence that all planned content is live, nor does it create a separate website-side refresh service.

## Historical baseline before the professor demonstration

- Public repository: `hazelfjeld/ai-atlas` on `main`.
- Published verified checkpoint: 30 papers + 10 safety report records (eight JSON chunks), **plus all 20 original problem playbooks** (four further JSON chunks), with searchable playbooks page.
- Partially imported: **10 of 300** technology profiles (TECH-0001 to TECH-0010) are now searchable and comparable at `technologies.html`; **290** technology records and all **1,345** dictionary terms remain unpublished. Original exports and other richer UI features remain unfinished.
- Source archive: `Atlas_GitHub_GitHack_Ready.zip` in the originating conversation's attachments. SHA-256: `1f1b648e113cec13583217e9ae363def0028506706eed28a7f1f6b9cd4793125`. Data files live under `ai-atlas/app/public/data/` within the archive.
- Automatic website-side collection remains **off**. The recurring ChatGPT automation is separate from a production collector.

## Every run: bounded/recoverable protocol

1. Check current `main` tree and latest commits, `publication.json`, `docs/INCREMENTAL_PUBLICATION.md`, relevant test scripts and workflow results. Avoid parallel repository writers. Make changes in small, separate commits.
2. Prefer the highest-priority unfinished milestone below, reserving a limited amount of each run for source freshness, new AI-safety research or deprecations. Do not silently introduce duplicates.
3. If recovering original data, preserve stable IDs and all original fields. Stage chunks small enough for safe UTF-8 contents writes; record counts/bytes/SHA-256, read back repository blobs and compare. Do not update counts or UI until data actually serves correctly.
4. Keep a good pinned GitHack checkpoint recoverable and do not replace working `index.html` until its dependencies are uploaded and validated. Use relative paths; GitHack does not provide a SPA fallback. Check published content over HTTP when supported, and distinguish static checks from interactive-browser tests.
5. Commit source + tests + metadata together where possible; record commit SHA, published counts, added pages, link-test results, known gaps and next step. If blocked, preserve independent useful work and state the exact blocker. Don't change privacy settings or use paid services.

## Milestone A — complete original catalog (completed in the professor sprint)

- [x] Import 1,345 glossary records with original term IDs and definitions, aliases, tags, categories, examples, related IDs, notes, source references and caveats.
- [x] Import all 300 technology records with strengths, best-fit problems, tradeoffs, constraints, alternatives, source URLs, evidence status and lifecycle information.
- [x] Imported all 20 original playbooks (four chunks, source SHA/blob verification; GitHack HTTP validation successful at commit `6385e484c390545e4fd8280e1a76de3499020d1a`). Source registers remain pending.
- [x] Integrate search, comparison, navigation and saved exports without losing the existing research/safety views.
- [x] Updated `scripts/validate_checkpoint.py` to validate playbooks in `extensions.playbooks`, alongside the unchanged paper/safety main-catalog loader. Extend it similarly for term/technology additions.
- Milestone A is complete only if public paths, counts, UI functions and integrity checks pass, not merely when files are present in GitHub.

## Milestone B — ongoing accuracy and discovery

- Check primary sources for meaningful new safety papers, credible incidents, controlled evaluations, mitigations, new technology capabilities and deprecations.
- Track event/disclosure/revision dates separately; deduplicate by canonical URL/DOI/arXiv ID and incident identity.
- Preserve original source links, review status and limitations. Unreviewed discoveries may be clearly labeled metadata-only; do not convert unreviewed alerts into verified real-world incidents.
- Keep a review queue and visible as-of dates; publish each reviewed batch with tests and source links. Coverage is not exhaustive.

## Milestone C — durable, hyperlinked term encyclopedia

- After Milestone A is genuinely live, create a unique stable route for each term, preferably `terms/<term-id>-<slug>.html`, with direct navigation via GitHack. Do not rely on client-side fallback routing.
- Each term page has original detailed definition, intuitive mechanism, examples and application, prerequisites, appropriate equation/pseudocode when helpful, key tradeoffs, common pitfalls, related concepts, technology links, citations, and last-reviewed date.
- Link every term from glossary search and make related-term references clickable, including backlinks where feasible. Prefer reproducible templates and accessible mobile-first markup; validate slugs and dead links.
- Track coverage: imported term count, linked-term count, detailed-page count, reviewed-page count and broken-link count. Avoid placeholder pages masquerading as finished explanations.
- When all pages exist, continue improving depth, checking source freshness and adding new entries rather than stopping.

## Non-goals and safeguards

Never claim every paper/incident is cataloged; never treat a scheduled ChatGPT task as a verified live feed. No credentials in public files, scraped copyrighted text, unrelated repository changes, or destructive package overwrites. Keep notes and personal data out of shared GitHack storage.
## Historical November 1 ten-profile checkpoint (superseded)

- Approved ZIP SHA-256 checked against the source archive. A new deterministic importer `scripts/prepare_atlas_batch.py` stages source-exact technology/term chunks (compact UTF-8 JSON, gzip mtime=0) and outputs expanded/packed hash metadata. Do not treat staged data as published.
- Published **10 original profiles**, TECH-0001–TECH-0010, in `data/technologies-01.json.gz` (4,025 bytes). Packed SHA-256: `745c98af1103fded4368b2e4adfd11a1b0c1ec5e6209ccadb4fcfa38b781b361`; expanded SHA-256: `e58d5762d6cd5fe357fd21a10f59c000ab34e3543f3fadd2d7ae86bd91ada6af` (14,567 bytes). Git blob ID: `f9fc944f728960240540f0d8e857d261bf652a4a`.
- Searchable `technologies.html` supports section/topic/stage filtering, source links, full original record inspection, JSON export, stable `#TECH-000N` anchors and side-by-side comparison. Modern browsers with gzip DecompressionStream support are needed when the CDN serves packed bytes.
- Publication commit: `7b2c31fd8d6437a0230141bace9c7d9de7de7ed0`. Verification run: https://github.com/hazelfjeld/ai-atlas/actions/runs/41373737867. Catalog/syntax and actual GitHack HTTP bytes passed; a live interactive-browser test remains outstanding.
- **Next source batch:** TECH-0011 onward. First import another carefully bounded batch (for example 10–25), read back exact blobs, then update `extensions.technologies` and published count; preserve a commit-pinned good demo URL. Glossary import remains the next major feature after technologies.
