# Atlas — AI technology & safety observatory

## First working publication: research-first checkpoint

The incremental approach has published a working research and safety interface, not merely a setup placeholder.

**Verified checkpoint URL:**
https://rawcdn.githack.com/hazelfjeld/ai-atlas/2d5dac5607a054c4e591238bbd6817b3c2c15b37/index.html

**Moving main-branch URL:**
https://raw.githack.com/hazelfjeld/ai-atlas/main/index.html

The pinned URL serves the verified checkpoint; the main URL tracks later commits and can briefly cache older files. GitHack may show a destination-confirmation page first.

### Published now

- 30 original seed paper records, with authors, dates, tags, summaries, caveats, original source links, review labels, and all original metadata.
- 10 original safety report records, distinguishing incidents, misuse, controlled evaluations, research findings, and mitigation updates.
- Keyword and topic search, report-type filtering, record dialogs, JSON exports, direct record links, and responsive desktop/phone layouts.
- A publication progress view showing what is published versus merely prepared.
- Eight independently committed data chunks, verified against the prepared snapshot byte-for-byte. The frontend checks SHA-256, byte counts, record counts, and duplicate IDs before presenting a complete catalog.

### Not yet published in this checkpoint

The 300 technology profiles, 1,345 dictionary concepts, 20 playbooks, original full-interface features, source registries, spreadsheets, and database downloads remain in the previously prepared conversation package. Their import is unfinished; they are not claimed as available on this site.

**Automatic safety and paper collection is OFF.** No recurring collection task is configured by this checkpoint. This is a curated seed snapshot, not every AI safety paper or incident. Prior review labels are preserved from the prepared dataset; publication is not a fresh source audit or independent replication.

### Verification

Published code commit: `2d5dac5607a054c4e591238bbd6817b3c2c15b37`.

GitHub Actions run: https://github.com/hazelfjeld/ai-atlas/actions/runs/41361273376

Both jobs passed: catalog integrity/JavaScript syntax, and live GitHack HTTP checks. The latter fetched HTML, CSS, JavaScript, the manifest, and all eight JSON chunks, requiring HTTP 200 and exact equality with the commit. HTML and JavaScript MIME types were also checked. These HTTP checks are not hosted-browser interaction tests.

Separately, 16 offline browser checks passed using local fetch fixtures and a SHA-256 bridge: search, filters, dialogs, export, deep links, mobile layout, and corrupted-transfer handling. Localhost browser navigation was blocked by the test environment, so no local-HTTP or hosted-browser test is being claimed.

## Development

No build step or npm dependencies are required for this checkpoint.

```sh
python3 -m http.server 8000
python3 scripts/validate_checkpoint.py
node --check checkpoint.js
```

Open http://localhost:8000/ in a modern browser. Use HTTPS when hosted. The read-only verification workflow runs on index updates or manual dispatch and uses standard hosted runners in this public repository.

The manifest is `publication.json`; resume instructions are in `docs/INCREMENTAL_PUBLICATION.md`. Upload assets and verified chunks before switching the entry point. Do not overwrite new edits or call the full import complete before all expected catalogs are present.

## Privacy and legacy import helpers

This checkpoint stores no personal notes, bookmarks, account data, or API keys. Never place secrets in this public repository or on shared GitHack origins.

The older `release/` helpers and import workflows are retained but are not the mechanism that published this checkpoint. Do not upload or run an older whole-package importer blindly: it may replace the current entry point. Reconcile current changes before importing the original full app.
