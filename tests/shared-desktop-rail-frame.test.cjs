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
  assert.match(discover, /<nav class="sidebar" id="sidebar" aria-label="AI Updates primary navigation">/);
  assert.match(discover, /<div id="navigation">/);
  assert.doesNotMatch(discover, /<aside class="sidebar"|<nav id="navigation"/, 'one desktop navigation landmark');
  assert.match(native, /<nav class="site-chrome/);
  assert.match(native, /site-mobile-chrome__nav/);
  assert.match(native, /href="index\.html#\/search"/);
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(read('site-chrome.css')),
    'single-file demo embeds the entire current shared layout contract');
});

test('Discover primary rail uses the native primary-link DOM wrapper without changing SPA routes', () => {
  const discover = read('index.html'), native = read('whats-new.html');
  const main = discover.match(/<div id="navigation"><div class="site-chrome__links">([\s\S]*?)<\/div><details class="nav-more"/)?.[1];
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
  assert.match(offline, /<div id="navigation"><div class="site-chrome__links">/);
  assert.match(offline, /<nav class="sidebar" id="sidebar" aria-label="AI Updates primary navigation">/);
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

test('native editorial families render the shared rail bottom before hydration', () => {
  const paths = [
    'whats-new.html', 'research.html', 'games.html', 'playbooks.html',
    'technologies.html', 'catalog-review.html', 'hardware-review.html', 'demo.html',
  ];
  const discover = read('index.html');
  const script = read('site-theme.js');
  const generator = read('scripts/site_chrome.py');
  const css = read('site-chrome.css');
  assert.match(generator, /def render_static_rail_bottom\(prefix=""/);
  assert.match(generator, /render_static_rail_bottom\(\) \+ '<\/nav>'/);
  assert.match(script, /const previous = rail\.querySelector\('\.sidebar-bottom'\)/);
  assert.match(script, /if \(previous\) return previous;/);
  assert.match(css, /\.site-chrome \.sidebar-bottom/);
  for (const path of paths) {
    const page = read(path);
    const rail = page.match(/<nav class="site-chrome [^"]+" aria-label="AI Updates primary navigation">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(rail, path + ' has a native global rail');
    assert.equal((rail.match(/class="sidebar-bottom site-chrome__bottom"/g) || []).length, 1, path);
    assert.match(rail, /Research snapshot<small>November 1, 2026<\/small>/, path);
    assert.match(rail, /href="index\.html#\/sources">Coverage & collection status/, path);
    assert.match(rail, /class="sidebar-actions"><span>Curated & sourced<\/span>/, path);
    assert.match(rail, /<details class="site-chrome__more"(?: open)?>/, path);
    assert.match(page, /site-mobile-chrome__nav/, path + ' retains script-free mobile navigation');
  }
  assert.match(discover, /<div class="sidebar-bottom">/, 'Discover retains its original shared rail footer');
});

test('reference landing directories and About expose one shared lower desktop rail without scripts', () => {
  const generator = read('scripts/site_chrome.py');
  const termBuilder = read('scripts/build_term_pages.py');
  const seoBuilder = read('scripts/build_seo.py');
  assert.match(generator, /rail_bottom=False/);
  assert.match(generator, /render_static_rail_bottom\(prefix\) if rail_bottom/);
  assert.match(termBuilder, /rail_bottom=\(path == 'terms\/index\.html'\)/);
  assert.match(seoBuilder, /rail_bottom=\(path == 'technology\/index\.html'\)/);
  assert.match(seoBuilder, /topbar_title='About', native_secondary=True, mobile_secondary=True, rail_bottom=True/);
  assert.match(read('site-theme.js'), /const previous = rail\.querySelector\('\.sidebar-bottom'\)/);
  for (const [page, prefix] of [
    ['terms/index.html', '../'],
    ['technology/index.html', '../'],
    ['about.html', ''],
  ]) {
    const html = read(page);
    const rail = html.match(/<nav class="site-chrome term-nav" aria-label="AI Updates primary navigation">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(rail, page + ' has one native desktop navigation landmark');
    assert.equal((html.match(/class="sidebar-bottom site-chrome__bottom"/g) || []).length, 1, page);
    assert.ok(rail.includes('<div class="sidebar-bottom site-chrome__bottom">'), page);
    assert.ok(rail.includes('href="' + prefix + 'index.html#/sources"'), page + ' has a working native sources link');
    assert.ok(rail.includes('<div class="sidebar-actions"><span>Curated & sourced</span>'), page);
    assert.ok(rail.includes('<details class="site-chrome__more"'), page + ' retains all secondary destinations');
    assert.match(html, /<details class="site-mobile-chrome__nav"[^>]*>/, page + ' retains its script-free mobile menu');
  }
});
