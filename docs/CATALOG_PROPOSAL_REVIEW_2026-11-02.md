# Deferred Atlas catalog proposals — first-party evidence pass, November 2, 2026

**Status and provenance.** This is an editorial review checkpoint, not a published technology catalog or a new-world-event announcement. The staged queue remains `atlas-daily-20261102-first-0850ct-a`, source SHA-256 `2dcb25af14b960f9989527170fd88daf8ba2fb5f42dcff3b72f512b08ddb57d7`, branch `atlas-daily-staging`, source commit `da93e2fd5545cabc0b001310eab55bf8eeea9da8`. Publication receipts still list **seven deferred catalog proposal IDs**. The prepared baseline contains 300 technology profiles and 1,345 terms; no fresh ID is assigned until a validated search, profile/detail-page, relationship, manifest and offline/backlink integration is actually served. Sources below were inspected on November 2, 2026, but product assertions have not been independently reproduced.

## Primary-source reviews completed, catalog integration deferred

### `tech-proposal:invokeai:2026-11-02` — InvokeAI

- **Primary evidence:** https://github.com/invoke-ai/InvokeAI/releases/tag/v6.14.3 and https://github.com/invoke-ai/InvokeAI
- **Verified source claim:** version 6.14.3 release notes (November 1) describe editable Canvas vector shapes/splines, rasterization into image-to-image editing, and a fix for resuming interrupted model downloads.
- **Correction/caveat:** do not equate vector-layer support with measured improvement in image fidelity. The source repository lists several license categories, and model-specific licenses, hardware compatibility and commercial entitlements require individual review. Software existed before this release, so a future Atlas import would be **new to Atlas**, not an invented November 2 technology.
- **Decision:** first-party features reviewed; **defer canonical import** until a stable ID, searchable canonical catalog record, genuine detail route and license/availability caveats are published.

### `tech-proposal:windmill:2026-11-02` — Windmill

- **Primary evidence:** https://github.com/windmill-labs/windmill/releases/tag/v1.856.0 and https://github.com/windmill-labs/windmill
- **Verified source claim:** November 2 release notes describe accepting MCP access tokens issued by external OIDC providers. This is feature availability, **not** proof of any particular organization's secure configuration.
- **Correction/caveat:** the project's repository distinguishes its community edition from proprietary/non-public features and applies distribution restrictions; avoid blanket claims that every component or managed edition is free or wholly open-source. Do not repeat publisher performance benchmarks as independently validated.
- **Decision:** release-note claim reviewed; **defer canonical import** until licensing, runtime constraints, cross-links and searchable catalog integration are verified.

### `tech-proposal:nvidia-auto-ontology:2026-11-02` — NVIDIA Auto Ontology

- **Primary evidence:** https://github.com/NVIDIA/auto-ontology (README, deployment and license sections).
- **Verified source claim:** the repository describes a semantic/ontology catalog for natural-language structured-data queries; architecture includes FastAPI Python 3.12+, PostgreSQL/pgvector, a frontend, and configured NVIDIA NIM model endpoints. The project states Apache-2.0 for NVIDIA-authored code, with separate third-party terms.
- **Correction/caveat:** the proposal has **no independently established initial release date**; classify a future profile only as new to Atlas. It needs a configured NVIDIA API key/endpoint; source availability does not imply free hosted compute, successful evaluation or correctness of arbitrary generated SQL. The documentation flags an internal FastAPI trust boundary; do not advertise direct backend exposure as secure.
- **Decision:** primary README and license examined; **defer canonical import** until relationship IDs, official page, verified source date/availability and cost/authorization caveats are integrated.

## Still awaiting independent catalog evaluation

- `tech-proposal:gdpx:2026-11-02`: publisher-run GDPx benchmark claims are already qualified in the daily news. Public task/harness reproducibility, reuse/license conditions and independent result confirmation remain unverified; do not present a 12% publisher score as replicated evidence.
- `term-proposal:agent-harness`: compare with existing `MLD-0041` Agent evaluation and `MLD-0043` Agentic workflow, then check authoritative definitions and source dates before a separate term ID.
- `term-proposal:semantic-ontology-layer`: compare overlaps with `MLD-0608` Knowledge graph, `MLD-1104` Semantic search and `MLD-1033` Retrieval-augmented generation. A product README alone is insufficient to establish universal terminology.
- `term-proposal:environment-grounded-agent-benchmark`: compare with existing `MLD-0110` Benchmark, `MLD-0041` Agent evaluation and `MLD-0371` Environment; verify evaluation methodology against independent primary research.

**Next action:** Resolve duplicates/alias versus genuinely new entries; publish any accepted candidate in the actual catalogs, stable routes, search, links and checksummed manifests. Only then update the immutable dated edition and receipts with actual catalog outcomes. Do not count this review log as three new technology releases or three catalog additions.

## November 2 — concepts expanded without minting speculative synonyms

Two **existing** dictionary IDs now carry complete original worked guides: `MLD-0043` (Agentic workflow, including the surrounding agent harness) and `MLD-0608` (Knowledge graph, including enterprise semantic/ontology layers). These explain mechanisms, boundaries, worked applications, quantitative/evidence checks, permissions and primary sources. A harness is not necessarily a new algorithm, and “semantic ontology layer” is descriptive, not a separately established standard. Their pending term proposal IDs stay **deferred**, not accepted or rejected, until the distinctness and canonical terminology review is complete; no new term or world event is asserted. Published baseline record totals remain unchanged. Editorial review: November 2, 2026.
