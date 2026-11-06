'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Games is an original workspace hash route, not a second website link', () => {
  const html = read('index.html'), app = read('app.js');
  assert.ok(!html.includes('href="games.html"'));
  assert.match(app, /games:'Games'/);
  assert.match(app, /nav\.querySelectorAll\('a\[data-view\]'\)/);
  assert.ok(app.includes("else if(view==='games')"));
  assert.ok(app.includes('AtlasGamesTab.mount'));
  for(const name of ['games-core.js','games-tab.js']) assert.ok(html.includes('src="'+name+'"'));
  assert.ok(html.includes('href="games-tab.css"'));
});
test('Native Games reuses catalog, cleans up listeners/timers, and opens Atlas concept dialogs', () => {
  const ui = read('games-tab.js'), app = read('app.js');
  new vm.Script(ui);
  assert.ok(ui.includes('mount(root, data, options'));
  assert.ok(ui.includes('lifecycle.abort(); clearTimers();'));
  assert.ok(!ui.includes('await window.ATLAS_READY'));
  assert.ok(!ui.includes('document.body.classList'));
  assert.ok(app.includes('disposeGames();disposeGames=null;'));
  assert.ok(app.includes('openConcept:openRecord'));
  assert.ok(!ui.includes('<iframe'));
});
test('Standalone game links still work with shared game engine', () => {
  const html = read('games.html');
  for(const name of ['catalog-loader.js','core.js','games-core.js','games.js']) assert.ok(html.includes('src="'+name+'"'));
  assert.match(html, /<main id="main" tabindex="-1">/, 'Skip-link destination must be keyboard-focusable');
  assert.match(html, /id="theme-toggle"[^>]*aria-label="Dark theme" aria-pressed="false"/, 'Theme toggle must expose a stable name and an initial state');
  assert.match(html, /id="theme-toggle"[^>]*min-width:44px;min-height:44px/, 'Standalone theme button must meet the 44px mobile touch-target baseline');
  assert.match(read('games.js'), /setAttribute\('aria-pressed', String\(document.documentElement.dataset.theme === 'dark'\)\)/);
});
test('Offline fallback embeds Games without redirecting learners to another site', () => {
  const html = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(html.includes('window.AtlasGamesTab'));
  assert.ok(html.includes("else if(view==='games')"));
  assert.ok(!html.includes('<span>Games (online)</span>'));
  assert.ok(!html.includes('href="https://raw.githack.com/hazelfjeld/ai-atlas/main/games.html"'));
  assert.ok(!html.includes('src="games-tab.js"'));
  assert.ok(!html.includes('href="games-tab.css"'));
});

test('first-paint sidebar uses the same canonical workspace destinations as hydration', () => {
  const html=read('index.html'),app=read('app.js');
  const nav=html.match(/<nav id="navigation" aria-label="Main navigation">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  const links=[...nav.matchAll(/<a class="nav-link(?: active)?"([^>]*)>[\s\S]*?<\/a>/g)].map(m=>({
    id:m[1].match(/data-(?:view|static)="([^"]+)"/)?.[1],href:m[1].match(/href="([^"]+)"/)?.[1]
  }));
  assert.deepEqual(links,[
    ['overview','#/overview'],['daily','whats-new.html'],['dictionary','#/dictionary'],
    ['technologies','#/technologies'],['games','#/games'],['playbooks','playbooks.html'],
    ['about','about.html'],['safety','#/safety'],['papers','#/papers'],['compare','#/compare'],
    ['saved','#/saved'],['sources','#/sources'],['demo','demo.html'],
    ['encyclopedia','terms/index.html'],['offline','downloads/Atlas_Demo_Offline.html']
  ].map(([id,href])=>({id,href})));
  assert.ok(app.includes("nav.querySelectorAll('a[data-view]')"));
  assert.ok(!app.includes("$('navigation').innerHTML=items.map"));
  assert.ok(html.includes('<noscript>') && html.includes('href="terms/index.html"'));
});



test('Discover primary links reuse the seven canonical destinations without duplicate Playbooks', () => {
  const online = read('index.html');
  const primary = online.split('<nav id="navigation" aria-label="Main navigation">')[1]
    .split('<details class="nav-more"')[0];
  const links = [...primary.matchAll(/<a class="nav-link(?: active)?" ([^>]+)>[\s\S]*?<\/a>/g)];
  assert.deepEqual(links.map(m => m[0].match(/<span>([^<>]+)<\/span>/)[1]),
    ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles',
     'Games', 'Playbooks', 'About']);
  assert.deepEqual(links.map(m => m[1].match(/href="([^"]+)"/)[1]),
    ['#/overview', 'whats-new.html', '#/dictionary', '#/technologies',
     '#/games', 'playbooks.html', 'about.html']);
  assert.equal((online.match(/data-view="playbooks"/g) || []).length, 1);
  assert.ok(!online.split('<details class="nav-more"')[1].split('</details>')[0]
    .includes('data-view="playbooks"'));
  assert.match(read('scripts/site_chrome.py'), /def normalize_discover_sidebar\(html, term_count, tech_count\):/);
  assert.match(read('scripts/site_chrome.py'), /def render_discover_primary\(term_count, tech_count\):/);
  assert.match(read('scripts/site_chrome.py'), /for \(route, label\), \(key, kind, icon\) in zip\(DESTINATIONS, DISCOVER_LINKS, strict=True\)/);
  assert.match(read('scripts/build_seo.py'), /index = normalize_discover_sidebar\(/);
  assert.match(read('scripts/build_offline.py'), /href="playbooks.html".*href="#\/playbooks"/);
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes('data-view="playbooks" href="#/playbooks"'));
  assert.ok(offline.includes('data-static="about" href="#/sources"'));
});

test('progressive sidebar retains all canonical links and reveals deep-linked secondary views', () => {
  const html=read('index.html'), app=read('app.js'), css=read('brand.css');
  const nav=html.match(/<nav id="navigation" aria-label="Main navigation">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav);
  assert.match(nav, /<details class="nav-more" id="additional-navigation"><summary class="nav-more-toggle">/);
  assert.ok(!nav.includes('id="additional-navigation" open'), 'Secondary links should be collapsed on initial paint');
  assert.match(nav, /<div class="nav-more-links">[\s\S]*?data-view="safety"/);
  assert.match(nav, /data-static="offline"[\s\S]*?<\/div><\/details>$/);
  for(const id of ['overview','dictionary','technologies','games','safety','papers','playbooks','compare','saved','sources'])
    assert.match(nav, new RegExp('data-view="'+id+'"'), 'Missing native workspace destination: '+id);
  assert.match(app, /if\(more && \['safety','papers','compare','saved','sources'\]\.includes\(view\)\) more\.open=true/);
  assert.match(css, /\.nav-more-toggle:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});


test('standalone workspace heading has a first-paint and no-script label across page families', () => {
  const css=read('site-chrome.css'), script=read('site-theme.js');
  const fallback=css.split('.site-mobile-chrome::before{')[1]?.split('}')[0];
  assert.ok(fallback, 'Shared desktop workspace header must exist');
  assert.match(fallback, /content:"AI Updates";/, 'No-script header cannot be empty');
  assert.ok(css.includes('.site-mobile-chrome[data-page-label]::before{content:attr(data-page-label)}'));
  assert.ok(script.includes('chrome.dataset.pageLabel = label;'), 'Enhanced pages should still show their section');
});

test('shared native mobile drawer reuses canonical desktop wordmark without duplicate links', () => {
  const script=read('site-theme.js'), css=read('site-chrome.css');
  new vm.Script(script);
  const handlers={}; let clones=0, inserts=0;
  const copy={className:'site-chrome__brand'};
  const original={cloneNode(deep){assert.equal(deep,true);clones++;return copy;}};
  const menu={querySelector:()=>inserts?copy:null,prepend(el){assert.equal(el,copy);inserts++;}};
  const chrome={dataset:{},querySelector:()=>menu};
  const document={
    documentElement:{dataset:{}},title:'Games · AI Updates',
    addEventListener:(name,handler)=>{handlers[name]=handler;},
    querySelector:(selector)=>selector==='.site-mobile-chrome'?chrome:
      selector==='.site-chrome__brand'?original:null
  };
  const window={innerWidth:390,addEventListener(){}};
  vm.runInNewContext(script,{document,window,localStorage:{getItem:()=>null}});
  handlers.DOMContentLoaded();
  assert.equal(clones,1);
  assert.equal(inserts,1);
  assert.equal(copy.className,'site-mobile-chrome__brand', 'The mobile clone must not masquerade as the desktop rail');
  assert.equal(chrome.dataset.pageLabel,'Games');
  handlers.DOMContentLoaded();
  assert.equal(inserts,1,'Repeated initialization must not duplicate mobile brand');
  assert.match(css,/\.site-mobile-chrome \.site-mobile-chrome__menu > a\.site-mobile-chrome__brand/);
  assert.match(css,/\.site-mobile-chrome \.site-mobile-chrome__menu::before/);
});

test('shared native mobile drawer traps keyboard focus without replacing no-JS navigation', () => {
  const script = read('site-theme.js');
  new vm.Script(script);
  const handlers = {};
  let focused;
  const makeStop = () => ({
    getClientRects: () => [{}],
    focus() { focused = this; document.activeElement = this; }
  });
  const summary = makeStop(), firstLink = makeStop(), lastLink = makeStop();
  const menu = {
    querySelector: () => summary,
    querySelectorAll: () => [firstLink, lastLink],
    contains: el => [summary, firstLink, lastLink].includes(el)
  };
  let open = true;
  const document = {
    documentElement: {dataset: {}}, activeElement: lastLink,
    addEventListener: (name, listener) => { handlers[name] = listener; },
    querySelector: () => open ? menu : null,
    querySelectorAll: () => []
  };
  const window = {innerWidth: 390};
  vm.runInNewContext(script, {document, window, localStorage: {getItem: () => null}});
  const tab = shiftKey => ({
    key: 'Tab', shiftKey, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; }
  });
  const forward = tab(false);
  handlers.keydown(forward);
  assert.ok(forward.defaultPrevented);
  assert.equal(focused, summary, 'Tab from final section returns to menu trigger');
  const backward = tab(true);
  handlers.keydown(backward);
  assert.ok(backward.defaultPrevented);
  assert.equal(focused, lastLink, 'Shift-Tab from trigger wraps to final section');
  open = false;
  const closed = tab(false);
  handlers.keydown(closed);
  assert.equal(closed.defaultPrevented, false, 'Closed native menu does not trap focus');
  open = true;
  window.innerWidth = 1280;
  const desktop = tab(false);
  handlers.keydown(desktop);
  assert.equal(desktop.defaultPrevented, false, 'Desktop keyboard remains unrestricted');
  assert.match(read('site-chrome.css'), /body:has\(\.site-mobile-chrome__nav\[open\]\)\{overflow:hidden\}/);
});


test('shared mobile drawer makes background inert without leaving hidden controls disabled', () => {
  const script = read('site-theme.js');
  new vm.Script(script);
  const events = {};
  const el = (tag, inert = false) => ({tagName:tag, inert, children:[], parentElement:null});
  const append = (parent, ...children) => {
    parent.children.push(...children);
    for (const child of children) child.parentElement = parent;
  };
  const body = el('BODY'), skip = el('A'), header = el('HEADER');
  const main = el('MAIN'), preInert = el('DIV', true), chrome = el('DIV');
  const themeButton = el('BUTTON'), drawer = el('DETAILS');
  const search = el('A'), summary = el('SUMMARY');
  drawer.matches = selector => selector === 'details.site-mobile-chrome__nav';
  append(body, skip, header, main, preInert);
  append(header, chrome, themeButton);
  append(chrome, drawer, search);
  append(drawer, summary);
  const document = {
    body, documentElement:{dataset:{}},
    addEventListener:(type,handler,capture) => {events[type] = handler; if(type==='toggle') assert.equal(capture,true);},
    querySelector:() => drawer.open ? drawer : null,
    querySelectorAll:(selector) => selector === 'details.site-mobile-chrome__nav[open]' && drawer.open ? [drawer] : []
  };
  const window = {innerWidth:390, addEventListener:(name,fn)=>{events[name]=fn;}};
  vm.runInNewContext(script,{document,window,localStorage:{getItem:()=>null}});
  drawer.open = true;
  events.toggle({target:drawer});
  assert.equal(main.inert,true, 'background main landmark is excluded from screen readers');
  assert.equal(search.inert,true, 'search behind the drawer is not interactive');
  assert.equal(themeButton.inert,true, 'header control behind the drawer is inert');
  assert.equal(drawer.inert,false, 'drawer and its close control remain accessible');
  drawer.open = false;
  events.toggle({target:drawer});
  assert.equal(main.inert,false, 'prior main state is restored');
  assert.equal(search.inert,false, 'search is restored');
  assert.equal(preInert.inert,true, 'pre-existing inert state is preserved');
  drawer.open = true;
  events.toggle({target:drawer});
  window.innerWidth = 768;
  events.resize();
  assert.equal(drawer.open,false, 'tablet resize dismisses the former mobile drawer');
  assert.equal(main.inert,false, 'tablet resize clears mobile-only background isolation');
  assert.equal(preInert.inert,true);
  window.innerWidth = 390;
  events.resize();
  assert.equal(drawer.open,false, 'returning to mobile must not reopen a stale menu');
  assert.equal(main.inert,false, 'workspace stays accessible after rotating back');
});

test('mobile drawer does not expose closed offscreen links and supports keyboard dismissal', () => {
  const html=read('index.html'),app=read('app.js'),css=read('app.css'),offline=read('downloads/Atlas_Demo_Offline.html');
  assert.match(html, /id="menu-toggle"[^>]+aria-controls="sidebar"/);
  assert.match(css, /@media\(max-width:650px\)[\s\S]*?\.sidebar\{[^}]*visibility:hidden/);
  assert.match(css, /\.sidebar\.open\{[^}]*visibility:visible/);
  assert.match(app, /function closeMobileNavigation\(restoreFocus=false\)/);
  assert.match(app, /document\.querySelector\('\.workspace'\)\.inert=open/);
  assert.match(app, /e\.key==='Escape'/);
  assert.match(app, /mobileNavTabStops\(\)/);
  assert.match(offline, /aria-controls="sidebar"/);
  assert.match(offline, /function closeMobileNavigation\(restoreFocus=false\)/);
});
test('standalone Games header provides 44px navigation targets on 320px phones', () => {
  const css = read('games.css');
  assert.match(css, /@media\(max-width:360px\)[\s\S]*?\.masthead nav\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:360px\)[\s\S]*?\.masthead nav a\{[^}]*min-height:44px/);
});


test('About, technologies and playbooks reuse the Games and archive mobile chrome', () => {
  const expected = [
    ['index.html#/overview','Discover'], ['whats-new.html','What’s New Today'],
    ['index.html#/dictionary','Concept dictionary'],
    ['index.html#/technologies','Technology profiles'],
    ['index.html#/games','Games'], ['playbooks.html','Playbooks'], ['about.html','About']
  ];
  const navLinks = (html,path) => {
    const menu = html.match(/<nav class="[^"]*site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(menu, 'Missing actual shared mobile navigation in '+path);
    const links = [...menu.matchAll(/<a href="([^"]+)"(?: aria-current="page")?>([^<]+)<\/a>/g)];
    assert.equal(links.length, 7, path);
    assert.deepEqual(links.map(m => [m[1],m[2]]), expected, path);
    return menu;
  };
  // Games and the daily archive already use these exact destinations.
  for (const path of ['games.html','whats-new.html']) navLinks(read(path),path);
  for (const [path,prefix,active] of [
    ['technologies.html','tech','Technology profiles'],
    ['playbooks.html','playbook','Playbooks']]) {
    const html=read(path);
    assert.match(html, new RegExp('class="'+prefix+'-mobile-topbar site-mobile-chrome"'), path);
    assert.match(html, new RegExp('class="'+prefix+'-mobile-nav site-mobile-chrome__nav"'), path);
    assert.match(html, new RegExp('class="'+prefix+'-menu-toggle site-mobile-chrome__toggle"'), path);
    assert.match(html, new RegExp('class="'+prefix+'-search-link site-mobile-chrome__search" href="index.html#/search"'), path);
    assert.match(html, /<link rel="stylesheet" href="site-chrome.css">/, path);
    const menu=navLinks(html,path);
    assert.equal((menu.match(/aria-current="page"/g)||[]).length,1,path);
    assert.ok(menu.includes('aria-current="page">'+active+'</a>'),path);
    // Obsolete per-page copies of the menu styles must not override the shared implementation.
    assert.ok(!new RegExp('\\.'+prefix+'-menu-panel a\\{').test(html),path);
    assert.ok(html.includes('@media print'),path);
  }
  assert.match(read('technologies.html'), /\.tech-controls input,\.tech-controls select\{min-height:44px;font-size:16px\}/);
  assert.match(read('playbooks.html'), /\.playbook-tools input,\.playbook-tools select\{min-height:44px;font-size:16px\}/);
  assert.match(read('about.html'), /\.term-shell \.term-nav\{display:none\}/);
  const css=read('site-chrome.css');
  assert.match(css, /\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
  // Checkpoint's global mobile nav selector must never force the shared menu into a horizontal strip.
  assert.match(css, /\.site-mobile-chrome__menu\{[^}]*display:grid;grid-template-columns:minmax\(0,1fr\);gap:0;margin:0;overflow-x:hidden/);
  assert.match(css, /\.site-mobile-chrome a:focus-visible,\.site-mobile-chrome summary:focus-visible/);
  assert.match(css, /@media \(max-width:650px\)\{/);
});


test('About reuses the exact generated catalog navigation, not a parallel template', () => {
  const about = read('about.html');
  const built = read('scripts/build_seo.py');
  const main = '<main class="term-shell" id="main">';
  const ours = about.split(main)[1].split('<header class="hero">')[0];
  const template = read('terms/index.html').split(main)[1].split('<header class="hero">')[0];
  const expected = template.replaceAll('href="../','href="')
    .replaceAll('href="index.html#/dictionary" aria-current="page">Concept dictionary','href="index.html#/dictionary">Concept dictionary')
    .replaceAll('href="about.html">About','href="about.html" aria-current="page">About');
  assert.equal(ours, expected);
  assert.match(about, /class="directory-mobile-topbar site-mobile-chrome"/);
  assert.match(about, /id="directory-mobile-nav"/);
  assert.match(about, /href="index.html#\/search"/);
  assert.match(built, /render_directory_nav\(prefix, 'About'\)/);
  assert.doesNotMatch(built, /ABOUT_MOBILE_NAV|ABOUT_DESKTOP_NAV|ABOUT_MOBILE_CSS/);
  assert.equal((ours.match(/aria-current="page"/g) || []).length, 2);
});

test('editorial review pages reuse the canonical shared mobile chrome without changing evidence', () => {
  const expected = [
    ['index.html#/overview','Discover'], ['whats-new.html','What’s New Today'],
    ['index.html#/dictionary','Concept dictionary'], ['index.html#/technologies','Technology profiles'],
    ['index.html#/games','Games'], ['playbooks.html','Playbooks'], ['about.html','About']
  ];
  const extract = html => {
    const content = html.match(/<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(content, 'Shared navigation is missing');
    const links = [...content.matchAll(/<a href="([^"]+)"(?: aria-current="(?:page|location)")?>([^<]+)<\/a>/g)];
    return links.map(m => [m[1],m[2]]);
  };
  assert.deepEqual(extract(read('games.html')), expected, 'Games is the canonical baseline');
  for (const [filename,prefix] of [['catalog-review.html','review'],['hardware-review.html','hardware']]) {
    const html=read(filename);
    assert.match(html, new RegExp('class="'+prefix+'-mobile-topbar site-mobile-chrome"'), filename);
    assert.match(html, new RegExp('id="'+prefix+'-mobile-nav"'), filename);
    assert.match(html, /class="site-mobile-chrome__toggle"/, filename);
    assert.match(html, /class="site-mobile-chrome__search" href="index.html#\/search"/, filename);
    assert.deepEqual(extract(html), expected, filename + ' must match the same seven primary links');
    assert.match(html, /href="whats-new.html" aria-current="location">What’s New Today<\/a>/, filename);
    assert.doesNotMatch(html, new RegExp('\\.'+prefix+'-menu-(?:toggle|panel)\\{'), filename + ' must not duplicate the shared CSS');
    assert.match(html, /@media\(max-width:650px\)/, filename);
    assert.match(html, /@media print/, filename);
  }
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome__nav\{margin:0;flex:0 0 44px\}/);
  const catalog=read('catalog-review.html'), hardware=read('hardware-review.html');
  assert.ok(catalog.includes('Seven proposals, not seven new entries.'));
  assert.ok(catalog.includes('data/catalog-candidate-decisions-2026-11-03.json'));
  assert.ok(hardware.includes('65.7 ms is OS boot, not the complete first detection'));
  assert.ok(hardware.includes('Publisher measurements and derived ratios'));
  assert.match(hardware, /\.review-shell>header\{display:block;padding-top:20px\}/);
});

test('research snapshot uses the shared mobile menu and retains contextual research views', () => {
  const html=read('research.html');
  assert.match(html, /class="research-mobile-topbar site-mobile-chrome"/);
  assert.match(html, /<details class="research-mobile-nav site-mobile-chrome__nav" id="research-mobile-nav">/);
  assert.match(html, /class="research-menu-toggle site-mobile-chrome__toggle"/);
  assert.match(html, /class="research-search-link site-mobile-chrome__search" href="index.html#\/search"/);
  assert.match(html, /<link rel="stylesheet" href="site-chrome.css">/);
  const nav=html.match(/<nav class="research-menu-panel site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, 'Research must use the shared mobile menu');
  const expected=[
    ['index.html#/overview','Discover'],['whats-new.html','What’s New Today'],
    ['index.html#/dictionary','Concept dictionary'],['index.html#/technologies','Technology profiles'],
    ['index.html#/games','Games'],['playbooks.html','Playbooks'],['about.html','About']
  ];
  assert.deepEqual([...nav.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(x => [x[1],x[2]]),expected);
  for (const route of ['papers','alerts','coverage'])
    assert.ok(html.includes('href="#'+route+'" data-nav="'+route+'"'), 'Research view must remain reachable: '+route);
  assert.match(html, /\.shell\{display:block\}/);
  assert.match(html, /\.research-local-nav\{display:flex/);
  assert.doesNotMatch(html, /<aside>/);
  const desktop=html.match(/<nav class="site-chrome research-site-chrome" aria-label="AI Updates primary navigation">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(desktop, 'Research must reuse the shared desktop chrome');
  const titles=[...desktop.matchAll(/<a href="[^"]+"(?: aria-current="[^"]+")?>([^<]+)<\/a>/g)].map(x => x[1]);
  assert.deepEqual(titles, ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About']);
  assert.ok(desktop.includes('class="site-chrome__brand" href="index.html#/overview"'));
  assert.doesNotMatch(desktop, /aria-current=/, 'Research must not falsely select the news archive');
  assert.match(html, /href="#papers" data-nav="papers">Research library <span id="papers-count">/);
  assert.match(html, /href="#alerts" data-nav="alerts">Safety observatory <span id="alerts-count">/);
  assert.doesNotMatch(html, /\.research-menu-panel a\{/);
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
  assert.match(html, /@media print\{\.research-mobile-topbar,\.research-local-nav\{display:none\}\}/);
  const publishedTechnologies=JSON.parse(read('publication.json')).published_counts.technologies;
  assert.ok(desktop.includes('href="index.html#/technologies">Technology profiles</a>'));
  assert.ok(html.includes(`all ${publishedTechnologies} technologies`));
  assert.ok(html.includes('Automatic collection remains off.'));
  assert.ok(html.includes('id="loading-status" role="status"'));
});


test('all generated technology profiles use shared directory chrome with native navigation', () => {
  const concept = read('terms/MLD-0002-ablation-study.html');
  const css = read('brand.css');
  assert.match(concept, /<nav class="site-chrome term-nav" aria-label="AI Updates primary navigation">/);
  assert.ok(concept.includes('<script src="../site-theme.js"></script>'));
  assert.doesNotMatch(concept, /<nav class="term-nav" aria-label="Site navigation">/);
  const prefix = '<main class="term-shell" id="main">';
  const directory = read('technology/index.html').split(prefix)[1].split('<header class="hero">')[0];
  assert.match(directory, /class="directory-mobile-topbar site-mobile-chrome"/);
  assert.match(directory, /<nav class="site-chrome term-nav" aria-label="AI Updates primary navigation">/);
  const labels = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
  const links = directory.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)[1];
  assert.deepEqual([...links.matchAll(/<a [^>]+>([^<]+)<\/a>/g)].map(x => x[1]), labels);
  assert.equal((links.match(/aria-current="page"/g) || []).length, 1);
  const profiles = fs.readdirSync(path.join(__dirname, '..', 'technology')).filter(name => /^TECH-\d{4}-.*\.html$/.test(name));
  assert.equal(profiles.length, 303);
  for (const file of profiles) {
    const html = read('technology/' + file);
    assert.ok(html.includes('<link rel="stylesheet" href="../site-chrome.css">'), file);
    assert.ok(html.includes('<script src="../site-theme.js"></script>'), file);
    assert.equal(html.split(prefix)[1].split('<p class="breadcrumb-links">')[0], directory, file);
  }
  const generator = read('scripts/build_seo.py');
  assert.ok(generator.includes("render_directory_nav(prefix, 'Technology profiles') if path.startswith('technology/')"));
  assert.ok(generator.includes("DIRECTORY_MOBILE_CSS if path.startswith('technology/')"));
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes('/* Native, script-free reference pages: readable two-column touch navigation on phones.'));
});


test('all 1345 concept detail pages reuse the native seven-section shared navigation', () => {
  const prefix = '<main class="term-shell" id="main">';
  const dictionaryNav = read('terms/index.html').split(prefix)[1].split('<header class="hero">')[0];
  const manifest = JSON.parse(read('terms/manifest.json'));
  assert.equal(Object.keys(manifest).length, 1345);
  const names = ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles', 'Games', 'Playbooks', 'About'];
  for (const [id, info] of Object.entries(manifest)) {
    const html = read(info.path);
    assert.ok(html.includes('<link rel="stylesheet" href="../site-chrome.css">'), id);
    assert.ok(html.includes('<script src="../site-theme.js"></script>'), id);
    assert.equal(html.split(prefix)[1].split('<header class="hero">')[0], dictionaryNav, id);
    const links = html.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(links, id);
    assert.deepEqual([...links.matchAll(/<a [^>]+>([^<]+)<\/a>/g)].map(x => x[1]), names, id);
    assert.equal((links.match(/aria-current="page"/g) || []).length, 1, id);
  }
  const generator = read('scripts/build_term_pages.py');
  assert.ok(generator.includes("directory_nav = render_directory_nav('../', 'Concept dictionary')"));
  assert.ok(generator.includes('directory_css = DIRECTORY_MOBILE_CSS'));
});

test('script-free reference pages honor dark OS preference with readable cards and links', () => {
  const css = read('brand.css');
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{[\s\S]*?:root:not\(\[data-theme\]\):has\(\.term-shell\)/);
  assert.match(css, /\.term-shell \.detail-block\{background:var\(--surface\)\}/);
  assert.match(css, /\.term-shell \.detail-block\.caveat\{background:var\(--accent-soft\)/);
  assert.match(css, /\.term-shell \.notice\{background:var\(--accent-soft\);border-color:var\(--line\)\}/);
  assert.match(css, /\.term-shell a\{color:var\(--accent\)\}/);
  for (const reference of ['terms/MLD-0002-ablation-study.html', 'technology/TECH-0216-pytorch.html'])
    assert.match(read(reference), /<main class="term-shell" id="main">/);
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes('Script-free reference pages honor the OS dark palette'));
});


test('editorial directories share one responsive primary navigation component', () => {
  const names = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
  const pages = [
    ['whats-new.html','What’s New Today'], ['about.html','About'],
    ['technologies.html','Technology profiles'], ['playbooks.html','Playbooks']
  ];
  for (const [path, active] of pages) {
    const html = read(path);
    assert.match(html, /<link rel="stylesheet" href="site-chrome.css">/);
    const nav = html.match(/<nav class="site-chrome [^"]+" aria-label="AI Updates primary navigation">([\s\S]*?)<\/nav>/);
    assert.ok(nav, path);
    assert.match(nav[1], /class="site-chrome__brand" href="index.html#\/overview"/);
    const links = [...nav[1].matchAll(/<a href="[^"]+"(?: aria-current="page")?>([^<]+)<\/a>/g)];
    assert.deepEqual(links.map(link => link[1]), names, path);
    const selected = nav[1].match(/<a href="[^"]+" aria-current="page">([^<]+)<\/a>/g) || [];
    assert.equal(selected.length, 1, path);
    assert.ok(selected[0].includes('>' + active + '</a>'), path);
  }
  const css = read('site-chrome.css');
  assert.match(css, /\.site-chrome__links a\[aria-current=page\]/);
  assert.match(css, /\.site-chrome__name\{color:inherit!important/);
  assert.match(css, /\.site-chrome a:focus-visible/);
  assert.match(css, /@media \(max-width:650px\)\{\.site-chrome\{display:none!important\}\}/);
  assert.ok(JSON.parse(read('deploy/public-files.json')).root_files.includes('site-chrome.css'));
});

test('editorial evidence reviews reuse the shared desktop site chrome and readable article layout', () => {
  const labels = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
  for (const [route, cls] of [['catalog-review.html','nav'], ['hardware-review.html','review-nav']]) {
    const html=read(route);
    assert.ok(html.includes('<link rel="stylesheet" href="site-chrome.css">'), route);
    const nav=html.split('<nav class="site-chrome '+cls+'" aria-label="AI Updates primary navigation">')[1]?.split('</nav>')[0];
    assert.ok(nav, route);
    assert.ok(nav.includes('class="site-chrome__brand" href="index.html#/overview"'), route);
    const links=[...nav.matchAll(/<a href="[^"]+"(?: aria-current="location")?>([^<]+)<[/]a>/g)];
    assert.deepEqual(links.map(x => x[1]), labels, route);
    assert.ok(nav.includes('href="whats-new.html" aria-current="location">What’s New Today</a>'), route);
    assert.ok(!nav.includes('aria-current="page"'), route);
  }
  assert.ok(read('hardware-review.html').includes('.review-shell>header{display:block}'));
  assert.ok(read('site-chrome.css').includes('.site-chrome__links a[aria-current=location]'));
});

test('standalone editorial pages share Discover theme preference without rewriting storage', () => {
  const script = read('site-theme.js');
  const pages = ['about.html', 'research.html', 'technologies.html', 'playbooks.html', 'hardware-review.html'];
  for (const file of pages) {
    const html = read(file);
    const scriptAt = html.indexOf('<script src="site-theme.js"></script>');
    assert.ok(scriptAt > 0 && scriptAt < html.indexOf('<body'), file + ' restores the theme before its body renders');
    assert.equal(html.split('<script src="site-theme.js"></script>').length, 2, file + ' loads the shared helper once');
  }
  const chromeCss = read('site-chrome.css');
  assert.match(chromeCss, /:root\[data-theme="light"\]\{color-scheme:light\}/);
  assert.match(chromeCss, /:root\[data-theme="dark"\]\{color-scheme:dark\}/);
  assert.match(read('scripts/build_seo.py'), /theme_script = .*site-theme\.js/);
  assert.ok(JSON.parse(read('deploy/public-files.json')).root_files.includes('site-theme.js'));
  for (const chosen of ['dark', 'light', 'bogus']) {
    const root = {dataset: {}, style: {}};
    vm.runInNewContext(script, {
      localStorage: {getItem: key => key === 'atlas.theme' ? chosen : null},
      document: {documentElement: root, addEventListener() {}},
    });
    assert.equal(root.dataset.theme, chosen === 'bogus' ? undefined : chosen);
    assert.equal(root.style.colorScheme, undefined, 'do not pin the former theme inline after a toggle');
  }
  assert.doesNotThrow(() => vm.runInNewContext(script, {
    localStorage: {getItem() { throw new Error('storage blocked'); }},
    document: {documentElement: {dataset: {}, style: {}}, addEventListener() {}},
  }));
});

test('standalone tablets use Discover’s fixed left navigation rail', () => {
  const css = read('site-chrome.css');
  assert.ok(css.includes('@media (min-width:651px){'));
  assert.ok(css.includes('@media (min-width:651px) and (max-width:1150px){'));
  assert.ok(css.includes('body:has(.site-chrome){padding-left:224px}'));
  assert.ok(css.includes('body:has(.site-chrome){padding-left:204px}'));
  assert.ok(css.includes('.site-chrome .site-chrome__links a{font-size:12px!important;padding-inline:9px!important}'));
  assert.ok(css.includes('.site-chrome .site-chrome__links::before{content:"EXPLORE";'));
  assert.ok(css.includes('width:min(260px,calc(100vw - 48px))'));
  assert.ok(css.includes('padding:32px 17px 24px!important;'));
  assert.ok(css.includes('.site-chrome .site-chrome__brand svg{width:35px;height:35px;color:#edbb87}'));
  assert.ok(css.includes('.site-chrome .site-chrome__name{font-size:25px;font-weight:650;'));
  assert.ok(css.includes('.site-chrome .site-chrome__links::before{content:"EXPLORE";'));
  assert.ok(css.includes('color:#fff!important;background:#ffffff13!important'), 'same active rail surface as Discover');
  assert.ok(css.includes('width:min(260px,calc(100vw - 48px))'), 'mobile drawer matches Discover width');
  assert.ok(css.includes('.site-chrome .site-chrome__name small{font-size:8px;letter-spacing:.04em;margin-top:7px;color:#9cab9e}'));
  assert.ok(css.includes('position:fixed!important;inset:0 auto 0 0;width:224px'));
  assert.ok(!css.includes('grid-template-columns:repeat(7,minmax(0,1fr))'));
  for (const path of ['about.html','technologies.html','research.html','playbooks.html',
                      'games.html','whats-new.html','terms/index.html','technology/index.html']) {
    const html = read(path);
    assert.match(html, /<nav class="site-chrome [^"]+" aria-label="AI Updates primary navigation">/, path);
    assert.ok(html.includes('site-chrome.css'),path);
  }
});

test('both generated catalog directories share Discover navigation and the native mobile menu', () => {
  const canonical = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
  for (const [route,active] of [['terms/index.html','Concept dictionary'],['technology/index.html','Technology profiles']]) {
    const html = read(route);
    assert.match(html, /<link rel="stylesheet" href="\.\.\/site-chrome\.css">/);
    assert.match(html, /<script src="\.\.\/site-theme\.js"><\/script>/);
    assert.match(html, /class="directory-mobile-topbar site-mobile-chrome"/);
    assert.match(html, /<details class="site-mobile-chrome__nav" id="directory-mobile-nav">/);
    assert.match(html, /href="\.\.\/index\.html#\/search"/);
    const menus = [...html.matchAll(/<nav class="site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/g)];
    assert.equal(menus.length, 1, route);
    const desktop = html.match(/<nav class="site-chrome term-nav" aria-label="AI Updates primary navigation">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(desktop, route);
    for (const markup of [menus[0][1], desktop]) {
      const labels = [...markup.matchAll(/<a href="\.\.\/[^"]+"(?: aria-current="page")?>([^<]+)<\/a>/g)].map(m=>m[1]);
      assert.deepEqual(labels, canonical, route);
      const selected = markup.match(/<a href="\.\.\/[^"]+" aria-current="page">([^<]+)<\/a>/g) || [];
      assert.equal(selected.length, 1, route);
      assert.ok(selected[0].endsWith('>' + active + '</a>'), route);
    }
    assert.ok(html.includes('THE FRONTIER, IN CONTEXT'), route);
  }
  const termGenerator=read('scripts/build_term_pages.py'), techGenerator=read('scripts/build_seo.py');
  assert.ok(termGenerator.includes("render_directory_nav('../', 'Concept dictionary')"));
  assert.ok(techGenerator.includes("render_directory_nav(prefix, 'Technology profiles')"));
  assert.ok(read('scripts/site_chrome.py').includes('DIRECTORY_MOBILE_CSS'));
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
});

test('standalone page families share a build-time navigation source, including current-section semantics', () => {
  const names = ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About'];
  const routes = ['research.html','catalog-review.html','hardware-review.html','games.html',
                  'technologies.html','playbooks.html','whats-new.html'];
  assert.match(read('scripts/build_seo.py'), /normalize_standalone_chrome\(page\.read_text/);
  assert.match(read('scripts/site_chrome.py'), /markup = render_directory_nav\(/);
  for (const path of routes) {
    const html = read(path);
    const desktop = html.match(/<nav class="site-chrome [^"]+" aria-label="AI Updates primary navigation">([\s\S]*?)<\/nav>/)?.[1];
    const mobile = html.match(/<nav class="[^"]*site-mobile-chrome__menu" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(desktop && mobile, path);
    for (const nav of [desktop,mobile]) {
      const links = [...nav.matchAll(/<a href="[^"]+"(?: aria-current="(?:page|location)")?>([^<]+)<\/a>/g)];
      assert.deepEqual(links.map(m=>m[1]), names, path);
    }
    assert.match(html, /href="index\.html#\/search" aria-label="Search AI Updates in the main collection"/);
    assert.equal((mobile.match(/aria-current=/g)||[]).length,
      path.includes('review') ? 1 : path==='research.html' ? 0 : 1, path);
  }
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome__menu a\[aria-current=location\]/);
});


test('standalone native mobile menus share Escape, outside-pointer and no-JS-safe enhancement', () => {
  for (const file of [
    'terms/MLD-0001-a-b-test.html', 'technology/index.html', 'research.html',
    'games.html', 'whats-new.html', 'about.html', 'catalog-review.html'
  ]) {
    const html = read(file);
    assert.match(html, /<details class="[^"]*site-mobile-chrome__nav/);
    assert.match(html, /<script src="(?:\.\.\/)?site-theme\.js"><\/script>/);
  }
  const listeners = {};
  const summary = { focus() { summary.focused = true; } };
  const inside = {};
  const menu = {
    open: true,
    contains(target) { return target === inside; },
    querySelector(selector) { assert.equal(selector, 'summary'); return summary; }
  };
  const document = {
    documentElement: {dataset: {}, style: {}},
    addEventListener(type, listener) { listeners[type] = listener; },
    querySelectorAll(selector) {
      assert.equal(selector, 'details.site-mobile-chrome__nav[open]');
      return menu.open ? [menu] : [];
    }
  };
  vm.runInNewContext(read('site-theme.js'), {document, localStorage: {getItem() { return null; }}});
  assert.equal(typeof listeners.keydown, 'function');
  assert.equal(typeof listeners.pointerdown, 'function');
  let prevented = false;
  listeners.keydown({key:'Escape', defaultPrevented:false, preventDefault() { prevented = true; }});
  assert.equal(menu.open, false, 'Escape must close open native menu');
  assert.equal(summary.focused, true, 'Escape must return focus to toggle');
  assert.equal(prevented, true);
  menu.open = true;
  listeners.pointerdown({target:inside});
  assert.equal(menu.open, true, 'pointer events inside the menu must not close it');
  listeners.pointerdown({target:{}});
  assert.equal(menu.open, false, 'outside pointer closes the menu');
  menu.open = true;
  listeners.keydown({key:'Escape', defaultPrevented:true});
  assert.equal(menu.open, true, 'respect already-handled Escape events');
});

test('all standalone page families share the Discover desktop sidebar frame', () => {
  const css = read('site-chrome.css');
  assert.match(css, /@media \(min-width:651px\)/);
  assert.ok(css.includes('padding-left:224px'));
  assert.ok(css.includes('padding-left:204px'));
  assert.ok(css.includes('background:var(--sidebar,#202b28)!important'), 'rail follows Discover dark theme');
  assert.ok(css.includes('position:fixed!important;inset:0 auto 0 0;width:224px'));
  assert.ok(css.includes('flex-direction:column!important;flex-wrap:nowrap!important'));
  assert.ok(css.includes('.site-chrome .site-chrome__links a[aria-current]'));
  assert.ok(css.includes('body:has(.site-chrome){padding-left:224px}'));
  assert.ok(css.includes('.games-header__inner{justify-content:flex-end}'));
  assert.ok(css.includes('@media print{'), 'print layouts must restore full article width');
  for (const path of [
    'about.html','terms/index.html','terms/MLD-0002-ablation-study.html',
    'technology/index.html','technology/TECH-0216-pytorch.html',
    'technologies.html','playbooks.html','whats-new.html','research.html',
    'catalog-review.html','hardware-review.html','games.html'
  ]) {
    const html = read(path);
    assert.match(html, /class="site-chrome [^"]+" aria-label="AI Updates primary navigation"/, path);
    assert.match(html, /href="(?:\.\.\/)?index\.html#\/search"/, path);
  }
  assert.ok(!css.includes('@media (min-width:651px) and (max-width:850px)'));
  assert.ok(css.includes('@media (max-width:650px){.site-chrome{display:none!important}}'));
});


test('standalone sections use Discover’s slash-to-search shortcut without stealing text input', () => {
  const script = read('site-theme.js');
  const listeners = {};
  let searches = 0, openMenu = false;
  const search = {click: () => {searches++;}};
  const document = {
    documentElement: {dataset: {}},
    addEventListener: (name, handler) => (listeners[name] ??= []).push(handler),
    querySelector: selector => selector === 'a.site-mobile-chrome__search[href]' ? search :
      selector === 'details.site-mobile-chrome__nav[open]' && openMenu ? {} : null,
  };
  vm.runInNewContext(script, {document, localStorage: {getItem: () => null}});
  const press = (overrides={}) => {
    let prevented = false;
    const e = {key:'/', defaultPrevented:false, repeat:false, isComposing:false,
      ctrlKey:false, metaKey:false, altKey:false, target:{closest: () => null},
      preventDefault: () => {prevented = true;}, ...overrides};
    for(const handler of listeners.keydown) handler(e);
    return prevented;
  };
  assert.equal(press(), true);
  assert.equal(searches, 1);
  assert.equal(press({target:{closest: () => ({tagName:'INPUT'})}}), false);
  assert.equal(press({ctrlKey:true}), false);
  assert.equal(press({metaKey:true}), false);
  assert.equal(press({isComposing:true}), false);
  assert.equal(press({repeat:true}), false);
  openMenu = true;
  assert.equal(press(), false);
  assert.equal(searches, 1);
  assert.match(script, /site-mobile-chrome__search\[href\]/);
});


test('shared native mobile menu adopts Discover off-canvas frame without duplicating navigation', () => {
  const css = read('site-chrome.css');
  const js = read('site-theme.js');
  assert.match(css, /\.site-mobile-chrome:has\(\.site-mobile-chrome__nav\[open\]\)::before/);
  assert.match(css, /\.site-mobile-chrome \.site-mobile-chrome__menu\{[^}]*position:fixed;inset:0 auto 0 0/);
  assert.match(css, /\.site-mobile-chrome \.site-mobile-chrome__menu\{[^}]*width:min\(260px,calc\(100vw - 48px\)\)/);
  assert.match(css, /\.site-mobile-chrome \.site-mobile-chrome__nav\[open\] > \.site-mobile-chrome__toggle/);
  assert.match(css, /display:grid;grid-template-columns:minmax\(0,1fr\);align-content:start/);
  assert.match(css, /gap:4px;padding:70px 16px 22px;overflow:auto/);
  assert.match(css, /background:var\(--sidebar,#202b28\);color:#c5cfc6/);
  assert.match(js, /details\.site-mobile-chrome__nav\[open\]/);
  for (const route of ['about.html','games.html','whats-new.html','research.html','playbooks.html',
                       'terms/MLD-0001-a-b-test.html','technology/index.html']) {
    const page=read(route);
    assert.equal((page.match(/<nav class="[^"]*site-mobile-chrome__menu"/g) || []).length, 1, route);
    assert.match(page, /<details class="[^"]*site-mobile-chrome__nav/);
  }
});

test('shared desktop workspace bar reuses one real search link across page families', () => {
  const css=read('site-chrome.css');
  const js=read('site-theme.js');
  assert.match(css, /body:has\(\.site-chrome\)\{padding-top:78px\}/);
  assert.match(css, /\.site-mobile-chrome\{[\s\S]*?display:flex;[\s\S]*?position:fixed;inset:0 0 auto 224px/);
  assert.ok(css.includes('.site-mobile-chrome[data-page-label]::before{content:attr(data-page-label)}'));
  assert.match(css, /\.site-mobile-chrome\{left:204px;padding-inline:26px\}/);
  assert.match(css, /\.games-header__inner > \.icon-button\{[\s\S]*?position:fixed;top:17px/);
  assert.match(js, /chrome\.dataset\.pageLabel = label/);
  assert.match(css, /\.site-mobile-chrome__nav\{display:none\}/,
    'Do not duplicate desktop section navigation');
  assert.match(css, /@media print\{\.site-mobile-chrome\{display:none!important\}\}/);
  for(const path of ['whats-new.html','games.html','research.html',
      'technologies.html','playbooks.html','catalog-review.html',
      'hardware-review.html','about.html','terms/index.html','technology/index.html']) {
    const html=read(path);
    assert.match(html, /site-mobile-chrome__search" href="(?:\.\.\/)?index\.html#\/search"/,
      path+' must link to the real existing search view');
    assert.equal((html.match(/site-mobile-chrome__search" href=/g) || []).length,1,
      path+' must not render duplicate search links');
  }
});

test('shared native mobile drawer preserves site branding when enhancement is unavailable', () => {
  const css = read('site-chrome.css');
  const script = read('site-theme.js');
  assert.ok(css.includes('.site-mobile-chrome__menu:not(:has(> a.site-mobile-chrome__brand))::after{'));
  assert.ok(css.includes('content:"AI Updates";position:absolute;top:10px;left:72px'));
  assert.ok(css.includes('background:url("favicon.svg") left center/28px 28px no-repeat'));
  assert.ok(script.includes('desktopBrand.cloneNode(true)'), 'enhanced state must reuse the actual desktop brand');
  for (const route of ['games.html','whats-new.html','terms/index.html',
                       'technology/index.html','about.html']) {
    const html = read(route);
    assert.match(html, /<nav class="[^"]*site-mobile-chrome__menu"/, route);
    assert.match(html, /href="(?:\.\.\/)?site-chrome\.css"/, route);
  }
});

test('existing shared standalone chrome exposes the Discover appearance action without cloning navigation', () => {
  const js = read('site-theme.js'), css = read('site-chrome.css');
  new vm.Script(js);
  assert.match(js, /!document\.getElementById\?\.\('theme-toggle'\)/,
    'Games retains its existing theme control, not a duplicate');
  assert.match(js, /for \(const container of \[rail, menu\]\)/,
    'Desktop rail and mobile menu use one shared theme-button implementation');
  assert.match(js, /localStorage\.setItem\('atlas\.theme', chosen\)/,
    'Cross-page theme preference uses Discover existing storage key');
  assert.match(js, /a\[href\],button:not\(\[disabled\]\)/,
    'A new drawer action must join the keyboard focus trap');
  assert.match(css, /\.site-chrome > \.site-chrome__theme-toggle/);
  assert.match(css, /\.site-mobile-chrome__menu > \.site-chrome__theme-toggle/);
  assert.match(js, /'aria-pressed', String\(theme === 'dark'\)/);
});
