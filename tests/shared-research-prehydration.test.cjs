'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const script = read('site-theme.js');
const block = script.split('/* atlas-native-research-prehydration:begin */')[1]
  ?.split('/* atlas-native-research-prehydration:end */')[0];

function run(initialHash) {
  const labels = [['papers', 'Research library'], ['alerts', 'Safety observatory'],
    ['coverage', 'Publication progress']];
  const views = labels.map(([key, label]) => ({
    dataset: {nav: key}, firstChild: {textContent: label + ' '},
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    removeAttribute(k) { this.attributes.delete(k); }
  }));
  const makeRail = () => labels.slice(0, 2).map(([, label]) => ({
    textContent: label, attributes: new Map([['aria-current',
      label === 'Research library' ? 'location' : '']]),
    setAttribute(k, v) { this.attributes.set(k, v); },
    removeAttribute(k) { this.attributes.delete(k); }
  }));
  const rails = [makeRail(), makeRail()];
  const title = {textContent: 'Research library'};
  const toggle = {attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); }};
  const chrome = {dataset: {pageLabel: 'Research library'},
    attributes: new Map(),
    setAttribute(k, v) { this.attributes.set(k, v); },
    querySelector(selector) {
      if (selector === '.site-mobile-chrome__title') return title;
      if (selector === 'details.site-mobile-chrome__nav > summary') return toggle;
      assert.fail('Unexpected mobile query: ' + selector);
    }};
  const local = {querySelectorAll(selector) {
    assert.equal(selector, 'a[data-nav]');
    return views;
  }};
  let ready;
  let onHash;
  const window = {location: {hash: initialHash}, addEventListener(event, fn) {
    assert.equal(event, 'hashchange');
    onHash = fn;
  }};
  const document = {
    addEventListener(event, fn) { assert.equal(event, 'DOMContentLoaded'); ready = fn; },
    querySelector(selector) {
      return {'.research-local-nav': local, '.research-mobile-topbar': chrome,
        '.site-chrome.research-site-chrome': {}}[selector] || null;
    },
    querySelectorAll(selector) {
      assert.match(selector, /research-site-chrome/);
      assert.match(selector, /research-mobile-topbar/);
      return rails.flat();
    }
  };
  assert.ok(block, 'shared research prehydration block must exist');
  vm.runInNewContext(block, {document, window});
  assert.equal(typeof ready, 'function');
  ready();
  return {views, rails, title, toggle, chrome, window,
    next(hash) { window.location.hash = hash; onHash(); }};
}
function check(state, title, selected, parent) {
  assert.equal(state.title.textContent, title);
  assert.equal(state.chrome.dataset.pageLabel, title);
  assert.equal(state.chrome.attributes.get('aria-label'), 'AI Updates mobile header · ' + title);
  assert.equal(state.toggle.attributes.get('aria-label'), 'Toggle navigation · ' + title);
  assert.deepEqual(state.views.filter(v => v.attributes.get('aria-current') === 'page')
    .map(v => v.dataset.nav), [selected]);
  for (const rail of state.rails)
    assert.deepEqual(rail.filter(v => v.attributes.get('aria-current') === 'location')
      .map(v => v.textContent), [parent]);
}

test('Research primary and Safety views use the same first-paint shared rails', () => {
  const research = run('#papers');
  check(research, 'Research library', 'papers', 'Research library');
  const safety = run('#alerts?topic=alignment');
  check(safety, 'Safety observatory', 'alerts', 'Safety observatory');
  const coverage = run('#/coverage');
  check(coverage, 'Publication progress', 'coverage', 'Research library');
});

test('Research hash navigation updates both rails immediately and resets unknown routes', () => {
  const state = run('#papers');
  state.next('#alerts');
  check(state, 'Safety observatory', 'alerts', 'Safety observatory');
  state.next('#coverage');
  check(state, 'Publication progress', 'coverage', 'Research library');
  state.next('#something-else');
  check(state, 'Research library', 'papers', 'Research library');
});

test('first-paint fix reuses native routes, survives offline and adds no header', () => {
  const research = read('research.html');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes('/* atlas-native-research-prehydration:begin */' +
    block + '/* atlas-native-research-prehydration:end */'));
  assert.equal(script.split('/* atlas-native-research-prehydration:begin */').length - 1, 1);
  assert.equal(script.split("chrome.setAttribute('aria-label', 'AI Updates mobile header · ' + label);").length - 1, 2,
    'Research and all native page families must share contextual mobile header labels');
  assert.equal((research.match(/class="research-mobile-topbar site-mobile-chrome"/g) || []).length, 1);
  assert.equal((research.match(/class="site-chrome research-site-chrome"/g) || []).length, 1);
  for (const key of ['papers', 'alerts', 'coverage'])
    assert.ok(research.includes('data-nav="' + key + '"'));
  assert.ok(read('checkpoint.js').includes("window.addEventListener('hashchange', route)"),
    'Keep the real Research search/filter routes operational after hydration');
});
