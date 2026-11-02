# AI Updates brand and discovery publication

The public brand is **AI Updates**, at `https://aiupdates.app`. Atlas remains the historical catalog/repository name; original record IDs, data, downloaded filenames, notebook storage keys and existing hash routes stay stable. Never rename the preserved source records to make the branding appear consistent.

The visual palette is deep evergreen `#18211E`, green `#27664E`, warm paper `#F6F6F2`, copper `#B76D32`, and white. `brand.css` applies it across the workspace and reference pages. The Discover layout uses original SVG illustrations, a featured explainer, topic filters, an editorial collection and the daily-edition sidebar. Featured educational guides are visibly evergreen. They must not be labeled breaking news or assigned fabricated publication times.

## Generated publication

Run these after completed source/catalog updates, in order:

```sh
python scripts/install_games_workspace.py
python scripts/build_term_pages.py
python scripts/build_seo.py
python scripts/build_offline.py
python scripts/validate_checkpoint.py
node --test tests/*.test.cjs
python -m unittest discover -s tests -p 'test_seo*.py'
```

`discovery.js` renders the same collection both into the initial homepage HTML and into the interactive workspace. `scripts/render_discovery.cjs` reads the completed catalog; it does not collect or write records. A publication change must preserve the `discovery:start`/`discovery:end` markers and rebuild the initial HTML. Do not leave the homepage as an empty JavaScript shell.

`scripts/site_seo.py` supplies the canonical domain, escaped metadata, social tags and structured data. `build_term_pages.py` preserves the original term content and adds unique metadata plus matching DefinedTerm/BreadcrumbList data. `build_seo.py` generates 300 direct technology profiles, their A–Z directory, About/editorial policy, root-page metadata, `robots.txt` and the XML sitemap. These profiles preserve the original claims, caveats, tests and source links; they do not imply a new source audit. Slugs follow a stable ID plus name. Keep earlier direct URLs working if a catalog name changes.

Hash routes such as `index.html#/overview`, `#/games` and technology detail dialogs remain supported. Crawlable term/profile URLs are the indexable content; hash states, searches, comparisons and private notebooks are application states rather than separate sitemap pages. All public canonical URLs use the apex domain, including on www, workers.dev and GitHack fallbacks. The downloadable offline edition is marked `noindex,follow`.

The committed `social-card.png` is an original 1200 × 630 brand graphic, alongside `favicon.svg`. No third-party tracking, external fonts, paid image service or external runtime image host is required. Keep all new public assets in the deployment allowlist. Cloudflare still uses the same single tested-revision pipeline and dashboard-managed domains.

## Checks and limitations

The SEO tests parse the actual generated pages, check their unique titles, descriptions, canonical URLs, real sitemap destinations and matching semantic definitions, and compare technology claims and citations with the original catalog. Browser checks cover initial HTML without JavaScript, topic filtering/reload, direct profiles, the requested palette, dark theme and mobile navigation. Existing game, download, search and integrity suites remain required. Production HTTP checks also compare the SEO files and profile bytes with the tested artifact.

This establishes technical crawlability and metadata, not search ranking or proof of indexing. Search Console verification and sitemap submission require the owner's Google account and are not silently configured. Rich-result appearance is decided by search engines. The daily archive is still pending its first reviewed edition; the rebrand does not activate a competing news writer. As new real editions arrive, date-specific crawlable editorial pages can be added without inventing article metadata for unpublished news.

References: [Google JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies).
