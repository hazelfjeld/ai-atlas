# Atlas — AI technology & safety observatory

## Published checkpoints: research, safety, playbooks and technology preview

The incremental approach has published a working research and safety interface **and all 20 original problem playbooks**, plus the first ten original technology profiles with search and comparison, rather than merely creating setup files.

**Verified checkpoint URL:**
https://rawcdn.githack.com/hazelfjeld/ai-atlas/6385e484c390545e4fd8280e1a76de3499020d1a/index.html

**Verified playbooks page:**
https://rawcdn.githack.com/hazelfjeld/ai-atlas/6385e484c390545e4fd8280e1a76de3499020d1a/playbooks.html

**Verified technology preview:**
https://rawcdn.githack.com/hazelfjeld/ai-atlas/7b2c31fd8d6437a0230141bace9c7d9de7de7ed0/technologies.html

**Verified guided demo (with technology step):**
https://rawcdn.githack.com/hazelfjeld/ai-atlas/7b2c31fd8d6437a0230141bace9c7d9de7de7ed0/demo.html

**Moving main-branch URL:**
https://raw.githack.com/hazelfjeld/ai-atlas/main/index.html

The pinned URL serves the verified checkpoint; the main URL tracks later commits and can briefly cache older files. GitHack may show a destination-confirmation page first.

### Published now

- 30 original seed paper records, with authors, dates, tags, summaries, caveats, original source links, review labels, and all original metadata.
- 10 original safety report records, distinguishing incidents, misuse, controlled evaluations, research findings, and mitigation updates.
- Keyword and topic search, report-type filtering, record dialogs, JSON exports, direct record links, and responsive desktop/phone layouts.
- All 20 preserved original problem playbooks, including steps, validation checks, caveats, technology choices, topic filtering, direct record anchors and JSON export.
- **10 / 300 original technology profiles** (TECH-0001–TECH-0010) with verified lossless gzip JSON, keyword/section/topic/stage filters, source links, record details, original-field inspection, JSON export, deep links and comparison for 2–3 profiles. The other 290 remain pending.
- A publication progress view showing what is published versus merely prepared.
- Eight original research/safety chunks plus four playbook chunks, imported in small commits and verified against the original source archive using Git blob hashes. The frontends check SHA-256, byte counts, record counts, and duplicate IDs before presenting a complete catalog.

### Not yet published in this checkpoint

The other **290 technology profiles**, **1,345 dictionary concepts**, original full-interface features, source registries, spreadsheets, and database downloads remain in the previously prepared conversation package. Their import is unfinished; they are not claimed as available on this site.

**Automatic safety and paper collection is OFF.** No recurring collection task is configured by this checkpoint. This is a curated seed snapshot, not every AI safety paper or incident. Prior review labels are preserved from the prepared dataset; publication is not a fresh source audit or independent replication.

### Verification

Published code commit: `6385e484c390545e4fd8280e1a76de3499020d1a`.

GitHub Actions playbook run: https://github.com/hazelfjeld/ai-atlas/actions/runs/41367887480

GitHub Actions technology-preview run: https://github.com/hazelfjeld/ai-atlas/actions/runs/41373737867 — both catalog/syntax and public GitHack byte-for-byte jobs passed at publication commit `7b2c31fd8d6437a0230141bace9c7d9de7de7ed0`. This confirms static asset integrity, not hosted interactive-browser behavior.

Both jobs passed: catalog integrity/JavaScript syntax and live GitHack HTTP checks. The latter fetched 18 files including HTML, CSS, JavaScript, the manifest and 12 JSON chunks, requiring HTTP 200 and byte-for-byte equality with the commit. HTML and JavaScript MIME types were also checked. These HTTP checks are not hosted-browser interaction tests.

The original research interface passed 16 offline browser checks. The new playbook page additionally passed offline browser checks covering all 20 records, search, topic filtering, reset, direct links, JSON export, mobile layout, and absence of JavaScript errors, using local fixtures and a SHA-256 bridge. Local/hosted browser navigation was blocked in the test environment; HTTP equality checks cover the hosted assets but are not interactive browser tests.

## Development

No build step or npm dependencies are required for this checkpoint.

```sh
python3 -m http.server 8000
python3 scripts/validate_checkpoint.py
node --check checkpoint.js
node --check playbooks.js
node --check technologies.js
```

Open http://localhost:8000/ in a modern browser. Use HTTPS when hosted. The read-only verification workflow runs on index updates or manual dispatch and uses standard hosted runners in this public repository.

The manifest is `publication.json`; resume instructions are in `docs/INCREMENTAL_PUBLICATION.md` and `docs/HOURLY_EXPANSION_ROADMAP.md`. To prepare a deterministic source chunk from the approved archive, use `scripts/prepare_atlas_batch.py` (requires the original ZIP, refuses checksum mismatch, never publishes automatically). Upload assets and verified chunks before switching the entry point. Do not overwrite new edits or call the full import complete before all expected catalogs are present.

## Privacy and legacy import helpers

This checkpoint stores no personal notes, bookmarks, account data, or API keys. Never place secrets in this public repository or on shared GitHack origins.

The older `release/` helpers and import workflows are retained but are not the mechanism that published this checkpoint. Do not upload or run an older whole-package importer blindly: it may replace the current entry point. Reconcile current changes before importing the original full app.
