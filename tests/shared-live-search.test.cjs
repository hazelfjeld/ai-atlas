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

test('shared search styling and single-file demo reproduce the exact sources', () => {
  const css=read('site-chrome.css'),script=read('site-theme.js');
  assert.match(css,/\.site-mobile-chrome__search-form:focus-within/);
  assert.match(css,/\.site-mobile-chrome__search-input::placeholder/);
  assert.match(css,/font-size:16px/);
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(css),'offline exact shared CSS');
  assert.ok(offline.includes(script),'offline exact shared JS');
});
