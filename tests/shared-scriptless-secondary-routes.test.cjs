'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = file => fs.readFileSync(file, 'utf8');

test('secondary navigation hash routes remain accessible without JavaScript across native pages', () => {
  const html = read('index.html'), offline = read('downloads/Atlas_Demo_Offline.html');
  const routeLinks = [
    ['safety', 'research.html', 'research'],
    ['papers', 'research.html', 'research'],
    ['compare', 'technology/index.html', 'technologies'],
    ['saved', 'terms/index.html', 'concepts'],
    ['sources', 'about.html', 'policy']
  ];
  for (const page of [html, offline]) {
    assert.ok(page.indexOf('<!-- atlas-nojs-primary-hash-routes:begin -->') <
      page.indexOf('<div id="page"><!-- discovery:start -->'),
      'cross-page no-JavaScript destination appears above Discover without breaking the generated preview');
    assert.ok(page.includes('.nojs-primary-routes:not(:has(> .notice:target)){display:none!important}'),
      'the default Discover page is not cluttered with inactive fallback sections');
  }
  const region = html.slice(html.indexOf('<!-- atlas-nojs-primary-hash-routes:begin -->'),
    html.indexOf('<!-- atlas-nojs-primary-hash-routes:end -->'));
  assert.ok(region.startsWith('<!-- atlas-nojs-primary-hash-routes:begin -->\n<noscript>'));
  assert.ok(region.endsWith('</noscript>\n'));
  for (const [key, href, kind] of routeLinks) {
    assert.match(region, new RegExp('<section class="notice" id="/' + key + '">'));
    assert.ok(region.includes('href="' + href + '" data-nojs-static="' + kind + '"'),
      key + ': hosted fallback reaches a real native page');
    assert.ok(offline.includes('id="/' + key + '"'), key + ': offline retains the hash target');
    assert.ok(offline.includes('href="https://aiupdates.app/' + href + '"'),
      key + ': downloaded demo does not point at a nonexistent sibling file');
  }
  for (const route of ['research.html', 'whats-new.html', 'terms/index.html', 'technology/index.html']) {
    const page = read(route);
    for (const key of ['safety', 'compare', 'saved', 'sources']) {
      const prefix = route.includes('/') ? '../' : '';
      assert.ok(page.includes('href="' + prefix + 'index.html#/' + key + '"'),
        route + ' keeps the shared native secondary route ' + key);
    }
  }
  assert.ok(read('scripts/build_offline.py').includes('Missing script-free route handoff'));
  assert.match(read('scripts/site_chrome.py'), /SECONDARY_DESTINATIONS = \(/);
});
