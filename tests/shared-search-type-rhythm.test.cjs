'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('shared native desktop search uses Discover typography and keeps the iOS-safe mobile scale', () => {
  const css = read('site-chrome.css');
  const discover = read('brand.css');
  assert.ok(discover.includes('.global-search input{font-size:12px}'),
    'Discover remains the desktop visual reference');
  const block = css.split('/* atlas-unified-desktop-search-type:begin */')[1]
    ?.split('/* atlas-unified-desktop-search-type:end */')[0];
  assert.ok(block, 'one shared desktop search type rule');
  assert.match(block, /@media \(min-width:651px\)/);
  assert.match(block, /\.site-mobile-chrome__search-form \.site-mobile-chrome__search-input\{font-size:12px\}/);
  assert.match(css, /\.site-mobile-chrome__search-form \.site-mobile-chrome__search-input\{[^}]*font-size:16px/s,
    'keep 16px for mobile Safari rather than triggering input zoom');
});

test('real search component is reused across editorial, Games, research, and reference pages', () => {
  const script = read('site-theme.js');
  assert.ok(script.includes("form.setAttribute('role', 'search')"));
  for (const file of ['whats-new.html', 'research.html', 'playbooks.html',
                      'games.html', 'technology/index.html']) {
    const html = read(file);
    assert.ok(html.includes('site-mobile-chrome__search'), file);
    assert.match(html, /href="(?:\.\.\/)?index\.html#\/search"/, file);
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(read('site-chrome.css')),
    'offline package embeds the exact normalized shared stylesheet');
});
