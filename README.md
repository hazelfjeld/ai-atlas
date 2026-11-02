# Atlas — AI technology & safety observatory

A complete import of the prepared November 1, 2026 catalog, with connected search, technology comparisons, source registers, downloads and permanent concept pages.

[Open the professor demonstration](https://rawcdn.githack.com/hazelfjeld/ai-atlas/7a6533c9e38da862a845fbfd74eacafd4dcf6eaa/index.html) · [Five-minute tour](https://rawcdn.githack.com/hazelfjeld/ai-atlas/7a6533c9e38da862a845fbfd74eacafd4dcf6eaa/demo.html) · [Concept encyclopedia](https://rawcdn.githack.com/hazelfjeld/ai-atlas/7a6533c9e38da862a845fbfd74eacafd4dcf6eaa/terms/index.html)

The commit-pinned URLs keep the presentation recoverable. GitHack may show an “Open the page” confirmation before the app. The [moving main URL](https://raw.githack.com/hazelfjeld/ai-atlas/main/index.html) can cache older files.

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

All **1,345 concepts have direct HTML pages** with original definitions, examples, caveats, sources, related concepts and backlinks. **12 expanded guides** add mechanisms, prerequisites, illustrative worked examples, equations and evaluation advice. The other 1,333 pages visibly identify their detailed expansion as pending. Generated pages work without JavaScript and do not require SPA fallback routing.

## Presentation fallback

[Download the searchable single-file fallback](https://rawcdn.githack.com/hazelfjeld/ai-atlas/7a6533c9e38da862a845fbfd74eacafd4dcf6eaa/downloads/Atlas_Demo_Offline.html), then keep it on the presentation device. It embeds all 1,705 records, styles and application code; original downloads, external sources and expanded web pages require the served edition. Direct file-protocol browser testing was blocked by the automation browser's URL policy; inline syntax, embedded record equality and absence of external runtime assets are tested. The printable tour and static concept pages provide additional fallbacks.

## Verification and limitations

Run `python scripts/validate_checkpoint.py` and `node --test tests/*.test.cjs`. The validator checks SHA-256 and byte/record counts for all 45 chunks, source/download hashes, cross-catalog relationships, SQLite integrity, every generated page hash and internal HTML links. Runtime loaders reject incomplete or mixed catalogs, limit parallel requests and retry transient failures. `.gitattributes` preserves exact LF bytes on Windows.

Public HTTP equality and real browser interaction are separate checks. Detailed evidence is in `release/http-verification.json`, `release/browser-verification.json` and `docs/DEMO_CHECKPOINT.md`. CI validates catalogs, helpers, integrity failures, stable term routes and reproducible generated outputs, then checks the public GitHack assets.

This is a curated snapshot, **not a live feed or exhaustive research/incident inventory**. Automatic collection remains off. Imported review labels are not a new source audit or independent replication. The 12 new explanations are editorial syntheses with primary citations, not independently reviewed textbooks. External citation destinations have not all been re-audited. Tool comparisons are editorial rather than measured rankings.

On shared GitHack origins, notes/bookmarks/comparisons are session-only; export a notebook backup before reloading. Elsewhere they use browser-local storage. No account backend, analytics, paid services or access-permission changes are introduced.

## Development

No build tools or npm dependencies are needed to run the static site:

```sh
python -m http.server 8000
python scripts/validate_checkpoint.py
node --test tests/*.test.cjs
```

Open `http://localhost:8000/`. Regenerate concept pages with `python scripts/build_term_pages.py`, then rebuild the fallback with `python scripts/build_offline.py`. CI checks that these operations are deterministic. The importer accepts only the approved archive and does not execute archive code or replace the entry point.

The current roadmap is `docs/HOURLY_EXPANSION_ROADMAP.md`. Older publication notes remain as historical recovery checkpoints. Resume by expanding the remaining detailed explanations and auditing sources; the prepared catalog import is complete.
