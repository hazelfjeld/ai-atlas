'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

test('every authored concept guide uses the shared contextual script-free mobile toggle', () => {
  const manifest = JSON.parse(read('terms/manifest.json'));
  const guides = Object.entries(manifest).filter(([, entry]) => entry.expanded);
  assert.ok(guides.length >= 57, 'original authored guide set is preserved');
  for (const [id, entry] of guides) {
    const html = read(entry.path);
    const label = html.match(/<div class="directory-mobile-topbar site-mobile-chrome"[^>]*data-page-label="([^"]+)"/)?.[1];
    assert.ok(label, id + ': title is present before JavaScript');
    assert.equal(html.split('aria-label="Toggle navigation · ' + label + '"').length - 1, 1,
      id + ': the same title is announced by the keyboard toggle');
    assert.equal(html.split('<details class="site-mobile-chrome__nav"').length - 1, 1,
      id + ': one script-free disclosure');
    assert.ok(html.includes('href="../index.html#/search"'),
      id + ': original functional search route remains');
  }
});

test('the authored-guide renderer reuses the shared navigation generator', () => {
  const builder = read('scripts/build_term_pages.py');
  assert.ok(builder.includes("first_paint_context=(path == 'terms/index.html' or expanded_concept or\n                                      (first_paint_reference and int(path[10:14]) <= 400))"),
    'authored concept guides and landing share their prehydration title semantics');
  const chrome = read('scripts/site_chrome.py');
  assert.ok(chrome.includes("(' · ' + escape(topbar_title or page_label) if first_paint_context else '')"),
    'the same shared renderer escapes contextual labels');
});
