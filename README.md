# AI Updates — AI research, tools & concepts

A discovery and learning hub for AI research, tools, concepts and safety, with source links and visible limitations. The complete prepared Atlas catalog, original citations, downloads and stable record IDs are preserved.

The **AI Updates** rebrand uses an editorial Discover frontend, topic filters and the evergreen / warm-paper / copper palette. Browse the [concept dictionary](https://aiupdates.app/terms/index.html), [300 direct technology profiles](https://aiupdates.app/technology/index.html), [daily editions](https://aiupdates.app/whats-new.html) and [editorial policy](https://aiupdates.app/about.html). See [brand, SEO and generated-publication guidance](docs/AI_UPDATES_BRAND_AND_SEO.md). Existing Atlas hash routes and notebook storage remain compatible.

## Cloudflare hosting

The original site is hosted at [aiupdates.app](https://aiupdates.app), also available at [www.aiupdates.app](https://www.aiupdates.app) and [the workers.dev address](https://ai-atlas.airheadhazelnut.workers.dev). The allowlisted build and single gated GitHub Actions deployment path are documented in [the deployment guide](docs/CLOUDFLARE_DEPLOYMENT.md); successful production verification is recorded in the deployment workflow. GitHack remains a working fallback. Existing daily-news and hourly-development processes continue updating GitHub unchanged.

## Daily editions — What's New Today

[Open the dated What's New archive](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/whats-new.html)

The homepage and navigation now feature the daily edition reader. Its five sections cover AI news, new technologies, new terms, updates in Atlas and corrections, with source links, category filters, explicit collection windows, a short TL;DR and immutable dated revisions. Publication checks require matching UTF-8 byte counts and SHA-256 digests. **As of November 1, the archive is deliberately empty** while the first verified editorial batch is pending; the site does not fabricate current news or claim a continuous website crawler. The separately scheduled research collector stages candidates, and the hourly publisher verifies and integrates accepted items. See `docs/DAILY_NEWS_PIPELINE.md` for schema and ownership.

[Open the verified Atlas workspace](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/index.html#/overview) · [Three-minute professor tour](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/demo.html) · [Practice Games tab](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/index.html#/games) · [Concept encyclopedia](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/terms/index.html)

The linked November 1 presentation release is pinned to a passing catalog and GitHack-byte verification. The three-minute walkthrough includes concept guides, comparison, the native Games tab, and a truthful daily-archive status. Older published checkpoints remain available in the Git history. The commit-pinned URLs keep the presentation recoverable. GitHack may show an “Open the page” confirmation before the app. The [moving main URL](https://raw.githack.com/hazelfjeld/ai-atlas/main/index.html) can cache older files.

## Published catalog

| Catalog | Verified records |
| --- | ---: |
| Dictionary concepts | 1,345 |
| Technology profiles | 300 |
| Research papers | 30 |
| Safety report records | 10 |
| Problem playbooks | 20 |
| **Total** | **1,705** |

Every original record field, stable ID, source reference and review label is preserved. The archive SHA-256 is `1f1b648e113cec13583217e9ae363def0028506706eed28a7f1f6b9cd4793125`; incremental import provenance is in `release/catalog-import.json`. The concurrent ten-profile gzip import is also preserved and checked against the complete catalog.

The workspace provides global and collection search, filters, pagination, record details, related-concept and technology navigation, comparisons of up to three tools, notebook export/import, JSON/CSV exports and paper BibTeX exports. Original workbooks, the bundle and a foreign-key-checked SQLite database are downloadable from Sources & coverage. Existing research, playbook and compact technology routes remain available.

All **1,345 concepts have direct HTML pages** with original definitions, examples, caveats, sources, related concepts and backlinks. **16 expanded guides** add mechanisms, prerequisites, illustrative worked examples, equations and evaluation advice. The other 1,329 pages visibly identify their detailed expansion as pending. Generated pages work without JavaScript and do not require SPA fallback routing.

## AI safety depth update — November 1, 2026

Four existing dictionary topics now have complete, original worked guides with independently checked primary sources: [specification gaming](terms/MLD-1149-specification-gaming.html), [reward hacking](terms/MLD-1039-reward-hacking.html), [Goodhart's law](terms/MLD-0470-goodhart-s-law.html), and [goal misgeneralization](terms/MLD-0469-goal-misgeneralization.html). The edition at commit [2871660](https://github.com/hazelfjeld/ai-atlas/commit/2871660bf7d5e1ad8c0a3fb18756843a9a03c516) passed 56 JavaScript tests, all 1,345 page checks, 18,309 internal-link checks and GitHack byte verification. This is a catalog/educational enhancement, **not a newly discovered 2026 safety incident**. The prepared catalog remains at 1,705 records; expanded guides increased from 12 to 16.

## Presentation fallback

[Download the searchable single-file fallback](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/downloads/Atlas_Demo_Offline.html), then keep it on the presentation device. It embeds all 1,705 records, styles, application code, Quiz and Match; original downloads, external sources, expanded web pages and the separately published daily archive require the served edition. Direct file-protocol browser testing was blocked by the automation browser's URL policy; inline syntax, embedded record equality and absence of external runtime assets are tested. The printable tour and static concept pages provide additional fallbacks.

## Verification and limitations

Run `python scripts/validate_checkpoint.py` and `node --test tests/*.test.cjs`. The validator checks SHA-256 and byte/record counts for all 45 chunks, source/download hashes, cross-catalog relationships, SQLite integrity, every generated page hash and internal HTML links. Runtime loaders reject incomplete or mixed catalogs, limit parallel requests and retry transient failures. `.gitattributes` preserves exact LF bytes on Windows.

Public HTTP equality and real browser interaction are separate checks. Detailed evidence is in `release/http-verification.json`, `release/browser-verification.json` and `docs/DEMO_CHECKPOINT.md`. CI validates catalogs, helpers, integrity failures, stable term routes and reproducible generated outputs, then checks the public GitHack assets.

This is a curated snapshot, **not a live feed or exhaustive research/incident inventory**. Automatic collection remains off. Imported review labels are not a new source audit or independent replication. The 16 expanded explanations are editorial syntheses with primary citations, not independently reviewed textbooks. External citation destinations have not all been re-audited. Tool comparisons are editorial rather than measured rankings.

On shared GitHack origins, notes/bookmarks/comparisons are session-only; export a notebook backup before reloading. Elsewhere they use browser-local storage. No account backend, analytics, paid services or access-permission changes are introduced.

## Development

No build tools or npm dependencies are needed to run the static site:

```sh
python -m http.server 8000
python scripts/validate_checkpoint.py
node --test tests/*.test.cjs
```

Open `http://localhost:8000/`. Regenerate concept pages with `python scripts/build_term_pages.py`, rebuild discovery HTML, technology profiles and SEO with `python scripts/build_seo.py`, then rebuild the fallback with `python scripts/build_offline.py`. CI checks that these operations are deterministic. The importer accepts only the approved archive and does not execute archive code or replace the entry point.

The current roadmap is `docs/HOURLY_EXPANSION_ROADMAP.md`. Older publication notes remain as historical recovery checkpoints. Resume by expanding the remaining detailed explanations and auditing sources; the prepared catalog import is complete.
