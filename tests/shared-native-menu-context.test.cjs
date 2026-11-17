'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Discover announces the active workspace after hash navigation. Native
// workspaces must offer equivalent context before hydration and without JS.
const workspaces = {
  'demo.html': 'Guided demo',
  'research.html': 'Research library',
  'catalog-review.html': 'Catalog review',
  'hardware-review.html': 'Hardware evidence',
  'games.html': 'Games',
  'technologies.html': 'Technology profiles',
  'playbooks.html': 'Playbooks',
  'whats-new.html': 'What’s New Today',
};

test('shared native mobile navigation announces its workspace without JavaScript', () => {
  const discover = read('app.js');
  assert.match(discover, /'Toggle navigation · '\s*\+\s*currentName/);
  for (const [route, title] of Object.entries(workspaces)) {
    const html = read(route);
    const toggles = [...html.matchAll(/<summary class="[^"]*site-mobile-chrome__toggle" aria-label="([^"]+)"/g)];
    assert.equal(toggles.length, 1, route + ': one shared mobile toggle');
    assert.equal(toggles[0][1], 'Toggle navigation · ' + title,
      route + ': announces the current workspace before hydration');
    assert.match(html, /<nav class="site-chrome [^"]+" aria-label="AI Updates primary navigation">/,
      route + ': desktop primary landmark remains');
    assert.match(html, /href="index.html#\/search"/,
      route + ': no-JavaScript search route remains usable');
    assert.equal((html.match(/<details class="[^"]*site-mobile-chrome__nav"/g) || []).length, 1,
      route + ': exactly one native mobile navigation drawer');
  }
});

test('shared build-time menu normalization remains idempotent', () => {
  const check = [
    'import sys',
    'from pathlib import Path',
    'sys.path.insert(0, "scripts")',
    'from site_chrome import normalize_standalone_chrome',
    'for p in ' + JSON.stringify(Object.keys(workspaces)) + ':',
    '    html = Path(p).read_text(encoding="utf-8")',
    '    assert normalize_standalone_chrome(html, p) == html, p',
  ].join('\n');
  execFileSync('python3', ['-c', check], {cwd: root, stdio: 'pipe'});
});
