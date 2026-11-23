'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const technologyDir = path.join(root, 'technology');
const profiles = fs.readdirSync(technologyDir)
  .filter(name => /^TECH-\d{4}-.*\.html$/.test(name));

test('every technology detail page has contextual script-free shared mobile navigation', () => {
  assert.equal(profiles.length, 303, 'All existing stable technology detail URLs are covered');
  for (const name of profiles) {
    const html = fs.readFileSync(path.join(technologyDir, name), 'utf8');
    const header = html.match(/<div class="directory-mobile-topbar site-mobile-chrome"[^>]*data-page-label="([^"]+)"/);
    assert.ok(header, name + ': shared mobile page title is missing');
    const summary = html.match(/<summary class="site-mobile-chrome__toggle" aria-label="([^"]+)"/);
    assert.ok(summary, name + ': missing native mobile menu disclosure');
    assert.equal(summary[1], 'Toggle navigation · ' + header[1], name);
    assert.equal((html.match(/<nav class="site-chrome term-nav"/g) || []).length, 1, name + ': duplicated desktop chrome');
    assert.equal((html.match(/<nav class="site-mobile-chrome__menu"/g) || []).length, 1, name + ': duplicated mobile menu');
  }
});
