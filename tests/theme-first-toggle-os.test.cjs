'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const offline = fs.readFileSync(path.join(root, 'downloads/Atlas_Demo_Offline.html'), 'utf8');
const start = "$('theme-toggle').addEventListener('click',()=>{";
const stop = '});\n// Keep the off-canvas navigation';
const offset = app.indexOf(start);
assert.ok(offset >= 0, 'Discover still exposes its native appearance toggle');
const end = app.indexOf(stop, offset);
assert.ok(end > offset, 'Discover appearance handler boundary was changed unexpectedly');
const handlerSource = app.slice(offset, end + 3);

test('Discover toggles actual OS-default appearance on the first click, like standalone pages', () => {
  for (const {osDark, saved, expected} of [
    {osDark:true, saved:undefined, expected:'light'},
    {osDark:false, saved:undefined, expected:'dark'},
    {osDark:true, saved:'light', expected:'dark'},
    {osDark:false, saved:'dark', expected:'light'},
  ]) {
    const dataset = {};
    if (saved) dataset.theme = saved;
    let onClick;
    let stored;
    let synchronized;
    const sandbox = {
      $: id => {assert.equal(id, 'theme-toggle');return {addEventListener(event, cb) {assert.equal(event, 'click');onClick = cb;}};},
      document: {documentElement: {dataset}},
      window: {matchMedia: query => {assert.equal(query, '(prefers-color-scheme: dark)');return {matches:osDark};}},
      localStorage: {setItem: (name,value) => {assert.equal(name, 'atlas.theme');stored = value;}},
      SHARED_HOST: false,
      syncSharedStoredTheme: theme => {synchronized = theme;},
    };
    vm.runInNewContext(handlerSource, sandbox);
    assert.equal(typeof onClick, 'function');
    onClick();
    assert.equal(dataset.theme, expected, 'first click must change the effective appearance');
    assert.equal(stored, expected, 'persisted appearance must match the visible choice');
    assert.equal(synchronized, expected, 'shared standalone controls must stay synchronized');
    onClick();
    assert.equal(dataset.theme, expected === 'dark' ? 'light' : 'dark', 'second click reverses the choice');
  }
});

test('offline Discover embeds the same corrected first-click behavior', () => {
  assert.ok(offline.includes(handlerSource), 'offline single-file demo must embed the current theme handler');
});
