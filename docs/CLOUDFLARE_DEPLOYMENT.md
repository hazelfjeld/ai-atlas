# Cloudflare Workers Static Assets

Atlas is deployed as the original static site, with no framework rewrite or new runtime service. The production target is `https://ai-atlas.airheadhazelnut.workers.dev`. Do not treat this target as verified until the production job and its HTTP/browser checks pass.

## Public package

`python scripts/build_cloudflare.py` validates the catalogs and creates `dist/cloudflare/`. It preserves the exact source bytes of the public interface, Games/Quiz/Match, daily reader, referenced catalog batches and source registers, all manifest-listed term pages, published daily editions, and intended downloads. Root website assets are explicitly listed in `deploy/public-files.json`. New root HTML/CSS/JS requires an allowlist update; unfinished batches and collector staging files are excluded.

The repository, `.github`, scripts, tests, documentation, release evidence, dependency files, credentials and `daily-queue` are never copied. `deployment.json` identifies the source commit, hashes and byte counts of the packaged public files. The build rejects symlinks, path traversal, missing content and assets exceeding Workers Free limits (20,000 files, 25 MiB each).

`wrangler.json` has only static assets: no Worker handler, scheduled trigger, database, bucket, custom domain or DNS route. HTML handling is disabled to retain literal `.html` term/download URLs. `_redirects` internally serves `/index.html` at `/`; unknown paths stay 404 instead of being disguised as the homepage. Hash routes including `#/overview` and `#/games` stay entirely in the original client.

## One production deployment workflow

`.github/workflows/deploy-cloudflare.yml` is the only automated Cloudflare production path. Do not also connect Cloudflare Builds/Git integration or add another scheduled deployer.

The validation job runs all Node tests, packaging-boundary tests, catalog/daily validation, syntax checks, the existing generated-output checks, Wrangler dry-run, actual local Workers asset HTTP checks, the existing native and standalone game browser suites, and the site navigation/download suite. It uploads exactly the tested output directory. Production downloads that artifact, checks out the same full SHA, and verifies that it is still `main` before deploying. A fixed production concurrency group serializes uploads; stale queued runs skip deployment. Branches and PRs test without Cloudflare secrets and cannot publish.

Normal completed updates trigger this workflow on push to `main`. Successful completion of the retained legacy package importers also triggers the same workflow, because their `GITHUB_TOKEN` pushes cannot start a push workflow. That completion path tests the resulting main revision afresh. Existing daily research/staging and hourly publication processes retain their ownership, schedules and branches. They still write GitHub; this workflow only reads and deploys tested content.

No deploy step modifies GitHub or disables a check. Incomplete source/generated uploads fail validation or remain outside the referenced allowlist. A failed verification is a failed workflow, not a claimed successful release.

## Authorization

GitHub Actions repository secrets hold `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The account-owned token is scoped to this account with only Workers Scripts Write/Edit; no zone, DNS, billing, KV, R2 or database permission is requested. The secret is exposed only to the Wrangler production step. GitHub workflow permissions are `contents: read`; checkout credentials are not persisted.

The initial token was prepared with a 90-day expiration. Rotate it in Cloudflare and replace the GitHub secret before expiration. Never paste the value into chat, commit it, place it in an artifact, or put it in the public package. Local Wrangler login is unnecessary for this CI deployment path. Missing/expired credentials stop deployment with a visible error.

## Coherence and verification

Workers publishes its asset set atomically. All mutable URLs use `Cache-Control: public, max-age=0, must-revalidate`, ETags and an `X-Atlas-Revision` header. No service worker or long-lived immutable caching is added to unversioned files. The original SHA-256 catalog loader remains intact and rejects a partial/mixed load rather than rendering it as complete. An already-open page spanning a release may need its existing Retry/reload control.

After deployment, `scripts/verify_cloudflare.py` checks the actual public deployment manifest, all runtime/catalog/support/download files, all expanded term guides and two reference pages against the tested artifact. It verifies root rewriting, literal term URLs, caching, conditional ETag 304s and 404s for excluded/private paths. Browser suites then exercise dictionary search, technology profiles, term links, Quiz, Match, daily archive state, workbook downloading and mobile navigation against the workers.dev URL. Reports and screenshots are retained as GitHub Actions artifacts for seven days.

The daily archive can legitimately be empty until the separate editorial process publishes a reviewed edition. Hosting does not activate a news collector or fabricate a first edition. Imported source-review limitations remain unchanged.

## Rollback

1. Restore the last known-good website changes on `main` with a new revert commit. Keep the deployment configuration/workflow in place.
2. Push that new commit. The same validation and deployment pipeline tests it and deploys its exact revision. Do not rerun an old deployment: the stale-revision guard deliberately rejects it.
3. For an urgent rollback, Cloudflare Workers → `ai-atlas` → Deployments can roll back to the preceding successful version, including its assets. Follow that with the corresponding Git revert so future automated publication agrees with the restored site. The first deployment has no older Cloudflare version to roll back to.

The existing commit-pinned GitHack links continue serving their original versions and remain the immediate fallback. Repository access, billing, DNS, `aiupdates.app`, and existing development/research schedules are outside this deployment change.

## Local verification

```sh
npm ci --ignore-scripts --no-audit --no-fund
node --test tests/*.test.cjs
python -m unittest discover -s tests -p 'test_cloudflare*.py'
python scripts/build_cloudflare.py
npm run preview:cloudflare
```

In another terminal, run `python scripts/verify_cloudflare.py --base http://127.0.0.1:8787/ --revision <full-checked-out-SHA>`. Browser regression commands are listed verbatim in the deployment workflow. There is no npm production-deploy shortcut or second automated publishing path.

Official references: [Static Assets](https://developers.cloudflare.com/workers/static-assets/), [caching headers](https://developers.cloudflare.com/workers/static-assets/headers/), [asset routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/), [GitHub Actions authentication](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/), [Free limits](https://developers.cloudflare.com/workers/platform/limits/).
