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


/* One shared pointer/keyboard dismissal policy for native and Discover rails. */
const helperStart = script.indexOf('function dismissInactiveDesktopMore(');
const helperEnd = script.indexOf("\\ndocument.addEventListener('pointerdown'", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
const sharedDismissSource = script.slice(helperStart, helperEnd);
assert.match(script, /document\\.addEventListener\\('focusin', event => \\{\\s*dismissInactiveDesktopMore\\(event\\.target\\)/);
const outsideBlock = script.split('/* atlas-shared-desktop-more-dismiss:begin */')[1]
  ?.split('/* atlas-shared-desktop-more-dismiss:end */')[0];
function exerciseOutsideDismiss(width, active = 'article') {
  assert.ok(outsideBlock, 'shared desktop dropdown dismissal exists');
  let pointer;
  const focused = [];
  const menu = name => {
    const result = {
      open: true,
      contains(target) { return target === this || target?.inside === this; },
      querySelector(selector) {
        if (selector === '.site-chrome__more-links a[aria-current], .nav-more-links a[aria-current]')
          return this.hasCurrent ? {} : null;
        assert.equal(selector, ':scope > summary');
        return {focus(options) {
          assert.equal(options.preventScroll, true);
          focused.push(name);
        }};
      },
    };
    return result;
  };
  const discover = menu('Discover'), native = menu('native');
  const doc = {
    activeElement: active === 'native' ? {inside:native} :
      active === 'Discover' ? {inside:discover} : {},
    addEventListener(type, listener) {
      assert.equal(type, 'pointerdown');
      pointer = listener;
    },
    querySelectorAll(selector) {
      assert.equal(selector, 'details.site-chrome__more[open], details#additional-navigation[open]');
      return [discover, native].filter(x => x.open);
    },
  };
  const events = vm.runInNewContext(sharedDismissSource +
    '\n({ pointer:(event)=>{' + outsideBlock + '\n}, keyboard:(event)=>dismissInactiveDesktopMore(event.target) })',
    {window:{innerWidth:width},document:doc});
  pointer = events.pointer;
  assert.equal(typeof pointer, 'function');
  return {discover, native, focused, pointer, keyboard:events.keyboard};
}
test('outside pointer closes shared desktop More without blocking the destination', () => {
  const state = exerciseOutsideDismiss(1280);
  const event = {target:{}, defaultPrevented:false};
  state.pointer(event);
  assert.equal(state.discover.open, false);
  assert.equal(state.native.open, false);
  assert.deepEqual(state.focused, []);
  assert.equal(event.defaultPrevented, false);
});
test('inside pointer preserves its disclosure, outside then restores prior keyboard focus', () => {
  const state = exerciseOutsideDismiss(960, 'native');
  state.pointer({target:{inside:state.native}});
  assert.equal(state.native.open, true);
  assert.equal(state.discover.open, false);
  assert.deepEqual(state.focused, []);
  state.pointer({target:{}});
  assert.equal(state.native.open, false);
  assert.deepEqual(state.focused, ['native']);
});
test('mobile and no-JavaScript navigation remain intact with offline parity', () => {
  const state = exerciseOutsideDismiss(390, 'Discover');
  state.pointer({target:{}});
  assert.equal(state.discover.open, true);
  assert.equal(state.native.open, true);
  assert.deepEqual(state.focused, []);
  for (const page of ['index.html','research.html','whats-new.html','terms/index.html'])
    assert.match(read(page), /More sections/, 'script-free secondary links: ' + page);
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(script),
    'offline standalone embeds the exact current shared script');
});

test('active secondary destination remains visible on outside desktop content interaction', () => {
  const state = exerciseOutsideDismiss(1280, 'article');
  state.native.hasCurrent = true;
  state.pointer({target:{}});
  assert.equal(state.native.open, true, 'Research active section cannot disappear behind closed More');
  assert.equal(state.discover.open, false, 'inactive Discover More can still dismiss');
  state.native.hasCurrent = false;
  state.pointer({target:{}});
  assert.equal(state.native.open, false, 'inactive secondary disclosure dismisses normally');
});

test('keyboard focus leaving native and Discover More closes only inactive desktop disclosures', () => {
  const state = exerciseOutsideDismiss(1280);
  state.keyboard({target:{inside:state.native}});
  assert.equal(state.native.open, true, 'focus within a disclosure must retain it');
  assert.equal(state.discover.open, false, 'other inactive disclosure is dismissed');
  state.keyboard({target:{}});
  assert.equal(state.native.open, false, 'Tabbing to workspace content dismisses inactive More');
  assert.deepEqual(state.focused, [], 'focus stays on the newly focused destination');
});
test('keyboard focus preserves active secondary section and script-free/mobile behavior', () => {
  const desktop = exerciseOutsideDismiss(1280);
  desktop.native.hasCurrent = true;
  desktop.keyboard({target:{}});
  assert.equal(desktop.native.open, true, 'current secondary section stays revealed');
  assert.equal(desktop.discover.open, false);
  const mobile = exerciseOutsideDismiss(390);
  mobile.keyboard({target:{}});
  assert.equal(mobile.native.open, true);
  assert.equal(mobile.discover.open, true);
});
