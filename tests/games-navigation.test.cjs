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


test('standalone technology directory shares the compact mobile menu and real workspace search', () => {
  const html=read('technologies.html');
  assert.match(html, /class="tech-mobile-topbar"/);
  assert.match(html, /<details class="tech-mobile-nav" id="tech-mobile-nav">/);
  assert.match(html, /<nav class="tech-menu-panel" aria-label="AI Updates sections">/);
  assert.match(html, /href="technologies.html" aria-current="page">Technology profiles<\/a>/);
  assert.match(html, /class="tech-search-link" href="index.html#\/search"/);
  assert.match(html, /@media\(max-width:650px\)[\s\S]*?\.tech-top\{display:none\}/);
  assert.match(html, /\.tech-controls input,\.tech-controls select\{min-height:44px;font-size:16px\}/);
  assert.match(html, /@media print\{[^}]*\.tech-mobile-topbar\{display:none\}/);
  for(const route of ['overview','dictionary','safety','papers','games'])
    assert.ok(html.includes('href="index.html#/'+route+'"'), 'Missing workspace route: '+route);
});


test('standalone playbooks share the compact mobile menu and real collection search', () => {
  const html=read('playbooks.html');
  assert.match(html, /class="playbook-mobile-topbar"/);
  assert.match(html, /<details class="playbook-mobile-nav" id="playbook-mobile-nav">/);
  assert.match(html, /<nav class="playbook-menu-panel" aria-label="AI Updates sections">/);
  assert.match(html, /href="playbooks.html" aria-current="page">Playbooks<\/a>/);
  assert.match(html, /class="playbook-search-link" href="index.html#\/search"/);
  assert.match(html, /@media\(max-width:650px\)[\s\S]*?\.playbook-top\{display:none\}/);
  assert.match(html, /\.playbook-tools input,\.playbook-tools select\{min-height:44px;font-size:16px\}/);
  assert.match(html, /@media print\{\.playbook-mobile-topbar\{display:none\}\}/);
  for(const route of ['overview','dictionary','safety','papers','games'])
    assert.ok(html.includes('href="index.html#/'+route+'"'), 'Missing workspace route: '+route);
});

test('editorial policy uses the same compact mobile menu and real collection search as the archive', () => {
  const html=read('about.html');
  assert.match(html, /class="about-mobile-topbar"/);
  assert.match(html, /<details class="about-mobile-nav" id="about-mobile-nav">/);
  assert.match(html, /<nav class="about-menu-panel" aria-label="AI Updates sections">/);
  assert.match(html, /href="about.html" aria-current="page">About<\/a>/);
  assert.match(html, /class="about-search-link" href="index.html#\/search"/);
  assert.match(html, /@media\(max-width:650px\)/);
  assert.match(html, /\.term-shell \.term-nav\{display:none\}/);
  for(const route of ['overview','dictionary','technologies','safety','papers','games'])
    assert.ok(html.includes('href="index.html#/'+route+'"'), 'Missing route: '+route);
});


test('catalog candidate review uses the compact mobile navigation without modifying its editorial content', () => {
  const html=read('catalog-review.html');
  assert.match(html, /class="review-mobile-topbar"/);
  assert.match(html, /<details class="review-mobile-nav" id="review-mobile-nav">/);
  assert.match(html, /<nav class="review-menu-panel" aria-label="AI Updates sections">/);
  assert.match(html, /href="catalog-review.html" aria-current="page">Catalog review<\/a>/);
  assert.match(html, /class="review-search-link" href="index.html#\/search"/);
  assert.match(html, /@media\(max-width:650px\)[\s\S]*?\.shell>\.nav\{display:none\}/);
  assert.match(html, /\.review-menu-panel a\{[^}]*min-height:44px/);
  assert.match(html, /@media print\{\.review-mobile-topbar\{display:none\}\}/);
  for(const route of ['overview','dictionary','safety','papers','games'])
    assert.ok(html.includes('href="index.html#/'+route+'"'), 'Missing workspace destination: '+route);
  assert.ok(html.includes('Seven proposals, not seven new entries.'));
  assert.ok(html.includes('data/catalog-candidate-decisions-2026-11-03.json'));
});


test('hardware evidence review uses the same mobile navigation while retaining source-qualified research', () => {
  const html=read('hardware-review.html');
  assert.match(html, /class="hardware-mobile-topbar"/);
  assert.match(html, /<details class="hardware-mobile-nav" id="hardware-mobile-nav">/);
  assert.match(html, /<nav class="hardware-menu-panel" aria-label="AI Updates sections">/);
  assert.match(html, /href="hardware-review.html" aria-current="page">Hardware evidence<\/a>/);
  assert.match(html, /class="hardware-search-link" href="index.html#\/search"/);
  assert.match(html, /@media\(max-width:650px\)[\s\S]*?\.review-shell>\.review-nav\{display:none\}/);
  assert.match(html, /\.hardware-menu-panel a\{[^}]*min-height:44px/);
  assert.match(html, /\.review-shell>header\{display:block;padding-top:20px\}/);
  assert.match(html, /@media print\{\.review-nav,\.skip,\.hardware-mobile-topbar\{display:none\}/);
  for (const route of ['overview','dictionary','safety','papers','games'])
    assert.ok(html.includes('href="index.html#/'+route+'"'), 'Missing workspace destination: '+route);
  assert.ok(html.includes('65.7 ms is OS boot, not the complete first detection'));
  assert.ok(html.includes('Publisher measurements and derived ratios'));
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
  assert.ok(html.includes('Automatic collection remains off.'));
  assert.ok(html.includes('id="loading-status" role="status"'));
});
