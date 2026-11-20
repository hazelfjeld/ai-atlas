'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const script = read('site-theme.js');
const start = script.indexOf('function focusSharedDesktopRail() {');
const stop = script.indexOf('\n// Close a native shared drawer', start);
assert.ok(start >= 0 && stop > start, 'shared focus implementation available');
const exercise = script.slice(start, stop) + '\nfocusSharedDesktopRail();';

function node(id, seen, visible = true) {
  return {
    focus(options) {
      assert.equal(options.preventScroll, true);
      seen.push(id);
    },
    getClientRects: () => visible ? [{}] : [],
    closest: () => null,
  };
}
function run(selectors) {
  vm.runInNewContext(exercise, {
    document: { querySelector: key => selectors[key] || null },
  });
}

test('responsive keyboard focus respects a collapsed native secondary disclosure', () => {
  const seen = [], link = node('hidden-current', seen, false);
  const summary = node('visible-more-summary', seen);
  link.closest = selector => {
    assert.match(selector, /site-chrome__more:not\(\[open\]\)/);
    return { querySelector: key => key === ':scope > summary' ? summary : null };
  };
  run({
    '.site-chrome__more a[aria-current]': link,
    '.site-chrome__brand': node('brand', seen),
  });
  assert.deepEqual(seen, ['visible-more-summary'],
    'do not focus an invisible aria-current link or reopen user-collapsed More');
});

test('responsive keyboard focus preserves expanded native secondary link', () => {
  const seen = [], link = node('active-current', seen);
  run({
    '.site-chrome__more a[aria-current]': link,
    '.site-chrome__brand': node('brand', seen),
  });
  assert.deepEqual(seen, ['active-current']);
});

test('Discover secondary navigation follows the same collapsed focus policy', () => {
  const seen = [], link = node('hidden-discover-current', seen, false);
  const summary = node('discover-more-summary', seen);
  link.closest = selector => {
    assert.match(selector, /additional-navigation:not\(\[open\]\)/);
    return { querySelector: () => summary };
  };
  run({
    '#navigation a[aria-current]': link,
    '#sidebar .brand': node('discover-brand', seen),
  });
  assert.deepEqual(seen, ['discover-more-summary']);
});

test('hidden or absent current rail link falls back to a visible brand', () => {
  const seen = [];
  run({
    '.site-chrome__more a[aria-current]': node('hidden', seen, false),
    '.site-chrome__brand': node('visible-brand', seen),
  });
  assert.deepEqual(seen, ['visible-brand']);
  seen.length = 0;
  run({ '#sidebar .brand': node('discover-brand', seen) });
  assert.deepEqual(seen, ['discover-brand']);
});

test('browser handoff and offline demo retain the shared responsive focus fix', () => {
  const browser = read('tests/site-deployment-browser.py');
  assert.match(browser, /closed desktop More preserves visible focus/);
  for (const page of ['research.html','demo.html','terms/index.html']) {
    const html=read(page);
    assert.match(html, /details class="site-chrome__more" open/);
    assert.match(html, /aria-current="location"/);
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(script),
    'offline fallback embeds the exact updated shared script');
});
