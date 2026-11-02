# Professor demonstration checkpoint

Verified November 1, 2026 (America/Chicago). Presentation target: November 2.

[Open Atlas](https://rawcdn.githack.com/hazelfjeld/ai-atlas/7a6533c9e38da862a845fbfd74eacafd4dcf6eaa/index.html) · [Guided tour](https://rawcdn.githack.com/hazelfjeld/ai-atlas/7a6533c9e38da862a845fbfd74eacafd4dcf6eaa/demo.html) · [Expanded machine-learning guide](https://rawcdn.githack.com/hazelfjeld/ai-atlas/7a6533c9e38da862a845fbfd74eacafd4dcf6eaa/terms/MLD-0691-machine-learning.html)

The pinned code commit is `7a6533c9e38da862a845fbfd74eacafd4dcf6eaa`. Later documentation commits record this result without changing those served assets. Previous pinned research/playbook releases remain recoverable through Git history. GitHack may ask the visitor to select “Open the page” first.

## Delivered

- All prepared catalogs: **1,345 terms + 300 technologies + 30 papers + 10 safety records + 20 playbooks = 1,705 records**.
- All original IDs, fields, citations and evidence labels, 19 operational source/query routes, dictionary/technology registers, workbooks, original bundle and SQLite database.
- Global and collection search, exact-name ranking, filters, pagination, record details, comparisons, notebook import/export, JSON/CSV and paper BibTeX export.
- **1,345 direct HTML concept pages**, including related concepts, backlinks, technology connections, original examples and citations; **12 expanded guides**, with mechanisms, prerequisites, illustrative examples, equations and evaluation advice.
- Preserved compact research, playbook and technology pages; original ten-profile gzip increment merged and checked for exact record equality.
- A printable six-step tour and searchable single-file fallback with all catalog data embedded.

## Evidence

`release/http-verification.json` records **88 byte-for-byte public responses**, including all 45 catalog chunks, source registers, all original downloads, runtime assets, page manifest, all 12 expanded guides and two additional reference pages. HTTP status and HTML/JavaScript MIME types are checked, so an interstitial cannot be counted as the app.

`release/browser-verification.json` records real local and public browser interactions. Public paths tested include global search to a permanent concept page, a related concept, research search/details/source links, Escape, safety type filter/reset, technology search/comparison, playbook/profile navigation, profile reload, guided-tour navigation and a 390px mobile menu with no document overflow. The captured public overview is `release/demo-desktop.jpg`.

**19 Node tests pass.** These cover search ranking helpers, Unicode matching, safe URLs, CSV/BibTeX exports, notebook validation, complete catalog loading, checksum corruption, truncation, incorrect totals, a transient network failure, every generated browser term URL, and lossless single-file fallback data. The Python validator passes **18,263 internal links**, page hashes, source/download hashes, unique IDs, cross-catalog relationships and SQLite integrity/record equality. CI also checks reproducible generated outputs.

The direct `file:` URL for the offline fallback could not be tested because the automation browser blocks that protocol. The file was inspected by automated checks for valid inline JavaScript, all original records and no external runtime script/style dependencies. This limit does not apply to the tested public app.

## Remaining limitations

- **1,333 concise reference pages still need expanded explanations.** They are explicitly labeled; all original definition/example/caveat content is already present.
- Imported review labels are historical source-review metadata, not a fresh independent audit. Technology comparisons are editorial, and no benchmark results are fabricated.
- Website-side automatic research collection is off. A failed historical manual collection attempt remains visible. No production scheduler, server database, account sync or exhaustive incident coverage is claimed.
- All internal links are checked locally. Public equality checks sample 14 concept pages; they do not fetch every static concept page. External citations are not all freshly re-audited.
- Browser testing covers the critical demonstration paths in Brave, with phone-width emulation; it is not a complete device/accessibility/browser matrix.
- On GitHack, notebook data is session-only. Export before reloading. Original binary downloads and external sources require internet; the single-file fallback retains catalog search, comparisons and JSON exports.

## Reproduce and recover

```sh
python scripts/validate_checkpoint.py
node --test tests/*.test.cjs
python scripts/build_term_pages.py
python scripts/build_offline.py
git diff --exit-code -- terms publication.json downloads/Atlas_Demo_Offline.html
```

Use HTTPS when hosted, or a localhost HTTP server for development. `.gitattributes` prevents Windows newline conversion from invalidating catalog byte hashes. The importer verifies the approved archive and all package manifest files before importing data; it does not execute archive scripts or replace the app.

Recoverable implementation commits were made for technology import, dictionary import, supporting sources/downloads, workspace integration, static concept pages, loading repairs/offline fallback, concurrent-writer reconciliation and exact global search ranking. The hourly writer's work was merged without force-pushing or changing its schedule. Future work should expand detailed guides and audit sources, rather than reimporting the already complete baseline.
