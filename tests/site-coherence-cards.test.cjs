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
    for (const href of [prefix + 'about.html', prefix + 'index.html#/sources']) {
      assert.equal(footer.split('href="' + href + '"').length - 1, 1,
        route + ' must link exactly once to canonical ' + href);
    }
    assert.ok(!/onclick\s*=/.test(footer), route + ' resources require no script');
  }
  const games = fs.readFileSync(path.join(__dirname, '..', 'games.html'), 'utf8');
  assert.match(games, /<footer><p>Built from AI Updates/);
  assert.match(games, /Scores and missed concepts stay in this tab/);
});
