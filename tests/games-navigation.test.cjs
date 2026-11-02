'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Games link survives dynamic workspace navigation rendering', () => {
  const html = read('index.html');
  assert.match(html, /<nav id="navigation"[^>]*><\/nav><nav aria-label="Practice">/);
  assert.equal((html.match(/data-atlas-games="true"/g) || []).length, 1);
  assert.match(html, /href="games\.html" data-atlas-games="true"/);
});

test('Game route uses the original shared catalog and concept-path helpers', () => {
  const html = read('games.html');
  for (const file of ['catalog-loader.js', 'core.js', 'games-core.js', 'games.js']) {
    assert.ok(html.includes('src="' + file + '"'));
    assert.ok(fs.existsSync(path.join(__dirname, '..', file)));
  }
  assert.ok(read('games.js').includes('await window.ATLAS_READY'));
  assert.ok(read('games.js').includes('C.termPath(r)'));
});

test('Offline fallback labels Games online and uses a public absolute link', () => {
  const html = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(html.includes('href="https://raw.githack.com/hazelfjeld/ai-atlas/main/games.html"'));
  assert.ok(html.includes('<span>Games (online)</span>'));
  assert.ok(!html.includes('href="games.html"'));
});
