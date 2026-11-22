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
  for (const page of [html, offline]) {
    assert.ok(page.indexOf('<!-- atlas-nojs-primary-hash-routes:begin -->') <
      page.indexOf('<div id="page"><!-- discovery:start -->'),
      'script-free native destinations come before the long Discover feed');
    assert.ok(page.includes('<div id="page"><!-- discovery:start -->'),
      'preserve the canonical generated Discover preview without changing its boundary');
    assert.ok(page.includes('.nojs-primary-routes>.notice:not(:target){display:none!important}'),
      'only the requested hash destination is shown, not nine fallback notices');
  }
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


test('script-free deep links replace unrelated Discover feed with their requested heading', () => {
  for (const file of ['index.html', 'downloads/Atlas_Demo_Offline.html']) {
    const html = read(file);
    assert.ok(html.includes('<noscript><style>'),
      file + ' retains JavaScript-disabled-only navigation styles');
    assert.ok(html.includes('body:has(.nojs-primary-routes>.notice:target) #page{display:none!important}'),
      file + ' hides unrelated Discover content only for real script-free hash targets');
    assert.ok(html.includes('.nojs-primary-routes>.notice:not(:target){display:none!important}'),
      file + ' still hides unrequested hash fallback notices');
    for (const section of ['dictionary', 'technologies', 'games', 'safety', 'papers',
                           'compare', 'saved', 'sources', 'search']) {
      assert.ok(html.includes('<section class="notice" id="/' + section + '"><h2 role="heading" aria-level="1">'),
        file + ': ' + section + ' has an accessible level-one heading when the Discover feed is hidden');
    }
    assert.ok(html.includes('<div id="page"><!-- discovery:start -->'),
      file + ' preserves the enhanced Discover workspace and its source boundary');
  }
});
