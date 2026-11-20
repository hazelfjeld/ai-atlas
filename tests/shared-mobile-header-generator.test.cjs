'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const primaryLabels = [
  'Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles',
  'Games', 'Playbooks', 'About'
];
const primaryRoutes = [
  '#/overview', 'whats-new.html', '#/dictionary', '#/technologies',
  '#/games', 'playbooks.html', 'about.html'
];

function mobileMenu(file) {
  const html = read(file);
  const match = html.match(/<nav class="[^"]*site-mobile-chrome__menu[^"]*" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/);
  assert.ok(match, 'Missing real native mobile navigation on ' + file);
  return {html, menu: match[1]};
}

test('Discover mobile drawer uses the same generator as native article menus', () => {
  const source = read('scripts/site_chrome.py');
  const start = source.indexOf('def render_discover_mobile():');
  const end = source.indexOf('\ndef normalize_discover_sidebar', start);
  assert.ok(start >= 0 && end > start);
  const shared = source.slice(start, end);
  assert.match(shared, /render_directory_nav\(/, 'Discover must reuse the native menu renderer');
  assert.match(shared, /include_search=False, mobile_only=True/, 'Keep Discover’s working search, not a duplicate');
  assert.match(source, /return mobile if mobile_only else mobile \+ desktop/);
  assert.match(source, /mobile_search = \(/, 'Native pages retain the real search route');
});

test('all four page families retain exactly seven ordered shared mobile destinations', () => {
  for (const file of ['index.html', 'research.html', 'terms/index.html', 'technology/index.html']) {
    const {menu} = mobileMenu(file);
    const first = menu.split('<details class="site-mobile-chrome__more"')[0];
    assert.ok(first !== menu, file + ' must retain the secondary More sections');
    const links = [...first.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    const labels = links.map(match => match[2]);
    const routes = links.map(match => match[1]
      .replace(/^\.\.\//, '').replace(/^index\.html#\//, '#/'));
    assert.deepEqual(labels, primaryLabels, file + ' labels/order');
    assert.deepEqual(routes, primaryRoutes, file + ' routes/order');
  }
});

test('Discover has one real search input, native page has one progressive search', () => {
  const discover = mobileMenu('index.html');
  const native = mobileMenu('research.html');
  assert.doesNotMatch(discover.menu, /site-mobile-chrome__search/, 'No duplicate native search beside Discover input');
  assert.match(discover.html, /id="global-search" role="search"/);
  assert.match(native.html, /class="[^"]*site-mobile-chrome__search"/);
});
