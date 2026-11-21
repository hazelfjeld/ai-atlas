'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('one theme-aware mobile drawer appearance control across every existing page family', () => {
  const css = read('site-chrome.css');
  const block = css.match(/\.site-mobile-chrome__menu > \.site-chrome__theme-toggle\{([\s\S]*?)\}\s*\.site-mobile-chrome__menu > \.site-chrome__theme-toggle:hover\{([\s\S]*?)\}/);
  assert.ok(block, 'Existing shared mobile appearance control must remain');
  assert.match(block[1], /border:1px solid var\(--line,/);
  assert.match(block[1], /background:var\(--soft,/);
  assert.match(block[1], /color:var\(--ink,/);
  assert.match(block[2], /background:var\(--accent-soft,/);
  assert.match(block[2], /color:var\(--ink,/);
  assert.doesNotMatch(block[0], /#c5cfc6|#ffffff0c|#374b3c|#fff[;}]/i,
    'Do not reuse desktop dark-rail colors inside the light mobile drawer');
  const script = read('site-theme.js');
  assert.match(script, /button.className = 'site-chrome__theme-toggle'/);
  assert.match(script, /button.setAttribute\('aria-label', 'Toggle color theme'\)/);
  assert.match(script, /syncSharedThemeAction\(button, theme\)/);
  for (const page of ['index.html', 'research.html', 'whats-new.html',
    'playbooks.html', 'games.html', 'technology/index.html']) {
    assert.ok(read(page).includes('site-chrome.css'), page + ' loads shared component CSS');
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'Single-file fallback must embed exactly the same theme-aware shared stylesheet');
});
