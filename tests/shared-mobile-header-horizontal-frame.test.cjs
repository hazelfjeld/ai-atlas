'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('one Discover-aligned mobile header origin across native and Games page families', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-unified-mobile-header-horizontal-frame:begin */')[1]
    ?.split('/* atlas-unified-mobile-header-horizontal-frame:end */')[0];
  assert.ok(block, 'shared mobile chrome frame exists once');
  assert.equal(css.split('/* atlas-unified-mobile-header-horizontal-frame:begin */').length - 1, 1);
  assert.match(block, /@media \(max-width:650px\)/);
  assert.match(block, /--atlas-mobile-header-gutter:18px/);
  assert.match(block, /\.topbar:has\(\.discover-mobile-chrome\)\{padding-inline:var\(--atlas-mobile-header-gutter\)\}/);
  assert.match(block, /body:has\(\.site-chrome\) \.site-mobile-chrome:not\(\.discover-mobile-chrome\)\{[\s\S]*?padding-inline:var\(--atlas-mobile-header-gutter\)!important/);
  assert.match(block, /\.games-header__inner\{[\s\S]*?padding-inline:var\(--atlas-mobile-header-gutter\)!important/);
  assert.match(block, /\.games-header \.site-mobile-chrome\{[\s\S]*?padding-inline:0!important/,
    'Games uses only the containing header gutter instead of double-padding the controls');
  for (const page of ['index.html', 'whats-new.html', 'research.html', 'playbooks.html',
                      'games.html', 'technology/index.html', 'terms/index.html',
                      'catalog-review.html', 'hardware-review.html']) {
    const html = read(page);
    assert.equal((html.match(/class="[^"]*site-mobile-chrome__nav/g) || []).length, 1,
      page + ': exactly one shared mobile menu');
    assert.ok(html.includes('site-mobile-chrome__search'), page + ': a real site search entry');
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'offline single-file demo embeds the identical site-wide header styles');
});
