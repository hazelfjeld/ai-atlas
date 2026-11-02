# AI Atlas — recurring expansion plan

This roadmap is a resumable implementation checklist for the authorized hourly AI Atlas automation. It is **not** evidence that all planned content is live, nor does it create a separate website-side refresh service.

## Current baseline (confirmed Nov 1, 2026)

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

## Milestone A — complete original catalog

- Import 1,345 glossary records with original term IDs and definitions, aliases, tags, categories, examples, related IDs, notes, source references and caveats.
- [PARTIAL — 10/300] Import 300 technology records with strengths, best-fit problems, tradeoffs, constraints, alternatives, source URLs, evidence status and lifecycle information.
- [x] Imported all 20 original playbooks (four chunks, source SHA/blob verification; GitHack HTTP validation successful at commit `6385e484c390545e4fd8280e1a76de3499020d1a`). Source registers remain pending.
- Integrate search, comparison, navigation and saved exports without losing the existing research/safety views.
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
## November 1 technology-publication checkpoint

- Approved ZIP SHA-256 checked against the source archive. A new deterministic importer `scripts/prepare_atlas_batch.py` stages source-exact technology/term chunks (compact UTF-8 JSON, gzip mtime=0) and outputs expanded/packed hash metadata. Do not treat staged data as published.
- Published **10 original profiles**, TECH-0001–TECH-0010, in `data/technologies-01.json.gz` (4,025 bytes). Packed SHA-256: `745c98af1103fded4368b2e4adfd11a1b0c1ec5e6209ccadb4fcfa38b781b361`; expanded SHA-256: `e58d5762d6cd5fe357fd21a10f59c000ab34e3543f3fadd2d7ae86bd91ada6af` (14,567 bytes). Git blob ID: `f9fc944f728960240540f0d8e857d261bf652a4a`.
- Searchable `technologies.html` supports section/topic/stage filtering, source links, full original record inspection, JSON export, stable `#TECH-000N` anchors and side-by-side comparison. Modern browsers with gzip DecompressionStream support are needed when the CDN serves packed bytes.
- Publication commit: `7b2c31fd8d6437a0230141bace9c7d9de7de7ed0`. Verification run: https://github.com/hazelfjeld/ai-atlas/actions/runs/41373737867. Catalog/syntax and actual GitHack HTTP bytes passed; a live interactive-browser test remains outstanding.
- **Next source batch:** TECH-0011 onward. First import another carefully bounded batch (for example 10–25), read back exact blobs, then update `extensions.technologies` and published count; preserve a commit-pinned good demo URL. Glossary import remains the next major feature after technologies.
