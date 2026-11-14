'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
// Reference landing pages intentionally keep the real site navigation outside
// the main landmark, while retaining the exact shared component/links.
const landingNav = html => {
  const skip = '<a class="skip" href="#main">Skip to content</a>';
  const main = '<main class="term-shell">';
  const start = html.indexOf(skip), article = html.indexOf(main, start);
  const hero = html.indexOf('<header class="hero" id="main" tabindex="-1">', article);
  assert.ok(start >= 0 && article > start && hero > article, 'Invalid native article landmark');
  const nav = html.slice(start + skip.length, article);
  assert.ok(nav.includes('<nav class="site-chrome term-nav"'), 'Missing shared navigation');
  assert.ok(nav.includes('site-mobile-chrome'), 'Missing mobile site navigation');
  return nav;
};

// Keep the seven direct primary destinations separate from the one native
// secondary disclosure. Verify all eight secondary links instead of
// silently ignoring or counting them as duplicate primary navigation.
const primaryMobile = menu => {
  const extras = [...menu.matchAll(/<details class="site-mobile-chrome__more"(?: open)?>[\s\S]*?<\/details>/g)];
  assert.ok(extras.length <= 1, 'mobile secondary navigation must not be duplicated');
  if (extras.length) {
    assert.equal((extras[0][0].match(/<a href=/g) || []).length, 8,
                 'mobile secondary navigation retains exactly eight destinations');
  }
  return menu.replace(/<details class="site-mobile-chrome__more"(?: open)?>[\s\S]*?<\/details>/, '');
};

test('Games is an original workspace hash route, not a second website link', () => {
  const html = read('index.html'), app = read('app.js');
  assert.ok(!html.includes('href="games.html"'));
  assert.match(app, /"games":"Games"/);
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
  assert.match(app, /syncAutomaticDisclosure\(more,\['safety','papers','compare','saved','sources'\]\.includes\(view\)\)/);
  assert.match(app, /syncAutomaticDisclosure\(mobileMore,!!mobileMore\?\.querySelector/);
  assert.match(app, /if\(selected && !disclosure\.open\)/);
  assert.match(app, /!selected && disclosure\.dataset\.atlasAutoOpened==='true'/);
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

test('Discover and standalone Games share the mobile drawer appearance action while preserving their original desktop controls', () => {
  const script = read('site-theme.js');
  new vm.Script(script);
  const handlers = {};
  const saved = [];
  const root = {dataset:{}};
  const buttons = [];
  const brand = {};
  const menu = {
    querySelector(selector) {
      return selector === '.site-mobile-chrome__brand' ? brand :
        selector === '.site-chrome__theme-toggle' ? buttons[0] || null : null;
    },
    append(button) { buttons.push(button); }
  };
  const chrome = {dataset:{}, querySelector: () => menu};
  const existing = {
    listeners:{}, attrs:{},
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    click() {
      // Shared listener can run before the app's later click listener.
      this.listeners.click?.();
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    }
  };
  const document = {
    documentElement:root, title:'Discover · AI Updates',
    addEventListener(name, handler) {handlers[name] = handler;},
    querySelector(selector) {return selector === '.site-mobile-chrome' ? chrome : null;},
    getElementById(id) {return id === 'theme-toggle' ? existing : null;},
    createElement(tag) {
      assert.equal(tag, 'button');
      return {
        attrs:{}, listeners:{},
        setAttribute(name, value) {this.attrs[name] = value;},
        addEventListener(name, handler) {this.listeners[name] = handler;}
      };
    }
  };
  const window = {innerWidth:390, addEventListener() {}, matchMedia:()=>({matches:false})};
  const microtasks = [];
  vm.runInNewContext(script, {
    document, window, queueMicrotask: task => microtasks.push(task),
    localStorage: {getItem:()=> 'dark',setItem:(key,value)=>saved.push([key,value])}
  });
  handlers.DOMContentLoaded();
  assert.equal(buttons.length,1,'Discover adds one mobile control, not another desktop button');
  assert.equal(buttons[0].className,'site-chrome__theme-toggle');
  assert.equal(buttons[0].attrs['aria-pressed'],'true');
  assert.equal(existing.attrs['aria-pressed'],'true', 'Discover sidebar mirrors the saved dark state');
  buttons[0].listeners.click();
  assert.equal(root.dataset.theme,'light');
  assert.deepEqual(saved,[['atlas.theme','light']]);
  assert.equal(buttons[0].attrs['aria-pressed'],'false');
  assert.equal(existing.attrs['aria-pressed'],'false', 'Mobile theme change updates Discover sidebar state');
  existing.click();
  assert.equal(existing.attrs['aria-pressed'],'false',
    'The early listener must wait rather than report a stale palette');
  for (const task of microtasks.splice(0)) task();
  assert.equal(root.dataset.theme,'dark');
  assert.equal(buttons[0].attrs['aria-pressed'],'true','desktop theme action keeps mobile label synchronized');
  assert.equal(existing.attrs['aria-pressed'],'true', 'Desktop theme change updates its own accessible state');
  handlers.DOMContentLoaded();
  assert.equal(buttons.length,1,'re-entering the shared initializer cannot duplicate the button');
  // Enter Games with both its own theme button and a desktop rail. The Games
  // header must no longer grow a third mobile control, while its menu gets the
  // same real appearance action available on Discover and editorial pages.
  buttons.length=0;
  document.querySelector = selector => selector === '.site-mobile-chrome' ? chrome :
    selector === '.site-chrome' ? {} : null;
  handlers.DOMContentLoaded();
  assert.equal(buttons.length,1,'Games must have one shared mobile drawer appearance action');
  assert.equal(buttons[0].attrs['aria-pressed'],'true');
  buttons[0].listeners.click();
  assert.equal(root.dataset.theme,'light');
  assert.equal(existing.attrs['aria-pressed'],'false');
  assert.deepEqual(saved.at(-1),['atlas.theme','light'],'Mobile Games persists the selected appearance');
  existing.click();
  for (const task of microtasks.splice(0)) task();
  assert.equal(root.dataset.theme,'dark');
  assert.equal(buttons[0].attrs['aria-pressed'],'true','Games desktop action synchronizes its drawer');
  handlers.DOMContentLoaded();
  assert.equal(buttons.length,1,'Repeated Games initialization must not create another action');
  assert.match(read('site-chrome.css'), /\.games-header__inner > #theme-toggle\{display:none\}/,
    'Games must not show its original desktop theme control beside the mobile search');
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
  const search = el('A'), summary = el('SUMMARY'), desktopLink = el('A');
  desktopLink.focus = () => { document.activeElement = desktopLink; };
  drawer.contains = node => node === summary;
  drawer.matches = selector => selector === 'details.site-mobile-chrome__nav';
  append(body, skip, header, main, preInert);
  append(header, chrome, themeButton);
  append(chrome, drawer, search);
  append(drawer, summary);
  const document = {
    body, documentElement:{dataset:{}}, activeElement:summary,
    addEventListener:(type,handler,capture) => {events[type] = handler; if(type==='toggle') assert.equal(capture,true);},
    querySelector:(selector) => selector === 'details.site-mobile-chrome__nav[open]'
      ? (drawer.open ? drawer : null)
      : selector.startsWith('.site-chrome__links a[aria-current]') ? desktopLink : null,
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
  // A browser may blur the link before the resize handler runs.
  document.activeElement = body;
  window.innerWidth = 768;
  events.resize();
  assert.equal(drawer.open,false, 'tablet resize dismisses the former mobile drawer');
  assert.equal(main.inert,false, 'tablet resize clears mobile-only background isolation');
  assert.equal(document.activeElement,desktopLink,
    'keyboard focus returns to the selected desktop section, not the earlier brand or hidden toggle');
  assert.ok(script.includes("document.querySelector('.site-chrome__links a[aria-current]') ||"),
    'active section must take priority over DOM-earlier brand link');
  assert.equal(preInert.inert,true);
  window.innerWidth = 390;
  events.resize();
  assert.equal(drawer.open,false, 'returning to mobile must not reopen a stale menu');
  assert.equal(main.inert,false, 'workspace stays accessible after rotating back');
  // BFCache restores can blur a menu link before the pageshow handler runs.
  // The shared drawer must close, release inert and put focus on its visible toggle.
  summary.focus = () => { document.activeElement = summary; };
  drawer.querySelector = selector => selector === 'summary' ? summary : null;
  drawer.open = true;
  events.toggle({target:drawer});
  document.activeElement = body;
  events.pageshow({persisted:true});
  assert.equal(drawer.open,false, 'BFCache restoration closes the previously open drawer');
  assert.equal(main.inert,false, 'BFCache restoration restores interaction with the page');
  assert.equal(document.activeElement,summary,
    'BFCache restoration returns keyboard focus to the visible native toggle');
  // A cached mobile drawer restored in desktop layout must never focus the
  // now-hidden mobile toggle. Use the selected desktop rail destination.
  drawer.open = true;
  window.innerWidth = 768;
  document.activeElement = body;
  events.pageshow({persisted:true});
  assert.equal(drawer.open,false, 'BFCache closes mobile drawer after viewport changes');
  assert.equal(main.inert,false);
  assert.equal(document.activeElement,desktopLink,
    'BFCache focuses the visible desktop destination, not a hidden mobile control');
});

test('Discover shares the native script-free mobile drawer used by standalone pages', () => {
  const html=read('index.html'), app=read('app.js'), css=read('app.css');
  const offline=read('downloads/Atlas_Demo_Offline.html');
  const shared=read('site-chrome.css'), generator=read('scripts/site_chrome.py');
  assert.match(generator, /def render_discover_mobile\(\):/);
  assert.match(generator, /links = render_primary_links\("", "Discover"\)/);
  assert.match(html, /<details class="site-mobile-chrome__nav" id="discover-mobile-nav">/);
  assert.match(html, /class="site-mobile-chrome__brand" href="#\/overview"/);
  assert.ok(!html.includes('id="menu-toggle"') && !html.includes('id="mobile-overlay"'));
  assert.match(css, /@media\(max-width:650px\)[\s\S]*?\.sidebar\{display:none\}/);
  assert.match(shared, /\.site-mobile-chrome \.site-mobile-chrome__menu\{/);
  assert.match(shared, /\.discover-mobile-chrome\{display:none!important\}/);
  assert.match(app, /function closeMobileNavigation\(restoreFocus=false\)/);
  assert.match(app, /const fromMobileNav = \$\('discover-mobile-nav'\)\.open/);
  assert.match(app, /syncSharedDrawerIsolation\(\)/, 'Route changes release native drawer isolation before refocusing main');
  assert.match(offline, /<details class="site-mobile-chrome__nav" id="discover-mobile-nav">/);
  assert.ok(!offline.includes('id="mobile-overlay"'));
  const original=[['#/overview','Discover'],['whats-new.html','What’s New Today'],
      ['#/dictionary','Concept dictionary'],['#/technologies','Technology profiles'],
      ['#/games','Games'],['playbooks.html','Playbooks'],['about.html','About']];
  for(const [source, expected] of [[html,original],[offline,
      original.map(([href,name])=>[name==='Playbooks'?'#/playbooks':name==='About'?'#/sources':
        name==='What’s New Today'?'https://aiupdates.app/whats-new.html':href,name])]]) {
    const nav=source.split('id="discover-mobile-nav"')[1]?.split('</nav>')[0];
    assert.ok(nav, 'Shared native menu must survive the offline build');
    const links=[...primaryMobile(nav).matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    assert.deepEqual(links.map(m=>[m[1],m[2]]),expected);
  }
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
    const links = [...primaryMobile(menu).matchAll(/<a href="([^"]+)"(?: aria-current="page")?>([^<]+)<\/a>/g)];
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
  const ours = landingNav(about);
  const template = landingNav(read('terms/index.html'));
  const directorySecondary = template.match(/<details class="site-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
  assert.ok(directorySecondary, 'Reference directory must expose its own secondary navigation');
  const directoryMobileSecondary = template.match(/<details class="site-mobile-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
  assert.ok(directoryMobileSecondary, 'Directory has the canonical script-free mobile secondary links');
  const expected = template.replace(directorySecondary, '').replace(directoryMobileSecondary, '').replaceAll('href="../','href="')
    .replace('data-page-label="Concept encyclopedia"', 'data-page-label="About"')
    .replace('<span class="site-mobile-chrome__title">Concept encyclopedia</span>', '<span class="site-mobile-chrome__title">About</span>')
    .replaceAll('href="index.html#/dictionary" aria-current="page">Concept dictionary','href="index.html#/dictionary">Concept dictionary')
    .replaceAll('href="about.html">About','href="about.html" aria-current="page">About');
  const secondary = ours.match(/<details class="site-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
  assert.ok(secondary, 'About must expose secondary destinations before JS loads');
  const mobileSecondary = ours.match(/<details class="site-mobile-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
  assert.ok(mobileSecondary, 'About retains the exact native mobile secondary component');
  assert.equal(ours.replace(secondary, '').replace(mobileSecondary, ''), expected,
    'Primary About nav must remain identical to generated directory nav');
  assert.match(about, /class="directory-mobile-topbar site-mobile-chrome"/);
  assert.match(about, /id="directory-mobile-nav"/);
  assert.match(about, /href="index.html#\/search"/);
  assert.match(built, /render_directory_nav\(prefix, 'About', mobile_brand=True, page_label='About', topbar_title='About', native_secondary=True, mobile_secondary=True\)/);
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
    const links = [...primaryMobile(content).matchAll(/<a href="([^"]+)"(?: aria-current="(?:page|location)")?>([^<]+)<\/a>/g)];
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
  assert.deepEqual([...primaryMobile(nav).matchAll(/<a href="([^"]+)"(?: aria-current="[^"]+")?>([^<]+)<\/a>/g)].map(x => [x[1],x[2]]),expected);
  for (const route of ['papers','alerts','coverage'])
    assert.ok(html.includes('href="#'+route+'" data-nav="'+route+'"'), 'Research view must remain reachable: '+route);
  assert.match(html, /\.shell\{display:block\}/);
  assert.match(html, /<nav class="research-local-nav discovery-topics" aria-label="Research views">/);
  assert.match(html, /\.research-local-nav a\{[^}]*flex:0 0 auto/);
  assert.doesNotMatch(html, /<aside>/);
  const desktop=html.match(/<nav class="site-chrome research-site-chrome" aria-label="AI Updates primary navigation">([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(desktop, 'Research must reuse the shared desktop chrome');
  const primary=desktop.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(primary, 'Research retains the canonical seven primary links');
  const titles=[...primary.matchAll(/<a href="[^"]+"(?: aria-current="[^"]+")?>([^<]+)<\/a>/g)].map(x => x[1]);
  assert.deepEqual(titles, ['Discover','What’s New Today','Concept dictionary','Technology profiles','Games','Playbooks','About']);
  assert.ok(desktop.includes('class="site-chrome__brand" href="index.html#/overview"'));
  for (const region of [desktop, nav]) {
    assert.equal((region.match(/aria-current=/g) || []).length, 1,
      'Research must identify exactly one current destination per native navigation landmark');
    assert.equal(region.split('href="index.html#/overview">Discover</a>').length - 1, 1,
      'Discover remains reachable as an ordinary parent link');
    assert.equal(region.split('href="index.html#/papers" aria-current="location">Research library</a>').length - 1, 1,
      'Research library is the current secondary destination in each navigation landmark');
  }
  assert.ok(read('scripts/site_chrome.py').includes('"research-site-chrome", "Discover", "location", True)'),
    'canonical header generator must own the active parent, not a hand-edited page');
  assert.match(html, /href="#papers" data-nav="papers">Research library <span id="papers-count">/);
  assert.match(html, /href="#alerts" data-nav="alerts">Safety observatory <span id="alerts-count">/);
  assert.doesNotMatch(html, /\.research-menu-panel a\{/);
  assert.match(read('site-chrome.css'), /\.site-mobile-chrome__menu a\{[^}]*min-height:44px/);
  assert.match(html, /@media print\{\.research-mobile-topbar,\.research-local-nav\{display:none\}\}/);
  const publishedTechnologies=JSON.parse(read('publication.json')).published_counts.technologies;
  assert.ok(desktop.includes('href="index.html#/technologies">Technology profiles</a>'));
  assert.ok(html.includes(`all ${publishedTechnologies} technologies`));
  assert.ok(html.includes('href="whats-new.html">dated What’s New archive</a>'),
    'Research contextual navigation must link to the reviewed daily archive');
  assert.ok(html.includes('not a continuously live news feed'),
    'Editorial pages must distinguish scheduled review from a real-time crawler');
  assert.ok(html.includes('id="loading-status" role="status"'));
});


test('all generated technology profiles use shared directory chrome with native navigation', () => {
  const concept = read('terms/MLD-0002-ablation-study.html');
  const css = read('brand.css');
  assert.match(concept, /<nav class="site-chrome term-nav" aria-label="AI Updates primary navigation">/);
  assert.ok(concept.includes('<script src="../site-theme.js"></script>'));
  assert.doesNotMatch(concept, /<nav class="term-nav" aria-label="Site navigation">/);
  const prefix = '<main class="term-shell">';
  const directory = landingNav(read('technology/index.html'));
  assert.equal((directory.match(/class="site-mobile-chrome__brand"/g)||[]).length,1);
  // Detail and directory pages must share the same eight-link drawer:
  // one real home wordmark and seven unchanged section links.
  const secondary = directory.match(/<details class="site-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
  assert.ok(secondary, 'Technology directory keeps its static secondary disclosure');
  assert.equal((directory.match(/class="site-chrome__more"/g) || []).length, 1);
  const mobileExtra = directory.match(/<details class="site-mobile-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
  assert.ok(mobileExtra, 'Directory carries the eight script-free mobile extras');
  assert.equal((mobileExtra.match(/<a href=/g)||[]).length, 8, 'All eight Discover secondary destinations are present on the directory');
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
    const heading = html.match(/<header class="hero" id="main" tabindex="-1">[\s\S]*?<h1>([^<]+)<\/h1>/)?.[1];
    assert.ok(heading, file + ' must have a native profile heading');
    const detailFrame = directory
      .replace(' data-page-label="Technology profiles"', ' data-page-label="' + heading + '"')
      .replace('<span class="site-mobile-chrome__title">Technology profiles</span>',
        '<span class="site-mobile-chrome__title">' + heading + '</span>');
    assert.equal(landingNav(html), detailFrame, file);
    assert.ok(html.indexOf('<nav class="site-chrome term-nav"') < html.indexOf(prefix),
      file + ' must keep the shared rail outside the content landmark');
    assert.ok(html.indexOf(prefix) < html.indexOf('<p class="breadcrumb-links">'),
      file + ' must retain breadcrumbs inside main');
    assert.equal((html.match(/class="site-mobile-chrome__more"/g)||[]).length, 1, file+' retains exactly one native mobile secondary disclosure');
    assert.equal((html.match(/class="site-mobile-chrome__more-links"/g)||[]).length, 1, file+' keeps one eight-link mobile secondary list');
    assert.equal((html.match(/class="site-chrome__more"/g) || []).length, 1, file);
  }
  const generator = read('scripts/build_seo.py');
  assert.ok(generator.includes("render_directory_nav(prefix, 'Technology profiles', mobile_brand=True, native_secondary=True, mobile_secondary=True, page_label=('Technology profiles' if path == 'technology/index.html' else article_title), topbar_title=('Technology profiles' if path == 'technology/index.html' else article_title)) if path.startswith('technology/')"));
  assert.ok(generator.includes("DIRECTORY_MOBILE_CSS if path.startswith('technology/')"));
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes('/* Native, script-free reference pages: readable two-column touch navigation on phones.'));
});


test('all 1345 concept details share the same script-free primary and secondary mobile routes', () => {
  // Every concept detail page targets its article natively, like technology profiles.
  const dictionaryNav = landingNav(read('terms/index.html'));
  assert.equal((dictionaryNav.match(/class="site-mobile-chrome__brand"/g)||[]).length,1);
  const secondary = dictionaryNav.match(/<details class="site-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
  assert.ok(secondary, 'Concept directory keeps its static secondary disclosure');
  assert.equal((dictionaryNav.match(/class="site-chrome__more"/g) || []).length, 1);
  assert.equal((secondary.match(/<a href=/g) || []).length, 8, 'Preserve all eight Discover secondary routes');
  const mobileExtra = dictionaryNav.match(/<details class="site-mobile-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
  assert.ok(mobileExtra, 'Directory carries eight static mobile secondary destinations');
  // The directory alone is the active secondary destination. Detail pages
  // reuse its exact mobile and desktop link lists with no current-location marker.
  const detailNav = dictionaryNav
    .replace(' data-page-label="Concept encyclopedia"', ' data-page-label="__PROFILE_TITLE__"')
    .replace('<span class="site-mobile-chrome__title">Concept encyclopedia</span>',
      '<span class="site-mobile-chrome__title">__PROFILE_TITLE__</span>')
    .replace('<details class="site-chrome__more" open>', '<details class="site-chrome__more">')
    .replace('<details class="site-mobile-chrome__more" open>', '<details class="site-mobile-chrome__more">')
    .replaceAll('href="../terms/index.html" aria-current="location">Concept encyclopedia',
                'href="../terms/index.html">Concept encyclopedia')
    // Detail pages remain members of the parent dictionary workspace.
    .replaceAll('href="../index.html#/dictionary">Concept dictionary',
                'href="../index.html#/dictionary" aria-current="page">Concept dictionary');
  const guides = JSON.parse(read('content/term-guides.json'));
  assert.equal(Object.keys(guides).length, 57);
  const manifest = JSON.parse(read('terms/manifest.json'));
  assert.equal(Object.keys(manifest).length, 1345);
  const names = ['Discover', 'What’s New Today', 'Concept dictionary', 'Technology profiles', 'Games', 'Playbooks', 'About'];
  for (const [id, info] of Object.entries(manifest)) {
    const html = read(info.path);
    assert.ok(html.includes('<link rel="stylesheet" href="../site-chrome.css">'), id);
    assert.ok(html.includes('<script src="../site-theme.js"></script>'), id);
    const mainOpen = '<main class="term-shell">';
    const heroOpen = '<header class="hero" id="main" tabindex="-1">';
    const nativeNavStart = html.indexOf('<div class="directory-mobile-topbar site-mobile-chrome"');
    const nativeMainStart = html.indexOf(mainOpen);
    assert.ok(nativeNavStart > 0 && nativeNavStart < nativeMainStart, id + ' has native sibling navigation');
    const heading = html.match(/<header class="hero" id="main" tabindex="-1">[\s\S]*?<h1>([^<]+)<\/h1>/)?.[1];
    assert.ok(heading, id + ' must retain a named native article heading');
    assert.equal(html.slice(nativeNavStart, nativeMainStart),
      detailNav.replaceAll('__PROFILE_TITLE__', heading), id);
    assert.ok(nativeMainStart < html.indexOf(heroOpen), id + ' keeps the article heading inside main');
    const extras = html.match(/<details class="site-mobile-chrome__more">[\s\S]*?<\/details>/)?.[0];
    assert.ok(extras, id + ' has native script-free mobile secondary navigation');
    assert.equal((extras.match(/<a href=/g) || []).length, 8, id + ' keeps all eight secondary routes');
    assert.equal((html.match(/class="site-mobile-chrome__more"/g) || []).length, 1, id);
    assert.equal((html.match(/class="site-mobile-chrome__more-links"/g) || []).length, 1, id);
    assert.ok(html.includes('<a class="skip" href="#main">'), id + ' keeps native skip');
    assert.ok(html.indexOf(heroOpen) > html.indexOf('<nav class="site-chrome term-nav"'), id + ' bypasses shared navigation');
    assert.equal((html.match(/id="main"/g) || []).length, 1, id);
    const links = html.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(links, id);
    assert.deepEqual([...links.matchAll(/<a [^>]+>([^<]+)<\/a>/g)].map(x => x[1]), names, id);
    assert.equal((links.match(/aria-current="page"/g) || []).length, 1, id);
  }
  const generator = read('scripts/build_term_pages.py');
  assert.ok(generator.includes("directory_nav = render_directory_nav('../', (None if path == 'terms/index.html' else 'Concept dictionary'), mobile_brand=True, native_secondary=True, mobile_secondary=True, secondary_current=('encyclopedia' if path == 'terms/index.html' else None), page_label=('Concept encyclopedia' if path == 'terms/index.html' else title), topbar_title=('Concept encyclopedia' if path == 'terms/index.html' else title))"));
  assert.ok(generator.includes('directory_css = DIRECTORY_MOBILE_CSS'));
});

test('script-free reference pages honor dark OS preference with readable cards and links', () => {
  const css = read('brand.css');
  assert.match(css, /@media \(prefers-color-scheme: dark\) \{[\s\S]*?:root:not\(\[data-theme\]\):has\(\.term-shell\)/);
  assert.match(css, /\.term-shell \.detail-block\{background:var\(--surface\)\}/);
  assert.match(css, /\.term-shell \.detail-block\.caveat\{background:var\(--accent-soft\)/);
  assert.match(css, /\.term-shell \.notice\{background:var\(--accent-soft\);border-color:var\(--line\)\}/);
  assert.match(css, /\.term-shell a\{color:var\(--accent\)\}/);
  assert.match(read('terms/MLD-0002-ablation-study.html'), /<main class="term-shell">[\s\S]*?<header class="hero" id="main" tabindex="-1">/);
  assert.match(read('technology/TECH-0216-pytorch.html'), /<main class="term-shell">[\s\S]*?<header class="hero" id="main" tabindex="-1">/);
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
    const primary = nav[1].match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(primary, path + ' must retain the seven canonical primary links');
    const links = [...primary.matchAll(/<a href="[^"]+"(?: aria-current="page")?>([^<]+)<\/a>/g)];
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
    const primary=nav.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(primary, route + ' must retain the seven canonical primary links');
    const links=[...primary.matchAll(/<a href="[^"]+"(?: aria-current="location")?>([^<]+)<[/]a>/g)];
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
  for (const [route,active] of [['terms/index.html','Concept encyclopedia'],['technology/index.html','Technology profiles']]) {
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
    const desktopPrimary = desktop.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(desktopPrimary, route + ' keeps a distinct seven-link primary group');
    const secondary = desktop.match(/<details class="site-chrome__more"(?: open)?>[\s\S]*?<\/details>/)?.[0];
    assert.ok(secondary, route + ' exposes Discover secondary routes without JS');
    assert.equal((desktop.match(/class="site-chrome__more"/g) || []).length, 1,
      route + ' must not have duplicate desktop disclosures');
    assert.match(menus[0][1], /<details class="site-mobile-chrome__more"(?: open)?>/, route+' has eight additional script-free mobile destinations');
    const mobilePrimary = menus[0][1].split(/<details class="site-mobile-chrome__more"(?: open)?>/)[0];
    for (const markup of [mobilePrimary, desktopPrimary]) {
      const labels = [...markup.matchAll(/<a href="\.\.\/[^"]+"(?: aria-current="page")?>([^<]+)<\/a>/g)].map(m=>m[1]);
      assert.deepEqual(labels, canonical, route);
      const selected = markup.match(/<a href="\.\.\/[^"]+" aria-current="page">([^<]+)<\/a>/g) || [];
      assert.equal(selected.length, route === 'terms/index.html' ? 0 : 1, route);
      if (route === 'terms/index.html') {
        const fullNav = markup === desktopPrimary ? desktop : menus[0][1];
        assert.equal((fullNav.match(/aria-current="/g) || []).length, 1,
          'Only the active encyclopedia destination may be current');
        assert.match(fullNav, /href="\.\.\/terms\/index\.html" aria-current="location">Concept encyclopedia<\/a>/);
        assert.ok(markup.includes('href="../index.html#/dictionary">Concept dictionary</a>'),
          'The canonical dictionary parent link stays navigable');
      } else {
        assert.ok(selected[0].endsWith('>' + active + '</a>'), route);
      }
    }
    assert.ok(html.includes('THE FRONTIER, IN CONTEXT'), route);
  }
  const termGenerator=read('scripts/build_term_pages.py'), techGenerator=read('scripts/build_seo.py');
  assert.ok(termGenerator.includes("render_directory_nav('../', (None if path == 'terms/index.html' else 'Concept dictionary'), mobile_brand=True, native_secondary=True, mobile_secondary=True, secondary_current=('encyclopedia' if path == 'terms/index.html' else None), page_label=('Concept encyclopedia' if path == 'terms/index.html' else title), topbar_title=('Concept encyclopedia' if path == 'terms/index.html' else title))"));
  assert.ok(techGenerator.includes("render_directory_nav(prefix, 'Technology profiles', mobile_brand=True, native_secondary=True, mobile_secondary=True, page_label=('Technology profiles' if path == 'technology/index.html' else article_title), topbar_title=('Technology profiles' if path == 'technology/index.html' else article_title))"));
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
    const desktopPrimary=desktop.match(/<div class="site-chrome__links">([\s\S]*?)<\/div>/)?.[1];
    assert.ok(desktopPrimary, path + ' retains the canonical primary group');
    for (const nav of [desktopPrimary,primaryMobile(mobile)]) {
      const links = [...nav.matchAll(/<a href="[^"]+"(?: aria-current="(?:page|location)")?>([^<]+)<\/a>/g)];
      assert.deepEqual(links.map(m=>m[1]), names, path);
    }
    assert.match(html, /href="index\.html#\/search" aria-label="Search AI Updates in the main collection"/);
    const expectedCurrent = {
      'research.html': ['location', 'Research library'],
      'catalog-review.html': ['location', 'What’s New Today'],
      'hardware-review.html': ['location', 'What’s New Today'],
      'games.html': ['page', 'Games'],
      'technologies.html': ['page', 'Technology profiles'],
      'playbooks.html': ['page', 'Playbooks'],
      'whats-new.html': ['page', 'What’s New Today'],
    }[path];
    const expectedSelections = [expectedCurrent];
    for (const nav of [desktop, mobile]) {
      const selected = [...nav.matchAll(/<a href="[^"]+" aria-current="(page|location)">([^<]+)<\/a>/g)];
      assert.deepEqual(selected.map(m => [m[1],m[2]]), expectedSelections,
        path+' must expose one canonical current destination per navigation landmark');
    }
    if (path === 'research.html') {
      assert.match(desktop, /<details class="site-chrome__more" open>/);
      assert.match(mobile, /<details class="site-mobile-chrome__more" open>/);
    }
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
  const stored = new Map();
  const sessionStorage = {setItem: (k,v) => stored.set(k,v)};
  const search = {click: () => {searches++;}};
  const document = {
    documentElement: {dataset: {}},
    addEventListener: (name, handler) => (listeners[name] ??= []).push(handler),
    querySelector: selector => selector === 'a.site-mobile-chrome__search[href]' ? search :
      selector === 'details.site-mobile-chrome__nav[open]' && openMenu ? {} : null,
  };
  vm.runInNewContext(script, {document, localStorage: {getItem: () => null}, sessionStorage});
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
  assert.equal(stored.get('atlas.searchShortcutPending'),'1', 'Slash marks a one-shot search focus handoff');
  assert.equal(press({target:{closest: () => ({tagName:'INPUT'})}}), false);
  assert.equal(press({ctrlKey:true}), false);
  assert.equal(press({metaKey:true}), false);
  assert.equal(press({isComposing:true}), false);
  assert.equal(press({repeat:true}), false);
  openMenu = true;
  assert.equal(press(), false);
  assert.equal(searches, 1);
  assert.match(script, /site-mobile-chrome__search\[href\]/);
  // The native mobile search link uses the same one-shot focus handoff
  // whether activated by touch or keyboard, without changing its href.
  const activateSearch = overrides => {
    const event = {
      button:0, defaultPrevented:false, ctrlKey:false, metaKey:false,
      altKey:false, shiftKey:false,
      target:{closest: selector => selector === 'a.site-mobile-chrome__search[href]' ? search : null},
      ...overrides,
    };
    for(const handler of listeners.click) handler(event);
  };
  stored.delete('atlas.searchShortcutPending');
  activateSearch();
  assert.equal(stored.get('atlas.searchShortcutPending'), '1',
    'Following the visible search link should focus the real Discover input');
  for (const modified of [{ctrlKey:true},{metaKey:true},{altKey:true},
                          {shiftKey:true},{button:1},{defaultPrevented:true},
                          {target:{closest: () => null}}]) {
    stored.delete('atlas.searchShortcutPending');
    activateSearch(modified);
    assert.equal(stored.has('atlas.searchShortcutPending'), false,
      'Other interactions must not leave stale focus intent');
  }
  assert.equal(searches, 1, 'Click enhancement must leave native link navigation alone');

});


test('Discover consumes a shared slash shortcut only at the real search route', () => {
  const app = read('app.js');
  assert.match(app, /sessionStorage\.getItem\('atlas\.searchShortcutPending'\)/);
  assert.match(app, /sessionStorage\.removeItem\('atlas\.searchShortcutPending'\)/);
  assert.match(app, /shortcutFocus && view === 'search'/);
  assert.match(app, /\$\('global-query'\)\.focus/);
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
  assert.match(js, /const containers = rail && !existing && desktopAction \? \[desktopAction, menu\] :[\s\S]*?existing \? \[menu\] : \[\];/,
    'Games and Discover both expose the shared mobile drawer action, even when Games has its own desktop button');
  assert.match(css, /\.games-header__inner > #theme-toggle\{display:none\}/,
    'The Games desktop theme action must not become a third mobile header button');
  assert.match(js, /if \(existing\) existing\.addEventListener\('click', \(\) => queueMicrotask\(syncThemeButtons\)\)/,
    'The original Games desktop action must synchronize the mobile drawer appearance');
  assert.match(js, /for \(const container of containers\)/,
    'Standalone desktop and mobile actions share one implementation');
  assert.match(js, /localStorage\.setItem\('atlas\.theme', chosen\)/,
    'Cross-page theme preference uses Discover existing storage key');
  assert.match(js, /a\[href\],button:not\(\[disabled\]\)/,
    'A new drawer action must join the keyboard focus trap');
  assert.match(css, /\.site-chrome \.sidebar-actions \.site-chrome__theme-toggle--rail/);
  assert.match(css, /\.site-mobile-chrome__menu > \.site-chrome__theme-toggle/);
  assert.match(js, /'aria-pressed', String\(theme === 'dark'\)/);
});


test('shared desktop landing intros use Discover\'s workspace content rhythm', () => {
  const css = read('site-chrome.css');
  const scoped = css.split('/* Match Discover\'s first-content position')[1]?.split('/* Discover keeps its real desktop workspace topbar')[0];
  assert.ok(scoped, 'Shared desktop landing intro style must exist');
  assert.match(scoped, /@media \(min-width:651px\)/);
  for (const selector of [
    '.term-shell > .site-chrome + .hero',
    '.playbook-shell > .site-chrome + .playbook-hero',
    '.tech-shell > .site-chrome + .tech-hero',
    '.shell > .site-chrome + main > header',
  ]) assert.ok(scoped.includes(selector), selector+' must share the workspace rhythm');
  assert.equal((scoped.match(/(?:margin-top|padding-top):8px/g)||[]).length,3, 'Use one 8px intro offset for all landing families');
  assert.ok(!scoped.includes('max-width:650px'), 'Keep the established mobile content spacing unchanged');
});

test('Research retains a concise shared workspace label before and after enhancement', () => {
  const generator = read('scripts/site_chrome.py');
  const html = read('research.html');
  const script = read('site-theme.js');
  const stylesheet = read('site-chrome.css');
  assert.match(generator, /"research.html": "Research library"/);
  assert.match(html, /class="research-mobile-topbar site-mobile-chrome" aria-label="AI Updates mobile header" data-page-label="Research library"/);
  assert.match(script, /chrome\.dataset\.pageLabel \|\| active\?\.textContent\?\.trim\(\) \|\| heading\?\.textContent/);
  assert.match(stylesheet, /\.site-mobile-chrome\[data-page-label\]::before\{content:attr\(data-page-label\)\}/);
  assert.ok(!html.includes('aria-current="page">Research library</a>'), 'Research does not invent a canonical primary destination');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(script), 'Offline fallback reuses the exact enhanced theme script');
});

test('Research, Technology and Playbooks reuse Discover editorial heading typography', () => {
  const home = read('index.html'), brand = read('brand.css');
  assert.match(home, /class="discover-heading"><div><p class="eyebrow"/);
  assert.match(brand, /\.discover-heading h1\{font:400 clamp\(40px,4\.2vw,56px\)\/1\.08 Georgia/);
  const pages = [
    ['playbooks.html', '<section class="playbook-hero" id="main" tabindex="-1">', /<h1>Start with the problem, not the framework\.<\/h1>/],
    ['technologies.html', '<section class="tech-hero" id="main" tabindex="-1">', /<h1>Choose tools for their actual edge\.<\/h1>/],
    ['research.html', '<section class="hero" id="main" tabindex="-1">', /<h1 id="view-title">Follow the evidence\.<\/h1>/],
  ];
  for (const [route, sectionStart, heading] of pages) {
    const html = read(route);
    const section = html.split(sectionStart)[1]?.split('</section>')[0];
    assert.ok(section, route+' intro must exist');
    assert.match(section, /<div class="discover-heading"><div><p class="eyebrow"/);
    assert.match(section, heading);
    assert.match(section, /<\/h1>\s*<\/div>\s*<\/div>\s*<p/, route+' descriptive text must remain outside the heading component');
    assert.match(html, /<link rel="stylesheet" href="brand.css">/);
  }
});


test('editorial and reference hero headings reuse Discover rather than page-specific type rules', () => {
  const brand = read('brand.css');
  assert.match(brand, /\.discover-heading h1\{font:400 clamp\(40px,4\.2vw,56px\)\/1\.08 Georgia/);
  for (const [route, heading, formerRule] of [
    ['about.html', 'The frontier, in context.', '.term-shell h1{font:'],
    ['hardware-review.html', 'What did the STT-MRAM AI chip actually demonstrate?', '.review-shell h1{font:'],
    ['catalog-review.html', 'Seven proposals, not seven new entries.', 'h1{font:400 clamp(38px'],
  ]) {
    const html = read(route);
    assert.equal((html.match(/class="discover-heading"/g) || []).length, 1, route+' must reuse one shared hero heading');
    const hero = html.split('<div class="discover-heading"><div>')[1]?.split('</div></div>')[0];
    assert.ok(hero?.startsWith('<p class="eyebrow">') && hero.includes('</p><h1>') && hero.includes('</h1>'),
      route+' must preserve one heading and its editorial eyebrow inside the shared component');
    assert.ok(html.includes('<h1>'+heading+'</h1>'), route+' retains its unchanged public title');
    assert.ok(!html.includes(formerRule), route+' must not preserve obsolete independent h1 sizing');
    assert.ok(html.includes('<link rel="stylesheet" href="brand.css">'), route+' must load the shared source of typography');
  }
});

test('all page families share the real Discover wordmark before JavaScript', () => {
  const generator = read('scripts/site_chrome.py');
  const theme = read('site-theme.js');
  assert.match(generator, /mobile_wordmark = render_brand\(prefix, "site-mobile-chrome__brand"\)/);
  assert.match(generator, /mobile_brand=True/);
  assert.match(theme, /!menu\.querySelector\('\.site-mobile-chrome__brand'\)/,
    'hydration must not duplicate an already-shipped brand link');
  for (const route of [
    'about.html', 'catalog-review.html', 'hardware-review.html',
    'research.html', 'playbooks.html', 'technologies.html', 'whats-new.html',
    'games.html', 'terms/index.html', 'technology/index.html',
    'terms/MLD-0002-ablation-study.html', 'technology/TECH-0216-pytorch.html'
  ]) {
    const html = read(route);
    const menu = html.match(/<nav class="[^"]*site-mobile-chrome__menu[^"]*" aria-label="AI Updates sections">([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(menu, route+' keeps its native drawer');
    const brand = menu.match(/^<a class="site-mobile-chrome__brand" href="([^"]+)" aria-label="AI Updates home">/);
    assert.ok(brand, route+' has a real keyboard-accessible logo on first paint');
    const expected = route.includes('/') ? '../index.html#/overview' : 'index.html#/overview';
    assert.equal(brand[1], expected, route+' logo goes to Discover');
    assert.equal((primaryMobile(menu).match(/<a /g) || []).length, 8, route+' has one logo and seven section links');
    assert.equal((menu.match(/class="site-mobile-chrome__brand"/g) || []).length, 1);
    assert.match(menu, /<svg viewBox="0 0 36 36"/, route+' uses the same SVG wordmark');
  }
  assert.match(read('scripts/build_seo.py'), /mobile_brand=True/);
  assert.match(read('scripts/build_term_pages.py'), /mobile_brand=True/);
});

test('shared workspace topbar has the correct no-script section label on every standalone family', () => {
  const source = read('scripts/site_chrome.py');
  const seo = read('scripts/build_seo.py');
  const stylesheet = read('site-chrome.css');
  assert.match(source, /"research.html": "Research library"/);
  assert.match(source, /"catalog-review.html": "Catalog review"/);
  assert.match(source, /"hardware-review.html": "Hardware evidence"/);
  assert.ok(seo.includes("render_directory_nav(prefix, 'About', mobile_brand=True, page_label='About', topbar_title='About', native_secondary=True, mobile_secondary=True)"));
  assert.ok(stylesheet.includes('.site-mobile-chrome[data-page-label]::before{content:attr(data-page-label)}'));
  const labels = {
    'about.html': 'About',
    'research.html': 'Research library',
    'catalog-review.html': 'Catalog review',
    'hardware-review.html': 'Hardware evidence',
    'games.html': 'Games',
    'technologies.html': 'Technology profiles',
    'playbooks.html': 'Playbooks',
    'whats-new.html': 'What’s New Today',
  };
  for (const [route, label] of Object.entries(labels)) {
    const html = read(route);
    const headers = [...html.matchAll(/<div class="[^"]*\bsite-mobile-chrome\b[^"]*"[^>]*>/g)];
    assert.equal(headers.length, 1, route + ': exactly one shared workspace header');
    assert.ok(headers[0][0].includes(' data-page-label="' + label + '"'), route + ': no-script title');
    assert.equal((headers[0][0].match(/data-page-label=/g) || []).length, 1, route);
    assert.equal((html.match(/class="site-chrome__links"/g) || []).length, 1, route);
  }
});

test('generated reference workspace labels use the selected canonical rail on first paint', () => {
  const css = read('site-chrome.css');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  for (const [view, label, routes] of [
    ['dictionary', 'Concept dictionary', ['terms/index.html', 'terms/MLD-0002-ablation-study.html']],
    ['technologies', 'Technology profiles', ['technology/index.html', 'technology/TECH-0216-pytorch.html']]
  ]) {
    const rule = '.term-shell > .site-mobile-chrome:not([data-page-label]):has(+ .site-chrome .site-chrome__links a[href$="#/' + view + '"][aria-current="page"])::before{content:"' + label + '"}';
    assert.ok(css.includes(rule), 'shared desktop no-script title for ' + view);
    assert.ok(offline.includes(rule), 'offline fallback was rebuilt with the shared stylesheet');
    for (const route of routes) {
      const html = read(route);
      assert.match(html, /class="directory-mobile-topbar site-mobile-chrome"/, route);
      if (route === 'terms/index.html') {
        assert.ok(html.includes('href="../index.html#/dictionary">Concept dictionary</a>'),
          'The primary dictionary link stays available');
        assert.equal((html.match(/href="\.\.\/index\.html#\/dictionary" aria-current="page"/g) || []).length, 0);
        assert.equal((html.match(/href="\.\.\/terms\/index\.html" aria-current="location"/g) || []).length, 2,
          'Both native navigation landmarks must identify the encyclopedia only');
      } else {
        assert.ok(html.includes('href="../index.html#/' + view + '" aria-current="page">' + label + '</a>'), route);
      }
      assert.equal((html.match(/class="site-chrome__links"/g) || []).length, 1, route);
    }
  }
});


test('shared standalone rails reuse the seven Discover SVG icon geometries at desktop widths', () => {
  const source = read('scripts/site_chrome.py');
  const css = read('site-chrome.css');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  const start = '/* atlas-rail-icons:begin */', end = '/* atlas-rail-icons:end */';
  assert.equal(css.split(start).length, 2);
  assert.equal(css.split(end).length, 2);
  const block = css.slice(css.indexOf(start), css.indexOf(end) + end.length);
  const rules = [...block.matchAll(/\.site-chrome \.site-chrome__links a\[href\$="([^"]+)"\]\{--atlas-rail-icon:url\("(data:image\/svg\+xml,[^"]+)"\)\}/g)];
  assert.deepEqual(rules.map(m=>m[1]), ['index.html#/overview', 'whats-new.html', 'index.html#/dictionary', 'index.html#/technologies', 'index.html#/games', 'playbooks.html', 'about.html']);
  for (const rule of rules) {
    const icon = decodeURIComponent(rule[2].split(',')[1]);
    assert.ok(icon.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"'), 'SVG CSS image must carry the XML namespace');
    assert.ok(icon.includes('aria-hidden="true"') && icon.includes('<path d='));
  }
  assert.match(source, /for \(route, _\), \(_, _, icon\) in zip\(DESTINATIONS, DISCOVER_LINKS, strict=True\)/);
  assert.match(read('scripts/build_seo.py'), /sync_desktop_rail_icons_css\(previous_css\)/);
  assert.ok(offline.includes(block), 'offline fallback embeds the same shared stylesheet');
});


test('reference and editorial section headings reuse Discover reading-desk typography', () => {
  const css = read('site-chrome.css'), brand = read('brand.css');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.match(brand, /\.reading-link h2\{font:400 25px\/1\.25 Georgia,serif/);
  assert.match(css, /:is\(\.term-shell > \.profile-section, \.term-shell > \.detail-block,/);
  assert.match(css, /\.review-shell > section, \.shell > main > section\) > h2\{/);
  assert.match(css, /font:400 clamp\(21px,2\.2vw,25px\)\/1\.25 Georgia,'Times New Roman',serif/);
  assert.match(css, /color:var\(--ink\)/);
  assert.ok(offline.includes('Editorial/reference subsections use Discover'), 'single-file demo embeds the same source CSS');
  for (const [page, heading] of [
    ['about.html', 'class="profile-section"><h2>'],
    ['catalog-review.html', '<h2 id="tools">'],
    ['hardware-review.html', '<section>'],
    ['terms/MLD-0002-ablation-study.html', 'class="detail-block'],
    ['technology/TECH-0216-pytorch.html', 'class="profile-section']
  ]) assert.ok(read(page).includes(heading), page + ' remains covered by the shared selector');
});

test('one shared editorial workspace reading frame aligns existing page families, not news or Games', () => {
  const css=read('site-chrome.css'), offline=read('downloads/Atlas_Demo_Offline.html');
  const block=css.split('/* One desktop reading frame shared by existing editorial and reference families.')[1]?.split('/* atlas-rail-icons:begin */')[0];
  assert.ok(block, 'shared frame must be present in the source stylesheet');
  assert.match(block, /@media \(min-width:651px\)/);
  assert.match(block, /max-width:1120px!important/);
  assert.match(block, /padding-inline:clamp\(24px,3vw,36px\)!important/);
  assert.match(block, /max-width:74ch/);
  for (const selector of ['.term-shell','.tech-shell','.playbook-shell','.review-shell',
    '.shell:has(> .site-chrome.nav)', '.shell:has(> .site-chrome.research-site-chrome)']) {
    assert.ok(block.includes(selector), 'shared frame missing '+selector);
  }
  assert.ok(!block.includes('.discover-layout') && !block.includes('.games-body') &&
    !block.includes('.shell{'), 'news and playable Games must keep distinct layouts');
  assert.ok(offline.includes('/* One desktop reading frame shared by existing editorial and reference families.') &&
    offline.includes(block), 'offline build embeds the exact current shared frame');
  for (const route of ['about.html','technologies.html','playbooks.html','hardware-review.html',
    'catalog-review.html','research.html','terms/MLD-0002-ablation-study.html',
    'technology/TECH-0216-pytorch.html']) {
    assert.match(read(route), /site-chrome\.css/, route+' reuses shared CSS');
  }
});

test('shared editorial cards adopt Discover surface geometry without touching Games', () => {
  const css=read('site-chrome.css'), offline=read('downloads/Atlas_Demo_Offline.html');
  const marker='/* Shared editorial card surfaces across existing page families.';
  assert.equal(css.split(marker).length,2,'only one canonical shared editorial surface rule');
  const rule=marker+css.split(marker)[1].split('/* atlas-rail-icons:begin */')[0];
  assert.ok(offline.includes(rule),'offline fallback embeds exact shared card rule');
  for (const fragment of [
    '.term-shell > .profile-section', '.term-shell > .detail-block:not(.caveat)',
    '.playbook-shell .playbook', '.tech-shell .tech-card',
    '.shell:has(> .site-chrome.nav) article.card',
    '.shell:has(> .site-chrome.research-site-chrome) .cards > .card',
    '.shell:has(> .site-chrome.top) .panel',
    'background:var(--atlas-card-surface);', 'border:1px solid var(--atlas-card-line);',
    'border-radius:11px;', 'padding:clamp(18px,2vw,24px);'
  ]) assert.ok(rule.includes(fragment),'missing shared card contract '+fragment);
  assert.ok(rule.includes(':root:not([data-theme="light"])') && rule.includes(':root[data-theme="dark"]'),
    'OS and explicit dark themes must match the shared card palette');
  assert.ok(!rule.includes('.games-body') && !rule.includes('.discovery-card{'),
    'do not override Games or redefine Discover cards');
  for (const route of ['about.html','whats-new.html','technologies.html','playbooks.html',
    'research.html','catalog-review.html','terms/MLD-0002-ablation-study.html',
    'technology/TECH-0216-pytorch.html'])
    assert.match(read(route),/site-chrome\.css/,route+' must load the shared stylesheet');
});

test('shared static-page footers follow Discover rhythm without replacing section links', () => {
  const css=read('site-chrome.css'), offline=read('downloads/Atlas_Demo_Offline.html');
  const marker='/* Shared editorial footer rhythm:';
  assert.equal(css.split(marker).length,2,'one shared footer treatment');
  const rule=marker+css.split(marker)[1].split('/* atlas-rail-icons:begin */')[0];
  assert.ok(offline.includes(rule),'offline fallback embeds the exact footer treatment');
  assert.ok(rule.includes('body:has(.site-chrome) footer{'), 'real shared footer selector');
  for (const expected of ['margin-top:42px;','padding:20px 0 0;',
    'border-top:1px solid var(--atlas-footer-line);',
    'overflow-wrap:anywhere;','footer a:focus-visible',
    '--atlas-footer-muted:#5d6861;','--atlas-footer-line:#3b4a40;',
    ':root:not([data-theme="light"])']) {
    assert.ok(rule.includes(expected),'shared footer missing '+expected);
  }
  const legacy=rule.split('body:has(.site-chrome) footer{')[1]?.split('}')[0] || '';
  assert.doesNotMatch(legacy, /(?:font-size|line-height)\s*:/,
    'shared native footer must inherit typography rather than override the canonical component');
  assert.ok(css.includes('font-size:13px;line-height:1.65;'),
    'the global component provides an accessible consistent 13px reading scale');
  assert.ok(!rule.includes('.main-footer{') && !rule.includes('footer{display:none'),
    'never override Discover or suppress a real footer');
  for (const route of ['about.html','whats-new.html','terms/index.html',
    'terms/MLD-0002-ablation-study.html','technologies.html',
    'technology/TECH-0216-pytorch.html','research.html','playbooks.html',
    'catalog-review.html','hardware-review.html','games.html']) {
    const html=read(route);
    assert.ok(html.includes('<footer'),route+' retains its actual content footer');
    assert.ok(html.includes('site-chrome.css'),route+' loads the same footer source');
  }
});


test('shared filter fields use Discover-style native controls across existing workspaces', () => {
  const css=read('site-chrome.css');
  const offline=read('downloads/Atlas_Demo_Offline.html');
  const begin='/* atlas-filter-controls:begin */', end='/* atlas-filter-controls:end */';
  assert.equal(css.split(begin).length,2,'one shared filter control source');
  assert.equal(css.split(end).length,2,'one closing filter control marker');
  const shared=css.slice(css.indexOf(begin),css.indexOf(end)+end.length);
  assert.ok(offline.includes(shared),'offline fallback contains identical shared control CSS');
  for (const required of [
    '.tech-controls,.playbook-tools,.controls,.filters,.search-controls',
    'input[type="search"],select', 'min-height:42px;', 'border-radius:7px;',
    'font-size:16px;', 'min-height:44px;', ':focus-visible',
    '--atlas-control-surface:#222d27;', '--atlas-control-ink:#f1f5ef;',
    ':root:not([data-theme="light"])'
  ]) assert.ok(shared.includes(required),'missing shared behavior: '+required);
  const families=[
    ['technologies.html','tech-controls','tech-search'],
    ['playbooks.html','playbook-tools','id="search"'],
    ['research.html','class="controls"','id="query"'],
    ['games.html','class="filters"','id="query"'],
    ['whats-new.html','search-controls','id="edition-search"']
  ];
  for (const [path,wrapper,field] of families) {
    const html=read(path);
    assert.ok(html.includes('href="site-chrome.css"'),path+' must load the shared component');
    assert.ok(html.includes(wrapper) && html.includes(field),path+' has a real native filter field');
    assert.ok(html.includes('type="search"'),path+' has a functional search input');
  }
  assert.ok(!shared.includes('pointer-events:none') && !shared.includes('display:none'),
    'never hide or fake an existing search control');
});


test('technology and playbook evidence notes share the Discover palette in both themes', () => {
  const css=read('site-chrome.css'), offline=read('downloads/Atlas_Demo_Offline.html');
  const marker='/* atlas-shared-evidence-callouts:begin */';
  const end='/* atlas-shared-evidence-callouts:end */';
  assert.equal(css.split(marker).length,2);
  const rule=css.slice(css.indexOf(marker),css.indexOf(end)+end.length);
  assert.ok(offline.includes(rule),'offline uses the same shared evidence component');
  for (const token of ['.tech-shell .tech-warning', '.playbook-shell .playbook-note',
    'background:var(--accent-soft', 'color:var(--ink',
    'border-left:4px solid var(--accent', 'a:focus-visible']) {
    assert.ok(rule.includes(token),'missing accessible shared evidence treatment: '+token);
  }
  assert.ok(!css.includes('/* atlas-note-contrast:begin */'),
    'legacy dark-only overrides must not conflict with the theme-aware component');
  const brand=read('brand.css');
  for (const token of ['--accent-soft:#E9EEE7', '--accent-soft:#2D4033',
    '--ink:#18211E', '--ink:#F6F6F2']) {
    assert.ok(brand.includes(token),'missing shared light/dark contrast token: '+token);
  }
  assert.ok(read('technologies.html').includes('class="tech-warning"'));
  assert.ok(read('playbooks.html').includes('class="playbook-note"'));
});


test('shared informational callouts are one accessible theme-aware surface across research and reference families',()=>{
  const css=read('site-chrome.css'),offline=read('downloads/Atlas_Demo_Offline.html');
  const start='/* atlas-info-callouts:begin */',end='/* atlas-info-callouts:end */';
  assert.equal(css.split(start).length,2);
  const rule=css.slice(css.indexOf(start),css.indexOf(end)+end.length);
  assert.ok(offline.includes(rule),'single-file offline demo contains identical shared note treatment');
  for(const token of ['.term-shell .notice','.site-chrome.research-site-chrome',
       '.site-chrome.nav','.review-shell .review-callout',
       ':root[data-theme="dark"]','--atlas-info-bg:#2d4033',
       '--atlas-info-text:#edf4ee','--atlas-info-border:#577261',
       'border-left:4px solid var(--atlas-info-accent)']){
    assert.ok(rule.includes(token),'missing common information-note rule '+token);
  }
  for(const [route,cls] of [
    ['research.html','class="notice"'],
    ['catalog-review.html','class="notice"'],
    ['hardware-review.html','class="review-callout"'],
    ['terms/MLD-0002-ablation-study.html','class="notice"'],
    ['technology/TECH-0216-pytorch.html','class="notice"']
  ])assert.ok(read(route).includes(cls),route+' retains the real shared note');
  assert.ok(rule.includes('.term-shell .notice a{white-space:normal'),'directory notice links may wrap on 320px mobile');
  assert.ok(!rule.includes('.detail-block.caveat'),'specialized research warnings unchanged');
});

test('shared native drawers restore keyboard focus and inert state after dismissal and BFCache', () => {
  const source=read('site-theme.js'), offline=read('downloads/Atlas_Demo_Offline.html');
  new vm.Script(source);
  assert.match(source,/function closeSharedDrawers\(\{restoreFocus = false, desktopFocus = false\} = \{\}\)/);
  assert.match(source,/const hadFocus = menu\.contains\(document\.activeElement\)/);
  assert.match(source,/menu\.querySelector\('summary'\)\?\.focus\(\{preventScroll:true\}\)/);
  assert.match(source,/closeSharedDrawers\(\{restoreFocus:true\}\)/);
  assert.match(source,/window\.addEventListener\('pageshow', \(event\) =>/);
  assert.match(source,/if \(event\.persisted\) \{/);
  assert.match(source,/closeSharedDrawers\(desktopNow \? \{desktopFocus:true\} : \{restoreFocus:true\}\);\s*restoreSharedThemeAfterHistory\(\)/,
    'BFCache restoration must focus the native menu toggle even if the browser blurred its links');
  assert.ok(offline.includes(source),'offline demo must embed the exact shared drawer behavior');
  for(const route of ['index.html','about.html','whats-new.html','technologies.html',
    'playbooks.html','research.html','games.html','terms/index.html',
    'technology/TECH-0216-pytorch.html']) {
    assert.match(read(route),/site-theme\.js/,route+' must use the shared drawer helper');
  }
});

test('Discover mobile live search shares the native search frame used across the site',()=>{
  const css=read('site-chrome.css'),offline=read('downloads/Atlas_Demo_Offline.html');
  const begin='/* atlas-mobile-search-frame:begin */',end='/* atlas-mobile-search-frame:end */';
  assert.equal(css.split(begin).length,2,'one shared mobile search frame source');
  const block=css.slice(css.indexOf(begin),css.indexOf(end)+end.length);
  assert.ok(offline.includes(block),'offline fallback reuses the precise shared frame');
  for(const s of [':is(.site-mobile-chrome__search,','.topbar:has(.discover-mobile-chrome) .global-search',
      'min-height:44px;','border-radius:9px;','font-size:16px;','color:var(--ink,#202b28);'])
    assert.ok(block.includes(s),'shared mobile search missing '+s);
  const home=read('index.html');
  assert.match(home,/<form class="global-search" id="global-search" role="search">/);
  assert.match(home,/<input id="global-query" type="search"/);
  assert.match(read('app.js'),/\$\('global-search'\)\.addEventListener\('submit'/);
  for(const page of ['about.html','whats-new.html','games.html','technologies.html']){
    assert.ok(read(page).includes('site-mobile-chrome__search'),page+' retains its working search destination');
  }
});


test('editorial subpage identity wins over the selected daily navigation section', () => {
  const script = read('site-theme.js');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.match(script, /const label = chrome\.dataset\.pageLabel \|\| active\?\.textContent\?\.trim\(\)/);
  assert.ok(offline.includes(script), 'single-file fallback includes updated shared theme helper');
  for (const [route, identity] of [
    ['catalog-review.html', 'Catalog review'],
    ['hardware-review.html', 'Hardware evidence'],
  ]) {
    const html = read(route);
    assert.ok(html.includes('data-page-label="' + identity + '"'), route + ' has its real subpage label');
    assert.match(html, /href="whats-new\.html" aria-current="location">What’s New Today<\/a>/,
      route + ' keeps the correct selected parent section');
    assert.equal((html.match(/data-page-label=/g) || []).length, 1, route + ' owns one label');
  }
});

test('BFCache restoration synchronizes saved theme and shared controls', () => {
  const events = {};
  let storedTheme = 'light';
  const buttons = Array.from({length: 2}, () => ({
    attrs:{}, textContent:'',
    setAttribute(name, value) { this.attrs[name] = value; }
  }));
  const document = {
    documentElement: {dataset: {theme:'light'}},
    addEventListener() {},
    querySelectorAll(selector) {
      if (selector === 'details.site-mobile-chrome__nav[open]') return [];
      if (selector === '.site-chrome__theme-toggle') return buttons;
      throw new Error('Unexpected selector ' + selector);
    }
  };
  const window = {innerWidth:1280, addEventListener(name, listener) { events[name] = listener; }};
  vm.runInNewContext(read('site-theme.js'), {
    document, window, localStorage: {getItem: () => storedTheme}
  });
  storedTheme = 'dark';
  events.pageshow({persisted:true});
  assert.equal(document.documentElement.dataset.theme, 'dark');
  for (const b of buttons) {
    assert.equal(b.attrs['aria-pressed'], 'true');
    assert.equal(b.textContent, '◐  Dark theme');
  }
  storedTheme = 'light';
  events.pageshow({persisted:true});
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(buttons[0].attrs['aria-pressed'], 'false');
  assert.equal(buttons[0].textContent, '◐  Light theme');
  storedTheme = 'dark';
  events.pageshow({persisted:false});
  assert.equal(document.documentElement.dataset.theme, 'light');
  storedTheme = null;
  events.pageshow({persisted:true});
  assert.equal(document.documentElement.dataset.theme, 'light');
});

test('closed shared mobile toggle restores focus to the selected desktop rail', () => {
  const handlers={};
  const body={};
  const root={dataset:{}};
  let window;
  const summary={
    matches(selector){return selector==='details.site-mobile-chrome__nav summary';},
    getClientRects(){return window.innerWidth<=650?[{}]:[];},
    focus(){document.activeElement=summary;}
  };
  const railLink={
    getClientRects(){return window.innerWidth>650?[{}]:[];},
    focus(){document.activeElement=railLink;},
    closest(selector){return selector.includes('.site-chrome')?{}:null;}
  };
  const contentInput={matches(){return false;},closest(){return null;}};
  const document={
    body,documentElement:root,activeElement:summary,
    addEventListener(name,fn){handlers[name]=fn;},
    querySelectorAll(selector){
      assert.equal(selector,'details.site-mobile-chrome__nav[open]');
      return [];
    },
    querySelector(selector){
      if(selector==='details.site-mobile-chrome__nav[open]')return null;
      if(selector==='details.site-mobile-chrome__nav summary')return summary;
      // This primary-only fixture intentionally has no selected secondary link.
      if(selector==='.site-chrome__more a[aria-current]')return null;
      if(selector==='.site-chrome__links a[aria-current]')return railLink;
      throw new Error('Unexpected selector '+selector);
    }
  };
  window={innerWidth:390,addEventListener(name,fn){handlers[name]=fn;}};
  const source=read('site-theme.js');
  vm.runInNewContext(source,{document,window,localStorage:{getItem(){return null;}}});
  handlers.focusin({target:summary});
  // A browser can blur the closed toggle before firing the resize event.
  document.activeElement=body;
  window.innerWidth=768;
  handlers.resize();
  assert.strictEqual(document.activeElement,railLink,
    'hidden closed mobile toggle must restore focus to the visible desktop section');
  window.innerWidth=390;
  handlers.resize();
  handlers.focusin({target:contentInput});
  document.activeElement=contentInput;
  window.innerWidth=768;
  handlers.resize();
  assert.strictEqual(document.activeElement,contentInput,
    'responsive navigation must not steal focus from unrelated content');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(source),
    'offline fallback must embed the same shared navigation handoff');
});

test('shared rail restores keyboard focus to visible mobile toggle after responsive shrink', () => {
  const handlers = {};
  const body = {};
  const root = {dataset:{}};
  const summary = {focus() { document.activeElement = summary; }};
  const railLink = {
    getClientRects() { return []; },
    closest(selector) { return selector.includes('.site-chrome') ? {} : null; }
  };
  const contentInput = {closest() { return null; }};
  const document = {
    body, documentElement:root, activeElement:body,
    addEventListener(name, fn) { handlers[name] = fn; },
    querySelectorAll(selector) {
      assert.equal(selector,'details.site-mobile-chrome__nav[open]');
      return [];
    },
    querySelector(selector) {
      if(selector==='details.site-mobile-chrome__nav[open]')return null;
      if(selector==='details.site-mobile-chrome__nav summary')return summary;
      throw new Error('Unexpected selector '+selector);
    }
  };
  const window = {
    innerWidth:768,
    addEventListener(name, fn) { handlers[name] = fn; }
  };
  const script = read('site-theme.js');
  vm.runInNewContext(script, {window, document, localStorage:{getItem(){return null;}}});
  assert.equal(typeof handlers.focusin,'function');
  handlers.focusin({target:railLink});
  document.activeElement=body; // Chromium blurs a hidden link before resize.
  window.innerWidth=390;
  handlers.resize();
  assert.strictEqual(document.activeElement,summary,
    'a hidden desktop link must hand keyboard focus to the visible toggle');
  document.activeElement=body;
  window.innerWidth=320;
  handlers.resize();
  assert.strictEqual(document.activeElement,body,
    'resizing within mobile must not steal focus again');
  window.innerWidth=768;
  handlers.resize();
  handlers.focusin({target:contentInput});
  document.activeElement=contentInput;
  window.innerWidth=390;
  handlers.resize();
  assert.strictEqual(document.activeElement,contentInput,
    'main content focus must remain unchanged on the same transition');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(script),
    'the offline fallback must contain the exact responsive focus helper');
});


test('Guided demo inherits the actual shared navigation instead of an independent header', () => {
  const html=read('demo.html');
  const about=read('about.html');
  const generated=read('scripts/site_chrome.py');
  assert.ok(generated.includes('"demo.html": ("", "", "demo-mobile-nav"'));
  assert.ok(generated.includes('"demo.html": "Guided demo"'));
  assert.ok(html.includes('<link rel="stylesheet" href="site-chrome.css">'));
  assert.ok(html.includes('<script src="site-theme.js"></script>'));
  assert.ok(html.includes('<details class="site-mobile-chrome__nav" id="demo-mobile-nav">'));
  assert.ok(html.includes('data-page-label="Guided demo"'));
  assert.ok(html.includes('<nav class="site-chrome demo-site-chrome" aria-label="AI Updates primary navigation">'));
  assert.ok(!html.includes('Demo navigation'));
  for (const obsolete of ['index.html#coverage','index.html#alerts','index.html#papers']) {
    assert.ok(!html.includes(obsolete),'Demo must use canonical hash routes: '+obsolete);
  }
  const extractLinks=(source)=>{
    const raw=source.split('<div class="site-chrome__links">')[1];
    assert.ok(raw,'Missing shared desktop link list');
    const links=raw.split('</div>')[0];
    return links.split('<a href="').slice(1).map(anchor=>[
      anchor.split('"')[0],
      anchor.split('>')[1].split('<')[0]
    ]);
  };
  assert.deepEqual(extractLinks(html),extractLinks(about),
    'Demo and About must share the same seven primary destinations and order');
  assert.equal((html.match(/href="index.html#\/overview">Discover<\/a>/g)||[]).length,2,
    'Discover remains a real parent link, but is not incorrectly marked current');
  assert.equal((html.match(/href="demo.html" aria-current="location">Guided professor demo<\/a>/g)||[]).length,2,
    'Demo is the current secondary destination in both mobile and desktop navigation');
  assert.ok(html.includes('href="index.html#/sources">Inspect published inventory'));
  assert.ok(html.includes(':root[data-theme="dark"]'));
  assert.ok(html.includes('article{padding:26px;background:var(--demo-card)'));
  assert.ok(html.includes('<a class="go" href="terms/MLD-0691-machine-learning.html">'));
  assert.ok(html.includes('index.html#/papers?q=reward'));
  assert.ok(html.includes('index.html#/safety'));
  assert.ok(read('scripts/build_seo.py').includes("str(guide_count) + ' now have expanded explanations'"));
});




test('generated reference page identity uses one shared workspace title without duplicating chrome', () => {
  const theme=read('site-theme.js');
  assert.ok(theme.includes(".site-mobile-chrome:not([data-page-label])"),
    'the shared title lookup must work for both sibling- and nested-chrome reference pages');
  assert.ok(theme.includes("bar.dataset.pageLabel = title;"));
  assert.ok(theme.includes("document.addEventListener('DOMContentLoaded'"));
  for (const [page, title] of [
    ['terms/MLD-0691-machine-learning.html','Machine learning'],
    ['technology/TECH-0216-pytorch.html','PyTorch']
  ]) {
    const html=read(page);
    assert.ok(html.includes('<h1>'+title+'</h1>'));
    assert.ok(html.includes('class="directory-mobile-topbar site-mobile-chrome"'));
    assert.ok(html.includes('site-chrome__links'));
  }
  assert.ok(read('site-chrome.css').includes('.site-mobile-chrome[data-page-label]::before{content:attr(data-page-label)}'));
  assert.ok(!read('site-chrome.css').includes('atlas-desktop-search:begin'),
    'native desktop search remains in the existing 78px shared workspace bar');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(theme),
    'offline fallback must still embed the complete shared theme helper');
});

test('all standalone skip links move keyboard focus to a unique native destination', () => {
  const pages = ['about.html','research.html','catalog-review.html','hardware-review.html',
    'games.html','technologies.html','playbooks.html','whats-new.html','demo.html'];
  const generator = read('scripts/site_chrome.py');
  assert.match(generator, /def ensure_skip_destination_focusable\(html, path=None\):/);
  assert.match(generator, /return ensure_skip_destination_focusable\(migrate_legacy_article_landmark\(normalized, path\), path\)/);
  assert.match(read('scripts/build_seo.py'), /ensure_skip_destination_focusable\(shell\(/);
  for (const route of pages) {
    const html = read(route);
    const skip = html.match(/<a class="skip" href="#([a-z0-9-]+)"/);
    assert.ok(skip, route + ' native skip link');
    const targets = [...html.matchAll(/<[a-z][a-z0-9]*\b[^>]*\bid="([^"]+)"[^>]*>/gi)]
      .filter(match => match[1] === skip[1]);
    assert.equal(targets.length, 1, route + ' unique target');
    assert.match(targets[0][0], /\btabindex="-1"/, route + ' focusable target');
  }
});


test('standalone native article skips bypass the shared rail before JavaScript', () => {
  const helper = read('scripts/site_chrome.py');
  assert.ok(helper.includes('def ensure_skip_destination_focusable(html, path=None):'));
  assert.ok(helper.includes('return ensure_skip_destination_focusable(migrate_legacy_article_landmark(normalized, path), path)'));
  assert.ok(read('scripts/build_seo.py').includes("about), 'about.html')"));
  for (const [route, marker] of [
    ['about.html', '<header class="hero" id="main" tabindex="-1">'],
    ['research.html', '<section class="hero" id="main" tabindex="-1">'],
    ['playbooks.html', '<section class="playbook-hero" id="main" tabindex="-1">'],
    ['technologies.html', '<section class="tech-hero" id="main" tabindex="-1">'],
    ['hardware-review.html', '<header id="main" tabindex="-1">']
  ]) {
    const html = read(route);
    assert.equal((html.match(/id="main"/g) || []).length, 1, route + ' has one target');
    assert.ok(html.includes('<a class="skip" href="#main">'), route + ' keeps native skip');
    assert.ok(html.includes(marker), route + ' targets the real article heading');
    const main = html.match(/<main\b[^>]*>/)?.[0];
    assert.ok(main && !main.includes('id="main"'), route + ' retains an independent main landmark');
    const nav = html.indexOf('<nav class="site-chrome ');
    const navEnd = html.indexOf('</nav>', nav);
    assert.ok(nav >= 0 && html.indexOf(marker) > navEnd, route + ' target follows shared navigation');
  }
});

test('generated dictionary and technology skip links target article content after the shared rail', () => {
  const theme = read('site-theme.js');
  const css = read('site-chrome.css');
  // Both detail families ship the shared rail as a native sibling of main.
  // The current enhancement moves only the preserved concept footer.
  assert.ok(theme.includes("document.querySelector('body > main.term-shell')"));
  assert.ok(theme.includes("document.querySelector('body > nav.site-chrome.term-nav')"));
  assert.ok(theme.includes("main?.querySelector(':scope > footer')"));
  assert.ok(theme.includes("main.after(footer);"));
  assert.ok(!theme.includes("main.before(mobile, rail);"),
    'the native rail must never be duplicated or moved after hydration');
  assert.ok(css.includes('body > .directory-mobile-topbar.site-mobile-chrome:has(+ nav.site-chrome + main.term-shell)'),
    'Concept header must not retain negative nested gutters when it becomes a body sibling');
  assert.ok(css.includes('html:has(.site-chrome){scroll-padding-top:96px}'));
  assert.ok(!css.includes('scroll-margin-top:96px'), 'root offset must not double-stack with article scroll margins');
  const helper = read('scripts/site_chrome.py');
  assert.ok(helper.includes('def native_directory_article_skip(body, path, *, native_concept_article=False):'));
  assert.ok(read('scripts/build_term_pages.py').includes(
    'native_directory_article_skip(body, path, native_concept_article=native_concept_article)'));
  assert.ok(read('scripts/build_seo.py').includes('native_directory_article_skip(body, path)'));
  for (const route of ['terms/index.html', 'technology/index.html']) {
    const html = read(route);
    assert.ok(html.includes('<a class="skip" href="#main">'), route+' preserves native skip');
    assert.ok(html.includes('<main class="term-shell">'), route+' retains main landmark');
    assert.ok(html.includes('<header class="hero" id="main" tabindex="-1">'),
      route+' skips the shared rail even with JavaScript disabled');
    assert.equal((html.match(/id="main"/g) || []).length, 1, route+' unique skip target');
  }
  const concept = read('terms/MLD-0691-machine-learning.html');
  assert.ok(concept.includes('<main class="term-shell">') &&
            concept.includes('<header class="hero" id="main" tabindex="-1">'),
    'Expanded concept guides must focus the article natively, as profiles do');
  const referenceDepth = read('terms/MLD-0001-a-b-test.html');
  assert.ok(referenceDepth.includes('<main class="term-shell">') &&
            referenceDepth.includes('<header class="hero" id="main" tabindex="-1">') &&
            !referenceDepth.includes('<main class="term-shell" id="main">'),
    'Unexpanded references natively skip the shared rail to the article heading');
  const technologyPages = fs.readdirSync(path.join(__dirname, '..', 'technology'))
    .filter(name => /^TECH-\d{4}-[^/]+\.html$/.test(name));
  assert.equal(technologyPages.length, 303, 'All published technology URLs must remain stable');
  for (const name of technologyPages) {
    const route = 'technology/' + name, html = read(route);
    assert.ok(html.includes('<a class="skip" href="#main">'), route+' retains native skip');
    assert.ok(html.includes('<main class="term-shell">'), route+' retains the main landmark');
    assert.ok(!html.includes('<main class="term-shell" id="main">'), route+' bypasses navigation');
    assert.ok(html.includes('<header class="hero" id="main" tabindex="-1">'),
      route+' has a focusable article heading with JavaScript disabled');
    assert.equal((html.match(/id="main"/g) || []).length, 1, route+' unique fragment');
    assert.ok(html.indexOf('<header class="hero" id="main"') > html.indexOf('</nav>'),
      route+' fragment follows the shared rail');
  }
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(offline.includes(theme) && offline.includes(css),
    'offline fallback embeds the exact updated shared assets');
});

test('shared desktop hash navigation clears the fixed workspace bar on editorial and reference pages', () => {
  const css = read('site-chrome.css');
  assert.match(css, /html:has\(\.site-chrome\)\{scroll-padding-top:96px\}/);
  assert.match(css, /height:78px/);
  for (const route of ['catalog-review.html','hardware-review.html',
    'research.html','terms/index.html','technology/index.html']) {
    assert.ok(read(route).includes('site-chrome.css'), route+' loads the shared anchor offset');
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'offline fallback must embed the matching shared frame styling');
});


test('shared mobile menu and real search stay within reach while scrolling long pages', () => {
  const css = read('site-chrome.css');
  const block = css.split('/* atlas-mobile-sticky-frame:begin */')[1]
    ?.split('/* atlas-mobile-sticky-frame:end */')[0];
  assert.ok(block, 'one shared sticky mobile header rule');
  assert.match(block, /@media\(max-width:650px\)/);
  assert.match(block, /body:has\(\.site-chrome\) \.site-mobile-chrome\{\s*position:sticky;/);
  assert.match(block, /body:has\(\.site-chrome\) \.games-header\{\s*position:sticky;/);
  assert.match(block, /\.games-header \.site-mobile-chrome\{\s*position:relative;/);
  assert.ok(!block.includes('atlas-enhanced'), 'native sticky navigation also works without JS');
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'the offline fallback carries the exact shared navigation frame');
});

test('shared mobile navigation remains a native dropdown without JavaScript', () => {
  const css = read('site-chrome.css');
  const script = read('site-theme.js');
  const drawer = css.split('/* The shared native mobile navigation uses')[1]
    .split('/* Give standalone pages the same 78px')[0];
  assert.match(script, /document\.documentElement\.classList\?\.add\('atlas-enhanced'\)/);
  assert.match(drawer, /html\.atlas-enhanced body:has\(\.site-mobile-chrome__nav\[open\]\)/);
  assert.match(drawer, /html\.atlas-enhanced \.site-mobile-chrome \.site-mobile-chrome__menu\{/);
  assert.match(drawer, /html\.atlas-enhanced \.site-mobile-chrome:has\(\.site-mobile-chrome__nav\[open\]\)::before/);
  assert.ok(!drawer.includes('\nbody:has(.site-mobile-chrome__nav[open])'));
  assert.ok(!drawer.includes('\n.site-mobile-chrome .site-mobile-chrome__menu{'));
  const fallback = read('downloads/Atlas_Demo_Offline.html');
  assert.ok(fallback.includes(css) && fallback.includes(script),
    'single-file offline fallback embeds the exact progressive enhancement code');
});


test('shared sticky mobile header clears native hash targets without JavaScript', () => {
  const css = read('site-chrome.css');
  assert.match(css, /@media \(max-width:650px\)\{\s*html:has\(\.site-chrome\)\{scroll-padding-top:80px\}\s*\}/);
  assert.match(css, /@media \(min-width:651px\)\{[\s\S]*?html:has\(\.site-chrome\)\{scroll-padding-top:96px\}/);
  for (const route of ['catalog-review.html', 'terms/index.html', 'technology/index.html']) {
    const html = read(route);
    assert.match(html, /<a class="skip" href="#main">/);
    assert.match(html, /class="[^"]*site-mobile-chrome__search"/);
    assert.match(html, /<nav class="site-chrome [^"]*"/);
  }
  assert.ok(read('downloads/Atlas_Demo_Offline.html').includes(css),
    'Offline fallback must embed the same responsive scroll offset');
});


test('enhanced shared mobile drawer locks root and body without breaking native dropdowns', () => {
  const css = read('site-chrome.css');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  assert.match(css, /html\.atlas-enhanced:has\(\.site-mobile-chrome__nav\[open\]\)\{overflow:hidden\}/);
  assert.match(css, /html\.atlas-enhanced body:has\(\.site-mobile-chrome__nav\[open\]\)\{overflow:hidden\}/);
  assert.ok(!css.includes('\nhtml:has(.site-mobile-chrome__nav[open]){overflow:hidden}'),
    'native no-JavaScript dropdown must not lock the document');
  assert.ok(offline.includes('html.atlas-enhanced:has(.site-mobile-chrome__nav[open]){overflow:hidden}'),
    'offline fallback embeds the same shared root-scroll lock');
});

test('existing editorial and reference page titles share Discover headline typography', () => {
  const css = read('site-chrome.css');
  const offline = read('downloads/Atlas_Demo_Offline.html');
  const block = css.split('/* atlas-shared-headlines:begin */')[1]?.split('/* atlas-shared-headlines:end */')[0];
  assert.ok(block, 'A single shared headline rule must exist');
  assert.equal(css.split('/* atlas-shared-headlines:begin */').length - 1, 1);
  assert.ok(block.includes('.term-shell > .hero:not(:has(.discover-heading)) h1'), 'Generated references and directories share one rule');
  assert.ok(!block.includes('.review-shell > header'), 'Preserve previously calibrated editorial headings');
  assert.ok(block.includes('font:400 clamp(40px,4.2vw,56px)/1.08 Georgia'));
  assert.ok(block.includes('h1{font-size:43px}'), 'Mobile reference headline matches Discover');
  assert.ok(block.includes('overflow-wrap:break-word'));
  assert.ok(!block.includes('.games-header'), 'Games retains its own compact header');
  assert.ok(offline.includes('/* atlas-shared-headlines:begin */'),
    'Single-file fallback must embed the shared style');
});

test('both reference directories reuse Discover editorial headings from one generated component', () => {
  const shared = read('scripts/site_chrome.py');
  assert.match(shared, /def render_directory_hero\(eyebrow, title, summary, \*, lead=False\):/);
  for (const [route, heading] of [
    ['terms/index.html', 'Follow the connections.'],
    ['technology/index.html', 'Tools, with context.']
  ]) {
    const html = read(route);
    assert.match(html, /<header class="hero" id="main" tabindex="-1"><div class="discover-heading"><div><p class="eyebrow">/);
    assert.ok(html.includes('<h1>' + heading + '</h1></div></div>'), route);
    assert.equal((html.match(/class="discover-heading"/g) || []).length, 1, route);
    assert.ok(!html.includes('.term-shell h1{font:'), 'directory must inherit Discover headline font: ' + route);
    assert.ok(!html.includes('.term-shell h1{font-size:'), 'directory must inherit Discover headline size: ' + route);
  }
  assert.match(read('scripts/build_term_pages.py'), /intro = render_directory_hero\(/);
  assert.match(read('scripts/build_seo.py'), /body = render_directory_hero\(/);
  // Expanded concept guides and technology profiles keep one shared native article-skip destination.
  assert.match(read('terms/MLD-0002-ablation-study.html'), /<main class="term-shell">[\s\S]*?<header class="hero" id="main" tabindex="-1">/);
  assert.match(read('technology/TECH-0216-pytorch.html'), /<header class="hero" id="main" tabindex="-1">/);
});


test('Games and daily archive share Discover editorial heading without replacing functional content', () => {
  const workspace = read('index.html');
  const styles = read('brand.css');
  assert.ok(workspace.includes('class="discover-heading"'));
  assert.match(styles, /\.discover-heading h1\{font:400 clamp\(40px,4\.2vw,56px\)/);
  for (const [route, eyebrow] of [
    ['games.html', 'THE PRACTICE ROOM'],
    ['whats-new.html', 'DAILY INTELLIGENCE · EVIDENCE FIRST'],
  ]) {
    const html = read(route);
    assert.equal((html.match(/<div class="discover-heading">/g) || []).length, 1, route);
    assert.ok(html.includes('<div class="discover-heading"><div><p class="eyebrow">') ||
              html.includes('<div class="discover-heading"><div><p class="eyebrow"><span'), route);
    assert.ok(html.includes(eyebrow), route);
    assert.ok(html.includes('<link rel="stylesheet" href="brand.css">'), route);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, route);
    assert.ok(html.includes('class="site-chrome__links"'), route);
  }
  const games = read('games.html');
  assert.ok(games.includes('id="start-quiz"') && games.includes('id="start-match"') &&
            games.includes('id="start-flashcards"'));
  const daily = read('whats-new.html');
  assert.ok(daily.includes('id="edition-select"') && daily.includes('id="edition-content"') &&
            daily.includes('id="edition-search"'));
});

test('Guided demo uses Discover editorial chrome and native article skipping while preserving tour links', () => {
  const html=read('demo.html'), about=read('about.html'), styles=read('brand.css');
  assert.equal((html.match(/<div class="discover-heading">/g) || []).length, 1);
  assert.match(about, /<div class="discover-heading">/);
  assert.match(styles, /\.discover-heading h1\{font:400 clamp\(40px,4\.2vw,56px\)/);
  assert.match(html, /<a class="skip" href="#main">Skip to content<\/a>/);
  assert.match(html, /<header id="main" tabindex="-1"><div class="discover-heading">/);
  assert.ok(html.indexOf('class="site-chrome demo-site-chrome"') < html.indexOf('<header id="main"'));
  assert.equal((html.match(/\bid="main"/g) || []).length, 1);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /id="quick-tour" class="grid"/);
  assert.match(html, /Explore 1,345 concepts, 303 technology profiles/);
  assert.match(html, /class="site-mobile-chrome__search" href="index.html#\/search"/);
  assert.match(html, /href="index.html#\/games"/);
});
