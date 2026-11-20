'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('all native mobile menus receive one shared accessible page-aware name', () => {
  const theme = read('site-theme.js');
  assert.match(theme, /mobileToggle\.setAttribute\('aria-label', 'Toggle navigation · ' \+ label\)/);
  assert.match(theme, /const label = chrome\.dataset\.pageLabel \|\| active\?/);
  for (const page of [
    'research.html', 'playbooks.html', 'games.html', 'whats-new.html',
    'terms/index.html', 'technology/TECH-0216-pytorch.html',
    'terms/MLD-1345-zero-shot-prompting.html'
  ]) {
    const html = read(page);
    assert.match(html, /class="[^"]*site-mobile-chrome[^"]*"[^>]*data-page-label="[^"]+"/, page);
    assert.match(html, /site-mobile-chrome__nav/, page);
  }
});

test('offline demo embeds the exact shared mobile menu accessibility behavior', () => {
  const html = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(html.includes("mobileToggle.setAttribute('aria-label', 'Toggle navigation · ' + label)"));
});
