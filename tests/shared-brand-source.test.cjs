'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const generated = spawnSync('python3', ['-c',
  'import json; from scripts.site_chrome import render_brand, render_discover_brand; print(json.dumps([render_discover_brand(), render_brand(""), render_brand("../")]))'],
  {cwd: root, encoding:'utf8'});
assert.equal(generated.status, 0, generated.stderr);
const [discover, nativeRoot, nativeNested] = JSON.parse(generated.stdout);
function anchor(html, cls) {
  const pos = html.indexOf('<a class="' + cls + '"');
  assert.ok(pos >= 0, 'Missing ' + cls);
  const end = html.indexOf('</a>', pos);
  assert.ok(end > pos);
  return html.slice(pos, end + 4);
}
test('Discover, editorial pages and references use one generated wordmark/mark', () => {
  const source = read('scripts/site_chrome.py');
  assert.match(source, /BRAND_SVG =/);
  assert.match(source, /html = before_brand \+ render_discover_brand\(\)/);
  assert.equal(anchor(read('index.html'), 'brand'), discover);
  assert.equal(anchor(read('research.html'), 'site-chrome__brand'), nativeRoot);
  assert.equal(anchor(read('technology/TECH-0149-llamaindex.html'), 'site-chrome__brand'), nativeNested);
  assert.equal(anchor(read('terms/MLD-0001-a-b-test.html'), 'site-chrome__brand'), nativeNested);
  const svg = /<svg[\s\S]*?<\/svg>/;
  assert.equal(discover.match(svg)?.[0], nativeRoot.match(svg)?.[0]);
  assert.equal(discover.match(svg)?.[0], nativeNested.match(svg)?.[0]);
});
test('reference logos and offline demo preserve one two-stroke mark in both themes', () => {
  const shared = read('site-chrome.css');
  assert.match(shared, /:is\(\.brandmark,\.site-chrome__brand,\.site-mobile-chrome__brand\) svg path\{stroke-width:2\}/);
  const reference = anchor(read('terms/MLD-0001-a-b-test.html'), 'site-chrome__brand');
  assert.match(reference, /stroke-linecap="round" stroke-width="2"\/><\/svg>/,
    'Preserve the exact canonical two-stroke SVG on immutable detail pages');
  for (const output of [discover, nativeRoot, nativeNested]) {
    assert.equal((output.match(/<svg/g) || []).length, 1);
    assert.match(output, /AI Updates<small>THE FRONTIER, IN CONTEXT<\/small>/);
  }
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.equal(anchor(offline, 'brand'), discover);
  assert.ok(offline.includes(shared), 'offline must embed exact shared CSS');
  assert.match(discover, /href="#\/overview"/);
  assert.match(nativeRoot, /href="index.html#\/overview"/);
  assert.match(nativeNested, /href="\.\.\/index.html#\/overview"/);
});
