'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('one progressive search component preserves every native no-JavaScript route', () => {
  const script=read('site-theme.js');
  assert.match(script,/querySelectorAll\('a\.site-mobile-chrome__search\[href\]'\)/);
  assert.match(script,/form\.setAttribute\('role', 'search'\)/);
  assert.match(script,/field\.type = 'search'/);
  assert.match(script,/field\.setAttribute\('aria-label', 'Search AI Updates'\)/);
  assert.match(script,/window\.location\.assign\(route \+ \(query \? '\?q=' \+ encodeURIComponent\(query\) : ''\)\)/);
  assert.match(script,/inline\.focus\(\{preventScroll:true\}\)/);
  for(const route of ['whats-new.html','research.html','playbooks.html','games.html',
    'about.html','terms/MLD-0002-ablation-study.html','technology/TECH-0216-pytorch.html']){
    const html=read(route),prefix=route.includes('/')?'../':'';
    assert.ok(html.includes('site-mobile-chrome__search'),route+': shared component');
    assert.ok(html.includes('href="'+prefix+'index.html#/search"'),
      route+': genuine script-free search link');
  }
});

test('live native search stays level with the 44px mobile menu without shrinking submit', () => {
  const css=read('site-chrome.css');
  assert.match(css,/\.site-mobile-chrome__search-submit\s*\{[^}]*min-height:36px/s);
  assert.match(css,/body:has\(\.site-chrome\) \.site-mobile-chrome__search\.site-mobile-chrome__search-form\s*\{\s*padding-block:3px;/);
  // Older hardware review loads checkpoint.css, whose generic input min-height
  // would otherwise expand the shared live field past the 44px header row.
  assert.match(css,/\.site-mobile-chrome__search-form \.site-mobile-chrome__search-input\s*\{[^}]*min-height:0;/s);
  // 36px button + 3px top/bottom + 1px border top/bottom = 44px.
  // Full browser integration also checks top-edge alignment on review pages.
});

test('shared search styling and single-file demo reproduce the exact sources', () => {
  const css=read('site-chrome.css'),script=read('site-theme.js');
  assert.match(css,/\.site-mobile-chrome__search-form:focus-within/);
  assert.match(css,/\.site-mobile-chrome__search-input::placeholder/);
  assert.match(css,/font-size:16px/);
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(css),'offline exact shared CSS');
  assert.ok(offline.includes(script),'offline exact shared JS');
});

test('Discover and native page families share a truthful desktop search-key hint', () => {
  const script=read('site-theme.js'), css=read('site-chrome.css');
  const discover=read('index.html');
  assert.match(discover, /<form class="global-search"[\s\S]*?<kbd>\/<\/kbd>/);
  assert.match(script, /hint\.className = 'site-mobile-chrome__search-hint'/);
  assert.match(script, /hint\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(script, /form\.append\(field, hint, submit\)/,
    'retain the real native submit handler, without adding a second form');
  const shared=css.split('/* atlas-shared-search-key-hint:begin */')[1]
    ?.split('/* atlas-shared-search-key-hint:end */')[0];
  assert.ok(shared, 'shared desktop and mobile hint contract exists');
  assert.match(shared, /:is\(\.global-search > kbd, \.site-mobile-chrome__search-hint\)/);
  assert.match(shared, /@media \(max-width:650px\)/);
  assert.match(shared, /\.site-mobile-chrome__search-hint\{display:none\}/);
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(css) && offline.includes(script),
    'single-file offline fallback reproduces the exact shared desktop affordance');
});
