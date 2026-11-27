'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const shared = read('site-theme.js');
const resize = shared.slice(shared.indexOf('let lastDesktopRailFocus = null;'), shared.indexOf('// Restore a saved appearance'));
function simulate({hidden = true, fieldVisible = true, other = false, previous = 390, width = 768, drawer = false, search = true} = {}) {
  const listeners = {}, body = {}, root = {}, focused = [];
  const document = {body, documentElement: root, activeElement: body,
    addEventListener: (key, fn) => {listeners[key] = fn;},
    querySelector: selector => selector.includes('[open]') && drawer ? {} : null};
  const window = {innerWidth: previous, addEventListener: (key, fn) => {listeners[key] = fn;}};
  const field = {getClientRects: () => fieldVisible ? [1] : [], focus: () => focused.push('input')};
  const target = {getClientRects: () => hidden ? [] : [1],
    matches: selector => search && selector.includes('#global-query'),
    closest: selector => selector === 'form' ? {querySelector: () => field} : null};
  vm.runInNewContext(resize, {document, window, normalizeResearchEarlyLink: () => {},
    closeSharedDrawers: () => {}, syncSharedDrawerIsolation: () => {}, focusSharedDesktopRail: () => focused.push('rail')});
  listeners.focusin({target});
  document.activeElement = other ? {} : hidden ? body : target;
  window.innerWidth = width;
  listeners.resize();
  return focused;
}
test('responsive shared search returns focus to its visible real input or desktop rail', () => {
  assert.deepEqual(simulate(), ['input']);
  assert.deepEqual(simulate({fieldVisible:false}), ['rail']);
});
test('resize does not steal visible focus or compete with drawer restoration', () => {
  for (const options of [{hidden:false}, {other:true}, {drawer:true}, {search:false}, {width:320}, {previous:768, width:1280}])
    assert.deepEqual(simulate(options), []);
});
test('offline includes exact responsive shared search handler', () => {
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(shared));
});
