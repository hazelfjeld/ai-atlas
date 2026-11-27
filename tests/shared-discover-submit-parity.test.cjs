'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Discover uses the native functional search-submit component once', () => {
  const index = read('index.html');
  const form = index.match(/<form class="global-search" id="global-search" role="search">[\s\S]*?<\/form>/);
  assert.ok(form, 'Discover must preserve the existing one real form');
  assert.match(form[0], /id="global-query" type="search"/);
  assert.match(form[0], /<kbd>\/<\/kbd><button type="submit" class="site-mobile-chrome__search-submit" aria-label="Submit search">↵<\/button>/);
  assert.equal((form[0].match(/type="submit"/g) || []).length, 1);
  assert.doesNotMatch(read('app.js'), /\$\('global-search'\)\.addEventListener\('submit'/);
  assert.match(read('site-theme.js'), /form\?\.matches\?\.\('#global-search, form\.site-mobile-chrome__search-form'\)/);
  assert.match(read('site-theme.js'), /submit.className = 'site-mobile-chrome__search-submit'/);
});

test('same real control is available at every width, hidden without JavaScript', () => {
  const css = read('site-chrome.css');
  assert.match(css, /\.global-search > \.site-mobile-chrome__search-submit\{display:none\}/);
  assert.match(css, /html\.atlas-enhanced \.topbar:has\(\.discover-mobile-chrome\) \.global-search > \.site-mobile-chrome__search-submit\{\s*display:grid;/);
  assert.match(css, /html\.atlas-enhanced \.topbar:has\(\.discover-mobile-chrome\) \.global-search\{[^}]*padding-block:3px;/s);
  assert.match(css, /\.site-mobile-chrome__search-submit\{[^}]*min-height:36px/s);
  assert.match(read('site-theme.js'), /classList\?\.add\('atlas-enhanced'\)/);
  const desktop = css.split('/* atlas-unified-desktop-workspace-bar:begin */')[1]
    ?.split('/* atlas-unified-desktop-workspace-bar:end */')[0];
  assert.ok(desktop);
  assert.match(desktop, /html\.atlas-enhanced \.app-shell \.topbar \.global-search > \.site-mobile-chrome__search-submit\{\s*display:grid;/);
  assert.match(desktop, /:is\(html\.atlas-enhanced \.app-shell \.topbar \.global-search,\s*body:has\(\.site-chrome\) \.site-mobile-chrome__search-form\)\{\s*padding-block:1px;/);
  assert.match(desktop, /\.app-shell \.topbar \.global-search > input\{\s*flex:1 1 auto;min-width:0;width:0;/);
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(css), 'single-file offline includes exact shared CSS');
  assert.ok(offline.includes('<kbd>/</kbd><button type="submit" class="site-mobile-chrome__search-submit" aria-label="Submit search">↵</button>'), 'single-file fallback preserves actual form control');
});
