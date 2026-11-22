'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('script-free Discover never masquerades as a functioning search form', () => {
  const html = read('index.html');
  const noscriptStyle = html.match(/<noscript><style>([\s\S]*?)<\/style><\/noscript>/);
  assert.ok(noscriptStyle, 'script-free search fallback is styled only without JS');
  assert.match(noscriptStyle[1], /\.topbar > form\.global-search\{display:none!important\}/);
  assert.match(html, /<noscript><a class="global-search nojs-catalog-link" href="terms\/index\.html"/);
  assert.match(html, /interactive search requires JavaScript/);
  assert.match(html, /nojs-catalog-link[^>]*>Browse concepts ↗<\/a>/,
    'script-free Discover uses the same one-line mobile search frame as native pages');
  assert.match(html, /<form class="global-search" id="global-search" role="search">/,
    'preserve the exact enhanced Discover search form');
  for (const route of ['whats-new.html','research.html','technology/index.html','terms/index.html']) {
    const source = read(route);
    assert.match(source, /site-mobile-chrome__search/,
      route + ' retains its script-free search navigation');
  }
});

test('offline demo reflects the same progressive search contract', () => {
  const html = read('downloads/Atlas_Demo_Offline.html');
  const live = read('index.html');
  const style = live.match(/<noscript><style>[\s\S]*?<\/style><\/noscript>/)?.[0];
  assert.ok(style && html.includes(style), 'single-file fallback uses exact no-JS style');
  assert.match(html, /<noscript><a class="global-search nojs-catalog-link" href="#\/dictionary"/,
    'offline search fallback stays within its bundled dictionary route');
  assert.match(html, /id="global-search" role="search"/,
    'the functional live offline search is not replaced');
  assert.match(html, /nojs-catalog-link[^>]*>Browse concepts ↗<\/a>/,
    'offline fallback keeps the same compact visible navigation label');
});
