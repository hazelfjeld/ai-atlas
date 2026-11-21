'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'site-chrome.css'), 'utf8');
const start = '/* atlas-unified-desktop-workspace-bar:begin */';
const end = '/* atlas-unified-desktop-workspace-bar:end */';
const block = css.slice(css.indexOf(start), css.indexOf(end) + end.length);

test('Discover and native families share one real desktop workspace-bar contract', () => {
  assert.equal(css.split(start).length - 1, 1);
  assert.equal(css.split(end).length - 1, 1);
  assert.ok(block.startsWith(start));
  assert.match(block, /@media \(min-width:651px\)/);
  assert.match(block, /--atlas-workspace-bar-height:78px/);
  assert.match(block, /--atlas-workspace-bar-gutter:38px/);
  assert.match(block, /--atlas-workspace-bar-gutter:26px/);
  assert.match(block, /\.app-shell \.topbar,body:has\(\.site-chrome\) \.site-mobile-chrome/);
  assert.match(block, /background:var\(--atlas-workspace-bar-surface\)!important/);
  assert.match(block, /\.app-shell \.topbar #breadcrumb/);
  assert.match(block, /\.site-mobile-chrome__title/);
  assert.match(block, /\.site-mobile-chrome::before/);
  assert.match(block, /\.global-search,/);
  assert.match(block, /\.site-mobile-chrome__search/);
  assert.match(block, /prefers-color-scheme:dark/);
  assert.match(block, /:root\[data-theme="dark"\]/);
});

test('every site family consumes that header rather than a second page-specific bar', () => {
  const families = [
    'index.html', 'whats-new.html', 'research.html', 'playbooks.html',
    'games.html', 'technology/index.html', 'terms/index.html',
    'catalog-review.html', 'hardware-review.html', 'about.html',
  ];
  for (const file of families) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /href="(?:\.\.\/)?site-chrome\.css"/, file + ' must load the shared stylesheet');
    if (file === 'index.html') assert.match(html, /class="topbar"/);
    else assert.match(html, /site-mobile-chrome/, file + ' must keep its real mobile\/desktop search bar');
  }
});

test('single-file offline demonstration embeds the exact same shared-bar CSS', () => {
  const offline = fs.readFileSync(path.join(root, 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'offline fallback must embed the complete CSS in build order');
  assert.equal(offline.split(start).length - 1, 1);
});
