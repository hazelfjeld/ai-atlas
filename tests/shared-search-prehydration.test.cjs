'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const script = read('site-theme.js');
const shared = script.split('/* atlas-shared-search-submit:begin */')[1]
  ?.split('/* atlas-shared-search-submit:end */')[0];
assert.ok(shared, 'shared early search handler must be present');

function submit({route, query, hash = '#/overview'}) {
  let handler, dispatches = 0, remembers = 0, destination;
  const location = {hash, assign(value) { destination = value; }};
  const document = {addEventListener(name, callback) {
    assert.equal(name, 'submit');
    handler = callback;
  }};
  const context = {document, window: {
    location, dispatchEvent(event) {
      assert.equal(event.type, 'hashchange');
      dispatches += 1;
    }
  }, Event: class Event {constructor(type) {this.type = type;}},
  rememberSearchFocus() {remembers += 1;}, encodeURIComponent};
  vm.runInNewContext(shared, context);
  const form = {dataset: route ? {searchRoute: route} : {},
    matches(selector) {
      assert.equal(selector, '#global-search, form.site-mobile-chrome__search-form');
      return true;
    },
    querySelector(selector) {
      assert.equal(selector, 'input[type="search"]');
      return {value: query};
    }};
  let prevented = false;
  handler({target: form, preventDefault() {prevented = true;}});
  return {hash: location.hash, destination, dispatches, remembers, prevented};
}

test('Discover search before catalog hydration uses a real hash route without reload', () => {
  assert.deepEqual(submit({query:'  first principles & safety  '}), {
    hash:'#/search?q=first%20principles%20%26%20safety',
    destination:undefined, dispatches:0, remembers:0, prevented:true
  });
});

test('repeating a query refreshes existing hydrated results', () => {
  assert.deepEqual(submit({query:'focus', hash:'#/search?q=focus'}), {
    hash:'#/search?q=focus', destination:undefined,
    dispatches:1, remembers:0, prevented:true
  });
});

test('native and nested reference searches keep canonical relative destinations', () => {
  assert.deepEqual(submit({route:'../index.html#/search',query:'  LoRA test  '}), {
    hash:'#/overview', destination:'../index.html#/search?q=LoRA%20test',
    dispatches:0, remembers:1, prevented:true
  });
});

test('one shared source controls live and offline search with no duplicate handlers', () => {
  assert.equal((script.match(/document\.addEventListener\('submit'/g) || []).length, 1);
  assert.doesNotMatch(read('app.js'), /\$\('global-search'\)\.addEventListener\('submit'/);
  assert.doesNotMatch(script, /form\.addEventListener\('submit'/);
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(script), 'offline includes exact shared behavior');
  assert.ok(offline.includes(read('app.js').slice(0, 3000)),
    'offline retains the hydrated app source prefix');
});


test('early cross-page search reveals a readable status instead of an empty workspace', () => {
  const css = read('site-chrome.css');
  const section = css.split('/* atlas-discover-first-paint:begin */')[1]
    ?.split('/* atlas-discover-first-paint:end */')[0];
  assert.ok(section, 'the shared Discover first-paint contract must exist');
  assert.match(section, /#catalog-loading\{display:none\}/,
    'the script-free featured Discover cards are not displaced by loading');
  assert.match(section, /html\.atlas-enhanced #main:has\(> #page:empty\) > #catalog-loading\{/,
    'show the real status only when prehydration has removed the old teaser');
  assert.match(section, /clip-path:none/);
  assert.match(section, /min-height:min\(36vh,320px\)/);
  assert.ok(read('index.html').includes('id="catalog-loading" class="catalog-loading" role="status"'));
  assert.ok(read('site-theme.js').includes('page.replaceChildren()'),
    'native cross-page routes clear the static Discover teaser before hydration');
  const offline=read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(section),
    'single-file offline uses identical shared status styling');
});
