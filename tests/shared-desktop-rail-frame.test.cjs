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
  assert.match(frame, /:is\(\.app-shell > \.sidebar, \.site-chrome\)\{[^}]*width:var\(--atlas-desktop-rail-width\)!important[^}]*padding:var\(--atlas-desktop-rail-top\)/s);
  assert.match(frame, /body:has\(\.site-chrome\)\{padding-left:var\(--atlas-desktop-rail-width\)\}/);
  assert.doesNotMatch(frame, /\.app-shell > \.sidebar\s*\{/, 'no independently maintained Discover outer rail width or padding');
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

test('Discover primary rail uses the native primary-link DOM wrapper without changing SPA routes', () => {
  const discover = read('index.html'), native = read('whats-new.html');
  const main = discover.match(/<nav id="navigation" aria-label="Main navigation"><div class="site-chrome__links">([\s\S]*?)<\/div><details class="nav-more"/)?.[1];
  const staticRail = native.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(main && staticRail, 'both desktop families expose the same link-list structure');
  const discoverLinks = [...main.matchAll(/<a class="nav-link(?: active)?"[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g)]
    .map(([, href, label]) => [href.replace(/^#\//, 'index.html#/'), label]);
  const staticLinks = [...staticRail.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map(([, href, label]) => [href, label.replaceAll('&amp;', '&')]);
  assert.deepEqual(discoverLinks, staticLinks, 'same seven destinations in the same order');
  const css = read('site-chrome.css');
  assert.match(css, /#navigation > \.site-chrome__links\{display:grid;grid-template-columns:minmax\(0,1fr\);gap:4px/);
  assert.match(read('scripts/site_chrome.py'), /primary_wrapper = '<div class="site-chrome__links">'/);
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(css), 'single-file fallback uses the updated shared stylesheet');
  assert.match(offline, /<nav id="navigation" aria-label="Main navigation"><div class="site-chrome__links">/);
});


test('Discover and standalone rail share the native More sections disclosure and keyboard styling', () => {
  const discover = read('index.html');
  const native = read('whats-new.html');
  const css = read('site-chrome.css');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.match(discover, /<details class="nav-more" id="additional-navigation">/);
  assert.match(discover, /<div class="nav-more-links">/);
  assert.match(native, /<details class="site-chrome__more"><summary>More sections<\/summary><div class="site-chrome__more-links">/);
  const unified = css.split('/* atlas-unified-more-disclosure:begin */')[1]
    ?.split('/* atlas-unified-more-disclosure:end */')[0];
  assert.ok(unified, 'shared native disclosure styling exists');
  assert.match(unified, /:is\(#navigation > details\.nav-more, nav\.site-chrome > details\.site-chrome__more\)/);
  assert.match(unified, /min-height:44px/);
  assert.match(unified, /summary:focus-visible/);
  assert.match(unified, /prefers-reduced-motion:reduce/);
  assert.ok(offline.includes(css), 'offline edition uses exact shared disclosure CSS');
  assert.match(offline, /<details class="nav-more" id="additional-navigation">/);
  assert.match(offline, /<div class="nav-more-links">/);
});
