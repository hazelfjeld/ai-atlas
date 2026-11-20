'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = filename => fs.readFileSync(path.resolve(__dirname,'..',filename),'utf8');

test('native Research, Technology and Playbooks controls respect the same light/dark preference as Discover', () => {
  for (const file of [
    'index.html','whats-new.html','games.html',
    'research.html','technologies.html','playbooks.html',
  ]) {
    const html = read(file);
    assert.equal((html.match(/<meta name="color-scheme" content="light dark">/g)||[]).length, 1,
      file + ' must advertise the same two supported native-widget appearances');
    assert.ok(!html.includes('<meta name="color-scheme" content="light">'),
      file + ' must not force light-only native controls on dark-theme visits');
  }
  const css = read('site-chrome.css');
  assert.match(css, /:root\[data-theme="light"\]\{color-scheme:light\}/);
  assert.match(css, /:root\[data-theme="dark"\]\{color-scheme:dark\}/);
});

test('the shared native chrome normalizer preserves the dual-mode metadata on rebuilds', () => {
  const generator = read('scripts/site_chrome.py');
  assert.match(generator, /def normalize_standalone_chrome\(html, path\):/);
  assert.ok(generator.includes("light_only = '<meta name=\"color-scheme\" content=\"light\">'"));
  assert.ok(generator.includes("dual_scheme = '<meta name=\"color-scheme\" content=\"light dark\">'"));
  assert.ok(generator.includes('normalized.replace(light_only, dual_scheme, 1)'));
  assert.ok(generator.includes('assert normalized.count(light_only) == 1, path'));
});
