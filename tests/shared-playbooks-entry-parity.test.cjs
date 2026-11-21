'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Discover field-guide Playbooks link uses the canonical destination in shared navigation', () => {
  const live = read('index.html');
  assert.match(live, /<a class="nav-link" data-view="playbooks" href="playbooks\.html"/);
  const link = live.match(/<a href="([^"]+)"><span>Practical playbooks<\/span>/);
  assert.ok(link, 'Discover must offer the existing field-guide Playbooks entry');
  assert.equal(link[1], 'playbooks.html',
    'The content CTA must not silently open a different SPA page family');
  assert.doesNotMatch(live, /href="#\/playbooks"><span>Practical playbooks<\/span>/);
});

test('the offline single-file demo retains its bundled Playbooks route', () => {
  const demo = read('downloads/Atlas_Demo_Offline.html');
  assert.match(demo, /href="#\/playbooks"><span>Practical playbooks<\/span>/,
    'Never send offline users to an unbundled playbooks.html file');
  const builder = read('scripts/build_offline.py');
  assert.match(builder, /html = html\.replace\('href="playbooks\.html"', 'href="#\/playbooks"'\)/,
    'Offline generation must translate online Playbooks destinations to the bundled SPA');
  assert.match(read('app.js'), /"playbooks":"Playbooks"/,
    'Preserve the offline and legacy direct-hash Playbooks view');
});
