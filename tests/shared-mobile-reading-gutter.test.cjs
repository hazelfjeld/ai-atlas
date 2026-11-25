'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('News and Catalog Review share one mobile reading gutter without stacking main padding', () => {
  const css = read('site-chrome.css');
  const shared = '.shell:has(> .site-chrome:is(.top,.nav))';
  const rule = '@media (max-width:650px){\n  ' + shared +
    '{padding-inline:20px}\n  ' + shared + ' > main{padding-inline:0}';
  assert.ok(css.includes(rule));
  assert.ok(css.includes('.shell:has(> .site-chrome.top) > .mobile-topbar{margin-inline:-20px;padding-inline:20px}'));
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css));
  assert.ok(read('whats-new.html').includes('href="catalog-review.html"'));
  assert.ok(read('catalog-review.html').includes('href="index.html#/overview"'));
  assert.ok(read('tests/site-deployment-browser.py').includes('Shared mobile reading gutter'));
});
