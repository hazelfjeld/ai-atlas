'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');

test('Playbooks, Technology, Research and editorial reviews reuse Discover card type', () => {
  const block = css.split('/* atlas-editorial-card-copy:begin */')[1]
    ?.split('/* atlas-editorial-card-copy:end */')[0];
  assert.ok(block, 'Missing shared card typography implementation');
  for (const selector of [
    '.playbook-shell .playbook > h2',
    '.tech-shell .tech-card > h3',
    '.shell:has(> .site-chrome.nav) article.card > h3',
    '.shell:has(> main > .site-chrome.research-site-chrome) .cards > .card > h3'
  ]) assert.ok(block.includes(selector), 'Missing card family: ' + selector);
  assert.match(block, /font:400 clamp\(20px,2vw,23px\)\/1\.25 Georgia/);
  assert.match(block, /color:var\(--ink\)/);
  assert.match(block, /\.playbook-shell \.playbook > p,[\s\S]*?color:var\(--muted\)/);
  assert.ok(!block.includes('display:none'), 'Do not hide page navigation or cards');
});

test('shared editorial cards match Discover hover and expose keyboard focus in either theme', () => {
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  const block = css.split('/* atlas-card-interactions:begin */')[1]
    ?.split('/* atlas-card-interactions:end */')[0];
  assert.ok(block, 'Missing single shared card interaction rule');
  assert.ok(brand.includes('.discovery-card:hover{border-color:#9AAD9C}'));
  for (const selector of [
    '.playbook-shell .playbook',
    '.tech-shell .tech-card',
    '.shell:has(> .site-chrome.nav) article.card',
    '.shell:has(> main > .site-chrome.research-site-chrome) .cards > .card'
  ]) assert.ok(block.includes(selector), 'Missing card family: ' + selector);
  assert.ok(block.includes(':is(:hover,:focus-within)'));
  assert.ok(block.includes(':root[data-theme="dark"]') && block.includes('prefers-color-scheme:dark'));
  assert.ok(!block.includes('pointer-events:none') && !block.includes('display:none'));
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline demo must embed the exact updated CSS');
});

test('generated concept and technology article headlines reuse Discover typography in both themes and mobile widths', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  const block = css.split('/* atlas-shared-headlines:begin */')[1]
    ?.split('/* atlas-shared-headlines:end */')[0];
  assert.ok(block, 'Missing shared reference-heading source');
  assert.ok(brand.includes('.discover-heading h1{font:400 clamp(40px,4.2vw,56px)/1.08 Georgia'), 'Discover desktop heading token changed');
  assert.ok(block.includes('font:400 clamp(40px,4.2vw,56px)/1.08 Georgia'), 'Reference desktop title must match Discover');
  assert.ok(block.includes('@media(max-width:650px)') && block.includes('h1{font-size:43px}'),
    'Reference mobile title must match Discover, including 320px');
  assert.ok(block.includes(':not(:has(.discover-heading))'), 'Do not override existing directory landing headings');
  assert.ok(!block.includes('display:none'), 'Do not conceal native article headings');
  for (const route of ['terms/MLD-0001-a-b-test.html', 'technology/TECH-0288-vllm.html']) {
    const html=fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /<header class="hero"[^>]*><p class="eyebrow">/);
    assert.ok(html.includes('<h1>') && html.includes('</h1>'), route + ' keeps a semantic article title');
    assert.match(html, /<a class="skip" href="#main">/, route + ' retains native skip');
  }
  const offline=fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline fallback must embed the exact shared CSS');
});

test('native mobile header shares Discover height across directories, news, editorials and Games', () => {
  const block = css.split('/* atlas-mobile-chrome-rhythm:begin */')[1]
    ?.split('/* atlas-mobile-chrome-rhythm:end */')[0];
  assert.ok(block, 'Shared native mobile header rhythm missing');
  assert.match(block, /@media\(max-width:650px\)/);
  assert.ok(block.includes('.site-mobile-chrome:not(.discover-mobile-chrome)'));
  assert.ok(block.includes('padding-block:12px!important'));
  assert.ok(block.includes('min-height:68px'));
  assert.ok(block.includes('.games-header .site-mobile-chrome') && block.includes('padding-block:0!important'),
    'Do not duplicate Games containing-header padding');
  for (const route of ['terms/index.html','technology/index.html','whats-new.html',
                       'research.html','playbooks.html','games.html','about.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /class="[^"]*site-mobile-chrome/);
  }
  const offline = fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css),'Offline workspace must carry exact shared styling');
});

test('Discover first paint keeps its useful content stable without perpetual loading', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const theme = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const block = css.split('/* atlas-discover-first-paint:begin */')[1]
    ?.split('/* atlas-discover-first-paint:end */')[0];
  assert.ok(block, 'Missing shared first-paint correction');
  assert.match(home, /id="catalog-loading" class="catalog-loading" role="status"/,
    'Preserve the hydration sentinel for readiness tests and assistive technology');
  assert.match(home, /<div id="page"><!-- discovery:start -->/,
    'Preserve the server-rendered Discover preview');
  assert.ok(css.includes('.shell:has(> .site-chrome.top){padding-top:0!important}'),
    'Archive and Discover should share the same first-content workspace frame');
  assert.ok(block.includes('#catalog-loading{display:none}'),
    'Without JavaScript, never present a perpetual loading notice');
  assert.ok(block.includes('html.atlas-enhanced #catalog-loading') &&
    block.includes('position:absolute') && block.includes('clip-path:inset(50%)'),
    'Scripted status must announce loading without moving the article');
  assert.ok(theme.includes("classList?.add('atlas-enhanced')"),
    'Only enhanced pages announce pending catalog loading');
  assert.ok(app.includes("document.getElementById('catalog-loading').remove()"),
    'Remove the status when catalog hydration succeeds');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline demo must embed the exact shared stylesheet');
});

test('theme preference stays synchronized across open editorial and reference tabs', () => {
  const theme = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  assert.ok(theme.includes("window.addEventListener('storage', (event) =>"));
  assert.ok(theme.includes("event.key === 'atlas.theme'"));
  assert.ok(theme.includes('syncSharedStoredTheme(event.newValue)'));
  assert.ok(theme.includes('syncSharedStoredTheme(savedTheme)'),
    'BFCache restoration and cross-tab updates must reuse the same theme state');
  assert.ok(theme.includes("button.setAttribute('aria-pressed'"),
    'Cross-tab updates must synchronize the visible theme controls');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes("window.addEventListener('storage', (event) =>"),
    'The offline fallback must embed the current shared theme script');
});


test('mobile news intro uses the same editorial content-start rhythm as directory landings',()=>{
  const block=css.split('/* atlas-mobile-news-intro-rhythm:begin */')[1]
    ?.split('/* atlas-mobile-news-intro-rhythm:end */')[0];
  assert.ok(block,'Shared news landing intro rhythm missing');
  assert.match(block,/@media \(max-width:650px\)/);
  assert.match(block,/\.shell:has\(> \.site-chrome\.top\) > main > header\{padding-top:8px\}/);
  const archive=fs.readFileSync(path.join(__dirname,'..','whats-new.html'),'utf8');
  const terms=fs.readFileSync(path.join(__dirname,'..','terms/index.html'),'utf8');
  const playbooks=fs.readFileSync(path.join(__dirname,'..','playbooks.html'),'utf8');
  assert.match(archive,/<nav class="site-chrome top"/);
  assert.match(archive,/<main>\s*<header id="main" tabindex="-1">/);
  assert.match(terms,/<header class="hero" id="main" tabindex="-1">/);
  assert.match(playbooks,/<section class="playbook-hero"/);
  assert.ok(!block.includes('display:none')&&!block.includes('pointer-events:none'));
  const offline=fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css),'Offline snapshot must embed the exact shared chrome CSS');
});

test('script-free daily archive and catalog review skip links focus the editorial heading, not the main wrapper', () => {
  for (const route of ['whats-new.html', 'catalog-review.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.match(html, /<a class="skip" href="#main">/);
    assert.match(html, /<main>\s*<header id="main" tabindex="-1">/);
    assert.doesNotMatch(html, /<main id="main"/);
    assert.equal((html.match(/id="main"/g) || []).length, 1, route + ' has one skip target');
    assert.match(html, /<header id="main" tabindex="-1">[\s\S]*?<h1[\s>]/);
  }
});


test('all concept pages use the technology-profile native article skip, without duplicating navigation', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'terms/manifest.json'), 'utf8'));
  const publication = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'publication.json'), 'utf8'));
  const entries = Object.values(manifest);
  assert.equal(Object.keys(manifest).length, publication.published_counts.terms);
  assert.equal(entries.filter(entry => entry.expanded).length, publication.encyclopedia.detailed_page_count);
  for (const entry of entries) {
    const html = fs.readFileSync(path.join(__dirname, '..', entry.path), 'utf8');
    assert.match(html, /<a class="skip" href="#main">/, entry.path);
    assert.match(html, /<main class="term-shell">/, entry.path);
    assert.doesNotMatch(html, /<main class="term-shell" id="main"/, entry.path);
    assert.match(html, /<header class="hero" id="main" tabindex="-1"><p class="eyebrow">/, entry.path);
    assert.equal((html.match(/id="main"/g) || []).length, 1, entry.path);
    assert.ok(html.indexOf('<nav class="site-chrome term-nav"') <
              html.indexOf('<header class="hero" id="main" tabindex="-1">'), entry.path);
    assert.equal((html.match(/aria-label="AI Updates primary navigation"/g) || []).length, 1,
                 entry.path + ' must not duplicate desktop navigation');
  }
});


test('Discover and Games primary appearance controls share pressed state with editorial theme buttons', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const games = fs.readFileSync(path.join(__dirname, '..', 'games.html'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.match(home, /id="theme-toggle"/);
  assert.match(games, /id="theme-toggle"[^>]*aria-pressed="false"/);
  assert.ok(script.includes("document.getElementById?.('theme-toggle')?.setAttribute('aria-pressed'"));
  assert.ok(script.includes('syncPrimaryThemeButton(theme);'));
  assert.ok(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').includes("if(typeof syncSharedStoredTheme==='function')syncSharedStoredTheme(theme)"),
    'Discover invokes the shared theme synchronizer after its own click handler changes the theme');
  assert.ok(script.includes('queueMicrotask(syncThemeButtons)'),
    'Shared controls must read final state after the existing app click handler');
  assert.ok(offline.includes(script), 'The offline workspace must embed the exact current shared theme behavior');
});


test('shared editorial card links, disclosures and descriptions follow Discover in both color schemes', () => {
  const block = css.split('/* atlas-card-copy-contrast:begin */')[1]
    ?.split('/* atlas-card-copy-contrast:end */')[0];
  assert.ok(block, 'Shared editorial contrast block missing');
  for (const selector of [
    '.playbook-shell .playbook a',
    '.playbook-shell .playbook summary',
    '.playbook-shell .playbook p',
    '.tech-shell .tech-card .card-actions a',
    '.tech-shell .tech-card details > summary',
    '.tech-shell .tech-card dd',
    '.shell:has(> main > .site-chrome.research-site-chrome) .cards .card a',
    '.shell:has(> main > .site-chrome.research-site-chrome) .cards .card p'
  ]) assert.ok(block.includes(selector), 'Uncovered card copy: ' + selector);
  assert.match(block, /color:var\(--accent,#27664e\)/);
  assert.match(block, /color:var\(--muted,#5d6861\)/);
  const brand = fs.readFileSync(path.join(__dirname, '..', 'brand.css'), 'utf8');
  assert.match(brand, /--accent:#B1D5BD/, 'Dark mode needs a legible interactive foreground');
  assert.match(brand, /--muted:#AFBEB2/, 'Dark mode needs a legible body foreground');
  assert.match(brand, /--accent:#27664E/, 'Light mode must retain its original foreground');
  for (const page of ['playbooks.html', 'technologies.html', 'research.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /href="site-chrome\.css"/, page + ' must share live contrast tokens');
    assert.match(html, /site-chrome/, page + ' must keep the canonical navigation');
  }
  assert.ok(!block.includes('display:none') && !block.includes('pointer-events:none'),
    'Contrast fixes must not hide cards or disable links');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline fallback must embed the same shared CSS');
});


test('Research, Playbooks, news, editorial reviews and reference directories reuse one evidence callout', () => {
  const block = css.split('/* atlas-shared-evidence-callouts:begin */')[1]
    ?.split('/* atlas-shared-evidence-callouts:end */')[0];
  assert.ok(block, 'Missing shared evidence callout component');
  for (const sel of ['.shell .notice', '.tech-shell .tech-warning', '.playbook-shell .playbook-note',
    '.review-shell .review-callout', '.term-shell .notice']) {
    assert.ok(block.includes(sel), 'Missing callout family: ' + sel);
  }
  for (const property of ['background:var(--accent-soft', 'border:1px solid var(--line',
    'border-left:4px solid var(--accent', 'color:var(--ink',
    'a:focus-visible', 'white-space:normal', '@media (max-width:650px)']) {
    assert.ok(block.includes(property), 'Missing shared surface/accessibility treatment: ' + property);
  }
  assert.ok(!block.includes('display:none') && !block.includes('pointer-events:none'),
    'All evidence notes and links must remain usable');
  const pages = {
    'research.html': 'class="notice"',
    'playbooks.html': 'class="playbook-note"',
    'technologies.html': 'class="tech-warning"',
    'hardware-review.html': 'class="review-callout"',
    'catalog-review.html': 'class="notice"',
    'whats-new.html': 'class="notice"',
    'technology/index.html': 'class="notice"'
  };
  for (const [route, marker] of Object.entries(pages)) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    assert.ok(html.includes(marker), route + ' retains real evidence copy');
    assert.ok(html.includes('href="site-chrome.css"') || html.includes('href="../site-chrome.css"'),
      route + ' loads the shared callout');
    assert.ok(/<a href=/.test(html), route + ' retains source navigation');
  }
  const brand=fs.readFileSync(path.join(__dirname,'..','brand.css'),'utf8');
  assert.ok(brand.includes(':root[data-theme=dark]') && brand.includes('--accent:#B1D5BD'),
    'Shared callouts inherit the readable dark-theme accent');
  const offline=fs.readFileSync(path.join(__dirname,'..','downloads/Atlas_Demo_Offline.html'),'utf8');
  assert.ok(offline.includes(css), 'Offline fallback must embed the exact shared stylesheet');
});

test('Discover and all standalone families share footer flow while preserving evidence and Games content', () => {
  const block = css.split('/* atlas-shared-footer-layout:begin */')[1]
    ?.split('/* atlas-shared-footer-layout:end */')[0];
  assert.ok(block, 'Missing shared footer layout');
  for (const rule of ['@media (min-width:851px)', 'display:flex', 'flex-wrap:wrap',
    'justify-content:space-between', 'gap:8px 20px', 'footer > p',
    'flex:1 1 100%', '@media (max-width:850px)', 'display:block'])
    assert.ok(block.includes(rule), 'Shared footer is missing ' + rule);
  assert.ok(!block.includes('display:none') && !block.includes('pointer-events:none'));
  const appCss = fs.readFileSync(path.join(__dirname, '..', 'app.css'), 'utf8');
  assert.match(appCss, /\.main-footer\{[^}]*display:flex;justify-content:space-between/);
  for (const page of ['whats-new.html', 'research.html', 'about.html',
    'technologies.html', 'playbooks.html', 'games.html', 'catalog-review.html',
    'hardware-review.html', 'terms/index.html', 'technology/index.html',
    'terms/MLD-0001-a-b-test.html', 'technology/TECH-0288-vllm.html']) {
    const html=fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /<footer\b[^>]*>[\s\S]*?<\/footer>/, page + ' must keep its native footer');
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1] || '';
    assert.match(footer, /<a\b[^>]*href=/, page + ' retains real source/policy links');
    if (page === 'research.html') {
      assert.match(footer, /Curated snapshot.*not every paper or incident/, 'Research keeps its existing coverage disclaimer');
      assert.match(footer, /href="about\.html"/, 'Research shares the editorial policy destination');
      assert.match(footer, /href="index\.html#\/sources"/, 'Research shares the working source-register destination');
    }
    assert.match(html, /href="(?:\.\/|\.\.\/)?site-chrome\.css"/,
      page + ' must load shared footer styling');
  }
  const games=fs.readFileSync(path.join(__dirname, '..', 'games.html'), 'utf8');
  assert.match(games, /<footer>[\s\S]*?<p>[\s\S]*?<p>/);
  const offline=fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'Offline edition must use the exact shared footer component');
});

test('all standalone page families expose the same real policy and source destinations without scripts', () => {
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.match(builder, /def ensure_footer_resources\(html, path\):/);
  assert.match(builder, /return ensure_skip_destination_focusable\(normalized, path\)/);
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  assert.match(build, /ensure_footer_resources\(normalize_standalone_chrome\(page.read_text\(encoding="utf-8"\), route\), route\)/);
  for (const route of [
    'demo.html', 'research.html', 'catalog-review.html', 'hardware-review.html',
    'games.html', 'technologies.html', 'playbooks.html', 'whats-new.html',
    'about.html', 'terms/index.html', 'technology/index.html',
    'terms/MLD-0001-a-b-test.html', 'technology/TECH-0288-vllm.html'
  ]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const footer = html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
    assert.ok(footer, route + ' has a usable footer without hydration');
    const prefix = route.startsWith('terms/') || route.startsWith('technology/') ? '../' : '';
    const required = route === 'games.html'
      ? [prefix + 'index.html#/sources']
      : [prefix + 'about.html', prefix + 'index.html#/sources'];
    for (const href of required) {
      assert.equal(footer.split('href="' + href + '"').length - 1, 1,
        route + ' must link exactly once to canonical ' + href);
    }
    assert.ok(!/onclick\s*=/.test(footer), route + ' resources require no script');
  }
  const games = fs.readFileSync(path.join(__dirname, '..', 'games.html'), 'utf8');
  assert.match(games, /<footer><p>Built from AI Updates/);
  assert.match(games, /Scores and missed concepts stay in this tab/);
});

test('native desktop rails expose Discover secondary destinations from one shared enhancement', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  const discoverMore = home.split('<details class="nav-more" id="additional-navigation">')[1]?.split('</details>')[0];
  assert.ok(discoverMore, 'Discover must retain its script-free secondary menu');
  const existing = [...discoverMore.matchAll(/<a class="nav-link" data-(?:view|static)="[^"]+" href="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g)]
    .map(match => [match[1].startsWith('#/') ? 'index.html' + match[1] : match[1], match[2]]);
  const generated = script.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  assert.ok(generated, 'Every native page must share one secondary source');
  const rendered = [...generated.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  const source = generator.split('SECONDARY_DESTINATIONS = (')[1]?.split('\n)')[0];
  assert.ok(source, 'Canonical secondary navigation definitions must be present');
  const canonical = [...source.matchAll(/\("([^"]+)", "(?:view|static)", "([^"]+)", "([^"]+)"\),/g)]
    .map(m => [m[2], m[3]]);
  assert.equal(canonical.length, 8, 'Do not invent or remove secondary destinations');
  assert.deepEqual(rendered, canonical, 'Native desktop rails must use the Python build-time source');
  const seoBuild = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  assert.match(seoBuild, /sync_secondary_navigation_script\(theme\)/);
  assert.match(generator, /secondary = sync_discover_secondary\(secondary\)/);
  assert.match(script, /atlas-secondary-data:begin/);
  assert.match(script, /atlas-secondary-data:end/);
  assert.equal(rendered.length, 8, 'Keep existing eight destinations, without expanding the catalog');
  assert.deepEqual(rendered, existing, 'Secondary destinations and order must match Discover');
  assert.ok(script.includes("desktopRail?.querySelector?.('.site-chrome__links')"));
  assert.ok(script.includes("!desktopRail.querySelector('.site-chrome__more')"),
    'Do not duplicate disclosure on repeated enhancement');
  assert.ok(script.includes("homeLink.endsWith('index.html#/overview')"),
    'Use actual native brand link for nested catalog path prefixes');
  const block = styles.split('/* atlas-secondary-navigation:begin */')[1]?.split('/* atlas-secondary-navigation:end */')[0];
  assert.ok(block && block.includes('@media(min-width:651px)'), 'Enhance desktop rail only');
  assert.ok(block.includes('min-height:44px') && block.includes('focus-visible'));
  const linkRule = block.split('.site-chrome__more-links a{')[1]?.split('}')[0];
  const triggerRule = block.split('.site-chrome__more > summary{')[1]?.split('}')[0];
  assert.ok(linkRule && triggerRule && !linkRule.includes('display:none') &&
    !triggerRule.includes('display:none') && !block.includes('pointer-events:none'),
    'Visible links and disclosure toggle remain keyboard-interactive');
  assert.ok(block.includes('summary::-webkit-details-marker{display:none}'),
    'Only the duplicate browser marker may be hidden');
  assert.ok(block.includes('@media print{.site-chrome__more{display:none!important}}'),
    'Print must not include navigation chrome');
  assert.ok(offline.includes(styles) && offline.includes(script),
    'Single-file demo must carry the exact same shared styles and enhancement');
});

test('one shared mobile disclosure exposes the existing secondary routes with keyboard access', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'site-chrome.css'), 'utf8');
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.match(js, /#additional-navigation \.nav-more-links, \.site-chrome__more-links/,
    'Mobile More sections must reuse actual desktop links rather than duplicate route definitions');
  assert.match(js, /sourceLinks\.querySelectorAll\('a\[href\]'\)/);
  assert.match(js, /source\.hasAttribute\('download'\)/,
    'Offline download must retain its native download behavior');
  assert.match(js, /querySelectorAll\('a\[href\],button:not\(\[disabled\]\),summary'\)/,
    'Keyboard trapping must include the nested More sections summary');
  assert.match(css, /\.site-mobile-chrome__more>summary:focus-visible|\.site-mobile-chrome summary:focus-visible/,
    'Nested disclosure has visible keyboard focus');
  assert.match(css, /\.site-mobile-chrome__more>summary\{[^}]*min-height:44px/,
    'Nested summary needs a touch-sized target');
  assert.ok(offline.includes(js) && offline.includes(css),
    'The single-file offline demo must include both updated shared components');
});


test('Discover mobile drawer exposes the canonical eight secondary destinations without JavaScript', () => {
  const generator = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  const theme = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  assert.ok(generator.includes('render_mobile_secondary_nav("").replace('),
    'Discover must reuse the existing shared mobile link generator, not maintain a copied list');
  assert.ok(theme.includes("if (menu && !menu.querySelector('.site-mobile-chrome__more'))"),
    'Hydration must not add a duplicate disclosure to the script-free drawer');
  const raw = theme.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  const canonical = [...raw.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
  assert.equal(canonical.length, 8);
  for (const [route, offline] of [['index.html', false], ['downloads/Atlas_Demo_Offline.html', true]]) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const drawer = html.match(/<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav><\/details><\/div>/)?.[1];
    assert.ok(drawer, route + ' has the native drawer and brand');
    assert.equal((drawer.match(/<details class="site-mobile-chrome__more">/g) || []).length, 1,
      route + ' must have exactly one script-free secondary disclosure');
    assert.equal((drawer.split('<details class="site-mobile-chrome__more">')[0].match(/<a href="[^"]+"(?: aria-current="page")?>/g) || []).length, 7,
      route + ' keeps the seven top-level primary links');
    const secondary = drawer.match(/<details class="site-mobile-chrome__more"><summary>More sections<\/summary><div class="site-mobile-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(secondary, route + ' retains native nested keyboard disclosure');
    const actual = [...secondary.matchAll(/<a href="([^"]+)"( download)?>([^<]+)<\/a>/g)]
      .map(m => [m[1], m[3].replaceAll('&amp;', '&')]);
    const expected = canonical.map(([href, label]) => {
      let local = href.replace(/^index\.html(?=#\/)/, '');
      if (offline && local === 'demo.html') local = '#/overview';
      if (offline && local === 'terms/index.html') local = '#/dictionary';
      return [local, label];
    });
    assert.deepEqual(actual, expected, route + ' retains working canonical destinations');
    assert.match(secondary, /href="downloads\/Atlas_Demo_Offline\.html" download>/,
      'Keep the original downloadable offline fallback');
  }
});

test('native editorial, archive, technology, research and Games pages keep Discover secondary navigation without JS', () => {
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const py = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'site_chrome.py'), 'utf8');
  const build = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build_seo.py'), 'utf8');
  const data = js.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  assert.ok(data, 'Shared secondary destinations must exist');
  const expected = [...data.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
  assert.equal(expected.length, 8);
  assert.match(home, /<details class="nav-more" id="additional-navigation">/);
  assert.match(py, /def render_secondary_nav\(prefix\):/);
  assert.match(py, /native_secondary=True/);
  assert.match(build, /page_label='About', native_secondary=True, mobile_secondary=True/);
  for (const name of ['about.html', 'demo.html', 'research.html', 'catalog-review.html',
    'hardware-review.html', 'games.html', 'technologies.html', 'playbooks.html', 'whats-new.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
    const rail = html.match(/<nav class="site-chrome [^"]+" aria-label="AI Updates primary navigation">[\s\S]*?<\/nav>/)?.[0];
    assert.ok(rail, name + ' has the shared native desktop rail');
    assert.equal((rail.match(/class="site-chrome__more"/g) || []).length, 1,
      name + ' must have one script-free disclosure, not a duplicate');
    const details = rail.match(/<details class="site-chrome__more"><summary>More sections<\/summary><div class="site-chrome__more-links">([\s\S]*?)<\/div><\/details>/);
    assert.ok(details, name + ' exposes the same native disclosure as Discover');
    const anchors = [...details[1].matchAll(/<a href="([^"]+)"( download)?>([^<]+)<\/a>/g)]
      .map(m => [m[1], m[3].replaceAll('&amp;', '&')]);
    assert.deepEqual(anchors, expected, name + ' secondary routes and labels must not drift');
    assert.ok(details[1].includes('href="downloads/Atlas_Demo_Offline.html" download>'),
      name + ' must preserve the native offline download');
    assert.equal((rail.match(/class="site-chrome__links"/g) || []).length, 1,
      name + ' retains its original primary navigation');
    assert.match(html, /class="[^"]*site-mobile-chrome__nav"/,
      name + ' retains its native keyboard-usable mobile menu');
  }
  assert.ok(js.includes("!desktopRail.querySelector('.site-chrome__more')"),
    'JS enhancement must not insert a second disclosure over static navigation');
});

test('generated concept and technology directories expose shared secondary routes without JavaScript', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const data = js.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  assert.ok(data, 'Canonical Discover secondary routes must exist');
  const expected = [...data.matchAll(/\["([^"]+)", "([^"]+)"\]/g)]
    .map(m => ['../' + m[1], m[2]]);
  assert.equal(expected.length, 8);
  const termBuild = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_term_pages.py'), 'utf8');
  const seoBuild = fs.readFileSync(path.join(__dirname, '..', 'scripts/build_seo.py'), 'utf8');
  assert.ok(termBuild.includes("native_secondary=True"));
  assert.ok(seoBuild.includes("native_secondary=True"));
  for (const route of ['terms/index.html', 'technology/index.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const rail = html.match(/<nav class="site-chrome term-nav" aria-label="AI Updates primary navigation">[\s\S]*?<\/nav>/)?.[0];
    assert.ok(rail, route + ' keeps its shared primary navigation');
    assert.equal((rail.match(/class="site-chrome__more"/g) || []).length, 1,
      route + ' must have exactly one script-free secondary disclosure');
    const menu = rail.match(/<details class="site-chrome__more"><summary>More sections<\/summary><div class="site-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(menu, route + ' uses the shared native disclosure');
    const links = [...menu.matchAll(/<a href="([^"]+)"( download)?>([^<]+)<\/a>/g)]
      .map(m => [m[1], m[3].replaceAll('&amp;', '&')]);
    assert.deepEqual(links, expected, route + ' must match Discover including nested URL prefixes');
    assert.ok(menu.includes('href="../downloads/Atlas_Demo_Offline.html" download>'),
      route + ' retains the real offline download');
    assert.equal((rail.match(/class="site-chrome__links"/g) || []).length, 1,
      route + ' retains one primary link group');
    assert.match(html, /href="\.\.\/index\.html#\/search"/,
      route + ' keeps working shared search navigation');
    assert.match(html, /id="directory-mobile-nav"/,
      route + ' preserves native mobile navigation');
  }
});


test('standalone mobile drawers expose eight shared secondary routes without JavaScript', () => {
  const builder = fs.readFileSync(path.join(__dirname, '..', 'scripts/site_chrome.py'), 'utf8');
  assert.match(builder, /def render_mobile_secondary_nav\(prefix\):/);
  assert.match(builder, /mobile_brand=True, native_secondary=True, mobile_secondary=True/);
  assert.match(builder, /for _, _, route, label in SECONDARY_DESTINATIONS/);
  const source = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const data = source.split('const sharedSecondarySections = [')[1]?.split('];')[0];
  const expected = [...data.matchAll(/\["([^"]+)", "([^"]+)"\]/g)].map(m => [m[1], m[2]]);
  assert.equal(expected.length, 8);
  for (const route of ['about.html', 'demo.html', 'research.html', 'catalog-review.html',
                       'hardware-review.html', 'games.html', 'technologies.html',
                       'playbooks.html', 'whats-new.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', route), 'utf8');
    const menu = html.match(/<nav class="[^"]*site-mobile-chrome__menu"[^>]*>([\s\S]*?)<\/nav><\/details>/)?.[1];
    assert.ok(menu, route + ' keeps native primary links and mobile drawer');
    assert.equal((menu.match(/<details class="site-mobile-chrome__more">/g) || []).length, 1,
                 route + ' has exactly one static secondary disclosure');
    const secondaries = menu.match(/<details class="site-mobile-chrome__more"><summary>More sections<\/summary><div class="site-mobile-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(secondaries, route + ' preserves the shared native disclosure');
    const found = [...secondaries.matchAll(/<a href="([^"]+)"( download)?>([^<]+)<\/a>/g)]
      .map(m => [m[1], m[3].replaceAll('&amp;', '&')]);
    assert.deepEqual(found, expected, route + ' uses shared canonical destinations');
    assert.match(secondaries, /href="downloads\/Atlas_Demo_Offline\.html" download>/);
    assert.equal((menu.match(/<a href="/g) || []).length, 15,
                 route + ' keeps seven primary and eight secondary links without duplicates');
  }
});

test('both generated A-Z directories share native script-free secondary mobile navigation', () => {
  for (const [page, sourceFile] of [
    ['terms/index.html','scripts/build_term_pages.py'],
    ['technology/index.html','scripts/build_seo.py']
  ]) {
    const source=fs.readFileSync(path.join(__dirname,'..',sourceFile),'utf8');
    const generatedMobileSecondary = page === 'technology/index.html'
      ? source.includes("mobile_secondary=True")
      : source.includes("mobile_secondary=(path == '"+page+"')");
    assert.ok(generatedMobileSecondary, page+' has build-time shared navigation');
    const html=fs.readFileSync(path.join(__dirname,'..',page),'utf8');
    const menu=html.match(/<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav><\/details>/)?.[1];
    const rail=html.match(/<div class="site-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(menu && rail, page+' has native mobile and desktop sections');
    assert.equal((menu.match(/<details class="site-mobile-chrome__more">/g)||[]).length,1);
    const mobile=menu.match(/<div class="site-mobile-chrome__more-links">([\s\S]*?)<\/div><\/details>/)?.[1];
    assert.ok(mobile,page+' retains the nested disclosure without scripts');
    const links = markup => [...markup.matchAll(/<a href="([^"]+)"( download)?>([^<]+)<\/a>/g)]
      .map(m=>[m[1],m[3]]);
    assert.deepEqual(links(mobile),links(rail),page+' has identical mobile/desktop secondary links');
    assert.equal(links(mobile).length,8);
    assert.equal((menu.match(/<a href="/g)||[]).length,15,'Seven primary + eight secondary links, no duplicates');
    assert.match(html,/href="\.\.\/index\.html#\/search"/,'Real search route stays usable');
  }
});


test('generated detail mobile More sections clones the completed shared desktop rail', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'site-theme.js'), 'utf8');
  const created = script.indexOf("desktopPrimary.insertAdjacentElement('afterend', more);");
  const cloned = script.indexOf("if (menu && !menu.querySelector('.site-mobile-chrome__more'))");
  assert.ok(created !== -1 && cloned > created,
    'Build the missing detail-page secondary rail before its mobile disclosure copies links');
  for (const detail of ['terms/MLD-0002-ablation-study.html', 'technology/TECH-0288-vllm.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', detail), 'utf8');
    assert.match(html, /class="site-mobile-chrome__menu"/);
    assert.match(html, /class="site-chrome__links"/);
    assert.ok(!html.includes('site-mobile-chrome__more'),
      'This regression exercises detail pages without pre-rendered mobile extras');
  }
  const offline = fs.readFileSync(path.join(__dirname, '..', 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(script), 'Offline fallback must embed the identical shared interaction script');
});
