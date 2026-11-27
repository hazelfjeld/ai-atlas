'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const shared = read('site-theme.js');
const keyboard = shared.slice(shared.indexOf("document.addEventListener('keydown', (event) => {"), shared.indexOf('// A tap or keyboard activation'));
function press({family = 'discover', hidden = false, modal = false, drawer = false, editing = false, ...keys} = {}) {
  let handler, focused = 0, prevented = 0, destination, remembered = 0;
  const field = {getClientRects: () => hidden ? [] : [1], focus: () => focused++};
  const document = {addEventListener: (_, fn) => {handler = fn;}, querySelector: selector => {
    if (selector === '#global-query') return family === 'discover' ? field : null;
    if (selector === '.site-mobile-chrome__search-input') return family === 'native' ? field : null;
    if (selector.includes('dialog[open]')) return modal ? {} : null;
    if (selector === 'details.site-mobile-chrome__nav[open]') return drawer ? {} : null;
    if (selector === 'form.site-mobile-chrome__search-form') return family === 'native' ? {dataset: {searchRoute: '../index.html#/search'}} : null;
    return null;
  }};
  vm.runInNewContext(keyboard, {document, window: {innerWidth: hidden ? 1280 : 390, location: {assign: value => {destination = value;}}}, rememberSearchFocus: () => remembered++});
  handler({key: '/', target: {closest: () => editing ? {} : null}, preventDefault: () => prevented++, ...keys});
  return {focused, prevented, destination, remembered};
}
test('Discover and native search focus use one early shortcut handler', () => {
  for (const family of ['discover', 'native']) assert.deepEqual(press({family}), {focused: 1, prevented: 1, destination: undefined, remembered: 0});
  assert.deepEqual(press({family: 'native', hidden: true}), {focused: 0, prevented: 1, destination: '../index.html#/search', remembered: 1});
  assert.doesNotMatch(read('app.js'), /e\.key==='\/'/);
});
test('shortcut leaves editing, modified keys, composition, repeats and dialogs alone', () => {
  for (const family of ['discover', 'native']) for (const options of [{editing:true}, {ctrlKey:true}, {metaKey:true}, {altKey:true}, {repeat:true}, {isComposing:true}, {defaultPrevented:true}, {modal:true}, {drawer:true}]) {
    assert.deepEqual(press({family, ...options}), {focused: 0, prevented: 0, destination: undefined, remembered: 0});
  }
});
test('offline embeds the same shortcut source and hydrated app', () => {
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(shared));
  assert.doesNotMatch(offline, /e\.key==='\/'/);
  assert.ok(offline.includes(read('app.js').slice(0, 3000)));
});
