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

test('script-free primary hash routes expose real static destinations without changing SPA links', () => {
  const html = read('index.html');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  for (const [route, onlinePath] of [
    ['dictionary', 'terms/index.html'],
    ['technologies', 'technology/index.html'],
    ['games', 'games.html'],
    ['search', 'terms/index.html'],
  ]) {
    assert.ok(html.includes('id="/' + route + '"'), route + ' has a real no-JavaScript anchor');
    assert.ok(html.includes('href="' + onlinePath + '" data-nojs-static='),
      route + ' reaches the existing static/interactive destination');
    assert.ok(offline.includes('id="/' + route + '"'), route + ' offline anchor survives');
    assert.ok(offline.includes('href="https://aiupdates.app/' + onlinePath + '"'),
      route + ' offline fallback does not point at a nonexistent local file');
  }
  assert.ok(html.includes('<!-- atlas-nojs-primary-hash-routes:begin -->' + String.fromCharCode(10) + '<noscript>'),
    'the route-specific fallback is gated to browsers with JavaScript disabled');
  assert.ok(html.indexOf('<!-- atlas-nojs-primary-hash-routes:begin -->') > html.indexOf('<!-- discovery:end -->'),
    'the fallback must survive deterministic Discover regeneration');
  assert.ok(html.includes('.nojs-primary-routes>.notice:target'),
    'the requested section gets an accessible visible focus ring');
  assert.ok(html.includes('href="#/dictionary" data-view-aliases="terms"'),
    'the JS-enabled Discover dictionary route remains untouched');
  assert.ok(html.includes('href="#/technologies"'),
    'the live SPA technology route remains untouched');
  assert.ok(html.includes('href="#/games"'),
    'the live SPA Games route remains untouched');
  const builder = read('scripts/build_offline.py');
  assert.ok(builder.includes('Missing script-free route handoff'),
    'offline canonical links come from the deterministic builder');
});
