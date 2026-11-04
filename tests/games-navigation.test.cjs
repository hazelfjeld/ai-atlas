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
