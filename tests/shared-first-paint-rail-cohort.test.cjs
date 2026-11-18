'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const manifest = JSON.parse(read('terms/manifest.json'));
const links = html => {
  const chunk = html.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(chunk, 'canonical navigation links present');
  return [...chunk.matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map(m => m[1]);
};

test('concept references through MLD-1005 share Discover first-paint rail without scripts', () => {
  assert.match(read('scripts/build_term_pages.py'), /int\(path\[10:14\]\) <= 1005/,
    'deterministic reference builder must preserve the migrated cohort');
  const technology = read('technology/TECH-0216-pytorch.html');
  assert.ok(read('index.html').includes('class="sidebar-bottom"'),
    'Discover exposes reference sidebar bottom');
  const expectedLabels = links(technology);
  assert.equal(expectedLabels.length, 7);
  for (let i = 454; i <= 1005; i++) {
    const id = 'MLD-' + String(i).padStart(4, '0');
    const entry = manifest[id];
    assert.ok(entry, id + ' retains its stable route');
    const html = read(entry.path);
    const digest = crypto.createHash('sha256').update(Buffer.from(html, 'utf8')).digest('hex');
    assert.equal(digest, entry.sha256, id + ' must match integrity ledger');
    const rail = html.match(/<nav class="site-chrome term-nav"[^>]*>([\s\S]*?)<\/nav><main class="term-shell">/)?.[1];
    assert.ok(rail, id + ' has a single global nav outside its main landmark');
    assert.equal((rail.match(/sidebar-bottom site-chrome__bottom/g) || []).length, 1, id);
    assert.ok(rail.includes('href="../index.html#/sources"'), id);
    assert.deepEqual(links(html), expectedLabels, id + ' has canonical Discover link order');
    assert.ok(rail.includes('aria-current="page"'), id);
    assert.equal((html.match(/<main\b/g) || []).length, 1, id);
    assert.equal((html.match(/<footer\b/g) || []).length, 1, id);
    assert.ok(html.includes('<a class="skip" href="#main">'), id);
    assert.ok(html.includes('href="../index.html#/search"'), id);
  }
  const next = manifest['MLD-1006'];
  assert.ok(next, 'next stable concept ID remains indexed');
  const untouched = read(next.path);
  assert.doesNotMatch(untouched, /sidebar-bottom site-chrome__bottom/,
    'the next concept remains outside this bounded first-paint migration');
  assert.equal(crypto.createHash('sha256').update(untouched, 'utf8').digest('hex'),
    next.sha256, 'unmigrated page retains its prior integrity hash');
});
