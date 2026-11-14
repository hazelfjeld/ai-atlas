'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

test('Discover and native families share a desktop rail layout source of truth', () => {
  const css = read('site-chrome.css');
  const frame = css.split('/* atlas-unified-desktop-rail-frame:begin */')[1]
    ?.split('/* atlas-unified-desktop-rail-frame:end */')[0];
  assert.ok(frame, 'shared layout contract exists');
  assert.match(frame, /@media \(min-width:651px\)/);
  assert.match(frame, /--atlas-desktop-rail-width:242px/);
  assert.match(frame, /--atlas-desktop-rail-width:215px/);
  assert.match(frame, /max-width:1200px/);
  assert.match(frame, /\.app-shell\{grid-template-columns:var\(--atlas-desktop-rail-width\)/);
  assert.match(frame, /\.app-shell > \.sidebar\{[^}]*width:var\(--atlas-desktop-rail-width\)/s);
  assert.match(frame, /body:has\(\.site-chrome\)\{padding-left:var\(--atlas-desktop-rail-width\)\}/);
  assert.match(frame, /\.site-chrome\{[^}]*width:var\(--atlas-desktop-rail-width\)!important/s);
  assert.match(frame, /\.site-mobile-chrome\{left:var\(--atlas-desktop-rail-width\)\}/);
  assert.match(frame, /\.site-chrome \.site-chrome__links a\{[^}]*padding:11px 12px!important/s);
  assert.match(frame, /\.site-chrome \.site-chrome__name\{font-size:25px\}/);
  assert.match(frame, /font-size:13px!important/);
  assert.match(frame, /\.site-chrome \.site-chrome__name\{font-size:22px\}/);
  assert.match(frame, /\.site-chrome \.site-chrome__links a\{font-size:12px!important\}/);
  assert.match(frame, /\.site-chrome \.site-chrome__links::before\{[^}]*font-size:9px/s);
});

test('one shared frame preserves native navigation and the offline standalone', () => {
  const discover = read('index.html'), native = read('whats-new.html');
  assert.match(discover, /<aside class="sidebar" id="sidebar">/);
  assert.match(discover, /<nav id="navigation" aria-label="Main navigation">/);
  assert.match(native, /<nav class="site-chrome/);
  assert.match(native, /site-mobile-chrome__nav/);
  assert.match(native, /href="index\.html#\/search"/);
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(read('site-chrome.css')),
    'single-file demo embeds the entire current shared layout contract');
});
