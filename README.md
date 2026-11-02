# AI Updates — AI research, tools & concepts

A discovery and learning hub for AI research, tools, concepts and safety, with source links and visible limitations. The complete prepared Atlas catalog, original citations, downloads and stable record IDs are preserved.

The **AI Updates** rebrand uses an editorial Discover frontend, topic filters and the evergreen / warm-paper / copper palette. Browse the [concept dictionary](https://aiupdates.app/terms/index.html), [300 direct technology profiles](https://aiupdates.app/technology/index.html), [daily editions](https://aiupdates.app/whats-new.html) and [editorial policy](https://aiupdates.app/about.html). See [brand, SEO and generated-publication guidance](docs/AI_UPDATES_BRAND_AND_SEO.md). Existing Atlas hash routes and notebook storage remain compatible.

## Cloudflare hosting

The original site is hosted at [aiupdates.app](https://aiupdates.app), also available at [www.aiupdates.app](https://www.aiupdates.app) and [the workers.dev address](https://ai-atlas.airheadhazelnut.workers.dev). The allowlisted build and single gated GitHub Actions deployment path are documented in [the deployment guide](docs/CLOUDFLARE_DEPLOYMENT.md); successful production verification is recorded in the deployment workflow. GitHack remains a working fallback. Existing daily-news and hourly-development processes continue updating GitHub unchanged.

## Daily edition keyword search — November 2

The [daily archive](https://aiupdates.app/whats-new.html) now includes local multiword search of the selected integrity-verified edition's headlines, caveats, tags, IDs and source URLs. Search combines with the existing section and topic filters and provides match counts plus a keyboard-accessible reset. This UI change does not add or rewrite historical news, catalog records or immutable editions. [November 2 revision 6](https://aiupdates.app/whats-new.html?date=2026-11-02&revision=6) remains the last independently verified publication until the new deployment checks pass.

## Verified November 2 archive revision 5

[Read the current November 2 edition and its revision history](https://aiupdates.app/whats-new.html?date=2026-11-02&revision=5). The archive now explains **what changed between immutable editions**: added, revised and removed news, technology entries, terminology, site changes and corrections. The earlier revision is displayed in this comparison only after its own checksum and byte count pass; failed comparisons never replace a successfully verified current edition.

The November 2 news inventory remains **nine source-reviewed reports** with evidence limitations, **zero new technology or terminology catalog records**, one pre-existing vLLM technology-profile update, and one new archive-UI site-change record. Seven technology/term proposals remain pending, and two source lookups failed; this is scheduled, non-exhaustive coverage, not an always-live news feed. The prepared **1,705 records**, **1,345 permanent term pages** and **31 expanded guides** remain intact.

The published revision 5 was validated in [87 catalog/JavaScript tests and exact GitHack HTTP checks](https://github.com/hazelfjeld/ai-atlas/actions/runs/41524665115) and [Cloudflare production asset, browser and navigation tests](https://github.com/hazelfjeld/ai-atlas/actions/runs/41524665102), completed **November 2, 2026 at 21:05:16 UTC** for [tested commit `fedeab90`](https://github.com/hazelfjeld/ai-atlas/commit/fedeab90c4d9edaba25d4dbcb85f0edbbf901310). Earlier revisions remain available by date and version. Historical paragraphs below document the rollout as it happened.

## Daily editions — What's New Today

**November 2 revision 4 (archive deployment verification pending):** [Read the nine reviewed stories and vLLM site update](https://aiupdates.app/whats-new.html?date=2026-11-02&revision=4). This revision preserves the existing nine news stories and adds a source-checked release-compatibility annotation to the already-listed vLLM technology profile; no new technology or term was added. Seven catalog proposals remain deferred. The previously verified [revision 3](https://aiupdates.app/whats-new.html?date=2026-11-02&revision=3) is still available. Four newly reviewed, carefully attributed Reuters reports cover South Korea’s proposed 2027 AI budget, an ADNOC/G42/OpenAI agreement, the ECB vice-president's AI valuation risk remarks and Oracle’s planned financing. These are **reported proposals, statements and plans**, not independently established outcomes. The earlier three first-party software release notes, publisher-run GDPx benchmark and WIRED investigation remain in the edition with their original caveats. **No new term, technology or confirmed incident record** was added; eight catalog proposals still need review, and two source lookups failed. Previous [revision 1](https://aiupdates.app/whats-new.html?date=2026-11-02&revision=1) and [revision 2](https://aiupdates.app/whats-new.html?date=2026-11-02&revision=2) remain immutable and selectable.

**Verification:** [main data and GitHack checks](https://github.com/hazelfjeld/ai-atlas/actions/runs/41511382421) passed with 81 JavaScript tests, and [Cloudflare production deployment](https://github.com/hazelfjeld/ai-atlas/actions/runs/41511382403) passed actual browser navigation plus 429 byte-checked assets across each of three production hostnames for [content commit `40c6a7b`](https://github.com/hazelfjeld/ai-atlas/commit/40c6a7bbba5f4016f2e230685c92261161f63088). The archive is editorially scheduled and non-exhaustive, not a real-time feed.


[Open the first reviewed November 2 edition](https://aiupdates.app/whats-new.html?date=2026-11-02&revision=1)

The homepage and navigation now feature the daily edition reader. Its five sections cover AI news, new technologies, new terms, updates in Atlas and corrections, with source links, category filters, explicit collection windows, a short TL;DR and immutable dated revisions. Publication checks require matching UTF-8 byte counts and SHA-256 digests. **The November 2 first partial edition is now live and independently verified** with three project-owned release-note reports (vLLM v0.33.0rc3, InvokeAI 6.14.3, and Windmill 1.856.0). Six news stories and eight technology/terminology proposals remain pending separate review; no new encyclopedia records or real-world incident findings are claimed; the site does not fabricate current news or claim a continuous website crawler. The separately scheduled research collector stages candidates, and the hourly publisher verifies and integrates accepted items. See `docs/DAILY_NEWS_PIPELINE.md` for schema and ownership.

[Open the verified Atlas workspace](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/index.html#/overview) · [Three-minute professor tour](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/demo.html) · [Practice Games tab](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/index.html#/games) · [Concept encyclopedia](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/terms/index.html)

The linked November 1 presentation release is pinned to a passing catalog and GitHack-byte verification. The three-minute walkthrough includes concept guides, comparison, the native Games tab, and a truthful daily-archive status. Older published checkpoints remain available in the Git history. The commit-pinned URLs keep the presentation recoverable. GitHack may show an “Open the page” confirmation before the app. The [moving main URL](https://raw.githack.com/hazelfjeld/ai-atlas/main/index.html) can cache older files.

## First verified daily edition — November 2, 2026

The first real, partially reviewed [What's New Today edition](https://aiupdates.app/whats-new.html?date=2026-11-02&revision=1) contains **three independently checked first-party release-note news cards**, with genuine source/date links and an accurate partial-coverage label. The vLLM tag is a release candidate. **Zero technologies, zero terms and zero incident reports were added**; six additional news candidates and five technology plus three term proposals are deferred pending separate source and catalog review. The original batch hash is `2dcb25af14b960f9989527170fd88daf8ba2fb5f42dcff3b72f512b08ddb57d7`; the processing receipt at `data/daily/published-batches.json` preserves all deferred IDs.

[First-edition merge 3f8aabb](https://github.com/hazelfjeld/ai-atlas/commit/3f8aabb6727ff70e7c13b4f7dc0b9dd60cf5ca28) passed [main GitHack/catalog verification](https://github.com/hazelfjeld/ai-atlas/actions/runs/41473186630). The initial production browser job hit a premature assertion while the archive was still loading; [fix 4b3695f](https://github.com/hazelfjeld/ai-atlas/commit/4b3695fae330a792664cf4039c342bd63ed76a80) reran and [passed actual production HTTP and browser checks](https://github.com/hazelfjeld/ai-atlas/actions/runs/41473870650), including all 427 non-term assets on three hostnames. The last successful verified publication was 2026-11-02T15:43:08Z. The immutable professor-demo URL remains unchanged. The site's update process is scheduled/static, not continuous news polling.

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

All **1,345 concepts have direct HTML pages** with original definitions, examples, caveats, sources, related concepts and backlinks. **31 expanded guides** add mechanisms, prerequisites, illustrative worked examples, equations and evaluation advice. The other 1,314 pages visibly identify their detailed expansion as pending. Generated pages work without JavaScript and do not require SPA fallback routing.

## Independent oversight and verifier guides — November 2, 2026

Two source-checked educational guides are published: [weak-to-strong generalization](terms/MLD-1323-weak-to-strong-generalization.html) and [verifier](terms/MLD-1308-verifier.html). The first distinguishes weak-supervisor performance from independently verified student success and gives a wholly synthetic 50% gap-recovery example. The second explains deterministic and learned verifiers, best-of-N selection bias, false positives, sandboxed checker audits, and reward-gaming hazards. The sources are original arXiv research from 2021–2026; no constructed example is represented as a new incident or model experiment. [PR #11](https://github.com/hazelfjeld/ai-atlas/pull/11) merged at [c65b99b](https://github.com/hazelfjeld/ai-atlas/commit/c65b99b84e58cbcdd5c6f416dfaeed42b1919326).

The prepared **1,705 original records** and 1,345 stable term routes remain intact. The guides total **31 expanded** and **1,314 reference-depth pages**. [Guide generation and original GitHack HTTP checks](https://github.com/hazelfjeld/ai-atlas/actions/runs/41454849913), [main catalog, 74 tests, reproducibility and GitHack](https://github.com/hazelfjeld/ai-atlas/actions/runs/41454988716), and the separate [main Cloudflare production deployment](https://github.com/hazelfjeld/ai-atlas/actions/runs/41454988740) document the check scopes. The daily staging index and main receipts were empty at intake; no edition or catalog entry has been fabricated. The known-good professor demo remains pinned at 839fee0.

## Expected calibration error and subgroup evaluation — November 2, 2026

Two more original, source-checked guides are now published: [Expected calibration error](terms/MLD-0389-expected-calibration-error.html) derives the top-label binned ECE formula and a fully synthetic 10-case result of 0.14 while warning about estimator and subgroup pitfalls; [Subgroup evaluation](terms/MLD-1184-subgroup-evaluation.html) works through a synthetic 85% pooled vs 40% worst-group example, uncertainty, intersections and a sealed-holdout audit. Both distinguish demonstrated research methods from hypothetical teaching data and real-world incidents. Seven primary research links and a new targeted regression test support the two additions.

[PR #10](https://github.com/hazelfjeld/ai-atlas/pull/10) merged as [325321e](https://github.com/hazelfjeld/ai-atlas/commit/325321e7723ddceec14c336f802524edaa2701f8). The [guide-build workflow](https://github.com/hazelfjeld/ai-atlas/actions/runs/41445890769) passed source generation and 18 exact GitHack HTTP file checks, including the two new routes. [Main publication checks](https://github.com/hazelfjeld/ai-atlas/actions/runs/41446223098) passed 73 automated tests, catalog integrity and GitHack comparison; the [production Cloudflare workflow](https://github.com/hazelfjeld/ai-atlas/actions/runs/41446222978) passed deployment and actual HTTP/browser checks. The baseline remains **1,705 records**, with **29 expanded guides**, 1,345 permanent concept pages and **1,316 awaiting expansion**. This increment did not publish news, new catalog entries or verified incidents. The daily staging queue and receipts were both empty at intake, so the archive retains its awaiting-first-edition message.

## Calibrated confidence and conformal uncertainty — November 2, 2026

Two new original, source-checked worked guides are published: [Calibration](terms/MLD-0142-calibration.html) explains reliability gaps, proper scores, ECE limitations and held-out logit temperature scaling; [Conformal prediction](terms/MLD-0198-conformal-prediction.html) derives finite-sample marginal coverage under exchangeability, calculates a nine-example residual quantile and identifies failures under distribution shift. The examples are synthetic teaching exercises, not measured deployments or new incidents. Seven primary research references support the paired guides.

[PR #9](https://github.com/hazelfjeld/ai-atlas/pull/9) merged to main as [98410e6](https://github.com/hazelfjeld/ai-atlas/commit/98410e651e67004125f94c175a14c484a69a2cd8). [Feature-branch verification](https://github.com/hazelfjeld/ai-atlas/actions/runs/41436980119) passed **72 JavaScript tests**, data/link validation, deterministic generation and **16 exact public GitHack byte checks** including both new term pages. [PR Cloudflare validation](https://github.com/hazelfjeld/ai-atlas/actions/runs/41437026107) passed local HTTP and browser tests; production deployment of main must be checked separately before claiming a new live-hosted release. The original catalog remains 1,705 records, 1,345 permanent term pages, **27 expanded guides** and **1,318 awaiting expansion**. Daily-news queue and public receipts were both empty when checked; no genuine daily edition is claimed. The pinned three-minute professor demonstration at `839fee0` is unchanged.

## Evaluation integrity guides — November 2, 2026

Two additional source-checked, substantively expanded guides are public: [distribution shift](terms/MLD-0326-distribution-shift.html) distinguishes covariate, label and concept shifts and includes a reproducible synthetic domain audit; [train-test contamination](terms/MLD-1254-train-test-contamination.html) distinguishes demonstrated data overlap from behavioral hints of memorization, with a sealed-holdout protocol. Eight scholarly references were checked against primary publisher or arXiv pages. All numerical worked examples are explicitly illustrative, not new experiments or real-world incidents.

[PR #8](https://github.com/hazelfjeld/ai-atlas/pull/8) merged to main in [2ffc71d](https://github.com/hazelfjeld/ai-atlas/commit/2ffc71d28f9b77e22d5d868ffe0d834470bbd513). [Catalog and GitHack checks](https://github.com/hazelfjeld/ai-atlas/actions/runs/41429522185) passed 71 automated tests, 29,973 internal links and byte checks including both new direct term pages; [Cloudflare deployment and production browser checks](https://github.com/hazelfjeld/ai-atlas/actions/runs/41429522170) also passed. The verified snapshot contains 25 substantive guides, leaving 1,320 original term pages at reference depth. The original 1,705 catalog records, dated-news awaiting state and pinned professor demo were preserved.

## Agent reliability and capability diagnosis — November 2, 2026

Two new source-reviewed tutorials cover [agent evaluation](terms/MLD-0041-agent-evaluation.html), with executable end-state checks, trajectory-level policy/side-effect scoring and repeat-trial reliability, and [capability failure](terms/MLD-0146-capability-failure.html), with controlled interventions distinguishing lack of task skill from possible proxy-goal behavior. Both use entirely synthetic experiments, explicitly avoid diagnosing hidden objectives from outputs alone and cite four primary papers each. The generator now derives encyclopedia's latest reviewed date from authored guide metadata rather than a stale constant.

This increases substantive guides to **23 of 1,345** (1,322 reference-only); the 1,705-record prepared catalog and permanent term URLs remain unchanged. The feature release passed 64 automated tests, 29,963 internal-link checks, deterministic builds and exact GitHack bytes for 14 assets including both new guides. [Build verification](https://github.com/hazelfjeld/ai-atlas/actions/runs/41407567325) checks published static content, not live-browser behavior. The daily staging queue and public receipt ledger remained empty at the start of this increment; no news edition or real-world incident was invented.

## Mechanistic interpretability and red teaming — November 2, 2026

Two more sourced worked guides are available: [mechanistic interpretability](terms/MLD-0718-mechanistic-interpretability.html) explains residual-stream circuits, controlled activation patching, failure checks and feature dictionaries; [red teaming](terms/MLD-1002-red-teaming.html) covers authorized threat models, safe toy-system exercises, independent scoring and mitigation regression tests. Both distinguish controlled studies from evidence of deployed incidents, with three primary references each. The baseline catalog is still 1,705 records and now **21 of 1,345** term pages are expanded; **1,324** remain at reference depth.

Source [PR #6](https://github.com/hazelfjeld/ai-atlas/pull/6) and [production verification](https://github.com/hazelfjeld/ai-atlas/actions/runs/41401120710) passed. The separate daily-news queue remains empty as checked at the beginning of this increment; no dated edition or external safety alert was fabricated.

## Safety monitoring guides — November 1, 2026

Three further source-reviewed tutorials now cover [deceptive alignment](terms/MLD-0280-deceptive-alignment.html), [shutdown avoidance](terms/MLD-1119-shutdown-avoidance.html), and [activation-based monitoring](terms/MLD-0017-activation-based-monitoring.html). Each distinguishes hypotheses, constructed evaluations and documented observations, provides a reproducible sandbox-style investigation, and cites primary research. Publication was tested with 57 JavaScript checks, 18,321 internal links and exact GitHack byte checks on all three term pages; see [PR #5](https://github.com/hazelfjeld/ai-atlas/pull/5). The original professor tour and dated news awaiting-state remain intact.

## AI safety depth update — November 1, 2026

Four existing dictionary topics now have complete, original worked guides with independently checked primary sources: [specification gaming](terms/MLD-1149-specification-gaming.html), [reward hacking](terms/MLD-1039-reward-hacking.html), [Goodhart's law](terms/MLD-0470-goodhart-s-law.html), and [goal misgeneralization](terms/MLD-0469-goal-misgeneralization.html). The edition at commit [2871660](https://github.com/hazelfjeld/ai-atlas/commit/2871660bf7d5e1ad8c0a3fb18756843a9a03c516) passed 56 JavaScript tests, all 1,345 page checks, 18,309 internal-link checks and GitHack byte verification. This is a catalog/educational enhancement, **not a newly discovered 2026 safety incident**. The prepared catalog remains at 1,705 records; expanded guides increased from 12 to 16.

## Presentation fallback

[Download the searchable single-file fallback](https://rawcdn.githack.com/hazelfjeld/ai-atlas/839fee0b0e4f6b16d933dd5e5eac55e3a3e847c6/downloads/Atlas_Demo_Offline.html), then keep it on the presentation device. It embeds all 1,705 records, styles, application code, Quiz and Match; original downloads, external sources, expanded web pages and the separately published daily archive require the served edition. Direct file-protocol browser testing was blocked by the automation browser's URL policy; inline syntax, embedded record equality and absence of external runtime assets are tested. The printable tour and static concept pages provide additional fallbacks.

## Verification and limitations

Run `python scripts/validate_checkpoint.py` and `node --test tests/*.test.cjs`. The validator checks SHA-256 and byte/record counts for all 45 chunks, source/download hashes, cross-catalog relationships, SQLite integrity, every generated page hash and internal HTML links. Runtime loaders reject incomplete or mixed catalogs, limit parallel requests and retry transient failures. `.gitattributes` preserves exact LF bytes on Windows.

Public HTTP equality and real browser interaction are separate checks. Detailed evidence is in `release/http-verification.json`, `release/browser-verification.json` and `docs/DEMO_CHECKPOINT.md`. CI validates catalogs, helpers, integrity failures, stable term routes and reproducible generated outputs, then checks the public GitHack assets.

This is a curated snapshot, **not a live feed or exhaustive research/incident inventory**. No website-side live crawler is active; the separate scheduled daily collector has not yet supplied a published edition. Imported review labels are not a new source audit or independent replication. The 29 expanded explanations are editorial syntheses with primary citations, not independently reviewed textbooks. External citation destinations have not all been re-audited. Tool comparisons are editorial rather than measured rankings.

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
