'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const script = read('site-theme.js');
const start = script.indexOf('function syncPrimaryThemeButton(theme) {');
const end = script.indexOf('\nfunction syncSharedStoredTheme(theme)', start);
assert.ok(start !== -1 && end > start, 'shared appearance synchronizer is present');
const isolated = script.slice(start, end);

function sync(theme, present = true) {
  const attributes = {};
  const button = {setAttribute(name, value) {attributes[name] = value;}};
  const document = {getElementById(id) {
    assert.equal(id, 'theme-toggle');
    return present ? button : null;
  }};
  vm.runInNewContext(isolated + '\nsyncPrimaryThemeButton("' + theme + '");', {document});
  return attributes;
}

test('Discover and Games primary appearance actions expose the same label and pressed state', () => {
  for (const theme of ['light', 'dark']) {
    assert.deepEqual(sync(theme), {
      'aria-label': 'Toggle color theme',
      'aria-pressed': String(theme === 'dark'),
    });
  }
  assert.deepEqual(sync('dark', false), {}, 'native pages without a primary toggle remain safe');
});

test('Games legacy first-paint label is normalized by the shared script, including cross-tab and BFCache paths', () => {
  assert.match(read('games.html'), /id="theme-toggle"[^>]*aria-label="Dark theme"/);
  assert.match(script, /function syncSharedStoredTheme\(theme\)[\s\S]*?syncPrimaryThemeButton\(theme\)/);
  assert.match(script, /function restoreSharedThemeAfterHistory\(\)[\s\S]*?syncSharedStoredTheme\(savedTheme\)/);
  assert.match(script, /event\.key === 'atlas\.theme'\) syncSharedStoredTheme\(event\.newValue\)/);
});

test('offline professor demo includes exactly the shared primary-toggle normalizer', () => {
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(script));
});
