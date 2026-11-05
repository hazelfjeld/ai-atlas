'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Games is an original workspace hash route, not a second website link', () => {
  const html = read('index.html'), app = read('app.js');
  assert.ok(!html.includes('href="games.html"'));
  assert.match(app, /games:'Games'/);
  assert.match(app, /nav\.querySelectorAll\('a\[data-view\]'\)/);
  assert.ok(app.includes("else if(view==='games')"));
  assert.ok(app.includes('AtlasGamesTab.mount'));
  for(const name of ['games-core.js','games-tab.js']) assert.ok(html.includes('src="'+name+'"'));
  assert.ok(html.includes('href="games-tab.css"'));
});
test('Native Games reuses catalog, cleans up listeners/timers, and opens Atlas concept dialogs', () => {
  const ui = read('games-tab.js'), app = read('app.js');
  new vm.Script(ui);
  assert.ok(ui.includes('mount(root, data, options'));
  assert.ok(ui.includes('lifecycle.abort(); clearTimers();'));
  assert.ok(!ui.includes('await window.ATLAS_READY'));
  assert.ok(!ui.includes('document.body.classList'));
  assert.ok(app.includes('disposeGames();disposeGames=null;'));
  assert.ok(app.includes('openConcept:openRecord'));
  assert.ok(!ui.includes('<iframe'));
});
test('Standalone game links still work with shared game engine', () => {
  const html = read('games.html');
  for(const name of ['catalog-loader.js','core.js','games-core.js','games.js']) assert.ok(html.includes('src="'+name+'"'));
  assert.match(html, /<main id="main" tabindex="-1">/, 'Skip-link destination must be keyboard-focusable');
  assert.match(html, /id="theme-toggle"[^>]*aria-label="Dark theme" aria-pressed="false"/, 'Theme toggle must expose a stable name and an initial state');
  assert.match(html, /id="theme-toggle"[^>]*min-width:44px;min-height:44px/, 'Standalone theme button must meet the 44px mobile touch-target baseline');
  assert.match(read('games.js'), /setAttribute\('aria-pressed', String\(document.documentElement.dataset.theme === 'dark'\)\)/);
});
test('Offline fallback embeds Games without redirecting learners to another site', () => {
  const html = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(html.includes('window.AtlasGamesTab'));
  assert.ok(html.includes("else if(view==='games')"));
  assert.ok(!html.includes('<span>Games (online)</span>'));
  assert.ok(!html.includes('href="https://raw.githack.com/hazelfjeld/ai-atlas/main/games.html"'));
  assert.ok(!html.includes('src="games-tab.js"'));
  assert.ok(!html.includes('href="games-tab.css"'));
});

test('first-paint sidebar uses the same canonical workspace destinations as hydration', () => {
  const html=read('index.html'),app=read('app.js');
  const nav=html.match(/<nav id="navigation" aria-label="Main navigation">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  const links=[...nav.matchAll(/<a class="nav-link(?: active)?"([^>]*)>[\s\S]*?<\/a>/g)].map(m=>({
    id:m[1].match(/data-(?:view|static)="([^"]+)"/)?.[1],href:m[1].match(/href="([^"]+)"/)?.[1]
  }));
  assert.deepEqual(links,[
    ['overview','#/overview'],['daily','whats-new.html'],['dictionary','#/dictionary'],
    ['technologies','#/technologies'],['games','#/games'],['safety','#/safety'],
    ['papers','#/papers'],['playbooks','#/playbooks'],['compare','#/compare'],
    ['saved','#/saved'],['sources','#/sources'],['demo','demo.html'],
    ['encyclopedia','terms/index.html'],['offline','downloads/Atlas_Demo_Offline.html']
  ].map(([id,href])=>({id,href})));
  assert.ok(app.includes("nav.querySelectorAll('a[data-view]')"));
  assert.ok(!app.includes("$('navigation').innerHTML=items.map"));
  assert.ok(html.includes('<noscript>') && html.includes('href="terms/index.html"'));
});


test('progressive sidebar retains all canonical links and reveals deep-linked secondary views', () => {
  const html=read('index.html'), app=read('app.js'), css=read('brand.css');
  const nav=html.match(/<nav id="navigation" aria-label="Main navigation">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  assert.match(nav, /<details class="nav-more" id="additional-navigation"><summary class="nav-more-toggle">/);
  assert.ok(!nav.includes('id="additional-navigation" open'), 'Secondary links should be collapsed on initial paint');
  assert.match(nav, /<div class="nav-more-links">[\s\S]*?data-view="safety"/);
  assert.match(nav, /data-static="offline"[\s\S]*?<\/div><\/details>$/);
  for(const id of ['overview','dictionary','technologies','games','safety','papers','playbooks','compare','saved','sources'])
    assert.match(nav, new RegExp('data-view="'+id+'"'), 'Missing native workspace destination: '+id);
  assert.match(app, /if\(more && \['safety','papers','playbooks','compare','saved','sources'\]\.includes\(view\)\) more\.open=true/);
  assert.match(css, /\.nav-more-toggle:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});


test('mobile drawer does not expose closed offscreen links and supports keyboard dismissal', () => {
  const html=read('index.html'),app=read('app.js'),css=read('app.css'),offline=read('downloads/Atlas_Demo_Offline.html');
  assert.match(html, /id="menu-toggle"[^>]+aria-controls="sidebar"/);
  assert.match(css, /@media\(max-width:650px\)[\s\S]*?\.sidebar\{[^}]*visibility:hidden/);
  assert.match(css, /\.sidebar\.open\{[^}]*visibility:visible/);
  assert.match(app, /function closeMobileNavigation\(restoreFocus=false\)/);
  assert.match(app, /document\.querySelector\('\.workspace'\)\.inert=open/);
  assert.match(app, /e\.key==='Escape'/);
  assert.match(app, /mobileNavTabStops\(\)/);
  assert.match(offline, /aria-controls="sidebar"/);
  assert.match(offline, /function closeMobileNavigation\(restoreFocus=false\)/);
});
test('standalone Games header provides 44px navigation targets on 320px phones', () => {
  const css = read('games.css');
  assert.match(css, /@media\(max-width:360px\)[\s\S]*?\.masthead nav\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:360px\)[\s\S]*?\.masthead nav a\{[^}]*min-height:44px/);
});


test('About, technologies and playbooks reuse the Games and archive mobile chrome', () => {
  const expected = [
    ['index.html#/overview','Discover'], ['whats-new.html','What’s New Today'],
    ['index.html#/dictionary','Concept dictionary'],
    ['index.html#/technologies','Technology profiles'],
    ['index.html#/games','Games'], ['playbooks.html','Playbooks'], ['about.html','About']
  ];
  const navLinks = (html,path) => {
    const menu = html.match(/<nav class="[^"]*site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(menu, 'Missing actual shared mobile navigation in '+path);
    const links = [...menu.matchAll(/<a href="([^"]+)"(?: aria-current="page")?>([^<]+)<\/a>/g)];
    assert.equal(links.length, 7, path);
    assert.deepEqual(links.map(m => [m[1],m[2]]), expected, path);
    return menu;
  };
  // Games and the daily archive already use these exact destinations.
  for (const path of ['games.html','whats-new.html']) navLinks(read(path),path);
  for (const [path,prefix,active] of [
    ['technologies.html','tech','Technology profiles'],
    ['playbooks.html','playbook','Playbooks'],
    ['about.html','about','About']]) {
    const html=read(path);
    assert.match(html, new RegExp('class="'+prefix+'-mobile-topbar site-mobile-chrome"'), path);
    assert.match(html, new RegExp('class="'+prefix+'-mobile-nav site-mobile-chrome__nav"'), path);
    assert.match(html, new RegExp('class="'+prefix+'-menu-toggle site-mobile-chrome__toggle"'), path);
    assert.match(html, new RegExp('class="'+prefix+'-search-link site-mobile-chrome__search" href="index.html#/search"'), path);
    assert.match(html, /<link rel="stylesheet" href="site-chrome.css">/, path);
    const menu=navLinks(html,path);
    assert.equal((menu.match(/aria-current="page"/g)||[]).length,1,path);
    assert.ok(menu.includes('aria-current="page">'+active+'</a>'),path);
    // Obsolete per-page copies of the menu styles must not override the shared implementation.
    assert.ok(!new RegExp('\\.'+prefix+'-menu-panel a\\{').test(html),path);
    assert.ok(html.includes('@media print'),path);
  }
  assert.match(read('technologies.html'), /\.tech-controls input,\.tech-controls select\{min-height:44px;font-size:16px\}/);
  assert.match(read('playbooks.html'), /\.playbook-tools input,\.playbook-tools select\{min-height:44px;font-size:16px\}/);
  assert.match(read('about.html'), /\.term-shell \.term-nav\{display:none\}/);
  const css=read('site-chrome.css');
  assert.match(css, /\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
  assert.match(css, /\.site-mobile-chrome a:focus-visible,\.site-mobile-chrome summary:focus-visible/);
  assert.match(css, /@media \(max-width:650px\)\{/);
});

test('editorial review pages reuse the canonical shared mobile chrome without changing evidence', () => {
  const expected = [
    ['index.html#/overview','Discover'], ['whats-new.html','What’s New Today'],
    ['index.html#/dictionary','Concept dictionary'], ['index.html#/technologies','Technology profiles'],
    ['index.html#/games','Games'], ['playbooks.html','Playbooks'], ['about.html','About']
  ];
  const extract = html => {
    const content = html.match(/<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(content, 'Shared navigation is missing');
    const links = [...content.matchAll(/<a href="([^"]+)"(?: aria-current="(?:page|location)")?>([^<]+)<\/a>/g)];
    return links.map(m => [m[1],m[2]]);
  };
  assert.deepEqual(extract(read('games.html')), expected, 'Games is the canonical baseline');
  for (const [filename,prefix] of [['catalog-review.html','review'],['hardware-review.html','hardware']]) {
    const html=read(filename);
    assert.match(html, new RegExp('class="'+prefix+'-mobile-topbar site-mobile-chrome"'), filename);
    assert.match(html, new RegExp('id="'+prefix+'-mobile-nav"'), filename);
    assert.match(html, /class="site-mobile-chrome__toggle"/, filename);
    assert.match(html, /class="site-mobile-chrome__search" href="index.html#\/search"/, filename);
    assert.deepEqual(extract(html), expected, filename + ' must match the same seven primary links');
    assert.match(html, /href="whats-new.html" aria-current="location">What’s New Today<\/a>/, filename);
    assert.doesNotMatch(html, new RegExp('\\.'+prefix+'-menu-(?:toggle|panel)\\{'), filename + ' must not duplicate the shared CSS');
    assert.match(html, /@media\(max-width:650px\)/, filename);
    assert.match(html, /@media print/, filename);
  }
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome__nav\{margin:0;flex:0 0 44px\}/);
  const catalog=read('catalog-review.html'), hardware=read('hardware-review.html');
  assert.ok(catalog.includes('Seven proposals, not seven new entries.'));
  assert.ok(catalog.includes('data/catalog-candidate-decisions-2026-11-03.json'));
  assert.ok(hardware.includes('65.7 ms is OS boot, not the complete first detection'));
  assert.ok(hardware.includes('Publisher measurements and derived ratios'));
  assert.match(hardware, /\.review-shell>header\{display:block;padding-top:20px\}/);
});

test('standalone research snapshot uses compact mobile navigation without changing evidence records', () => {
  const html=read('research.html');
  assert.match(html, /class="research-mobile-topbar"/);
  assert.match(html, /<details class="research-mobile-nav" id="research-mobile-nav">/);
  assert.match(html, /<nav class="research-menu-panel" aria-label="AI Updates sections">/);
  assert.match(html, /href="#papers" aria-current="page">Research library<\/a>/);
  assert.match(html, /class="research-search-link" href="index.html#\/search"/);
  assert.match(html, /@media\(max-width:700px\)[\s\S]*?\.shell>aside\{display:none\}/);
  assert.match(html, /\.research-menu-panel a\{[^}]*min-height:44px/);
  assert.match(html, /@media print\{\.research-mobile-topbar\{display:none\}\}/);
  for (const route of ['overview','dictionary','technologies','games'])
    assert.ok(html.includes('href="index.html#/'+route+'"'), 'Missing existing workspace route: '+route);
  for (const anchor of ['papers','alerts','coverage'])
    assert.ok(html.includes('href="#'+anchor+'"'), 'Missing research-section destination: '+anchor);
  const publishedTechnologies = JSON.parse(read('publication.json')).published_counts.technologies;
  assert.ok(html.includes(`Technologies <span>${publishedTechnologies} ↗</span>`), 'Sidebar must use the published count');
  assert.ok(html.includes(`all ${publishedTechnologies} technologies`), 'Research notice must agree with the published catalog');
  assert.ok(html.includes('Automatic collection remains off.'));
  assert.ok(html.includes('id="loading-status" role="status"'));
});


test('generated concept and technology pages have accessible two-column mobile navigation', () => {
  const css = read('brand.css');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  for (const page of ['terms/MLD-0002-ablation-study.html','technology/index.html']) {
    const html = read(page);
    assert.match(html, /<nav class="term-nav" aria-label="Site navigation">/);
    assert.match(html, /href="\.\.\/index\.html"/);
  }
  assert.match(css, /@media\(max-width:650px\)\{\s*\.term-shell \.term-nav\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.term-shell \.term-nav>a\{[^}]*min-height:44px/);
  assert.match(css, /\.term-shell \.term-nav>a:focus-visible\{outline:2px solid var\(--accent\)/);
  assert.ok(offline.includes('/* Native, script-free reference pages: readable two-column touch navigation on phones.'));
});


test('script-free reference pages honor dark OS preference with readable cards and links', () => {
  const css = read('brand.css');
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{[\s\S]*?:root:not\(\[data-theme\]\):has\(\.term-shell\)/);
  assert.match(css, /\.term-shell \.detail-block\{background:var\(--surface\)\}/);
  assert.match(css, /\.term-shell \.detail-block\.caveat\{background:var\(--accent-soft\)/);
  assert.match(css, /\.term-shell \.notice\{background:var\(--accent-soft\);border-color:var\(--line\)\}/);
  assert.match(css, /\.term-shell a\{color:var\(--accent\)\}/);
  for (const reference of ['terms/MLD-0002-ablation-study.html', 'technology/TECH-0216-pytorch.html'])
    assert.match(read(reference), /<main class="term-shell" id="main">/);
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes('Script-free reference pages honor the OS dark palette'));
});


test('editorial directories share one responsive primary navigation component', () => {
  const names = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
  const pages = [
    ['whats-new.html','What’s New Today'], ['about.html','About'],
    ['technologies.html','Technology profiles'], ['playbooks.html','Playbooks']
  ];
  for (const [path, active] of pages) {
    const html = read(path);
    assert.match(html, /<link rel="stylesheet" href="site-chrome.css">/);
    const nav = html.match(/<nav class="site-chrome [^"]+" aria-label="AI Updates primary navigation">([\s\S]*?)<\/nav>/);
    assert.ok(nav, path);
    assert.match(nav[1], /class="site-chrome__brand" href="index.html#\/overview"/);
    const links = [...nav[1].matchAll(/<a href="[^"]+"(?: aria-current="page")?>([^<]+)<\/a>/g)];
    assert.deepEqual(links.map(link => link[1]), names, path);
    const selected = nav[1].match(/<a href="[^"]+" aria-current="page">([^<]+)<\/a>/g) || [];
    assert.equal(selected.length, 1, path);
    assert.ok(selected[0].includes('>' + active + '</a>'), path);
  }
  const css = read('site-chrome.css');
  assert.match(css, /\.site-chrome__links a\[aria-current=page\]/);
  assert.match(css, /\.site-chrome__name\{color:inherit!important/);
  assert.match(css, /\.site-chrome a:focus-visible/);
  assert.match(css, /@media \(max-width:650px\)\{\.site-chrome\{display:none!important\}\}/);
  assert.ok(JSON.parse(read('deploy/public-files.json')).root_files.includes('site-chrome.css'));
});

test('editorial evidence reviews reuse the shared desktop site chrome and readable article layout', () => {
  const labels = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
  for (const [route, cls] of [['catalog-review.html','nav'], ['hardware-review.html','review-nav']]) {
    const html=read(route);
    assert.ok(html.includes('<link rel="stylesheet" href="site-chrome.css">'), route);
    const nav=html.split('<nav class="site-chrome '+cls+'" aria-label="AI Updates primary navigation">')[1]?.split('</nav>')[0];
    assert.ok(nav, route);
    assert.ok(nav.includes('class="site-chrome__brand" href="index.html#/overview"'), route);
    const links=[...nav.matchAll(/<a href="[^"]+"(?: aria-current="location")?>([^<]+)<[/]a>/g)];
    assert.deepEqual(links.map(x => x[1]), labels, route);
    assert.ok(nav.includes('href="whats-new.html" aria-current="location">What’s New Today</a>'), route);
    assert.ok(!nav.includes('aria-current="page"'), route);
  }
  assert.ok(read('hardware-review.html').includes('.review-shell>header{display:block}'));
  assert.ok(read('site-chrome.css').includes('.site-chrome__links a[aria-current=location]'));
});
