# Atlas — AI technology & safety observatory

Public repository for Hazel's prepared Atlas app.

**Deployment gate:** the complete app is published only when `index.html` exists
at the root after a successful import. Creating this repository or installing the
workflow alone does not upload the catalog or make the app live.

## Finish the one-time package upload

1. Download `Atlas_GitHub_GitHack_Ready.zip` from the ChatGPT conversation.
2. Open https://github.com/hazelfjeld/ai-atlas/upload/main and upload the ZIP itself
   at the repository root. Keep its original filename and commit to `main`.
3. Check the **Import and publish approved Atlas package** run under Actions.
   The workflow verifies the exact archive and every original file checksum,
   imports all source and downloads, validates catalog counts, rebuilds the app,
   runs the tests, and pushes the completed static app.

No token, API key, account login, paid service, or GitHub Pages setting is needed
in the app. GitHub may require you to enable Actions if you have disabled them.
The importer accepts only the specific approved archive, not arbitrary ZIP files.

## App address after successful publication

https://raw.githack.com/hazelfjeld/ai-atlas/main/index.html

The workflow summary also prints a commit-pinned `rawcdn.githack.com` address.
GitHack can show a destination confirmation page or briefly cache an older file.
This repository does not claim that either URL is live until the app is imported.

## Preserved content

- 300 technology profiles with strengths, tradeoffs, tags and reference links.
- 1,345 dictionary concepts and 20 problem-based playbooks.
- 30 paper records and 10 evidence-labeled safety report records.
- Source registries, relationships, search, comparison, original spreadsheets,
  database downloads, collectors, tests and editable application source.

These are starter collections, not exhaustive coverage. Automatic safety-paper
collection and alert updates are **not active**. Unreviewed discoveries must not
be labeled as confirmed incidents. No recurring safety-update job is installed.

On shared GitHack domains, notes/bookmarks are session-only; export them before
closing or reloading. Never store secrets in the notebook or public repository.

## Development after import

```sh
python3 scripts/build_site.py
cd app
npm test
```

The old `publish.py` is an initial-new-repository helper; do not run it against
this existing repository. Use ordinary commits/pushes for future changes. The
original package README is preserved at `docs/ORIGINAL_PACKAGE_README.md`.
