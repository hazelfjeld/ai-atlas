'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const primary = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
const links = html => [...html.matchAll(/<a href="([^"]+)"(?: aria-current="[^"]+")?>([^<]+)<\/a>/g)].map(m => [m[1],m[2]]);
test('standalone Games and daily archive reuse the same primary desktop and mobile destinations', () => {
  const games=read('games.html'), news=read('whats-new.html');
  const desktop=html => html.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
  const mobile=html => html.match(/<nav class="[^"]*site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
  for(const [route,html,active] of [['Games',games,'Games'],['News',news,'What’s New Today']]) {
    assert.match(html, /href="site-chrome\.css"/, route+' must load the shared styles');
    assert.match(html, /class="[^"]*site-mobile-chrome"/,route+' must use shared mobile controls');
    const d=desktop(html),m=mobile(html);
    assert.ok(d&&m,route+' must expose desktop and mobile menus before JavaScript');
    assert.deepEqual(links(d).map(x=>x[1]),primary);
    const nested = m.match(/<details class="site-mobile-chrome__more">[\s\S]*?<\/details>/g) || [];
    assert.equal(nested.length, 1, route+' ships one script-free secondary menu');
    assert.equal((nested[0].match(/<a href=/g) || []).length, 8,
                 route+' ships eight secondary links without duplicates');
    assert.deepEqual(links(m.replace(nested[0], '')).map(x=>x[1]),primary);
    assert.equal((m.match(/aria-current="page"/g)||[]).length,1);
    assert.match(m,new RegExp('aria-current="page">'+active+'<\\/a>'));
    assert.match(html, /href="index\.html#\/search"/,route+' search must navigate to a real feature');
  }
  assert.ok(!games.includes('class="masthead"'),'Games must not retain disconnected alternate header');
  assert.match(games, /class="site-chrome games-site-chrome"/);
  assert.match(games, /id="games-mobile-nav"/);
});
test('shared mobile chrome has native keyboard controls and touch-sized navigation', () => {
  const css=read('site-chrome.css');
  for(const cls of ['site-mobile-chrome','site-mobile-chrome__toggle','site-mobile-chrome__menu','site-mobile-chrome__search'])
    assert.ok(css.includes('.'+cls+'{'),cls+' has shared styling');
  assert.match(css,/\.site-mobile-chrome__toggle\{[^}]*min-height:44px/);
  assert.match(css,/\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
  assert.match(css,/\.site-mobile-chrome__search\{[^}]*min-height:44px/);
  assert.match(css, /\.site-mobile-chrome a:focus-visible,\.site-mobile-chrome summary:focus-visible/);
  assert.match(css, /@media print\{\.site-mobile-chrome\{display:none!important\}\}/);
});
test('standalone Games participates in the workspace theme choice without depending on localStorage', () => {
  const games=read('games.js'),html=read('games.html');
  assert.match(games,/setAttribute\('aria-pressed', String\(document.documentElement.dataset.theme === 'dark'\)\)/);
  assert.match(html,/localStorage\.setItem\('atlas\.theme', document\.documentElement\.dataset\.theme\)/);
  assert.match(html,/document.addEventListener\('DOMContentLoaded'/);
  assert.match(html,/localStorage\.getItem\('atlas\.theme'\)/);
  assert.match(html,/if \(saved === 'dark' \|\| saved === 'light'\)/);
  assert.ok(html.indexOf('localStorage.getItem')<html.indexOf('href="games.css"'), 'saved theme is applied before CSS paint');
});

test('secondary static destinations are identified in the shared rail before hydration', () => {
  for (const [file, href, name] of [
    ['demo.html', 'demo.html', 'Guided professor demo'],
    ['terms/index.html', '../terms/index.html', 'Concept encyclopedia']
  ]) {
    const html = read(file);
    const current = '<a href="' + href + '" aria-current="location">' + name + '</a>';
    assert.equal(html.split(current).length - 1, 2, file + ' marks desktop and mobile current location');
    assert.match(html, /<details class="site-chrome__more" open>/, file + ' expands the desktop secondary group');
    assert.match(html, /<details class="site-mobile-chrome__more" open>/, file + ' expands native mobile More sections');
  }
  const css=read('site-chrome.css');
  assert.ok(css.includes('.site-chrome__more-links a:hover,.site-chrome__more-links a[aria-current]'), 'active secondary rail uses the shared visible selection');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css), 'offline chrome remains the exact shared stylesheet');
});

test('Games keeps canonical script-free policy links without duplicating the native app footer', () => {
  const games=read('games.html'), app=read('index.html');
  const footer=games.match(/<footer class="site-chrome__footer">([\s\S]*?)<\/footer>/)?.[1] || '';
  assert.ok(footer, 'standalone Games has one native footer');
  assert.equal(footer.split('href="about.html"').length-1, 1,
               'standalone Games has a script-free policy destination');
  assert.equal(footer.split('href="index.html#/sources"').length-1, 1,
               'standalone Games retains source coverage');
  const appFooter = '<footer class="main-footer site-chrome__footer">';
  assert.ok(app.includes(appFooter), 'native workspace keeps its canonical shared footer');
  assert.ok(app.indexOf(appFooter) > app.indexOf('</main>'),
            'native workspace footer is now a global contentinfo landmark');
  assert.ok(app.includes('href="about.html">About & editorial policy</a>'),
            'native workspace already provides the policy destination');
  const canonical=read('scripts/site_chrome.py');
  assert.ok(!canonical.includes('if path == "games.html":'),
            'Games footer follows the shared resource synchronizer');
  const install=read('scripts/install_games_workspace.py');
  assert.ok(install.includes('body = body.replace(') &&
            install.includes('Editorial policy & coverage</a>'),
            'native Games deliberately omits the redundant link');
  assert.ok(!read('games-tab.js').includes('Editorial policy & coverage'),
            'generated native module remains free of duplicated shell policy links');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes('About & editorial policy'),
            'offline app keeps its canonical policy label');
});

test('standalone editorial footers use the shared policy label and retain sources', () => {
  for (const file of [
    'demo.html', 'research.html', 'catalog-review.html', 'hardware-review.html',
    'games.html', 'technologies.html', 'playbooks.html', 'whats-new.html'
  ]) {
    const footer = read(file).match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0] || '';
    assert.ok(footer, file + ' exposes a script-free footer');
    assert.equal(
      (footer.match(/<a href="about\.html">Editorial policy &(?:amp;)? coverage<\/a>/g) || []).length,
      1, file + ' uses the same visible editorial-policy destination'
    );
    assert.match(footer, /href="index\.html#\/sources"/,
                 file + ' retains its source/coverage destination');
  }
  assert.ok(read('scripts/site_chrome.py').includes(
    'for old_label in ("Editorial policy", "Editorial corrections policy")'
  ), 'the build normalizes both legacy names in the shared generator');
});

test('standalone Games reuses the shared in-main script-free fallback, never an endless loader', () => {
  const html = read('games.html');
  const main = html.indexOf('<main id="main" tabindex="-1">');
  const end = html.indexOf('</main>', main);
  const fallback = html.indexOf('<noscript><section class="site-static-fallback"', main);
  const loader = html.indexOf('<div id="load-status" class="notice site-js-only"', main);
  assert.ok(main >= 0 && fallback > main && loader > fallback && end > loader,
    'Games must render its native reference fallback before the JS-only loading state inside main');
  const section = html.slice(fallback, html.indexOf('</section></noscript>', fallback));
  for (const href of ['terms/index.html', 'technology/index.html']) {
    assert.ok(section.includes('href="' + href + '"'), 'Fallback must retain ' + href);
    assert.ok(fs.existsSync(path.join(__dirname, '..', href)), 'Fallback target missing ' + href);
  }
  assert.ok(html.includes('class="catalog-badge site-js-only"'),
    'Script-free visitors should not see a permanently checking concept count');
  assert.ok(!html.slice(end).includes('<noscript>'),
    'The fallback belongs in the main content landmark, not after it');
});

test('shared listing shells expose their existing footer as a contentinfo landmark', () => {
  for (const file of ['playbooks.html', 'technologies.html']) {
    const html = read(file);
    const mainClose = html.indexOf('</main>');
    const footerOpen = html.indexOf('<footer class="site-chrome__footer">');
    const footerClose = html.indexOf('</footer>');
    assert.equal((html.match(/<main\b/g) || []).length, 1, file + ' keeps one main');
    assert.equal((html.match(/<footer\b/g) || []).length, 1, file + ' keeps one site footer');
    assert.ok(mainClose >= 0 && footerOpen > mainClose && footerClose > footerOpen,
      file + ' must keep its shared global contentinfo footer outside the article landmark');
    assert.match(html.slice(mainClose, footerOpen), /^<\/main>\s*$/,
      file + ' footer directly follows main');
    assert.match(html.slice(footerClose), /^<\/footer>\s*<\/div>/,
      file + ' footer keeps the existing width-limited content shell');
    assert.match(html.slice(footerOpen, footerClose), /href="about\.html"/);
    assert.match(html.slice(footerOpen, footerClose), /href="index\.html#\/sources"/);
  }
});

test('native Games generation strips only the standalone script-free fallback', () => {
  const standalone = read('games.html');
  const native = read('games-tab.js');
  const main = standalone.match(/<main id="main"(?: tabindex="-1")?>([\s\S]*?)<\/main>/);
  assert.ok(main, 'standalone Games main is required for native generation');
  const fallback = /<noscript><section class="site-static-fallback"[^>]*>[\s\S]*?<\/section><\/noscript>\n?/g;
  assert.equal([...main[1].matchAll(fallback)].length, 1,
    'script-free fallback must appear exactly once on the standalone Games page');
  const globalFooter = standalone.match(/<\/main>\s*<footer class="site-chrome__footer">([\s\S]*?)<\/footer>/);
  assert.ok(globalFooter, 'standalone Games footer remains global and native view still preserves its guidance');
  let body = (main[1] + '<footer>' + globalFooter[1] + '</footer>\n')
    .replaceAll('href="index.html#/', 'href="#/')
    .replace('Scores and missed concepts stay in this tab’s memory.',
      'Leaving Games ends the current round. Best times stay in this browser tab’s memory.')
    .replace(' · <a href="about.html">Editorial policy & coverage</a>', '')
    .replace(fallback, '')
    .replace('class="catalog-badge site-js-only"', 'class="catalog-badge"')
    .replace('id="load-status" class="notice site-js-only"', 'id="load-status" class="notice"');
  const embedded = native.match(/html: \(\) => ("(?:\\.|[^"\\])*"),\s*mount/);
  assert.ok(embedded, 'native Games exposes an embedded deterministic template');
  assert.equal(JSON.parse(embedded[1]), '<div class="atlas-games">' + body + '</div>',
    'native Games must remain byte-reproducible from standalone source without no-JS-only content');
  assert.ok(!native.includes('Browse concepts without JavaScript'),
    'native app must not embed a redundant standalone fallback');
  assert.ok(read('scripts/install_games_workspace.py').includes('fallback_count == 1'),
    'generator must fail rather than silently drifting when the fallback changes');
});

test('native desktop pages inherit one visible global search route from the shared mobile link', () => {
  const runtime = read('site-theme.js'), css = read('site-chrome.css');
  assert.match(runtime, /const mobileSearch = chrome\.querySelector\('a\.site-mobile-chrome__search\[href\]'\)/);
  assert.match(runtime, /desktopSearch = mobileSearch\.cloneNode\(true\)/);
  assert.match(runtime, /desktopPrimary\.before\(desktopSearch\)/);
  assert.match(runtime, /a\.site-mobile-chrome__search\[href\],a\.site-chrome__search\[href\]/,
    'desktop click must use the same one-shot search focus handoff');
  assert.match(css, /\.site-chrome__search\{[^}]*min-height:44px/);
  assert.match(css, /\.site-chrome__search:focus-visible\{outline:3px/);
  for (const file of ['about.html','whats-new.html','playbooks.html','research.html',
    'games.html','technologies.html','terms/index.html','technology/index.html']) {
    const html = read(file);
    assert.equal((html.match(/site-mobile-chrome__search" href=/g) || []).length, 1,
      file + ' supplies exactly one working global search source');
    assert.equal((html.match(/class="site-chrome__search"/g) || []).length, 0,
      file + ' must not duplicate the progressively enhanced desktop link');
    assert.match(html, /href="(?:\.\.\/)?index\.html#\/search"/,
      file + ' routes to the real Discover search');
  }
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(runtime) && offline.includes(css),
    'the single-file demo must embed both current shared sources exactly');
  assert.match(read('index.html'), /<form class="global-search" id="global-search"/,
    'Discover must retain its existing functioning search form');
});
