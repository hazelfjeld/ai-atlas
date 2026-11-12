'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = [
  'index.html', 'whats-new.html', 'research.html', 'playbooks.html',
  'technologies.html', 'games.html', 'about.html', 'terms/index.html',
  'technology/index.html', 'terms/MLD-0001-a-b-test.html',
  'technology/TECH-0001-adversarial-robustness-toolbox.html',
];

test('native skip destinations on existing families clear the sticky phone menu', () => {
  const css = fs.readFileSync(path.join(root, 'site-chrome.css'), 'utf8');
  assert.match(css, /\/\* atlas-mobile-skip-clearance:begin \*\//);
  assert.match(css, /@media\(max-width:650px\)\{\s*#main\{scroll-margin-top:80px\}/);
  for (const route of pages) {
    const html = fs.readFileSync(path.join(root, route), 'utf8');
    assert.equal((html.match(/href="#main"/g) || []).length, 1, route + ': native skip link');
    assert.equal((html.match(/id="main"/g) || []).length, 1, route + ': unique destination');
    assert.match(html, /id="main" tabindex="-1"/, route + ': keyboard-focusable content');
    assert.ok(html.includes('site-chrome.css'), route + ': shared stylesheet');
    assert.ok(html.includes('site-mobile-chrome'), route + ': existing mobile chrome');
  }
  const offline = fs.readFileSync(path.join(root, 'downloads/Atlas_Demo_Offline.html'), 'utf8');
  assert.ok(offline.includes(css), 'offline demo carries the exact updated shared CSS');
});
